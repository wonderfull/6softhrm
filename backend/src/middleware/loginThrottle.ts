import { NextFunction, Request, Response } from 'express';
import { lockoutMessage, loginThrottle } from '../lib/loginThrottle';

// Refuses further attempts on an email that is already locked out. It runs
// before the user lookup, so a locked unknown address and a locked real
// account return byte-for-byte identical responses — the throttle never
// becomes an account-existence oracle.
//
// Blocked attempts are deliberately not audit-logged: the lockout is recorded
// once when it trips (see routes/auth.ts), and a row per blocked request would
// let an attacker drive unbounded writes into AuditLog.
export function throttleLoginByAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { locked, retryAfterMs } = loginThrottle.check(req.body?.email);
  if (!locked) return next();

  res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
  return res.status(429).json({ error: lockoutMessage(retryAfterMs) });
}
