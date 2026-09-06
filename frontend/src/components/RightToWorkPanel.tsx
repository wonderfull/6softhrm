import React from 'react';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import Dialog from './Dialog';
import { Badge, Button, Input, Select, Textarea } from './ui';

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
  value ? new Date(value).toLocaleDateString('en-GB') : 'Not set';

const daysUntil = (value: string) =>
  Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);

export function recheckBadge(check?: RightToWorkCheck | null) {
  if (!check || check.outcome !== 'PASS') return null;
  if (!check.recheckDue) return null;
  const days = daysUntil(check.recheckDue);
  if (days < 0) return { tone: 'bad' as const, text: `RTW recheck overdue` };
  if (days <= 90)
    return {
      tone: 'warn' as const,
      text: `RTW recheck in ${days} day${days === 1 ? '' : 's'}`,
    };
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
  const [removing, setRemoving] = React.useState<RightToWorkCheck | null>(null);
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
        shareCode:
          form.method === 'HOME_OFFICE_ONLINE' ? form.shareCode : undefined,
        recheckDue:
          form.timeLimited && form.recheckDue ? form.recheckDue : undefined,
        documentId: form.documentId ? Number(form.documentId) : undefined,
        notes: form.notes || undefined,
      });
      setOpen(false);
      setForm((f) => ({
        ...f,
        shareCode: '',
        recheckDue: '',
        documentId: '',
        notes: '',
      }));
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(check: RightToWorkCheck) {
    setRemoving(null);
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
    <div>
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md bg-bad-tint px-3 py-2 text-[13px] text-bad"
        >
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!latest ? (
            <p className="text-[13px] text-ink-2">
              No right-to-work check recorded.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={latest.outcome === 'PASS' ? 'ok' : 'bad'}>
                  {latest.outcome === 'PASS' ? 'Checked' : 'Failed'}{' '}
                  {day(latest.checkDate)}
                </Badge>
                {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
              </div>
              <div className="mt-2 text-[13px] text-ink-2">
                {METHOD_LABEL[latest.method]}
                {latest.timeLimited &&
                  ` · time-limited, recheck by ${day(latest.recheckDue)}`}
                {latest.document && ` · ${latest.document.name}`}
              </div>
            </>
          )}
        </div>
        {canRecord && (
          <Button variant="secondary" size="sm" onClick={openDialog}>
            Record check
          </Button>
        )}
      </div>

      {checks.length > 1 && (
        <details className="mt-4 text-[13px]">
          <summary className="cursor-pointer text-ink-2">
            History ({checks.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {checks.map((check) => (
              <li
                key={check.id}
                className="flex items-center justify-between gap-2 border-b border-line pb-1.5 last:border-b-0"
              >
                <span className="text-ink-2">
                  <span className="font-mono">{day(check.checkDate)}</span> ·{' '}
                  {METHOD_LABEL[check.method]} · {check.outcome}
                  {check.recheckDue && (
                    <>
                      {' · recheck '}
                      <span className="font-mono">{day(check.recheckDue)}</span>
                    </>
                  )}
                </span>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRemoving(check)}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {checks.length === 1 && canDelete && (
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() => setRemoving(latest)}
        >
          Delete check
        </Button>
      )}

      <Dialog
        open={open}
        title="Record right-to-work check"
        description="Kept as evidence for Appendix D 2(a). A passed check is attached to every active sponsorship."
        onClose={() => setOpen(false)}
      >
        <form onSubmit={submit} className="space-y-3">
          <Select
            label="Method"
            value={form.method}
            onChange={(e) =>
              setForm({
                ...form,
                method: e.target.value as RightToWorkCheck['method'],
              })
            }
          >
            <option value="HOME_OFFICE_ONLINE">
              Home Office online check (share code)
            </option>
            <option value="IDVT">IDVT, certified digital identity check</option>
            <option value="MANUAL">Manual check of original documents</option>
          </Select>
          <Input
            label="Date of check"
            type="date"
            required
            value={form.checkDate}
            onChange={(e) => setForm({ ...form, checkDate: e.target.value })}
          />
          {form.method === 'HOME_OFFICE_ONLINE' && (
            <Input
              label="Share code"
              required
              value={form.shareCode}
              onChange={(e) =>
                setForm({ ...form, shareCode: e.target.value.toUpperCase() })
              }
              placeholder="e.g. W1A 2B3 C4D"
              className="font-mono"
            />
          )}
          <Select
            label="Outcome"
            value={form.outcome}
            onChange={(e) =>
              setForm({
                ...form,
                outcome: e.target.value as RightToWorkCheck['outcome'],
              })
            }
          >
            <option value="PASS">Pass, right to work confirmed</option>
            <option value="FAIL">Fail, no right to work</option>
          </Select>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={form.timeLimited}
              onChange={(e) =>
                setForm({ ...form, timeLimited: e.target.checked })
              }
              className="h-4 w-4 rounded-sm border-line-2 text-accent focus:ring-accent-tint"
            />
            <span>Time-limited permission (follow-up check required)</span>
          </label>
          {form.timeLimited && (
            <Input
              label="Recheck due"
              type="date"
              value={form.recheckDue}
              onChange={(e) => setForm({ ...form, recheckDue: e.target.value })}
              help={
                visaExpiryDate
                  ? `Leave blank to use the visa expiry (${day(visaExpiryDate)}).`
                  : 'Required, no visa expiry is on record to fall back on.'
              }
            />
          )}
          <Select
            label="Evidence document (optional)"
            value={form.documentId}
            onChange={(e) => setForm({ ...form, documentId: e.target.value })}
          >
            <option value="">None</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Textarea
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save check
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={removing !== null}
        title="Delete this check?"
        description={
          removing
            ? `The ${day(removing.checkDate)} right-to-work check is removed from the evidence trail.`
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
            onClick={() => removing && remove(removing)}
          >
            Delete check
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
