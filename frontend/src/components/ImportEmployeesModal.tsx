import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL, apiUpload } from '../lib/api';
import { Badge, Button, Table, Td, Th } from './ui';
import { IconButton } from './employees/Bits';

type PlanRow = {
  row: number;
  email: string;
  action: 'create' | 'update' | 'error';
  errors: string[];
};

type ImportResult = {
  dryRun: boolean;
  summary: {
    total: number;
    creates: number;
    updates: number;
    errors: number;
    created?: number;
    updated?: number;
  };
  rows: PlanRow[];
};

const ACTION_TONE: Record<PlanRow['action'], 'ok' | 'warn' | 'bad'> = {
  create: 'ok',
  update: 'warn',
  error: 'bad',
};

export default function ImportEmployeesModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportResult | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function downloadTemplate() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/employees/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onsidehr-employee-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async function runDryRun(selected: File) {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', selected);
      const res = await apiUpload('/employees/import?dryRun=true', formData);
      setPreview(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiUpload('/employees/import', formData);
      setResult(res);
      onImported();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const importable = preview
    ? preview.summary.creates + preview.summary.updates
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import employees"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-[fade-in_200ms_var(--ease-out)] motion-reduce:animate-none"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-lg animate-[dialog-in_320ms_var(--ease-out)] motion-reduce:animate-none">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-ink">
              Import employees
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Upload a CSV or Excel file. Existing employees are matched by
              email and updated; new emails create records.
            </p>
          </div>
          <IconButton label="Close import" onClick={onClose}>
            <XMarkIcon className="h-4 w-4" />
          </IconButton>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-bad-tint px-4 py-3 text-[13px] text-bad"
          >
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md bg-ok-tint px-4 py-3 text-[13px] text-ok">
              Import complete: {result.summary.created} created,{' '}
              {result.summary.updated} updated
              {result.summary.errors
                ? `, ${result.summary.errors} rows skipped with errors`
                : ''}
              .
            </div>
            {result.rows.length > 0 && (
              <ul className="list-disc pl-5 text-[13px] text-bad">
                {result.rows.map((r) => (
                  <li key={r.row}>
                    Row {r.row} ({r.email || 'no email'}): {r.errors.join('; ')}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="btn-secondary h-9 cursor-pointer px-3.5">
                {file ? 'Choose a different file' : 'Choose file'}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    setFile(selected);
                    if (selected) runDryRun(selected);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-[13px] font-medium text-link hover:underline"
              >
                Download template CSV
              </button>
              {file && (
                <span className="font-mono text-xs text-ink-3">
                  {file.name}
                </span>
              )}
            </div>

            {busy && <p className="text-[13px] text-ink-3">Checking file…</p>}

            {preview && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="ok">{preview.summary.creates} to create</Badge>
                  <Badge tone="warn">{preview.summary.updates} to update</Badge>
                  <Badge tone={preview.summary.errors ? 'bad' : 'ok'}>
                    {preview.summary.errors} with errors
                  </Badge>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Row</Th>
                        <Th>Email</Th>
                        <Th>Action</Th>
                        <Th>Problems</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.row} className="border-t border-line">
                          <Td className="font-mono tabular-nums">{r.row}</Td>
                          <Td className="font-mono text-xs">
                            {r.email || 'No email'}
                          </Td>
                          <Td>
                            <Badge tone={ACTION_TONE[r.action]}>
                              {r.action}
                            </Badge>
                          </Td>
                          <Td className="text-xs text-bad">
                            {r.errors.join('; ')}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={commit}
                    disabled={importable === 0}
                    loading={busy}
                  >
                    {`Import ${importable} employee${importable === 1 ? '' : 's'}`}
                  </Button>
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
