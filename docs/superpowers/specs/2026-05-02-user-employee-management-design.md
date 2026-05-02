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
