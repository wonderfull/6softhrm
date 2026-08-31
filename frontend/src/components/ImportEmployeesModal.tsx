import React from 'react';
import { API_BASE_URL, apiUpload } from '../lib/api';

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

const ACTION_STYLES: Record<PlanRow['action'], string> = {
  create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Import employees</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Upload a CSV or Excel file. Existing employees are matched by
              email and updated; new emails create records.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close import"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
              Import complete: {result.summary.created} created,{' '}
              {result.summary.updated} updated
              {result.summary.errors
                ? `, ${result.summary.errors} rows skipped with errors`
                : ''}
              .
            </div>
            {result.rows.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-red-700 dark:text-red-300">
                {result.rows.map((r) => (
                  <li key={r.row}>
                    Row {r.row} ({r.email || 'no email'}): {r.errors.join('; ')}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={onClose} className="btn-primary">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="btn-primary cursor-pointer">
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
                onClick={downloadTemplate}
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-300"
              >
                Download template CSV
              </button>
              {file && (
                <span className="text-sm text-slate-500">{file.name}</span>
              )}
            </div>

            {busy && <p className="text-sm text-slate-500">Checking file…</p>}

            {preview && (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {preview.summary.creates} to create
                  </span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {preview.summary.updates} to update
                  </span>
                  <span className="font-semibold text-red-700 dark:text-red-300">
                    {preview.summary.errors} with errors
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                      <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Problems</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr
                          key={r.row}
                          className="border-t border-slate-100 dark:border-slate-700/60"
                        >
                          <td className="px-3 py-1.5 tabular-nums">{r.row}</td>
                          <td className="px-3 py-1.5">{r.email || '—'}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACTION_STYLES[r.action]}`}
                            >
                              {r.action}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-red-700 dark:text-red-300">
                            {r.errors.join('; ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={commit}
                    disabled={busy || importable === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    {busy
                      ? 'Importing…'
                      : `Import ${importable} employee${importable === 1 ? '' : 's'}`}
                  </button>
                  <button onClick={onClose} className="btn-ghost">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
