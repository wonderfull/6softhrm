import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'
import Card from '../components/Card'
import { HiPlus } from 'react-icons/hi'

export default function Users() {
  const [items, setItems] = React.useState<any[]>([])
  const [employees, setEmployees] = React.useState<any[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [showEmployeeList, setShowEmployeeList] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [newUserCredentials, setNewUserCredentials] = React.useState<{email: string, password: string} | null>(null)
  const [generatedResetLink, setGeneratedResetLink] = React.useState<{ email: string; resetLink: string } | null>(null)
  const [busyActionUserId, setBusyActionUserId] = React.useState<number | null>(null)
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

  const loadEmployees = () => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]))
  }

  React.useEffect(() => {
    loadUsers()
    loadEmployees()
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

  const handleGenerateResetLink = async (user: any) => {
    try {
      setBusyActionUserId(user.id)
      const response = await apiPost(`/auth/users/${user.id}/reset-link`)
      setGeneratedResetLink({ email: user.email, resetLink: response.resetLink })
      if (navigator.clipboard?.writeText && response.resetLink) {
        await navigator.clipboard.writeText(response.resetLink)
        alert(`Reset link generated and copied for ${user.email}`)
      } else {
        alert(`Reset link generated for ${user.email}`)
      }
    } catch (err: any) {
      alert('Failed to generate reset link: ' + (err.message || JSON.stringify(err)))
    } finally {
      setBusyActionUserId(null)
    }
  }

  const handleSetTemporaryPassword = async (user: any) => {
    const temporaryPassword = prompt(`Set a temporary password for ${user.email}:`, 'password123')
    if (!temporaryPassword || !temporaryPassword.trim()) return

    try {
      setBusyActionUserId(user.id)
      await apiPost(`/auth/users/${user.id}/reset-password`, {
        newPassword: temporaryPassword.trim()
      })
      alert(`Temporary password updated for ${user.email}`)
    } catch (err: any) {
      alert('Failed to reset password: ' + (err.message || JSON.stringify(err)))
    } finally {
      setBusyActionUserId(null)
    }
  }

  const handleCreateUserForEmployee = async (employee: any) => {
    const password = prompt(`Create user account for ${employee.firstName} ${employee.lastName}\n\nEnter password (or leave blank for default "password123"):`) 
    const finalPassword = password?.trim() || 'password123'
    
    if (!confirm(`Create user account for:\n\nName: ${employee.firstName} ${employee.lastName}\nEmail: ${employee.email}\nPassword: ${finalPassword}\n\nContinue?`)) {
      return
    }

    try {
      await apiPost('/auth/register', {
        email: employee.email,
        password: finalPassword,
        name: `${employee.firstName} ${employee.lastName}`,
        role: 'USER'
      })
      
      // Link user to employee
      const users = await apiGet('/auth/users')
      const newUser = users.find((u: any) => u.email === employee.email)
      if (newUser) {
        await apiPut(`/auth/users/${newUser.id}`, {
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          employeeId: employee.id
        })
      }

      setNewUserCredentials({ email: employee.email, password: finalPassword })
      loadUsers()
      loadEmployees()
    } catch (err: any) {
      alert('Failed to create user: ' + (err.message || JSON.stringify(err)))
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">
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

      {generatedResetLink && (
        <div className="mb-6 p-6 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">Password Reset Link Ready</h3>
            <button
              onClick={() => setGeneratedResetLink(null)}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Employee self-service reset is available from the login page. This admin action generated a direct reset link for <strong>{generatedResetLink.email}</strong>.
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 text-sm break-all font-mono">
            {generatedResetLink.resetLink}
          </div>
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
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => handleEdit(user)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleGenerateResetLink(user)}
                  className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
                  disabled={busyActionUserId === user.id}
                >
                  {busyActionUserId === user.id ? 'Working...' : 'Reset Link'}
                </button>
                <button
                  onClick={() => handleSetTemporaryPassword(user)}
                  className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
                  disabled={busyActionUserId === user.id}
                >
                  Temp Password
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

      {/* Employee to User Creation Section */}
      <div className="mt-8 border-t pt-8 border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            Employees Without User Accounts
          </h3>
          <button
            onClick={() => setShowEmployeeList(!showEmployeeList)}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-2"
          >
            {showEmployeeList ? '▼ Hide' : '▶ Show'} Employee List
          </button>
        </div>

        {showEmployeeList && (
          <Card className="p-6">
            {(() => {
              const employeesWithoutUsers = employees.filter(emp => 
                !items.find(user => user.email === emp.email)
              )
              
              if (employeesWithoutUsers.length === 0) {
                return (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                    <div className="text-4xl mb-3">✓</div>
                    <div className="text-lg font-semibold mb-1">All employees have user accounts!</div>
                    <div className="text-sm">Every employee in the system is linked to a user account.</div>
                  </div>
                )
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">ID</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Name</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Email</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Department</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Job Title</th>
                        <th className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {employeesWithoutUsers.map((employee) => (
                        <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{employee.id}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium">
                            {employee.firstName} {employee.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{employee.email}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{employee.department || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{employee.jobTitle || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleCreateUserForEmployee(employee)}
                              className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 font-semibold flex items-center gap-1"
                            >
                              <HiPlus size={16} />
                              Create User
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>ℹ️ Info:</strong> Creating a user account will automatically link it to the employee record.
                      The user will be created with role "USER" and can login with their email address.
                    </div>
                  </div>
                </div>
              )
            })()}
          </Card>
        )}
      </div>
    </div>
  )
}
