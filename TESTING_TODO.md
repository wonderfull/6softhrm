# Testing TODO and Fix Guide

Date of test pass: 2026-04-03

This file captures the issues found while testing the application using:

- `TESTING.md` as the target coverage list
- Existing frontend/backend automated tests
- Live browser checks with Playwright against local dev servers
- Targeted API verification with `curl`
- Source inspection for likely root causes

## Test Coverage Completed

Automated baseline:

- `frontend`: `npm test -- --run`
- `backend`: `npm test -- --runInBand`

Live browser coverage completed with Playwright:

- Login flow for `admin@example.com`
- Login flow for `manager@example.com`
- Documents page
- Leave page
- Timesheets page
- Timesheet creation flow
- Monthly timesheet view
- Sponsorships page
- Sponsorship creation form
- Manager access to User Management

Direct API verification completed:

- `POST /api/auth/login` for admin, manager, and demo user
- `GET /api/auth/users` without auth
- `POST /api/auth/register` without auth
- `DELETE /api/auth/users/:id` without auth

## Automated Test Baseline

### Frontend test suite status

Observed result:

- `3` frontend test files ran
- `22` tests failed
- Failures are concentrated in `Time.test.tsx`, `Documents.test.tsx`, and `Sponsorships.test.tsx`

Main reason:

- The tests no longer match the current UI and token handling.

Examples:

- `frontend/src/__tests__/Time.test.tsx:96` expects an `Add Timesheet` button, but the actual UI renders `+ Add Entry`.
- `frontend/src/__tests__/Time.test.tsx:124` expects a plain `Next` button, but the UI renders `Next →`.
- `frontend/src/__tests__/Time.test.tsx:163` expects a `Submit` button, but the actual form button renders `Add Entry` or `Update Entry`.
- `frontend/src/__tests__/Documents.test.tsx:71` stores a base64 JSON blob in `localStorage`, but the app expects a JWT-like `header.payload.signature` token. The production decoder in `frontend/src/lib/api.ts:50` and the page decoder in `frontend/src/pages/Documents.tsx:18` both depend on JWT structure.
- `frontend/src/__tests__/Documents.test.tsx:113` uses role `EMPLOYEE`, but the current app uses `USER` for employee accounts.
- `frontend/src/__tests__/Sponsorships.test.tsx:119` expects a `Submit` button, but the UI currently uses `Add Sponsorship`.

Fix direction:

- Update the tests to match the current UI labels, role names, and JWT structure.
- Add a shared helper for generating test JWTs so each test does not hand-roll incompatible tokens.
- Prefer `getByRole()` queries over text-only assertions where labels and button copy have changed over time.
- Re-run the suite after aligning the tests with the current implementation.

### Backend test suite status

Observed result:

- Backend tests failed before meaningful assertions ran.
- Failure message: Prisma could not connect to `localhost:3306`.

Likely root cause:

- The test environment is hard-coded to a specific local MySQL URL in `backend/src/__tests__/setup.ts:10`.
- That means the suite only works on machines that have the exact local database, credentials, and schema expected by the repo.

Fix direction:

- Stop hard-coding the DB connection string in test setup.
- Prefer `process.env.TEST_DATABASE_URL || process.env.DATABASE_URL` with an explicit guard that fails early and clearly if neither is set.
- Consider swapping integration tests to SQLite or a throwaway MySQL container so the suite is reproducible.
- Add setup instructions or a script that provisions the test database automatically.

## High Priority Fixes

### 1. Unauthenticated user administration endpoints

Severity: Critical

What I verified:

- `GET /api/auth/users` returns the full user list without any token.
- `POST /api/auth/register` accepts arbitrary `role` values without any token.
- `DELETE /api/auth/users/:id` works without any token.

Reproduction:

1. Run `curl http://localhost:4000/api/auth/users`
2. Run `curl -X POST http://localhost:4000/api/auth/register -H 'Content-Type: application/json' -d '{"email":"...","password":"password123","name":"...","role":"ADMIN"}'`
3. Run `curl -X DELETE http://localhost:4000/api/auth/users/<id>`

Observed behavior:

- All three actions are accepted without authentication or role checks.

Likely root cause:

- `backend/src/routes/auth.ts:12` exposes `/register` publicly and trusts `role` from the request body.
- `backend/src/routes/auth.ts:35` exposes `/link-employee` publicly.
- `backend/src/routes/auth.ts:101` exposes `/users` publicly.
- `backend/src/routes/auth.ts:125` exposes user updates publicly.
- `backend/src/routes/auth.ts:140` exposes user deletion publicly.

Recommended fix:

1. Add `requireAuth` and `requireRole('ADMIN')` to `/users`, `/users/:id`, and `/link-employee`.
2. Split public self-registration from admin user creation.
3. For public registration, force `role: 'USER'` on the server and ignore any client-supplied role.
4. If public registration is not required, remove `/register` from public routes and move it behind admin controls.
5. Add backend integration tests that assert `401` or `403` for unauthenticated and non-admin callers.

Validation after fix:

- Anonymous requests to `/api/auth/users`, `/api/auth/register` with `role=ADMIN`, `/api/auth/users/:id`, and `/api/auth/link-employee` should all fail.

### 2. Manager can access full admin UI and user-management screen

Severity: High

What I verified with Playwright:

- Logged in as `manager@example.com / password123`
- Manager sees `User Management`, `Audit Logs`, and `Data Export` in the sidebar
- Manager can open `/users` and browse the full user list, including edit and delete buttons

Observed behavior:

- The manager experience is effectively using the admin navigation set.
- Because the backend user routes are also unprotected, this is a full privilege leak, not just a navigation bug.

Likely root cause:

- `frontend/src/components/Sidebar.tsx:41` maps both `ADMIN` and `MANAGER` to `adminMenu`.
- `frontend/src/main.tsx:70-82` mounts every protected page without any role-based route guard.

Recommended fix:

1. Create separate menus for `ADMIN`, `MANAGER`, and `USER`.
2. Add role-based route wrappers for pages like `/users`, `/audit-logs`, `/data-export`, and any admin-only maintenance pages.
3. Enforce the same rules in the backend so the frontend is not the only protection layer.
4. Add Playwright coverage for manager-visible navigation and route authorization.

Validation after fix:

- Manager should not see admin-only navigation items.
- Direct navigation to `/users` as manager should fail with a dedicated unauthorized state or redirect.

## Medium Priority Fixes

### 3. Leave page shows “account not linked” warning to admin and manager users

Severity: Medium

What I verified with Playwright:

- Logged in as admin
- Opened `/leave`
- The page displayed `⚠️ Your account is not linked to an employee record. Please contact HR.`

Observed behavior:

- This warning is shown even for users who are not meant to request their own leave and are only reviewing/approving requests.
- It creates false error messaging for admins and managers.

Likely root cause:

- `frontend/src/pages/Leave.tsx:73-84` shows the warning whenever `canRequestLeave` is false.
- The component does not distinguish “employee self-service not available” from “admin/manager review mode”.

Recommended fix:

1. Show the warning only for non-admin/non-manager users.
2. For admin/manager users, render either no CTA or a role-specific description such as “Review and approve leave requests”.
3. Keep the self-service warning for users whose accounts should be linked to employees.

Validation after fix:

- Admin and manager users should not see the employee-link warning.
- Unlinked employee users should still see it.

### 4. Monthly timesheet view renders both weekly and monthly grids at the same time

Severity: Medium

What I verified with Playwright:

- Logged in as admin
- Opened `/time`
- Clicked `Monthly`
- The page rendered the month header `April 2026`
- The weekly table remained visible above the monthly table

Observed behavior:

- Switching to monthly mode does not replace the weekly grid.
- This makes the page noisy and duplicates content.

Likely root cause:

- `frontend/src/pages/Time.tsx:511-583` always renders the weekly grid.
- `frontend/src/pages/Time.tsx:586-620` conditionally renders the monthly grid only when `viewMode === 'month'`.

Recommended fix:

1. Wrap the weekly grid in `viewMode === 'week'`.
2. Keep the monthly table exclusive to `viewMode === 'month'`.
3. Add a regression test that asserts only one grid is present per mode.

Validation after fix:

- Weekly mode shows only the weekly grid.
- Monthly mode shows only the monthly grid.

### 5. Monthly summary expected by `TESTING.md` is missing from the live UI

Severity: Medium

What I verified:

- `TESTING.md` claims a monthly summary with total hours and days worked.
- Live monthly view did not surface `Total Hours` or `Days Worked`.
- The frontend test `frontend/src/__tests__/Time.test.tsx:191-193` is also expecting those elements and currently fails.

Likely root cause:

- The current page implementation calculates monthly totals in `frontend/src/pages/Time.tsx:236-240` but never renders a dedicated summary block.

Recommended fix:

1. Add a summary area in monthly mode showing:
   - total hours
   - days worked
   - optional average hours/day
2. Make the summary react to employee and project filters.
3. Update the test to assert the final rendered summary, not assumed placeholder copy.

Validation after fix:

- Monthly mode should visibly show summary metrics and tests should pass.

### 6. Demo user credentials on the login page are wrong

Severity: Medium

What I verified:

- The login page advertises `User: user@example.com / password123`
- Direct API login check to `/api/auth/login` returns `{"error":"Invalid credentials"}`
- Admin and manager demo credentials do work

Likely root cause:

- `frontend/src/pages/Login.tsx:126-127` hard-codes a demo user that is not present in the seeded database.
- Current seed-related paths create:
  - `admin@example.com`
  - `manager@example.com`
  - employee-linked users like `john.smith@company.com` and `sarah.johnson@company.com`
- No flow in the current seed produces `user@example.com`.

Recommended fix:

Choose one of these approaches:

1. Update the login page to show real seeded credentials only.
2. Add a real `user@example.com` seeded account linked to an employee.
3. If you want a generic “user” demo account, ensure the same account is created in every supported seed path.

Validation after fix:

- Every demo credential shown in the UI must log in successfully.

### 7. Documents upload handler duplicates success work and likely double-alerts

Severity: Medium

What I found in code review:

- The upload handler resets form state, refreshes documents, and alerts success inside an inner `try`.
- It then repeats the same reset, refresh, and success alert in the outer `try`.

Likely root cause:

- `frontend/src/pages/Documents.tsx:87-110` contains duplicated post-success logic.

Expected user-facing symptom:

- Duplicate success alerts
- Duplicate `GET /documents` refreshes
- Harder-to-maintain upload flow

Recommended fix:

1. Collapse the nested `try` structure into a single success path.
2. Refresh documents exactly once.
3. Reset form state exactly once.
4. Remove unused variables such as `const token` at `frontend/src/pages/Documents.tsx:86` and `const d` at `frontend/src/pages/Documents.tsx:89` if they are not needed.

Validation after fix:

- A successful upload should produce one success alert and one list refresh.

### 8. Seeded sample dates are stale for the current date, making live views look empty

Severity: Medium

What I observed:

- Current system date during testing was 2026-04-03.
- Timesheet current week initially showed `0h` everywhere.
- Leave page data was still centered around late 2025.

Likely root cause:

- `backend/src/routes/admin.ts:189-206` seeds hard-coded dates in November and December 2025.

Impact:

- The app can look broken even when data exists.
- Playwright and manual QA become harder because default views are not aligned with “today”.

Recommended fix:

1. Generate sample dates relative to the current date for admin seed data.
2. Keep one or two fixed historic records only if they are needed for archival test cases.
3. Consider seeding at least one document and one pending leave request that appear in current default views.

Validation after fix:

- Fresh seed data should show meaningful current-week/current-month values without navigation.

## Low Priority Fixes

### 9. Dev startup performs live SMTP verification and emits auth errors on boot

Severity: Low to Medium

What I observed:

- Starting the backend logs `Email service error` immediately because placeholder SMTP credentials are present.

Likely root cause:

- `backend/src/app.ts:20-21` calls `verifyEmailConfig()` on startup for every environment.
- `backend/src/lib/emailService.ts:24-30` attempts a real SMTP verify whenever credentials exist.

Why this matters:

- Dev and test startup become noisy.
- Misconfigured or placeholder secrets generate misleading operational errors.
- Boot should not depend on external SMTP success unless explicitly required.

Recommended fix:

1. Skip SMTP verification in local dev/test by default.
2. Gate it behind an environment flag such as `VERIFY_SMTP_ON_BOOT=true`.
3. Treat placeholder/example credentials as “not configured”.

Validation after fix:

- Local dev startup should be clean unless SMTP verification is explicitly enabled.

### 10. `Documents` role detection is stricter than the rest of the app and may exclude managers from admin-style behavior

Severity: Low

What I found:

- `frontend/src/pages/Documents.tsx:20` treats only `ADMIN` as elevated.
- The rest of the app often groups `ADMIN` and `MANAGER` together for elevated views.

Risk:

- Managers may get an inconsistent experience across pages.

Recommended fix:

1. Decide the intended documents permissions for managers.
2. Encode that policy centrally via a helper rather than ad-hoc page checks.
3. Update tests to reflect the chosen policy.

## Suggested Fix Order

1. Lock down backend auth and user-management routes.
2. Add frontend role guards and split manager/admin navigation.
3. Fix the login page demo credentials.
4. Fix leave-page warning logic.
5. Fix the timesheet mode rendering and add monthly summary UI.
6. Clean up the documents upload handler.
7. Make seed data relative to current date.
8. Repair frontend tests to match the current UI and token format.
9. Make backend tests environment-agnostic.
10. Disable or gate SMTP verification during local dev/test.

## Quick Regression Checklist After Fixes

- Anonymous callers cannot list, create, update, link, or delete users.
- Manager cannot reach `/users`, `/audit-logs`, or `/data-export` unless explicitly intended.
- Admin and manager do not see the leave-link warning.
- Monthly timesheet mode shows one grid only.
- Monthly timesheet mode shows summary metrics.
- Every demo credential shown on the login page is valid.
- Document upload triggers one refresh and one success notification.
- Frontend test suite passes.
- Backend test suite passes on a clean developer machine.
