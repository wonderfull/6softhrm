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
2. `test` — 137 backend tests
3. `verify:tenancy` — 19 live isolation checks (deny-by-default, cross-tenant
   IDOR on reads/writes/files, legacy tokens, suspension of live sessions)
4. `verify:onboarding` — 14 checks: full customer onboarding end to end

Both gates are self-seeding and idempotent — safe to run repeatedly against a
non-production database. Frontend: `npm --prefix frontend run test`.

## Monitoring (do these on day one of production)
1. Uptime check on `https://app.onsidehr.co.uk/api/health` every minute
   (UptimeRobot/BetterStack free tiers are fine) → alert on 2 consecutive failures.
2. Backup freshness: a second HTTP check or a cron on the VPS:
   `find backend/backups -name '*.sql.gz' -mmin -1560 | grep -q . || <alert>`
3. Disk: alert at 80% (`df -h /`).
4. PM2: `pm2 install pm2-logrotate` so logs don't eat the disk.

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
DATABASE_URL, TEST_DATABASE_URL, JWT_SECRET, FRONTEND_URL, SMTP_*,
STORAGE_DRIVER (+ R2_* when r2), PLATFORM_ADMIN_EMAIL/PASSWORD (seed only),
BOOTSTRAP_* (seed only). Never commit .env files.
