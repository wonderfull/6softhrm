import React from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import Dialog from './Dialog';

// The HR file for one employee: performance reviews, the onboarding or
// offboarding checklist, and training. Employee relations cases are
// deliberately absent — they live on their own screen so a profile never
// reveals who has a live grievance.

type Review = {
  id: number;
  employeeId: number;
  reviewerId: number | null;
  type: string;
  dueDate: string;
  completedAt: string | null;
  rating: string | null;
  summary: string | null;
  reviewer?: { id: number; firstName: string; lastName: string } | null;
};

type ChecklistItem = {
  id: number;
  employeeId: number;
  kind: string;
  actionKey: string | null;
  title: string;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  sortOrder: number;
};

type TrainingRecord = {
  id: number;
  employeeId: number;
  title: string;
  provider: string | null;
  completedAt: string;
  expiresAt: string | null;
  certificate?: { id: number; name: string } | null;
};

export type EmployeeOption = {
  id: number;
  firstName: string;
  lastName: string;
};

type Tab = 'reviews' | 'checklist' | 'training';

const TABS: { key: Tab; label: string }[] = [
  { key: 'reviews', label: 'Reviews' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'training', label: 'Training' },
];

const REVIEW_TYPE_LABELS: Record<string, string> = {
  PROBATION: 'Probation',
  ANNUAL: 'Annual',
  MID_YEAR: 'Mid-year',
};

const RATINGS = [
  { value: 'EXCEEDS', label: 'Exceeds expectations' },
  { value: 'MEETS', label: 'Meets expectations' },
  { value: 'BELOW', label: 'Below expectations' },
  { value: 'TOO_EARLY', label: 'Too early to say' },
];

const RATING_LABELS: Record<string, string> = Object.fromEntries(
  RATINGS.map((r) => [r.value, r.label]),
);

const KIND_LABELS: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  OFFBOARDING: 'Offboarding',
};

const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB') : '—';

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700';

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function Reviews({
  employeeId,
  employees,
  canManage,
}: {
  employeeId: number;
  employees: EmployeeOption[];
  canManage: boolean;
}) {
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [error, setError] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [completing, setCompleting] = React.useState<Review | null>(null);
  const [decision, setDecision] = React.useState({
    rating: 'MEETS',
    summary: '',
  });
  const [form, setForm] = React.useState({
    type: 'ANNUAL',
    dueDate: '',
    reviewerId: '',
  });

  const load = React.useCallback(() => {
    apiGet('/reviews', { employeeId })
      .then(setReviews)
      .catch((e: any) => setError(e.message || 'Could not load reviews.'));
  }, [employeeId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/reviews', {
        employeeId,
        type: form.type,
        dueDate: form.dueDate,
        reviewerId: form.reviewerId ? Number(form.reviewerId) : undefined,
      });
      setForm({ type: 'ANNUAL', dueDate: '', reviewerId: '' });
      setAdding(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to schedule the review.');
    }
  }

  async function complete() {
    if (!completing) return;
    const id = completing.id;
    setCompleting(null);
    setError('');
    try {
      const updated = await apiPut(`/reviews/${id}`, {
        completed: true,
        rating: decision.rating,
        summary: decision.summary.trim() || undefined,
      });
      setReviews((list) => list.map((r) => (r.id === id ? updated : r)));
    } catch (e: any) {
      setError(e.message || 'Failed to complete the review.');
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {reviews.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No reviews recorded.
        </p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((review) => {
            const overdue =
              !review.completedAt && new Date(review.dueDate) < new Date();
            return (
              <li
                key={review.id}
                className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {REVIEW_TYPE_LABELS[review.type] ?? review.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      review.completedAt
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : overdue
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                    }`}
                  >
                    {review.completedAt
                      ? 'Complete'
                      : overdue
                        ? 'Overdue'
                        : 'Due'}
                  </span>
                </div>
                <div className="mt-1 text-slate-600 dark:text-slate-400">
                  Due {day(review.dueDate)}
                  {review.reviewer
                    ? ` · ${review.reviewer.firstName} ${review.reviewer.lastName}`
                    : ''}
                </div>
                {review.rating && (
                  <div className="mt-1 text-slate-700 dark:text-slate-300">
                    {RATING_LABELS[review.rating] ?? review.rating}
                  </div>
                )}
                {review.summary && (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    {review.summary}
                  </p>
                )}
                {canManage && !review.completedAt && (
                  <button
                    type="button"
                    onClick={() => {
                      setDecision({ rating: 'MEETS', summary: '' });
                      setCompleting(review);
                    }}
                    className="mt-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Mark complete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Probation reviews are scheduled automatically from the probation end
        date.
      </p>

      {canManage &&
        (adding ? (
          <form onSubmit={addReview} className="mt-3 space-y-2">
            <label className="block text-sm">
              <span className="font-medium">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputClass}
              >
                <option value="ANNUAL">Annual</option>
                <option value="MID_YEAR">Mid-year</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Due date</span>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Reviewer</span>
              <select
                value={form.reviewerId}
                onChange={(e) =>
                  setForm({ ...form, reviewerId: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Not assigned</option>
                {employees
                  .filter((employee) => employee.id !== employeeId)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary min-h-9 text-sm">
                Schedule review
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="btn-ghost min-h-9 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add a review
          </button>
        ))}

      <Dialog
        open={completing !== null}
        title="Complete this review"
        description={
          completing
            ? `${REVIEW_TYPE_LABELS[completing.type] ?? completing.type} review due ${day(completing.dueDate)}.`
            : undefined
        }
        onClose={() => setCompleting(null)}
      >
        <label className="block text-sm">
          <span className="font-medium">Rating</span>
          <select
            value={decision.rating}
            onChange={(e) =>
              setDecision({ ...decision, rating: e.target.value })
            }
            className={inputClass}
          >
            {RATINGS.map((rating) => (
              <option key={rating.value} value={rating.value}>
                {rating.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm">
          <span className="font-medium">Summary</span>
          <textarea
            rows={4}
            value={decision.summary}
            onChange={(e) =>
              setDecision({ ...decision, summary: e.target.value })
            }
            placeholder="What was agreed, and anything to pick up next time"
            className={inputClass}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCompleting(null)}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button type="button" onClick={complete} className="btn-primary">
            Save and complete
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function Checklist({
  employeeId,
  canManage,
}: {
  employeeId: number;
  canManage: boolean;
}) {
  const [items, setItems] = React.useState<ChecklistItem[]>([]);
  const [error, setError] = React.useState('');
  const [actionResults, setActionResults] = React.useState<string[]>([]);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    apiGet(`/checklists/${employeeId}`)
      .then(setItems)
      .catch((e: any) =>
        setError(e.message || 'Could not load the checklist.'),
      );
  }, [employeeId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function start(kind: string) {
    setError('');
    try {
      const created = await apiPost(`/checklists/${employeeId}`, { kind });
      setItems((list) => [...list, ...created]);
    } catch (e: any) {
      setError(e.message || 'Failed to start the checklist.');
    }
  }

  async function toggle(item: ChecklistItem, completed: boolean) {
    setError('');
    try {
      setBusyId(item.id);
      const updated = await apiPut(`/checklists/item/${item.id}`, {
        completed,
      });
      setItems((list) =>
        list.map((it) => (it.id === item.id ? { ...it, ...updated } : it)),
      );
      // Some items act as well as record — a revoked login or a retention date
      // set. Say so, or the tick quietly hides real consequences.
      if (updated.actionResult) {
        setActionResults((results) => [
          ...results,
          `${item.title}: ${updated.actionResult}`,
        ]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to update the item.');
    } finally {
      setBusyId(null);
    }
  }

  const kinds = ['ONBOARDING', 'OFFBOARDING'];

  return (
    <div>
      <ErrorBanner message={error} />
      {actionResults.length > 0 && (
        <div className="mb-3 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
          <p className="font-medium">What ticking that did:</p>
          <ul className="ml-4 list-disc">
            {actionResults.map((result) => (
              <li key={result}>{result}</li>
            ))}
          </ul>
        </div>
      )}
      {kinds.map((kind) => {
        const kindItems = items.filter((item) => item.kind === kind);
        const done = kindItems.filter((item) => item.completedAt).length;
        const percent = kindItems.length
          ? Math.round((done / kindItems.length) * 100)
          : 0;

        if (kindItems.length === 0) {
          return (
            <div key={kind} className="mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No {KIND_LABELS[kind].toLowerCase()} checklist yet.
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => start(kind)}
                  className="mt-2 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Start {KIND_LABELS[kind].toLowerCase()}
                </button>
              )}
            </div>
          );
        }

        return (
          <div key={kind} className="mb-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {KIND_LABELS[kind]}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {done} of {kindItems.length} done
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${KIND_LABELS[kind]} progress`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700"
            >
              <div
                className="h-2 rounded-full bg-primary-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <ul className="mt-2 space-y-1">
              {kindItems.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <input
                    id={`checklist-item-${item.id}`}
                    type="checkbox"
                    checked={!!item.completedAt}
                    disabled={!canManage || busyId === item.id}
                    onChange={(e) => toggle(item, e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor={`checklist-item-${item.id}`}
                    className="flex-1 text-slate-700 dark:text-slate-200"
                  >
                    {item.title}
                    {item.completedAt && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Done {day(item.completedAt)}
                        {item.completedBy ? ` by ${item.completedBy}` : ''}
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Training({
  employeeId,
  canManage,
  canDelete,
}: {
  employeeId: number;
  canManage: boolean;
  canDelete: boolean;
}) {
  const [records, setRecords] = React.useState<TrainingRecord[]>([]);
  const [error, setError] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({
    title: '',
    provider: '',
    completedAt: '',
    expiresAt: '',
  });

  const load = React.useCallback(() => {
    apiGet('/training', { employeeId })
      .then(setRecords)
      .catch((e: any) => setError(e.message || 'Could not load training.'));
  }, [employeeId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const created = await apiPost('/training', {
        employeeId,
        title: form.title,
        provider: form.provider.trim() || undefined,
        completedAt: form.completedAt,
        expiresAt: form.expiresAt || undefined,
      });
      setRecords((list) => [created, ...list]);
      setForm({ title: '', provider: '', completedAt: '', expiresAt: '' });
      setAdding(false);
    } catch (e: any) {
      setError(e.message || 'Failed to record the training.');
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this training record?')) return;
    setError('');
    try {
      await apiDelete(`/training/${id}`);
      setRecords((list) => list.filter((record) => record.id !== id));
    } catch (e: any) {
      setError(e.message || 'Failed to delete the record.');
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {records.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No training recorded.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => {
            const expired =
              !!record.expiresAt && new Date(record.expiresAt) < new Date();
            return (
              <li
                key={record.id}
                className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700"
              >
                <div className="font-semibold text-slate-900 dark:text-white">
                  {record.title}
                </div>
                <div className="mt-1 text-slate-600 dark:text-slate-400">
                  {record.provider ? `${record.provider} · ` : ''}completed{' '}
                  {day(record.completedAt)}
                </div>
                {record.expiresAt && (
                  <div
                    className={
                      expired
                        ? 'mt-1 font-semibold text-rose-700 dark:text-rose-300'
                        : 'mt-1 text-slate-600 dark:text-slate-400'
                    }
                  >
                    {expired ? 'Expired' : 'Expires'} {day(record.expiresAt)}
                  </div>
                )}
                {record.certificate && (
                  <div className="mt-1 text-slate-600 dark:text-slate-400">
                    Certificate: {record.certificate.name}
                  </div>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(record.id)}
                    className="mt-2 text-sm font-semibold text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManage &&
        (adding ? (
          <form onSubmit={add} className="mt-3 space-y-2">
            <label className="block text-sm">
              <span className="font-medium">Course</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Provider</span>
              <input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Completed</span>
              <input
                type="date"
                required
                value={form.completedAt}
                onChange={(e) =>
                  setForm({ ...form, completedAt: e.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Expires</span>
              <input
                type="date"
                min={form.completedAt || undefined}
                value={form.expiresAt}
                onChange={(e) =>
                  setForm({ ...form, expiresAt: e.target.value })
                }
                className={inputClass}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary min-h-9 text-sm">
                Add training
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="btn-ghost min-h-9 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add training
          </button>
        ))}
    </div>
  );
}

export default function EmployeeHrPanel({
  employeeId,
  employees,
  canManage,
  canDelete,
}: {
  employeeId: number;
  employees: EmployeeOption[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>('reviews');

  return (
    <div className="border-b border-slate-200 p-5 dark:border-slate-700">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        HR file
      </div>
      <div
        role="tablist"
        aria-label="HR file"
        className="mb-4 flex gap-1 rounded-md bg-slate-100 p-1 dark:bg-slate-900"
      >
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
            className={`flex-1 rounded px-2 py-1 text-sm font-semibold ${
              tab === entry.key
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {tab === 'reviews' && (
        <Reviews
          employeeId={employeeId}
          employees={employees}
          canManage={canManage}
        />
      )}
      {tab === 'checklist' && (
        <Checklist employeeId={employeeId} canManage={canManage} />
      )}
      {tab === 'training' && (
        <Training
          employeeId={employeeId}
          canManage={canManage}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}
