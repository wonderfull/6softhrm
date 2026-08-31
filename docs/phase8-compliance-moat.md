# Phase 8 — The Compliance Moat

**Planned:** 2026-08-31 · **Built:** 2026-08-31 (same day)
**Continues:** `docs/multitenant-plan.md` §14 (phases 0–7 merged to `main` at `b06f883`)

---

## 0. Delivery status — all ten sub-items complete

| # | Sub-item | Status | Commit |
|---|---|---|---|
| P8.0 | Working-day + bank-holiday service | ✅ | `ebc69b6` |
| P8.1 | `AbsenceRecord` model + derivation | ✅ | `ebc69b6` |
| P8.2 | 10-day unauthorised-absence detection | ✅ | `ebc69b6` |
| P8.3 | CoS terms on `Sponsorship` | ✅ | `7ba005f` |
| P8.4 | `PayRecord` model + CSV import | ✅ | `7ba005f` |
| P8.5 | Per-pay-period salary reconciliation | ✅ | `7ba005f` |
| P8.6 | Appendix D manifest + audit-pack ZIP | ✅ | `c2dc3b0` |
| P8.7 | Audit-readiness score + dashboard tile | ✅ | `c2dc3b0` |
| P8.8 | Guidance version surfacing | ✅ | `c2dc3b0` |
| P8.9 | `verify:compliance` gate | ✅ | `c2dc3b0` |

**Verification — `npm --prefix backend run verify:all`:**
- Static tenancy guard: clean
- Backend tests: **209/209** (was 137) · Frontend tests: **79/79** (was 71)
- Tenancy gate, onboarding gate, and the new **compliance gate (22/22)** all PASS

**Three real defects found and fixed along the way:**
1. `isWorkingDay()` knew only the early May bank holiday, so every
   10-working-day due date was wrong around Christmas, Easter and August —
   in the direction that misses a Home Office deadline. Now the real gov.uk
   calendar for all three regions, honouring `TenantSettings`.
2. Both CSV importers rejected any salary containing "£" (UTF-8 read as
   latin1 gives "Â£"), so realistic UK payroll spreadsheets failed the P6
   import outright. Regression test added.
3. The `verify:compliance` gate caught, on its first run, that the CoS fields
   were in the schema but never wired into the sponsorship create/update
   routes — `cosSalary` silently never persisted.

**Deviation from plan:** the SOC going rate is recorded per sponsorship
(`goingRateSalary`) rather than looked up from a vendored rate table. Those
rates move with every guidance revision, and a stale table would silently
under-report. This was the flagged risk in §Risks; delegating the lookup to
the user is the honest resolution, not the descope.

**Not built:** timesheet-gap absence detection remains advisory only
(status `UNKNOWN`), by the design decision recorded under Open question.

---

## Why this phase

Phases 1–7 made OnsideHR sellable as a multi-tenant HR system. They did not
build the wedge. Today the schema has no `AbsenceRecord`, no `PayRecord`, and
`Sponsorship` carries no CoS terms — so the product cannot generate the
unauthorised-absence report, cannot reconcile salary per pay period, and cannot
answer "are we audit-ready?".

Note the salary rule is **live law since 8 April 2026**, not a future concern.

## What already exists (and shortens the work)

| Asset | Location | Reuse |
|---|---|---|
| `UNAUTHORISED_ABSENCE_10_DAYS` event type | `routes/sponsorships.ts:26` | Defined; nothing generates it yet |
| Evidence manifest + completeness | `buildCompliancePack()` | Expand from 5 types to full Appendix D |
| Synthesised-alert pattern | `buildDelayedStartAlert()` | Copy shape for absence alerts |
| CSV importer | `lib/employeeImport.ts` (161 lines) | Template for the pay-record importer |
| Daily cron | `lib/cronJobs.ts` (175 lines) | Host the absence walk |
| `archiver` | already a dependency | Audit-pack ZIP |
| `TenantSettings.workingDays` / `.bankHolidayRegion` | schema | Present but **unused** — see P8.0 |

## Known defect this phase must fix

`routes/sponsorships.ts:93` — `isEarlyMayBankHoliday()` is the whole bank-holiday
calendar. `isWorkingDay()` hardcodes Sat/Sun and ignores both
`TenantSettings.workingDays` and `.bankHolidayRegion`. Every 10-working-day due
date is therefore wrong around Christmas, Easter and August — in the direction
that misses a Home Office deadline. P8.0 fixes this before anything is built on
top of it.

---

## Plan

### P8.0 — Working-day and bank-holiday service *(shared foundation)*
Replace the stub with a real calendar: vendor a snapshot of gov.uk
`bank-holidays.json` covering all three regions, honour
`TenantSettings.workingDays` and `.bankHolidayRegion`, expose
`isWorkingDay(date, settings)` / `addWorkingDays(date, n, settings)` from
`lib/workingDays.ts`. Repoint `sponsorships.ts` at it.
**Verify:** unit tests for Christmas/Easter/August across all three regions, plus
a Scotland-vs-England divergence case (2 Jan, St Andrew's Day).

### P8.1 — `AbsenceRecord` model and derivation
Model + migration per §14a. Derive daily status from `LeaveRequest`
(authorised/sick) and, where the tenant uses them, `Timesheet` gaps; allow manual
override. Unique on `[tenantId, employeeId, date]` so re-runs are idempotent.
**Verify:** a sponsored worker with mixed leave/timesheet history produces the
expected day-by-day status ledger.

### P8.2 — 10-day unauthorised-absence detection
Daily job walks each sponsored worker, counts consecutive **unauthorised working
days**, and at day 10 auto-creates `SponsorshipReportableEvent` with
`eventType: 'UNAUTHORISED_ABSENCE_10_DAYS'` and
`dueDate = eventDate + 10 working days`. Must not duplicate on re-run.
**Verify:** 9 days → no event; 10 → exactly one event with the correct due date;
re-run creates none; a bank holiday inside the window shifts the date.

### P8.3 — CoS terms on `Sponsorship`
Add `socCode`, `jobTitleOnCos`, `cosSalary`, `cosWeeklyHours`, `workLocation`
(+ migration, form fields, validation).
**Verify:** round-trips through the sponsorship UI; existing rows unaffected.

### P8.4 — `PayRecord` model and CSV import
Model + migration; importer modelled on `employeeImport.ts` with the same
dry-run/plan/commit shape and per-row error reporting.
**Verify:** import 12 periods for 50 workers; dry run matches commit; bad rows
rejected with row numbers.

### P8.5 — Per-pay-period salary reconciliation
Annualise gross per period; compare against `cosSalary` **and** the SOC going
rate; below threshold auto-raises a reportable event.
**Depends on P8.3 + P8.4.** Carries the phase's main unknown — see Risks.
**Verify:** a worker paid below CoS raises exactly one event per failing period;
a compliant worker raises none.

### P8.6 — Appendix D manifest and audit-pack export
Expand the manifest to the full Appendix D list (passport/eVisa, CoS, signed
contract, RTW evidence, 12 months of payslips, per-worker bank-transfer
evidence, contact details, absence records), add a completeness percentage, and
a one-click ZIP export with an index via `archiver`. Encode the sponsor
retention rule (sponsorship end + 1 year), distinct from the 6-year payroll
default.
**Verify:** ZIP opens, index lists every item, completeness maths matches the
manifest.

### P8.7 — Audit-readiness score
One dashboard number from: Appendix D completeness, overdue reportable events,
expiring documents, unresolved absence flags, salary reconciliation failures.
Drill-down to what to fix. **Depends on P8.1, P8.5, P8.6.**
**Verify:** score moves correctly as each input is broken and repaired.

### P8.8 — Guidance version surfacing
Version the compliance rules and show the guidance version in the UI
(Part 3 revised 5× in 17 months; Appendix D updated Aug 2026).
**Verify:** version renders on the compliance page.

### P8.9 — `verify:compliance` gate
A seeded, idempotent end-to-end gate in the style of `verify:tenancy` /
`verify:onboarding`, wired into `verify:all`.
**Verify:** passes from a clean DB and on immediate re-run.

---

## ETA

Ideal focused engineering days, assuming no scope surprises.

| # | Sub-item | Days | Depends on |
|---|---|---|---|
| P8.0 | Working-day + bank-holiday service *(fixes live bug)* | 0.5 | — |
| P8.1 | `AbsenceRecord` model + derivation | 1.0 | P8.0 |
| P8.2 | 10-day unauthorised-absence detection | 1.0 | P8.0, P8.1 |
| P8.3 | CoS terms on `Sponsorship` | 0.5 | — |
| P8.4 | `PayRecord` model + CSV import | 1.0 | — |
| P8.5 | Per-pay-period salary reconciliation | 1.5 | P8.3, P8.4 |
| P8.6 | Appendix D manifest + audit-pack ZIP | 1.0 | — |
| P8.7 | Audit-readiness score + dashboard | 1.0 | P8.1, P8.5, P8.6 |
| P8.8 | Guidance version surfacing | 0.25 | — |
| P8.9 | `verify:compliance` gate | 0.5 | all |
| | **Total** | **8.25** | |

**Critical path:** P8.3/P8.4 → P8.5 → P8.7 → P8.9 ≈ **4.5 days**. The absence
track (P8.0 → P8.1 → P8.2, 2.5 days) runs alongside it and is not on the
critical path.

### Suggested order

1. **P8.0** first — it is a live correctness bug and blocks the absence track.
2. **P8.3 + P8.4** next — they start the critical path and are independent.
3. **P8.5**, then the absence track (**P8.1**, **P8.2**) while it settles.
4. **P8.6**, then **P8.7** once its three inputs exist.
5. **P8.8**, **P8.9** to close.

### Shippable midpoints

- After **P8.2** (~2.5 days) the unauthorised-absence report is demoable — the
  single most differentiating feature, and enough for a sales conversation.
- After **P8.7** (~7.5 days) the readiness score is on the dashboard, which is
  the retention hook.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **SOC going-rate data** — no free structured feed; Home Office publishes rates as tables that change with guidance | Could push P8.5 from 1.5 to 3 days | Vendor a snapshot for the SOC codes actually in use; treat as versioned reference data (ties to P8.8) |
| **Timesheet-gap absence signal is unreliable** for tenants not logging timesheets daily | Absence detection silently under-reports — worse than not shipping it | Decide the detection source explicitly (see Open question); consider requiring manual marking as the authoritative signal |
| Bank-holiday snapshot goes stale | Due dates drift again | Refresh as part of the monthly guidance review (§14f) |
| Absence walk cost at scale | Slow cron | Only walk active sponsored workers; index `[tenantId, employeeId, date]` |

## Open question — settled

**What is the authoritative source of "unauthorised absence"?**
**Decided: an explicit manual "mark absent" action.** Timesheet gaps surface as
`UNKNOWN` — a prompt for HR to confirm, never a report trigger. Most SMEs do not
log timesheets daily, so inferring absence from missing paperwork would raise
Home Office reports off nothing, and a silently under-reporting statutory report
is worse than none. Encoded in `lib/absence.ts` with the precedence
MANUAL > approved LEAVE_REQUEST > TIMESHEET_GAP.
