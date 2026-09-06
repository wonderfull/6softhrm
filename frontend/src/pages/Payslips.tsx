import React from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL, apiGet, getCurrentUser, hasRole } from '../lib/api';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';

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

  const selectedEmployee = employeeId
    ? employees.find((emp) => String(emp.id) === employeeId)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isElevated ? 'Payslips' : 'My payslips'}
        subline={
          isElevated
            ? 'Payslips uploaded against an employee record, newest first.'
            : 'Every payslip your employer has filed for you.'
        }
      />

      {isElevated && (
        <Select
          label="Employee"
          id="payslip-employee"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          help="Payslips are only visible one employee at a time."
          wrapperClassName="w-full sm:max-w-xs"
        >
          <option value="">Select an employee to view payslips</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </Select>
      )}

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}

      {isElevated && !employeeId ? (
        <EmptyState
          icon={<DocumentTextIcon />}
          title="No employee selected"
          body="Select an employee to view their payslips."
        />
      ) : loading ? (
        <Card flush title="Payslips">
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<DocumentTextIcon />}
          title="No payslips yet"
          body="No payslips have been uploaded yet."
        />
      ) : (
        <Card
          flush
          title="Payslips"
          description={`${items.length} ${items.length === 1 ? 'payslip' : 'payslips'}${
            selectedEmployee
              ? ` for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`
              : ''
          }.`}
        >
          <Table>
            <thead>
              <tr>
                <Th>Payslip</Th>
                <Th>Uploaded</Th>
                <Th>Size</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((payslip) => (
                <Tr key={payslip.id}>
                  <Td className="font-mono text-[13px] text-ink">
                    {payslip.name}
                  </Td>
                  <Td className="font-mono text-[13px] text-ink-2">
                    {new Date(payslip.uploadedAt).toLocaleDateString('en-GB')}
                  </Td>
                  <Td className="tabular-nums text-ink-2">
                    {formatSize(payslip.size)}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => download(payslip)}
                      loading={downloadingId === payslip.id}
                      aria-label={`Download ${payslip.name}`}
                    >
                      {downloadingId === payslip.id
                        ? 'Downloading'
                        : 'Download'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
