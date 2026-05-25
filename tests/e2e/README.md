# 6soft HRM — End-to-end smoke tests

Playwright scenarios that cover the regressions surfaced by COS-3 and COS-7.

## Setup

```bash
cd tests/e2e
npm install
npx playwright install --with-deps chromium
```

## Run

```bash
# Against the production site:
BASE_URL=https://hrm.6soft.co.uk \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='...' \
npx playwright test

# Against a local dev server (started separately via npm run dev:all):
BASE_URL=http://localhost:5173 \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=password123 \
npx playwright test
```

## What it checks

| Test | COS-7 ref | Asserts |
|------|-----------|---------|
| `security-headers.spec.ts` | B2 | HSTS, X-Frame-Options DENY, X-Content-Type-Options, CSP, Referrer-Policy present |
| `share-link-removed.spec.ts` | B1 | `/api/documents/share/<anything>` returns 404 (feature removed) |
| `four-oh-four.spec.ts` | B9, B11 | Unknown SPA route renders "Page not found"; unknown `/api/*` returns JSON 404 |
| `legal-pages.spec.ts` | B4 | Privacy / Terms / GDPR routes render real content (not blank shell) |
| `settings-role-guard.spec.ts` | B4 | Employee session lands on /dashboard when probing /settings |
| `robots-and-sitemap.spec.ts` | B10 | `/robots.txt` + `/sitemap.xml` served with the right Content-Type |

## What it deliberately does NOT do

- Mutate data (no Add Person, no Delete, no Backup, no destructive flows).
- Send email (no `/notifications/test-email`).
- Run as a CI-blocking gate yet — first iteration is local-run only. Wire
  into `.github/workflows/` once the suite is stable.
