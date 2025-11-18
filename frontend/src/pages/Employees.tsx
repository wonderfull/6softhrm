import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import Card from '../components/Card'
import { HiPlus } from 'react-icons/hi'

export default function Employees() {
  const [items, setItems] = React.useState<any[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    jobTitle: '',
    employeeType: 'EMPLOYEE',
    department: '',
    niNumber: '',
    startDate: '',
    // Bank Details
    bankName: '',
    accountNumber: '',
    sortCode: '',
    // Emergency Contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    emergencyContactAddress: ''
  })

  const loadEmployees = () => {
    apiGet('/employees')
      .then(setItems)
      .catch(() => setItems([]))
  }

  React.useEffect(() => {
    loadEmployees()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        await apiPut(`/employees/${editingId}`, formData)
        alert('Employee updated successfully!')
      } else {
        await apiPost('/employees', formData)
        alert('Employee added successfully!')
      }
      setShowForm(false)
      setEditingId(null)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        jobTitle: '',
        employeeType: 'EMPLOYEE',
        department: '',
        niNumber: '',
        startDate: '',
        bankName: '',
        accountNumber: '',
        sortCode: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        emergencyContactAddress: ''
      })
      loadEmployees()
    } catch (err: any) {
      console.error('Error saving employee:', err)
      alert('Failed to save employee: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleEdit = (employee: any) => {
    setEditingId(employee.id)
    setFormData({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phoneNumber: employee.phoneNumber || '',
      jobTitle: employee.jobTitle || '',
      employeeType: employee.employeeType || 'EMPLOYEE',
      department: employee.department || '',
      niNumber: employee.niNumber || '',
      startDate: employee.startDate ? employee.startDate.split('T')[0] : '',
      bankName: employee.bankName || '',
      accountNumber: employee.accountNumber || '',
      sortCode: employee.sortCode || '',
      emergencyContactName: employee.emergencyContactName || '',
      emergencyContactPhone: employee.emergencyContactPhone || '',
      emergencyContactRelation: employee.emergencyContactRelation || '',
      emergencyContactAddress: employee.emergencyContactAddress || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this employee?')) return
    
    try {
      await apiDelete(`/employees/${id}`)
      alert('Employee deleted successfully!')
      loadEmployees()
    } catch (err: any) {
      console.error('Error deleting employee:', err)
      alert('Failed to delete employee: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      jobTitle: '',
      employeeType: 'EMPLOYEE',
      department: '',
      niNumber: '',
      startDate: '',
      bankName: '',
      accountNumber: '',
      sortCode: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      emergencyContactAddress: ''
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Employees</h2>
        <button
          onClick={() => {
            if (showForm && !editingId) {
              setShowForm(false);
            } else {
              setEditingId(null);
              setFormData({
                firstName: '',
                lastName: '',
                email: '',
                phoneNumber: '',
                jobTitle: '',
                employeeType: 'EMPLOYEE',
                department: '',
                niNumber: '',
                startDate: '',
                bankName: '',
                accountNumber: '',
                sortCode: '',
                emergencyContactName: '',
                emergencyContactPhone: '',
                emergencyContactRelation: '',
                emergencyContactAddress: ''
              });
              setShowForm(true);
            }
          }}
          className="btn-primary"
        >
          <HiPlus /> {showForm ? 'Cancel' : 'Add Employee'}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold mb-3">{editingId ? 'Edit Employee' : 'New Employee'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="First Name *"
              required
              className="form-input"
            />
            <input
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Last Name *"
              required
              className="form-input"
            />
            <input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Email *"
              type="email"
              required
              className="form-input"
            />
            <input
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="Phone Number"
              className="form-input"
            />
            <input
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="Job Title *"
              required
              className="form-input"
            />
            <select
              value={formData.employeeType}
              onChange={(e) => setFormData({ ...formData, employeeType: e.target.value })}
              className="form-input"
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="DIRECTOR">Director</option>
            </select>
            <input
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="Department"
              className="form-input"
            />
            <input
              value={formData.niNumber}
              onChange={(e) => setFormData({ ...formData, niNumber: e.target.value })}
              placeholder="NI Number (UK)"
              className="form-input"
            />
            <input
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              placeholder="Start Date"
              type="date"
              className="form-input"
            />

            {/* Bank Details Section */}
            <div className="col-span-2 mt-4 mb-2">
              <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">Bank Details</h4>
              <div className="h-px bg-slate-300 dark:bg-slate-600 mt-1"></div>
            </div>
            <input
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              placeholder="Bank Name"
              className="form-input"
            />
            <input
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              placeholder="Account Number"
              className="form-input"
            />
            <input
              value={formData.sortCode}
              onChange={(e) => setFormData({ ...formData, sortCode: e.target.value })}
              placeholder="Sort Code"
              className="form-input"
            />

            {/* Emergency Contact Section */}
            <div className="col-span-2 mt-4 mb-2">
              <h4 className="text-md font-semibold text-slate-700 dark:text-slate-300">Emergency Contact Information</h4>
              <div className="h-px bg-slate-300 dark:bg-slate-600 mt-1"></div>
            </div>
            <input
              value={formData.emergencyContactName}
              onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              placeholder="Emergency Contact Name"
              className="form-input"
            />
            <input
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              placeholder="Emergency Contact Phone"
              className="form-input"
            />
            <input
              value={formData.emergencyContactRelation}
              onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
              placeholder="Relationship"
              className="form-input"
            />
            <input
              value={formData.emergencyContactAddress}
              onChange={(e) => setFormData({ ...formData, emergencyContactAddress: e.target.value })}
              placeholder="Emergency Contact Address"
              className="form-input col-span-2"
            />

            <div className="col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                {editingId ? 'Update Employee' : 'Add Employee'}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-bold">{e.firstName} {e.lastName}</div>
                  {e.employeeType === 'DIRECTOR' && (
                    <span className="px-2 py-1 text-xs bg-purple-500 text-white rounded">Director</span>
                  )}
                </div>
                <div className="text-sm">{e.jobTitle} — {e.email}</div>
                {e.department && <div className="text-sm text-slate-600 dark:text-slate-400">Department: {e.department}</div>}
                {e.niNumber && <div className="text-sm text-slate-600 dark:text-slate-400">NI: {e.niNumber}</div>}
                
                {/* Bank Details Preview */}
                {e.bankName && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bank Details</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">{e.bankName}</div>
                    {e.sortCode && <div className="text-xs text-slate-500 dark:text-slate-500">Sort: {e.sortCode}</div>}
                  </div>
                )}
                
                {/* Emergency Contact Preview */}
                {e.emergencyContactName && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Emergency Contact</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">{e.emergencyContactName}</div>
                    {e.emergencyContactPhone && <div className="text-xs text-slate-500 dark:text-slate-500">{e.emergencyContactPhone}</div>}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(e)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
