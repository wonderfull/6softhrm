import React from 'react';
import { Link } from 'react-router-dom';
import {
  apiGet,
  API_BASE_URL,
  apiPost,
  apiUpload,
  apiDelete,
  getCurrentUser,
  hasRole,
} from '../lib/api';
import Dialog from '../components/Dialog';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: 'Employment Contracts',
  PASSPORT: 'Passports',
  VISA: 'Visa Documents',
  ID: 'ID Documents',
  CERTIFICATE: 'Certificates',
  PAYSLIP: 'Payslips',
  OTHER: 'Other Documents',
  UNCATEGORISED: 'Uncategorised',
};

const typeColors: Record<string, string> = {
  CONTRACT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  PASSPORT:
    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  VISA: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  ID: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  CERTIFICATE:
    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  PAYSLIP:
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  OTHER: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400',
  UNCATEGORISED:
    'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400',
};

type UploadValidationErrors = {
  employeeId?: string;
  name?: string;
  file?: string;
};

function getFileValidationError(file: File) {
  if (file.size > MAX_SIZE) return 'File is too large (max 5MB)';
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Unsupported file type. Allowed: PDF, PNG, JPG, DOC, DOCX';
  }
  return null;
}

function getDocumentExtension(
  documentName?: string | null,
  documentPath?: string | null,
) {
  for (const source of [documentName, documentPath]) {
    const fileName = (source || '').split('/').pop() || '';
    const match = fileName.match(/\.([a-z0-9]+)$/i);
    if (match) return match[1].toLowerCase();
  }
  return '';
}

function getPreviewKind(
  documentName?: string | null,
  documentPath?: string | null,
) {
  const extension = getDocumentExtension(documentName, documentPath);
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg'].includes(extension)) return 'image';
  if (['doc', 'docx'].includes(extension)) return 'document';
  return 'unsupported';
}

export default function Documents() {
  const [items, setItems] = React.useState<any[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [employeeId, setEmployeeId] = React.useState('');
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [name, setName] = React.useState('');
  const [docType, setDocType] = React.useState('');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const [viewFilterEmployeeId, setViewFilterEmployeeId] = React.useState('');
  const [currentEmployee, setCurrentEmployee] = React.useState<any>(null);
  const [payslipFiles, setPayslipFiles] = React.useState<File[]>([]);
  const [payslipDragActive, setPayslipDragActive] = React.useState(false);
  const [payslipResults, setPayslipResults] = React.useState<any[]>([]);
  const [openDocumentId, setOpenDocumentId] = React.useState<number | null>(
    null,
  );
  const [uploadingPayslips, setUploadingPayslips] = React.useState(false);
  const [uploadValidationErrors, setUploadValidationErrors] =
    React.useState<UploadValidationErrors>({});
  const [preview, setPreview] = React.useState<{
    document: any;
    url: string | null;
    kind: 'pdf' | 'image' | 'document' | 'unsupported';
  } | null>(null);
  const [acknowledgements, setAcknowledgements] = React.useState<
    Record<number, any[]>
  >({});
  const [acknowledging, setAcknowledging] = React.useState<{
    document: any;
    typedName: string;
  } | null>(null);
  const [acknowledgeError, setAcknowledgeError] = React.useState('');
  const [acknowledgeSaving, setAcknowledgeSaving] = React.useState(false);

  const user = getCurrentUser();
  const isElevated = hasRole(user, 'ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT');
  const canManageDocuments = hasRole(user, 'ADMIN', 'DIRECTOR');

  async function loadDocuments(selectedEmployeeId = viewFilterEmployeeId) {
    if (isElevated && !selectedEmployeeId) {
      setItems([]);
      return;
    }

    try {
      const documents = await apiGet(
        '/documents',
        selectedEmployeeId ? { employeeId: selectedEmployeeId } : undefined,
      );
      setItems(documents);
      loadAcknowledgements(documents);
    } catch {
      setItems([]);
    }
  }

  // Who has acknowledged what. Only asked for the documents that need it, and
  // the endpoint lets the employee read their own, so the same call answers
  // both "have I done this?" and HR's "who has?".
  async function loadAcknowledgements(documents: any[]) {
    const needed = documents.filter((d) => d.requiresAcknowledgement);
    if (needed.length === 0) {
      setAcknowledgements({});
      return;
    }
    const entries = await Promise.all(
      needed.map(async (d) => {
        try {
          return [
            d.id,
            await apiGet(`/documents/${d.id}/acknowledgements`),
          ] as [number, any[]];
        } catch {
          return [d.id, []] as [number, any[]];
        }
      }),
    );
    setAcknowledgements(Object.fromEntries(entries));
  }

  async function submitAcknowledgement() {
    if (!acknowledging) return;
    const documentId = acknowledging.document.id;
    setAcknowledgeError('');
    try {
      setAcknowledgeSaving(true);
      await apiPost(`/documents/${documentId}/acknowledge`, {
        typedName: acknowledging.typedName.trim(),
      });
      const rows = await apiGet(`/documents/${documentId}/acknowledgements`);
      setAcknowledgements((current) => ({ ...current, [documentId]: rows }));
      setAcknowledging(null);
    } catch (e: any) {
      setAcknowledgeError(
        e.message || 'Could not record your acknowledgement.',
      );
    } finally {
      setAcknowledgeSaving(false);
    }
  }

  React.useEffect(() => {
    apiGet('/employees')
      .then((emps) => {
        setEmployees(emps);
        if (!isElevated && user?.email) {
          const myEmployee = emps.find(
            (e: any) => e.id === user.employeeId || e.email === user.email,
          );
          if (myEmployee) {
            setCurrentEmployee(myEmployee);
            setEmployeeId(String(myEmployee.id));
          }
        }
      })
      .catch(() => setEmployees([]));
  }, [isElevated, user?.email]);

  React.useEffect(() => {
    loadDocuments();
  }, [isElevated, viewFilterEmployeeId]);

  const selectedViewEmployee = viewFilterEmployeeId
    ? employees.find((employee) => employee.id === Number(viewFilterEmployeeId))
    : null;

  const isOwnDocument = (d: any) =>
    !!user?.employeeId && Number(d.employeeId) === Number(user.employeeId);

  const ownAcknowledgement = (d: any) =>
    (acknowledgements[d.id] || []).find(
      (record: any) => Number(record.employeeId) === Number(user?.employeeId),
    );

  const groupedDocuments = React.useMemo(() => {
    return items.reduce((groups: Record<string, any[]>, document) => {
      const key = document.type || 'UNCATEGORISED';
      groups[key] = groups[key] || [];
      groups[key].push(document);
      return groups;
    }, {});
  }, [items]);

  const groupedDocumentEntries = Object.entries(groupedDocuments).sort(
    ([a], [b]) => {
      return (DOCUMENT_TYPE_LABELS[a] || a).localeCompare(
        DOCUMENT_TYPE_LABELS[b] || b,
      );
    },
  );

  async function handleDownloadAll(empId: string) {
    if (!empId) return alert('No employee selected');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${API_BASE_URL}/documents/download-all/${empId}`,
        {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return alert(`Download failed: ${res.status} ${text}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename=\"(.+?)\"/);
      const filename = match ? match[1] : `documents_${empId}.zip`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Download failed: ' + (e.message || e));
    }
  }

  function closePreview() {
    if (preview?.url) {
      window.URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
  }

  function clearUploadValidationError(field: keyof UploadValidationErrors) {
    setUploadValidationErrors((errors) => {
      if (!errors[field]) return errors;
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  async function fetchDocumentBlob(
    documentId: number,
    disposition: 'inline' | 'attachment',
  ) {
    const token = localStorage.getItem('token');
    const suffix = disposition === 'inline' ? '?disposition=inline' : '';
    const res = await fetch(
      `${API_BASE_URL}/documents/${documentId}/file${suffix}`,
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${text}`);
    }

    return res.blob();
  }

  async function handlePreviewDocument(document: any) {
    const kind = getPreviewKind(document.name, document.path);
    if (kind === 'unsupported') {
      setPreview({ document, url: null, kind });
      return;
    }

    try {
      setOpenDocumentId(document.id);
      const blob = await fetchDocumentBlob(document.id, 'inline');
      const url = window.URL.createObjectURL(blob);
      setPreview({ document, url, kind });
    } catch (e: any) {
      alert('Preview failed: ' + (e.message || e));
    } finally {
      setOpenDocumentId(null);
    }
  }

  async function handleDownloadDocument(document: any) {
    try {
      setOpenDocumentId(document.id);
      const blob = await fetchDocumentBlob(document.id, 'attachment');
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Download failed: ' + (e.message || e));
    } finally {
      setOpenDocumentId(null);
    }
  }

  function validateUploadForm() {
    const errors: UploadValidationErrors = {};

    if (!employeeId) errors.employeeId = 'Employee is required';
    if (!name.trim()) errors.name = 'Document name is required';
    if (!file) errors.file = 'File is required';

    setUploadValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    // validateUploadForm already refuses a missing file; naming it again is
    // what tells the compiler the append below is safe.
    if (!validateUploadForm() || !file) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('employeeId', employeeId);
    fd.append('name', name);
    if (docType) fd.append('type', docType);
    if (expiryDate) fd.append('expiryDate', expiryDate);

    try {
      await apiUpload('/documents/upload', fd);
      setFile(null);
      setName('');
      setDocType('');
      setExpiryDate('');
      setEmployeeId(currentEmployee ? String(currentEmployee.id) : '');
      await loadDocuments();
      alert('Document uploaded successfully!');
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Unknown error'}`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files ? e.target.files[0] : null;
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const error = getFileValidationError(selectedFile);
    if (error) {
      setUploadValidationErrors((errors) => ({ ...errors, file: error }));
      setFile(null);
      return;
    }

    setFile(selectedFile);
    clearUploadValidationError('file');
  }

  function setValidatedPayslipFiles(candidateFiles: File[]) {
    const invalid = candidateFiles.find(getFileValidationError);
    if (invalid) {
      alert(getFileValidationError(invalid));
      return;
    }
    setPayslipFiles(candidateFiles);
  }

  async function uploadPayslips() {
    if (!employeeId) return alert('Select an employee first');
    if (payslipFiles.length === 0)
      return alert('Drop at least one payslip file');

    try {
      setUploadingPayslips(true);
      const fd = new FormData();
      fd.append('employeeId', employeeId);
      payslipFiles.forEach((payslipFile) => fd.append('files', payslipFile));

      const response = await apiUpload('/documents/upload-payslips', fd);
      setPayslipResults(response.documents || []);
      setPayslipFiles([]);
      await loadDocuments();
      alert(`Uploaded ${response.uploadedCount || 0} payslip(s)`);
    } catch (e: any) {
      alert(`Payslip upload failed: ${e.message || e}`);
    } finally {
      setUploadingPayslips(false);
    }
  }

  const employeeSelectOptions = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName} ${emp.email} ${emp.id}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">
        {isElevated ? 'Documents' : 'My Documents'}
      </h2>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.document.name}`}
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {preview.document.name}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {preview.kind === 'unsupported'
                    ? 'Preview unavailable'
                    : 'Secure document preview'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                  onClick={() => handleDownloadDocument(preview.document)}
                >
                  Download {preview.document.name}
                </button>
                <button
                  type="button"
                  className="rounded bg-slate-200 px-3 py-2 text-sm text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
                  onClick={closePreview}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-[420px] overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
              {(preview.kind === 'pdf' || preview.kind === 'document') &&
                preview.url && (
                  <iframe
                    title={preview.document.name}
                    src={preview.url}
                    className="h-[70vh] w-full rounded border border-slate-200 bg-white dark:border-slate-700"
                  />
                )}
              {preview.kind === 'image' && preview.url && (
                <img
                  src={preview.url}
                  alt={preview.document.name}
                  className="mx-auto max-h-[70vh] max-w-full rounded bg-white object-contain"
                />
              )}
              {preview.kind === 'unsupported' && (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">
                    Preview is not available for this file type
                  </div>
                  <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                    Download the original file to view it in a compatible
                    desktop or browser application.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isElevated && (
        <section className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Payslip Drop Zone</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select an employee, drag in one or more payslips, and the system
                stores them in that employee&apos;s documents.
              </p>
            </div>
          </div>

          {employees.length === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
              No employees found. Create employees first on the{' '}
              <Link to="/employees" className="underline">
                Employees
              </Link>{' '}
              page.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_1fr] mb-4">
            <div>
              <label
                htmlFor="payslip-employee-search"
                className="block text-sm font-medium mb-1"
              >
                Search employees
              </label>
              <input
                id="payslip-employee-search"
                placeholder="Search employees..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="form-input w-full"
              />
            </div>
            <div>
              <label
                htmlFor="document-employee"
                className="block text-sm font-medium mb-1"
              >
                Employee
              </label>
              <select
                id="document-employee"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  setViewFilterEmployeeId(e.target.value);
                  if (e.target.value) clearUploadValidationError('employeeId');
                }}
                className="form-input w-full"
                disabled={employees.length === 0}
              >
                <option value="">Select Employee *</option>
                {employeeSelectOptions.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setPayslipDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setPayslipDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setPayslipDragActive(false);
              setValidatedPayslipFiles(Array.from(e.dataTransfer.files));
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              payslipDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40'
            }`}
          >
            <p className="font-medium mb-2">Drag and drop payslips here</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              PDF, PNG, JPG, DOC, DOCX up to 5MB each
            </p>
            <label
              htmlFor="payslip-files"
              className="btn-primary cursor-pointer inline-flex"
            >
              Select Payslips
            </label>
            <input
              id="payslip-files"
              type="file"
              multiple
              className="hidden"
              onChange={(e) =>
                setValidatedPayslipFiles(Array.from(e.target.files || []))
              }
            />
          </div>

          {payslipFiles.length > 0 && (
            <div className="mt-4 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4">
              <div className="font-medium mb-2">Ready to upload</div>
              <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {payslipFiles.map((payslipFile) => (
                  <div key={`${payslipFile.name}-${payslipFile.size}`}>
                    {payslipFile.name}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={uploadPayslips}
                  disabled={!employeeId || uploadingPayslips}
                >
                  {uploadingPayslips
                    ? 'Uploading...'
                    : `Upload ${payslipFiles.length} Payslip${payslipFiles.length > 1 ? 's' : ''}`}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-700"
                  onClick={() => setPayslipFiles([])}
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {payslipResults.length > 0 && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-4">
              <div className="font-medium text-green-800 dark:text-green-300 mb-2">
                Payslips uploaded ({payslipResults.length})
              </div>
              <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-200 space-y-1">
                {payslipResults.map((result) => (
                  <li key={result.id}>{result.name}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <form onSubmit={upload} noValidate className="mb-6 space-y-3">
        {uploadValidationErrors.employeeId && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {uploadValidationErrors.employeeId}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="document-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Document Name *
            </label>
            <input
              id="document-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) clearUploadValidationError('name');
              }}
              placeholder="e.g., Employment Contract"
              className={`form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${uploadValidationErrors.name ? 'border-red-500 focus:border-red-500' : ''}`}
              aria-invalid={Boolean(uploadValidationErrors.name)}
              aria-describedby={
                uploadValidationErrors.name ? 'document-name-error' : undefined
              }
            />
            {uploadValidationErrors.name && (
              <div
                id="document-name-error"
                className="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {uploadValidationErrors.name}
              </div>
            )}
          </div>
          <div>
            <label
              htmlFor="document-type"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Document Type (Optional)
            </label>
            <select
              id="document-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">Select type...</option>
              <option value="CONTRACT">Employment Contract</option>
              <option value="PASSPORT">Passport</option>
              <option value="VISA">Visa Document</option>
              <option value="ID">ID Document</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="PAYSLIP">Payslip</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="document-expiry-date"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Expiry Date (Optional)
          </label>
          <input
            id="document-expiry-date"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="document-file"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            File *
          </label>
          <input
            id="document-file"
            type="file"
            className={`form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white ${uploadValidationErrors.file ? 'border-red-500 focus:border-red-500' : ''}`}
            onChange={handleFileChange}
            disabled={!isElevated && !currentEmployee}
            aria-invalid={Boolean(uploadValidationErrors.file)}
            aria-describedby={
              uploadValidationErrors.file ? 'document-file-error' : undefined
            }
          />
          {uploadValidationErrors.file && (
            <div
              id="document-file-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {uploadValidationErrors.file}
            </div>
          )}
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Allowed types: PDF, PNG, JPG, DOC, DOCX • Max size: 5MB
          </div>
        </div>

        <button
          className="btn-primary"
          disabled={!isElevated && !currentEmployee}
        >
          Upload Document
        </button>
      </form>

      {isElevated && (
        <div className="mb-4 flex items-end gap-4">
          <div className="flex-1">
            <label
              htmlFor="document-filter-employee"
              className="block text-sm font-medium mb-2"
            >
              Selected Employee:
            </label>
            <select
              id="document-filter-employee"
              value={viewFilterEmployeeId}
              onChange={(e) => {
                setViewFilterEmployeeId(e.target.value);
                setEmployeeId(e.target.value);
              }}
              className="form-input"
            >
              <option value="">Select an employee to view documents</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>
          {viewFilterEmployeeId && (
            <button
              onClick={() => handleDownloadAll(viewFilterEmployeeId)}
              className="btn-primary flex items-center gap-2"
              type="button"
            >
              Download All as ZIP
            </button>
          )}
        </div>
      )}

      {!isElevated && currentEmployee && (
        <div className="mb-4">
          <button
            onClick={() => handleDownloadAll(String(currentEmployee.id))}
            className="btn-primary flex items-center gap-2 w-fit"
            type="button"
          >
            Download All My Documents as ZIP
          </button>
        </div>
      )}

      <div className="space-y-3">
        {isElevated && !viewFilterEmployeeId && (
          <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded text-center text-slate-600 dark:text-slate-300">
            Select an employee to view their documents.
          </div>
        )}
        {(!isElevated || viewFilterEmployeeId) && items.length === 0 && (
          <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded text-center text-slate-600 dark:text-slate-300">
            {selectedViewEmployee
              ? `No documents uploaded yet for ${selectedViewEmployee.firstName} ${selectedViewEmployee.lastName}`
              : 'No documents uploaded yet'}
          </div>
        )}
        {groupedDocumentEntries.map(([documentType, documents]) => (
          <section
            key={documentType}
            className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {DOCUMENT_TYPE_LABELS[documentType] || documentType}
              </h3>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${typeColors[documentType] || typeColors.OTHER}`}
              >
                {documents.length}
              </span>
            </div>
            {documents.map((d) => {
              let daysUntilExpiry: number | null = null;
              let expiryClass = '';
              if (d.expiryDate) {
                const now = new Date();
                const expiry = new Date(d.expiryDate);
                daysUntilExpiry = Math.ceil(
                  (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );

                if (daysUntilExpiry < 0) {
                  expiryClass =
                    'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400';
                } else if (daysUntilExpiry < 7) {
                  expiryClass =
                    'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-600 dark:text-red-400';
                } else if (daysUntilExpiry < 30) {
                  expiryClass =
                    'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-700 dark:text-yellow-400';
                }
              }

              return (
                <div
                  key={d.id}
                  className={`p-4 border-2 rounded-lg bg-white dark:bg-slate-800 ${expiryClass || 'border-slate-200 dark:border-slate-700'}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="font-bold text-lg">{d.name}</div>
                        {d.type && (
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${typeColors[d.type] || typeColors.OTHER}`}
                          >
                            {d.type}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {d.employee
                          ? `${d.employee.firstName} ${d.employee.lastName}`
                          : `Employee ID: ${d.employeeId}`}
                      </div>
                      {d.expiryDate && (
                        <div className="text-sm font-medium">
                          {daysUntilExpiry !== null && daysUntilExpiry < 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-bold">
                              EXPIRED {Math.abs(daysUntilExpiry)} days ago (
                              {new Date(d.expiryDate).toLocaleDateString(
                                'en-GB',
                              )}
                              )
                            </span>
                          ) : daysUntilExpiry !== null &&
                            daysUntilExpiry < 7 ? (
                            <span className="text-red-600 dark:text-red-400 font-bold">
                              Expires in {daysUntilExpiry} days (
                              {new Date(d.expiryDate).toLocaleDateString(
                                'en-GB',
                              )}
                              )
                            </span>
                          ) : daysUntilExpiry !== null &&
                            daysUntilExpiry < 30 ? (
                            <span className="text-yellow-700 dark:text-yellow-400 font-semibold">
                              Expires in {daysUntilExpiry} days (
                              {new Date(d.expiryDate).toLocaleDateString(
                                'en-GB',
                              )}
                              )
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">
                              Expires:{' '}
                              {new Date(d.expiryDate).toLocaleDateString(
                                'en-GB',
                              )}
                            </span>
                          )}
                        </div>
                      )}
                      {d.requiresAcknowledgement && (
                        <div className="mt-2 text-sm">
                          {isOwnDocument(d) &&
                            (ownAcknowledgement(d) ? (
                              <span className="text-green-700 dark:text-green-400">
                                You acknowledged this on{' '}
                                {new Date(
                                  ownAcknowledgement(d).acknowledgedAt,
                                ).toLocaleDateString('en-GB')}{' '}
                                as “{ownAcknowledgement(d).typedName}”.
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAcknowledgeError('');
                                  setAcknowledging({
                                    document: d,
                                    typedName: '',
                                  });
                                }}
                                className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                              >
                                Read and acknowledge
                              </button>
                            ))}
                          {isElevated && (
                            <div className="mt-1 text-slate-600 dark:text-slate-400">
                              {(acknowledgements[d.id] || []).length === 0 ? (
                                'Acknowledgement required — nobody has acknowledged it yet.'
                              ) : (
                                <ul className="list-inside list-disc">
                                  {(acknowledgements[d.id] || []).map(
                                    (record: any) => (
                                      <li key={record.id}>
                                        Acknowledged by {record.typedName} on{' '}
                                        {new Date(
                                          record.acknowledgedAt,
                                        ).toLocaleDateString('en-GB')}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                        onClick={() => handlePreviewDocument(d)}
                        disabled={openDocumentId === d.id}
                        aria-label={`Preview ${d.name}`}
                      >
                        {openDocumentId === d.id ? 'Loading...' : 'Preview'}
                      </button>
                      <button
                        type="button"
                        className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded transition-colors"
                        onClick={() => handleDownloadDocument(d)}
                        disabled={openDocumentId === d.id}
                        aria-label={`Download ${d.name}`}
                      >
                        Download
                      </button>
                      {canManageDocuments && (
                        <button
                          onClick={async () => {
                            if (
                              !confirm(
                                'Are you sure you want to delete this document?',
                              )
                            )
                              return;
                            try {
                              await apiDelete(`/documents/${d.id}`);
                              await loadDocuments();
                              alert('Document deleted successfully!');
                            } catch (err: any) {
                              alert(`Delete error: ${err.message}`);
                            }
                          }}
                          className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <Dialog
        open={!!acknowledging}
        title="Read and acknowledge"
        description={
          acknowledging
            ? `Type your full name to record that you have read "${acknowledging.document.name}". This is a record that you read it, not a legal signature.`
            : undefined
        }
        onClose={() => (acknowledgeSaving ? undefined : setAcknowledging(null))}
      >
        {acknowledging && (
          <div className="space-y-3">
            {acknowledgeError && (
              <div
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
              >
                {acknowledgeError}
              </div>
            )}
            <label
              htmlFor="acknowledge-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Your full name
              <input
                id="acknowledge-name"
                value={acknowledging.typedName}
                onChange={(e) =>
                  setAcknowledging({
                    ...acknowledging,
                    typedName: e.target.value,
                  })
                }
                className="form-input mt-1"
              />
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              We store your name, the date and your IP address against this
              document.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAcknowledging(null)}
                disabled={acknowledgeSaving}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAcknowledgement}
                disabled={
                  acknowledgeSaving || !acknowledging.typedName.trim().length
                }
                className="btn-primary disabled:opacity-50"
              >
                {acknowledgeSaving ? 'Recording…' : 'I have read this'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
