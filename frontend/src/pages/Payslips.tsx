import React from 'react';
import { API_BASE_URL, apiGet, getCurrentUser, hasRole } from '../lib/api';
import Card from '../components/Card';

// Payslips are the one document type employees look for on their own, so they
// get their own screen instead of being buried in the Documents list.

type Payslip = {
  id: number;
  name: string;
  type: string;
  employeeId: number;
  uploadedAt: string;
  size: number | null;
};

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Payslips() {
  const user = getCurrentUser();
  const isElevated = hasRole(user, 'ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT');

  const [items, setItems] = React.useState<Payslip[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [employeeId, setEmployeeId] = React.useState('');
  const [loading, setLoading] = React.useState(!isElevated);
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!isElevated) return;
    apiGet('/employees')
      .then((emps) => setEmployees(Array.isArray(emps) ? emps : []))
      .catch(() => setEmployees([]));
  }, [isElevated]);

  React.useEffect(() => {
    if (isElevated && !employeeId) {
      setItems([]);
      return;
    }
    setError('');
    setLoading(true);
    apiGet(
      '/documents',
      employeeId ? { type: 'PAYSLIP', employeeId } : { type: 'PAYSLIP' },
    )
      .then((rows) => setItems(Array.isArray(rows) ? rows : []))
      .catch((e) => {
        setItems([]);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [employeeId, isElevated]);

  async function download(payslip: Payslip) {
    try {
      setDownloadingId(payslip.id);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/documents/${payslip.id}/file`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status} ${text}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = payslip.name;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Download failed: ' + (e.message || e));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">
        {isElevated ? 'Payslips' : 'My Payslips'}
      </h2>

      {isElevated && (
        <div className="mb-4">
          <label
            htmlFor="payslip-employee"
            className="block text-sm font-medium mb-2"
          >
            Employee
          </label>
          <select
            id="payslip-employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="form-input"
          >
            <option value="">Select an employee to view payslips</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {isElevated && !employeeId ? (
        <Card className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
          Select an employee to view their payslips.
        </Card>
      ) : loading ? (
        <Card className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
          Loading payslips…
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
          No payslips have been uploaded yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((payslip) => (
            <Card
              key={payslip.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {payslip.name}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {new Date(payslip.uploadedAt).toLocaleDateString('en-GB')}
                  {payslip.size ? ` · ${formatSize(payslip.size)}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => download(payslip)}
                disabled={downloadingId === payslip.id}
                aria-label={`Download ${payslip.name}`}
                className="btn-primary disabled:opacity-50"
              >
                {downloadingId === payslip.id ? 'Downloading…' : 'Download'}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
