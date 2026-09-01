import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getJwtSecret } from '../lib/authConfig';
import { tenantStore } from '../lib/tenantContext';
import { platformPrisma } from '../prismaClient';

dotenv.config();

export interface AuthRequest extends Request {
  user?: any;
  headers: {
    authorization?: string;
    [key: string]: string | string[] | undefined;
  };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header)
    return res.status(401).json({ error: 'Missing Authorization header' });

  const token = header.replace('Bearer ', '');
  let payload: any;
  try {
    const secret = getJwtSecret();
    payload = jwt.verify(token, secret);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === 'JWT_SECRET is not configured securely'
    ) {
      return res
        .status(500)
        .json({ error: 'Authentication configuration error' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Platform tokens never authorise tenant routes.
  if (payload?.kind === 'platform') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Special-purpose tokens (password reset, 2FA pending) are not sessions,
  // whatever other claims they carry.
  if (payload?.type) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Tokens minted before multi-tenancy carry no tenantId; force a fresh
  // login rather than running tenant-scoped work without a tenant.
  if (!payload || typeof payload !== 'object' || !payload.tenantId) {
    return res
      .status(401)
      .json({ error: 'Session expired — please log in again' });
  }

  // Live checks for real user tokens (all of which carry an id): the token
  // version must still match (revocation on password change / suspend), and
  // the tenant must still be active — suspension takes effect immediately,
  // not at the next login.
  if (payload.id) {
    const user = await platformPrisma.user.findUnique({
      where: { id: payload.id },
      select: {
        tokenVersion: true,
        tenantId: true,
        tenant: { select: { status: true, deletedAt: true } },
      },
    });
    if (
      !user ||
      user.tenantId !== payload.tenantId ||
      user.tokenVersion !== (payload.tokenVersion ?? 0)
    ) {
      return res
        .status(401)
        .json({ error: 'Session expired — please log in again' });
    }
    if (user.tenant.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'ACCOUNT_SUSPENDED' });
    }
    if (user.tenant.status === 'CANCELLED' || user.tenant.deletedAt) {
      return res.status(403).json({ error: 'ACCOUNT_CLOSED' });
    }
  }

  req.user = payload;

  // Enter the tenant context for everything downstream in this request.
  // The Prisma extension refuses tenant-model queries outside this scope.
  return tenantStore.run(
    { tenantId: payload.tenantId, userId: payload.id, role: payload.role },
    () => next(),
  );
}

// Multer (busboy) resumes the request from raw socket events, which drops the
// AsyncLocalStorage context entered in requireAuth. Mount this AFTER any
// multer middleware to re-enter the tenant context for the handler.
export function rebindTenant(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const payload = req.user;
  if (!payload || !payload.tenantId) {
    return res
      .status(401)
      .json({ error: 'Session expired — please log in again' });
  }
  return tenantStore.run(
    { tenantId: payload.tenantId, userId: payload.id, role: payload.role },
    () => next(),
  );
}
