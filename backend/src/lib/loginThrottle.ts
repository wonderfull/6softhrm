// Per-account login throttle with exponential backoff.
//
// The IP limiter in app.ts is not enough on its own: it is keyed by IP, so a
// distributed attack spread across many hosts stays under the limit while
// hammering ONE account, and a whole office behind a single NAT can lock each
// other out. This tracks failures per email address instead.
//
// Storage is a process-local Map. PM2 runs the API as a single instance
// (ecosystem.config.js pins `instances: 1`), so every request shares one set of
// counters — but they are NOT durable: a restart, deploy or crash clears every
// lock, and an attacker who could force a restart could reset their own
// counter. Persisting them would need a schema change; AuditLog keeps the
// forensic record either way.

export const FAILURE_THRESHOLD = 5;
export const BASE_LOCKOUT_MS = 60_000;
export const MAX_LOCKOUT_MS = 30 * 60_000;
// A record left untouched for this long is forgotten, so occasional typos
// spread over days never accumulate into a lockout.
export const FAILURE_DECAY_MS = 30 * 60_000;
// Ceiling on tracked addresses: an attacker cycling through emails must not be
// able to grow the map without bound.
const MAX_TRACKED = 10_000;

// 5 → 1m, 6 → 2m, 7 → 4m, 8 → 8m, 9 → 16m, 10+ → 30m (capped).
export function lockoutDurationMs(failures: number): number {
  if (failures < FAILURE_THRESHOLD) return 0;
  const doublings = failures - FAILURE_THRESHOLD;
  if (doublings >= 31) return MAX_LOCKOUT_MS;
  return Math.min(BASE_LOCKOUT_MS * 2 ** doublings, MAX_LOCKOUT_MS);
}

export function lockoutMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}

export interface ThrottleState {
  locked: boolean;
  retryAfterMs: number;
}

export interface FailureResult extends ThrottleState {
  failures: number;
}

interface Attempt {
  failures: number;
  lockedUntil: number;
  lastFailureAt: number;
}

function throttleKey(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

const UNLOCKED: ThrottleState = { locked: false, retryAfterMs: 0 };

export class LoginThrottle {
  // Flipped off under Jest by the shared instance below; suites that exercise
  // the throttle turn it back on explicitly.
  enabled = true;

  private readonly attempts = new Map<string, Attempt>();

  constructor(private readonly now: () => number = Date.now) {}

  check(email: unknown): ThrottleState {
    if (!this.enabled) return UNLOCKED;
    const entry = this.attempts.get(throttleKey(email));
    if (!entry) return UNLOCKED;
    const remaining = entry.lockedUntil - this.now();
    return remaining > 0 ? { locked: true, retryAfterMs: remaining } : UNLOCKED;
  }

  registerFailure(email: unknown): FailureResult {
    if (!this.enabled) return { ...UNLOCKED, failures: 0 };

    const key = throttleKey(email);
    const now = this.now();
    this.prune(now);

    const previous = this.attempts.get(key);
    // A record only decays once its lock has expired, so a long lockout is
    // never shortened by the decay window elapsing underneath it.
    const stale =
      !previous ||
      (now >= previous.lockedUntil &&
        now - previous.lastFailureAt > FAILURE_DECAY_MS);
    const failures = stale ? 1 : previous.failures + 1;
    const retryAfterMs = lockoutDurationMs(failures);

    this.attempts.set(key, {
      failures,
      lastFailureAt: now,
      lockedUntil: retryAfterMs > 0 ? now + retryAfterMs : 0,
    });

    return { failures, locked: retryAfterMs > 0, retryAfterMs };
  }

  reset(email: unknown): void {
    this.attempts.delete(throttleKey(email));
  }

  clear(): void {
    this.attempts.clear();
  }

  private prune(now: number): void {
    if (this.attempts.size < MAX_TRACKED) return;
    for (const [key, entry] of this.attempts) {
      if (
        now >= entry.lockedUntil &&
        now - entry.lastFailureAt > FAILURE_DECAY_MS
      ) {
        this.attempts.delete(key);
      }
    }
  }
}

export const loginThrottle = new LoginThrottle();

// Disabled under Jest for the same reason app.ts skips the IP limiter: suites
// log in repeatedly and would trip the counters.
loginThrottle.enabled = !(
  process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID
);
