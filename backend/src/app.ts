import express from 'express';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import sponsorshipRoutes from './routes/sponsorships';
import absenceRoutes from './routes/absences';
import payRoutes from './routes/pay';
import leaveRoutes from './routes/leave';
import timesheetRoutes from './routes/timesheets';
import projectRoutes from './routes/projects';
import documentRoutes from './routes/documents';
import adminRoutes from './routes/admin';
import gdprRoutes from './routes/gdpr';
import notificationsRoutes from './routes/notifications';
import platformRoutes from './routes/platform';
import tenantRoutes from './routes/tenant';
import reportRoutes from './routes/reports';
import reviewRoutes from './routes/reviews';
import checklistRoutes from './routes/checklists';
import documentTemplateRoutes from './routes/documentTemplates';
import expenseRoutes from './routes/expenses';
import trainingRoutes from './routes/training';
import caseRoutes from './routes/cases';
import publicRoutes from './routes/public';
import { requireFeature } from './lib/tenantPolicy';
import { requireAuth } from './middleware/auth';
import { shouldRelaxRateLimits } from './lib/rateLimitPolicy';
import { apiRateLimitKey } from './lib/rateLimitKey';
import { verifyEmailConfig } from './lib/emailService';
import { initializeCronJobs } from './lib/cronJobs';

dotenv.config();

// Avoid noisy external SMTP verification in local dev/test unless explicitly enabled.
if (process.env.VERIFY_SMTP_ON_BOOT === 'true') {
  verifyEmailConfig();
}

// Initialize scheduled tasks (daily expiry checks). Skipped under Jest:
// node-cron's scheduled tasks hold the event loop open (tests never exit)
// and the expiry sweep would hit the test database mid-run.
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  initializeCronJobs();
}

const app = express();

// Behind Nginx / Hostinger reverse proxy — needed for req.ip / X-Forwarded-For
// so AuditLog records the real client IP instead of 127.0.0.1.
//
// Exactly ONE hop, not `true`. With `true` Express takes the leftmost
// X-Forwarded-For entry, which the client supplies — so anyone could send a
// fresh fake IP per request and walk straight through the rate limiters below
// (express-rate-limit warns about this as ERR_ERL_PERMISSIVE_TRUST_PROXY).
// Nginx runs on the same host and appends the real address, so trusting one
// hop yields an IP the client cannot forge. Increase this only if you put
// another proxy (e.g. Cloudflare) in front, and by exactly the hops added.
app.set('trust proxy', 1);

// Security headers.
//
// Express never serves HTML — Nginx serves the built SPA from disk (see
// nginx.conf / nginx/6soft-security-headers.conf), so the CSP that actually
// protects the app document lives there, NOT here. This one applies to JSON
// responses and document downloads, where nothing legitimate is ever loaded,
// so it can be maximally strict.
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        // These three have no fallback to default-src, so they must be spelled out.
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // Belt and braces with frame-ancestors for browsers that still read it.
    frameguard: { action: 'deny' },
    // API responses never need to leak a referrer anywhere.
    referrerPolicy: { policy: 'no-referrer' },
    // helmet sends HSTS by default even over plain http. Browsers ignore it
    // there, but a local https experiment would pin every localhost port for
    // two years, so keep it to production only.
    strictTransportSecurity: isProduction
      ? { maxAge: 63072000, includeSubDomains: true }
      : false,
  }),
);

// Permissions-Policy is the one cheap header helmet has no built-in for.
// Nothing in this app uses any of these APIs; denying them limits what an
// injected script could reach for.
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'usb=()',
].join(', ');

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
});

// Brute-force protection on credential endpoints; a lenient global limit
// backstops everything else. Disabled under Jest so test suites don't trip the
// counters.
//
// authLimiter stays keyed by IP (trust proxy is on above): these endpoints are
// reached without a session, so there is no identity worth trusting, and
// per-account protection is loginThrottle's job. apiLimiter keys by verified
// user instead — see rateLimitKey.ts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => shouldRelaxRateLimits(),
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => shouldRelaxRateLimits(),
  // Wrapped, not passed by reference: express-rate-limit invokes the generator
  // as (req, res), and res would land in the second parameter.
  keyGenerator: (req) => apiRateLimitKey(req),
  message: { error: 'Too many requests. Slow down.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/platform/auth/login', authLimiter);
app.use('/api/public/demo-request', authLimiter);
// The per-user limit above fixes the office-behind-one-NAT problem, but it
// also means one address can legitimately carry 300/min per signed-in user.
// Nothing caps volume at the edge — nginx.conf has no limit_req — so a crude
// flood from a single host would otherwise be unbounded. This is deliberately
// far above real use; it is a backstop, not a policy.
const floodLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2000,
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => shouldRelaxRateLimits(),
  message: { error: 'Too many requests. Slow down.' },
});

app.use('/api', floodLimiter);
app.use('/api', apiLimiter);

// CORS configuration - allow your frontend domains
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'https://onsidehr.co.uk',
  'https://www.onsidehr.co.uk',
  'https://app.onsidehr.co.uk',
];

// If FRONTEND_URL is set in environment, use it
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

// Log CORS configuration on startup
console.log('🔒 CORS Configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('Allowed Origins:', allowedOrigins);

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (mobile apps, Postman, etc)
      if (!origin) return callback(null, true);

      // Allow onsidehr.co.uk and its subdomains (https only)
      const isAllowedDomain =
        origin === 'https://onsidehr.co.uk' ||
        (origin.startsWith('https://') && origin.endsWith('.onsidehr.co.uk'));

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        isAllowedDomain ||
        process.env.NODE_ENV === 'development'
      ) {
        callback(null, true);
      } else {
        // Reject with false instead of Error to avoid 500 errors
        console.log(
          `CORS: Blocked origin ${origin}. Allowed origins:`,
          allowedOrigins,
        );
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
// requireAuth must run first so the feature gate has tenant context;
// the router's own per-route requireAuth calls are then no-ops.
app.use(
  '/api/sponsorships',
  requireAuth,
  requireFeature('compliance'),
  sponsorshipRoutes,
);
app.use(
  '/api/absences',
  requireAuth,
  requireFeature('compliance'),
  absenceRoutes,
);
app.use('/api/pay', requireAuth, requireFeature('compliance'), payRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gdpr', gdprRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/document-templates', documentTemplateRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/public', publicRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Multer throws on a rejected upload — oversized, too many files, unexpected
// field. Without this the MulterError reaches Express's default handler and
// the client gets a 500 (with a stack outside production) instead of being
// told the file is too large. Must sit after the routes that mount multer.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!(err instanceof multer.MulterError)) return next(err);
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      error: tooBig
        ? 'That file is larger than the 5MB limit.'
        : `Upload rejected: ${err.code}`,
      code: err.code,
    });
  },
);

// JSON 404 for unknown /api/* routes (avoids leaking Express's HTML
// "Cannot GET /api/..." default and keeps API clients happy).
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

export default app;
