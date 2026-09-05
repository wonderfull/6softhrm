import { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from './authConfig';

// Bucket for the global /api limiter. Keying on IP alone is the objection
// loginThrottle.ts already makes about login limits: a customer whose staff sit
// behind one office NAT shares a single allowance and can throttle itself out
// of the product during ordinary use.
//
// The token has to be VERIFIED, not merely decoded. An unverified claim would
// let anyone mint a fresh identity per request and walk through the limiter
// entirely, so anything that does not carry a signature we trust — forged,
// expired, malformed, missing — keeps the shared IP bucket it has today.
//
// This runs on every /api request, ahead of requireAuth (which is why it does
// its own verification rather than reading req.user). The cost is one HMAC.

export interface RateLimitKeyRequest {
  ip?: string;
  headers?: { authorization?: string | string[] };
}

export function apiRateLimitKey(
  req: RateLimitKeyRequest,
  readSecret: () => string = getJwtSecret,
): string {
  return (
    verifiedIdentity(req.headers?.authorization, readSecret) ??
    // ipKeyGenerator, not the raw address: it collapses an IPv6 client to its
    // /56, which is what the library's default generator does today and what
    // stops one client cycling addresses out of its own prefix.
    `ip:${ipKeyGenerator(req.ip ?? '')}`
  );
}

function verifiedIdentity(
  header: string | string[] | undefined,
  readSecret: () => string,
): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;

  let payload: unknown;
  try {
    payload = jwt.verify(match[1], readSecret());
  } catch {
    // Covers a bad signature, an expired token, garbage — and an unset
    // JWT_SECRET, where falling back beats throwing out of the limiter and
    // failing the request.
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const claims = payload as Record<string, unknown>;

  // Password-reset and 2FA-pending tokens verify but are not sessions, and
  // requireAuth refuses them as such. A reset token is obtainable by anyone
  // who can receive mail at a known address, so honouring it as an identity
  // would hand an outsider a private bucket.
  if (claims.type) return null;

  if (claims.kind === 'platform') {
    return claims.platformAdminId ? `pa:${claims.platformAdminId}` : null;
  }

  // The tenant is part of the key so that user 7 of two customers cannot share
  // an allowance. Tokens predating multi-tenancy carry no tenantId; requireAuth
  // rejects them outright, so they get no bucket of their own here either.
  if (claims.tenantId && claims.id) {
    return `u:${claims.tenantId}:${claims.id}`;
  }
  return null;
}
