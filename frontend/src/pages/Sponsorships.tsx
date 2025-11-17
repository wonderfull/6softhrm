import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import Card from '../components/Card'

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Sponsorships</h2>
        <button
          onClick={() => { setEditingId(null); setShowForm(!showForm); }}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : 'Add Sponsorship'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold mb-3">{editingId ? 'Edit Sponsorship' : 'New Sponsorship'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              required
              className="form-input"
            >
              <option value="">Select Employee *</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
            
            <input
              value={formData.visaType}
              onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}
              placeholder="Visa Type *"
              required
              className="form-input"
            />
            
            <input
              value={formData.casNumber}
              onChange={(e) => setFormData({ ...formData, casNumber: e.target.value })}
              placeholder="CAS Number"
              className="form-input"
            />
            
            <input
              value={formData.sponsorLicenseNumber}
              onChange={(e) => setFormData({ ...formData, sponsorLicenseNumber: e.target.value })}
              placeholder="Sponsor License Number"
              className="form-input"
            />
            
            <input
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              placeholder="Start Date"
              type="date"
              required
              className="form-input"
            />
            
            <input
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              placeholder="End Date"
              type="date"
              className="form-input"
            />
            
            <textarea
              value={formData.complianceNotes}
              onChange={(e) => setFormData({ ...formData, complianceNotes: e.target.value })}
              placeholder="Compliance Notes"
              rows={3}
              className="form-input"
            />
            
            <label className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <span>Active Sponsorship</span>
            </label>

            <div className="col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                {editingId ? 'Update Sponsorship' : 'Add Sponsorship'}
              </button>
              {editingId && (
                <button type="button" onClick={handleCancel} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
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
