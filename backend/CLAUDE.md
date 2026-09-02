# Backend — Express + TypeScript + Prisma

## Commands
```bash
npm run dev              # ts-node-dev with hot reload
npm run build            # compile to dist/
npm run start            # run compiled dist/index.js
npm run test             # Jest tests (runs serially)
npm run test:coverage    # Jest with coverage report
npm run prisma:migrate   # create + apply migration
npm run prisma:generate  # regenerate client after schema change
npm run db:push          # push schema changes without migration
npm run studio           # Prisma Studio GUI
npm run seed             # seed database
```

## Architecture
```
src/index.ts   → entry point, starts Express server on PORT (default 4000)
src/app.ts     → Express setup: CORS, JSON body parser, route mounting
src/routes/    → route files mounted at /api/*
src/middleware/
  auth.ts      → requireAuth: extracts JWT, sets req.user, enters tenant context
  roles.ts     → requireRole(...roles): checks req.user.role
  audit.ts     → auditLog(req, action, entity, entityId?, details?) / createAuditLog: write to AuditLog (GDPR)
src/lib/
  emailService.ts  → sendEmail(), sendLeaveNotification(), etc.
  cronJobs.ts      → scheduled jobs (sponsorship expiry alerts)
```

## Route Patterns
```typescript
// Standard authenticated route
router.get('/', requireAuth, async (req, res) => { ... });
// Admin-only route
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => { ... });
// With audit logging
await auditLog(req, 'CREATE', 'Employee', employee.id, { firstName, lastName });
```

## Testing
- Jest with ts-jest preset
- Test files: `src/__tests__/*.test.ts`
- Runs serially (`--runInBand`) to avoid DB conflicts
- Uses `TEST_DATABASE_URL` env for isolated test DB
