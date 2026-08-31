# Outstanding security findings

Advisories that survived `npm audit fix` because the fix crosses a major
version, or because no fix exists. Each needs a human decision — none of them
should be applied blind.

Last reviewed: 2026-08-31. Re-check at the monthly guidance review.

---

## multer — CI will never flag this, so review it by hand

**Installed: `1.4.5-lts.2`.** `npm audit` reports **zero** multer findings. That
is a tooling blind spot, not a clean bill of health.

Eight advisories (CVE-2025-47935 / 47944 / 48997 / 7338, CVE-2026-2359 / 3304 /
3520 / 5079) cover the `1.4.4-lts.1`+ line, which includes what we run. npm's
audit silently skips them: because `1.4.5-lts.2` carries a prerelease-style tag,
node-semver refuses to test it against ranges whose comparators don't share the
same `[major,minor,patch]` tuple with a prerelease tag — and none of these do.
Confirmed with `npx semver -r "<2.0.0" "1.4.5-lts.2"` → no match.

**This means `dependency-audit.yml` and Dependabot will never report multer.**
It is the one package in this repo that must be checked manually.

- **Impact:** DoS only — crafted multipart requests crash the process or
  exhaust memory. No RCE, no data exposure.
- **Exploitability here:** both `upload.single/array()` call sites
  (`routes/documents.ts`, `routes/employees.ts`) sit behind `requireAuth`, and
  the CSV import additionally behind `requireRole('ADMIN','DIRECTOR')` — so an
  authenticated actor is required. But a hit takes down the Node process for
  **every tenant**, which matters more now the app is multi-tenant.
- **Fix:** `multer@2.x` (major bump). The patterns this codebase uses —
  `memoryStorage()`, `fileFilter(req, file, cb)`, `limits.fileSize` — are
  unchanged in the 2.x API, so it looks compatible on paper.
- **Recommendation:** bump to `2.1.1` in a dedicated PR, run the full backend
  Jest suite (multipart upload tests exist), and manually smoke-test document
  upload and CSV import. `2.2.0` patches one more DoS but is very new.

## xlsx — no fix exists on npm at all

High (prototype pollution + ReDoS), in **both** workspaces. `fixAvailable:
false`: SheetJS stopped publishing patched builds to npm and ships them only
from their own CDN. Options are to pull from the SheetJS CDN, or replace with
`exceljs`. Used by the employee and payroll CSV importers, so a swap is real
work, not a version bump.

## Major-version bumps, deliberately not applied

| Package | Severity | Fix requires | Note |
|---|---|---|---|
| `nodemailer` | high | `9.1.0` | SMTP command/header injection class |
| `react-router` / `react-router-dom` | moderate | `7.18.3` | open-redirect bypass; v6→v7 is a breaking rewrite |
| `vite` / `esbuild` | moderate | `vite@8.2.2` | build tooling |
| `jest-cucumber` / `@cucumber/*` | moderate | `3.0.2` | dev-only test tooling |

## vitest — critical, but dev-only

CVE-2026-47429: arbitrary file read when the Vitest **UI** dev server is
listening. Requires someone to run `vitest --ui`; not reachable in CI or
production. `npm audit fix` reported a fix available but declined to move the
version; worth a manual look rather than a forced bump.

---

## Why the CI gate is set at `high`, not `moderate`

Backend alone carries 23 moderate advisories. A gate at moderate would fail
nearly every commit, and a check that always fails is a check everyone learns
to ignore — which is worse than not having one. `dependency-audit.yml` reports
everything at moderate and up, and fails the build only on high/critical.

Expect the gate to show **red** today: the remaining findings above are real,
not false positives. Clearing them is a decision, not a chore.
