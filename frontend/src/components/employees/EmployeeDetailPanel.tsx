import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Badge, Button } from '../ui';
import EmployeeAvatar from './EmployeeAvatar';
import { ConsentBadge, DetailRow, IconButton, accessRoleOf } from './Bits';
import { formatDate, fullName, type Employee, type UserAccount } from './model';

// Desktop: a sticky 340px card beside the list. Under 900px the same markup is
// a right drawer over a scrim, opened by selecting a row.

const EMPLOYEE_TYPE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Employee',
  DIRECTOR: 'Director',
};

export default function EmployeeDetailPanel({
  employee,
  account,
  manager,
  directReports,
  open,
  canEdit,
  onEdit,
  onOpenRecord,
  onClose,
}: {
  employee: Employee | null;
  account?: UserAccount;
  manager?: Employee;
  directReports: Employee[];
  open: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onOpenRecord: () => void;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Only the topmost surface should answer Escape; a dialog opened from
      // the full record is its own listener.
      if (
        event.key === 'Escape' &&
        document.querySelectorAll('[role="dialog"]').length === 0
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shell = [
    'bg-surface border border-line rounded-lg shadow-sm min-w-0',
    'min-[900px]:sticky min-[900px]:top-20',
    'max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:right-0 max-[899px]:z-50',
    'max-[899px]:w-[min(400px,100vw)] max-[899px]:rounded-none max-[899px]:overflow-y-auto',
    'max-[899px]:transition-transform max-[899px]:duration-layout max-[899px]:ease-out',
    open ? 'max-[899px]:translate-x-0' : 'max-[899px]:translate-x-full',
  ].join(' ');

  if (!employee) {
    return (
      <aside className={shell}>
        <p className="p-5 text-[13px] text-ink-2">No employee records found.</p>
      </aside>
    );
  }

  const workPhone = employee.workPhone;
  const startDate = formatDate(employee.startDate);
  const probationEnd = formatDate(employee.probationEndDate);
  const employeeType = employee.employeeType || 'EMPLOYEE';

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-state ease-out min-[900px]:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside className={shell} aria-label={`Details for ${fullName(employee)}`}>
        <div className="flex flex-col gap-3 border-b border-line p-5">
          <div className="flex items-start justify-between gap-3">
            <EmployeeAvatar employee={employee} size={40} />
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button variant="secondary" size="sm" onClick={onEdit}>
                  Edit
                </Button>
              )}
              <IconButton
                label="Close details"
                onClick={onClose}
                bordered
                className="min-[900px]:hidden"
              >
                <XMarkIcon className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
          <div>
            <div className="text-[17px] font-semibold leading-snug tracking-[-0.005em] text-ink">
              {fullName(employee)}
            </div>
            <div className="text-[13px] text-ink-2">
              {employee.jobTitle || 'No job title'}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{accessRoleOf(account)}</Badge>
            <Badge>{employee.department || 'Unassigned'}</Badge>
            {employee.anonymisedAt ? (
              <Badge>Anonymised</Badge>
            ) : employee.endDate ? (
              <Badge tone="bad">Left {formatDate(employee.endDate)}</Badge>
            ) : null}
          </div>
        </div>

        <dl className="px-5 py-2">
          <DetailRow label="Email" value={employee.email} mono />
          <DetailRow
            label="Mobile"
            value={employee.phoneNumber || 'Not provided'}
            mono={!!employee.phoneNumber}
            muted={!employee.phoneNumber}
          />
          <DetailRow
            label="Work phone"
            value={workPhone || 'Not provided'}
            mono={!!workPhone}
            muted={!workPhone}
          />
          <DetailRow
            label="Start date"
            value={startDate || 'Not set'}
            mono={!!startDate}
            muted={!startDate}
          />
          <DetailRow
            label="Probation end"
            value={probationEnd || 'Not set'}
            mono={!!probationEnd}
            muted={!probationEnd}
          />
          <DetailRow
            label="Employee type"
            value={EMPLOYEE_TYPE_LABEL[employeeType] || employeeType}
          />
          <DetailRow
            label="Reports to"
            value={manager ? fullName(manager) : 'Nobody'}
            muted={!manager}
          />
          <DetailRow
            label="Direct reports"
            value={
              directReports.length ? (
                <ul>
                  {directReports.map((report) => (
                    <li key={report.id}>{fullName(report)}</li>
                  ))}
                </ul>
              ) : (
                'None'
              )
            }
            muted={!directReports.length}
          />
        </dl>

        <div className="flex flex-col gap-2 px-5 pb-5 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-ink-2">Consents recorded</span>
            <ConsentBadge employee={employee} />
          </div>
          <button
            type="button"
            onClick={onOpenRecord}
            className="self-start text-[13px] font-medium text-link hover:underline"
          >
            Open full record →
          </button>
        </div>
      </aside>
    </>
  );
}
