import React from 'react';
import { IdentificationIcon } from '@heroicons/react/24/outline';
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  apiUpload,
  getCurrentUser,
} from '../lib/api';
import { isElevatedRole, normalizeRole } from '../lib/roles';
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
  Textarea,
  Th,
  Tr,
} from '../components/ui';

const EVENT_TYPES = [
  'DELAYED_START',
  'UNAUTHORISED_ABSENCE_10_DAYS',
  'EMPLOYMENT_ENDED',
  'WORK_LOCATION_CHANGED',
  'UNPAID_LEAVE_OVER_4_WEEKS',
];

const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const EVIDENCE_DOCUMENT_TYPES: Record<string, string> = {
  RIGHT_TO_WORK_CHECK: 'ID',
  EMPLOYMENT_RIGHTS_NOTIFICATION: 'CONTRACT',
  RECRUITMENT_EVIDENCE: 'OTHER',
  SALARY_EVIDENCE: 'OTHER',
  SKILL_LEVEL_EVIDENCE: 'CERTIFICATE',
};

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad'> = {
  Complete: 'ok',
  Expiring: 'warn',
  Expired: 'bad',
  Incomplete: 'warn',
};

const FILE_INPUT_CLASS =
  'block w-full cursor-pointer rounded-md border border-line-2 bg-surface text-sm text-ink-2 file:mr-3 file:h-[34px] file:cursor-pointer file:border-0 file:border-r file:border-line-2 file:bg-surface-2 file:px-3 file:text-[13px] file:font-medium file:text-ink';

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB') : '';
}

function labelEventType(value: string) {
  const words = value.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function employeeName(sponsorship: any, employees: any[]) {
  const employee =
    sponsorship.employee ||
    employees.find((item) => item.id === sponsorship.employeeId);
  return employee ? `${employee.firstName} ${employee.lastName}` : 'N/A';
}

function getEvidenceFileError(file: File) {
  if (file.size > MAX_EVIDENCE_FILE_SIZE)
    return 'File is too large. Maximum size is 5MB.';
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type))
    return 'Unsupported file type. Use PDF, PNG, JPG, DOC or DOCX.';
  return null;
}

function defaultEvidenceDocumentName(
  label: string,
  sponsorship: any,
  employees: any[],
) {
  return `${label} - ${employeeName(sponsorship, employees)}`;
}

export default function Sponsorships() {
  const currentUser = getCurrentUser();
  const currentRole = normalizeRole(currentUser?.role);
  const canManageCore = isElevatedRole(currentRole);
  const canSupportReporting =
    currentRole === 'ADMIN' ||
    currentRole === 'DIRECTOR' ||
    currentRole === 'OFFICE_ASSISTANT';

  const [items, setItems] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);
  const [openEvents, setOpenEvents] = React.useState<any[]>([]);
  const [complianceById, setComplianceById] = React.useState<
    Record<number, any>
  >({});
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<any | null>(null);
  const [eventForm, setEventForm] = React.useState({
    eventType: 'DELAYED_START',
    eventDate: '',
    dueDate: '',
    notes: '',
  });
  const [evidenceForm, setEvidenceForm] = React.useState<{
    sponsorshipId: number | null;
    evidenceType: string;
    label: string;
    documentName: string;
    notes: string;
    file: File | null;
    verified: boolean;
    error: string;
    submitting: boolean;
    replacing: boolean;
  }>({
    sponsorshipId: null,
    evidenceType: '',
    label: '',
    documentName: '',
    notes: '',
    file: null,
    verified: false,
    error: '',
    submitting: false,
    replacing: false,
  });
  const [formData, setFormData] = React.useState({
    employeeId: '',
    visaType: '',
    casNumber: '',
    sponsorLicenseNumber: '',
    cosType: '',
    cosAssignedDate: '',
    cosStartBy: '',
    iscAmount: '',
    socCode: '',
    jobTitleOnCos: '',
    cosSalary: '',
    cosWeeklyHours: '',
    goingRateSalary: '',
    workLocation: '',
    startDate: '',
    endDate: '',
    complianceNotes: '',
    active: true,
  });

  const selected =
    items.find((item) => item.id === selectedId) || items[0] || null;
  const selectedCompliance = selected ? complianceById[selected.id] : null;
  const selectedEvents = selected
    ? openEvents.filter((event) => event.sponsorshipId === selected.id)
    : [];
  const canUploadEvidence = canSupportReporting;

  const loadCompliancePack = React.useCallback(async (id: number) => {
    try {
      const pack = await apiGet(`/sponsorships/${id}/compliance`);
      setComplianceById((current) => ({ ...current, [id]: pack }));
    } catch {
      setComplianceById((current) => ({ ...current, [id]: null }));
    }
  }, []);

  const loadSponsorships = React.useCallback(async () => {
    try {
      const sponsorships = await apiGet('/sponsorships');
      setItems(sponsorships);
      setSelectedId((current) => current || sponsorships[0]?.id || null);
      sponsorships.forEach((item: any) => loadCompliancePack(item.id));
    } catch {
      setItems([]);
    }
  }, [loadCompliancePack]);

  const loadEmployees = React.useCallback(() => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  const loadOpenEvents = React.useCallback(() => {
    if (!canSupportReporting) return;
    apiGet('/sponsorships/reportable-events/open')
      .then(setOpenEvents)
      .catch(() => setOpenEvents([]));
  }, [canSupportReporting]);

  React.useEffect(() => {
    loadSponsorships();
    loadEmployees();
    loadOpenEvents();
  }, [loadEmployees, loadOpenEvents, loadSponsorships]);

  const resetForm = () => {
    setFormData({
      employeeId: '',
      visaType: '',
      casNumber: '',
      sponsorLicenseNumber: '',
      cosType: '',
      cosAssignedDate: '',
      cosStartBy: '',
      iscAmount: '',
      socCode: '',
      jobTitleOnCos: '',
      cosSalary: '',
      cosWeeklyHours: '',
      goingRateSalary: '',
      workLocation: '',
      startDate: '',
      endDate: '',
      complianceNotes: '',
      active: true,
    });
  };

  const complianceStatus = (sponsorship: any) => {
    const pack = complianceById[sponsorship.id];
    if (sponsorship.endDate) {
      const endDate = new Date(sponsorship.endDate);
      const now = new Date();
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + 30);
      if (endDate < now) return 'Expired';
      if (endDate <= warningDate) return 'Expiring';
    }
    if (!pack) return 'Incomplete';
    return pack.missingCount === 0 ? 'Complete' : 'Incomplete';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        employeeId: parseInt(formData.employeeId),
      };

      if (editingId) {
        await apiPut(`/sponsorships/${editingId}`, data);
        alert('Sponsorship updated successfully!');
      } else {
        await apiPost('/sponsorships', data);
        alert('Sponsorship added successfully!');
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadSponsorships();
    } catch (err: any) {
      console.error('Error saving sponsorship:', err);
      alert(
        'Failed to save sponsorship: ' + (err.message || JSON.stringify(err)),
      );
    }
  };

  const handleEdit = (sponsorship: any) => {
    setEditingId(sponsorship.id);
    setFormData({
      employeeId: sponsorship.employeeId.toString(),
      visaType: sponsorship.visaType || '',
      casNumber: sponsorship.casNumber || '',
      sponsorLicenseNumber: sponsorship.sponsorLicenseNumber || '',
      cosType: sponsorship.cosType || '',
      cosAssignedDate: sponsorship.cosAssignedDate
        ? sponsorship.cosAssignedDate.split('T')[0]
        : '',
      cosStartBy: sponsorship.cosStartBy
        ? sponsorship.cosStartBy.split('T')[0]
        : '',
      iscAmount: sponsorship.iscAmount?.toString() || '',
      socCode: sponsorship.socCode || '',
      jobTitleOnCos: sponsorship.jobTitleOnCos || '',
      cosSalary: sponsorship.cosSalary?.toString() || '',
      cosWeeklyHours: sponsorship.cosWeeklyHours?.toString() || '',
      goingRateSalary: sponsorship.goingRateSalary?.toString() || '',
      workLocation: sponsorship.workLocation || '',
      startDate: sponsorship.startDate
        ? sponsorship.startDate.split('T')[0]
        : '',
      endDate: sponsorship.endDate ? sponsorship.endDate.split('T')[0] : '',
      complianceNotes: sponsorship.complianceNotes || '',
      active: sponsorship.active !== false,
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);

    try {
      await apiDelete(`/sponsorships/${id}`);
      alert('Sponsorship deleted successfully!');
      loadSponsorships();
      loadOpenEvents();
    } catch (err: any) {
      console.error('Error deleting sponsorship:', err);
      alert(
        'Failed to delete sponsorship: ' + (err.message || JSON.stringify(err)),
      );
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  };

  const handleExport = async () => {
    try {
      const exportData = items.map((item) => ({
        Employee: employeeName(item, employees),
        'Visa Type': item.visaType,
        'CAS Number': item.casNumber || '',
        'Sponsor License Number': item.sponsorLicenseNumber || '',
        'Start Date': formatDate(item.startDate),
        'End Date': formatDate(item.endDate),
        'Compliance Notes': item.complianceNotes || '',
        Status: item.active ? 'Active' : 'Inactive',
      }));

      // 300 kB of spreadsheet writer, pulled in only when someone exports.

      const XLSX = await import('xlsx');

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sponsorships');
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Sponsorships_Export_${date}.xlsx`);
    } catch (err) {
      console.error('Failed to export:', err);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    try {
      await apiPost(
        `/sponsorships/${selected.id}/reportable-events`,
        eventForm,
      );
      setEventForm({
        eventType: 'DELAYED_START',
        eventDate: '',
        dueDate: '',
        notes: '',
      });
      loadOpenEvents();
    } catch (err: any) {
      alert(
        'Failed to create reportable event: ' +
          (err.message || JSON.stringify(err)),
      );
    }
  };

  const handleMarkReported = async (eventId: number) => {
    try {
      await apiPut(`/sponsorships/reportable-events/${eventId}/mark-reported`);
      loadOpenEvents();
    } catch (err: any) {
      alert(
        'Failed to mark event reported: ' +
          (err.message || JSON.stringify(err)),
      );
    }
  };

  const openEvidenceForm = (item: any) => {
    if (!selected) return;
    setEvidenceForm({
      sponsorshipId: selected.id,
      evidenceType: item.key,
      label: item.label,
      documentName: defaultEvidenceDocumentName(
        item.label,
        selected,
        employees,
      ),
      notes: item.evidence?.notes || '',
      file: null,
      verified: false,
      error: '',
      submitting: false,
      replacing: item.status === 'COMPLETE',
    });
  };

  const closeEvidenceForm = () => {
    setEvidenceForm({
      sponsorshipId: null,
      evidenceType: '',
      label: '',
      documentName: '',
      notes: '',
      file: null,
      verified: false,
      error: '',
      submitting: false,
      replacing: false,
    });
  };

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setEvidenceForm((current) => ({ ...current, file: null, error: '' }));
      return;
    }

    const error = getEvidenceFileError(file);
    setEvidenceForm((current) => ({
      ...current,
      file: error ? null : file,
      error: error || '',
    }));
  };

  const handleEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !evidenceForm.sponsorshipId || !evidenceForm.evidenceType)
      return;

    if (!selected.employeeId) {
      setEvidenceForm((current) => ({
        ...current,
        error: 'Sponsored employee is missing from this record.',
      }));
      return;
    }

    if (!evidenceForm.documentName.trim()) {
      setEvidenceForm((current) => ({
        ...current,
        error: 'Document name is required.',
      }));
      return;
    }

    if (!evidenceForm.file) {
      setEvidenceForm((current) => ({
        ...current,
        error: 'Evidence file is required.',
      }));
      return;
    }

    try {
      setEvidenceForm((current) => ({
        ...current,
        submitting: true,
        error: '',
      }));
      const fd = new FormData();
      fd.append('file', evidenceForm.file);
      fd.append('employeeId', String(selected.employeeId));
      fd.append('name', evidenceForm.documentName.trim());
      fd.append(
        'type',
        EVIDENCE_DOCUMENT_TYPES[evidenceForm.evidenceType] || 'OTHER',
      );

      const document = await apiUpload('/documents/upload', fd);
      await apiPost(
        `/sponsorships/${evidenceForm.sponsorshipId}/compliance/evidence`,
        {
          evidenceType: evidenceForm.evidenceType,
          documentId: document.id,
          notes: evidenceForm.notes.trim(),
          verifiedAt: evidenceForm.verified
            ? new Date().toISOString()
            : undefined,
        },
      );

      await loadCompliancePack(evidenceForm.sponsorshipId);
      const wasReplacing = evidenceForm.replacing;
      closeEvidenceForm();
      alert(
        wasReplacing
          ? 'Evidence replaced and re-linked successfully.'
          : 'Evidence uploaded and linked successfully.',
      );
    } catch (err: any) {
      setEvidenceForm((current) => ({
        ...current,
        submitting: false,
        error: err.message || 'Failed to upload and link evidence.',
      }));
    }
  };

  const missingCount = selectedCompliance?.missingCount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsorships"
        subline="Compliance evidence and reportable event tracking for sponsored workers."
        actions={
          canManageCore ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                Export to Excel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  if (!showForm) resetForm();
                  setShowForm(!showForm);
                }}
              >
                {showForm ? 'Cancel' : 'Add sponsorship'}
              </Button>
            </>
          ) : undefined
        }
      />

      {showForm && (
        <Card
          title={editingId ? 'Edit sponsorship' : 'New sponsorship'}
          description="Record the details exactly as they appear on the certificate of sponsorship."
        >
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <Select
              label="Employee"
              id="sponsorship-employee"
              value={formData.employeeId}
              onChange={(e) =>
                setFormData({ ...formData, employeeId: e.target.value })
              }
              required
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </Select>

            <Input
              label="Visa type"
              id="sponsorship-visa-type"
              value={formData.visaType}
              onChange={(e) =>
                setFormData({ ...formData, visaType: e.target.value })
              }
              placeholder="Skilled Worker"
              required
            />

            <Input
              label="CAS number"
              id="sponsorship-cas-number"
              value={formData.casNumber}
              onChange={(e) =>
                setFormData({ ...formData, casNumber: e.target.value })
              }
              placeholder="Certificate of sponsorship number"
              className="font-mono"
            />

            <Input
              label="Sponsor licence number"
              id="sponsorship-license-number"
              value={formData.sponsorLicenseNumber}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sponsorLicenseNumber: e.target.value,
                })
              }
              placeholder="Company sponsor licence"
              className="font-mono"
              help="Leave blank to use the licence recorded in Settings."
            />

            <Select
              label="CoS type"
              id="sponsorship-cos-type"
              value={formData.cosType}
              onChange={(e) =>
                setFormData({ ...formData, cosType: e.target.value })
              }
            >
              <option value="">Not recorded</option>
              <option value="DEFINED">
                Defined (worker applying from outside the UK)
              </option>
              <option value="UNDEFINED">
                Undefined (in-country application)
              </option>
            </Select>

            <Input
              label="CoS assigned on"
              id="sponsorship-cos-assigned"
              type="date"
              value={formData.cosAssignedDate}
              onChange={(e) =>
                setFormData({ ...formData, cosAssignedDate: e.target.value })
              }
            />

            <Input
              label="Worker must start by"
              id="sponsorship-cos-start-by"
              type="date"
              value={formData.cosStartBy}
              onChange={(e) =>
                setFormData({ ...formData, cosStartBy: e.target.value })
              }
              help="Defaults to three months after assignment."
            />

            <Input
              label="Immigration skills charge paid (£)"
              id="sponsorship-isc"
              type="number"
              min="0"
              step="0.01"
              value={formData.iscAmount}
              onChange={(e) =>
                setFormData({ ...formData, iscAmount: e.target.value })
              }
              placeholder="1000"
            />

            <Input
              label="SOC code"
              id="sponsorship-soc-code"
              type="text"
              value={formData.socCode}
              onChange={(e) =>
                setFormData({ ...formData, socCode: e.target.value })
              }
              placeholder="6145"
              className="font-mono"
            />

            <Input
              label="Job title on CoS"
              id="sponsorship-cos-job-title"
              type="text"
              value={formData.jobTitleOnCos}
              onChange={(e) =>
                setFormData({ ...formData, jobTitleOnCos: e.target.value })
              }
              placeholder="As stated on the CoS"
            />

            <Input
              label="CoS salary (annual gross)"
              id="sponsorship-cos-salary"
              type="number"
              step="any"
              value={formData.cosSalary}
              onChange={(e) =>
                setFormData({ ...formData, cosSalary: e.target.value })
              }
              placeholder="30000"
              help="Pay is reconciled against this every pay period."
            />

            <Input
              label="Weekly hours on CoS"
              id="sponsorship-cos-weekly-hours"
              type="number"
              step="any"
              value={formData.cosWeeklyHours}
              onChange={(e) =>
                setFormData({ ...formData, cosWeeklyHours: e.target.value })
              }
              placeholder="37.5"
            />

            <Input
              label="Going rate for SOC code"
              id="sponsorship-going-rate"
              type="number"
              step="any"
              value={formData.goingRateSalary}
              onChange={(e) =>
                setFormData({ ...formData, goingRateSalary: e.target.value })
              }
              placeholder="38700"
              help="The higher of this and the CoS salary is the threshold."
            />

            <Input
              label="Work location"
              id="sponsorship-work-location"
              type="text"
              value={formData.workLocation}
              onChange={(e) =>
                setFormData({ ...formData, workLocation: e.target.value })
              }
              placeholder="Primary work address"
            />

            <Input
              label="Start date"
              id="sponsorship-start-date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              type="date"
              required
            />

            <Input
              label="End date (visa expiry)"
              id="sponsorship-end-date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              type="date"
            />

            <Textarea
              label="Compliance notes"
              id="sponsorship-compliance-notes"
              value={formData.complianceNotes}
              onChange={(e) =>
                setFormData({ ...formData, complianceNotes: e.target.value })
              }
              placeholder="Any compliance-related notes"
              rows={3}
              wrapperClassName="md:col-span-2"
            />

            <label className="flex items-center gap-2 text-sm text-ink md:col-span-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) =>
                  setFormData({ ...formData, active: e.target.checked })
                }
                className="h-4 w-4 rounded-sm border-line-2 accent-accent"
              />
              <span>Active sponsorship</span>
            </label>

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit">
                {editingId ? 'Save changes' : 'Add sponsorship'}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      <Card
        flush
        title="Sponsored workers"
        description="Select a row to open its evidence checklist and reportable events."
      >
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<IdentificationIcon />}
              title="No sponsorships yet"
              body="Record a certificate of sponsorship and the evidence checklist appears here."
            />
          </div>
        ) : (
          <Table className="min-w-[880px]">
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Visa</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th>Compliance</Th>
                <Th>Open events</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((sponsorship) => {
                const pack = complianceById[sponsorship.id];
                const missing = pack?.missingCount ?? 0;
                const eventCount = openEvents.filter(
                  (event) => event.sponsorshipId === sponsorship.id,
                ).length;
                const status = complianceStatus(sponsorship);

                return (
                  <Tr
                    key={sponsorship.id}
                    clickable
                    selected={selected?.id === sponsorship.id}
                    onClick={() => {
                      setSelectedId(sponsorship.id);
                      loadCompliancePack(sponsorship.id);
                    }}
                  >
                    <Td>
                      <div className="font-medium text-ink">
                        {employeeName(sponsorship, employees)}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        <span className="font-mono">
                          {sponsorship.sponsorLicenseNumber ||
                            'No licence recorded'}
                        </span>
                        {sponsorship.cosType &&
                          ` · ${sponsorship.cosType === 'DEFINED' ? 'Defined' : 'Undefined'} CoS`}
                        {sponsorship.cosStartBy &&
                          !sponsorship.employee?.startDate &&
                          ` · start by ${formatDate(sponsorship.cosStartBy)}`}
                      </div>
                    </Td>
                    <Td className="text-ink-2">{sponsorship.visaType}</Td>
                    <Td className="whitespace-nowrap font-mono text-[13px] text-ink-2">
                      {formatDate(sponsorship.startDate)}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[13px] text-ink-2">
                      {formatDate(sponsorship.endDate) || 'Not set'}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[status]}>{status}</Badge>
                      <div className="mt-1 text-xs text-ink-3">
                        {missing} missing
                      </div>
                    </Td>
                    <Td>
                      {eventCount > 0 ? (
                        <Badge tone="warn">{eventCount} open</Badge>
                      ) : (
                        <span className="text-ink-3">None</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {selected && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card
            title={employeeName(selected, employees)}
            description={`Evidence checklist for ${selected.visaType}`}
            action={
              canManageCore ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(selected)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleting(selected)}
                  >
                    Delete
                  </Button>
                </div>
              ) : undefined
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={missingCount === 0 ? 'ok' : 'warn'}>
                {missingCount} missing
              </Badge>
              <span className="text-[13px] text-ink-3">
                of {(selectedCompliance?.requiredEvidence || []).length}{' '}
                required records
              </span>
            </div>

            <div className="mb-4">
              <h4 className="text-[13px] font-medium text-ink">
                Sponsor licence evidence
              </h4>
              <p className="mt-1 text-[13px] text-ink-2">
                These records prove the checks behind a Skilled Worker
                sponsorship: right to work, employment terms, recruitment,
                salary level and skill level. Uploading evidence here stores the
                file against the employee and links it to the compliance
                checklist for audit review.
              </p>
            </div>

            <div className="divide-y divide-line border-t border-line">
              {(selectedCompliance?.requiredEvidence || []).map((item: any) => (
                <div
                  key={item.key}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">
                      {item.label}
                    </div>
                    <div className="text-[13px] text-ink-2">
                      {item.status === 'COMPLETE'
                        ? item.evidence?.notes?.trim() ||
                          `Linked: ${item.evidence?.document?.name || 'evidence on file'}`
                        : 'Evidence not linked'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge tone={item.status === 'COMPLETE' ? 'ok' : 'bad'}>
                      {item.status === 'COMPLETE' ? 'Complete' : 'Missing'}
                    </Badge>
                    {canUploadEvidence && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEvidenceForm(item)}
                        aria-label={`${item.status === 'COMPLETE' ? 'Replace' : 'Add'} evidence for ${item.label}`}
                      >
                        {item.status === 'COMPLETE'
                          ? 'Replace evidence'
                          : 'Add evidence'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!selectedCompliance && (
                <p className="py-3 text-[13px] text-ink-3">
                  Compliance pack unavailable.
                </p>
              )}
            </div>

            {evidenceForm.sponsorshipId === selected.id && (
              <form
                onSubmit={handleEvidenceSubmit}
                className="mt-5 border-t border-line pt-5"
              >
                <h4 className="text-base font-semibold text-ink">
                  {evidenceForm.replacing ? 'Replace evidence' : 'Add evidence'}
                  : {evidenceForm.label}
                </h4>
                <p className="mt-1 text-[13px] text-ink-2">
                  {evidenceForm.replacing
                    ? 'Upload a corrected file to replace the current evidence. '
                    : ''}
                  This file will be stored in{' '}
                  {employeeName(selected, employees)}&apos;s documents and
                  linked to this sponsorship checklist.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input
                    label="Document name"
                    id="evidence-document-name"
                    value={evidenceForm.documentName}
                    onChange={(event) =>
                      setEvidenceForm((current) => ({
                        ...current,
                        documentName: event.target.value,
                        error: '',
                      }))
                    }
                    required
                  />

                  <div>
                    <label
                      htmlFor="evidence-file"
                      className="mb-1.5 block text-[13px] font-medium text-ink"
                    >
                      Evidence file
                    </label>
                    <input
                      id="evidence-file"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={handleEvidenceFileChange}
                      className={FILE_INPUT_CLASS}
                    />
                    <p className="mt-1.5 text-xs text-ink-3">
                      PDF, PNG, JPG, DOC or DOCX up to 5MB.
                    </p>
                  </div>

                  <Textarea
                    label="Evidence notes"
                    id="evidence-notes"
                    value={evidenceForm.notes}
                    onChange={(event) =>
                      setEvidenceForm((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="What was checked, who verified it, or where the proof came from"
                    wrapperClassName="md:col-span-2"
                  />

                  <label className="flex items-start gap-2 text-[13px] text-ink-2 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={evidenceForm.verified}
                      onChange={(event) =>
                        setEvidenceForm((current) => ({
                          ...current,
                          verified: event.target.checked,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 rounded-sm border-line-2 accent-accent"
                    />
                    <span>
                      I have checked this document against the original and it
                      is genuine. Marks the evidence as verified today, under my
                      name.
                    </span>
                  </label>
                </div>

                {evidenceForm.error && (
                  <p role="alert" className="mt-3 text-sm text-bad">
                    {evidenceForm.error}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="submit" loading={evidenceForm.submitting}>
                    {evidenceForm.replacing
                      ? 'Replace and re-link evidence'
                      : 'Upload and link evidence'}
                  </Button>
                  <Button variant="ghost" onClick={closeEvidenceForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card
            title="Reportable events"
            description="Changes the Home Office must be told about."
            action={
              <Badge tone={selectedEvents.length > 0 ? 'warn' : 'ok'}>
                {selectedEvents.length} open
              </Badge>
            }
          >
            {selectedEvents.length === 0 ? (
              <p className="text-[13px] text-ink-3">
                No open reportable events.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {selectedEvents.map((event) => (
                  <li
                    key={
                      event.id ??
                      `auto-${event.sponsorshipId}-${event.eventType}-${event.dueDate}`
                    }
                    className="py-3 first:pt-0"
                  >
                    <div className="text-sm font-medium text-ink">
                      {labelEventType(event.eventType)}
                    </div>
                    <div className="mt-0.5 font-mono text-[13px] text-ink-2">
                      Due {formatDate(event.dueDate)}
                    </div>
                    {event.notes && (
                      <p className="mt-1 text-[13px] text-ink-2">
                        {event.notes}
                      </p>
                    )}
                    {canManageCore && event.id && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => handleMarkReported(event.id)}
                      >
                        Mark reported
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canSupportReporting && (
              <form
                onSubmit={handleCreateEvent}
                className="mt-5 space-y-4 border-t border-line pt-5"
              >
                <Select
                  label="Reportable event type"
                  id="reportable-event-type"
                  value={eventForm.eventType}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, eventType: e.target.value })
                  }
                >
                  {EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {labelEventType(eventType)}
                    </option>
                  ))}
                </Select>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Event date"
                    id="reportable-event-date"
                    type="date"
                    value={eventForm.eventDate}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        eventDate: e.target.value,
                      })
                    }
                    required
                  />
                  <Input
                    label="Due date"
                    id="reportable-due-date"
                    type="date"
                    value={eventForm.dueDate}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, dueDate: e.target.value })
                    }
                    required
                  />
                </div>

                <Textarea
                  label="Notes"
                  id="reportable-notes"
                  value={eventForm.notes}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, notes: e.target.value })
                  }
                  rows={3}
                />

                <Button type="submit" variant="secondary">
                  Add reportable event
                </Button>
              </form>
            )}
          </Card>
        </div>
      )}

      <Dialog
        open={!!deleting}
        title="Delete sponsorship"
        description={
          deleting
            ? `Delete the sponsorship record for ${employeeName(deleting, employees)}? Linked evidence documents stay in the employee's file.`
            : undefined
        }
        onClose={() => setDeleting(null)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Delete sponsorship
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
