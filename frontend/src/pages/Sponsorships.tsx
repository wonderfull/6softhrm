import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import Card from '../components/Card'
import * as XLSX from 'xlsx'

export default function Sponsorships() {
  const [items, setItems] = React.useState<any[]>([])
  const [employees, setEmployees] = React.useState<any[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [formData, setFormData] = React.useState({
    employeeId: '',
    visaType: '',
    casNumber: '',
    sponsorLicenseNumber: '',
    startDate: '',
    endDate: '',
    complianceNotes: '',
    active: true
  })

  const loadSponsorships = () => {
    apiGet('/sponsorships')
      .then(setItems)
      .catch(() => setItems([]))
  }

  const loadEmployees = () => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]))
  }

  React.useEffect(() => {
    loadSponsorships()
    loadEmployees()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        employeeId: parseInt(formData.employeeId)
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
      setFormData({
        employeeId: '',
        visaType: '',
        casNumber: '',
        sponsorLicenseNumber: '',
        startDate: '',
        endDate: '',
        complianceNotes: '',
        active: true
      })
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
      active: sponsorship.active !== false
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this sponsorship?')) return
    
    try {
      await apiDelete(`/sponsorships/${id}`)
      alert('Sponsorship deleted successfully!')
      loadSponsorships()
    } catch (err: any) {
      console.error('Error deleting sponsorship:', err)
      alert('Failed to delete sponsorship: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      employeeId: '',
      visaType: '',
      casNumber: '',
      sponsorLicenseNumber: '',
      startDate: '',
      endDate: '',
      complianceNotes: '',
      active: true
    })
  }

  const handleExport = () => {
    try {
      const exportData = items.map(item => {
        const employee = employees.find(e => e.id === item.employeeId)
        return {
          'Employee': employee ? `${employee.firstName} ${employee.lastName}` : 'N/A',
          'Visa Type': item.visaType,
          'CAS Number': item.casNumber || '',
          'Sponsor License Number': item.sponsorLicenseNumber || '',
          'Start Date': item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB') : '',
          'End Date': item.endDate ? new Date(item.endDate).toLocaleDateString('en-GB') : '',
          'Compliance Notes': item.complianceNotes || '',
          'Status': item.active ? 'Active' : 'Inactive'
        }
      })
      
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sponsorships')
      
      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0]
      XLSX.writeFile(workbook, `Sponsorships_Export_${date}.xlsx`)
    } catch (err) {
      console.error('Failed to export:', err)
      alert('Failed to export data. Please try again.')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Sponsorships</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to Excel
          </button>
          <button
            onClick={() => { 
              setEditingId(null);
              if (!showForm) {
                // Clear form when opening new sponsorship
                setFormData({
                  employeeId: '',
                  visaType: '',
                  casNumber: '',
                  sponsorLicenseNumber: '',
                  startDate: '',
                  endDate: '',
                  complianceNotes: '',
                  active: true
                });
              }
              setShowForm(!showForm);
            }}
            className="btn-primary"
          >
            {showForm ? 'Cancel' : 'Add Sponsorship'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">{editingId ? 'Edit Sponsorship' : 'New Sponsorship'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sponsorship-employee" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee *
              </label>
              <select
                id="sponsorship-employee"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                required
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="sponsorship-visa-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Visa Type *
              </label>
              <input
                id="sponsorship-visa-type"
                value={formData.visaType}
                onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
                placeholder="e.g., Skilled Worker"
                required
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="sponsorship-cas-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                CAS Number
              </label>
              <input
                id="sponsorship-cas-number"
                value={formData.casNumber}
                onChange={(e) => setFormData({ ...formData, casNumber: e.target.value })}
                placeholder="Certificate of Sponsorship Number"
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="sponsorship-license-number" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sponsor License Number
              </label>
              <input
                id="sponsorship-license-number"
                value={formData.sponsorLicenseNumber}
                onChange={(e) => setFormData({ ...formData, sponsorLicenseNumber: e.target.value })}
                placeholder="Company Sponsor License"
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="sponsorship-start-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Date *
              </label>
              <input
                id="sponsorship-start-date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                type="date"
                required
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="sponsorship-end-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Date (Visa Expiry)
              </label>
              <input
                id="sponsorship-end-date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                type="date"
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            
            <div className="col-span-2">
              <label htmlFor="sponsorship-compliance-notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Compliance Notes
              </label>
              <textarea
                id="sponsorship-compliance-notes"
                value={formData.complianceNotes}
                onChange={(e) => setFormData({ ...formData, complianceNotes: e.target.value })}
                placeholder="Any compliance-related notes..."
                rows={3}
                className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            
            <label className="col-span-2 flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <span>Active Sponsorship</span>
            </label>

            <div className="col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium">
                {editingId ? 'Update Sponsorship' : 'Add Sponsorship'}
              </button>
              {editingId && (
                <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-medium">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {items.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold">{s.employee?.firstName} {s.employee?.lastName}</div>
                  {s.active && <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">Active</span>}
                </div>
                <div className="text-sm">{s.visaType}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Start: {new Date(s.startDate).toLocaleDateString()}
                  {s.endDate && ` • End: ${new Date(s.endDate).toLocaleDateString()}`}
                </div>
                {s.sponsorLicenseNumber && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">License: {s.sponsorLicenseNumber}</div>
                )}
                {s.complianceNotes && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Notes: {s.complianceNotes}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(s)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && <div className="text-slate-500">No sponsorships yet.</div>}
      </div>
    </div>
  )
}
