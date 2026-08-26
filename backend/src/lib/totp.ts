import crypto from 'crypto'

// Minimal RFC 6238 TOTP (SHA-1, 6 digits, 30s step) — the profile every
// authenticator app implements. Kept dependency-free and unit-tested.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 character')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

export function totpCode(secret: string, timeStep = Math.floor(Date.now() / 30000)): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(timeStep))
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  return String(code % 1_000_000).padStart(6, '0')
}

/** Accepts the current step ±1 to absorb clock drift. */
export function verifyTotp(code: string, secret: string): boolean {
  const normalized = String(code).replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false
  const step = Math.floor(Date.now() / 30000)
  for (const candidate of [step, step - 1, step + 1]) {
    if (crypto.timingSafeEqual(Buffer.from(totpCode(secret, candidate)), Buffer.from(normalized))) {
      return true
    }
  }
  return false
}

export function totpKeyUri(email: string, issuer: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
