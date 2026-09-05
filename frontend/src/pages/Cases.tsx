import React from 'react';
import { apiGet, apiPost, apiPut } from '../lib/api';
import Card from '../components/Card';
import { HiPlus } from 'react-icons/hi';

// Disciplinary, grievance and capability cases. The most sensitive records in
// the product: ADMIN and DIRECTOR only, and deliberately confined to this
// screen — nothing about a live case appears on a dashboard or an employee
// profile where a colleague could read it over a shoulder.

type CaseRecord = {
  id: number;
  employeeId: number;
  type: string;
  openedAt: string;
  stage: string;
  outcome: string | null;
  notes: string | null;
  closedAt: string | null;
  employee?: {
    id: number;
    firstName: string;
    lastName: string;
    department?: string | null;
  } | null;
};

type EmployeeOption = {
  id: number;
  firstName: string;
  lastName: string;
};

const TYPES = [
  { value: 'DISCIPLINARY', label: 'Disciplinary' },
  { value: 'GRIEVANCE', label: 'Grievance' },
  { value: 'CAPABILITY', label: 'Capability' },
];

const STAGES = [
  { value: 'INFORMAL', label: 'Informal' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'HEARING', label: 'Hearing' },
  { value: 'APPEAL', label: 'Appeal' },
  { value: 'CLOSED', label: 'Closed' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.value, t.label]),
);

const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
);

const day = (value: string) => new Date(value).toLocaleDateString('en-GB');

const emptyForm = {
  employeeId: '',
  type: 'DISCIPLINARY',
  openedAt: '',
  stage: 'INFORMAL',
  outcome: '',
  notes: '',
};

function CaseCard({
  record,
  onUpdated,
}: {
  record: CaseRecord;
  onUpdated: (updated: CaseRecord) => void;
}) {
  const [outcome, setOutcome] = React.useState(record.outcome ?? '');
  const [notes, setNotes] = React.useState(record.notes ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function update(patch: Record<string, unknown>) {
    setError('');
    try {
      setSaving(true);
      onUpdated(await apiPut(`/cases/${record.id}`, patch));
    } catch (e: any) {
      setError(e.message || 'Failed to update the case.');
    } finally {
      setSaving(false);
    }
  }

  const name = record.employee
    ? `${record.employee.firstName} ${record.employee.lastName}`
    : `Employee ${record.employeeId}`;

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{name}</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {TYPE_LABELS[record.type] ?? record.type} · opened{' '}
            {day(record.openedAt)}
            {record.employee?.department
              ? ` · ${record.employee.department}`
              : ''}
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            record.closedAt
              ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          }`}
        >
          {record.closedAt
            ? `Closed ${day(record.closedAt)}`
            : `Open · ${STAGE_LABELS[record.stage] ?? record.stage}`}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`case-stage-${record.id}`}
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Stage
          </label>
          <select
            id={`case-stage-${record.id}`}
            value={record.stage}
            disabled={saving}
            onChange={(e) => update({ stage: e.target.value })}
            className="form-input py-2"
          >
            {STAGES.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`case-outcome-${record.id}`}
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Outcome
          </label>
          <input
            id={`case-outcome-${record.id}`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="e.g. Written warning, 12 months"
            className="form-input py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor={`case-notes-${record.id}`}
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Notes
          </label>
          <textarea
            id={`case-notes-${record.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="form-input"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => update({ outcome, notes })}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save outcome and notes'}
        </button>
        {!record.closedAt && (
          <button
            type="button"
            disabled={saving}
            onClick={() => update({ outcome, notes, closed: true })}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Close case
          </button>
        )}
      </div>
    </Card>
  );
}

export default function Cases() {
  const [items, setItems] = React.useState<CaseRecord[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeOption[]>([]);
  const [openOnly, setOpenOnly] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState('');

  const load = React.useCallback(() => {
    apiGet('/cases', openOnly ? { open: 1 } : undefined)
      .then(setItems)
      .catch((e: any) => setError(e.message || 'Could not load cases.'));
  }, [openOnly]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const created = await apiPost('/cases', {
        employeeId: Number(form.employeeId),
        type: form.type,
        openedAt: form.openedAt,
        stage: form.stage,
        outcome: form.outcome.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setItems((list) => [created, ...list]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || 'Failed to open the case.');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Employee relations cases</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="case-filter" className="sr-only">
            Show
          </label>
          <select
            id="case-filter"
            value={openOnly ? 'open' : 'all'}
            onChange={(e) => setOpenOnly(e.target.value === 'open')}
            className="form-input w-auto py-2"
          >
            <option value="open">Open cases</option>
            <option value="all">Open and closed</option>
          </select>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            <HiPlus /> {showForm ? 'Cancel' : 'Open a case'}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
        Strictly confidential. Disciplinary, grievance and capability records
        are visible to admins and directors only, they appear nowhere else in
        the product, and every read and change here is written to the audit log.
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
            Open a case
          </h3>
          <form onSubmit={createCase} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="case-employee"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Employee *
              </label>
              <select
                id="case-employee"
                value={form.employeeId}
                onChange={(e) =>
                  setForm({ ...form, employeeId: e.target.value })
                }
                className="form-input"
                required
              >
                <option value="">Select an employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="case-type"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Type *
              </label>
              <select
                id="case-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="form-input"
                required
              >
                {TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="case-opened"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Opened *
              </label>
              <input
                id="case-opened"
                type="date"
                value={form.openedAt}
                onChange={(e) => setForm({ ...form, openedAt: e.target.value })}
                className="form-input"
                required
              />
            </div>
            <div>
              <label
                htmlFor="case-initial-stage"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Stage *
              </label>
              <select
                id="case-initial-stage"
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="form-input"
                required
              >
                {STAGES.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="case-initial-notes"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Notes
              </label>
              <textarea
                id="case-initial-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Keep to the facts — the employee can ask for a copy of what is held about them."
                className="form-input"
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">
                Open case
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-6 text-center text-slate-600 dark:text-slate-400">
            {openOnly ? 'No open cases.' : 'No cases recorded.'}
          </Card>
        ) : (
          items.map((record) => (
            <CaseCard
              key={record.id}
              record={record}
              onUpdated={(updated) =>
                setItems((list) =>
                  list.map((it) => (it.id === updated.id ? updated : it)),
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
