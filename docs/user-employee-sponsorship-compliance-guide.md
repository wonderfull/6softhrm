# User, Employee, and Sponsorship Compliance Guide

Last updated: 2026-05-02

This guide describes the implemented unified HR management model, role hierarchy, and UK sponsorship compliance workflows.

## Role Hierarchy

The application now uses one normalized role model:

| Role | Typical use | Main permissions |
| --- | --- | --- |
| `ADMIN` | System owner / senior HR admin | Full user, employee, document, leave, time, sponsorship, audit, and GDPR export control. Can assign any role, including `ADMIN`. |
| `DIRECTOR` | Senior operator with admin privileges except owner-only controls | Manage employees, user accounts, documents, leave, time, sponsorships, compliance evidence, and reportable events. Cannot assign or mutate `ADMIN` accounts. |
| `OFFICE_ASSISTANT` | HR support employee with limited administration | View employee records with sensitive fields redacted, operate documents, support leave/time approvals, support sponsorship evidence and reportable-event preparation. Cannot edit core employee records, core sponsorships, admin settings, audit logs, GDPR exports, or roles. |
| `EMPLOYEE` | Normal employee self-service | View own profile, own documents, own leave/time, own linked sponsorship records and compliance pack where applicable. |

Legacy roles are normalized at backend and frontend boundaries:

| Legacy role | Normalized role |
| --- | --- |
| `MANAGER` | `DIRECTOR` |
| `USER` | `EMPLOYEE` |

## Unified User/Employee Management

The former separate User Management screen has been removed from routing and navigation. Admins and directors now manage people and login accounts from one screen: `/employees`.

The unified screen supports:

- Employee record table with a detail panel.
- Linked account status per employee.
- Role badges using normalized roles.
- Create/link employee login accounts.
- Edit linked account role and details.
- Request password reset email.
- Set a temporary password when needed.
- Add, edit, delete, and export employee records for `ADMIN` and `DIRECTOR`.
- Read-only office-assistant view with NI, bank, and other sensitive fields hidden.

Role assignment rules:

- `ADMIN` can assign `ADMIN`, `DIRECTOR`, `OFFICE_ASSISTANT`, and `EMPLOYEE`.
- `DIRECTOR` can assign `DIRECTOR`, `OFFICE_ASSISTANT`, and `EMPLOYEE`.
- `OFFICE_ASSISTANT` and `EMPLOYEE` cannot assign roles.

## Office Assistant Scope

The office assistant is also an employee. Their support permissions are intentionally operational, not ownership-level:

- Can view employee records but not sensitive payroll/identity fields.
- Can upload, view, download, and support documents.
- Can approve/reject leave requests.
- Can support timesheet workflows according to backend permissions.
- Can support sponsorship evidence and create open reportable-event records.
- Cannot delete documents, manage core employee records, manage core sponsorship records, view audit logs, export GDPR data, or mark sponsorship events as reported.

## Sponsorship Compliance

Sponsorship management now includes compliance evidence packs and reportable event tracking. The implementation is based on official GOV.UK sponsor guidance reviewed on 2026-05-02:

- Appendix D record-keeping duties: https://www.gov.uk/government/publications/keep-records-for-sponsorship-appendix-d/workers-and-temporary-workers-guidance-for-sponsors-appendix-d-record-keeping-duties-accessible
- Sponsor duties and compliance: https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-3-sponsor-duties-and-compliance
- Sponsor a worker guidance: https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker-accessible
- Sponsor compliance visits: https://www.gov.uk/government/publications/points-based-system-sponsor-management/points-based-system-sponsor-compliance-visits-accessible

Each sponsorship compliance pack tracks required evidence:

- Right-to-work check.
- Employment rights notification.
- Recruitment evidence.
- Salary evidence.
- Skill-level evidence.

The compliance pack reports:

- Sponsorship summary.
- Employee summary.
- Required evidence rows.
- Complete/missing status per evidence type.
- Existing linked evidence records.
- Missing evidence count.

Evidence upload rules:

- `ADMIN`, `DIRECTOR`, and `OFFICE_ASSISTANT` can add sponsorship compliance evidence.
- Evidence type must be one of the required evidence keys.
- If evidence links to a document, that document must belong to the sponsored employee.
- Evidence creation is audit logged.

## Reportable Events

The sponsorship module now supports open reportable events:

- Delayed start.
- Ten consecutive unauthorised absence days.
- Employment ended.
- Work location changed.
- Unpaid leave over 4 weeks.

Reportable event rules:

- `ADMIN`, `DIRECTOR`, and `OFFICE_ASSISTANT` can create support records for open reportable events.
- `ADMIN` and `DIRECTOR` can mark events as reported after the external SMS/reporting action is complete.
- `OFFICE_ASSISTANT` cannot mark events as reported.
- Reportable-event reads, creates, and reported-status updates are audit logged.

The open-events endpoint also surfaces automatic delayed-start alerts for active sponsorships where the worker has not started within 28 days of the sponsorship start date. The calculated reporting deadline is 10 working days after that 28-day period.

## Navigation Changes

Removed:

- `/users` route.
- User Management sidebar entry.
- `frontend/src/pages/Users.tsx`.

Updated:

- Admin/director sidebar entry is now `User/Employee Management`.
- Office assistant sidebar includes employee, sponsorship, time, leave, document, notification, and settings support routes.
- `/sponsorships` is available to `ADMIN`, `DIRECTOR`, and `OFFICE_ASSISTANT`, with backend permissions still restricting destructive/core actions.

## Audit and Security Notes

The implementation preserves prior security hardening:

- JWT secret handling fails closed.
- Password reset APIs do not expose reset tokens or reset links in API responses.
- Employee self-service access is scoped to the linked employee where applicable.
- Sponsorship list, detail, expiring, compliance, and event endpoints are role-aware.
- GDPR consent creation prevents employees from recording consent for another employee.
- Sensitive actions are audit logged for sponsorship, sponsorship evidence, reportable events, GDPR, and core management flows.

## Deployment Note

Two Prisma migration files were added:

- `20260502120000_add_sponsorship_compliance_evidence`
- `20260502130000_add_sponsorship_reportable_events`

Local verification used Prisma `db push` because `prisma migrate dev` is non-interactive in the agent environment and `prisma migrate deploy` reported existing migration drift on `20260404110000_add_document_share_tokens` with a duplicate `shareToken` state. Resolve that pre-existing migration drift before production migration deploy.
