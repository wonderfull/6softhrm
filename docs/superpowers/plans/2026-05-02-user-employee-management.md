# User/Employee Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one unified User/Employee Management experience with standardized HRM roles and remove the duplicate User Management frontend.

**Architecture:** Keep `User` and `Employee` as separate Prisma models linked by `User.employeeId`. Add shared role/permission helpers on backend and frontend, normalize legacy roles, then consolidate user-account actions into the `/employees` page with a table and detail drawer UI.

**Tech Stack:** Express, TypeScript, Prisma, Jest, React 18, Vite, Tailwind CSS, Vitest.

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

## Self-Review

- Spec coverage: The tasks cover role normalization, unified `/employees` screen, `/users` removal, office assistant permissions, sensitive data redaction, backend route protections, and verification.
- Placeholder scan: The plan contains no open placeholder markers. Test setup comments point workers to existing test helpers because this repo already has test scaffolding with local conventions.
- Type consistency: Role names are consistently `ADMIN`, `DIRECTOR`, `OFFICE_ASSISTANT`, and `EMPLOYEE`; legacy `MANAGER`/`USER` are only used as normalization inputs.
