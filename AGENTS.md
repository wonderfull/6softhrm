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

Key models: `User`, `Employee`, `Sponsorship`, `Timesheet`, `LeaveRequest`, `Document`, `Project`, `AuditLog`, `DataConsent`

## Project Structure
```
backend/src/
  routes/      # API handlers: auth, employees, sponsorships, leave, timesheets,
               #               projects, documents, calendar, admin, gdpr, notifications
  middleware/  # auth.ts (JWT verify), roles.ts (role check), audit.ts (GDPR log)
  lib/         # emailService.ts, cronJobs.ts
  __tests__/   # Jest tests
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
- Role-based access: `ADMIN`, `MANAGER`, `USER`
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
- Cron jobs in `backend/src/lib/cronJobs.ts` (sponsorship expiry alerts)
- CORS whitelist: localhost dev ports + 6soft.co.uk + hrm.6soft.co.uk
