import React from 'react';
import { apiPost, apiPut } from '../lib/api';
import Dialog from './Dialog';
import { Button, Input } from './ui';

// Leaver retention: when the record may be anonymised, and the owner's
// "erase now" for subject requests, which strips the person but keeps the
// row so leave and timesheet history still adds up.

const day = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB') : null;

export default function DataRetentionPanel({
  employee,
  isAdmin,
  onChange,
}: {
  employee: {
    id: number;
    endDate?: string | null;
    retainUntil?: string | null;
    anonymisedAt?: string | null;
  };
  isAdmin: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [retainUntil, setRetainUntil] = React.useState(
    employee.retainUntil?.slice(0, 10) ?? '',
  );
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
      <p className="text-[13px] text-ink-2">
        Personal data erased on{' '}
        <span className="font-mono">{day(employee.anonymisedAt)}</span>. Only
        aggregate leave and timesheet history remains.
      </p>
    );
  }

  return (
    <div>
      {message && (
        <div className="mb-3 rounded-md bg-ok-tint px-3 py-2 text-[13px] text-ok">
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md bg-bad-tint px-3 py-2 text-[13px] text-bad"
        >
          {error}
        </div>
      )}
      <p className="text-sm text-ink">
        {employee.retainUntil
          ? `Keep until ${day(employee.retainUntil)}, then anonymise automatically.`
          : employee.endDate
            ? 'No retention date set.'
            : 'Set when an employment end date is recorded (6 years, or longer for sponsored workers).'}
      </p>
      {isAdmin && (
        <>
          <form
            onSubmit={saveRetainUntil}
            className="mt-4 flex items-end gap-2"
          >
            <Input
              label="Keep until"
              type="date"
              value={retainUntil}
              wrapperClassName="flex-1"
              onChange={(e) => setRetainUntil(e.target.value)}
            />
            <Button type="submit">Save</Button>
          </form>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() => setOpen(true)}
          >
            Erase personal data now
          </Button>
        </>
      )}

      <Dialog
        open={open}
        title="Erase personal data"
        description="Irreversible. Documents, identity checks, consents, sponsorship records and the login are deleted; the record is kept anonymised so history still adds up."
        onClose={() => setOpen(false)}
      >
        <form onSubmit={erase} className="space-y-3">
          <Input
            label="Reason (recorded in the audit log)"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Subject erasure request received 3 Sep 2026"
          />
          {blockers.length > 0 && (
            <div className="rounded-md bg-warn-tint px-3 py-2 text-[13px] text-warn">
              <p className="font-medium">Cannot erase yet:</p>
              <ul className="ml-4 list-disc">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-line-2 text-accent focus:ring-accent-tint"
                />
                <span>Override, I have a legal basis to erase now</span>
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Erase
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
