# OnsideHR — Ops Runbook (P7)

## Processes (PM2)
`pm2 start ecosystem.config.js` starts:
- **onsidehr-api** — production API on :4000 (single instance; cron jobs assume one runner)
- **onsidehr-backup** — nightly dump at 02:30 (one-shot, `cron_restart`)
- **onsidehr-api-staging** — staging on :4001 with `backend/.env.staging` (own DB!)

## Backups
- `npm --prefix backend run backup` — mysqldump (`--single-transaction`, GTID-off) → gzip →
  `backend/backups/` and, when R2 env vars are set, `r2://<bucket>/backups/`.
- Retention: 30 days, pruned locally and on R2 on every run.
- **Alert if the newest file in backups/ is older than 26 hours** (see monitoring).

## Restore
```bash
# 1. Pick a dump
ls backend/backups/
# 2. Restore into a scratch DB (NEVER production unless you mean it)
backend/scripts/restore-db.sh backend/backups/<dump>.sql.gz "mysql://user:pass@localhost:3306/onsidehr_restore_test"
# 3. Point a shell at it and boot-check
DATABASE_URL="mysql://.../onsidehr_restore_test" npm --prefix backend run start   # then GET /api/health
```
**Rehearsed 26 Aug 2026: dump 106ms, restore 1s, app booted with tenants/users/employees intact.**
Re-rehearse after every schema migration and at least quarterly.

## Verification
`npm --prefix backend run verify:all` runs the whole chain and is the pre-deploy gate:
1. `check:tenancy` — static guard: no tenant-unsafe Prisma ops in route code
2. `test` — 275 backend tests
3. `verify:tenancy` — 19 live isolation checks (deny-by-default, cross-tenant
   IDOR on reads/writes/files, legacy tokens, suspension of live sessions)
4. `verify:onboarding` — 14 checks: full customer onboarding end to end
5. `verify:compliance` — 22 checks: the sponsor duties end to end (10-day
   unauthorised absence, per-period salary reconciliation, Appendix D pack,
   audit-readiness score)

All three gates are self-seeding and idempotent — safe to run repeatedly against a
non-production database. Frontend: `npm --prefix frontend run test`.

## Monitoring (do these on day one of production)
1. Uptime check on `https://app.onsidehr.co.uk/api/health` every minute
   (UptimeRobot/BetterStack free tiers are fine) → alert on 2 consecutive failures.
2. Backup freshness: a second HTTP check or a cron on the VPS:
   `find backend/backups -name '*.sql.gz' -mmin -1560 | grep -q . || <alert>`
3. Disk: alert at 80% (`df -h /`).
4. PM2: `pm2 install pm2-logrotate` so logs don't eat the disk.

## Security headers and CSP

### Which layer serves what
Nginx serves the built SPA from disk; Express serves no HTML at all. **The CSP
that protects the app document therefore comes from Nginx**, and Express's own
CSP only ever lands on JSON responses and file downloads.

| Layer | File | Policy |
|---|---|---|
| Nginx (serves `index.html`) | `nginx.conf`, `nginx/6soft-security-headers.conf` | the app CSP below |
| Express (`/api/*` only) | `backend/src/app.ts` | `default-src 'none'` + `frame-ancestors`/`base-uri`/`form-action` `'none'` |

The shipped app CSP:

```
default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self';
script-src-attr 'none'; style-src 'self' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:;
connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none';
form-action 'self'; upgrade-insecure-requests
```

Why each non-obvious directive is what it is:
- **`script-src 'self'`, no `'unsafe-inline'`, no `'unsafe-eval'`** — Vite emits
  one external module script and zero inline scripts, and the bundle contains
  no `eval`, no `new Function` and no WebAssembly. This is the directive doing
  the actual work; everything else is supporting.
- **`style-src` without `'unsafe-inline'`** — Tailwind compiles to a static
  stylesheet, and React writes `style` props through CSSOM, which CSP does not
  police. Verified in a browser, not assumed.
- **`frame-src 'self' blob:`** — `Documents.tsx` previews PDFs in an `<iframe>`
  pointed at a `blob:` URL. The previous policy omitted `frame-src`, so it fell
  back to `default-src 'self'` and **silently broke document preview**.
- **`img-src … https:`** — tenants set an arbitrary `logoUrl` that `NavBar`
  renders. The previous policy blocked it. `data:` covers the 2FA QR code and
  `blob:` the image preview.
- **`connect-src 'self'`** — the API is same-origin behind `/api/`. If you ever
  point `VITE_API_URL` at a different host, that origin must be added here or
  every request fails.

### Nginx gotcha that bit us
`add_header` does **not** inherit into a `location` that declares an
`add_header` of its own — it replaces the whole inherited set. Both
`location /` (which serves `index.html`) and the static-asset regex block set
their own `Cache-Control`, so they must repeat the full header set or the app
document ships with no CSP at all. `nginx.conf` now does this; a backend test
(`securityHeaders.test.ts`) fails if a future edit drops it.

**Known gap:** the older bootstrap script `deploy.sh` writes its own inline
Nginx config that sets only `X-Frame-Options` and `X-Content-Type-Options`.
Sites stood up with `deploy.sh` rather than `scripts/deploy-vps.sh` get no CSP.
Prefer `scripts/deploy-vps.sh`, or paste the snippet in by hand.

### Residual risk — read this before claiming the token is safe

**The JWT is still in `localStorage`, and any script running on the origin can
read it.** CSP is mitigation, not elimination. What actually changed is that it
is now much harder to *get* a script running: an injected `<script>`, an
attacker-hosted script tag, `eval` and `new Function` are all blocked
(verified). What has *not* changed:

- **Exfiltration is still possible once script execution happens.** `fetch` and
  `sendBeacon` to a foreign origin are blocked by `connect-src 'self'`, but
  `img-src … https:` (needed for tenant logos) leaves a one-line image-beacon
  channel, and no CSP can stop a top-level navigation to an attacker URL —
  `navigate-to` was never shipped in any browser. Treat exfiltration as
  unpreventable and the script-execution block as the real control.
- **`script-src 'self'` trusts everything on our own origin.** It would not
  save us from a malicious or compromised npm dependency inside the bundle,
  because that code is served from `'self'`.
- **A same-origin HTML/SVG upload would inherit the app's privileges.** Today
  the upload allowlist is PDF/PNG/JPEG/DOC/DOCX only and uploads are streamed
  through `/api`, never served as documents — keep it that way.
- Anything that reads the token also survives logout, since there is still no
  token revocation (see the `tokenVersion` item in the plan's §10).

### If you later want the httpOnly-cookie migration
It was deliberately *not* done here — it is a broad, cross-cutting change, not
a header tweak. It would involve:
1. `auth.ts` setting the JWT as `httpOnly; Secure; SameSite=Lax` on login and
   clearing it on logout, instead of returning it in the body.
2. A CSRF defence, because cookies are sent automatically — double-submit token
   or an `Origin`/`Sec-Fetch-Site` check on every state-changing route.
3. The frontend API layers (`lib/api.ts`, `lib/platformApi.ts`) dropping the
   `Authorization` header and sending `credentials: 'include'`, plus the six
   files that build the header themselves — `Documents.tsx`, `Settings.tsx`,
   `Employees.tsx`, `DataExport.tsx`, `Consent.tsx`, `ImportEmployeesModal.tsx`
   (`grep -rl Authorization frontend/src`).
4. `NavBar.tsx` losing its ability to decode the token client-side for the
   current user — it would need a `/api/auth/me` call instead.
5. CORS: `credentials: true` already set, but a split-origin deployment
   (`VITE_API_URL`) would need `SameSite=None` and an exact origin allowlist.
6. Every backend test that signs a token and sets an `Authorization` header,
   and the Playwright e2e specs.

Budget it as its own piece of work with its own verification gate, not as a
follow-on to this one.

## Production deploy checklist
1. `git pull && npm --prefix backend ci && npm --prefix frontend ci`
2. `npm --prefix backend run build && npm --prefix frontend run build`
3. `npx prisma migrate deploy` (from backend/)
4. `pm2 reload onsidehr-api`
5. Smoke: `/api/health`, login, employee list.

### First multi-tenant deploy — start from an empty database
The `20260825085921_multi_tenant_foundation` migration assumes an **empty**
database. It adds `tenantId INTEGER NOT NULL` with no default and no backfill,
and creates no default tenant, so against a database that still holds the old
single-tenant tables it fails on the `User` and `Employee` foreign keys
(`ER_NO_REFERENCED_ROW_2`). MySQL auto-commits DDL, so there is no rollback —
you are left half-migrated with rows stranded at `tenantId = 0`.

If the target server still has a pre-multi-tenant database, **drop and recreate
it** rather than migrating:

```sql
DROP DATABASE onsidehr; CREATE DATABASE onsidehr;
```

then run step 3 and seed the first tenant from the platform console. Take a dump
first (`npm --prefix backend run backup`) if there is any chance the contents
matter. Once a tenant exists with real data this no longer applies — later
migrations are written against the multi-tenant schema.

## Environment inventory (backend/.env)
DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET, FIELD_ENCRYPTION_KEY, FRONTEND_URL,
SMTP_*, STORAGE_DRIVER (+ R2_* when r2), PLATFORM_ADMIN_EMAIL/PASSWORD (seed
only), BOOTSTRAP_* (seed only). See `backend/.env.example`. Never commit .env files.

## Column encryption (FIELD_ENCRYPTION_KEY)
`Employee.niNumber`, `passportNumber`, `accountNumber` and `sortCode` are
encrypted at rest with AES-256-GCM by the Prisma client extension in
`backend/src/prismaClient.ts`. Routes, exports and the CSV importer are
unchanged — encryption and decryption are transparent.

- **Generate a key:** `openssl rand -hex 32` → `FIELD_ENCRYPTION_KEY=<64 hex chars>`.
  One key per environment; never reuse dev's in production.
- **The API refuses to boot without it** (`src/index.ts`), deliberately: booting
  without a key would write passport/NI/bank details to disk in plaintext.
- **Backfill existing rows** after the first deploy that carries the key:
  ```bash
  npm --prefix backend run encrypt:fields -- --dry-run   # counts only, no writes
  npm --prefix backend run encrypt:fields
  ```
  It is idempotent — already-encrypted values are skipped, so it is safe to
  re-run after a partial run, a restore, or an import.
- **Losing the key loses the data.** It is not in the database dump, so a
  restore needs both the dump and the key. Back it up separately (password
  manager), and keep the old key if you ever rotate: rotation means decrypting
  with the old key and re-encrypting with the new one, which is not automated.
- These four columns can no longer be filtered or searched by SQL — every row
  has its own IV. A `where` clause naming one is rejected at runtime with
  `ENCRYPTED_FIELD_NOT_FILTERABLE` rather than silently matching nothing.
