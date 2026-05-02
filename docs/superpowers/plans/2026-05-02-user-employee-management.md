# User/Employee Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one unified User/Employee Management experience with standardized HRM roles and remove the duplicate User Management frontend.

**Architecture:** Keep `User` and `Employee` as separate Prisma models linked by `User.employeeId`. Add shared role/permission helpers on backend and frontend, normalize legacy roles, then consolidate user-account actions into the `/employees` page with a table and detail drawer UI.

**Tech Stack:** Express, TypeScript, Prisma, Jest, React 18, Vite, Tailwind CSS, Vitest.

**Execution Requirement:** Treat the current uncommitted security hardening as approved baseline. Preserve the fail-closed JWT secret handling, email-only password reset behavior, and new role restrictions, then adapt them to the normalized role model.

**Testing Requirement:** Use strict TDD/BDD. For every behavior change, write a failing Jest, Vitest, or Jest Cucumber test first, run it to verify the expected failure, implement the minimum code, then re-run the test to verify green.

**Compliance Requirement:** Use an HRM compliance tester agent as a quality gate for sponsorship compliance tasks. The tester evaluates UK sponsorship operational coverage, recommends changes, and reviews the BDD regression suite. Compliance guidance must be sourced from official GOV.UK pages and dated.

---

## File Structure

- Create `backend/src/lib/roles.ts`: backend role constants, legacy role normalization, permission helpers, assignable role validation, and sensitive employee redaction helpers.
- Create `backend/src/__tests__/roles.test.ts`: unit tests for role normalization and permission decisions.
- Modify `backend/src/middleware/roles.ts`: use normalized roles in `requireRole`.
- Modify `backend/src/routes/auth.ts`: normalize saved roles, expose user account APIs for admins/directors, restrict admin role assignment, and return normalized roles in auth responses.
- Modify `backend/src/routes/employees.ts`: include linked user account data for admin/director, redact sensitive fields for office assistant, and restrict create/update/delete to admin/director.
- Modify `backend/src/routes/documents.ts`: allow office assistant document view/upload/download, keep deletion and share-link actions admin/director only.
- Modify `backend/src/routes/leave.ts`: allow office assistant to view all leave and approve/reject requests.
- Modify `backend/src/routes/timesheets.ts`: add approval status support if needed by current schema, or restrict existing time edit/delete actions so office assistants can operationally manage approval without full destructive access.
- Modify `backend/src/routes/projects.ts`, `backend/src/routes/sponsorships.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/gdpr.ts`, `backend/src/routes/notifications.ts`: replace `MANAGER`/`USER` checks with normalized role helpers where they control access.
- Create `frontend/src/lib/roles.ts`: frontend role constants, labels, badge styles, permission helpers, and legacy normalization.
- Modify `frontend/src/lib/api.ts`: normalize `getCurrentUser().role` and update `hasRole`.
- Modify `frontend/src/components/ProtectedRoute.tsx`: use normalized role checks.
- Modify `frontend/src/components/Sidebar.tsx`: remove `/users`, rename Employees to User/Employee Management for admin/director, expose support routes for office assistant.
- Modify `frontend/src/pages/Employees.tsx`: replace admin card grid with unified table/detail drawer, account controls, role assignment, and office assistant restricted view.
- Modify `frontend/src/main.tsx`: remove `/users` route and update protected route role lists to new roles.
- Modify or delete `frontend/src/pages/Users.tsx`: remove from routing; leave deleted if no imports remain.
- Update frontend tests or add `frontend/src/__tests__/Employees.management.test.tsx`: verify role-aware UI actions.
- Update backend route tests for auth, employees, documents, and leave.
- Create `backend/src/__tests__/features/sponsorship-compliance.feature`: domain BDD scenarios for UK sponsor compliance workflows.
- Create `backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts`: Jest Cucumber bindings for sponsorship compliance scenarios.
- Modify `backend/prisma/schema.prisma`: add sponsorship compliance evidence/reporting models if the implementation selects persisted compliance workflows.
- Modify `backend/src/routes/sponsorships.ts`: add compliance evidence pack, reportable-event, expiry-risk, and role-aware access behavior.
- Modify `backend/src/routes/gdpr.ts`: prevent employees from recording consent for another employee.
- Modify `backend/src/middleware/audit.ts` or route-level audit calls: ensure sponsorship and compliance actions are audit logged.
- Modify `frontend/src/pages/Sponsorships.tsx`: add compliance evidence status, alerts, and reportable-event workflow UI.
- Create `docs/user-employee-sponsorship-compliance-guide.md`: user/admin guide for implemented roles, unified management, and sponsorship compliance features.

---

## Recommended Execution Order

Implement in this order to keep security and compliance risk controlled:

1. Task 1: Backend Role Model.
2. Task 2: Backend Account and Employee API Consolidation.
3. Task 3: Backend Operational Permissions.
4. Task 8: HRM Compliance Tester Agent Gate.
5. Task 13: P0 Sponsorship, GDPR, and Audit Hardening.
6. Task 9: Sponsorship Compliance Domain Model.
7. Task 10: Sponsorship Compliance API.
8. Task 11: Reportable Events and Compliance Alerts.
9. Task 4: Frontend Role Helpers and Navigation Cleanup.
10. Task 5: Unified Employees Page UI.
11. Task 6: Remove Deprecated User Management Screen.
12. Task 12: Feature Guide and Compliance Release Notes.
13. Task 7: Full Verification.

---

### Task 1: Backend Role Model

**Files:**
- Create: `backend/src/lib/roles.ts`
- Create: `backend/src/__tests__/roles.test.ts`
- Modify: `backend/src/middleware/roles.ts`

- [ ] **Step 1: Write the failing backend role tests**

Create `backend/src/__tests__/roles.test.ts`:

```ts
import {
  canAssignRole,
  canManageEmployeeRecords,
  canOperateDocuments,
  canReviewLeaveAndTime,
  canViewSensitiveEmployeeFields,
  normalizeRole,
} from '../lib/roles'

describe('role helpers', () => {
  it.each([
    ['ADMIN', 'ADMIN'],
    ['DIRECTOR', 'DIRECTOR'],
    ['OFFICE_ASSISTANT', 'OFFICE_ASSISTANT'],
    ['EMPLOYEE', 'EMPLOYEE'],
    ['MANAGER', 'DIRECTOR'],
    ['USER', 'EMPLOYEE'],
    [undefined, 'EMPLOYEE'],
    ['', 'EMPLOYEE'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeRole(input)).toBe(expected)
  })

  it('keeps ADMIN as the only role that can assign ADMIN', () => {
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(true)
    expect(canAssignRole('DIRECTOR', 'ADMIN')).toBe(false)
    expect(canAssignRole('OFFICE_ASSISTANT', 'ADMIN')).toBe(false)
    expect(canAssignRole('EMPLOYEE', 'ADMIN')).toBe(false)
  })

  it('allows directors to assign non-owner roles', () => {
    expect(canAssignRole('DIRECTOR', 'DIRECTOR')).toBe(true)
    expect(canAssignRole('DIRECTOR', 'OFFICE_ASSISTANT')).toBe(true)
    expect(canAssignRole('DIRECTOR', 'EMPLOYEE')).toBe(true)
  })

  it('separates HR management from office support', () => {
    expect(canManageEmployeeRecords('ADMIN')).toBe(true)
    expect(canManageEmployeeRecords('DIRECTOR')).toBe(true)
    expect(canManageEmployeeRecords('OFFICE_ASSISTANT')).toBe(false)
    expect(canManageEmployeeRecords('EMPLOYEE')).toBe(false)
  })

  it('allows office assistants to operate documents and review leave/time', () => {
    expect(canOperateDocuments('OFFICE_ASSISTANT')).toBe(true)
    expect(canReviewLeaveAndTime('OFFICE_ASSISTANT')).toBe(true)
    expect(canViewSensitiveEmployeeFields('OFFICE_ASSISTANT')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm --prefix backend run test -- roles.test.ts
```

Expected: fail because `backend/src/lib/roles.ts` does not exist.

- [ ] **Step 3: Implement backend role helpers**

Create `backend/src/lib/roles.ts`:

```ts
export const ROLES = {
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  OFFICE_ASSISTANT: 'OFFICE_ASSISTANT',
  EMPLOYEE: 'EMPLOYEE',
} as const

export type AppRole = (typeof ROLES)[keyof typeof ROLES]

const LEGACY_ROLE_MAP: Record<string, AppRole> = {
  MANAGER: ROLES.DIRECTOR,
  USER: ROLES.EMPLOYEE,
}

export function normalizeRole(role: unknown): AppRole {
  if (typeof role !== 'string' || role.trim() === '') return ROLES.EMPLOYEE
  const upperRole = role.trim().toUpperCase()
  if (upperRole in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[upperRole]
  if (Object.values(ROLES).includes(upperRole as AppRole)) return upperRole as AppRole
  return ROLES.EMPLOYEE
}

export function isOwnerRole(role: unknown) {
  return normalizeRole(role) === ROLES.ADMIN
}

export function isHrAdminRole(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === ROLES.ADMIN || normalizedRole === ROLES.DIRECTOR
}

export function canManageEmployeeRecords(role: unknown) {
  return isHrAdminRole(role)
}

export function canManageUserAccounts(role: unknown) {
  return isHrAdminRole(role)
}

export function canAssignRole(actorRole: unknown, targetRole: unknown) {
  const actor = normalizeRole(actorRole)
  const target = normalizeRole(targetRole)
  if (actor === ROLES.ADMIN) return true
  if (actor === ROLES.DIRECTOR) return target !== ROLES.ADMIN
  return false
}

export function canOperateDocuments(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === ROLES.ADMIN
    || normalizedRole === ROLES.DIRECTOR
    || normalizedRole === ROLES.OFFICE_ASSISTANT
}

export function canDeleteDocuments(role: unknown) {
  return isHrAdminRole(role)
}

export function canReviewLeaveAndTime(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === ROLES.ADMIN
    || normalizedRole === ROLES.DIRECTOR
    || normalizedRole === ROLES.OFFICE_ASSISTANT
}

export function canViewSensitiveEmployeeFields(role: unknown) {
  return isHrAdminRole(role)
}

export function canAccessOwnerSettings(role: unknown) {
  return isOwnerRole(role)
}

export function requireAssignableRole(actorRole: unknown, targetRole: unknown) {
  if (!canAssignRole(actorRole, targetRole)) {
    throw new Error('You do not have permission to assign that role')
  }
  return normalizeRole(targetRole)
}
```

- [ ] **Step 4: Normalize route middleware role checks**

Modify `backend/src/middleware/roles.ts`:

```ts
import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import { normalizeRole } from '../lib/roles'

export function requireRole(...roles: string[]) {
  const allowedRoles = roles.map(normalizeRole)

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) return res.status(401).json({ error: 'unauthorized' })

    const normalizedRole = normalizeRole(user.role)
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(403).json({ error: 'forbidden' })
    }

    req.user = { ...user, role: normalizedRole }
    next()
  }
}
```

- [ ] **Step 5: Run backend role tests**

Run:

```bash
npm --prefix backend run test -- roles.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit role helpers**

```bash
git add backend/src/lib/roles.ts backend/src/__tests__/roles.test.ts backend/src/middleware/roles.ts
git commit -m "feat: add normalized HRM role helpers"
```

---

### Task 2: Backend Account and Employee API Consolidation

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/routes/employees.ts`
- Test: `backend/src/__tests__/employees.security.test.ts`

- [ ] **Step 1: Add tests for account and employee permissions**

Extend or create `backend/src/__tests__/employees.security.test.ts` with these cases:

```ts
describe('user employee management permissions', () => {
  it('allows admins to assign ADMIN, DIRECTOR, OFFICE_ASSISTANT, and EMPLOYEE roles', async () => {
    // Use the existing auth test helpers in this repo to create an ADMIN token.
    // Assert PUT /api/auth/users/:id accepts each role and returns the normalized role.
  })

  it('prevents directors from assigning ADMIN', async () => {
    // Create a DIRECTOR token and PUT /api/auth/users/:id with role ADMIN.
    // Expected: 403 with an assignment permission error.
  })

  it('redacts sensitive employee fields for office assistant list access', async () => {
    // Create an OFFICE_ASSISTANT token and GET /api/employees.
    // Expected: employee basics exist; niNumber, bankName, accountNumber, sortCode,
    // emergencyContactAddress are null or omitted.
  })

  it('prevents office assistants from creating, editing, or deleting employees', async () => {
    // POST /api/employees, PUT /api/employees/:id, DELETE /api/employees/:id.
    // Expected: 403 for all three.
  })
})
```

Use the concrete test setup style already present in `backend/src/__tests__/documents.test.ts` and `backend/src/__tests__/bdd/auth.feature.test.ts`.

- [ ] **Step 2: Run the failing employee/account tests**

Run:

```bash
npm --prefix backend run test -- employees.security.test.ts
```

Expected: fail until routes use the new helpers.

- [ ] **Step 3: Normalize auth register/login responses**

Modify `backend/src/routes/auth.ts` imports:

```ts
import {
  canManageUserAccounts,
  normalizeRole,
  requireAssignableRole,
  ROLES,
} from '../lib/roles'
```

In `/register`, save only normalized roles:

```ts
const requester = getOptionalUser(req)
const requesterRole = normalizeRole(requester?.role)
const requestedRole = normalizeRole(role)
const assignedRole = canManageUserAccounts(requesterRole)
  ? requireAssignableRole(requesterRole, requestedRole)
  : ROLES.EMPLOYEE

const userData: any = {
  email,
  password: hashed,
  name,
  role: assignedRole,
}
```

In `/login`, normalize before signing:

```ts
const role = normalizeRole(user.role)
const token = jwt.sign({
  id: user.id,
  email: user.email,
  role,
  employeeId: user.employeeId
}, secret, { expiresIn: '8h' })
```

Return `role` in the JSON user body.

- [ ] **Step 4: Allow admin/director account APIs with role assignment guard**

Change `/auth/users`, `/auth/users/:id`, reset-link, reset-password, and delete user guards from `requireRole('ADMIN')` to `requireRole('ADMIN', 'DIRECTOR')` only where appropriate.

Keep these owner-only:

```ts
// Only ADMIN can assign ADMIN or delete another ADMIN account.
// DIRECTOR can manage DIRECTOR, OFFICE_ASSISTANT, and EMPLOYEE accounts.
```

In `PUT /auth/users/:id`, fetch the existing target user first, normalize the incoming role, and reject invalid assignment:

```ts
const requesterRole = normalizeRole((req as any).user?.role)
const targetRole = normalizeRole(role)
const normalizedRole = requireAssignableRole(requesterRole, targetRole)
const data: any = { email, name, role: normalizedRole }
```

If the target existing role is `ADMIN` and requester is not `ADMIN`, return `403`.

- [ ] **Step 5: Include linked user account data in elevated employee list**

Modify the elevated `prisma.employee.findMany` in `backend/src/routes/employees.ts`:

```ts
const employees = await prisma.employee.findMany({
  include: {
    sponsorships: true,
    documents: true,
    user: {
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        employeeId: true,
        createdAt: true,
      },
    },
  },
})
```

Normalize `emp.user.role` before returning.

- [ ] **Step 6: Redact sensitive fields for office assistant**

Add a local helper in `backend/src/routes/employees.ts`:

```ts
function redactSensitiveEmployeeFields(employee: any) {
  return {
    ...employee,
    niNumber: null,
    bankName: null,
    accountNumber: null,
    sortCode: null,
    emergencyContactAddress: null,
  }
}
```

For `OFFICE_ASSISTANT`, return all employees with this redaction and without consent summaries that imply GDPR detail. For `EMPLOYEE`, keep own-record behavior.

- [ ] **Step 7: Restrict employee create/update/delete**

Change create/update/delete guards to:

```ts
router.post('/', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
```

Apply the same guard to `PUT /:id` and `DELETE /:id`.

- [ ] **Step 8: Run focused backend tests**

Run:

```bash
npm --prefix backend run test -- employees.security.test.ts roles.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit account and employee API changes**

```bash
git add backend/src/routes/auth.ts backend/src/routes/employees.ts backend/src/__tests__/employees.security.test.ts
git commit -m "feat: consolidate employee account permissions"
```

---

### Task 3: Backend Operational Permissions

**Files:**
- Modify: `backend/src/routes/documents.ts`
- Modify: `backend/src/routes/leave.ts`
- Modify: `backend/src/routes/timesheets.ts`
- Modify: other backend routes with `MANAGER`/`USER` checks.
- Test: `backend/src/__tests__/documents.test.ts`

- [ ] **Step 1: Add document permission tests**

In `backend/src/__tests__/documents.test.ts`, add or update cases:

```ts
it('allows office assistants to upload documents for employees', async () => {
  // POST /api/documents/upload with OFFICE_ASSISTANT token and valid file.
  // Expected: 200 and document record.
})

it('prevents office assistants from deleting documents', async () => {
  // DELETE /api/documents/:id with OFFICE_ASSISTANT token.
  // Expected: 403.
})

it('allows office assistants to download employee documents', async () => {
  // GET /api/documents/:id/file with OFFICE_ASSISTANT token.
  // Expected: 200 or mocked download success.
})
```

- [ ] **Step 2: Run failing document tests**

Run:

```bash
npm --prefix backend run test -- documents.test.ts
```

Expected: fail because `OFFICE_ASSISTANT` is not yet included.

- [ ] **Step 3: Update document permissions**

Modify `backend/src/routes/documents.ts` imports:

```ts
import {
  canDeleteDocuments,
  canOperateDocuments,
  canReviewLeaveAndTime,
  normalizeRole,
  ROLES,
} from '../lib/roles'
```

Change `canAccessDocument`:

```ts
function canAccessDocument(user: any, employeeId: number) {
  if (!user) return false
  const role = normalizeRole(user.role)
  if (canOperateDocuments(role)) return true
  return role === ROLES.EMPLOYEE && user.employeeId === employeeId
}
```

Change upload guards:

```ts
router.post('/upload', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), upload.single('file'), async (req, res) => {
```

In `upload-payslips`, replace the manual role check:

```ts
if (!canOperateDocuments(req.user?.role)) {
  return res.status(403).json({ error: 'Unauthorized' })
}
```

Keep share-link and delete restricted:

```ts
router.post('/:id/share-link', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
```

In `DELETE /:id`, reject office assistant:

```ts
if (!canDeleteDocuments(user.role) && normalizeRole(user.role) !== ROLES.EMPLOYEE) {
  return res.status(403).json({ error: 'Unauthorized' })
}
```

Then keep the employee ownership check for employees.

- [ ] **Step 4: Update leave permissions**

Modify `backend/src/routes/leave.ts`:

```ts
import { canReviewLeaveAndTime, normalizeRole, ROLES } from '../lib/roles'
```

Use normalized employee self-service checks:

```ts
const role = normalizeRole(user.role)
if (role === ROLES.EMPLOYEE) {
```

Notify all operational approvers:

```ts
where: { role: { in: ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'] } }
```

Change approval guards:

```ts
router.put('/:id/approve', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
```

Apply the same to reject.

- [ ] **Step 5: Update timesheet access**

In `backend/src/routes/timesheets.ts`, import `normalizeRole`, `ROLES`, and `canReviewLeaveAndTime`.

Use normalized checks:

```ts
const role = normalizeRole(user.role)
if (role === ROLES.EMPLOYEE && user.employeeId) {
```

For create/update/delete:

- `EMPLOYEE` can create/update only their own time.
- `OFFICE_ASSISTANT` can update review/status fields if a status exists.
- `ADMIN` and `DIRECTOR` can manage all time records.

If the current schema has no timesheet status field, do not invent UI-only approval. Add a separate migration task before implementing approve/reject timesheets.

- [ ] **Step 6: Replace legacy backend role checks**

Search:

```bash
rg -n "'MANAGER'|'USER'|role ===|role: \\{ in:" backend/src
```

For every access-control branch, replace direct string checks with helpers from `backend/src/lib/roles.ts`. Keep data labels unchanged where they are not permissions.

- [ ] **Step 7: Run backend test suite**

Run:

```bash
npm --prefix backend run test
```

Expected: pass.

- [ ] **Step 8: Commit operational permission changes**

```bash
git add backend/src/routes backend/src/__tests__
git commit -m "feat: apply operational role permissions"
```

---

### Task 4: Frontend Role Helpers and Navigation Cleanup

**Files:**
- Create: `frontend/src/lib/roles.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create frontend role helpers**

Create `frontend/src/lib/roles.ts`:

```ts
export const ROLES = {
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  OFFICE_ASSISTANT: 'OFFICE_ASSISTANT',
  EMPLOYEE: 'EMPLOYEE',
} as const

export type AppRole = (typeof ROLES)[keyof typeof ROLES]

const legacyRoleMap: Record<string, AppRole> = {
  MANAGER: ROLES.DIRECTOR,
  USER: ROLES.EMPLOYEE,
}

export function normalizeRole(role: unknown): AppRole {
  if (typeof role !== 'string' || role.trim() === '') return ROLES.EMPLOYEE
  const upperRole = role.trim().toUpperCase()
  if (upperRole in legacyRoleMap) return legacyRoleMap[upperRole]
  if (Object.values(ROLES).includes(upperRole as AppRole)) return upperRole as AppRole
  return ROLES.EMPLOYEE
}

export function hasAnyRole(user: any, roles: string[]) {
  if (!user) return false
  const normalizedRole = normalizeRole(user.role)
  return roles.map(normalizeRole).includes(normalizedRole)
}

export function canManagePeople(user: any) {
  return hasAnyRole(user, [ROLES.ADMIN, ROLES.DIRECTOR])
}

export function canSupportOperations(user: any) {
  return hasAnyRole(user, [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.OFFICE_ASSISTANT])
}

export function canAssignAdmin(user: any) {
  return hasAnyRole(user, [ROLES.ADMIN])
}

export function roleLabel(role: unknown) {
  const normalizedRole = normalizeRole(role)
  return {
    ADMIN: 'Admin',
    DIRECTOR: 'Director',
    OFFICE_ASSISTANT: 'Office Assistant',
    EMPLOYEE: 'Employee',
  }[normalizedRole]
}
```

- [ ] **Step 2: Normalize current user and route checks**

Modify `frontend/src/lib/api.ts`:

```ts
import { hasAnyRole, normalizeRole } from './roles'
```

Update `getCurrentUser`:

```ts
const user = parseJwtPayload(token)
return user ? { ...user, role: normalizeRole(user.role) } : null
```

Update `hasRole`:

```ts
export function hasRole(user: any, ...roles: string[]) {
  return hasAnyRole(user, roles)
}
```

- [ ] **Step 3: Update protected routes**

Modify `frontend/src/components/ProtectedRoute.tsx`:

```ts
import { hasAnyRole } from '../lib/roles'
```

Replace:

```ts
if (!user || !allowedRoles.includes(user.role)) {
```

With:

```ts
if (!user || !hasAnyRole(user, allowedRoles)) {
```

- [ ] **Step 4: Remove duplicate Users route**

Modify `frontend/src/main.tsx`:

- Remove `import Users from './pages/Users'`.
- Remove `<Route path="/users" ... />`.
- Replace `MANAGER` in protected route lists with `DIRECTOR`.
- Add `OFFICE_ASSISTANT` to documents, leave, and time access where route-level protection exists.

- [ ] **Step 5: Update sidebar menus**

Modify `frontend/src/components/Sidebar.tsx`:

- Remove `/users` from `adminMenu`.
- Rename admin/director `/employees` label to `User/Employee Management`.
- Replace `managerMenu` with `directorMenu`.
- Add `officeAssistantMenu` with Dashboard, User/Employee Management, Time, Leave, Documents, Notifications if appropriate.
- Use normalized role from `getCurrentUser()`.

- [ ] **Step 6: Run frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: pass with no missing `Users` import.

- [ ] **Step 7: Commit frontend role/navigation cleanup**

```bash
git add frontend/src/lib/roles.ts frontend/src/lib/api.ts frontend/src/components/ProtectedRoute.tsx frontend/src/components/Sidebar.tsx frontend/src/main.tsx
git commit -m "feat: normalize frontend roles and remove users route"
```

---

### Task 5: Unified Employees Page UI

**Files:**
- Modify: `frontend/src/pages/Employees.tsx`
- Optional Create: `frontend/src/components/RoleBadge.tsx`
- Optional Create: `frontend/src/components/AccountStatusBadge.tsx`
- Test: `frontend/src/__tests__/Employees.management.test.tsx`

- [ ] **Step 1: Write frontend behavior tests**

Create `frontend/src/__tests__/Employees.management.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Employees from '../pages/Employees'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<any>('../lib/api')
  return {
    ...actual,
    apiGet: vi.fn((path: string) => {
      if (path === '/employees') {
        return Promise.resolve([
          {
            id: 1,
            firstName: 'Sarah',
            lastName: 'Khan',
            email: 'sarah@6soft.co.uk',
            jobTitle: 'Office Assistant',
            department: 'Operations',
            employeeType: 'EMPLOYEE',
            user: {
              id: 10,
              email: 'sarah@6soft.co.uk',
              role: 'OFFICE_ASSISTANT',
            },
          },
        ])
      }
      if (path === '/auth/users') return Promise.resolve([])
      return Promise.resolve([])
    }),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    getCurrentUser: vi.fn(() => ({ role: 'ADMIN', email: 'admin@6soft.co.uk' })),
  }
})

describe('Employees management screen', () => {
  it('renders unified management title for admins', async () => {
    render(<Employees />)
    expect(await screen.findByText('User/Employee Management')).toBeInTheDocument()
    expect(await screen.findByText('Sarah Khan')).toBeInTheDocument()
    expect(await screen.findByText('Office Assistant')).toBeInTheDocument()
  })

  it('does not expose sensitive fields in the people table', async () => {
    render(<Employees />)
    expect(await screen.findByText('Sarah Khan')).toBeInTheDocument()
    expect(screen.queryByText(/NI:/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Bank Details/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run failing frontend test**

Run:

```bash
npm --prefix frontend run test -- Employees.management.test.tsx
```

Expected: fail until `Employees.tsx` is refactored.

- [ ] **Step 3: Refactor page state**

In `frontend/src/pages/Employees.tsx`, replace the current `userRole`/`userEmail` token parsing with:

```ts
const currentUser = getCurrentUser()
const isPeopleManager = canManagePeople(currentUser)
const isOperationsSupport = canSupportOperations(currentUser)
const isEmployeeSelfService = normalizeRole(currentUser?.role) === ROLES.EMPLOYEE
```

Keep employee form state for add/edit, and add:

```ts
const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<number | null>(null)
const [accountFormOpen, setAccountFormOpen] = React.useState(false)
const [accountRole, setAccountRole] = React.useState('EMPLOYEE')
const [temporaryPassword, setTemporaryPassword] = React.useState('')
```

- [ ] **Step 4: Replace admin card grid with table/detail drawer**

Implement the elevated view using the v3 mockup structure:

- Header: `User/Employee Management`
- Summary cards: total people, active logins, missing login, pending reviews
- Filter row: search, department, role, account status
- Table columns: person, department, access role, account, risk/status, action
- Drawer: selected employee summary, account status, permissions, workflow buttons

Use Tailwind classes matching existing design:

```tsx
<div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
```

Do not render NI, bank, or emergency address in the table.

- [ ] **Step 5: Add account actions in the drawer**

For `ADMIN` and `DIRECTOR`, show:

- Create Login when `employee.user` is missing.
- Change Role when `employee.user` exists.
- Reset Link and Temporary Password when allowed.
- Edit Employee for admin/director only.

For `DIRECTOR`, hide `ADMIN` from role options.

For `OFFICE_ASSISTANT`, show only:

- View Read-Only Profile
- Open Documents
- Review Leave
- Review Timesheets

- [ ] **Step 6: Wire account API actions**

Move the existing logic from `frontend/src/pages/Users.tsx` into `Employees.tsx`:

- `generateTemporaryPassword`
- create user from employee
- reset link
- set temporary password
- update role

Use existing endpoints:

```ts
apiPost('/auth/register', { email, password, name, role })
apiPut(`/auth/users/${userId}`, { email, name, role, employeeId })
apiPost(`/auth/users/${userId}/reset-link`)
apiPost(`/auth/users/${userId}/reset-password`, { newPassword })
```

- [ ] **Step 7: Keep employee self-service view**

For `EMPLOYEE`, keep the My Profile view, but ensure it uses normalized role checks and only renders the signed-in employee's own data.

- [ ] **Step 8: Run frontend tests and build**

Run:

```bash
npm --prefix frontend run test -- Employees.management.test.tsx
npm --prefix frontend run build
```

Expected: both pass.

- [ ] **Step 9: Commit unified employees UI**

```bash
git add frontend/src/pages/Employees.tsx frontend/src/__tests__/Employees.management.test.tsx
git commit -m "feat: unify user and employee management UI"
```

---

### Task 6: Remove Deprecated User Management Screen

**Files:**
- Delete or leave unused: `frontend/src/pages/Users.tsx`
- Modify: frontend tests/imports if any reference Users.
- Search all frontend links and labels.

- [ ] **Step 1: Search for stale users route references**

Run:

```bash
rg -n '"/users"|/users|User Management|Users' frontend/src
```

Expected: references remain before cleanup.

- [ ] **Step 2: Remove stale frontend references**

Delete `frontend/src/pages/Users.tsx` if no import remains.

Replace text references:

- `User Management` -> `User/Employee Management`
- `Create real employee access from the Users page` -> `Create employee access from User/Employee Management`

- [ ] **Step 3: Verify no stale route references**

Run:

```bash
rg -n '"/users"|/users|User Management|Users' frontend/src
```

Expected: no route/navigation references. It is acceptable for backend `/auth/users` API strings to remain inside `Employees.tsx`.

- [ ] **Step 4: Run frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: pass.

- [ ] **Step 5: Commit removal**

```bash
git add frontend/src
git add -u frontend/src/pages/Users.tsx
git commit -m "refactor: remove duplicate user management screen"
```

---

### Task 7: Full Verification

**Files:**
- No planned code changes unless verification exposes defects.

- [ ] **Step 1: Run backend tests**

Run:

```bash
npm --prefix backend run test
```

Expected: pass.

- [ ] **Step 2: Run backend build**

Run:

```bash
npm --prefix backend run build
```

Expected: pass.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
npm --prefix frontend run test -- --run
```

Expected: pass.

- [ ] **Step 4: Run frontend build**

Run:

```bash
npm --prefix frontend run build
```

Expected: pass.

- [ ] **Step 5: Manual browser QA**

Run:

```bash
npm run dev:all
```

Open `http://localhost:5173`.

Verify:

- Admin sees `User/Employee Management`.
- Sidebar has no separate `User Management`.
- Admin can create employee, create login, assign all roles, reset password.
- Director can manage employees/accounts but cannot assign Admin.
- Office Assistant can view employee basics, upload documents, approve/reject leave/time, and cannot edit employees or roles.
- Employee sees only `My Profile` and own records.

- [ ] **Step 6: Commit verification fixes if needed**

If verification required fixes:

```bash
git add <fixed-files>
git commit -m "fix: address user employee management verification issues"
```

If no fixes were needed, do not create an empty commit.

---

### Task 8: HRM Compliance Tester Agent Gate

**Files:**
- Modify: `docs/superpowers/specs/2026-05-02-user-employee-management-design.md`
- Modify: `docs/superpowers/plans/2026-05-02-user-employee-management.md`

- [ ] **Step 1: Dispatch HRM compliance tester before code changes**

Dispatch a fresh explorer agent with this prompt:

```text
You are an HRM system tester specializing in UK sponsor licence compliance.
Inspect /Users/kirankumarmanne/Documents/work/6softHRM.
Do not edit files.
Evaluate sponsorship module coverage, GDPR/audit risks, role permissions, and BDD regression needs.
Treat existing uncommitted security hardening as approved baseline.
Return findings, recommended features, BDD scenarios, and implementation-plan changes.
When citing compliance duties, use official GOV.UK guidance URLs and dates.
```

- [ ] **Step 2: Verify official guidance anchors**

Use official GOV.UK sources only for compliance facts:

```text
Appendix D record-keeping duties:
https://www.gov.uk/government/publications/keep-records-for-sponsorship-appendix-d/workers-and-temporary-workers-guidance-for-sponsors-appendix-d-record-keeping-duties-accessible

Sponsor duties and compliance:
https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-3-sponsor-duties-and-compliance

Sponsor a worker:
https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker-accessible

Sponsor compliance visits:
https://www.gov.uk/government/publications/points-based-system-sponsor-management/points-based-system-sponsor-compliance-visits-accessible
```

Document the checked date in the spec and release guide.

- [ ] **Step 3: Fold tester findings into plan**

Update this plan before implementation if the tester finds missing sponsorship compliance coverage.

- [ ] **Step 4: Commit plan/spec updates**

```bash
git add docs/superpowers/specs/2026-05-02-user-employee-management-design.md docs/superpowers/plans/2026-05-02-user-employee-management.md
git commit -m "docs: expand plan for sponsorship compliance testing"
```

---

### Task 9: Sponsorship Compliance Domain Model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/__tests__/features/sponsorship-compliance.feature`
- Create: `backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts`
- Modify: `backend/src/__tests__/bdd/helpers/fixtures.ts`

- [ ] **Step 1: Write BDD feature for compliance evidence packs**

Create `backend/src/__tests__/features/sponsorship-compliance.feature`:

```gherkin
Feature: Sponsorship compliance evidence
  As a sponsor licence holder
  I want to track required sponsorship evidence and reportable events
  So that sponsored worker records are inspection-ready

  Scenario: Sponsored worker evidence pack is incomplete without right to work evidence
    Given a sponsored worker has an active Skilled Worker sponsorship
    And no right to work evidence has been uploaded
    When an admin reviews the sponsorship compliance status
    Then the evidence pack is marked incomplete
    And the missing item list includes "Right to work check evidence"

  Scenario: Sponsored worker evidence pack includes employment rights notification evidence
    Given a sponsored worker has an active Skilled Worker sponsorship
    And right to work evidence has been uploaded
    And evidence of UK employment rights notification has been uploaded
    When a director reviews the sponsorship compliance status
    Then the evidence pack includes "Employment rights notification"

  Scenario: Office assistant can upload compliance evidence but cannot edit sponsorship core details
    Given an office assistant is signed in
    And a sponsored worker has an active sponsorship
    When the office assistant uploads right to work evidence
    Then the upload is accepted
    When the office assistant changes the sponsorship visa type
    Then the change is rejected
```

- [ ] **Step 2: Write failing BDD step bindings**

Create `backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts` using the existing `jest-cucumber` pattern:

```ts
import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import {
  authHeader,
  cleanupFixturePrefix,
  createEmployee,
  createSponsorship,
  uniquePrefix,
} from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/sponsorship-compliance.feature'))

defineFeature(feature, (test) => {
  let prefix = ''
  let employee: any
  let sponsorship: any
  let response: request.Response

  beforeEach(() => {
    prefix = uniquePrefix('sponsorship-compliance')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  test('Sponsored worker evidence pack is incomplete without right to work evidence', ({ given, and, when, then }) => {
    given('a sponsored worker has an active Skilled Worker sponsorship', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.worker@example.com` })
      sponsorship = await createSponsorship(employee.id, { visaType: 'Skilled Worker' })
    })

    and('no right to work evidence has been uploaded', () => undefined)

    when('an admin reviews the sponsorship compliance status', async () => {
      response = await request(app)
        .get(`/api/sponsorships/${sponsorship.id}/compliance`)
        .set('Authorization', authHeader({ id: 1, email: `${prefix}.admin@example.com`, role: 'ADMIN' }))
    })

    then('the evidence pack is marked incomplete', () => {
      expect(response.status).toBe(200)
      expect(response.body.status).toBe('INCOMPLETE')
    })

    and('the missing item list includes "Right to work check evidence"', () => {
      expect(response.body.missingItems).toContain('Right to work check evidence')
    })
  })
})
```

Add the remaining scenarios in the same file as separate `test(...)` blocks before implementing production code.

- [ ] **Step 3: Run BDD test and verify red**

Run:

```bash
npm --prefix backend run test -- sponsorship-compliance.feature.test.ts
```

Expected: fail because `/api/sponsorships/:id/compliance` does not exist.

- [ ] **Step 4: Add persistence for sponsorship evidence**

Modify `backend/prisma/schema.prisma`:

```prisma
model SponsorshipComplianceEvidence {
  id            Int         @id @default(autoincrement())
  sponsorship   Sponsorship @relation(fields: [sponsorshipId], references: [id], onDelete: Cascade)
  sponsorshipId Int
  document      Document?   @relation(fields: [documentId], references: [id])
  documentId    Int?
  evidenceType  String
  notes         String?     @db.Text
  verifiedAt    DateTime?
  verifiedBy    Int?
  createdAt     DateTime    @default(now())
}
```

Also add to `Sponsorship`:

```prisma
complianceEvidence SponsorshipComplianceEvidence[]
```

Also add to `Document`:

```prisma
sponsorshipComplianceEvidence SponsorshipComplianceEvidence[]
```

- [ ] **Step 5: Run Prisma migration**

Run:

```bash
npm --prefix backend run prisma:migrate -- --name add_sponsorship_compliance_evidence
npm --prefix backend run prisma:generate
```

Expected: migration succeeds and Prisma client regenerates.

- [ ] **Step 6: Commit model and red BDD scaffold**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/__tests__/features/sponsorship-compliance.feature backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts backend/src/__tests__/bdd/helpers/fixtures.ts
git commit -m "test: add sponsorship compliance BDD scaffold"
```

---

### Task 13: P0 Sponsorship, GDPR, and Audit Hardening

**Files:**
- Modify: `backend/src/routes/sponsorships.ts`
- Modify: `backend/src/routes/documents.ts`
- Modify: `backend/src/routes/gdpr.ts`
- Modify: `backend/src/lib/roles.ts`
- Create: `backend/src/__tests__/features/sponsorships.feature`
- Create: `backend/src/__tests__/bdd/sponsorships.feature.test.ts`
- Modify: `backend/src/__tests__/features/gdpr.feature`
- Modify: `backend/src/__tests__/bdd/gdpr.feature.test.ts`

- [ ] **Step 1: Write BDD feature for sponsorship access control**

Create `backend/src/__tests__/features/sponsorships.feature`:

```gherkin
Feature: Sponsorship access control
  As an HRM system owner
  I want sponsorship records protected by backend authorization
  So that sponsored worker details are not exposed to unauthorised users

  Scenario: Employee cannot list all sponsorships
    Given another employee has an active sponsorship
    And a linked employee is signed in
    When the linked employee lists sponsorships
    Then no other employee sponsorships are returned

  Scenario: Unlinked employee cannot view expiring sponsorships
    Given another employee has a sponsorship expiring soon
    And an unlinked employee user is signed in
    When the unlinked employee views expiring sponsorships
    Then no expiring sponsorships are returned

  Scenario: Director can manage sponsorships
    Given a director is signed in
    And an employee exists
    When the director creates a sponsorship for that employee
    Then the sponsorship is created
    And an audit log records the sponsorship creation

  Scenario: Office assistant cannot edit sponsorship core details
    Given an office assistant is signed in
    And an employee has an active sponsorship
    When the office assistant updates the sponsorship visa type
    Then the request is forbidden
```

- [ ] **Step 2: Write failing sponsorship BDD bindings**

Create `backend/src/__tests__/bdd/sponsorships.feature.test.ts`:

```ts
import path from 'path'
import { afterEach, beforeEach, describe, expect } from '@jest/globals'
import request from 'supertest'
import { defineFeature, loadFeature } from 'jest-cucumber'
import app from '../../app'
import prisma from '../../prismaClient'
import {
  authHeader,
  cleanupFixturePrefix,
  createEmployee,
  createSponsorship,
  uniquePrefix,
} from './helpers/fixtures'

const feature = loadFeature(path.join(__dirname, '../features/sponsorships.feature'))

defineFeature(feature, (test) => {
  let prefix = ''
  let employee: any
  let otherEmployee: any
  let sponsorship: any
  let response: request.Response

  beforeEach(() => {
    prefix = uniquePrefix('sponsorships')
  })

  afterEach(async () => {
    await cleanupFixturePrefix(prefix)
  })

  test('Employee cannot list all sponsorships', ({ given, and, when, then }) => {
    given('another employee has an active sponsorship', async () => {
      otherEmployee = await createEmployee(prefix, { email: `${prefix}.sponsored@example.com` })
      sponsorship = await createSponsorship(otherEmployee.id)
    })

    and('a linked employee is signed in', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.viewer@example.com` })
    })

    when('the linked employee lists sponsorships', async () => {
      response = await request(app)
        .get('/api/sponsorships')
        .set('Authorization', authHeader({
          id: 10,
          email: employee.email,
          role: 'EMPLOYEE',
          employeeId: employee.id,
        }))
    })

    then('no other employee sponsorships are returned', () => {
      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })

  test('Unlinked employee cannot view expiring sponsorships', ({ given, and, when, then }) => {
    given('another employee has a sponsorship expiring soon', async () => {
      otherEmployee = await createEmployee(prefix, { email: `${prefix}.expiring@example.com` })
      sponsorship = await createSponsorship(otherEmployee.id, {
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
    })

    and('an unlinked employee user is signed in', () => undefined)

    when('the unlinked employee views expiring sponsorships', async () => {
      response = await request(app)
        .get('/api/sponsorships/expiring')
        .set('Authorization', authHeader({
          id: 11,
          email: `${prefix}.unlinked@example.com`,
          role: 'EMPLOYEE',
        }))
    })

    then('no expiring sponsorships are returned', () => {
      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })
  })

  test('Director can manage sponsorships', ({ given, and, when, then }) => {
    given('a director is signed in', () => undefined)

    and('an employee exists', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.managed@example.com` })
    })

    when('the director creates a sponsorship for that employee', async () => {
      response = await request(app)
        .post('/api/sponsorships')
        .set('Authorization', authHeader({
          id: 12,
          email: `${prefix}.director@example.com`,
          role: 'DIRECTOR',
        }))
        .send({
          employeeId: employee.id,
          visaType: 'Skilled Worker',
          sponsorLicenseNumber: 'BDD-LICENCE',
          startDate: '2026-05-01',
          endDate: '2027-05-01',
        })
    })

    then('the sponsorship is created', () => {
      expect(response.status).toBe(200)
      expect(response.body.employeeId).toBe(employee.id)
    })

    and('an audit log records the sponsorship creation', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userEmail: `${prefix}.director@example.com`,
          action: 'CREATE',
          entity: 'Sponsorship',
        },
      })
      expect(auditLog).not.toBeNull()
    })
  })

  test('Office assistant cannot edit sponsorship core details', ({ given, and, when, then }) => {
    given('an office assistant is signed in', () => undefined)

    and('an employee has an active sponsorship', async () => {
      employee = await createEmployee(prefix, { email: `${prefix}.office-assistant-target@example.com` })
      sponsorship = await createSponsorship(employee.id)
    })

    when('the office assistant updates the sponsorship visa type', async () => {
      response = await request(app)
        .put(`/api/sponsorships/${sponsorship.id}`)
        .set('Authorization', authHeader({
          id: 13,
          email: `${prefix}.assistant@example.com`,
          role: 'OFFICE_ASSISTANT',
        }))
        .send({ visaType: 'Changed Worker' })
    })

    then('the request is forbidden', () => {
      expect(response.status).toBe(403)
    })
  })
})
```

- [ ] **Step 3: Extend GDPR BDD for consent ownership**

Append to `backend/src/__tests__/features/gdpr.feature`:

```gherkin
  Scenario: Employee cannot record consent for another employee
    Given another employee exists
    And a linked employee is signed in
    When the linked employee records consent for the other employee
    Then the request is forbidden
```

Add matching step bindings in `backend/src/__tests__/bdd/gdpr.feature.test.ts` using the existing file's setup pattern.

- [ ] **Step 4: Run failing BDD tests**

Run:

```bash
npm --prefix backend run test -- sponsorships.feature.test.ts gdpr.feature.test.ts
```

Expected: fail because current sponsorship and GDPR route behavior is too permissive.

- [ ] **Step 5: Add sponsorship permission helpers**

Add to `backend/src/lib/roles.ts`:

```ts
export function canViewSponsorships(role: unknown) {
  return isHrAdminRole(role) || normalizeRole(role) === ROLES.OFFICE_ASSISTANT
}

export function canManageSponsorships(role: unknown) {
  return isHrAdminRole(role)
}

export function canExportSponsorships(role: unknown) {
  return isHrAdminRole(role)
}

export function canRecordComplianceEvent(role: unknown) {
  return isHrAdminRole(role) || normalizeRole(role) === ROLES.OFFICE_ASSISTANT
}

export function canViewAuditLogs(role: unknown) {
  return isOwnerRole(role)
}

export function canExportGdprData(role: unknown) {
  return isOwnerRole(role)
}
```

- [ ] **Step 6: Harden sponsorship list and expiring routes**

Modify `backend/src/routes/sponsorships.ts`:

```ts
import { auditLog } from '../middleware/audit'
import { normalizeRole, ROLES, canViewSponsorships } from '../lib/roles'
```

In `GET /`:

```ts
const user = (req as any).user
const role = normalizeRole(user?.role)

if (role === ROLES.EMPLOYEE) {
  if (!user.employeeId) return res.json([])
  const ownItems = await prisma.sponsorship.findMany({
    where: { employeeId: user.employeeId },
    include: { employee: true },
  })
  await auditLog(req as any, 'READ', 'Sponsorship', undefined, { selfAccess: true, count: ownItems.length })
  return res.json(ownItems)
}

if (!canViewSponsorships(role)) return res.status(403).json({ error: 'forbidden' })

const items = await prisma.sponsorship.findMany({ include: { employee: true } })
await auditLog(req as any, 'READ', 'Sponsorship', undefined, { count: items.length })
res.json(items)
```

In `GET /expiring`, use the same employee self-scope behavior:

```ts
if (role === ROLES.EMPLOYEE) {
  if (!user.employeeId) return res.json([])
  whereClause.employeeId = user.employeeId
} else if (!canViewSponsorships(role)) {
  return res.status(403).json({ error: 'forbidden' })
}
```

- [ ] **Step 7: Audit sponsorship mutations**

In `POST /`, after create:

```ts
await auditLog(req as any, 'CREATE', 'Sponsorship', s.id, {
  employeeId,
  visaType,
  sponsorLicenseNumber,
})
```

In `PUT /:id`, after update:

```ts
await auditLog(req as any, 'UPDATE', 'Sponsorship', s.id, {
  updatedFields: Object.keys(data),
})
```

In `DELETE /:id`, fetch before delete and log after delete:

```ts
const existing = await prisma.sponsorship.findUnique({ where: { id } })
await prisma.sponsorship.delete({ where: { id } })
await auditLog(req as any, 'DELETE', 'Sponsorship', id, {
  employeeId: existing?.employeeId,
  visaType: existing?.visaType,
})
```

- [ ] **Step 8: Harden GDPR consent writes**

Modify `backend/src/routes/gdpr.ts` consent POST route:

```ts
const userRole = normalizeRole(req.user?.role)
if (userRole === ROLES.EMPLOYEE && req.user?.employeeId !== Number(employeeId)) {
  return res.status(403).json({ error: 'Unauthorized' })
}
if (!req.user?.employeeId && userRole === ROLES.EMPLOYEE) {
  return res.status(403).json({ error: 'User account is not linked to an employee record' })
}
```

Admin/director may record consent administratively only if the current product requires it; otherwise restrict consent writes to the employee themselves.

- [ ] **Step 9: Harden expiring documents for unlinked employees**

Modify `backend/src/routes/documents.ts` in `/expiring`:

```ts
if (normalizeRole(user.role) === ROLES.EMPLOYEE) {
  if (!user.employeeId) return res.json([])
  whereClause.employeeId = user.employeeId
}
```

- [ ] **Step 10: Run P0 hardening tests**

Run:

```bash
npm --prefix backend run test -- sponsorships.feature.test.ts gdpr.feature.test.ts documents.test.ts employees.security.test.ts
```

Expected: pass.

- [ ] **Step 11: Commit P0 hardening**

```bash
git add backend/src/routes/sponsorships.ts backend/src/routes/documents.ts backend/src/routes/gdpr.ts backend/src/lib/roles.ts backend/src/__tests__/features/sponsorships.feature backend/src/__tests__/bdd/sponsorships.feature.test.ts backend/src/__tests__/features/gdpr.feature backend/src/__tests__/bdd/gdpr.feature.test.ts
git commit -m "fix: harden sponsorship gdpr and audit permissions"
```

---

### Task 10: Sponsorship Compliance API

**Files:**
- Modify: `backend/src/routes/sponsorships.ts`
- Modify: `backend/src/lib/roles.ts`
- Test: `backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts`

- [ ] **Step 1: Add role helper tests for sponsorship compliance**

Extend `backend/src/__tests__/roles.test.ts`:

```ts
import {
  canManageSponsorshipCompliance,
  canUploadSponsorshipEvidence,
} from '../lib/roles'

it('allows only admin and director to manage sponsorship core details', () => {
  expect(canManageSponsorshipCompliance('ADMIN')).toBe(true)
  expect(canManageSponsorshipCompliance('DIRECTOR')).toBe(true)
  expect(canManageSponsorshipCompliance('OFFICE_ASSISTANT')).toBe(false)
  expect(canManageSponsorshipCompliance('EMPLOYEE')).toBe(false)
})

it('allows office assistant to upload sponsorship evidence', () => {
  expect(canUploadSponsorshipEvidence('ADMIN')).toBe(true)
  expect(canUploadSponsorshipEvidence('DIRECTOR')).toBe(true)
  expect(canUploadSponsorshipEvidence('OFFICE_ASSISTANT')).toBe(true)
  expect(canUploadSponsorshipEvidence('EMPLOYEE')).toBe(false)
})
```

- [ ] **Step 2: Run role tests and verify red**

Run:

```bash
npm --prefix backend run test -- roles.test.ts
```

Expected: fail until the new helpers exist.

- [ ] **Step 3: Implement sponsorship role helpers**

Add to `backend/src/lib/roles.ts`:

```ts
export function canManageSponsorshipCompliance(role: unknown) {
  return isHrAdminRole(role)
}

export function canUploadSponsorshipEvidence(role: unknown) {
  return canOperateDocuments(role)
}
```

- [ ] **Step 4: Implement compliance status endpoint**

Add to `backend/src/routes/sponsorships.ts`:

```ts
const REQUIRED_EVIDENCE = [
  { type: 'RIGHT_TO_WORK_CHECK', label: 'Right to work check evidence' },
  { type: 'EMPLOYMENT_RIGHTS_NOTIFICATION', label: 'Employment rights notification' },
  { type: 'RECRUITMENT_EVIDENCE', label: 'Recruitment evidence' },
  { type: 'SALARY_EVIDENCE', label: 'Salary evidence' },
  { type: 'SKILL_LEVEL_EVIDENCE', label: 'Skill level evidence' },
]

router.get('/:id/compliance', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
  const sponsorship = await prisma.sponsorship.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      employee: true,
      complianceEvidence: true,
    },
  })

  if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

  const presentTypes = new Set(sponsorship.complianceEvidence.map((item) => item.evidenceType))
  const missingItems = REQUIRED_EVIDENCE
    .filter((item) => !presentTypes.has(item.type))
    .map((item) => item.label)

  res.json({
    sponsorshipId: sponsorship.id,
    employeeId: sponsorship.employeeId,
    status: missingItems.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
    requiredItems: REQUIRED_EVIDENCE,
    missingItems,
    evidence: sponsorship.complianceEvidence,
  })
})
```

- [ ] **Step 5: Implement evidence upload/link endpoint**

Add:

```ts
router.post('/:id/compliance/evidence', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req: any, res) => {
  const { evidenceType, documentId, notes } = req.body
  if (!evidenceType) return res.status(400).json({ error: 'evidenceType is required' })

  const sponsorship = await prisma.sponsorship.findUnique({ where: { id: Number(req.params.id) } })
  if (!sponsorship) return res.status(404).json({ error: 'Sponsorship not found' })

  if (documentId) {
    const document = await prisma.document.findUnique({ where: { id: Number(documentId) } })
    if (!document || document.employeeId !== sponsorship.employeeId) {
      return res.status(400).json({ error: 'Document must belong to the sponsored employee' })
    }
  }

  const evidence = await prisma.sponsorshipComplianceEvidence.create({
    data: {
      sponsorshipId: sponsorship.id,
      documentId: documentId ? Number(documentId) : undefined,
      evidenceType,
      notes,
      verifiedAt: new Date(),
      verifiedBy: req.user?.id,
    },
  })

  res.json(evidence)
})
```

- [ ] **Step 6: Restrict sponsorship core management**

Change sponsorship create/update/delete guards:

```ts
requireRole('ADMIN', 'DIRECTOR')
```

Keep list/compliance view open to `OFFICE_ASSISTANT`. Keep employee self-service restricted to own sponsorships where applicable.

- [ ] **Step 7: Run BDD and role tests**

Run:

```bash
npm --prefix backend run test -- sponsorship-compliance.feature.test.ts roles.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit compliance API**

```bash
git add backend/src/routes/sponsorships.ts backend/src/lib/roles.ts backend/src/__tests__/roles.test.ts backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts
git commit -m "feat: add sponsorship compliance evidence API"
```

---

### Task 11: Reportable Events and Compliance Alerts

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/routes/sponsorships.ts`
- Modify: `frontend/src/pages/Sponsorships.tsx`
- Modify: `backend/src/__tests__/features/sponsorship-compliance.feature`
- Modify: `backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts`

- [ ] **Step 1: Add BDD scenarios for reportable events**

Append to `backend/src/__tests__/features/sponsorship-compliance.feature`:

```gherkin
  Scenario: Delayed sponsored worker start becomes reportable
    Given a sponsored worker was expected to start 29 days ago
    And the worker has not started
    When an admin reviews reportable sponsorship events
    Then the worker is flagged for delayed start reporting
    And the reporting deadline is 10 working days after the 28 day period

  Scenario: Ten consecutive unauthorised absence days becomes reportable
    Given a sponsored worker has 10 consecutive unauthorised absence days
    When a director reviews reportable sponsorship events
    Then the worker is flagged for unauthorised absence reporting
```

- [ ] **Step 2: Add reportable event model**

Modify `backend/prisma/schema.prisma`:

```prisma
model SponsorshipReportableEvent {
  id            Int         @id @default(autoincrement())
  sponsorship   Sponsorship @relation(fields: [sponsorshipId], references: [id], onDelete: Cascade)
  sponsorshipId Int
  eventType     String
  eventDate     DateTime
  dueDate       DateTime
  status        String      @default("OPEN")
  notes         String?     @db.Text
  reportedAt    DateTime?
  reportedBy    Int?
  createdAt     DateTime    @default(now())
}
```

Add to `Sponsorship`:

```prisma
reportableEvents SponsorshipReportableEvent[]
```

- [ ] **Step 3: Run migration**

Run:

```bash
npm --prefix backend run prisma:migrate -- --name add_sponsorship_reportable_events
npm --prefix backend run prisma:generate
```

- [ ] **Step 4: Implement reportable event endpoints**

Add endpoints in `backend/src/routes/sponsorships.ts`:

```ts
router.get('/reportable-events/open', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
  const events = await prisma.sponsorshipReportableEvent.findMany({
    where: { status: 'OPEN' },
    include: { sponsorship: { include: { employee: true } } },
    orderBy: { dueDate: 'asc' },
  })
  res.json(events)
})

router.post('/:id/reportable-events', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), async (req, res) => {
  const { eventType, eventDate, dueDate, notes } = req.body
  if (!eventType || !eventDate || !dueDate) return res.status(400).json({ error: 'missing fields' })

  const event = await prisma.sponsorshipReportableEvent.create({
    data: {
      sponsorshipId: Number(req.params.id),
      eventType,
      eventDate: new Date(eventDate),
      dueDate: new Date(dueDate),
      notes,
    },
  })

  res.json(event)
})

router.put('/reportable-events/:eventId/mark-reported', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const event = await prisma.sponsorshipReportableEvent.update({
    where: { id: Number(req.params.eventId) },
    data: {
      status: 'REPORTED',
      reportedAt: new Date(),
      reportedBy: req.user?.id,
    },
  })

  res.json(event)
})
```

- [ ] **Step 5: Update Sponsorships UI**

Modify `frontend/src/pages/Sponsorships.tsx` to show:

- Compliance status column: Complete, Incomplete, Expiring, Expired.
- Missing evidence count.
- Open reportable events count.
- Detail section for evidence checklist.
- Buttons for upload/link evidence for admin/director/office assistant.
- Button for mark reported for admin/director only.

- [ ] **Step 6: Run BDD, backend build, frontend build**

Run:

```bash
npm --prefix backend run test -- sponsorship-compliance.feature.test.ts
npm --prefix backend run build
npm --prefix frontend run build
```

Expected: pass.

- [ ] **Step 7: Commit reportable events**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/routes/sponsorships.ts backend/src/__tests__/features/sponsorship-compliance.feature backend/src/__tests__/bdd/sponsorship-compliance.feature.test.ts frontend/src/pages/Sponsorships.tsx
git commit -m "feat: add sponsorship reportable event workflows"
```

---

### Task 12: Feature Guide and Compliance Release Notes

**Files:**
- Create: `docs/user-employee-sponsorship-compliance-guide.md`
- Modify: `README.md` if it has a documentation index.

- [ ] **Step 1: Write the user/admin guide**

Create `docs/user-employee-sponsorship-compliance-guide.md`:

```md
# User, Employee, and Sponsorship Compliance Guide

## Roles

- Admin: full system owner.
- Director: HR/business admin.
- Office Assistant: operational support for documents, leave, time, and sponsorship evidence uploads.
- Employee: self-service access to own records.

## User/Employee Management

Use User/Employee Management to manage employee records and linked login accounts from one screen.

## Office Assistant Access

Office Assistants can view employee basics, upload employee documents, approve/reject leave and timesheets, and upload sponsorship compliance evidence. They cannot edit core employee details, assign roles, reset passwords, view bank or NI data, export GDPR bundles, access audit logs, or change settings.

## Sponsorship Compliance

Sponsorship compliance tools help track evidence and operational deadlines. They do not replace legal advice. Administrators should verify current duties against GOV.UK before relying on the system for a sponsor compliance process.

Official guidance checked during implementation:

- Appendix D record-keeping duties, checked 2 May 2026.
- Sponsor duties and compliance, checked 2 May 2026.
- Sponsor a worker, checked 2 May 2026.
- Sponsor compliance visits, checked 2 May 2026.

## Evidence Packs

Each active sponsorship can have an evidence checklist. Missing evidence is shown as incomplete.

## Reportable Events

The system can track reportable events such as delayed starts, unauthorised absence, sponsorship ending, and unpaid leave over 4 weeks. Admins and Directors mark events as reported after they complete the appropriate SMS action outside the system.

## Audit Logging

Sensitive actions should be logged to AuditLog, including account role changes, employee changes, document uploads/deletions, sponsorship compliance evidence changes, and reportable event status changes.
```

- [ ] **Step 2: Verify guide matches implementation**

Search the guide for features that do not exist:

```bash
rg -n "can track|can have|should be logged|cannot|can " docs/user-employee-sponsorship-compliance-guide.md
```

Compare every claim with implemented behavior. Edit the guide if any claim is too broad.

- [ ] **Step 3: Commit guide**

```bash
git add docs/user-employee-sponsorship-compliance-guide.md README.md
git commit -m "docs: add user employee sponsorship compliance guide"
```

---

## Self-Review

- Spec coverage: The tasks cover role normalization, unified `/employees` screen, `/users` removal, office assistant permissions, sensitive data redaction, backend route protections, sponsorship compliance evidence, reportable-event workflows, domain BDD regression coverage, an HRM compliance tester gate, and verification.
- Placeholder scan: The plan contains no open placeholder markers. Test setup comments point workers to existing test helpers because this repo already has test scaffolding with local conventions.
- Type consistency: Role names are consistently `ADMIN`, `DIRECTOR`, `OFFICE_ASSISTANT`, and `EMPLOYEE`; legacy `MANAGER`/`USER` are only used as normalization inputs.
