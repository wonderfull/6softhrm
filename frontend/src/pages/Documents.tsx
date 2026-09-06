import React from 'react';
import { Link } from 'react-router-dom';
import { DocumentTextIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
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
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: 'Employment contracts',
  PASSPORT: 'Passports',
  VISA: 'Visa documents',
  ID: 'ID documents',
  CERTIFICATE: 'Certificates',
  PAYSLIP: 'Payslips',
  OTHER: 'Other documents',
  UNCATEGORISED: 'Uncategorised',
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

// Expiry is a status, so it reads as a badge plus the date itself rather than
// a coloured card: tone carries the urgency, the mono date carries the fact.
function expiryState(expiryDate: string) {
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) {
    return {
      tone: 'bad' as const,
      label: `Expired ${Math.abs(days)} days ago`,
    };
  }
  if (days < 7) {
    return { tone: 'bad' as const, label: `Expires in ${days} days` };
  }
  if (days < 30) {
    return { tone: 'warn' as const, label: `Expires in ${days} days` };
  }
  return { tone: 'ok' as const, label: 'In date' };
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
  const [deleting, setDeleting] = React.useState<any | null>(null);
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

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    try {
      await apiDelete(`/documents/${id}`);
      await loadDocuments();
      alert('Document deleted successfully!');
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
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
    <div className="space-y-6">
      <PageHeader
        title={isElevated ? 'Documents' : 'My documents'}
        subline={
          isElevated
            ? 'Employment records held against each employee, grouped by type.'
            : 'Every document your employer holds for you.'
        }
        actions={
          <>
            {isElevated && viewFilterEmployeeId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownloadAll(viewFilterEmployeeId)}
              >
                Download all as ZIP
              </Button>
            )}
            {!isElevated && currentEmployee && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownloadAll(String(currentEmployee.id))}
              >
                Download all my documents as ZIP
              </Button>
            )}
          </>
        }
      />

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-[fade-in_200ms_var(--ease-out)] motion-reduce:animate-none"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.document.name}`}
        >
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate font-mono text-sm text-ink">
                  {preview.document.name}
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {preview.kind === 'unsupported'
                    ? 'Preview unavailable'
                    : 'Secure document preview'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Download ${preview.document.name}`}
                  onClick={() => handleDownloadDocument(preview.document)}
                >
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={closePreview}>
                  Close
                </Button>
              </div>
            </header>
            <div className="min-h-[420px] overflow-auto bg-surface-2 p-4">
              {(preview.kind === 'pdf' || preview.kind === 'document') &&
                preview.url && (
                  <iframe
                    title={preview.document.name}
                    src={preview.url}
                    className="h-[70vh] w-full rounded-lg border border-line bg-surface"
                  />
                )}
              {preview.kind === 'image' && preview.url && (
                <img
                  src={preview.url}
                  alt={preview.document.name}
                  className="mx-auto max-h-[70vh] max-w-full rounded-lg bg-surface object-contain"
                />
              )}
              {preview.kind === 'unsupported' && (
                <EmptyState
                  icon={<DocumentTextIcon />}
                  title="Preview is not available for this file type"
                  body="Download the original file to view it in a compatible desktop or browser application."
                  className="min-h-[360px] justify-center bg-surface"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {isElevated && (
        <Card
          title="Payslip drop zone"
          description="Select an employee, drag in one or more payslips, and the system stores them in that employee's documents."
        >
          {employees.length === 0 && (
            <p className="mb-4 rounded-md bg-warn-tint px-3 py-2 text-[13px] text-warn">
              No employees found. Create employees first on the{' '}
              <Link to="/employees" className="underline">
                Employees
              </Link>{' '}
              page.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Search employees"
              id="payslip-employee-search"
              placeholder="Name, email or ID"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Select
              label="Employee"
              id="document-employee"
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setViewFilterEmployeeId(e.target.value);
                if (e.target.value) clearUploadValidationError('employeeId');
              }}
              disabled={employees.length === 0}
              help="Payslips and uploads are filed against this person."
            >
              <option value="">Select employee</option>
              {employeeSelectOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.id})
                </option>
              ))}
            </Select>
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
            className={`mt-4 rounded-lg border border-dashed p-8 text-center transition-colors duration-hover ease-out ${
              payslipDragActive
                ? 'border-accent bg-accent-tint'
                : 'border-line-2 bg-surface'
            }`}
          >
            <p className="text-[15px] font-semibold text-ink">
              Drag and drop payslips here
            </p>
            <p className="mt-1 text-[13px] text-ink-2">
              PDF, PNG, JPG, DOC or DOCX up to 5MB each.
            </p>
            <label
              htmlFor="payslip-files"
              className="btn-secondary mt-4 h-8 cursor-pointer px-3 text-[13px]"
            >
              Select payslips
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
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-[13px] font-medium text-ink">
                Ready to upload
              </div>
              <ul className="mt-2 space-y-1 font-mono text-[13px] text-ink-2">
                {payslipFiles.map((payslipFile) => (
                  <li key={`${payslipFile.name}-${payslipFile.size}`}>
                    {payslipFile.name}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={uploadPayslips}
                  disabled={!employeeId}
                  loading={uploadingPayslips}
                >
                  {uploadingPayslips
                    ? 'Uploading'
                    : `Upload ${payslipFiles.length} payslip${payslipFiles.length > 1 ? 's' : ''}`}
                </Button>
                <Button variant="ghost" onClick={() => setPayslipFiles([])}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {payslipResults.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-[13px] font-medium text-ok">
                Payslips uploaded ({payslipResults.length})
              </div>
              <ul className="mt-2 space-y-1 font-mono text-[13px] text-ink-2">
                {payslipResults.map((result) => (
                  <li key={result.id}>{result.name}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card
        title="Upload a document"
        description="Files are stored against the selected employee and logged for audit."
      >
        <form
          onSubmit={upload}
          noValidate
          className="grid gap-4 md:grid-cols-2"
        >
          {uploadValidationErrors.employeeId && (
            <p role="alert" className="text-sm text-bad md:col-span-2">
              {uploadValidationErrors.employeeId}
            </p>
          )}

          <Input
            label="Document name"
            id="document-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) clearUploadValidationError('name');
            }}
            placeholder="Employment contract"
            error={uploadValidationErrors.name}
          />

          <Select
            label="Document type"
            id="document-type"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            help="Optional. Sets which group the file appears under."
          >
            <option value="">Select type</option>
            <option value="CONTRACT">Employment contract</option>
            <option value="PASSPORT">Passport</option>
            <option value="VISA">Visa document</option>
            <option value="ID">ID document</option>
            <option value="CERTIFICATE">Certificate</option>
            <option value="PAYSLIP">Payslip</option>
            <option value="OTHER">Other</option>
          </Select>

          <Input
            label="Expiry date"
            id="document-expiry-date"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            help="Optional. Drives the expiry alerts."
          />

          <div>
            <label
              htmlFor="document-file"
              className="mb-1.5 block text-[13px] font-medium text-ink"
            >
              File
            </label>
            <input
              id="document-file"
              type="file"
              onChange={handleFileChange}
              disabled={!isElevated && !currentEmployee}
              aria-invalid={uploadValidationErrors.file ? 'true' : undefined}
              aria-describedby={
                uploadValidationErrors.file
                  ? 'document-file-error'
                  : 'document-file-help'
              }
              className="block w-full cursor-pointer rounded-md border border-line-2 bg-surface text-sm text-ink-2 aria-[invalid=true]:border-bad file:mr-3 file:h-[34px] file:cursor-pointer file:border-0 file:border-r file:border-line-2 file:bg-surface-2 file:px-3 file:text-[13px] file:font-medium file:text-ink"
            />
            {uploadValidationErrors.file ? (
              <p id="document-file-error" className="mt-1.5 text-xs text-bad">
                {uploadValidationErrors.file}
              </p>
            ) : (
              <p id="document-file-help" className="mt-1.5 text-xs text-ink-3">
                PDF, PNG, JPG, DOC or DOCX up to 5MB.
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={!isElevated && !currentEmployee}>
              Upload document
            </Button>
          </div>
        </form>
      </Card>

      {isElevated && (
        <Select
          label="Selected employee"
          id="document-filter-employee"
          value={viewFilterEmployeeId}
          onChange={(e) => {
            setViewFilterEmployeeId(e.target.value);
            setEmployeeId(e.target.value);
          }}
          wrapperClassName="w-full sm:max-w-xs"
        >
          <option value="">Select an employee to view documents</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </Select>
      )}

      {isElevated && !viewFilterEmployeeId && (
        <EmptyState
          icon={<FolderOpenIcon />}
          title="No employee selected"
          body="Select an employee to view their documents."
        />
      )}

      {(!isElevated || viewFilterEmployeeId) && items.length === 0 && (
        <EmptyState
          icon={<FolderOpenIcon />}
          title="No documents yet"
          body={
            selectedViewEmployee
              ? `No documents uploaded yet for ${selectedViewEmployee.firstName} ${selectedViewEmployee.lastName}.`
              : 'No documents uploaded yet.'
          }
        />
      )}

      {groupedDocumentEntries.map(([documentType, documents]) => (
        <Card
          key={documentType}
          flush
          title={DOCUMENT_TYPE_LABELS[documentType] || documentType}
          description={`${documents.length} ${documents.length === 1 ? 'document' : 'documents'}. Select a file name to preview it.`}
        >
          <Table>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Employee</Th>
                <Th>Expiry</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const expiry = d.expiryDate ? expiryState(d.expiryDate) : null;
                const own = ownAcknowledgement(d);

                return (
                  <Tr key={d.id}>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Preview ${d.name}`}
                          onClick={() => handlePreviewDocument(d)}
                          disabled={openDocumentId === d.id}
                          className="max-w-[340px] truncate font-mono text-[13px] text-link transition-colors duration-hover ease-out hover:underline disabled:opacity-60"
                        >
                          {d.name}
                        </button>
                        {d.type && <Badge>{d.type}</Badge>}
                      </div>
                      {d.requiresAcknowledgement && (
                        <div className="mt-1.5 text-[13px]">
                          {isOwnDocument(d) &&
                            (own ? (
                              <span className="text-ok">
                                You acknowledged this on{' '}
                                {new Date(
                                  own.acknowledgedAt,
                                ).toLocaleDateString('en-GB')}{' '}
                                as {own.typedName}.
                              </span>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setAcknowledgeError('');
                                  setAcknowledging({
                                    document: d,
                                    typedName: '',
                                  });
                                }}
                              >
                                Read and acknowledge
                              </Button>
                            ))}
                          {isElevated && (
                            <div className="mt-1 text-ink-2">
                              {(acknowledgements[d.id] || []).length === 0 ? (
                                'Acknowledgement required. Nobody has acknowledged it yet.'
                              ) : (
                                <ul className="space-y-0.5">
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
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">
                      {d.employee
                        ? `${d.employee.firstName} ${d.employee.lastName}`
                        : `Employee ID: ${d.employeeId}`}
                    </Td>
                    <Td>
                      {expiry ? (
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={expiry.tone}>{expiry.label}</Badge>
                          <span className="font-mono text-[11px] text-ink-3">
                            {new Date(d.expiryDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-3">Not set</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Download ${d.name}`}
                          onClick={() => handleDownloadDocument(d)}
                          disabled={openDocumentId === d.id}
                        >
                          Download
                        </Button>
                        {canManageDocuments && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleting(d)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ))}

      <Dialog
        open={!!deleting}
        title="Delete document"
        description={
          deleting
            ? `Delete ${deleting.name}? The file is removed and the deletion is logged.`
            : undefined
        }
        onClose={() => setDeleting(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Delete document
          </Button>
        </div>
      </Dialog>

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
          <div className="space-y-4">
            {acknowledgeError && (
              <p role="alert" className="text-sm text-bad">
                {acknowledgeError}
              </p>
            )}
            <Input
              label="Your full name"
              id="acknowledge-name"
              value={acknowledging.typedName}
              onChange={(e) =>
                setAcknowledging({
                  ...acknowledging,
                  typedName: e.target.value,
                })
              }
              help="We store your name, the date and your IP address against this document."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setAcknowledging(null)}
                disabled={acknowledgeSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={submitAcknowledgement}
                loading={acknowledgeSaving}
                disabled={!acknowledging.typedName.trim().length}
              >
                {acknowledgeSaving ? 'Recording' : 'I have read this'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
