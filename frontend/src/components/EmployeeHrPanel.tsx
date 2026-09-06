import React from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/api';
import Dialog from './Dialog';
import { Badge, Button, Input, Select, Textarea } from './ui';

// The HR file for one employee: performance reviews, the onboarding or
// offboarding checklist, and training. Employee relations cases are
// deliberately absent, they live on their own screen so a profile never
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
  value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-3 rounded-md bg-bad-tint px-3 py-2 text-[13px] text-bad"
    >
      {message}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-md border border-line p-3 text-[13px]">
      {children}
    </li>
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
        <p className="text-[13px] text-ink-2">No reviews recorded.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((review) => {
            const overdue =
              !review.completedAt && new Date(review.dueDate) < new Date();
            return (
              <Card key={review.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-ink">
                    {REVIEW_TYPE_LABELS[review.type] ?? review.type}
                  </span>
                  <Badge
                    tone={review.completedAt ? 'ok' : overdue ? 'bad' : 'warn'}
                  >
                    {review.completedAt
                      ? 'Complete'
                      : overdue
                        ? 'Overdue'
                        : 'Due'}
                  </Badge>
                </div>
                <div className="mt-1 text-ink-2">
                  Due <span className="font-mono">{day(review.dueDate)}</span>
                  {review.reviewer
                    ? ` · ${review.reviewer.firstName} ${review.reviewer.lastName}`
                    : ''}
                </div>
                {review.rating && (
                  <div className="mt-1 text-ink">
                    {RATING_LABELS[review.rating] ?? review.rating}
                  </div>
                )}
                {review.summary && (
                  <p className="mt-1 text-ink-2">{review.summary}</p>
                )}
                {canManage && !review.completedAt && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setDecision({ rating: 'MEETS', summary: '' });
                      setCompleting(review);
                    }}
                  >
                    Mark complete
                  </Button>
                )}
              </Card>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-ink-3">
        Probation reviews are scheduled automatically from the probation end
        date.
      </p>

      {canManage &&
        (adding ? (
          <form onSubmit={addReview} className="mt-3 space-y-3">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="ANNUAL">Annual</option>
              <option value="MID_YEAR">Mid-year</option>
            </Select>
            <Input
              label="Due date"
              type="date"
              required
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <Select
              label="Reviewer"
              value={form.reviewerId}
              onChange={(e) => setForm({ ...form, reviewerId: e.target.value })}
            >
              <option value="">Not assigned</option>
              {employees
                .filter((employee) => employee.id !== employeeId)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
            </Select>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Schedule review
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setAdding(true)}
          >
            Add a review
          </Button>
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
        <div className="space-y-3">
          <Select
            label="Rating"
            value={decision.rating}
            onChange={(e) =>
              setDecision({ ...decision, rating: e.target.value })
            }
          >
            {RATINGS.map((rating) => (
              <option key={rating.value} value={rating.value}>
                {rating.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Summary"
            rows={4}
            value={decision.summary}
            onChange={(e) =>
              setDecision({ ...decision, summary: e.target.value })
            }
            placeholder="What was agreed, and anything to pick up next time"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button onClick={complete}>Save and complete</Button>
          </div>
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
      // Some items act as well as record: a revoked login or a retention date
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
        <div className="mb-3 rounded-md bg-accent-tint px-3 py-2 text-[13px] text-link">
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
              <p className="text-[13px] text-ink-2">
                No {KIND_LABELS[kind].toLowerCase()} checklist yet.
              </p>
              {canManage && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => start(kind)}
                >
                  Start {KIND_LABELS[kind].toLowerCase()}
                </Button>
              )}
            </div>
          );
        }

        return (
          <div key={kind} className="mb-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-ink">
                {KIND_LABELS[kind]}
              </span>
              <span className="text-xs text-ink-3">
                {done} of {kindItems.length} done
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${KIND_LABELS[kind]} progress`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1.5 h-1 rounded-full bg-surface-3"
            >
              <div
                className="h-1 rounded-full bg-accent transition-[width] duration-state ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
            <ul className="mt-3 space-y-1.5">
              {kindItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 text-[13px]"
                >
                  <input
                    id={`checklist-item-${item.id}`}
                    type="checkbox"
                    checked={!!item.completedAt}
                    disabled={!canManage || busyId === item.id}
                    onChange={(e) => toggle(item, e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded-sm border-line-2 text-accent focus:ring-accent-tint"
                  />
                  <label
                    htmlFor={`checklist-item-${item.id}`}
                    className="flex-1 text-ink"
                  >
                    {item.title}
                    {item.completedAt && (
                      <span className="block text-xs text-ink-3">
                        Done{' '}
                        <span className="font-mono">
                          {day(item.completedAt)}
                        </span>
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
  const [removing, setRemoving] = React.useState<TrainingRecord | null>(null);
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
    setRemoving(null);
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
        <p className="text-[13px] text-ink-2">No training recorded.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => {
            const expired =
              !!record.expiresAt && new Date(record.expiresAt) < new Date();
            return (
              <Card key={record.id}>
                <div className="font-medium text-ink">{record.title}</div>
                <div className="mt-1 text-ink-2">
                  {record.provider ? `${record.provider} · ` : ''}completed{' '}
                  <span className="font-mono">{day(record.completedAt)}</span>
                </div>
                {record.expiresAt && (
                  <div
                    className={expired ? 'mt-1 text-bad' : 'mt-1 text-ink-2'}
                  >
                    {expired ? 'Expired' : 'Expires'}{' '}
                    <span className="font-mono">{day(record.expiresAt)}</span>
                  </div>
                )}
                {record.certificate && (
                  <div className="mt-1 text-ink-2">
                    Certificate: {record.certificate.name}
                  </div>
                )}
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-2"
                    onClick={() => setRemoving(record)}
                  >
                    Delete
                  </Button>
                )}
              </Card>
            );
          })}
        </ul>
      )}

      {canManage &&
        (adding ? (
          <form onSubmit={add} className="mt-3 space-y-3">
            <Input
              label="Course"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              label="Provider"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
            <Input
              label="Completed"
              type="date"
              required
              value={form.completedAt}
              onChange={(e) =>
                setForm({ ...form, completedAt: e.target.value })
              }
            />
            <Input
              label="Expires"
              type="date"
              min={form.completedAt || undefined}
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Add training
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setAdding(true)}
          >
            Add training
          </Button>
        ))}

      <Dialog
        open={removing !== null}
        title="Delete this training record?"
        description={
          removing
            ? `${removing.title} is removed from this employee's HR file.`
            : undefined
        }
        onClose={() => setRemoving(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => removing && remove(removing.id)}
          >
            Delete record
          </Button>
        </div>
      </Dialog>
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
    <div>
      <div
        role="tablist"
        aria-label="HR file"
        className="mb-4 flex gap-1 rounded-md bg-surface-2 p-1"
      >
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => setTab(entry.key)}
            className={`flex-1 rounded-sm px-2 py-1 text-[13px] font-medium transition-colors duration-hover ease-out ${
              tab === entry.key
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-2 hover:text-ink'
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
