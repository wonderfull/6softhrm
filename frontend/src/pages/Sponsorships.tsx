import React from 'react'
import { HiArrowDownTray, HiCheckCircle, HiClipboardDocumentList, HiPencilSquare, HiPlus, HiTrash } from 'react-icons/hi2'
import { apiDelete, apiGet, apiPost, apiPut, getCurrentUser } from '../lib/api'
import { isElevatedRole, normalizeRole } from '../lib/roles'
import * as XLSX from 'xlsx'

const EVENT_TYPES = [
  'DELAYED_START',
  'UNAUTHORISED_ABSENCE_10_DAYS',
  'EMPLOYMENT_ENDED',
  'WORK_LOCATION_CHANGED',
  'UNPAID_LEAVE_OVER_4_WEEKS',
]

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB') : ''
}

function labelEventType(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function employeeName(sponsorship: any, employees: any[]) {
  const employee = sponsorship.employee || employees.find((item) => item.id === sponsorship.employeeId)
  return employee ? `${employee.firstName} ${employee.lastName}` : 'N/A'
}

function statusClass(status: string) {
  if (status === 'Complete') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'
  if (status === 'Expired') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800'
  if (status === 'Expiring') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800'
  return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
}

export default function Sponsorships() {
  const currentUser = getCurrentUser()
  const currentRole = normalizeRole(currentUser?.role)
  const canManageCore = isElevatedRole(currentRole)
  const canSupportReporting = currentRole === 'ADMIN' || currentRole === 'DIRECTOR' || currentRole === 'OFFICE_ASSISTANT'

  const [items, setItems] = React.useState<any[]>([])
  const [employees, setEmployees] = React.useState<any[]>([])
  const [openEvents, setOpenEvents] = React.useState<any[]>([])
  const [complianceById, setComplianceById] = React.useState<Record<number, any>>({})
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [eventForm, setEventForm] = React.useState({
    eventType: 'DELAYED_START',
    eventDate: '',
    dueDate: '',
    notes: '',
  })
  const [formData, setFormData] = React.useState({
    employeeId: '',
    visaType: '',
    casNumber: '',
    sponsorLicenseNumber: '',
    startDate: '',
    endDate: '',
    complianceNotes: '',
    active: true,
  })

  const selected = items.find((item) => item.id === selectedId) || items[0] || null
  const selectedCompliance = selected ? complianceById[selected.id] : null
  const selectedEvents = selected ? openEvents.filter((event) => event.sponsorshipId === selected.id) : []

  const loadCompliancePack = React.useCallback(async (id: number) => {
    try {
      const pack = await apiGet(`/sponsorships/${id}/compliance`)
      setComplianceById((current) => ({ ...current, [id]: pack }))
    } catch {
      setComplianceById((current) => ({ ...current, [id]: null }))
    }
  }, [])

  const loadSponsorships = React.useCallback(async () => {
    try {
      const sponsorships = await apiGet('/sponsorships')
      setItems(sponsorships)
      setSelectedId((current) => current || sponsorships[0]?.id || null)
      sponsorships.forEach((item: any) => loadCompliancePack(item.id))
    } catch {
      setItems([])
    }
  }, [loadCompliancePack])

  const loadEmployees = React.useCallback(() => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]))
  }, [])

  const loadOpenEvents = React.useCallback(() => {
    if (!canSupportReporting) return
    apiGet('/sponsorships/reportable-events/open')
      .then(setOpenEvents)
      .catch(() => setOpenEvents([]))
  }, [canSupportReporting])

  React.useEffect(() => {
    loadSponsorships()
    loadEmployees()
    loadOpenEvents()
  }, [loadEmployees, loadOpenEvents, loadSponsorships])

  const resetForm = () => {
    setFormData({
      employeeId: '',
      visaType: '',
      casNumber: '',
      sponsorLicenseNumber: '',
      startDate: '',
      endDate: '',
      complianceNotes: '',
      active: true,
    })
  }

  const complianceStatus = (sponsorship: any) => {
    const pack = complianceById[sponsorship.id]
    if (sponsorship.endDate) {
      const endDate = new Date(sponsorship.endDate)
      const now = new Date()
      const warningDate = new Date()
      warningDate.setDate(warningDate.getDate() + 30)
      if (endDate < now) return 'Expired'
      if (endDate <= warningDate) return 'Expiring'
    }
    if (!pack) return 'Incomplete'
    return pack.missingCount === 0 ? 'Complete' : 'Incomplete'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        employeeId: parseInt(formData.employeeId),
      }

      if (editingId) {
        await apiPut(`/sponsorships/${editingId}`, data)
        alert('Sponsorship updated successfully!')
      } else {
        await apiPost('/sponsorships', data)
        alert('Sponsorship added successfully!')
      }

      setShowForm(false)
      setEditingId(null)
      resetForm()
      loadSponsorships()
    } catch (err: any) {
      console.error('Error saving sponsorship:', err)
      alert('Failed to save sponsorship: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleEdit = (sponsorship: any) => {
    setEditingId(sponsorship.id)
    setFormData({
      employeeId: sponsorship.employeeId.toString(),
      visaType: sponsorship.visaType || '',
      casNumber: sponsorship.casNumber || '',
      sponsorLicenseNumber: sponsorship.sponsorLicenseNumber || '',
      startDate: sponsorship.startDate ? sponsorship.startDate.split('T')[0] : '',
      endDate: sponsorship.endDate ? sponsorship.endDate.split('T')[0] : '',
      complianceNotes: sponsorship.complianceNotes || '',
      active: sponsorship.active !== false,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sponsorship?')) return

    try {
      await apiDelete(`/sponsorships/${id}`)
      alert('Sponsorship deleted successfully!')
      loadSponsorships()
      loadOpenEvents()
    } catch (err: any) {
      console.error('Error deleting sponsorship:', err)
      alert('Failed to delete sponsorship: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    resetForm()
  }

  const handleExport = () => {
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
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sponsorships')
      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(workbook, `Sponsorships_Export_${date}.xlsx`)
    } catch (err) {
      console.error('Failed to export:', err)
      alert('Failed to export data. Please try again.')
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return

    try {
      await apiPost(`/sponsorships/${selected.id}/reportable-events`, eventForm)
      setEventForm({ eventType: 'DELAYED_START', eventDate: '', dueDate: '', notes: '' })
      loadOpenEvents()
    } catch (err: any) {
      alert('Failed to create reportable event: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleMarkReported = async (eventId: number) => {
    try {
      await apiPut(`/sponsorships/reportable-events/${eventId}/mark-reported`)
      loadOpenEvents()
    } catch (err: any) {
      alert('Failed to mark event reported: ' + (err.message || JSON.stringify(err)))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Sponsorships</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Compliance evidence and reportable event tracking</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <HiArrowDownTray size={18} />
            Export to Excel
          </button>
          {canManageCore && (
            <button
              onClick={() => {
                setEditingId(null)
                if (!showForm) resetForm()
                setShowForm(!showForm)
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <HiPlus size={18} />
              {showForm ? 'Cancel' : 'Add Sponsorship'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Sponsorship' : 'New Sponsorship'}</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="sponsorship-employee" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Employee *
              </label>
              <select
                id="sponsorship-employee"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                required
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sponsorship-visa-type" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Visa Type *
              </label>
              <input
                id="sponsorship-visa-type"
                value={formData.visaType}
                onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
                placeholder="e.g., Skilled Worker"
                required
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="sponsorship-cas-number" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                CAS Number
              </label>
              <input
                id="sponsorship-cas-number"
                value={formData.casNumber}
                onChange={(e) => setFormData({ ...formData, casNumber: e.target.value })}
                placeholder="Certificate of Sponsorship Number"
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="sponsorship-license-number" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Sponsor License Number
              </label>
              <input
                id="sponsorship-license-number"
                value={formData.sponsorLicenseNumber}
                onChange={(e) => setFormData({ ...formData, sponsorLicenseNumber: e.target.value })}
                placeholder="Company Sponsor License"
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="sponsorship-start-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Start Date *
              </label>
              <input
                id="sponsorship-start-date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                type="date"
                required
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="sponsorship-end-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                End Date (Visa Expiry)
              </label>
              <input
                id="sponsorship-end-date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                type="date"
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="sponsorship-compliance-notes" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Compliance Notes
              </label>
              <textarea
                id="sponsorship-compliance-notes"
                value={formData.complianceNotes}
                onChange={(e) => setFormData({ ...formData, complianceNotes: e.target.value })}
                placeholder="Any compliance-related notes..."
                rows={3}
                className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
              />
            </div>

            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 md:col-span-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4"
              />
              <span>Active Sponsorship</span>
            </label>

            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="flex-1 rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
                {editingId ? 'Update Sponsorship' : 'Add Sponsorship'}
              </button>
              {editingId && (
                <button type="button" onClick={handleCancel} className="rounded bg-slate-500 px-4 py-2 font-medium text-white hover:bg-slate-600">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Visa</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Compliance</th>
              <th className="px-4 py-3">Open Events</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {items.map((sponsorship) => {
              const pack = complianceById[sponsorship.id]
              const missingCount = pack?.missingCount ?? 0
              const eventCount = openEvents.filter((event) => event.sponsorshipId === sponsorship.id).length
              const status = complianceStatus(sponsorship)

              return (
                <tr
                  key={sponsorship.id}
                  className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${selected?.id === sponsorship.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                  onClick={() => {
                    setSelectedId(sponsorship.id)
                    loadCompliancePack(sponsorship.id)
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{employeeName(sponsorship, employees)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{sponsorship.sponsorLicenseNumber || 'No licence recorded'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{sponsorship.visaType}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <div>Start: {formatDate(sponsorship.startDate)}</div>
                    <div>End: {formatDate(sponsorship.endDate) || 'Not set'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(status)}`}>{status}</span>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{missingCount} missing</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                      <HiClipboardDocumentList size={15} />
                      {eventCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManageCore ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(sponsorship)
                          }}
                          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <HiPencilSquare className="inline" size={16} /> Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(sponsorship.id)
                          }}
                          className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <HiTrash className="inline" size={16} /> Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">View only</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {items.length === 0 && <div className="p-6 text-slate-500">No sponsorships yet.</div>}
      </div>

      {selected && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{employeeName(selected, employees)}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Evidence checklist for {selected.visaType}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(complianceStatus(selected))}`}>
                {selectedCompliance?.missingCount ?? 0} missing
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {(selectedCompliance?.requiredEvidence || []).map((item: any) => (
                <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{item.evidence?.notes || 'Evidence not linked'}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.status === 'COMPLETE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>
                    {item.status === 'COMPLETE' ? 'Complete' : 'Missing'}
                  </span>
                </div>
              ))}
              {!selectedCompliance && <div className="py-3 text-sm text-slate-500 dark:text-slate-400">Compliance pack unavailable.</div>}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Reportable events</h3>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                {selectedEvents.length} open
              </span>
            </div>

            <div className="space-y-3">
              {selectedEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
                  <div className="font-medium text-slate-900 dark:text-white">{labelEventType(event.eventType)}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Due {formatDate(event.dueDate)}</div>
                  {event.notes && <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{event.notes}</div>}
                  {canManageCore && (
                    <button
                      onClick={() => handleMarkReported(event.id)}
                      className="mt-3 inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <HiCheckCircle size={16} />
                      Mark reported
                    </button>
                  )}
                </div>
              ))}
              {selectedEvents.length === 0 && <div className="text-sm text-slate-500 dark:text-slate-400">No open reportable events.</div>}
            </div>

            {canSupportReporting && (
              <form onSubmit={handleCreateEvent} className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <label htmlFor="reportable-event-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Reportable event type
                </label>
                <select
                  id="reportable-event-type"
                  value={eventForm.eventType}
                  onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value })}
                  className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
                >
                  {EVENT_TYPES.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {labelEventType(eventType)}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reportable-event-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Event date
                    </label>
                    <input
                      id="reportable-event-date"
                      type="date"
                      value={eventForm.eventDate}
                      onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                      required
                      className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="reportable-due-date" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Due date
                    </label>
                    <input
                      id="reportable-due-date"
                      type="date"
                      value={eventForm.dueDate}
                      onChange={(e) => setEventForm({ ...eventForm, dueDate: e.target.value })}
                      required
                      className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <label htmlFor="reportable-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <textarea
                  id="reportable-notes"
                  value={eventForm.notes}
                  onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                  rows={3}
                  className="form-input w-full bg-white text-slate-900 dark:bg-slate-700 dark:text-white"
                />

                <button type="submit" className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                  <HiPlus size={18} />
                  Add reportable event
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
