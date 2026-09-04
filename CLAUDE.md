# 6softHRM — UK HR Management System

## Tech Stack
- **Backend:** Express + TypeScript + Prisma ORM + MySQL
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Auth:** JWT (bcryptjs + jsonwebtoken)
- **Email:** Nodemailer (SMTP)
- **Testing:** Jest (backend), Vitest (frontend)
- **Process Manager:** PM2 | **Web Server:** Nginx

## Key Commands
```bash
npm run dev:all                          # start backend + frontend concurrently
npm run dev:backend                      # backend only (port 4000)
npm run dev:frontend                     # frontend only (port 5173)
npm --prefix backend run test            # backend tests (Jest)
npm --prefix frontend run test           # frontend tests (Vitest)
npm --prefix backend run build           # compile TypeScript
npm --prefix frontend run build          # Vite production build
npm --prefix backend run prisma:migrate  # run DB migrations
npm --prefix backend run prisma:generate # regenerate Prisma client
npm --prefix backend run studio          # Prisma Studio GUI
npm --prefix backend run seed            # seed database
```

## Database
The database schema is defined in @backend/prisma/schema.prisma. Reference it whenever working with data models or writing queries.

Multi-tenant: every tenant-owned model carries `tenantId` and must be listed in
`TENANT_MODELS` (`backend/src/prismaClient.ts`) or it queries unscoped. Scoped
`prisma` forbids `findUnique/update/delete/upsert` — use `findFirst`,
`updateMany`, `create`; for a one-row-per-tenant model use
`platformPrisma.<model>.upsert({ where: { tenantId } })`. `npm run check:tenancy`
enforces this.

Key models: `Tenant`, `TenantSettings`, `User`, `Employee`, `Sponsorship`,
`RightToWorkCheck`, `SponsorLicence`, `Timesheet`, `LeaveRequest`, `Document`,
`Project`, `AuditLog`, `DataConsent`, `Notification`, `PerformanceReview`,
`ChecklistItem`, `DocumentTemplate`, `DocumentAcknowledgement`, `ExpenseClaim`,
`TrainingRecord`, `CaseRecord`

## Project Structure
```
backend/src/
  routes/      # API handlers, mounted in app.ts at /api/*:
               #   auth, employees (+ /:id/rtw, /:id/photo), sponsorships,
               #   absences, pay, leave, timesheets, projects, documents,
               #   calendar, admin, gdpr, notifications, tenant, platform,
               #   reports, reviews, checklists, expenses, training, cases,
               #   document-templates
  middleware/  # auth.ts (JWT verify + tenant context), roles.ts, audit.ts
  lib/         # tenantContext, tenantSettings, tenantPolicy (feature gate),
               #   roles, fieldEncryption, storage, emailService, notify,
               #   cronJobs, workingDays, leave, reportingLine, retention,
               #   appendixD, auditReadiness, expirySweep, checklists
  __tests__/   # Jest tests (serial, real test DB via TEST_DATABASE_URL)
backend/prisma/ # schema, migrations, seed

frontend/src/
  pages/       # React pages: Dashboard, Employees, Leave, Timesheets, etc.
  components/  # NavBar, Sidebar, ProtectedRoute, Card, Footer
  lib/         # utilities
  __tests__/   # Vitest tests
```

## Coding Conventions
- TypeScript strict mode throughout
- Prettier: `semi: true`, `singleQuote: true`, `trailingComma: "all"`
- ESLint: `@typescript-eslint/recommended` + `react/recommended`
- Use comments sparingly — only for complex or non-obvious logic
- API routes follow RESTful patterns
- All DB access through Prisma client (never raw SQL)
- Role-based access: `ADMIN`, `DIRECTOR`, `OFFICE_ASSISTANT`, `EMPLOYEE`
  (legacy `MANAGER`/`USER` are normalised by `lib/roles.ts`). A line manager
  (`Employee.managerId`) approves their own reports' leave and expenses
  without an elevated role — see `lib/reportingLine.ts`.
- All sensitive operations logged to `AuditLog` (GDPR requirement)

## Environment
- Backend: port 4000
- Frontend dev: port 5173 (proxies `/api` to backend via Vite config)
- Never read, log, or commit `.env` files
- Production: Hostinger VPS, Nginx reverse proxy, PM2 process manager

## Important Patterns
- Auth middleware extracts user from JWT → `req.user`
- Role middleware: `requireRole('ADMIN')` or `requireRole('ADMIN', 'MANAGER')`
- File uploads via multer (max 5MB, PDF/PNG/JPG/DOC/DOCX only)
- Cron jobs in `backend/src/lib/cronJobs.ts`: retention sweep 02:00, expiry
  alerts 09:00, absence detection 09:30, salary check 10:00
- CORS whitelist: localhost dev ports + 6soft.co.uk + hrm.6soft.co.uk
