import React from 'react';
import { apiDelete, apiGet, apiPost, apiPut, getCurrentUser } from '../lib/api';
import Card from '../components/Card';
import { Badge, Button, PageHeader } from '../components/ui';
import Dialog from '../components/Dialog';
import LeaveCalendar from '../components/LeaveCalendar';
import { HiPlus } from 'react-icons/hi';
import { normalizeRole } from '../lib/roles';
import { LEAVE_TYPES, formatLeaveType, formatWorkingDays } from '../lib/leave';

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
};

function Stat({
 label,
 value,
 hint,
}: {
 label: string;
 value: number;
 hint?: string;
}) {
 return (
    <div className="rounded-lg bg-surface-2 p-3 ">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-ink-3">{hint}</div>
      )}
    </div>
  );
}

export default function Leave() {
 const [items, setItems] = React.useState<any[]>([]);
 const [loadingIds, setLoadingIds] = React.useState<number[]>([]);
 const [showForm, setShowForm] = React.useState(false);
 const [error, setError] = React.useState('');
 const [balance, setBalance] = React.useState<any>(null);
 const [workingDays, setWorkingDays] = React.useState<number | null>(null);
 const [decision, setDecision] = React.useState<{
 id: number;
 action: 'approve' | 'reject';
  } | null>(null);
 const [decisionNote, setDecisionNote] = React.useState('');
 const [formData, setFormData] = React.useState({
 type: 'ANNUAL',
 startDate: '',
 endDate: '',
 reason: '',
  });

 const user = getCurrentUser();
 const role = normalizeRole(user?.role);
 const canApprove =
 user &&
    (role === 'ADMIN' || role === 'DIRECTOR' || role === 'OFFICE_ASSISTANT');
 const canRequestLeave = user && user.employeeId;
 const showLinkWarning = role === 'EMPLOYEE' && !user?.employeeId;
 const ownEmployeeId = user?.employeeId ? Number(user.employeeId) : null;

 const loadLeave = () => {
 apiGet('/leave')
      .then(setItems)
      .catch(() => setItems([]));
  };

 const loadBalance = React.useCallback(() => {
 if (!ownEmployeeId) return;
 apiGet('/leave/balance')
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [ownEmployeeId]);

 React.useEffect(() => {
 loadLeave();
  }, []);

 React.useEffect(() => {
 loadBalance();
  }, [loadBalance]);

  // The server owns the working-day maths (weekends, bank holidays, the
  // tenant's working pattern), so the form asks rather than counts.
 React.useEffect(() => {
 const { startDate, endDate } = formData;
 if (!startDate || !endDate || endDate < startDate) {
 setWorkingDays(null);
 return;
    }
 let cancelled = false;
 const timer = window.setTimeout(() => {
 apiGet('/leave/days', { start: startDate, end: endDate })
        .then((r) => {
 if (!cancelled) setWorkingDays(r.days);
        })
        .catch(() => {
 if (!cancelled) setWorkingDays(null);
        });
    }, 300);
 return () => {
 cancelled = true;
 window.clearTimeout(timer);
    };
  }, [formData.startDate, formData.endDate]);

 function employeeNameFor(id: number) {
 const request = items.find((it: any) => it.id === id);
 return request?.employee
      ? `${request.employee.firstName} ${request.employee.lastName}`
      : 'this employee';
  }

 function openDecision(id: number, action: 'approve' | 'reject') {
 setError('');
 setDecisionNote('');
 setDecision({ id, action });
  }

 async function submitDecision() {
 if (!decision) return;
 const { id, action } = decision;
 const note = decisionNote.trim();
 setDecision(null);
 setDecisionNote('');
 try {
 setLoadingIds((s: number[]) => [...s, id]);
 const updated = await apiPut(
 `/leave/${id}/${action}`,
 note ? { note } : {},
      );
 setItems((list: any[]) =>
 list.map((it: any) => (it.id === id ? updated : it)),
      );
 loadBalance();
    } catch (e: any) {
 setError(e.message || `Failed to ${action} the request.`);
    } finally {
 setLoadingIds((s: number[]) => s.filter((i: number) => i !== id));
    }
  }

 async function handleDelete(id: number) {
 if (!confirm('Cancel this leave request?')) return;
 setError('');
 try {
 setLoadingIds((s: number[]) => [...s, id]);
 await apiDelete(`/leave/${id}`);
 setItems((list: any[]) => list.filter((it: any) => it.id !== id));
 loadBalance();
    } catch (e: any) {
 setError(e.message || 'Failed to cancel the request.');
    } finally {
 setLoadingIds((s: number[]) => s.filter((i: number) => i !== id));
    }
  }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (formData.endDate < formData.startDate) {
 setError('End date cannot be before the start date.');
 return;
    }
 setError('');
 try {
 await apiPost('/leave', formData);
 setShowForm(false);
 setFormData({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
 loadLeave();
 loadBalance();
    } catch (err: any) {
 setError(err.message || 'Failed to submit leave request.');
    }
  };

 return (
    <div>
      <PageHeader
        className="mb-6"
        title="Leave"
        subline={
          canApprove
            ? 'Review and approve employee leave requests.'
            : 'Book time off and follow where each request has got to.'
        }
        actions={
          canRequestLeave ? (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setShowForm(!showForm)}
            >
              <HiPlus aria-hidden="true" />{' '}
              {showForm ? 'Cancel' : 'Request leave'}
            </Button>
          ) : undefined
        }
      />

      {showLinkWarning && (
        <p className="mb-6 text-sm text-warn">
          Your account is not linked to an employee record. Ask an
          administrator to link it before booking leave.
        </p>
      )}

      {error && (
        <div
 role="alert"
 className="mb-6 rounded-md border border-bad bg-bad-tint px-3 py-2 text-sm text-bad "
        >
          {error}
        </div>
      )}

      {canRequestLeave && balance && (
        <Card className="p-6 mb-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-ink ">
 Your leave balance
            </h3>
            <span className="text-sm text-ink-2">
              {balance.leaveYear?.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Remaining" value={balance.remaining} />
            <Stat
 label="Allowance"
 value={balance.prorated}
 hint={`${balance.allowance} days full year`}
            />
            <Stat label="Carried over" value={balance.carriedOver} />
            <Stat label="Used" value={balance.used} />
            <Stat label="Pending" value={balance.pending} />
          </div>
        </Card>
      )}

      {showForm && canRequestLeave && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-ink ">
 New Leave Request
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label
 htmlFor="leave-type"
 className="block text-sm font-medium text-ink-2 mb-2"
              >
 Leave Type *
              </label>
              <select
 id="leave-type"
 value={formData.type}
 onChange={(e) =>
 setFormData({ ...formData, type: e.target.value })
                }
 className="form-input"
 required
              >
                {LEAVE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatLeaveType(type)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
 htmlFor="leave-start-date"
 className="block text-sm font-medium text-ink-2 mb-2"
              >
 Start Date *
              </label>
              <input
 id="leave-start-date"
 type="date"
 value={formData.startDate}
 onChange={(e) =>
 setFormData((prev) => ({
                    ...prev,
 startDate: e.target.value,
 endDate:
 prev.endDate && prev.endDate < e.target.value
                        ? ''
                        : prev.endDate,
                  }))
                }
 className="form-input"
 required
              />
            </div>

            <div>
              <label
 htmlFor="leave-end-date"
 className="block text-sm font-medium text-ink-2 mb-2"
              >
 End Date *
              </label>
              <input
 id="leave-end-date"
 type="date"
 value={formData.endDate}
 min={formData.startDate || undefined}
 onChange={(e) =>
 setFormData({ ...formData, endDate: e.target.value })
                }
 className="form-input"
 required
              />
            </div>

            {workingDays !== null && (
              <div className="col-span-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2 ">
 This request uses {formatWorkingDays(workingDays)}. Weekends and
 bank holidays are not deducted.
              </div>
            )}

            <div className="col-span-2">
              <label
 htmlFor="leave-reason"
 className="block text-sm font-medium text-ink-2 mb-2"
              >
 Reason
              </label>
              <textarea
 id="leave-reason"
 value={formData.reason}
 onChange={(e) =>
 setFormData({ ...formData, reason: e.target.value })
                }
 className="form-input"
 rows={3}
 placeholder="Optional: any detail your approver should know"
              />
            </div>

            <div className="col-span-2">
              <Button type="submit" className="w-full">
                Submit request
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-6 text-center text-ink-2">
 No leave requests found.{' '}
            {canRequestLeave &&
 'Click "Request Leave" to submit a new request.'}
          </Card>
        ) : (
 items.map((l: any) => (
            <Card key={l.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-ink">
                    {l.employee?.firstName} {l.employee?.lastName}
                  </div>
                  <div className="mt-1 text-sm text-ink-2">
                    <span className="font-medium text-ink">
                      {formatLeaveType(l.type)}
                    </span>{' '}
                    <span className="font-mono text-[13px]">
                      {new Date(l.startDate).toLocaleDateString('en-GB')} to{' '}
                      {new Date(l.endDate).toLocaleDateString('en-GB')}
                    </span>
                    {l.days !== undefined && l.days !== null && (
                      <span> · {formatWorkingDays(l.days)}</span>
                    )}
                  </div>
                  {l.reason && (
                    <div className="text-sm text-ink-2 mt-1">
                      <span className="font-medium">Reason:</span> {l.reason}
                    </div>
                  )}
                  {l.decisionNote && (
                    <div className="text-sm text-ink-2 mt-1">
                      <span className="font-medium">Decision note:</span>{' '}
                      {l.decisionNote}
                    </div>
                  )}
                  <div className="mt-2">
                    <Badge
                      tone={
                        l.status === 'APPROVED'
                          ? 'ok'
                          : l.status === 'REJECTED'
                            ? 'bad'
                            : 'warn'
                      }
                    >
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {canApprove && l.status === 'PENDING' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={loadingIds.includes(l.id)}
                        onClick={() => openDecision(l.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={loadingIds.includes(l.id)}
                        onClick={() => openDecision(l.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {l.status === 'PENDING' &&
 Number(l.employeeId) === ownEmployeeId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={loadingIds.includes(l.id)}
                        onClick={() => handleDelete(l.id)}
                      >
                        Cancel request
                      </Button>
                    )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="mt-8">
        <LeaveCalendar />
      </div>

      <Dialog
 open={decision !== null}
 title={decision?.action === 'reject' ? 'Reject leave' : 'Approve leave'}
 description={
 decision
            ? `${decision.action === 'reject' ? 'Reject' : 'Approve'} leave for ${employeeNameFor(decision.id)}? They will be notified by email.`
            : undefined
        }
 onClose={() => setDecision(null)}
      >
        <label
 htmlFor="decision-note"
 className="block text-sm font-medium text-ink-2 mb-2"
        >
 Note (optional)
        </label>
        <textarea
 id="decision-note"
 value={decisionNote}
 onChange={(e) => setDecisionNote(e.target.value)}
 className="form-input"
 rows={3}
 placeholder="Recorded against the decision and shown to the employee"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
 type="button"
 onClick={() => setDecision(null)}
 className="px-4 py-2 rounded-lg border border-line-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 "
          >
 Cancel
          </button>
          <button
 type="button"
 onClick={submitDecision}
 className="btn-primary"
          >
            {decision?.action === 'reject' ? 'Reject' : 'Approve'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
