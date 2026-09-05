import React from 'react';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import Dialog from './Dialog';

// Right-to-work history for one employee. The newest passed check is what the
// compliance pack and the recheck reminders read, so every check is kept.

export type RightToWorkCheck = {
  id: number;
  checkDate: string;
  method: 'MANUAL' | 'IDVT' | 'HOME_OFFICE_ONLINE';
  shareCode?: string | null;
  outcome: 'PASS' | 'FAIL';
  timeLimited: boolean;
  recheckDue?: string | null;
  documentId?: number | null;
  document?: { id: number; name: string; type: string } | null;
  notes?: string | null;
  createdAt: string;
};

type DocumentOption = { id: number; name: string };

const METHOD_LABEL: Record<RightToWorkCheck['method'], string> = {
  MANUAL: 'Manual document check',
  IDVT: 'IDVT (digital identity)',
  HOME_OFFICE_ONLINE: 'Home Office online check',
};

const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB') : '—';

const daysUntil = (value: string) =>
  Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700';

export function recheckBadge(check?: RightToWorkCheck | null) {
  if (!check || check.outcome !== 'PASS') return null;
  if (!check.recheckDue) return null;
  const days = daysUntil(check.recheckDue);
  if (days < 0) return { tone: 'red', text: `RTW recheck overdue` };
  if (days <= 90) return { tone: 'amber', text: `RTW recheck in ${days} day${days === 1 ? '' : 's'}` };
  return null;
}

export default function RightToWorkPanel({
  employeeId,
  visaExpiryDate,
  canRecord,
  canDelete,
  onChange,
}: {
  employeeId: number;
  visaExpiryDate?: string | null;
  canRecord: boolean;
  canDelete: boolean;
  onChange?: (latest: RightToWorkCheck | null) => void;
}) {
  const [checks, setChecks] = React.useState<RightToWorkCheck[]>([]);
  const [documents, setDocuments] = React.useState<DocumentOption[]>([]);
  const [error, setError] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    method: 'HOME_OFFICE_ONLINE' as RightToWorkCheck['method'],
    checkDate: new Date().toISOString().slice(0, 10),
    shareCode: '',
    outcome: 'PASS' as RightToWorkCheck['outcome'],
    timeLimited: false,
    recheckDue: '',
    documentId: '',
    notes: '',
  });

  const load = React.useCallback(async () => {
    try {
      const rows = await apiGet(`/employees/${employeeId}/rtw`);
      setChecks(rows);
      onChange?.(rows[0] ?? null);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, [employeeId, onChange]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function openDialog() {
    setOpen(true);
    if (!canRecord) return;
    try {
      const docs = await apiGet('/documents', { employeeId });
      setDocuments(docs.map((d: any) => ({ id: d.id, name: d.name })));
    } catch {
      setDocuments([]);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPost(`/employees/${employeeId}/rtw`, {
        ...form,
        shareCode: form.method === 'HOME_OFFICE_ONLINE' ? form.shareCode : undefined,
        recheckDue: form.timeLimited && form.recheckDue ? form.recheckDue : undefined,
        documentId: form.documentId ? Number(form.documentId) : undefined,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setForm((f) => ({ ...f, shareCode: '', recheckDue: '', documentId: '', notes: '' }));
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(check: RightToWorkCheck) {
    if (!confirm(`Delete the ${day(check.checkDate)} right-to-work check?`)) return;
    try {
      await apiDelete(`/employees/${employeeId}/rtw/${check.id}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const latest = checks[0];
  const badge = recheckBadge(latest);

  return (
    <div className="border-b border-slate-200 p-5 dark:border-slate-700">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Right to work
        </div>
        {canRecord && (
          <button
            type="button"
            onClick={openDialog}
            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Record check
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {!latest ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No right-to-work check recorded.
        </p>
      ) : (
        <div className="text-sm text-slate-900 dark:text-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-semibold ${
                latest.outcome === 'PASS'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}
            >
              {latest.outcome === 'PASS' ? 'Checked' : 'Failed'} {day(latest.checkDate)}
            </span>
            {badge && (
              <span
                className={`inline-flex min-h-6 items-center rounded-full border px-2 text-xs font-semibold ${
                  badge.tone === 'red'
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          <div className="mt-2 text-slate-600 dark:text-slate-400">
            {METHOD_LABEL[latest.method]}
            {latest.timeLimited && ` · time-limited, recheck by ${day(latest.recheckDue)}`}
            {latest.document && ` · ${latest.document.name}`}
          </div>
        </div>
      )}

      {checks.length > 1 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-400">
            History ({checks.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {checks.map((check) => (
              <li key={check.id} className="flex items-center justify-between gap-2">
                <span>
                  {day(check.checkDate)} · {METHOD_LABEL[check.method]} · {check.outcome}
                  {check.recheckDue && ` · recheck ${day(check.recheckDue)}`}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => remove(check)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {checks.length === 1 && canDelete && (
        <button
          type="button"
          onClick={() => remove(latest)}
          className="mt-2 text-xs text-red-600 hover:underline"
        >
          Delete check
        </button>
      )}

      <Dialog
        open={open}
        title="Record right-to-work check"
        description="Kept as evidence for Appendix D 2(a). A passed check is attached to every active sponsorship."
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Method</span>
            <select
              value={form.method}
              onChange={(e) =>
                setForm({ ...form, method: e.target.value as RightToWorkCheck['method'] })
              }
              className={inputClass}
            >
              <option value="HOME_OFFICE_ONLINE">Home Office online check (share code)</option>
              <option value="IDVT">IDVT — certified digital identity check</option>
              <option value="MANUAL">Manual check of original documents</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Date of check</span>
            <input
              type="date"
              required
              value={form.checkDate}
              onChange={(e) => setForm({ ...form, checkDate: e.target.value })}
              className={inputClass}
            />
          </label>
          {form.method === 'HOME_OFFICE_ONLINE' && (
            <label className="block text-sm">
              <span className="font-medium">Share code</span>
              <input
                required
                value={form.shareCode}
                onChange={(e) => setForm({ ...form, shareCode: e.target.value.toUpperCase() })}
                placeholder="e.g. W1A 2B3 C4D"
                className={inputClass}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium">Outcome</span>
            <select
              value={form.outcome}
              onChange={(e) =>
                setForm({ ...form, outcome: e.target.value as RightToWorkCheck['outcome'] })
              }
              className={inputClass}
            >
              <option value="PASS">Pass — right to work confirmed</option>
              <option value="FAIL">Fail — no right to work</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.timeLimited}
              onChange={(e) => setForm({ ...form, timeLimited: e.target.checked })}
            />
            <span>Time-limited permission (follow-up check required)</span>
          </label>
          {form.timeLimited && (
            <label className="block text-sm">
              <span className="font-medium">Recheck due</span>
              <input
                type="date"
                value={form.recheckDue}
                onChange={(e) => setForm({ ...form, recheckDue: e.target.value })}
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-slate-500">
                {visaExpiryDate
                  ? `Leave blank to use the visa expiry (${day(visaExpiryDate)}).`
                  : 'Required — no visa expiry is on record to fall back on.'}
              </span>
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium">Evidence document (optional)</span>
            <select
              value={form.documentId}
              onChange={(e) => setForm({ ...form, documentId: e.target.value })}
              className={inputClass}
            >
              <option value="">None</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save check'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
