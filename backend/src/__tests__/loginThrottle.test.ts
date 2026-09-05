import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import request from './helpers/http';
import bcrypt from 'bcryptjs';
import app from '../app';
import { platformPrisma } from '../prismaClient';
import { testPrisma as prisma } from './helpers/tenantTest';
import {
  BASE_LOCKOUT_MS,
  FAILURE_DECAY_MS,
  FAILURE_THRESHOLD,
  LoginThrottle,
  MAX_LOCKOUT_MS,
  lockoutDurationMs,
  loginThrottle,
} from '../lib/loginThrottle';

describe('login throttle — backoff maths', () => {
  it('stays silent below the threshold', () => {
    for (let failures = 0; failures < FAILURE_THRESHOLD; failures++) {
      expect(lockoutDurationMs(failures)).toBe(0);
    }
  });

  it('doubles each failure past the threshold and caps at 30 minutes', () => {
    expect(lockoutDurationMs(5)).toBe(60_000);
    expect(lockoutDurationMs(6)).toBe(120_000);
    expect(lockoutDurationMs(7)).toBe(240_000);
    expect(lockoutDurationMs(8)).toBe(480_000);
    expect(lockoutDurationMs(9)).toBe(960_000);
    expect(lockoutDurationMs(10)).toBe(MAX_LOCKOUT_MS);
    expect(lockoutDurationMs(50)).toBe(MAX_LOCKOUT_MS);
    // Guards against `2 ** doublings` overflowing to Infinity on a long-lived
    // counter rather than clamping.
    expect(lockoutDurationMs(5000)).toBe(MAX_LOCKOUT_MS);
  });
});

describe('LoginThrottle', () => {
  const email = 'clock@lockout.test';
  let now: number;
  let throttle: LoginThrottle;

  beforeEach(() => {
    now = 1_700_000_000_000;
    throttle = new LoginThrottle(() => now);
  });

  it('locks only once the threshold is reached', () => {
    for (let i = 1; i < FAILURE_THRESHOLD; i++) {
      expect(throttle.registerFailure(email).locked).toBe(false);
      expect(throttle.check(email).locked).toBe(false);
    }

    const tripped = throttle.registerFailure(email);
    expect(tripped).toMatchObject({
      failures: FAILURE_THRESHOLD,
      locked: true,
      retryAfterMs: BASE_LOCKOUT_MS,
    });
    expect(throttle.check(email)).toEqual({
      locked: true,
      retryAfterMs: BASE_LOCKOUT_MS,
    });
  });

  it('escalates the lockout on every further failure and caps it', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) throttle.registerFailure(email);

    const observed: number[] = [];
    for (let i = 0; i < 6; i++) {
      // Wait out the current lock, then fail once more.
      now += throttle.check(email).retryAfterMs;
      expect(throttle.check(email).locked).toBe(false);
      observed.push(throttle.registerFailure(email).retryAfterMs);
    }

    expect(observed).toEqual([
      120_000,
      240_000,
      480_000,
      960_000,
      MAX_LOCKOUT_MS,
      MAX_LOCKOUT_MS,
    ]);
  });

  it('clears the counter on reset', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) throttle.registerFailure(email);
    expect(throttle.check(email).locked).toBe(true);

    throttle.reset(email);
    expect(throttle.check(email).locked).toBe(false);

    // The counter restarts from zero, not from the old total.
    for (let i = 1; i < FAILURE_THRESHOLD; i++) {
      expect(throttle.registerFailure(email).locked).toBe(false);
    }
    expect(throttle.registerFailure(email).retryAfterMs).toBe(BASE_LOCKOUT_MS);
  });

  it('forgets a record left idle for the decay window', () => {
    throttle.registerFailure(email);
    throttle.registerFailure(email);

    now += FAILURE_DECAY_MS + 1;
    expect(throttle.registerFailure(email).failures).toBe(1);
  });

  it('treats casing and surrounding whitespace as the same account', () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      throttle.registerFailure('  Clock@Lockout.TEST ');
    }
    expect(throttle.check(email).locked).toBe(true);
  });

  it('is inert when disabled', () => {
    throttle.enabled = false;
    for (let i = 0; i < FAILURE_THRESHOLD * 3; i++) {
      expect(throttle.registerFailure(email).locked).toBe(false);
    }
    expect(throttle.check(email).locked).toBe(false);
  });
});

describe('POST /api/auth/login — per-account lockout', () => {
  const known = 'known@lockout.test';
  const unknown = 'nobody@lockout.test';
  const password = 'lockout-pass-1';
  const throttleWasEnabled = loginThrottle.enabled;

  const attempt = (email: string, pw = 'wrong-password') =>
    request(app).post('/api/auth/login').send({ email, password: pw });

  const lockoutRows = (email: string) =>
    platformPrisma.auditLog.findMany({
      where: { action: 'LOGIN_LOCKED_OUT', userEmail: email },
    });

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: known } });
    await prisma.user.create({
      data: {
        email: known,
        password: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        name: 'Lockout User',
      },
    });
    // The shared instance is off under Jest (like the IP limiter in app.ts);
    // this suite is the one that needs it on.
    loginThrottle.enabled = true;
  });

  afterAll(() => {
    loginThrottle.enabled = throttleWasEnabled;
  });

  beforeEach(async () => {
    loginThrottle.clear();
    await platformPrisma.auditLog.deleteMany({
      where: {
        action: 'LOGIN_LOCKED_OUT',
        userEmail: { in: [known, unknown] },
      },
    });
  });

  it('locks the account after the threshold and refuses the correct password too', async () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      const res = await attempt(known);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    }

    const locked = await attempt(known);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe(
      'Too many failed login attempts. Try again in 1 minute.',
    );
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(locked.headers['retry-after'])).toBeLessThanOrEqual(60);

    // The whole point: knowing the password does not get you past the lock.
    const withRealPassword = await attempt(known, password);
    expect(withRealPassword.status).toBe(429);
    expect(withRealPassword.body.token).toBeUndefined();
  });

  it('gives a locked unknown email the same answer as a locked real account', async () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      const res = await attempt(unknown);
      // Below the threshold the two are already identical.
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid credentials' });
    }
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      await attempt(known);
    }

    const lockedUnknown = await attempt(unknown);
    const lockedKnown = await attempt(known);

    expect(lockedUnknown.status).toBe(429);
    expect(lockedUnknown.status).toBe(lockedKnown.status);
    expect(lockedUnknown.body).toEqual(lockedKnown.body);
    expect(lockedUnknown.headers['retry-after']).toBeDefined();
  });

  it('resets the counter after a successful login', async () => {
    for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
      expect((await attempt(known)).status).toBe(401);
    }

    const success = await attempt(known, password);
    expect(success.status).toBe(200);
    expect(success.body.token).toEqual(expect.any(String));

    // Without the reset the very next failure would trip the lock; instead a
    // fresh run of THRESHOLD failures is needed.
    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      expect((await attempt(known)).status).toBe(401);
    }
    expect((await attempt(known)).status).toBe(429);
  });

  it('writes one AuditLog row when a lockout trips', async () => {
    expect(await lockoutRows(known)).toHaveLength(0);

    for (let i = 0; i < FAILURE_THRESHOLD; i++) await attempt(known);

    const rows = await lockoutRows(known);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe('User');
    expect(rows[0].userId).toEqual(expect.any(Number));
    expect(rows[0].details).toContain(`${FAILURE_THRESHOLD} failed attempts`);

    // Blocked requests must not each add a row — that would be a free way to
    // flood AuditLog.
    await attempt(known);
    await attempt(known);
    expect(await lockoutRows(known)).toHaveLength(1);
  });

  it('audits a lockout on an unknown email with no tenant attached', async () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i++) await attempt(unknown);

    const rows = await lockoutRows(unknown);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].tenantId).toBeNull();
  });
});
