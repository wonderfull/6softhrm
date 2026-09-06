import React from 'react';
import { apiDelete, apiGet, apiPost, apiPut, getCurrentUser } from '../lib/api';
import Card from '../components/Card';
import Dialog from '../components/Dialog';
import { HiPlus } from 'react-icons/hi';
import { isElevatedRole, normalizeRole } from '../lib/roles';
import { Badge, Button } from '../components/ui';

// Expense claims. The API already scopes the list to what the viewer may see —
// their own claims plus their reports' — so the page only has to sort what
// comes back into "mine" and "someone else's", and let the server refuse
// anything it disagrees with.

type Expense = {
 id: number;
 employeeId: number;
 date: string;
 category: string;
 amount: number;
 description: string | null;
 status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
 decidedBy: number | null;
 decidedAt: string | null;
 decisionNote: string | null;
 receipt: { id: number; name: string } | null;
 employee?: {
 id: number;
 firstName: string;
 lastName: string;
 department?: string | null;
  } | null;
};

const CATEGORIES = [
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'SUBSISTENCE', label: 'Subsistence' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
 CATEGORIES.map((c) => [c.value, c.label]),
);

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  PENDING: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
  PAID: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PAID: 'Paid',
};

const gbp = new Intl.NumberFormat('en-GB', {
 style: 'currency',
 currency: 'GBP',
});

const day = (value: string) => new Date(value).toLocaleDateString('en-GB');

const emptyForm = {
 date: '',
 category: 'TRAVEL',
 amount: '',
 description: '',
 receiptDocumentId: '',
};

export default function Expenses() {
 const user = getCurrentUser();
 const role = normalizeRole(user?.role);
 const isElevated = isElevatedRole(role);
 const ownEmployeeId = user?.employeeId ? Number(user.employeeId) : null;

 const [items, setItems] = React.useState<Expense[]>([]);
 const [statusFilter, setStatusFilter] = React.useState('');
 const [receipts, setReceipts] = React.useState<
    { id: number; name: string }[]
  >([]);
 const [showForm, setShowForm] = React.useState(false);
 const [form, setForm] = React.useState(emptyForm);
 const [busyId, setBusyId] = React.useState<number | null>(null);
 const [decision, setDecision] = React.useState<{
 id: number;
 action: 'approve' | 'reject';
  } | null>(null);
 const [decisionNote, setDecisionNote] = React.useState('');
 const [message, setMessage] = React.useState('');
 const [error, setError] = React.useState('');

 const load = React.useCallback(() => {
 apiGet('/expenses', statusFilter ? { status: statusFilter } : undefined)
      .then(setItems)
      .catch((e: any) =>
 setError(e.message || 'Could not load expense claims.'),
      );
  }, [statusFilter]);

 React.useEffect(() => {
 load();
  }, [load]);

  // A receipt is a document already filed against the claimant, so nothing has
  // to be uploaded twice to attach one.
 React.useEffect(() => {
 if (!ownEmployeeId) return;
 apiGet('/documents', { employeeId: ownEmployeeId })
      .then((docs: any[]) =>
 setReceipts(docs.map((d) => ({ id: d.id, name: d.name }))),
      )
      .catch(() => setReceipts([]));
  }, [ownEmployeeId]);

 const replace = (updated: Expense) =>
 setItems((list) => list.map((it) => (it.id === updated.id ? updated : it)));

 async function submitClaim(e: React.FormEvent) {
 e.preventDefault();
 setError('');
 setMessage('');
 try {
 await apiPost('/expenses', {
 date: form.date,
 category: form.category,
 amount: Number(form.amount),
 description: form.description.trim() || undefined,
 receiptDocumentId: form.receiptDocumentId
          ? Number(form.receiptDocumentId)
          : undefined,
      });
 setForm(emptyForm);
 setShowForm(false);
 setMessage('Claim submitted for approval.');
 load();
    } catch (e: any) {
 setError(e.message || 'Failed to submit the claim.');
    }
  }

 async function submitDecision() {
 if (!decision) return;
 const { id, action } = decision;
 const note = decisionNote.trim();
 setDecision(null);
 setDecisionNote('');
 setError('');
 try {
 setBusyId(id);
 replace(await apiPut(`/expenses/${id}/${action}`, note ? { note } : {}));
    } catch (e: any) {
 setError(e.message || `Failed to ${action} the claim.`);
    } finally {
 setBusyId(null);
    }
  }

 async function markPaid(id: number) {
 setError('');
 try {
 setBusyId(id);
 replace(await apiPut(`/expenses/${id}/paid`, {}));
    } catch (e: any) {
 setError(e.message || 'Failed to record the payment.');
    } finally {
 setBusyId(null);
    }
  }

 async function withdraw(id: number) {
 if (!confirm('Withdraw this claim?')) return;
 setError('');
 try {
 setBusyId(id);
 await apiDelete(`/expenses/${id}`);
 setItems((list) => list.filter((it) => it.id !== id));
    } catch (e: any) {
 setError(e.message || 'Failed to withdraw the claim.');
    } finally {
 setBusyId(null);
    }
  }

 const isOwn = (expense: Expense) =>
 ownEmployeeId !== null && expense.employeeId === ownEmployeeId;
 const own = items.filter(isOwn);
 const others = items.filter((expense) => !isOwn(expense));
 const toDecide = others.filter((expense) => expense.status === 'PENDING');
 const settled = others.filter((expense) => expense.status !== 'PENDING');

 function claim(expense: Expense) {
 const busy = busyId === expense.id;
    // A pending claim that isn't yours is one you were given to decide; the
    // API is the authority on that, and it refuses a claimant deciding their
    // own.
 const canDecide = expense.status === 'PENDING' && !isOwn(expense);
 return (
      <Card key={expense.id} className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <div className="font-bold text-ink">
              {gbp.format(Number(expense.amount))}
              <span className="ml-2 text-sm font-medium text-ink-2">
                {CATEGORY_LABELS[expense.category] ?? expense.category} ·{' '}
                {day(expense.date)}
              </span>
            </div>
            {expense.employee && !isOwn(expense) && (
              <div className="mt-1 text-sm text-ink-2">
                {expense.employee.firstName} {expense.employee.lastName}
                {expense.employee.department
                  ? ` · ${expense.employee.department}`
                  : ''}
              </div>
            )}
            {expense.description && (
              <div className="mt-1 text-sm text-ink-2">
                {expense.description}
              </div>
            )}
            {expense.receipt && (
              <div className="mt-1 text-sm text-ink-2">
                <span className="font-medium">Receipt:</span>{' '}
                {expense.receipt.name}
              </div>
            )}
            {expense.decisionNote && (
              <div className="mt-1 text-sm text-ink-2">
                <span className="font-medium">Decision note:</span>{' '}
                {expense.decisionNote}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[expense.status] ?? 'neutral'}>
                {STATUS_LABEL[expense.status] ?? expense.status}
              </Badge>
              {expense.decidedAt && (
                <span className="text-xs text-ink-3">
 Decided {day(expense.decidedAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDecide && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setDecisionNote('');
                    setDecision({ id: expense.id, action: 'approve' });
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setDecisionNote('');
                    setDecision({ id: expense.id, action: 'reject' });
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {isElevated && expense.status === 'APPROVED' && (
              <Button size="sm" disabled={busy} onClick={() => markPaid(expense.id)}>
                Mark paid
              </Button>
            )}
            {isOwn(expense) && expense.status === 'PENDING' && (
              <button
 type="button"
 disabled={busy}
 onClick={() => withdraw(expense.id)}
 className="rounded-lg border border-line-2 px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-surface-2 disabled:opacity-50 "
              >
 Withdraw
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  }

 return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Expenses</h2>
          <p className="mt-1 text-sm text-ink-2">
 Claims are paid in pounds sterling once approved and marked paid.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="expense-status" className="sr-only">
 Status
          </label>
          <select
 id="expense-status"
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="form-input w-auto py-2"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="PAID">Paid</option>
          </select>
          {ownEmployeeId && (
            <button
 type="button"
 onClick={() => setShowForm(!showForm)}
 className="btn-primary"
            >
              <HiPlus /> {showForm ? 'Cancel' : 'New claim'}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-md border border-ok bg-ok-tint px-3 py-2 text-sm text-ok ">
          {message}
        </div>
      )}

      {error && (
        <div
 role="alert"
 className="mb-6 rounded-md border border-bad bg-bad-tint px-3 py-2 text-sm text-bad "
        >
          {error}
        </div>
      )}

      {!ownEmployeeId && (
        <div className="mb-6 rounded-lg border border-warn bg-warn-tint px-4 py-2 text-sm text-warn">
 Your account is not linked to an employee record, so you cannot file a
 claim of your own.
        </div>
      )}

      {showForm && ownEmployeeId && (
        <Card className="mb-6 p-6">
          <h3 className="mb-4 text-lg font-semibold text-ink ">
 New expense claim
          </h3>
          <form onSubmit={submitClaim} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
 htmlFor="expense-date"
 className="mb-2 block text-sm font-medium text-ink-2"
              >
 Date of spend *
              </label>
              <input
 id="expense-date"
 type="date"
 value={form.date}
 onChange={(e) => setForm({ ...form, date: e.target.value })}
 className="form-input"
 required
              />
            </div>
            <div>
              <label
 htmlFor="expense-category"
 className="mb-2 block text-sm font-medium text-ink-2"
              >
 Category *
              </label>
              <select
 id="expense-category"
 value={form.category}
 onChange={(e) => setForm({ ...form, category: e.target.value })}
 className="form-input"
 required
              >
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
 htmlFor="expense-amount"
 className="mb-2 block text-sm font-medium text-ink-2"
              >
 Amount (£) *
              </label>
              <input
 id="expense-amount"
 type="number"
 min="0"
 step="0.01"
 value={form.amount}
 onChange={(e) => setForm({ ...form, amount: e.target.value })}
 className="form-input"
 required
              />
            </div>
            <div>
              <label
 htmlFor="expense-receipt"
 className="mb-2 block text-sm font-medium text-ink-2"
              >
 Receipt
              </label>
              <select
 id="expense-receipt"
 value={form.receiptDocumentId}
 onChange={(e) =>
 setForm({ ...form, receiptDocumentId: e.target.value })
                }
 className="form-input"
              >
                <option value="">No receipt attached</option>
                {receipts.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {receipt.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-3">
 Upload it on the Documents page first to attach it here.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label
 htmlFor="expense-description"
 className="mb-2 block text-sm font-medium text-ink-2"
              >
 Description
              </label>
              <textarea
 id="expense-description"
 value={form.description}
 onChange={(e) =>
 setForm({ ...form, description: e.target.value })
                }
 className="form-input"
 rows={3}
 placeholder="What the spend was for"
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">
 Submit claim
              </button>
            </div>
          </form>
        </Card>
      )}

      {toDecide.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-ink ">
 To approve ({toDecide.length})
          </h3>
          <div className="space-y-3">{toDecide.map(claim)}</div>
        </section>
      )}

      <section className="mb-8">
        <h3 className="mb-3 text-lg font-semibold text-ink ">
 Your claims
        </h3>
        {own.length === 0 ? (
          <Card className="p-6 text-center text-ink-2">
 You have no expense claims{statusFilter ? ' with this status' : ''}.
          </Card>
        ) : (
          <div className="space-y-3">{own.map(claim)}</div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-semibold text-ink ">
 Already decided
          </h3>
          <div className="space-y-3">{settled.map(claim)}</div>
        </section>
      )}

      <Dialog
 open={decision !== null}
 title={
 decision?.action === 'reject' ? 'Reject this claim' : 'Approve claim'
        }
 description="The note is stored with the decision and shown to the claimant."
 onClose={() => setDecision(null)}
      >
        <label
 htmlFor="expense-decision-note"
 className="mb-2 block text-sm font-medium text-ink-2"
        >
 Note (optional)
        </label>
        <textarea
 id="expense-decision-note"
 value={decisionNote}
 onChange={(e) => setDecisionNote(e.target.value)}
 className="form-input"
 rows={3}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
 type="button"
 onClick={() => setDecision(null)}
 className="rounded-lg border border-line-2 px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 "
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
