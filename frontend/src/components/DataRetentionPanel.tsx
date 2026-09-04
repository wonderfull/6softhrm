import React from 'react';
import { apiPost, apiPut } from '../lib/api';
import Dialog from './Dialog';

// Leaver retention: when the record may be anonymised, and the owner's
// "erase now" for subject requests — which strips the person but keeps the
// row so leave and timesheet history still adds up.

const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB') : null;

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700';

export default function DataRetentionPanel({
  employee,
  isAdmin,
  onChange,
}: {
  employee: { id: number; endDate?: string | null; retainUntil?: string | null; anonymisedAt?: string | null };
  isAdmin: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [retainUntil, setRetainUntil] = React.useState(employee.retainUntil?.slice(0, 10) ?? '');
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [force, setForce] = React.useState(false);
  const [blockers, setBlockers] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setRetainUntil(employee.retainUntil?.slice(0, 10) ?? '');
    setMessage('');
    setError('');
    setBlockers([]);
  }, [employee.id, employee.retainUntil]);

  async function saveRetainUntil(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiPut(`/employees/${employee.id}`, { retainUntil });
      setMessage('Retention date saved.');
      await onChange();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function erase(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiPost(`/gdpr/erase/${employee.id}`, { reason, force });
      setOpen(false);
      setReason('');
      setForce(false);
      setBlockers([]);
      await onChange();
    } catch (e: any) {
      // The API lists what stands in the way; surface it and offer the override.
      const match = /^Cannot erase: (.+)$/.exec(e.message || '');
      if (match) setBlockers(match[1].split('; '));
      else setError(e.message);
    }
  }

  if (employee.anonymisedAt) {
    return (
      <div className="border-b border-slate-200 p-5 dark:border-slate-700">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Data retention
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Personal data erased on {day(employee.anonymisedAt)}. Only aggregate leave and
          timesheet history remains.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-200 p-5 dark:border-slate-700">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Data retention
      </div>
      {message && (
        <div className="mb-3 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}
      <p className="text-sm text-slate-900 dark:text-slate-100">
        {employee.retainUntil
          ? `Keep until ${day(employee.retainUntil)}, then anonymise automatically.`
          : employee.endDate
            ? 'No retention date set.'
            : 'Set when an employment end date is recorded (6 years, or longer for sponsored workers).'}
      </p>
      {isAdmin && (
        <>
          <form onSubmit={saveRetainUntil} className="mt-3 flex items-end gap-2">
            <label className="block flex-1 text-sm">
              <span className="font-medium">Keep until</span>
              <input
                type="date"
                value={retainUntil}
                onChange={(e) => setRetainUntil(e.target.value)}
                className={inputClass}
              />
            </label>
            <button type="submit" className="btn-primary min-h-10">
              Save
            </button>
          </form>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 text-sm font-semibold text-red-600 hover:underline"
          >
            Erase personal data now
          </button>
        </>
      )}

      <Dialog
        open={open}
        title="Erase personal data"
        description="Irreversible. Documents, identity checks, consents, sponsorship records and the login are deleted; the record is kept anonymised so history still adds up."
        onClose={() => setOpen(false)}
      >
        <form onSubmit={erase} className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Reason (recorded in the audit log)</span>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Subject erasure request received 3 Sep 2026"
              className={inputClass}
            />
          </label>
          {blockers.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              <p className="font-medium">Cannot erase yet:</p>
              <ul className="ml-4 list-disc">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                <span>Override — I have a legal basis to erase now</span>
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Erase
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
