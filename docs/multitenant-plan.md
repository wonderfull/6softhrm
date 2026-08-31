# OnsideHR — Multi-Tenant SaaS Conversion Plan

**Planned:** 2026-08-20 · **Built:** 2026-08-25/26
**Repo:** `6softHRM` → rebranded **OnsideHR** (`onsidehr.co.uk`)
**Branch:** `feat/multi-tenant`

---

## 0. Delivery status — phases 1–7 complete

| Phase | Status | Commit |
|---|---|---|
| P0 Baseline repair | ✅ | `8741e67` |
| P1+P2 Tenant foundation + 147-call-site sweep | ✅ | `b2a750d` |
| P3 Platform console + live session enforcement | ✅ | `46ddbd2` |
| P4 Storage abstraction (local + R2) | ✅ | `6948580` |
| P5 Rebrand + B2B legal pack | ✅ | `b3be20a` |
| P6 Sellability (CSV import, 2FA, gating, seats, hardening) | ✅ | `f4c4584` |
| P7 Ops (backups, restore, PM2, runbook) | ✅ | `dd52818` |
| Gate hardening (idempotent re-runs) | ✅ | `9765caa` |

**Verification — `npm --prefix backend run verify:all`:**
- Static tenancy guard: no tenant-unsafe Prisma ops in routes
- Backend tests: **137/137** · Frontend tests: **71/71**
- Tenancy gate: **19/19** (deny-by-default, cross-tenant IDOR on reads /
  writes / files, legacy tokens, live-session suspension)
- Onboarding gate: **14/14** (create tenant → setup link → branded login →
  import 50 employees → seat cap → leave approval → upload → feature gate)
- Restore rehearsal: dump 106ms, restore 1s, app boots on restored DB

**Deferred by decision:** final pricing (§13 is the researched recommendation,
not a committed price list). **Still to do before selling:** point R2 env vars
at a real bucket, DNS + SPF/DKIM/DMARC on onsidehr.co.uk
(`docs/deploy-dns-email.md`), solicitor review of Terms + DPA, ICO
registration as a processor.

Sections 1–15 below are the original plan, kept as the design record.

---

## 1. Verdict: convert, do not rebuild

**Convert the existing codebase.** A rebuild is the wrong call here, and the reasoning isn't sentimental about sunk cost:

| | Convert | Rebuild |
|---|---|---|
| Time to sellable v1 | **~6–8 focused days** | 4–6 weeks minimum |
| UK sponsor-compliance module | Already built + tested | Re-derive from scratch |
| GDPR/consent/audit plumbing | Already built | Re-derive from scratch |
| Role matrix (4 roles, ~20 predicates) | Already built + tested | Re-derive from scratch |
| Test suite (17 files) | Reusable with a tenant seed | Gone |
| Schema migration pain | **Zero — no live data** | N/A |
| Risk | 147 unscoped queries to fix | Unknown unknowns, new bugs |

Three facts make conversion unusually cheap in this specific case:

1. **There is no production data.** The single most expensive part of a normal multi-tenant conversion — migrating live customer rows into a tenanted schema without downtime or loss — costs nothing here. You can drop and reshape the database freely.
2. **Multi-tenancy is a cross-cutting concern, not an architectural one.** The domain model (Employee, Sponsorship, Leave, Timesheet, Document) is unchanged by tenancy. What changes is *scoping*, which can be enforced centrally rather than at 147 call sites.
3. **The codebase is small.** 7,680 LOC backend / 11,607 LOC frontend, 12 models, 12 route files. This is a weekend-scale surface, not a rewrite-scale one.

A rebuild would re-derive the same 12 models and the same permission matrix and land in the same place, minus the tests, minus the compliance logic, plus a month.

**The one honest risk of converting:** the existing code has 147 Prisma call sites with no tenant scoping, and a single missed one leaks passport numbers, NI numbers and bank details across customers. That is a GDPR-reportable breach and a business-ending event. Section 4 is the mitigation, and it is the most important section in this document.

---

## 2. Decisions taken

| Decision | Choice | Rationale |
|---|---|---|
| Isolation model | **Pooled** — shared DB, shared schema, `tenantId` column | 10–50 UK SMEs. Cheapest to run and operate. Per-tenant DBs only if a large client's security team demands it. |
| Tenant addressing | **Single domain**, tenant resolved from login | `onsidehr.co.uk`. Zero DNS/TLS/CORS work. |
| Provisioning | **Manual**, via platform-admin console | Invoice billing. Stripe deferred until a customer is actually paying. |
| File storage | **Cloudflare R2**, tenant-prefixed keys | Zero egress, ~£0.01/GB/mo, survives VPS rebuild. |
| Hosting | **Hostinger VPS**, plus backups/staging/restore drill | Move to managed MySQL when customer #1 signs, not before. |
| Branding | **Full rebrand to OnsideHR** | Renaming after customers onboard is far more painful. |
| Product | Core HR + **compliance as paid add-on tier** | Feature-flagged per tenant. |

---

## 3. What exists today, and what breaks

### Current state (verified by reading the code)

- **Auth:** JWT, 8h expiry, payload `{ id, email, role, employeeId }`. Stored in `localStorage`.
- **Roles:** `ADMIN`, `DIRECTOR`, `OFFICE_ASSISTANT`, `EMPLOYEE` (legacy `MANAGER`/`USER` normalised in `backend/src/lib/roles.ts`). ~20 permission predicates.
- **Data access:** 147 Prisma call sites, none tenant-scoped.
- **Uploads:** multer `diskStorage` → flat `/uploads` directory on the VPS.
- **Frontend:** single `api()` helper in `frontend/src/lib/api.ts` — every request funnels through it.
- **Security middleware:** none. No `helmet`, no rate limiting, no login throttle.

### What breaks the moment two companies share the database

1. **Global unique constraints collide.** `User.email @unique`, `Employee.email @unique`, `Project.code @unique`. Two clients cannot both have `admin@company.co.uk`, and cannot both have a project coded `ADMIN`.

2. **Every `where: { id }` is a cross-tenant IDOR.** Example from `backend/src/routes/leave.ts:110`:
   ```ts
   const lr = await prisma.leaveRequest.update({
     where: { id },                    // ← nothing stops tenant A approving tenant B's leave
     data: { status: 'APPROVED' },
   })
   ```
   The route is role-guarded (`requireRole('ADMIN', ...)`) but *not* tenant-guarded. Any tenant admin can enumerate integer IDs and mutate every other tenant's records.

3. **Broadcast queries email the entire platform.** `backend/src/routes/leave.ts:71`:
   ```ts
   const admins = await prisma.user.findMany({
     where: { role: { in: ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'] } },
   })
   for (const admin of admins) { await sendEmail({ to: admin.email, ... }) }
   ```
   One employee books a day off and **every admin at every customer company** is emailed their name, leave type and dates. This is a data breach on day one of tenant #2.

4. **Cron jobs run globally.** `initializeCronJobs()` is called at module scope in `app.ts` and `checkExpiringRecords()` sweeps all records with no tenant boundary — every tenant's visa-expiry alerts go to every tenant's admins.

5. **Audit log has no tenant column.** A tenant admin viewing audit logs would see the whole platform's activity. This is the most sensitive table in the system.

6. **Uploads share a flat namespace.** `/uploads/<filename>` — filenames are multer-generated so collisions are unlikely, but there is no isolation boundary and nothing prevents guessing another tenant's document path.

7. **GDPR export dumps everything.** `routes/gdpr.ts` (24 Prisma calls) builds subject-access and data-export payloads with no tenant filter.

---

## 4. The isolation strategy (most important section)

MySQL has no row-level security, so tenant enforcement must live in the application. Relying on developers to remember `tenantId` at 147 call sites is how breaches happen. Three layers, in order of importance:

### Layer 1 — Request-scoped tenant context (AsyncLocalStorage)

`backend/src/lib/tenantContext.ts`:

```ts
import { AsyncLocalStorage } from 'node:async_hooks'

type TenantContext = { tenantId: number; userId: number; role: string }
export const tenantStore = new AsyncLocalStorage<TenantContext>()

export function currentTenantId(): number {
  const ctx = tenantStore.getStore()
  if (!ctx) throw new Error('TENANT_CONTEXT_MISSING')
  return ctx.tenantId
}
```

Middleware after `requireAuth` enters the store with `req.user.tenantId`. Everything downstream in that request — routes, services, email helpers — inherits it without threading a parameter through every function signature.

### Layer 2 — Prisma client extension that auto-scopes every query

`backend/src/lib/prismaTenant.ts` wraps the client so tenancy is applied *by default* rather than *by discipline*:

```ts
const TENANT_MODELS = new Set([
  'Employee', 'Sponsorship', 'SponsorshipComplianceEvidence',
  'SponsorshipReportableEvent', 'Project', 'Timesheet',
  'LeaveRequest', 'Document', 'AuditLog', 'DataConsent', 'User',
])

prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args)
        const tenantId = currentTenantId()   // throws if unset — deny by default

        if (READ_OPS.has(operation) || WRITE_MANY_OPS.has(operation)) {
          args.where = { ...args.where, tenantId }
        }
        if (CREATE_OPS.has(operation)) {
          args.data = Array.isArray(args.data)
            ? args.data.map((d) => ({ ...d, tenantId }))
            : { ...args.data, tenantId }
        }
        return query(args)
      },
    },
  },
})
```

**Deny by default is the critical property.** If a query runs on a tenant-scoped model with no tenant context, it throws rather than silently returning every tenant's rows. Platform-level operations (the admin console, cron sweeps, migrations) opt out explicitly via a separate `platformPrisma` client, so the escape hatch is greppable in code review.

### Layer 3 — Codemod for the operations Prisma won't let you scope

Prisma's `findUnique`, `update` and `delete` require a *unique* `where`, so `tenantId` cannot simply be added. Mechanical rewrite, ~40 sites:

| Before | After |
|---|---|
| `findUnique({ where: { id } })` | `findFirst({ where: { id } })` |
| `update({ where: { id }, data })` | `updateMany({ where: { id }, data })` + assert `count === 1` |
| `delete({ where: { id } })` | `deleteMany({ where: { id } })` + assert `count === 1` |
| `upsert({ where: { id } })` | explicit `findFirst` → `create`/`updateMany` |

Each is a one-line change, and `grep -rn "findUnique\|\.update(\|\.delete(" backend/src/routes` gives the exact worklist. Add a lint rule or a CI grep that fails the build if `findUnique(` reappears in `routes/`.

### Layer 4 — Generic cross-tenant leak test (the safety net)

`backend/src/__tests__/crossTenant.security.test.ts`. Seed two tenants with structurally identical data, then for **every route**, authenticate as tenant A's ADMIN and attempt to read and mutate tenant B's record IDs. Assert 403/404 — never 200.

```ts
const cases = [
  { method: 'get',  path: (id) => `/api/employees/${id}`,      seed: 'employeeB' },
  { method: 'put',  path: (id) => `/api/leave/${id}/approve`,  seed: 'leaveB' },
  { method: 'get',  path: (id) => `/api/documents/${id}`,      seed: 'documentB' },
  // ...one row per route
]
it.each(cases)('tenant A cannot touch tenant B: $method $path', async ({...}) => {
  const res = await request(app)[method](path(seedIds[seed])).set('Authorization', tokenA)
  expect([403, 404]).toContain(res.status)
})
```

This table is the definition of done for Phase 2. It is also the artefact you show a prospect's IT person when they ask how isolation is enforced.

---

## 5. Schema changes

### New models

```prisma
model Tenant {
  id            Int       @id @default(autoincrement())
  slug          String    @unique          // "acme-ltd" — used in URLs, exports, R2 keys
  name          String                     // "Acme Ltd" — display name
  status        String    @default("TRIAL") // TRIAL | ACTIVE | SUSPENDED | CANCELLED
  plan          String    @default("CORE")  // CORE | CORE_PLUS_COMPLIANCE
  seatLimit     Int?                        // null = unlimited
  features      Json?                       // { "compliance": true, "timesheets": true }
  logoUrl       String?
  primaryColor  String?   @default("#1e40af")
  trialEndsAt   DateTime?
  deletedAt     DateTime?                   // soft delete → 30-day retention window
  createdAt     DateTime  @default(now())

  settings      TenantSettings?
  users         User[]
  employees     Employee[]
  // ...one relation per tenant-scoped model
}

model TenantSettings {
  id                Int      @id @default(autoincrement())
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId          Int      @unique
  leaveYearStart    String   @default("01-01")   // MM-DD
  defaultLeaveDays  Float    @default(28)        // UK statutory minimum incl. bank holidays
  bankHolidayRegion String   @default("england-and-wales") // | scotland | northern-ireland
  workingDays       String   @default("1,2,3,4,5")
  sponsorLicenceNo  String?
  companyAddress    String?
}

model PlatformAdmin {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  name      String?
  totpSecret String?
  createdAt DateTime @default(now())
}
```

**`PlatformAdmin` is deliberately a separate table, not a role.** A platform-level value inside the tenant role enum is one bug away from a tenant admin escalating to see every customer. Separate table, separate login route (`/api/platform/auth/login`), separate JWT audience claim, separate frontend route tree. The existing 20 permission predicates in `lib/roles.ts` stay untouched.

### Changes to every existing model

Add to `Employee`, `Sponsorship`, `SponsorshipComplianceEvidence`, `SponsorshipReportableEvent`, `Project`, `Timesheet`, `LeaveRequest`, `Document`, `AuditLog`, `DataConsent`, `User`:

```prisma
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantId  Int
  @@index([tenantId])
```

**Denormalise `tenantId` onto children too.** `Timesheet.tenantId` is derivable via `employee.tenantId`, but storing it directly means (a) the extension can scope it without a join, and (b) a leaked `where: { id }` still cannot cross tenants. The cost is one integer column and a consistency invariant.

### Unique constraint changes

| Model | Before | After | Note |
|---|---|---|---|
| `User.email` | `@unique` | **stays `@unique`** | Platform-wide identity — see below |
| `Employee.email` | `@unique` | `@@unique([tenantId, email])` | Two tenants may employ the same person |
| `Project.code` | `@unique` | `@@unique([tenantId, code])` | |
| `User.employeeId` | `@unique` | stays `@unique` | FK, already tenant-consistent |

**Why `User.email` stays globally unique:** with single-domain login, the email *is* the tenant resolver — email → user row → `tenantId` → JWT. Keeping it globally unique makes login trivially simple with no company-code field and no tenant picker.

**The tradeoff, stated explicitly:** one email address can belong to exactly one tenant. This is correct for employees, but blocks the case of an HR consultant or accountant who administers several client companies. If a real customer needs it, the fix is `@@unique([tenantId, email])` plus a tenant-picker step at login. Do not build it speculatively.

---

## 6. Storage: local disk → Cloudflare R2

Introduce `backend/src/lib/storage.ts` with a three-method interface (`put`, `getSignedUrl`, `delete`) so route code never touches an SDK directly.

- **Key layout:** `tenants/<tenantId>/documents/<uuid>-<sanitised-filename>`
- **multer:** `diskStorage` → `memoryStorage`, then `storage.put()`. Keep the existing 5MB limit and PDF/PNG/JPG/DOC/DOCX filter.
- **Downloads:** short-lived (5 min) presigned URLs. Never make the bucket public, and never proxy file bytes through Express.
- **DB field:** `Document.path` now stores the R2 key rather than `/uploads/<file>`.
- **Bucket config:** private, EU jurisdiction restriction enabled (data residency), versioning on, lifecycle rule to purge soft-deleted tenants after the retention window.
- **Validate the key prefix on read** — belt and braces alongside the DB scope.

Cost sanity check: 50 tenants × 200 employees × 5 documents × 500KB ≈ 25GB ≈ **£0.30/month**, zero egress.

---

## 7. Rebrand to OnsideHR

21 files contain `6soft` (45 occurrences in `.tsx` alone). Scope:

- **Strings/UI:** app name, page titles, `NavBar`, `Footer`, `usePageTitle`, favicon, logo.
- **Email templates:** all of `lib/emailService.ts` — sender `noreply@onsidehr.co.uk`, display name `"<Tenant Name> via OnsideHR"`.
- **Legal pages:** `Terms.tsx`, `Privacy.tsx` rewritten for a B2B SaaS processor relationship (see §9), plus a new DPA page and sub-processor list.
- **CORS:** replace the `6soft.co.uk` allowlist in `app.ts` with `onsidehr.co.uk`.
- **DNS/email auth:** SPF, DKIM and DMARC records on `onsidehr.co.uk` before sending a single transactional email. Without these, every leave-approval email lands in spam and the product looks broken.
- **Vendor entity:** 6soft Ltd remains the contracting entity behind the OnsideHR product — keep the company name on invoices, contracts and the DPA.

---

## 8. Multi-tenant product features to build

### Platform admin console (`/platform`) — build first, day one

You cannot operate a SaaS without it. Minimum viable: list tenants with headcount and status; create tenant (name, slug, plan, seat limit) + seed the first ADMIN user and send them an invite; suspend/reactivate; view usage; **impersonate** for support.

Impersonation must mint a short-lived (15 min) token carrying `impersonatedBy: <platformAdminId>`, and every action taken under it must write to *that tenant's* `AuditLog` flagged as impersonated. That is a GDPR transparency requirement, not a nicety — the customer is entitled to know when the processor accessed their data.

### Tenant lifecycle middleware

```ts
// after requireAuth, before routes
if (tenant.status === 'SUSPENDED') return res.status(402).json({ error: 'ACCOUNT_SUSPENDED' })
if (tenant.status === 'CANCELLED') return res.status(403).json({ error: 'ACCOUNT_CLOSED' })
if (tenant.trialEndsAt && tenant.trialEndsAt < new Date()) → read-only mode
```

Suspension preserves data and blocks writes. Never delete on non-payment — 30-day grace, then soft delete, then hard delete with a warning email at each step.

### Feature gating

`requireFeature('compliance')` middleware on `/api/sponsorships/*`, plus the frontend hiding the nav item when `features.compliance` is false. Ten lines, and it's what makes the add-on tier real.

### Seat enforcement

Check `activeEmployeeCount < tenant.seatLimit` on employee create. Return a clear upgrade prompt, never a generic 400.

### CSV employee import

The single biggest onboarding unblocker. Without it someone hand-types 60 employees and abandons the trial. Needs: column mapper, dry-run preview showing per-row validation errors, idempotency by email, and a summary (`42 created, 3 updated, 2 skipped`). Ship a downloadable template CSV.

### Per-tenant branding

Logo + primary colour on `Tenant`, applied to the app header, email templates and PDF/Excel exports. Two hours of work, disproportionate perceived value — it stops feeling like your system and starts feeling like theirs.

### 2FA (TOTP) for ADMIN and DIRECTOR

These accounts can read every employee's passport number, NI number and bank details. Required before the first real customer, not before the first demo.

### Cron job rework

`checkExpiringRecords()` must iterate tenants and run each sweep inside that tenant's context. Also: it currently fires in every process, so if PM2 is ever switched to cluster mode every tenant gets duplicate emails. Add a single-runner guard (advisory DB lock or `NODE_APP_INSTANCE === '0'`).

---

## 9. GDPR: what changes when you sell to other companies

This is a legal shift, not just a technical one, and it is also a selling point for a compliance-led product.

**Today:** 6soft is the Data Controller for its own staff.
**As OnsideHR:** each customer is the **Controller**; you are the **Processor**. That triggers concrete obligations:

1. **A Data Processing Agreement** with every customer (UK GDPR Art. 28) — signed before they upload a single employee record. Non-negotiable, and the first thing a competent buyer asks for.
2. **A published sub-processor list** — Hostinger (hosting), Cloudflare (R2 storage), your SMTP provider. Customers must be notified before you add one.
3. **Records of Processing Activities** (Art. 30) as a processor.
4. **ICO registration** as a data processor (annual fee, tier depends on size — budget £40–60/yr).
5. **Breach notification to the Controller "without undue delay"** (Art. 33) — you must tell the customer, they notify the ICO. Write the runbook before you need it.
6. **Tenant-scoped data subject rights.** The existing per-employee export/erase in `routes/gdpr.ts` must be tenant-filtered, and you need a new **whole-tenant export** and **tenant deletion** flow (Art. 28(3)(g) — return or delete all data at end of contract).
7. **Data residency.** MySQL on a UK/EU VPS, R2 bucket with EU jurisdiction restriction. Say so on the website; UK SMEs ask.
8. **Retention policy per tenant** — how long after an employee leaves is their record kept? Make it configurable in `TenantSettings`; the correct default for UK payroll/HMRC records is 6 years.

Note also: the `Employee` model holds passport numbers, visa numbers, NI numbers, bank account and sort code, ethnicity and date of birth. Ethnicity is **special-category data** under Art. 9 — it needs a lawful basis and should arguably be optional and separately consented.

---

## 10. Security hardening (currently absent)

Verified missing from the codebase. All are cheap, and all will be asked about in a customer's security questionnaire:

| Gap | Fix | Effort |
|---|---|---|
| No rate limiting anywhere | `express-rate-limit` — strict on `/api/auth/login`, `/forgot-password` | 30 min |
| No security headers | `helmet` | 10 min |
| No login throttle/lockout | Track failed attempts per email, exponential backoff | 1 hr |
| JWT in `localStorage` | XSS steals the token. Move to `httpOnly` cookie + CSRF token, or accept and harden CSP | 2–3 hrs |
| No token revocation | 8h token stays valid after logout/suspend. Add a `tokenVersion` on User, bump on password change/suspend | 1 hr |
| Sensitive fields in plaintext | Passport/NI/bank in plaintext columns. Phase 2: application-level column encryption | 1 day |
| No dependency scanning | `npm audit` in CI, Dependabot | 20 min |

`multer@1.4.5-lts.1` is worth checking against current advisories during this pass.

---

## 11. Phased plan with verification gates

Sized for focused sessions. Each phase has a check that must pass before moving on.

### Phase 0 — Branch and baseline (30 min)
- Branch `feat/multi-tenant`. Commit the current working-tree changes first.
- **Gate:** `npm --prefix backend run test && npm --prefix frontend run test` green on `main`.

### Phase 1 — Tenant foundation (1 day)
- `Tenant`, `TenantSettings`, `PlatformAdmin` models; `tenantId` on all 11 tenant-scoped models; unique constraint changes.
- `prisma migrate reset` (safe — no live data). Seed script creates tenant `demo` + an ADMIN.
- `tenantContext.ts` (AsyncLocalStorage), `prismaTenant.ts` (extension, deny-by-default), `platformPrisma` escape hatch.
- **Gate:** app boots; a query with no tenant context **throws**; the seeded tenant's data loads normally.

### Phase 2 — Scope the 147 call sites (1 day) ← *the critical phase*
- Codemod `findUnique`/`update`/`delete` per §4 Layer 3.
- Fix the broadcast queries (`leave.ts:71` and every sibling).
- Tenant-scope `routes/gdpr.ts` (24 calls) and `routes/admin.ts` (30 calls) — the two highest-risk files.
- Write `crossTenant.security.test.ts` with one row per route.
- Update the 17 existing test files to seed a tenant.
- **Gate:** cross-tenant suite fully green; CI grep finds zero `findUnique(` in `routes/`; existing suites still green.

### Phase 3 — Auth, tenancy, platform console (1 day)
- `tenantId` + `tenantSlug` into the JWT; tenant-context middleware; `tokenVersion` revocation.
- Tenant lifecycle middleware (suspended/cancelled/trial-expired).
- Platform admin auth + console: list/create/suspend tenants, invite first admin, impersonate with audit.
- **Gate:** create two tenants from the console, log into each, confirm complete data separation in the UI.

### Phase 4 — R2 storage (half day)
- `lib/storage.ts`, multer → memory, presigned downloads, key-prefix validation.
- **Gate:** upload as tenant A, confirm the R2 key is tenant-prefixed, confirm tenant B gets 404 on that document ID.

### Phase 5 — Rebrand + legal (1 day)
- All 21 files, email templates, favicon/logo, CORS allowlist.
- Terms, Privacy, DPA, sub-processor list rewritten for a processor relationship.
- SPF/DKIM/DMARC on `onsidehr.co.uk`; send a test email to a Gmail address and confirm inbox placement.
- **Gate:** zero `6soft` occurrences in user-facing strings; test email lands in the inbox, not spam.

### Phase 6 — Sellability (1–2 days)
In priority order: **CSV import** → **per-tenant branding** → **feature gating + seat limits** → **2FA** → security hardening from §10.
- **Gate:** onboard a fake customer end-to-end — create tenant, import 50 employees from CSV, invite an admin, log in with their branding, request and approve leave, upload a document.

### Phase 7 — Ops (half day)
- Nightly `mysqldump` → R2, 30-day retention.
- **Restore rehearsal** — restore last night's dump into a scratch database and boot the app against it. An untested backup is not a backup.
- Staging PM2 app + separate database on the same box.
- Uptime monitoring on `/api/health`; error alerting.
- **Gate:** a restore from backup actually works, timed and documented.

**Total: ~6–8 focused days.** At a weekend-sprint pace, roughly 3 weekends — Phases 1–2 together, then 3–5, then 6–7.

---

## 12. Recommended v1 scope (you asked for the call)

All four, but sequenced by what blocks what:

1. **Super-admin console** — Phase 3. Not optional; you cannot create a customer without it.
2. **CSV import** — Phase 6, first. Every onboarding is blocked on it. This is the difference between a trial that converts and one that dies on day two.
3. **Per-tenant branding** — Phase 6, second. Two hours, and it's the thing prospects notice in a demo.
4. **2FA** — Phase 6, before the first *paying* customer. Fine to demo without it; not fine to hold real passport and bank data without it.

---

## 13. Pricing and market positioning

*Based on market research conducted 2026-08-20. Competitor prices read live from vendor pages that day; market-size figures computed from the gov.uk Register of Licensed Sponsors and Home Office table SC_01.*

### 13a. The market reality

**The gap is real and verified.** Sitemap enumeration across **20 mainstream UK HR platforms** — Breathe (2,262 URLs), Access PeopleHR (607), CharlieHR (122), HiBob, Rippling (6,896), IRIS (2,307) and others — found **zero** that mention Certificate of Sponsorship, the SMS, the 10/20-working-day duties, or Appendix D. Not one. Meanwhile:

- **~127,000 licensed sponsors** in the UK (computed from the register; Home Office's own figure: 124,837 skilled-work organisations).
- **3,100 Skilled Worker revocations in 2025**, up 9.2× from 2023. **1,545 in Q1 2026 alone** — a series record, ~5% annualised.
- **Only 42 rows on the entire 142,806-row register carry a B rating.** The B-rating is the remediation path — pay the £1,579 action plan fee, fix it, recover your A-rating. Against 1,545 revocations in a quarter, forty-two B-ratings means the Home Office is largely skipping remediation and going straight to revocation. **There is no second chance.** That single fact is the strongest sales argument available, and it is why *preventive* software is saleable.
- **Care carries 33% of all revocations** (569 of 1,743 revoked sponsors). That is your beachhead vertical.
- The substitute product costs **£1,950–£8,500 per mock audit** (OTB Legal £1,950+VAT for 20 employees; Immigration UK £2,950 for 1–50). Only **two firms in the entire market publish an ongoing retainer**: Oury Clark £300/mo, Davenport from £350/mo+VAT.

**Two things that must not be glossed over:**

1. **You would not be the cheapest.** Root HR (£10/mo for 15 staff + £1.50/extra) and Blaze HR (£29/mo ≤25) already bundle UKVI compliance below any price you'd want to charge. At 60 employees they're £77.50 and £99 against your £168. Price leadership is not available.
2. **Sponsored-worker inflow is falling sharply.** Skilled Worker main applicants −39% YoY, Health & Care Worker −53%, sponsor licences granted −24%. **The market is the 127,000-strong installed base under record enforcement, not new licences.** Any plan predicated on sponsorship growth is wrong. (Arguably this is *better* for a compliance product — enforcement pressure beats growth as a buying trigger — but it means a flat-to-declining TAM.)

### 13b. Recommended pricing

**OnsideHR Core** — all features, no tier gating, monthly rolling, ex-VAT:

| Employees | £/month | Effective £/emp at top of band |
|---|---|---|
| 1–10 | £19 | £1.90 |
| 11–25 | £39 | £1.56 |
| 26–50 | £69 | £1.38 |
| 51–100 | £119 | £1.19 |
| 101–150 | £169 | £1.13 |
| 151–200 | £209 | £1.05 |
| 201+ | £1.00/employee/month | — |

**Sponsor Compliance module** — priced on *sponsored* workers, not total headcount:

| Sponsored workers | £/month |
|---|---|
| 1–5 | £29 |
| 6–15 | £49 |
| 16–40 | £79 |
| 41–100 | £129 |

**Terms: annual = 2 months free (~17%). No setup fee. No minimum term. 30-day free trial, no card.** All four are deliberate, explicit contrasts with the incumbents (see 13d).

**Flat headcount tiers, not per-employee.** This is the model UK SMEs demonstrably prefer — Breathe, CharlieHR, myhrtoolkit, Sense HR and Blaze HR all use it, and Breathe markets it explicitly: *"our pricing is per organisation — not per person."* It removes the "we're growing, our bill will grow" objection and makes the sale simpler. Offer per-employee (£1.45/emp Core, £3.50/sponsored worker) only if a buyer insists, priced ~15% above flat at 150+ so flat is the obvious choice.

### 13c. Head-to-head at 60 employees / 12 sponsored (ex-VAT, monthly)

| Option | £/month | Sponsor compliance? | Lock-in |
|---|---|---|---|
| Root HR | £77.50 | ✅ bundled | none — **company 6 months old** |
| Blaze HR | £99 | ✅ module | 6-mo promo — **company 19 months old** |
| **OnsideHR** | **£168** | ✅ **full, in one system** | **none** |
| Breathe + SMS System | £275 | ✅ two systems, re-keyed | none |
| BrightHR Core | £288 | ❌ | **36 months + implementation fee** |
| Law-firm retainer | £300–350 | ✅ advice only, no software | — |
| Citation HR&EL | £462 | ❌ | **7-year default term** |

At 60 employees you are **42% below Breathe+SMS System**, **42% below BrightHR**, **64% below Citation**, and **half a law-firm retainer** — while the entire compliance layer costs less than **2.5% of one £1,950 mock audit per month**.

**Margin is a non-issue.** At 50 tenants averaging £160/mo (£96k ARR), total COGS ≈ £236/mo → **97% gross margin**. Break-even on a £3,000/mo cost base is **~19 customers**. Storage: 25 sponsored workers × ~15 Appendix D documents × ~1.5MB ≈ 560MB/tenant/year; 200 tenants over 3 years ≈ 340GB ≈ **£5/month** on R2.

**Use GoCardless Direct Debit, not Stripe Cards.** 1% + 20p capped at £4, versus Stripe's 1.5% + 20p plus 0.7% Billing. On a £160 invoice: **£1.80 vs £3.72**. Direct Debit also has structurally better retention for B2B SaaS. This changes the Phase-6 billing decision when you get there.

### 13d. Positioning — what to put on the pricing page

The research surfaced ten sourced attack lines. The strongest are the incumbents' **own published terms**, not reviews:

- **BrightHR's own price page:** *"We offer 24, 36 and 60 months fixed term"* and *"An implementation fee based on the number of employees will apply to all packages"* (amount never published).
- **Citation's own price page:** *"Based on our Workplace Expert package over a seven-year term."*
- **Breathe** raised prices 57% in two years post-acquisition and *"won't help you download uploaded documents en-bloc"* — bulk export is a free, ownable wedge, and it matters doubly for sponsors whose Appendix D files must be producible **on demand**.
- **Personio** hides plan limits until after signature (Core caps e-signature at *"8% of employees"*).

So the pricing page writes itself: **published price, no setup fee, no minimum term, 30-day trial, one-click full data export, UK data residency, and a registered UK company with a named director.**

That last one is not a throwaway. **HireComply and SponsorPro — two of the leading sponsor-compliance competitors — have no Companies House registration at all**, and SMS System's operator was incorporated 3 November 2025 with a virtual office. You are asking SMEs to store passport scans, payslips and bank details. **Put the 6soft Ltd company number in the footer.** It costs nothing and half the competitive set cannot match it.

**Do not fight on paid search.** Breathe and BrightHR each run ~300 live UK Google ads; `hr software uk` is Ahrefs-Hard. But `revoked sponsor licence list`, `sponsor licence revoked` and `sponsor licence suspension` are all **Easy**, and `sponsor licence management software` still returns **GOV.UK at organic #1–2** with the leading commercial advertiser running 15 ads against the HR incumbents' 300. **Attack the fear-tail.** Caveat: the commercial-intent software phrases barely register in volume at all — you are creating the category, not capturing existing demand.

---

## 14. The compliance moat — what actually makes this defensible

The research produced a sharper strategic claim than "there's a gap":

> **Every sponsor-compliance point solution is a bolt-on with no HR core.** SMS System, SponsorPro, HireComply, ComplianceGuard, Borderless and WpcHR have no leave management, no timesheets, no records for non-sponsored staff. An SME with 40 staff of whom 12 are sponsored buys **both** systems and re-keys absence data between them.

That matters because **the two hardest sponsor duties are computed from HR data the point solutions do not hold**:

### 14a. The unauthorised-absence report (10 consecutive working days)

Sponsor guidance Part 3 C1.15 requires reporting within 10 working days when a worker is *"absent from work without your permission for more than 10 consecutive working days."*

You already have `LeaveRequest` and `Timesheet`. What's missing is a notion of **unauthorised** absence and a working-day calculation that respects `TenantSettings.workingDays` and the correct UK bank-holiday region. New model:

```prisma
model AbsenceRecord {
  id           Int      @id @default(autoincrement())
  tenantId     Int
  employeeId   Int
  date         DateTime
  status       String   // AUTHORISED | UNAUTHORISED | SICK | UNKNOWN
  source       String   // LEAVE_REQUEST | TIMESHEET_GAP | MANUAL
  notes        String?
  @@unique([tenantId, employeeId, date])
  @@index([tenantId, employeeId, date])
}
```

A daily job walks each sponsored worker's calendar, counts consecutive unauthorised working days, and at day 10 **auto-creates a `SponsorshipReportableEvent`** with `dueDate = eventDate + 10 working days`. That is a report no competitor can generate, because they don't hold the absence data.

### 14b. The per-pay-period salary check

**From 8 April 2026, salary compliance is assessed per individual pay period, not annually** — turning one annual check into twelve reconciliations per worker per year. Guidance C7.7 confirms: *"We will also make regular checks with HMRC to ensure you are paying your workers appropriately."*

The current `Sponsorship` model has no salary data at all. It needs the CoS terms to reconcile against:

```prisma
// add to Sponsorship
  socCode          String?
  jobTitleOnCos    String?
  cosSalary        Float?     // annual gross stated on the CoS
  cosWeeklyHours   Float?
  workLocation     String?

model PayRecord {
  id            Int      @id @default(autoincrement())
  tenantId      Int
  employeeId    Int
  periodStart   DateTime
  periodEnd     DateTime
  grossPay      Float
  hoursWorked   Float?
  source        String   // CSV_IMPORT | MANUAL
  @@unique([tenantId, employeeId, periodStart])
}
```

Reconciliation runs per period: does annualised gross meet the CoS salary *and* the going rate for the SOC code? Below threshold → auto-raise a reportable event. Payroll data arrives by CSV import initially (same importer machinery as employees) — no payroll engine required.

### 14c. Appendix D evidence completeness

Appendix D v08/26 says: *"There is **no prescribed method** for storing the documents but you must be able to make them available to us on request."* That sentence is the whole opportunity — the regulator specifies **what**, never **how**.

`SponsorshipComplianceEvidence` already exists. What it needs is a **required-evidence manifest** per sponsored worker (passport/eVisa, CoS, signed contract, RTW evidence, 12 months of payslips, bank-transfer evidence per named worker, contact details, absence records), a completeness percentage, and a **one-click audit pack export** — a ZIP with an index, which `archiver` (already a dependency) handles.

Retention rule: *"throughout the period that you sponsor them and until one year after the date on which your sponsorship of the worker ended."* Encode this as the retention policy for sponsored workers, distinct from the 6-year HMRC default for general payroll records.

### 14d. Audit-readiness score

A single number on the dashboard, computed from: Appendix D completeness, overdue reportable events, expiring documents, unresolved absence flags, salary reconciliation failures. This is the thing a director looks at once a week and the reason they don't cancel. **Home Office visits can be unannounced** (C7.9: *"on an announced or an unannounced basis"*; C7.10: full access *"on demand"*) — sell readiness, not record-keeping.

### 14e. Deliberately do NOT build

- **Right-to-work checks as a revenue line.** The free gov.uk share-code route is **mandatory** for eVisa holders — i.e. all your sponsored workers. Paid IDVT applies only to British/Irish passport holders. A 60-person sponsor with 20% turnover generates ~9 paid checks/year at ~£2 margin = **£18/year**. Integrate the free share-code flow and store the evidence; don't build a resale business. (Also: the employer cannot legally delegate the check itself.)
- **A payroll engine.** Import payroll CSV, reconcile, done. Breathe doesn't have one either.
- **ATS, LMS, expenses, rota.** All PREMIUM add-ons across the market, all a distraction from the wedge.

### 14f. Guidance churn is an operating cost

Sponsor guidance Part 3 was revised **five times in seventeen months** (Apr 2025, Jul 2025, Nov 2025, Mar 2026, May 2026); Appendix D updated Aug 2026. BRPs are no longer valid and vignettes stopped 1 July 2026. **Budget for a monthly guidance review**, version your compliance rules, and show the guidance version in the UI. This is also a moat — it's ongoing work the "shipped it last year" micro-vendors won't sustain.

---

## 15. Open questions to revisit

1. **Multi-tenant users** — do HR consultants managing several client companies matter as a segment? Affects the `User.email` uniqueness decision (§5).
2. **Care-sector beachhead** — 33% of revocations. Worth a dedicated landing page and vocabulary (CQC, agency staff, rota-driven absence) before broad launch?
3. **When to move off the single VPS** — suggested trigger: customer #1 signing, or 10 tenants, whichever first.
4. **ISO 27001** — 46% of UK HR-tech buyers say security concerns triggered their purchase, and Sense HR advertises ISO 27001 + UK data centres at every tier. Expensive for a solo founder; consider Cyber Essentials Plus as the interim credential.
5. **Billing** — GoCardless Direct Debit from the third manual invoice.
6. **Per-tenant database** — offer only if a large prospect's security review demands it; the extension architecture makes a per-tenant connection resolver tractable later.
7. **Column-level encryption** for passport/NI/bank fields — before or after first customer?
8. **Three unverified competitors** worth a follow-up look: `brithr.co.uk` (note the deliberate confusability with BrightHR), `irshr.co.uk`, `dodo-hr.com`. The category is crowding faster than one search reveals.
