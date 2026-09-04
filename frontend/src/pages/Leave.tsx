import React from 'react';
import { apiDelete, apiGet, apiPost, apiPut, getCurrentUser } from '../lib/api';
import Card from '../components/Card';
import Dialog from '../components/Dialog';
import LeaveCalendar from '../components/LeaveCalendar';
import { HiPlus } from 'react-icons/hi';
import { normalizeRole } from '../lib/roles';
import { LEAVE_TYPES, formatLeaveType, formatWorkingDays } from '../lib/leave';

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
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      {hint && (
        <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Leave Requests</h2>
        {canRequestLeave ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            <HiPlus /> {showForm ? 'Cancel' : 'Request Leave'}
          </button>
        ) : showLinkWarning ? (
          <div className="text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 text-sm">
            ⚠️ Your account is not linked to an employee record. Please contact
            HR.
          </div>
        ) : canApprove ? (
          <div className="text-slate-600 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 text-sm">
            Review and approve employee leave requests.
          </div>
        ) : null}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {canRequestLeave && balance && (
        <Card className="p-6 mb-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Your leave balance
            </h3>
            <span className="text-sm text-slate-600 dark:text-slate-400">
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
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">
            New Leave Request
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="leave-type"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
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
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
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
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
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
              <div className="col-span-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                This request uses {formatWorkingDays(workingDays)}. Weekends and
                bank holidays are not deducted.
              </div>
            )}

            <div className="col-span-2">
              <label
                htmlFor="leave-reason"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
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
                placeholder="Optional: Provide details about your leave request"
              />
            </div>

            <div className="col-span-2">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Submit Leave Request
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-6 text-center text-slate-600 dark:text-slate-400">
            No leave requests found.{' '}
            {canRequestLeave &&
              'Click "Request Leave" to submit a new request.'}
          </Card>
        ) : (
          items.map((l: any) => (
            <Card key={l.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {l.employee?.firstName} {l.employee?.lastName}
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mt-1">
                    <span className="font-semibold">
                      {formatLeaveType(l.type)}
                    </span>{' '}
                    — {new Date(l.startDate).toLocaleDateString('en-GB')} to{' '}
                    {new Date(l.endDate).toLocaleDateString('en-GB')}
                    {l.days !== undefined && l.days !== null && (
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {' '}
                        · {formatWorkingDays(l.days)}
                      </span>
                    )}
                  </div>
                  {l.reason && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-medium">Reason:</span> {l.reason}
                    </div>
                  )}
                  {l.decisionNote && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-medium">Decision note:</span>{' '}
                      {l.decisionNote}
                    </div>
                  )}
                  <div className="mt-2">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                        l.status === 'APPROVED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : l.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {canApprove && l.status === 'PENDING' && (
                    <>
                      <button
                        disabled={loadingIds.includes(l.id)}
                        onClick={() => openDecision(l.id, 'approve')}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {loadingIds.includes(l.id) ? '...' : 'Approve'}
                      </button>
                      <button
                        disabled={loadingIds.includes(l.id)}
                        onClick={() => openDecision(l.id, 'reject')}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {loadingIds.includes(l.id) ? '...' : 'Reject'}
                      </button>
                    </>
                  )}
                  {l.status === 'PENDING' &&
                    Number(l.employeeId) === ownEmployeeId && (
                      <button
                        disabled={loadingIds.includes(l.id)}
                        onClick={() => handleDelete(l.id)}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {loadingIds.includes(l.id) ? '...' : 'Cancel request'}
                      </button>
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
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
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
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
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
