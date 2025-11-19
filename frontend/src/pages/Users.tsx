import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import Card from '../components/Card'
import { HiPlus } from 'react-icons/hi'

export default function Users() {
  const [items, setItems] = React.useState<any[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [newUserCredentials, setNewUserCredentials] = React.useState<{email: string, password: string} | null>(null)
  const [showDevTools, setShowDevTools] = React.useState(false)
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    name: '',
    role: 'USER'
  })

  const loadUsers = () => {
    apiGet('/auth/users')
      .then(setItems)
      .catch(() => setItems([]))
  }

  React.useEffect(() => {
    loadUsers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        const updateData: any = { email: formData.email, name: formData.name, role: formData.role }
        if (formData.password) updateData.password = formData.password
        await apiPut(`/auth/users/${editingId}`, updateData)
        alert('User updated successfully!')
        setShowForm(false)
        setEditingId(null)
        setFormData({ email: '', password: '', name: '', role: 'USER' })
      } else {
        // Save credentials before clearing form
        const credentials = { email: formData.email, password: formData.password }
        await apiPost('/auth/register', formData)
        // Show success with credentials
        setNewUserCredentials(credentials)
        setShowForm(false)
        setFormData({ email: '', password: '', name: '', role: 'USER' })
      }
      loadUsers()
    } catch (err: any) {
      console.error('Error saving user:', err)
      alert('Failed to save user: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleEdit = (user: any) => {
    setEditingId(user.id)
    setFormData({
      email: user.email,
      password: '',
      name: user.name || '',
      role: user.role || 'USER'
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    
    try {
      await apiDelete(`/auth/users/${id}`)
      alert('User deleted successfully!')
      loadUsers()
    } catch (err: any) {
      console.error('Error deleting user:', err)
      alert('Failed to delete user: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ email: '', password: '', name: '', role: 'USER' })
  }

  const handleSeedData = async () => {
    if (!confirm('This will create sample employees, projects, timesheets, leave requests, and sponsorships. Continue?')) return
    
    try {
      const result = await apiPost('/admin/seed-data', {})
      alert('✅ Sample data created!\n\n' + JSON.stringify(result.results, null, 2) + '\n\n' + (result.note || ''))
      loadUsers()
    } catch (err: any) {
      alert('❌ Failed to seed data: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleClearData = async () => {
    if (!confirm('⚠️ WARNING: This will DELETE all employees, projects, timesheets, leave requests, sponsorships, and documents!\n\nUser accounts will be preserved.\n\nAre you SURE?')) return
    if (!confirm('This action CANNOT be undone! Click OK to proceed.')) return
    
    try {
      const result = await apiPost('/admin/clear-data', {})
      alert('✅ Data cleared!\n\n' + JSON.stringify(result.results, null, 2))
      loadUsers()
    } catch (err: any) {
      alert('❌ Failed to clear data: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleBackup = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/backup`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Backup failed')
      
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hrm-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      alert('✅ Backup downloaded successfully!')
    } catch (err: any) {
      alert('❌ Failed to create backup: ' + (err.message || JSON.stringify(err)))
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 
          className="text-2xl font-semibold cursor-pointer" 
          onDoubleClick={() => setShowDevTools(!showDevTools)}
          title="Double-click for dev tools"
        >
          User Management
        </h2>
        <button
          onClick={() => {
            setNewUserCredentials(null); // Clear any success message
            if (showForm && !editingId) {
              setShowForm(false);
            } else {
              setEditingId(null);
              setFormData({ email: '', password: '', name: '', role: 'USER' });
              setShowForm(true);
            }
          }}
          className="btn-primary"
        >
          <HiPlus /> {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showDevTools && (
        <div className="mb-6 p-4 border-2 border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">🔧 Developer Tools</h3>
            <button 
              onClick={() => setShowDevTools(false)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
            Use these tools to quickly populate or reset the database for testing.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBackup}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
            >
              💾 Download Backup
            </button>
            <button
              onClick={handleSeedData}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            >
              🌱 Seed Sample Data
            </button>
            <button
              onClick={handleClearData}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold"
            >
              🗑️ Clear All Data
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
            <strong>Backup:</strong> Downloads complete database as JSON file (passwords redacted).<br/>
            <strong>Seed:</strong> Creates 4 employees, 4 projects, timesheets, leave requests, and sponsorships. Also creates 2 user accounts.<br/>
            <strong>Clear:</strong> Deletes all data except user accounts. Users will remain but be unlinked from employees.
          </p>
        </div>
      )}

      {newUserCredentials && (
        <div className="mb-6 p-6 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-900/20">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">✓ User Created Successfully!</h3>
            <button 
              onClick={() => setNewUserCredentials(null)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mb-4">
            Save these login credentials - they won't be shown again:
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 space-y-2 font-mono text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Email:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{newUserCredentials.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Password:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{newUserCredentials.password}</span>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
            The user can login at <a href="/login" className="underline text-blue-600 dark:text-blue-400">/login</a> with these credentials.
          </p>
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold mb-3">{editingId ? 'Edit User' : 'New User'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Email *"
              type="email"
              required
              className="form-input"
            />
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Name"
              className="form-input"
            />
            <input
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={editingId ? "Password (leave blank to keep)" : "Password *"}
              type="password"
              required={!editingId}
              className="form-input"
            />
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="form-input"
              required
            >
              <option value="">Select Role *</option>
              <option value="USER">Employee (User)</option>
              <option value="ADMIN">Administrator (Admin)</option>
              <option value="MANAGER">Manager</option>
            </select>
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                {editingId ? 'Update User' : 'Add User'}
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
        {items.map((user) => (
          <Card key={user.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-bold text-slate-900 dark:text-white">{user.name || user.email}</div>
                  <span className={`px-2 py-1 text-xs rounded font-semibold ${
                    user.role === 'ADMIN' ? 'bg-red-500 text-white' :
                    user.role === 'MANAGER' ? 'bg-blue-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {user.role}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">{user.email}</div>
                
                {user.employee ? (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 mb-1">
                      <span>✓</span>
                      <span className="font-semibold">Linked to Employee:</span>
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {user.employee.firstName} {user.employee.lastName}
                    </div>
                    {user.employee.jobTitle && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {user.employee.jobTitle}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-orange-600 dark:text-orange-400">
                      ⚠ Not linked to employee record
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
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
