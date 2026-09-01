import crypto from 'crypto';

// Minimal RFC 6238 TOTP (SHA-1, 6 digits, 30s step) — the profile every
// authenticator app implements. Kept dependency-free and unit-tested.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(
  secret: string,
  timeStep = Math.floor(Date.now() / 30000),
): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));
  const hmac = crypto
    .createHmac('sha1', base32Decode(secret))
    .update(counter)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

/** Matches a code against the current step ±1 (clock drift); returns the matched step. */
function matchTotpStep(code: string, secret: string): number | null {
  const normalized = String(code).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;
  const step = Math.floor(Date.now() / 30000);
  for (const candidate of [step, step - 1, step + 1]) {
    if (
      crypto.timingSafeEqual(
        Buffer.from(totpCode(secret, candidate)),
        Buffer.from(normalized),
      )
    ) {
      return candidate;
    }
  }
  return null;
}

export function verifyTotp(code: string, secret: string): boolean {
  return matchTotpStep(code, secret) !== null;
}

// RFC 6238 §5.2: a verifier must not accept the same one-time code twice.
// Tracks the last accepted step per key (in-memory: per-process, cleared on
// restart — the replay window is only ±1 step, so that trade-off is fine).
const lastAcceptedStep = new Map<string, number>();

/** verifyTotp, but each code (time step) is accepted at most once per key. */
export function verifyTotpOnce(
  key: string,
  code: string,
  secret: string,
): boolean {
  const step = matchTotpStep(code, secret);
  if (step === null) return false;
  const last = lastAcceptedStep.get(key);
  if (last !== undefined && step <= last) return false;
  lastAcceptedStep.set(key, step);
  return true;
}

export function totpKeyUri(
  email: string,
  issuer: string,
  secret: string,
): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
