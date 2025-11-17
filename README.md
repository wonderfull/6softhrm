# Lightweight UK HRM Starter

This workspace contains a lightweight, extendable HRM starter focused on UK compliance and sponsorship management.

Components
- `backend/` — Node + TypeScript + Express API, Prisma + SQLite, JWT auth, sponsorship and core HRM models.
- `frontend/` — React + Vite + TypeScript, Tailwind CSS, bright default theme + dark mode toggle, basic pages.

Quick start (macOS / zsh)

1. Install dependencies

```bash
# from repo root
cd backend && npm install
cd ../frontend && npm install
```

2. Initialize database & seed

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

3. Run dev servers (in two terminals)

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

Notes
- Auth: JWT-based auth is implemented in the backend (email/password). Replace the example secrets in `.env`.
- Calendar: planned integration hooks exist; calendar syncing will be implemented as an integration (Google/Outlook) later.
- Google Drive: optional integration is available. To enable, set `GOOGLE_DRIVE_ENABLED=true` and add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_REDIRECT_URI` in the backend `.env` (see `backend/.env.example`). An ADMIN user can then connect Drive from Settings and uploaded documents will be stored in Drive instead of locally.
- Payroll/HMRC: intentionally excluded for now.

UK compliance notes
- Data residency: the starter uses SQLite for local development. For production, host data in an EU/UK region and choose a managed database with encryption at rest.
- GDPR: collect only necessary personal data, keep a data retention policy, and implement subject access request mechanisms before production use.
- Sponsorship: the sponsorship model contains fields such as sponsor license number and CAS where needed. This scaffold doesn't implement automatic reporting to UKVI — keep manual compliance checks and logs.
- Payroll/HMRC: payroll/HMRC integration is out of scope for this starter. Payroll requires secure handling and is usually implemented with a dedicated payroll provider.

Next steps
- Implement frontend pages for time/leave/docs and calendar sync UI.
- Add tests, CI, and deploy scripts.
