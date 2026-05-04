import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete, API_BASE_URL, getCurrentUser } from '../lib/api'
import { assignableRoles, canAssignRole, isElevatedRole, normalizeRole, roleBadgeClass, roleLabel, type AppRole } from '../lib/roles'
import { HiArrowDownTray, HiKey, HiPencilSquare, HiPlus, HiTrash, HiUserPlus, HiXMark } from 'react-icons/hi2'

type Employee = {
  id: number
  firstName: string
  middleName?: string
  lastName: string
  title?: string
  gender?: string
  ethnicity?: string
  dateOfBirth?: string
  email: string
  phoneNumber?: string
  workPhone?: string
  jobTitle?: string
  employeeType?: string
  department?: string
  niNumber?: string
  startDate?: string
  bankName?: string
  probationEndDate?: string
  address1?: string
  address2?: string
  address3?: string
  townCity?: string
  county?: string
  postcode?: string
  accountName?: string
  bankBranch?: string
  accountNumber?: string
  sortCode?: string
  salary?: number | string
  salaryRate?: string
  paymentFrequency?: string
  salaryEffectiveFrom?: string
  salaryReason?: string
  payrollNumber?: string
  taxCode?: string
  passportNumber?: string
  passportCountryOfIssue?: string
  passportExpiryDate?: string
  licenceNumber?: string
  licenceCountryOfIssue?: string
  licenceClass?: string
  licenceExpiryDate?: string
  visaNumber?: string
  visaExpiryDate?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  emergencyContactAddress?: string
  consentCount?: number
}

type UserAccount = {
  id: number
  email: string
  name?: string
  role: string
  employeeId?: number | null
  employee?: Partial<Employee>
}

type EmployeeFormData = {
  firstName: string
  middleName: string
  lastName: string
  title: string
  gender: string
  ethnicity: string
  dateOfBirth: string
  email: string
  phoneNumber: string
  workPhone: string
  jobTitle: string
  employeeType: string
  department: string
  niNumber: string
  startDate: string
  probationEndDate: string
  address1: string
  address2: string
  address3: string
  townCity: string
  county: string
  postcode: string
  accountName: string
  bankName: string
  bankBranch: string
  accountNumber: string
  sortCode: string
  salary: string
  salaryRate: string
  paymentFrequency: string
  salaryEffectiveFrom: string
  salaryReason: string
  payrollNumber: string
  taxCode: string
  passportNumber: string
  passportCountryOfIssue: string
  passportExpiryDate: string
  licenceNumber: string
  licenceCountryOfIssue: string
  licenceClass: string
  licenceExpiryDate: string
  visaNumber: string
  visaExpiryDate: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
  emergencyContactAddress: string
}

type AccountFormData = {
  id: number | null
  employeeId: number | null
  email: string
  name: string
  role: AppRole
  password: string
}

const emptyEmployeeForm: EmployeeFormData = {
  firstName: '',
  middleName: '',
  lastName: '',
  title: '',
  gender: '',
  ethnicity: '',
  dateOfBirth: '',
  email: '',
  phoneNumber: '',
  workPhone: '',
  jobTitle: '',
  employeeType: 'EMPLOYEE',
  department: '',
  niNumber: '',
  startDate: '',
  probationEndDate: '',
  address1: '',
  address2: '',
  address3: '',
  townCity: '',
  county: '',
  postcode: '',
  accountName: '',
  bankName: '',
  bankBranch: '',
  accountNumber: '',
  sortCode: '',
  salary: '',
  salaryRate: '',
  paymentFrequency: '',
  salaryEffectiveFrom: '',
  salaryReason: '',
  payrollNumber: '',
  taxCode: '',
  passportNumber: '',
  passportCountryOfIssue: '',
  passportExpiryDate: '',
  licenceNumber: '',
  licenceCountryOfIssue: '',
  licenceClass: '',
  licenceExpiryDate: '',
  visaNumber: '',
  visaExpiryDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  emergencyContactAddress: '',
}

const emptyAccountForm: AccountFormData = {
  id: null,
  employeeId: null,
  email: '',
  name: '',
  role: 'EMPLOYEE',
  password: '',
}

function generateTemporaryPassword() {
  return `Temp-${Math.random().toString(36).slice(2, 8)}!${Math.floor(100 + Math.random() * 900)}`
}

function fullName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim()
}

function formatDate(value?: string) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString()
}

function dateInputValue(value?: string) {
  return value ? value.split('T')[0] : ''
}

function maskAccountNumber(value?: string) {
  if (!value) return 'Not provided'
  return `****${value.slice(-4)}`
}

function accountForEmployee(employee: Employee, users: UserAccount[]) {
  return users.find((user) => user.employeeId === employee.id || user.email.toLowerCase() === employee.email.toLowerCase())
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-semibold ${className}`}>
      {children}
    </span>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{value || 'Not provided'}</dd>
    </div>
  )
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4">
        <h4 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h4>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function RequiredMark() {
  return <span className="ml-1 text-pink-600 dark:text-pink-300">*</span>
}

type EmployeeInputProps = {
  id: keyof EmployeeFormData
  label: string
  value: string
  onChange: (id: keyof EmployeeFormData, value: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  helper?: string
  className?: string
  options?: Array<{ value: string; label: string }>
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
}

function EmployeeInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  helper,
  className = '',
  options,
  inputMode,
  maxLength,
}: EmployeeInputProps) {
  const fieldId = `employee-${String(id)}`
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
        {required && <RequiredMark />}
      </label>
      {options ? (
        <select
          id={fieldId}
          value={value}
          onChange={(event) => onChange(id, event.target.value)}
          required={required}
          className="form-input min-h-11 py-2"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input
          id={fieldId}
          value={value}
          onChange={(event) => onChange(id, event.target.value)}
          placeholder={placeholder}
          type={type}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          className="form-input min-h-11 py-2"
        />
      )}
      {helper && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>}
    </div>
  )
}

export default function Employees() {
  const currentUser = getCurrentUser()
  const currentRole = normalizeRole(currentUser?.role)
  const isElevated = isElevatedRole(currentRole)
  const isSupport = currentRole === 'OFFICE_ASSISTANT'
  const canManageEmployees = isElevated
  const canManageAccounts = isElevated
  const canViewSensitive = isElevated || currentRole === 'EMPLOYEE'

  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [users, setUsers] = React.useState<UserAccount[]>([])
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [query, setQuery] = React.useState('')
  const [status, setStatus] = React.useState<string | null>(null)
  const [showEmployeeForm, setShowEmployeeForm] = React.useState(false)
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<number | null>(null)
  const [employeeForm, setEmployeeForm] = React.useState<EmployeeFormData>(emptyEmployeeForm)
  const [accountForm, setAccountForm] = React.useState<AccountFormData>(emptyAccountForm)
  const [busyAccountId, setBusyAccountId] = React.useState<number | null>(null)

  const loadEmployees = React.useCallback(async () => {
    try {
      const data = await apiGet('/employees')
      setEmployees(data)
      setSelectedId((existing) => existing ?? data[0]?.id ?? null)
    } catch {
      setEmployees([])
      setSelectedId(null)
    }
  }, [])

  const loadUsers = React.useCallback(async () => {
    if (!canManageAccounts) {
      setUsers([])
      return
    }

    try {
      const data = await apiGet('/auth/users')
      setUsers(data.map((user: UserAccount) => ({ ...user, role: normalizeRole(user.role) })))
    } catch {
      setUsers([])
    }
  }, [canManageAccounts])

  React.useEffect(() => {
    loadEmployees()
    loadUsers()
  }, [loadEmployees, loadUsers])

  const visibleEmployees = React.useMemo(() => {
    const scoped = currentRole === 'EMPLOYEE'
      ? employees.filter((employee) => employee.email === currentUser?.email || employee.id === currentUser?.employeeId)
      : employees

    const needle = query.trim().toLowerCase()
    if (!needle) return scoped

    return scoped.filter((employee) => [
      fullName(employee),
      employee.email,
      employee.department,
      employee.jobTitle,
    ].some((value) => value?.toLowerCase().includes(needle)))
  }, [currentRole, currentUser?.email, currentUser?.employeeId, employees, query])

  const selectedEmployee = React.useMemo(() => {
    return visibleEmployees.find((employee) => employee.id === selectedId) || visibleEmployees[0] || null
  }, [selectedId, visibleEmployees])

  const selectedAccount = selectedEmployee ? accountForEmployee(selectedEmployee, users) : undefined
  const missingAccountCount = employees.filter((employee) => !accountForEmployee(employee, users)).length
  const activeLoginCount = users.filter((user) => !!user.employeeId || employees.some((employee) => employee.email === user.email)).length
  const pendingReviews = employees.filter((employee) => (employee.consentCount ?? 7) < 3).length

  const resetEmployeeForm = () => {
    setShowEmployeeForm(false)
    setEditingEmployeeId(null)
    setEmployeeForm(emptyEmployeeForm)
  }

  const openEmployeeForm = (employee?: Employee) => {
    if (!employee) {
      setEmployeeForm(emptyEmployeeForm)
      setEditingEmployeeId(null)
      setShowEmployeeForm(true)
      return
    }

    setEditingEmployeeId(employee.id)
    setEmployeeForm({
      firstName: employee.firstName || '',
      middleName: employee.middleName || '',
      lastName: employee.lastName || '',
      title: employee.title || '',
      gender: employee.gender || '',
      ethnicity: employee.ethnicity || '',
      dateOfBirth: dateInputValue(employee.dateOfBirth),
      email: employee.email || '',
      phoneNumber: employee.phoneNumber || '',
      workPhone: employee.workPhone || '',
      jobTitle: employee.jobTitle || '',
      employeeType: employee.employeeType || 'EMPLOYEE',
      department: employee.department || '',
      niNumber: employee.niNumber || '',
      startDate: dateInputValue(employee.startDate),
      probationEndDate: dateInputValue(employee.probationEndDate),
      address1: employee.address1 || '',
      address2: employee.address2 || '',
      address3: employee.address3 || '',
      townCity: employee.townCity || '',
      county: employee.county || '',
      postcode: employee.postcode || '',
      accountName: employee.accountName || '',
      bankName: employee.bankName || '',
      bankBranch: employee.bankBranch || '',
      accountNumber: employee.accountNumber || '',
      sortCode: employee.sortCode || '',
      salary: employee.salary !== undefined && employee.salary !== null ? String(employee.salary) : '',
      salaryRate: employee.salaryRate || '',
      paymentFrequency: employee.paymentFrequency || '',
      salaryEffectiveFrom: dateInputValue(employee.salaryEffectiveFrom),
      salaryReason: employee.salaryReason || '',
      payrollNumber: employee.payrollNumber || '',
      taxCode: employee.taxCode || '',
      passportNumber: employee.passportNumber || '',
      passportCountryOfIssue: employee.passportCountryOfIssue || '',
      passportExpiryDate: dateInputValue(employee.passportExpiryDate),
      licenceNumber: employee.licenceNumber || '',
      licenceCountryOfIssue: employee.licenceCountryOfIssue || '',
      licenceClass: employee.licenceClass || '',
      licenceExpiryDate: dateInputValue(employee.licenceExpiryDate),
      visaNumber: employee.visaNumber || '',
      visaExpiryDate: dateInputValue(employee.visaExpiryDate),
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
      emergencyContactRelation: employee.emergencyContactRelation || '',
      emergencyContactAddress: employee.emergencyContactAddress || '',
    })
    setShowEmployeeForm(true)
  }

  const openAccountForm = (employee: Employee, account?: UserAccount) => {
    setStatus(null)
    setAccountForm({
      id: account?.id ?? null,
      employeeId: employee.id,
      email: account?.email || employee.email,
      name: account?.name || fullName(employee),
      role: normalizeRole(account?.role || 'EMPLOYEE'),
      password: '',
    })
  }

  const closeAccountForm = () => setAccountForm(emptyAccountForm)

  const updateEmployeeField = (id: keyof EmployeeFormData, value: string) => {
    setEmployeeForm((current) => ({ ...current, [id]: value }))
  }

  const employeePayload = React.useMemo(() => {
    return Object.fromEntries(
      Object.entries(employeeForm).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    )
  }, [employeeForm])

  const handleEmployeeSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      if (editingEmployeeId) {
        await apiPut(`/employees/${editingEmployeeId}`, employeePayload)
        setStatus('Employee record updated.')
      } else {
        await apiPost('/employees', employeePayload)
        setStatus('Employee record created.')
      }
      resetEmployeeForm()
      await loadEmployees()
    } catch (err: any) {
      alert('Failed to save employee: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Delete employee record for ${fullName(employee)}?`)) return

    try {
      await apiDelete(`/employees/${employee.id}`)
      setStatus('Employee record deleted.')
      await loadEmployees()
    } catch (err: any) {
      alert('Failed to delete employee: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canAssignRole(currentRole, accountForm.role)) return

    try {
      if (accountForm.id) {
        const updateData: any = {
          email: accountForm.email,
          name: accountForm.name,
          role: accountForm.role,
          employeeId: accountForm.employeeId,
        }
        if (accountForm.password) updateData.password = accountForm.password
        await apiPut(`/auth/users/${accountForm.id}`, updateData)
        setStatus('Account updated.')
      } else {
        await apiPost('/auth/register', {
          email: accountForm.email,
          name: accountForm.name,
          role: accountForm.role,
          password: accountForm.password || generateTemporaryPassword(),
        })
        const updatedUsers = await apiGet('/auth/users')
        const created = updatedUsers.find((user: UserAccount) => user.email.toLowerCase() === accountForm.email.toLowerCase())
        if (created && accountForm.employeeId) {
          await apiPut(`/auth/users/${created.id}`, {
            email: created.email,
            name: created.name,
            role: normalizeRole(created.role),
            employeeId: accountForm.employeeId,
          })
        }
        setStatus('Account created and linked.')
      }
      closeAccountForm()
      await loadUsers()
    } catch (err: any) {
      alert('Failed to save account: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleCreateAccountForEmployee = async (employee: Employee) => {
    const suggestedPassword = generateTemporaryPassword()
    const password = prompt(`Temporary password for ${fullName(employee)}`, suggestedPassword)?.trim() || suggestedPassword

    try {
      await apiPost('/auth/register', {
        email: employee.email,
        password,
        name: fullName(employee),
        role: 'EMPLOYEE',
      })

      const updatedUsers = await apiGet('/auth/users')
      const created = updatedUsers.find((user: UserAccount) => user.email.toLowerCase() === employee.email.toLowerCase())
      if (created) {
        await apiPut(`/auth/users/${created.id}`, {
          email: created.email,
          name: created.name,
          role: normalizeRole(created.role),
          employeeId: employee.id,
        })
      }

      setStatus('Account created and linked.')
      await loadUsers()
    } catch (err: any) {
      alert('Failed to create account: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleGenerateResetLink = async (account: UserAccount) => {
    try {
      setBusyAccountId(account.id)
      const response = await apiPost(`/auth/users/${account.id}/reset-link`)
      setStatus(response.message || `Password reset email requested for ${account.email}.`)
    } catch (err: any) {
      alert('Failed to request password reset: ' + (err.message || JSON.stringify(err)))
    } finally {
      setBusyAccountId(null)
    }
  }

  const handleSetTemporaryPassword = async (account: UserAccount) => {
    const temporaryPassword = prompt(`Temporary password for ${account.email}`, generateTemporaryPassword())
    if (!temporaryPassword?.trim()) return

    try {
      setBusyAccountId(account.id)
      await apiPost(`/auth/users/${account.id}/reset-password`, { newPassword: temporaryPassword.trim() })
      setStatus(`Temporary password updated for ${account.email}.`)
    } catch (err: any) {
      alert('Failed to reset password: ' + (err.message || JSON.stringify(err)))
    } finally {
      setBusyAccountId(null)
    }
  }

  async function handleExportExcel() {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/employees/export/excel`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `employees-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert('Export failed: ' + err.message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">
            {currentRole === 'EMPLOYEE' ? 'My Profile' : 'User/Employee Management'}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Employee records, account linkage, and access roles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isElevated && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <HiArrowDownTray size={18} />
              Export
            </button>
          )}
          {canManageEmployees && (
            <button type="button" onClick={() => openEmployeeForm()} className="btn-primary min-h-10">
              <HiPlus size={18} />
              Add Person
            </button>
          )}
        </div>
      </div>

      {status && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          <span>{status}</span>
          <button type="button" onClick={() => setStatus(null)} aria-label="Dismiss status" className="rounded p-1 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-emerald-900">
            <HiXMark size={18} />
          </button>
        </div>
      )}

      {!showEmployeeForm && (
        <>
          {isElevated && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total People</div>
                <div className="mt-2 text-2xl font-bold">{employees.length}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Logins</div>
                <div className="mt-2 text-2xl font-bold">{activeLoginCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Missing Login</div>
                <div className="mt-2 text-2xl font-bold">{missingAccountCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending Reviews</div>
                <div className="mt-2 text-2xl font-bold">{pendingReviews}</div>
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 dark:border-slate-700 sm:flex-row">
            <label className="sr-only" htmlFor="people-search">Search people</label>
            <input
              id="people-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="form-input min-h-10 py-2"
              placeholder="Search name, email, department, role"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Access Role</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visibleEmployees.map((employee) => {
                  const account = accountForEmployee(employee, users)
                  const role = normalizeRole(account?.role || employee.employeeType)
                  const selected = selectedEmployee?.id === employee.id
                  return (
                    <tr
                      key={employee.id}
                      className={`${selected ? 'bg-primary-50/70 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedId(employee.id)}
                          className="text-left focus:outline-none focus:ring-2 focus:ring-primary-400"
                        >
                          <span className="block font-semibold text-slate-950 dark:text-white">{fullName(employee)}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{employee.email}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        <span className="block">{employee.department || 'Unassigned'}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{employee.jobTitle || 'No job title'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {account ? (
                          <Badge className={roleBadgeClass(account.role)}>{normalizeRole(account.role)}</Badge>
                        ) : (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">NO LOGIN</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {account ? 'Linked' : 'Missing'}
                      </td>
                      <td className="px-4 py-3">
                        {employee.consentCount === undefined ? (
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">Not tracked</Badge>
                        ) : employee.consentCount < 3 ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{employee.consentCount}/7 consents</Badge>
                        ) : (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">{employee.consentCount}/7 consents</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canManageAccounts && account && canAssignRole(currentRole, role) && (
                            <button
                              type="button"
                              aria-label={`Edit account for ${fullName(employee)}`}
                              onClick={() => openAccountForm(employee, account)}
                              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <HiPencilSquare size={17} />
                            </button>
                          )}
                          {canManageAccounts && !account && (
                            <button
                              type="button"
                              aria-label={`Create account for ${fullName(employee)}`}
                              onClick={() => handleCreateAccountForEmployee(employee)}
                              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                            >
                              <HiUserPlus size={17} />
                            </button>
                          )}
                          {canManageEmployees && (
                            <button
                              type="button"
                              aria-label={`Edit employee record for ${fullName(employee)}`}
                              onClick={() => openEmployeeForm(employee)}
                              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <HiPencilSquare size={17} />
                            </button>
                          )}
                          {canManageEmployees && (
                            <button
                              type="button"
                              aria-label={`Delete employee record for ${fullName(employee)}`}
                              onClick={() => handleDeleteEmployee(employee)}
                              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-800 dark:bg-slate-900 dark:text-red-300"
                            >
                              <HiTrash size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {selectedEmployee ? (
            <>
              <div className="border-b border-slate-200 p-5 dark:border-slate-700">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-sm font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-200">
                  {selectedEmployee.firstName.charAt(0)}{selectedEmployee.lastName.charAt(0)}
                </div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{fullName(selectedEmployee)}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{selectedEmployee.jobTitle || 'No job title'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedAccount ? (
                    <Badge className={roleBadgeClass(selectedAccount.role)}>{roleLabel(selectedAccount.role)}</Badge>
                  ) : (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">No login</Badge>
                  )}
                  <Badge className="border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    {selectedEmployee.department || 'Unassigned'}
                  </Badge>
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-4 border-b border-slate-200 p-5 dark:border-slate-700 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Email" value={selectedEmployee.email} />
                <Field label="Mobile" value={selectedEmployee.phoneNumber || 'Not provided'} />
                <Field label="Work Phone" value={selectedEmployee.workPhone || 'Not provided'} />
                <Field label="Start Date" value={formatDate(selectedEmployee.startDate)} />
                <Field label="Probation End" value={formatDate(selectedEmployee.probationEndDate)} />
                <Field label="Employee Type" value={selectedEmployee.employeeType || 'EMPLOYEE'} />
                <Field label="Address" value={[selectedEmployee.address1, selectedEmployee.address2, selectedEmployee.townCity, selectedEmployee.postcode].filter(Boolean).join(', ') || 'Not provided'} />
                {canViewSensitive && (
                  <>
                    <Field label="Tax Code" value={selectedEmployee.taxCode || 'Not provided'} />
                    <Field label="NI Number" value={selectedEmployee.niNumber || 'Not provided'} />
                    <Field label="Bank" value={selectedEmployee.bankName || 'Not provided'} />
                    <Field label="Account" value={maskAccountNumber(selectedEmployee.accountNumber)} />
                    <Field label="Sort Code" value={selectedEmployee.sortCode || 'Not provided'} />
                    <Field label="Salary" value={selectedEmployee.salary ? `£${Number(selectedEmployee.salary).toLocaleString()}` : 'Not provided'} />
                    <Field label="Payroll" value={selectedEmployee.payrollNumber || 'Not provided'} />
                    <Field label="Visa Expiry" value={formatDate(selectedEmployee.visaExpiryDate)} />
                  </>
                )}
              </dl>

              <div className="border-b border-slate-200 p-5 dark:border-slate-700">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Account Controls</div>
                {selectedAccount ? (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-700 dark:text-slate-200">{selectedAccount.email}</div>
                    {canManageAccounts && canAssignRole(currentRole, selectedAccount.role) && (
                      <div className="grid gap-2">
                        <button type="button" onClick={() => openAccountForm(selectedEmployee, selectedAccount)} className="btn-ghost min-h-10 justify-center">
                          <HiPencilSquare size={17} />
                          Edit Account
                        </button>
                        <button type="button" onClick={() => handleGenerateResetLink(selectedAccount)} disabled={busyAccountId === selectedAccount.id} className="btn-ghost min-h-10 justify-center">
                          <HiKey size={17} />
                          {busyAccountId === selectedAccount.id ? 'Working...' : 'Request Reset Email'}
                        </button>
                        <button type="button" onClick={() => handleSetTemporaryPassword(selectedAccount)} disabled={busyAccountId === selectedAccount.id} className="btn-ghost min-h-10 justify-center">
                          <HiKey size={17} />
                          Temporary Password
                        </button>
                      </div>
                    )}
                  </div>
                ) : canManageAccounts ? (
                  <button type="button" onClick={() => handleCreateAccountForEmployee(selectedEmployee)} className="btn-primary min-h-10 w-full justify-center">
                    <HiUserPlus size={17} />
                    Create Account
                  </button>
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-400">No linked account.</div>
                )}
              </div>

              <div className="p-5">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Emergency Contact</div>
                <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <Field label="Name" value={selectedEmployee.emergencyContactName || 'Not provided'} />
                  <Field label="Phone" value={selectedEmployee.emergencyContactPhone || 'Not provided'} />
                  <Field label="Relation" value={selectedEmployee.emergencyContactRelation || 'Not provided'} />
                </dl>
              </div>
            </>
          ) : (
            <div className="p-5 text-sm text-slate-600 dark:text-slate-400">No employee records found.</div>
          )}
        </aside>
          </div>
        </>
      )}

      {showEmployeeForm && canManageEmployees && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                {editingEmployeeId ? 'Edit Employee Record' : 'Add Employee'}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Complete the employment record once. Required fields are marked and the same sections are used for future edits.
              </p>
            </div>
            <button type="button" onClick={resetEmployeeForm} aria-label="Close employee form" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:hover:bg-slate-700">
              <HiXMark size={20} />
            </button>
          </div>

          <form onSubmit={handleEmployeeSubmit} className="space-y-4">
            <FormSection title="Basic details" description="Personal details, contact information, and employment dates.">
              <EmployeeInput id="title" label="Title" value={employeeForm.title} onChange={updateEmployeeField} options={[
                { value: '', label: 'Select title' },
                { value: 'Mr', label: 'Mr' },
                { value: 'Mrs', label: 'Mrs' },
                { value: 'Miss', label: 'Miss' },
                { value: 'Ms', label: 'Ms' },
                { value: 'Dr', label: 'Dr' },
                { value: 'Mx', label: 'Mx' },
              ]} />
              <EmployeeInput id="firstName" label="First name" value={employeeForm.firstName} onChange={updateEmployeeField} required placeholder="First name" />
              <EmployeeInput id="middleName" label="Middle name" value={employeeForm.middleName} onChange={updateEmployeeField} placeholder="Middle name" />
              <EmployeeInput id="lastName" label="Last name" value={employeeForm.lastName} onChange={updateEmployeeField} required placeholder="Last name" />
              <EmployeeInput id="gender" label="Gender" value={employeeForm.gender} onChange={updateEmployeeField} options={[
                { value: '', label: 'Unspecified' },
                { value: 'Female', label: 'Female' },
                { value: 'Male', label: 'Male' },
                { value: 'Non-binary', label: 'Non-binary' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]} />
              <EmployeeInput id="ethnicity" label="Ethnicity" value={employeeForm.ethnicity} onChange={updateEmployeeField} options={[
                { value: '', label: 'Unspecified' },
                { value: 'Asian or Asian British', label: 'Asian or Asian British' },
                { value: 'Black, Black British, Caribbean or African', label: 'Black, Black British, Caribbean or African' },
                { value: 'Mixed or multiple ethnic groups', label: 'Mixed or multiple ethnic groups' },
                { value: 'White', label: 'White' },
                { value: 'Other ethnic group', label: 'Other ethnic group' },
                { value: 'Prefer not to say', label: 'Prefer not to say' },
              ]} />
              <EmployeeInput id="dateOfBirth" label="Date of birth" value={employeeForm.dateOfBirth} onChange={updateEmployeeField} type="date" />
              <EmployeeInput id="email" label="Email address" value={employeeForm.email} onChange={updateEmployeeField} type="email" required placeholder="name@example.com" />
              <EmployeeInput id="phoneNumber" label="Mobile number" value={employeeForm.phoneNumber} onChange={updateEmployeeField} type="tel" inputMode="tel" placeholder="Mobile number" />
              <EmployeeInput id="workPhone" label="Work phone" value={employeeForm.workPhone} onChange={updateEmployeeField} type="tel" inputMode="tel" placeholder="Work phone" />
              <EmployeeInput id="jobTitle" label="Job title" value={employeeForm.jobTitle} onChange={updateEmployeeField} required placeholder="Job title" />
              <EmployeeInput id="employeeType" label="Employee type" value={employeeForm.employeeType} onChange={updateEmployeeField} options={[
                { value: 'EMPLOYEE', label: 'Employee' },
                { value: 'DIRECTOR', label: 'Director' },
              ]} />
              <EmployeeInput id="department" label="Department" value={employeeForm.department} onChange={updateEmployeeField} placeholder="Department" />
              <EmployeeInput id="startDate" label="Employment start date" value={employeeForm.startDate} onChange={updateEmployeeField} type="date" required />
              <EmployeeInput id="probationEndDate" label="Probation end date" value={employeeForm.probationEndDate} onChange={updateEmployeeField} type="date" />
            </FormSection>

            <FormSection title="Address details">
              <EmployeeInput id="address1" label="Address 1" value={employeeForm.address1} onChange={updateEmployeeField} placeholder="Address 1" />
              <EmployeeInput id="address2" label="Address 2" value={employeeForm.address2} onChange={updateEmployeeField} placeholder="Address 2" />
              <EmployeeInput id="address3" label="Address 3" value={employeeForm.address3} onChange={updateEmployeeField} placeholder="Address 3" />
              <EmployeeInput id="townCity" label="Town/City" value={employeeForm.townCity} onChange={updateEmployeeField} placeholder="Town or city" />
              <EmployeeInput id="county" label="County" value={employeeForm.county} onChange={updateEmployeeField} placeholder="County" />
              <EmployeeInput id="postcode" label="Postcode" value={employeeForm.postcode} onChange={updateEmployeeField} placeholder="Postcode" />
            </FormSection>

            <FormSection title="Emergency contact" description="Used only if HR needs to contact someone in an emergency.">
              <EmployeeInput id="emergencyContactName" label="Contact name" value={employeeForm.emergencyContactName} onChange={updateEmployeeField} placeholder="Full name" />
              <EmployeeInput id="emergencyContactPhone" label="Contact phone" value={employeeForm.emergencyContactPhone} onChange={updateEmployeeField} type="tel" inputMode="tel" placeholder="Phone number" />
              <EmployeeInput id="emergencyContactRelation" label="Relationship" value={employeeForm.emergencyContactRelation} onChange={updateEmployeeField} placeholder="Relationship" />
              <EmployeeInput id="emergencyContactAddress" label="Contact address" value={employeeForm.emergencyContactAddress} onChange={updateEmployeeField} placeholder="Address" />
            </FormSection>

            <FormSection title="Bank details">
              <EmployeeInput id="accountName" label="Name on account" value={employeeForm.accountName} onChange={updateEmployeeField} placeholder="Account name" helper="Maximum 60 characters." maxLength={60} />
              <EmployeeInput id="bankName" label="Name of bank" value={employeeForm.bankName} onChange={updateEmployeeField} placeholder="Bank name" helper="Maximum 60 characters." maxLength={60} />
              <EmployeeInput id="bankBranch" label="Bank branch" value={employeeForm.bankBranch} onChange={updateEmployeeField} placeholder="Bank branch" helper="Bank branch location." />
              <EmployeeInput id="accountNumber" label="Account number" value={employeeForm.accountNumber} onChange={updateEmployeeField} placeholder="8 digit number" helper="8 digit number." inputMode="numeric" maxLength={8} />
              <EmployeeInput id="sortCode" label="Sort code" value={employeeForm.sortCode} onChange={updateEmployeeField} placeholder="00-00-00" helper="Example: 00-00-00." maxLength={8} />
            </FormSection>

            <FormSection title="Salary details">
              <EmployeeInput id="salary" label="Salary" value={employeeForm.salary} onChange={updateEmployeeField} type="number" inputMode="decimal" placeholder="0" />
              <EmployeeInput id="salaryRate" label="Rate" value={employeeForm.salaryRate} onChange={updateEmployeeField} options={[
                { value: '', label: 'Select rate' },
                { value: 'Annual', label: 'Annual' },
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Daily', label: 'Daily' },
                { value: 'Hourly', label: 'Hourly' },
              ]} />
              <EmployeeInput id="paymentFrequency" label="Payment frequency" value={employeeForm.paymentFrequency} onChange={updateEmployeeField} options={[
                { value: '', label: 'Select frequency' },
                { value: 'Weekly', label: 'Weekly' },
                { value: 'Fortnightly', label: 'Fortnightly' },
                { value: 'Monthly', label: 'Monthly' },
              ]} />
              <EmployeeInput id="salaryEffectiveFrom" label="Effective from" value={employeeForm.salaryEffectiveFrom} onChange={updateEmployeeField} type="date" />
              <EmployeeInput id="salaryReason" label="Reason" value={employeeForm.salaryReason} onChange={updateEmployeeField} options={[
                { value: '', label: 'Select reason' },
                { value: 'New starter', label: 'New starter' },
                { value: 'Promotion', label: 'Promotion' },
                { value: 'Annual review', label: 'Annual review' },
                { value: 'Contract change', label: 'Contract change' },
              ]} />
              <EmployeeInput id="payrollNumber" label="Payroll number" value={employeeForm.payrollNumber} onChange={updateEmployeeField} placeholder="ABC123" />
            </FormSection>

            <FormSection title="Sensitive details" description="Tax, identity, licence, and right-to-work information. Access is restricted.">
              <div className="md:col-span-2">
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tax, NI and eligibility information</h5>
              </div>
              <EmployeeInput id="taxCode" label="Tax code" value={employeeForm.taxCode} onChange={updateEmployeeField} placeholder="Tax code" />
              <EmployeeInput id="niNumber" label="NI number" value={employeeForm.niNumber} onChange={updateEmployeeField} placeholder="NI number" />
              <div className="md:col-span-2">
                <h5 className="pt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Passport</h5>
              </div>
              <EmployeeInput id="passportNumber" label="Passport number" value={employeeForm.passportNumber} onChange={updateEmployeeField} placeholder="Passport number" />
              <EmployeeInput id="passportCountryOfIssue" label="Country of issue" value={employeeForm.passportCountryOfIssue} onChange={updateEmployeeField} placeholder="Country of issue" />
              <EmployeeInput id="passportExpiryDate" label="Passport expiry date" value={employeeForm.passportExpiryDate} onChange={updateEmployeeField} type="date" />
              <div className="md:col-span-2">
                <h5 className="pt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Driving licence</h5>
              </div>
              <EmployeeInput id="licenceNumber" label="Licence number" value={employeeForm.licenceNumber} onChange={updateEmployeeField} placeholder="Licence number" />
              <EmployeeInput id="licenceCountryOfIssue" label="Country of issue" value={employeeForm.licenceCountryOfIssue} onChange={updateEmployeeField} placeholder="Country of issue" />
              <EmployeeInput id="licenceClass" label="Licence class" value={employeeForm.licenceClass} onChange={updateEmployeeField} placeholder="Licence class" />
              <EmployeeInput id="licenceExpiryDate" label="Date of expiry" value={employeeForm.licenceExpiryDate} onChange={updateEmployeeField} type="date" />
              <div className="md:col-span-2">
                <h5 className="pt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Visa</h5>
              </div>
              <EmployeeInput id="visaNumber" label="Visa number" value={employeeForm.visaNumber} onChange={updateEmployeeField} placeholder="Visa number" />
              <EmployeeInput id="visaExpiryDate" label="Visa expiry date" value={employeeForm.visaExpiryDate} onChange={updateEmployeeField} type="date" />
            </FormSection>

            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:flex-row">
              <button type="submit" className="btn-primary min-h-11 flex-1 justify-center">{editingEmployeeId ? 'Update Employee' : 'Add Employee'}</button>
              <button type="button" onClick={resetEmployeeForm} className="btn-ghost min-h-11 justify-center">Cancel</button>
            </div>
          </form>
        </section>
      )}

      {!showEmployeeForm && accountForm.email && canManageAccounts && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{accountForm.id ? 'Edit Account' : 'New Account'}</h3>
            <button type="button" onClick={closeAccountForm} aria-label="Close account form" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:hover:bg-slate-700">
              <HiXMark size={20} />
            </button>
          </div>
          <form onSubmit={handleAccountSubmit} className="grid gap-4 md:grid-cols-2">
            <input value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} placeholder="Email *" type="email" required className="form-input" />
            <input value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} placeholder="Name" className="form-input" />
            <input value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} placeholder={accountForm.id ? 'Password (leave blank to keep)' : 'Password'} type="password" className="form-input" />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="account-role">Access Role</label>
              <select
                id="account-role"
                value={accountForm.role}
                onChange={(event) => setAccountForm({ ...accountForm, role: normalizeRole(event.target.value) })}
                className="form-input"
                required
              >
                {assignableRoles(currentRole).map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                This account stays linked to the employee record. Choose Director for admin access while keeping employee self-service.
              </p>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="btn-primary min-h-10 flex-1 justify-center">{accountForm.id ? 'Update Account' : 'Add Account'}</button>
              <button type="button" onClick={closeAccountForm} className="btn-ghost min-h-10">Cancel</button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
