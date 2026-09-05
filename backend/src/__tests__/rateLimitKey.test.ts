import { describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { apiRateLimitKey } from '../lib/rateLimitKey';

// The global /api limiter used to bucket by IP alone, so a twenty-person
// customer behind one office NAT shared a single 300/min allowance and could
// throttle itself out of the product — the same objection loginThrottle.ts
// raises against IP-keyed login limits. Each verified session now gets its own
// bucket, and anything we cannot verify keeps the old shared IP bucket, so a
// forged token buys an attacker nothing.

const OFFICE_IP = '203.0.113.44';
const HOME_IP = '198.51.100.12';

// Read at call time, not module load: setup.ts sets JWT_SECRET in beforeAll,
// so a value captured up here would not be the one getJwtSecret sees.
function appSecret(): string {
  return process.env.JWT_SECRET || 'test-secret-key';
}

function sign(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = {},
  secret: string = appSecret(),
): string {
  return jwt.sign(payload, secret, options);
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    email: 'sam@acme.test',
    role: 'USER',
    tenantId: 1,
    ...overrides,
  };
}

function keyFor(token: string | undefined, ip: string = OFFICE_IP): string {
  return apiRateLimitKey({
    ip,
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

describe('apiRateLimitKey', () => {
  it('gives two verified users on one office IP separate buckets', () => {
    const alice = keyFor(sign(session({ id: 7 })));
    const bob = keyFor(sign(session({ id: 8 })));

    expect(alice).not.toBe(bob);
  });

  it('keeps one user in a single bucket across two IPs', () => {
    const token = sign(session());

    expect(keyFor(token, OFFICE_IP)).toBe(keyFor(token, HOME_IP));
  });

  it('never lets the same user id in two tenants collide', () => {
    const first = keyFor(sign(session({ id: 7, tenantId: 1 })));
    const second = keyFor(sign(session({ id: 7, tenantId: 2 })));

    expect(first).not.toBe(second);
  });

  it('gives a verified platform admin their own bucket', () => {
    const one = keyFor(sign({ kind: 'platform', platformAdminId: 1 }));
    const two = keyFor(sign({ kind: 'platform', platformAdminId: 2 }));

    expect(one).not.toBe(two);
    expect(one).not.toBe(keyFor(undefined));
  });

  it('falls back to the IP bucket for a token signed with another secret', () => {
    const forged = sign(session({ id: 999 }), {}, 'attacker-secret');

    expect(keyFor(forged)).toBe(keyFor(undefined));
  });

  it('falls back to the IP bucket for a tampered token', () => {
    const [header, , signature] = sign(session()).split('.');
    // Same signature, a payload the holder rewrote to claim another user.
    const swapped = Buffer.from(JSON.stringify(session({ id: 4242 }))).toString(
      'base64url',
    );
    const tampered = [header, swapped, signature].join('.');

    expect(keyFor(tampered)).toBe(keyFor(undefined));
  });

  it('falls back to the IP bucket for an expired token', () => {
    const expired = sign(session(), { expiresIn: '-1h' });

    expect(keyFor(expired)).toBe(keyFor(undefined));
  });

  it('falls back to the IP bucket for a malformed or absent header', () => {
    const ipKey = keyFor(undefined);

    expect(apiRateLimitKey({ ip: OFFICE_IP })).toBe(ipKey);
    expect(apiRateLimitKey({ ip: OFFICE_IP, headers: {} })).toBe(ipKey);
    expect(keyFor('')).toBe(ipKey);
    expect(keyFor('not-a-jwt')).toBe(ipKey);
    expect(keyFor('a.b.c')).toBe(ipKey);
    expect(
      apiRateLimitKey({
        ip: OFFICE_IP,
        headers: { authorization: 'Basic abc' },
      }),
    ).toBe(ipKey);
    expect(
      apiRateLimitKey({
        ip: OFFICE_IP,
        headers: { authorization: ['Bearer x', 'Bearer y'] },
      }),
    ).toBe(ipKey);
  });

  it('falls back to the IP bucket when the secret cannot be read', () => {
    const token = sign(session());
    const unconfigured = () => {
      throw new Error('JWT_SECRET is not configured securely');
    };

    expect(
      apiRateLimitKey(
        { ip: OFFICE_IP, headers: { authorization: `Bearer ${token}` } },
        unconfigured,
      ),
    ).toBe(keyFor(undefined));
  });

  it('does not treat a reset or 2FA-pending token as a session', () => {
    const ipKey = keyFor(undefined);

    expect(keyFor(sign({ id: 7, type: 'password-reset' }))).toBe(ipKey);
    expect(keyFor(sign({ id: 7, tenantId: 1, type: '2fa-pending' }))).toBe(
      ipKey,
    );
  });

  it('falls back to the IP bucket for a verified token with no tenant', () => {
    expect(keyFor(sign({ id: 7, email: 'sam@acme.test' }))).toBe(
      keyFor(undefined),
    );
  });

  it('never puts the raw token in the key', () => {
    const token = sign(session());
    const key = keyFor(token);

    expect(key).not.toContain(token);
    for (const part of token.split('.')) {
      expect(key).not.toContain(part);
    }
  });

  it('buckets IPv6 clients by subnet, as the default generator does', () => {
    // Without this an IPv6 client can walk the limiter by picking a fresh
    // address out of its own /56 for every request.
    const inSubnet = apiRateLimitKey({ ip: '2001:db8:1:100::1' });
    const sameSubnet = apiRateLimitKey({ ip: '2001:db8:1:1ff::9' });
    const otherSubnet = apiRateLimitKey({ ip: '2001:db8:1:200::1' });

    expect(inSubnet).toBe(sameSubnet);
    expect(inSubnet).not.toBe(otherSubnet);
  });
});
