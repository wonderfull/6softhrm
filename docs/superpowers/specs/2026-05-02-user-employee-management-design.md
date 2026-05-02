# User/Employee Management Design

## Goal

Replace the separate Employees and User Management frontend experiences with one unified **User/Employee Management** screen while keeping `Employee` and `User` as separate linked backend records.

## Role Model

Standardize system roles as:

- `ADMIN`: full system owner.
- `DIRECTOR`: HR/business admin with day-to-day HR management privileges, but not owner-only destructive privileges.
- `OFFICE_ASSISTANT`: support operator who can view employee basics, upload documents, and approve/reject leave and timesheets.
- `EMPLOYEE`: self-service user limited to their own profile, documents, leave, timesheets, and consent.

Legacy roles should be normalized during the transition:

- `MANAGER` maps to `DIRECTOR`.
- `USER` maps to `EMPLOYEE`.

The business identity and system access model remain separate:

- `Employee.employeeType` describes company identity, such as `EMPLOYEE` or `DIRECTOR`.
- `User.role` controls system permissions.

An office assistant is still an employee record. Their typical state is:

- `Employee.jobTitle = "Office Assistant"`
- `Employee.employeeType = "EMPLOYEE"`
- `User.role = "OFFICE_ASSISTANT"`

## Permissions

`ADMIN` can manage all records, assign any role, access settings, audit logs, GDPR exports, and destructive data actions.

`DIRECTOR` can manage employees, linked user accounts, documents, leave, timesheets, projects, sponsorships, and operational HR workflows. Directors cannot assign `ADMIN`, cannot run destructive system-owner actions, and cannot access owner-only settings unless explicitly granted later.

`OFFICE_ASSISTANT` can:

- View employee directory/profile basics.
- Upload documents for employees.
- View/download employee documents needed for admin support.
- Approve/reject leave requests.
- Approve/reject timesheets when the backend supports a timesheet approval state.

`OFFICE_ASSISTANT` cannot:

- Create, edit, or delete core employee records.
- Assign roles.
- Create admin/director accounts.
- Reset passwords.
- View bank details or NI numbers.
- Export GDPR bundles.
- View audit logs.
- Change settings.

`EMPLOYEE` can only access their own linked records.

## Unified Frontend

The `/employees` route becomes the single management surface.

For `ADMIN` and `DIRECTOR`, it is titled **User/Employee Management** and uses a table-first HR operations layout:

- Summary metrics: total people, active logins, missing logins, pending approvals.
- Search and filters: department, system role, account status, employment status.
- Main table: person, job title, department, access role, account status, risk/status, row action.
- Right-side detail drawer: profile summary, account role, permitted actions, restricted actions, and workflow buttons.

For `OFFICE_ASSISTANT`, the same route shows a restricted operations view:

- Employee basics only.
- No bank, NI, role-assignment, password-reset, delete, or employee-edit actions.
- Workflow links/actions for documents, leave, and time.

For `EMPLOYEE`, the route remains **My Profile** and shows only the signed-in employee's own data.

The `/users` route and User Management sidebar item should be removed. Account creation, linking, role assignment, reset actions, and account status should be folded into `/employees`.

## UI/UX Direction

Use a professional, data-dense HR operations console style aligned to the existing Tailwind setup:

- Inter/system font stack.
- Existing blue primary palette and slate surfaces.
- Table-first layout instead of cards for admin people management.
- Right-side drawer for details and sensitive actions.
- Clear text labels and accessible status badges.
- One primary action per area.
- Icon buttons must have accessible labels.
- No emoji icons for operational status.
- No decorative gradients on the management screen.

Sensitive fields such as NI number, bank details, emergency contact address, GDPR exports, and audit logs should not appear in broad list views.

## Backend Shape

Keep the current Prisma schema relationship:

- `User.employeeId` links to `Employee.id`.
- `Employee.user` remains the inverse relation.

Do not merge the database tables. The feature should be implemented through permission helpers, normalized roles, richer employee list data for elevated users, and frontend consolidation.

## Success Criteria

- There is no separate user management screen in navigation.
- Admins and Directors can manage employee records and linked accounts from `/employees`.
- Admins can assign all roles.
- Directors can assign `DIRECTOR`, `OFFICE_ASSISTANT`, and `EMPLOYEE`, but not `ADMIN`.
- Office Assistants can view employee basics, upload documents, and approve/reject leave/time workflows.
- Office Assistants cannot edit employees, assign roles, reset passwords, delete records, view bank/NI data, access GDPR exports, audit logs, or settings.
- Employees retain self-service access to only their own data.
- Backend route protections match frontend affordances.
- Existing `MANAGER` and `USER` records continue to work through role normalization.

## Sponsorship Compliance Expansion

This feature should also introduce an autonomous HRM compliance testing track focused on UK sponsor licence operations. It is not legal advice and must be implemented as operational support based on official GOV.UK guidance that can change over time.

Current guidance anchors verified on 2 May 2026:

- GOV.UK Appendix D record-keeping guidance, version 03/26, valid from 6 March 2026: https://www.gov.uk/government/publications/keep-records-for-sponsorship-appendix-d/workers-and-temporary-workers-guidance-for-sponsors-appendix-d-record-keeping-duties-accessible
- GOV.UK sponsor duties and compliance guidance, last updated 6 March 2026: https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-3-sponsor-duties-and-compliance
- GOV.UK sponsor a worker guidance, which includes reportable delayed-start duties: https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker-accessible
- GOV.UK sponsor compliance visits guidance: https://www.gov.uk/government/publications/points-based-system-sponsor-management/points-based-system-sponsor-compliance-visits-accessible

The system should support, test, and document these compliance themes:

- Sponsorship list and expiry APIs must enforce backend authorization, not rely on frontend route hiding.
- Employees may view only their own linked sponsorship records; unlinked employees must receive an empty result.
- Sponsorship create, update, delete, read/export, compliance evidence, and reportable-event actions must be audit logged.
- GDPR consent writes must be scoped so employees cannot record consent for another employee.
- Retain right-to-work check evidence before sponsored workers start work.
- Retain evidence of date of entry where required.
- Track Appendix D document categories, including recruitment, salary, skill-level, and additional sponsored-worker evidence.
- Track the new Appendix D duty to keep evidence that sponsored workers were made aware of their employment rights in the UK.
- Track sponsorship document retention deadlines: normally throughout sponsorship and until the earlier of one year after sponsorship ends or compliance officer approval, unless another legal requirement requires longer retention.
- Monitor visa/sponsorship/document expiries and produce actionable alerts.
- Support reportable-event workflows, including delayed start after the 28-day period, 10 consecutive working days of unauthorised absence, sponsorship ending, and unpaid leave over 4 weeks where no exception applies.
- Maintain audit trails for sensitive sponsorship and document actions.

## Domain-Rich BDD Regression Suite

The implementation should add a domain-rich BDD regression suite that describes HRM compliance behavior in business language. The suite should sit alongside the existing Jest Cucumber tests in `backend/src/__tests__/features` and `backend/src/__tests__/bdd`.

The BDD suite should include scenarios for:

- Sponsored worker onboarding evidence pack completion.
- Missing right-to-work evidence blocks a compliant sponsorship status.
- Date-of-entry evidence requirement for entry-clearance sponsored workers.
- Employment-rights notification evidence is required for sponsored workers.
- Sponsorship expiry alerts appear before expiry.
- Expired sponsorships are escalated.
- Delayed start reportability after the 28-day period plus 10-working-day reporting window.
- Unauthorised absence reportability after 10 consecutive days.
- Office Assistant can upload compliance documents but cannot edit sponsorship core details.
- Director can manage sponsorship records but cannot perform owner-only actions.
- Employee cannot view another employee's sponsorship or compliance evidence.
- Unlinked employee cannot view expiring sponsorships.
- Employee cannot record GDPR consent for another employee.
- Sponsorship create/update/delete and export actions are audit logged.
- Soft-deleted or inactive employee records are excluded from active operational lists while retained according to policy.

## Autonomous HRM Compliance Tester

Implementation should use an HRM compliance tester agent as a recurring quality gate:

- Before implementation: inspect code and plan for UK sponsorship compliance gaps.
- During implementation: review each sponsorship/compliance task for spec coverage.
- After implementation: run the domain BDD regression suite and produce a compliance-oriented release guide.

The tester should evaluate the product against current official guidance and local behavior. Any legal/regulatory conclusion must cite the source date and official guidance URL.

Tester findings already incorporated into this spec:

- Current sponsorship model is thin CRUD and needs compliance evidence/reportable-event coverage.
- Current sponsorship list and expiring endpoints need backend self-scope/role controls.
- Sponsorship operations need `AuditLog` coverage.
- GDPR consent writes need ownership or elevated-role checks.
- Retention/soft-delete policy is absent and should be planned before real employee sponsorship data is used.

## Implementation Guide Requirement

The implementation must include a user-facing guide after the feature is built. The guide should describe:

- New roles and permissions.
- How to use User/Employee Management.
- How to create/link user accounts.
- How to manage Office Assistant access.
- How to manage sponsorship compliance evidence.
- What alerts and reportable-event workflows mean.
- Which actions are audit logged.
- Known compliance limitations and where an administrator should verify against current GOV.UK guidance.
