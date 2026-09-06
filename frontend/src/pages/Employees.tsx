import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import ImportEmployeesModal from '../components/ImportEmployeesModal';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  API_BASE_URL,
  getCurrentUser,
} from '../lib/api';
import { canAssignRole, isElevatedRole, normalizeRole } from '../lib/roles';
import Dialog from '../components/Dialog';
import PasswordRevealField from '../components/PasswordRevealField';
import { Badge, Button, KpiTile, PageHeader } from '../components/ui';
import EmployeeList from '../components/employees/EmployeeList';
import EmployeeDetailPanel from '../components/employees/EmployeeDetailPanel';
import EmployeeRecordDialog from '../components/employees/EmployeeRecordDialog';
import EmployeeForm from '../components/employees/EmployeeForm';
import {
  accountForEmployee,
  dateInputValue,
  emptyAccountForm,
  emptyEmployeeForm,
  fullName,
  generateTemporaryPassword,
  hasConsentGap,
  numberInputValue,
  type AccountFormData,
  type Employee,
  type EmployeeFormData,
  type UserAccount,
} from '../components/employees/model';

// People, the accounts that sign them in, and the compliance evidence filed
// against them. The list is the page; a person's detail sits in the panel and
// everything else in the full record (DESIGN.md "Employees").

export default function Employees() {
  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser?.role);
  const isElevated = isElevatedRole(currentRole);
  const isSupport = currentRole === 'OFFICE_ASSISTANT';
  const canManageEmployees = isElevated;
  const canManageAccounts = isElevated;
  const canViewSensitive = isElevated || currentRole === 'EMPLOYEE';
  const isEmployeeLogin = currentRole === 'EMPLOYEE';

  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [users, setUsers] = React.useState<UserAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [query, setQuery] = React.useState(() => searchParams.get('q') ?? '');
  const [status, setStatus] = React.useState<string | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = React.useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = React.useState<
    number | null
  >(null);
  const [employeeForm, setEmployeeForm] =
    React.useState<EmployeeFormData>(emptyEmployeeForm);
  const [employeeFormErrors, setEmployeeFormErrors] = React.useState<string[]>(
    [],
  );
  const [accountForm, setAccountForm] =
    React.useState<AccountFormData>(emptyAccountForm);
  const [busyAccountId, setBusyAccountId] = React.useState<number | null>(null);
  const [tempPasswordDialog, setTempPasswordDialog] = React.useState<{
    account: UserAccount;
    password: string;
  } | null>(null);
  const [savingTempPassword, setSavingTempPassword] = React.useState(false);

  // The top bar search sends the term over as ?q=, so a fresh navigation to
  // /employees?q=nadia has to land with the list already filtered.
  const urlQuery = searchParams.get('q');
  React.useEffect(() => {
    if (urlQuery !== null) setQuery(urlQuery);
  }, [urlQuery]);

  const loadEmployees = React.useCallback(async () => {
    try {
      const data = await apiGet('/employees');
      setEmployees(data);
      setSelectedId((existing) => existing ?? data[0]?.id ?? null);
    } catch {
      setEmployees([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = React.useCallback(async () => {
    if (!canManageAccounts) {
      setUsers([]);
      return;
    }

    try {
      const data = await apiGet('/auth/users');
      setUsers(
        data.map((user: UserAccount) => ({
          ...user,
          role: normalizeRole(user.role),
        })),
      );
    } catch {
      setUsers([]);
    }
  }, [canManageAccounts]);

  React.useEffect(() => {
    loadEmployees();
    loadUsers();
  }, [loadEmployees, loadUsers]);

  const scopedEmployees = React.useMemo(
    () =>
      isEmployeeLogin
        ? employees.filter(
            (employee) =>
              employee.email === currentUser?.email ||
              employee.id === currentUser?.employeeId,
          )
        : employees,
    [currentUser?.email, currentUser?.employeeId, employees, isEmployeeLogin],
  );

  const visibleEmployees = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scopedEmployees;

    return scopedEmployees.filter((employee) =>
      [
        fullName(employee),
        employee.email,
        employee.department,
        employee.jobTitle,
      ].some((value) => value?.toLowerCase().includes(needle)),
    );
  }, [query, scopedEmployees]);

  const selectedEmployee = React.useMemo(() => {
    return (
      visibleEmployees.find((employee) => employee.id === selectedId) ||
      visibleEmployees[0] ||
      null
    );
  }, [selectedId, visibleEmployees]);

  const managerOptions = React.useMemo(
    () => [
      { value: '', label: 'Nobody' },
      ...employees
        .filter((employee) => employee.id !== editingEmployeeId)
        .map((employee) => ({
          value: String(employee.id),
          label: fullName(employee),
        })),
    ],
    [employees, editingEmployeeId],
  );

  const canEditOwnProfile = React.useCallback(
    (employee?: Employee | null) => {
      return (
        !!employee &&
        isEmployeeLogin &&
        (employee.id === currentUser?.employeeId ||
          employee.email === currentUser?.email)
      );
    },
    [currentUser?.email, currentUser?.employeeId, isEmployeeLogin],
  );

  const isSelfProfileEdit = isEmployeeLogin && editingEmployeeId !== null;
  const selectedAccount = selectedEmployee
    ? accountForEmployee(selectedEmployee, users)
    : undefined;
  const selectedManager = selectedEmployee?.managerId
    ? employees.find((employee) => employee.id === selectedEmployee.managerId)
    : undefined;
  const directReports = selectedEmployee
    ? employees.filter((employee) => employee.managerId === selectedEmployee.id)
    : [];
  const missingAccountCount = employees.filter(
    (employee) => !accountForEmployee(employee, users),
  ).length;
  const activeLoginCount = users.filter(
    (user) =>
      !!user.employeeId ||
      employees.some((employee) => employee.email === user.email),
  ).length;
  const consentGapCount = employees.filter(hasConsentGap).length;

  const resetEmployeeForm = () => {
    setShowEmployeeForm(false);
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeFormErrors([]);
  };

  const openEmployeeForm = (employee?: Employee) => {
    if (!employee) {
      if (!canManageEmployees) return;
      setEmployeeForm(emptyEmployeeForm);
      setEditingEmployeeId(null);
      setEmployeeFormErrors([]);
      setShowEmployeeForm(true);
      return;
    }
    if (!canManageEmployees && !canEditOwnProfile(employee)) return;

    setEditingEmployeeId(employee.id);
    setEmployeeFormErrors([]);
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
      endDate: dateInputValue(employee.endDate),
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
      salary:
        employee.salary !== undefined && employee.salary !== null
          ? String(employee.salary)
          : '',
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
      dbsLevel: employee.dbsLevel || '',
      dbsCertificateNumber: employee.dbsCertificateNumber || '',
      dbsIssueDate: dateInputValue(employee.dbsIssueDate),
      dbsRecheckDate: dateInputValue(employee.dbsRecheckDate),
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
      emergencyContactRelation: employee.emergencyContactRelation || '',
      emergencyContactAddress: employee.emergencyContactAddress || '',
      managerId: employee.managerId ? String(employee.managerId) : '',
      leaveAllowanceDays: numberInputValue(employee.leaveAllowanceDays),
      leaveCarriedOverDays: numberInputValue(employee.leaveCarriedOverDays),
    });
    setRecordOpen(false);
    setPanelOpen(false);
    setShowEmployeeForm(true);
  };

  const openAccountForm = (employee: Employee, account?: UserAccount) => {
    setStatus(null);
    setAccountForm({
      id: account?.id ?? null,
      employeeId: account ? (account.employeeId ?? null) : employee.id,
      linkedEmployeeId: employee.id,
      email: account?.email || employee.email,
      name: account?.name || fullName(employee),
      role: normalizeRole(account?.role || 'EMPLOYEE'),
      password: '',
    });
  };

  const closeAccountForm = () => setAccountForm(emptyAccountForm);

  const updateEmployeeField = (id: keyof EmployeeFormData, value: string) => {
    setEmployeeForm((current) => ({ ...current, [id]: value }));
  };

  const employeePayload = React.useMemo(() => {
    const trimmed = Object.fromEntries(
      Object.entries(employeeForm).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ]),
    );
    // These three are numeric on the API; an empty select or input means
    // "cleared", which has to travel as null rather than ''.
    const numeric = (value: string) => (value === '' ? null : Number(value));
    return {
      ...trimmed,
      managerId: numeric(employeeForm.managerId.trim()),
      leaveAllowanceDays: numeric(employeeForm.leaveAllowanceDays.trim()),
      leaveCarriedOverDays: numeric(employeeForm.leaveCarriedOverDays.trim()),
    };
  }, [employeeForm]);

  const handleEmployeeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Inline validation summary, replacing the previous silent no-op when the
    // form was submitted with required fields blank. Self-service edits hide
    // the HR-only fields (email, job title, start date), so only validate the
    // fields the employee can actually see.
    const requiredFields: Array<[keyof EmployeeFormData, string]> =
      isSelfProfileEdit
        ? [
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
          ]
        : [
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
            ['email', 'Email'],
            ['jobTitle', 'Job title'],
            ['startDate', 'Start date'],
          ];
    const missing = requiredFields
      .filter(([key]) => !String(employeeForm[key] ?? '').trim())
      .map(([, label]) => label);
    if (missing.length) {
      setEmployeeFormErrors(missing);
      return;
    }
    setEmployeeFormErrors([]);

    try {
      if (editingEmployeeId) {
        await apiPut(`/employees/${editingEmployeeId}`, employeePayload);
        setStatus('Employee record updated.');
      } else {
        await apiPost('/employees', employeePayload);
        setStatus('Employee record created.');
      }
      resetEmployeeForm();
      await loadEmployees();
    } catch (err: any) {
      alert('Failed to save employee: ' + (err.message || JSON.stringify(err)));
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    try {
      await apiDelete(`/employees/${employee.id}`);
      setRecordOpen(false);
      setPanelOpen(false);
      setSelectedId(null);
      setStatus('Employee record deleted.');
      await loadEmployees();
    } catch (err: any) {
      alert(
        'Failed to delete employee: ' + (err.message || JSON.stringify(err)),
      );
    }
  };

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAssignRole(currentRole, accountForm.role)) return;
    if (!accountForm.id && !accountForm.password.trim()) {
      alert('Temporary password is required for a new account.');
      return;
    }

    try {
      if (accountForm.id) {
        const updateData: any = {
          email: accountForm.email,
          name: accountForm.name,
          role: accountForm.role,
          employeeId: accountForm.employeeId,
        };
        if (accountForm.password) updateData.password = accountForm.password;
        await apiPut(`/auth/users/${accountForm.id}`, updateData);
        setStatus('Account updated.');
      } else {
        await apiPost('/auth/register', {
          email: accountForm.email,
          name: accountForm.name,
          role: accountForm.role,
          password: accountForm.password.trim(),
        });
        const updatedUsers = await apiGet('/auth/users');
        const created = updatedUsers.find(
          (user: UserAccount) =>
            user.email.toLowerCase() === accountForm.email.toLowerCase(),
        );
        if (created && accountForm.employeeId) {
          await apiPut(`/auth/users/${created.id}`, {
            email: created.email,
            name: created.name,
            role: normalizeRole(created.role),
            employeeId: accountForm.employeeId,
          });
        }
        setStatus(
          accountForm.employeeId
            ? 'Account created and linked.'
            : 'Account created.',
        );
      }
      closeAccountForm();
      await loadUsers();
    } catch (err: any) {
      alert('Failed to save account: ' + (err.message || JSON.stringify(err)));
    }
  };

  const handleGenerateResetLink = async (account: UserAccount) => {
    try {
      setBusyAccountId(account.id);
      const response = await apiPost(`/auth/users/${account.id}/reset-link`);
      setStatus(
        response.message ||
          `Password reset email requested for ${account.email}.`,
      );
    } catch (err: any) {
      alert(
        'Failed to request password reset: ' +
          (err.message || JSON.stringify(err)),
      );
    } finally {
      setBusyAccountId(null);
    }
  };

  const openTempPasswordDialog = (account: UserAccount) => {
    setTempPasswordDialog({
      account,
      password: generateTemporaryPassword(),
    });
  };

  const submitTempPassword = async () => {
    if (!tempPasswordDialog) return;
    const trimmed = tempPasswordDialog.password.trim();
    if (!trimmed) {
      alert('Password cannot be empty.');
      return;
    }

    try {
      setSavingTempPassword(true);
      await apiPost(
        `/auth/users/${tempPasswordDialog.account.id}/reset-password`,
        { newPassword: trimmed },
      );
      setStatus(
        `Temporary password updated for ${tempPasswordDialog.account.email}.`,
      );
      setTempPasswordDialog(null);
    } catch (err: any) {
      alert(
        'Failed to reset password: ' + (err.message || JSON.stringify(err)),
      );
    } finally {
      setSavingTempPassword(false);
    }
  };

  async function handleExportExcel() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/employees/export/excel`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  }

  const canEditSelected =
    !!selectedEmployee &&
    (canManageEmployees || canEditOwnProfile(selectedEmployee));

  const headerActions = showEmployeeForm ? null : (
    <>
      {isElevated && (
        <Button
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
          onClick={handleExportExcel}
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export
        </Button>
      )}
      {canManageEmployees && (
        <Button
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => setShowImport(true)}
        >
          <ArrowUpTrayIcon className="h-4 w-4" />
          Import CSV
        </Button>
      )}
      {canManageEmployees && (
        <Button
          size="sm"
          className="whitespace-nowrap"
          onClick={() => openEmployeeForm()}
        >
          Add person
        </Button>
      )}
      {!canManageEmployees && canEditSelected && (
        <Button
          size="sm"
          className="whitespace-nowrap"
          onClick={() => openEmployeeForm(selectedEmployee!)}
        >
          Update profile
        </Button>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6">
      <PageHeader
        title={isEmployeeLogin ? 'My profile' : 'User/Employee Management'}
        subline="Employee records, account linkage, and access roles."
        actions={headerActions}
      />

      {status && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-ok-tint px-4 py-3 text-[13px] text-ok">
          <span>{status}</span>
          <button
            type="button"
            onClick={() => setStatus(null)}
            aria-label="Dismiss status"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors duration-hover ease-out hover:bg-ok/10"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {showEmployeeForm && (canManageEmployees || isSelfProfileEdit) ? (
        <EmployeeForm
          form={employeeForm}
          errors={employeeFormErrors}
          editing={editingEmployeeId !== null}
          isSelfProfileEdit={isSelfProfileEdit}
          managerOptions={managerOptions}
          onChange={updateEmployeeField}
          onSubmit={handleEmployeeSubmit}
          onCancel={resetEmployeeForm}
        />
      ) : (
        <>
          {isElevated && (
            <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
              <KpiTile
                label="Total people"
                value={employees.length}
                loading={loading}
              />
              <KpiTile
                label="Active logins"
                value={activeLoginCount}
                loading={loading}
              />
              <KpiTile
                label="Missing login"
                value={missingAccountCount}
                loading={loading}
                badge={
                  missingAccountCount > 0 ? (
                    <Badge tone="warn">Action needed</Badge>
                  ) : undefined
                }
              />
              <KpiTile
                label="Consent gaps"
                value={consentGapCount}
                loading={loading}
                badge={
                  consentGapCount > 0 ? (
                    <Badge tone="warn">Action needed</Badge>
                  ) : undefined
                }
              />
            </section>
          )}

          <div className="grid items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_340px]">
            <EmployeeList
              employees={visibleEmployees}
              total={scopedEmployees.length}
              users={users}
              loading={loading}
              query={query}
              onQueryChange={setQuery}
              selectedId={selectedEmployee?.id ?? null}
              onSelect={(id) => {
                setSelectedId(id);
                setPanelOpen(true);
              }}
              addPersonAction={
                canManageEmployees ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEmployeeForm()}
                  >
                    Add person
                  </Button>
                ) : undefined
              }
            />

            <EmployeeDetailPanel
              employee={selectedEmployee}
              account={selectedAccount}
              manager={selectedManager}
              directReports={directReports}
              open={panelOpen}
              canEdit={canEditSelected}
              onEdit={() =>
                selectedEmployee && openEmployeeForm(selectedEmployee)
              }
              onOpenRecord={() => setRecordOpen(true)}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        </>
      )}

      {recordOpen && selectedEmployee && (
        <EmployeeRecordDialog
          employee={selectedEmployee}
          account={selectedAccount}
          employees={employees}
          currentRole={currentRole}
          canManageEmployees={canManageEmployees}
          canManageAccounts={canManageAccounts}
          canViewSensitive={canViewSensitive}
          isElevated={isElevated}
          isSupport={isSupport}
          canEdit={canEditSelected}
          busyAccountId={busyAccountId}
          accountForm={accountForm}
          onAccountFormChange={setAccountForm}
          onOpenAccountForm={(account) =>
            openAccountForm(selectedEmployee, account)
          }
          onCloseAccountForm={closeAccountForm}
          onAccountSubmit={handleAccountSubmit}
          onRequestResetLink={handleGenerateResetLink}
          onTemporaryPassword={openTempPasswordDialog}
          onEdit={() => openEmployeeForm(selectedEmployee)}
          onDelete={() => handleDeleteEmployee(selectedEmployee)}
          onEmployeesChanged={loadEmployees}
          onClose={() => {
            setRecordOpen(false);
            closeAccountForm();
          }}
        />
      )}

      <Dialog
        open={!!tempPasswordDialog}
        title="Set temporary password"
        description={
          tempPasswordDialog
            ? `Generates a one-time password for ${tempPasswordDialog.account.email}. Copy it before closing; it is not shown again.`
            : ''
        }
        onClose={() =>
          savingTempPassword ? undefined : setTempPasswordDialog(null)
        }
      >
        {tempPasswordDialog && (
          <div className="space-y-4">
            <PasswordRevealField
              value={tempPasswordDialog.password}
              onChange={(password) =>
                setTempPasswordDialog({ ...tempPasswordDialog, password })
              }
              onRegenerate={() =>
                setTempPasswordDialog({
                  ...tempPasswordDialog,
                  password: generateTemporaryPassword(),
                })
              }
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setTempPasswordDialog(null)}
                disabled={savingTempPassword}
              >
                Cancel
              </Button>
              <Button onClick={submitTempPassword} loading={savingTempPassword}>
                Apply password
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {showImport && (
        <ImportEmployeesModal
          onClose={() => setShowImport(false)}
          onImported={() => loadEmployees()}
        />
      )}
    </div>
  );
}
