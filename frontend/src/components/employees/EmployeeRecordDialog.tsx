import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Badge, Button } from '../ui';
import Dialog from '../Dialog';
import RightToWorkPanel from '../RightToWorkPanel';
import DataRetentionPanel from '../DataRetentionPanel';
import EmployeeHrPanel from '../EmployeeHrPanel';
import EmployeeAvatar from './EmployeeAvatar';
import AccountForm from './AccountForm';
import {
  ConsentBadge,
  DetailRow,
  IconButton,
  SectionLabel,
  accessRoleOf,
} from './Bits';
import {
  formatDate,
  fullName,
  maskAccountNumber,
  type AccountFormData,
  type Employee,
  type UserAccount,
} from './model';
import { canAssignRole, type AppRole } from '../../lib/roles';

// Everything about one person that does not belong in the 340px panel:
// the whole record, right-to-work history, the HR file, the login and
// retention. Opened from "Open full record" in the panel.

type TabKey = 'overview' | 'rtw' | 'hr' | 'account' | 'retention';

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-10 whitespace-nowrap border-b-2 px-1 text-[13px] font-medium transition-colors duration-hover ease-out ${
        active
          ? 'border-accent text-ink'
          : 'border-transparent text-ink-2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Column({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <dl className="mt-1">{children}</dl>
    </div>
  );
}

export default function EmployeeRecordDialog({
  employee,
  account,
  employees,
  currentRole,
  canManageEmployees,
  canManageAccounts,
  canViewSensitive,
  isElevated,
  isSupport,
  canEdit,
  busyAccountId,
  accountForm,
  onAccountFormChange,
  onOpenAccountForm,
  onCloseAccountForm,
  onAccountSubmit,
  onRequestResetLink,
  onTemporaryPassword,
  onEdit,
  onDelete,
  onEmployeesChanged,
  onClose,
}: {
  employee: Employee;
  account?: UserAccount;
  employees: Employee[];
  currentRole: AppRole;
  canManageEmployees: boolean;
  canManageAccounts: boolean;
  canViewSensitive: boolean;
  isElevated: boolean;
  isSupport: boolean;
  canEdit: boolean;
  busyAccountId: number | null;
  accountForm: AccountFormData;
  onAccountFormChange: (next: AccountFormData) => void;
  onOpenAccountForm: (account?: UserAccount) => void;
  onCloseAccountForm: () => void;
  onAccountSubmit: (event: React.FormEvent) => void;
  onRequestResetLink: (account: UserAccount) => void;
  onTemporaryPassword: (account: UserAccount) => void;
  onEdit: () => void;
  onDelete: () => void;
  onEmployeesChanged: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<TabKey>('overview');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const anonymised = !!employee.anonymisedAt;
  const name = fullName(employee);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // A dialog opened from inside this one answers Escape first.
      if (
        event.key === 'Escape' &&
        document.querySelectorAll('[role="dialog"]').length === 1
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'overview', label: 'Overview' },
    ...(anonymised
      ? []
      : ([
          { key: 'rtw', label: 'Right to work' },
          { key: 'hr', label: 'HR file' },
        ] as Array<{ key: TabKey; label: string }>)),
    { key: 'account', label: 'Account' },
    ...(isElevated
      ? ([{ key: 'retention', label: 'Retention' }] as Array<{
          key: TabKey;
          label: string;
        }>)
      : []),
  ];

  const address =
    [employee.address1, employee.address2, employee.townCity, employee.postcode]
      .filter(Boolean)
      .join(', ') || 'Not provided';

  const manager = employee.managerId
    ? employees.find((person) => person.id === employee.managerId)
    : undefined;
  const directReports = employees.filter(
    (person) => person.managerId === employee.id,
  );

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Full record for ${name}`}
        onClick={onClose}
        className="fixed inset-0 z-50 flex overflow-y-auto bg-black/40 p-4 animate-[fade-in_200ms_var(--ease-out)] motion-reduce:animate-none"
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="m-auto w-full max-w-[880px] rounded-xl border border-line bg-surface shadow-lg animate-[dialog-in_320ms_var(--ease-out)] motion-reduce:animate-none"
        >
          <header className="flex items-start justify-between gap-4 border-b border-line p-5">
            <div className="flex min-w-0 items-center gap-3">
              <EmployeeAvatar employee={employee} size={40} />
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold leading-snug tracking-[-0.005em] text-ink">
                  {name}
                </h2>
                <p className="truncate text-[13px] text-ink-2">
                  {employee.jobTitle || 'No job title'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge>{accessRoleOf(account)}</Badge>
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={onEdit}>
                  Edit
                </Button>
              )}
              <IconButton label="Close full record" onClick={onClose}>
                <XMarkIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </header>

          <div
            role="tablist"
            aria-label="Employee record"
            className="flex gap-5 overflow-x-auto border-b border-line px-5"
          >
            {tabs.map((entry) => (
              <TabButton
                key={entry.key}
                active={tab === entry.key}
                onClick={() => setTab(entry.key)}
              >
                {entry.label}
              </TabButton>
            ))}
          </div>

          <div
            role="tabpanel"
            className="max-h-[min(60vh,560px)] overflow-y-auto p-5"
          >
            {tab === 'overview' && (
              <div className="space-y-5">
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Column label="Contact">
                    <DetailRow label="Email" value={employee.email} mono />
                    <DetailRow
                      label="Mobile"
                      value={employee.phoneNumber || 'Not provided'}
                      mono={!!employee.phoneNumber}
                      muted={!employee.phoneNumber}
                    />
                    <DetailRow
                      label="Work phone"
                      value={employee.workPhone || 'Not provided'}
                      mono={!!employee.workPhone}
                      muted={!employee.workPhone}
                    />
                    <DetailRow label="Address" value={address} />
                  </Column>

                  <Column label="Employment">
                    <DetailRow
                      label="Department"
                      value={employee.department || 'Unassigned'}
                    />
                    <DetailRow
                      label="Employee type"
                      value={employee.employeeType || 'EMPLOYEE'}
                    />
                    <DetailRow
                      label="Start date"
                      value={formatDate(employee.startDate) || 'Not set'}
                      mono={!!employee.startDate}
                      muted={!employee.startDate}
                    />
                    {employee.endDate && (
                      <DetailRow
                        label="End date"
                        value={formatDate(employee.endDate)}
                        mono
                      />
                    )}
                    <DetailRow
                      label="Probation end"
                      value={formatDate(employee.probationEndDate) || 'Not set'}
                      mono={!!employee.probationEndDate}
                      muted={!employee.probationEndDate}
                    />
                    <DetailRow
                      label="Reports to"
                      value={manager ? fullName(manager) : 'Nobody'}
                      muted={!manager}
                    />
                    <DetailRow
                      label="Direct reports"
                      value={
                        directReports.length
                          ? directReports.map(fullName).join(', ')
                          : 'None'
                      }
                      muted={!directReports.length}
                    />
                  </Column>

                  {canViewSensitive && (
                    <Column label="Pay and identity">
                      <DetailRow
                        label="Tax code"
                        value={employee.taxCode || 'Not provided'}
                        mono={!!employee.taxCode}
                        muted={!employee.taxCode}
                      />
                      <DetailRow
                        label="NI number"
                        value={employee.niNumber || 'Not provided'}
                        mono={!!employee.niNumber}
                        muted={!employee.niNumber}
                      />
                      <DetailRow
                        label="Bank"
                        value={employee.bankName || 'Not provided'}
                        muted={!employee.bankName}
                      />
                      <DetailRow
                        label="Account"
                        value={
                          maskAccountNumber(employee.accountNumber) ||
                          'Not provided'
                        }
                        mono={!!employee.accountNumber}
                        muted={!employee.accountNumber}
                      />
                      <DetailRow
                        label="Sort code"
                        value={employee.sortCode || 'Not provided'}
                        mono={!!employee.sortCode}
                        muted={!employee.sortCode}
                      />
                      <DetailRow
                        label="Salary"
                        value={
                          employee.salary
                            ? `£${Number(employee.salary).toLocaleString()}`
                            : 'Not provided'
                        }
                        mono={!!employee.salary}
                        muted={!employee.salary}
                      />
                      <DetailRow
                        label="Payroll"
                        value={employee.payrollNumber || 'Not provided'}
                        mono={!!employee.payrollNumber}
                        muted={!employee.payrollNumber}
                      />
                      <DetailRow
                        label="Visa expiry"
                        value={formatDate(employee.visaExpiryDate) || 'Not set'}
                        mono={!!employee.visaExpiryDate}
                        muted={!employee.visaExpiryDate}
                      />
                      <DetailRow
                        label="DBS check"
                        value={
                          employee.dbsLevel
                            ? `${employee.dbsLevel}${
                                employee.dbsIssueDate
                                  ? ` · issued ${formatDate(employee.dbsIssueDate)}`
                                  : ''
                              }`
                            : 'Not recorded'
                        }
                        muted={!employee.dbsLevel}
                      />
                      {employee.dbsRecheckDate && (
                        <DetailRow
                          label="DBS recheck due"
                          value={formatDate(employee.dbsRecheckDate)}
                          mono
                        />
                      )}
                    </Column>
                  )}

                  <Column label="Emergency contact">
                    <DetailRow
                      label="Name"
                      value={employee.emergencyContactName || 'Not provided'}
                      muted={!employee.emergencyContactName}
                    />
                    <DetailRow
                      label="Phone"
                      value={employee.emergencyContactPhone || 'Not provided'}
                      mono={!!employee.emergencyContactPhone}
                      muted={!employee.emergencyContactPhone}
                    />
                    <DetailRow
                      label="Relation"
                      value={
                        employee.emergencyContactRelation || 'Not provided'
                      }
                      muted={!employee.emergencyContactRelation}
                    />
                  </Column>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="flex items-center gap-2 text-[13px] text-ink-2">
                    Consents recorded
                    <ConsentBadge employee={employee} />
                  </div>
                  {canManageEmployees && (
                    <Button
                      variant="destructive"
                      size="sm"
                      aria-label={`Delete employee record for ${name}`}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete record
                    </Button>
                  )}
                </div>
              </div>
            )}

            {tab === 'rtw' && !anonymised && (
              <RightToWorkPanel
                key={employee.id}
                employeeId={employee.id}
                visaExpiryDate={employee.visaExpiryDate}
                canRecord={isElevated}
                canDelete={currentRole === 'ADMIN'}
              />
            )}

            {tab === 'hr' && !anonymised && (
              <EmployeeHrPanel
                key={`hr-${employee.id}`}
                employeeId={employee.id}
                employees={employees}
                canManage={isElevated || isSupport}
                canDelete={isElevated}
              />
            )}

            {tab === 'account' && (
              <div className="space-y-4">
                {account ? (
                  <>
                    <dl>
                      <DetailRow
                        label="Sign-in email"
                        value={account.email}
                        mono
                      />
                    </dl>
                    {canManageAccounts &&
                      canAssignRole(currentRole, account.role) && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Edit account for ${name}`}
                            onClick={() => onOpenAccountForm(account)}
                          >
                            Edit account
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyAccountId === account.id}
                            onClick={() => onRequestResetLink(account)}
                          >
                            {busyAccountId === account.id
                              ? 'Working…'
                              : 'Request reset email'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyAccountId === account.id}
                            onClick={() => onTemporaryPassword(account)}
                          >
                            Temporary password
                          </Button>
                        </div>
                      )}
                  </>
                ) : canManageAccounts ? (
                  <div className="space-y-3">
                    <p className="text-[13px] text-ink-2">
                      This person has no login yet.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Create account for ${name}`}
                      onClick={() => onOpenAccountForm()}
                    >
                      Create account
                    </Button>
                  </div>
                ) : (
                  <p className="text-[13px] text-ink-2">No linked account.</p>
                )}

                {canManageAccounts && accountForm.email && (
                  <AccountForm
                    form={accountForm}
                    currentRole={currentRole}
                    onChange={onAccountFormChange}
                    onSubmit={onAccountSubmit}
                    onCancel={onCloseAccountForm}
                  />
                )}
              </div>
            )}

            {tab === 'retention' && isElevated && (
              <DataRetentionPanel
                employee={employee}
                isAdmin={currentRole === 'ADMIN'}
                onChange={onEmployeesChanged}
              />
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        title="Delete this employee record?"
        description={`${name}'s record, and everything filed against it, is removed. This cannot be undone.`}
        onClose={() => setConfirmDelete(false)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setConfirmDelete(false);
              onDelete();
            }}
          >
            Delete record
          </Button>
        </div>
      </Dialog>
    </>
  );
}
