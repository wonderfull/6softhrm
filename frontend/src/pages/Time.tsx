import React from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api'

export default function Time() {
  const [items, setItems] = React.useState<any[]>([])
  const [employees, setEmployees] = React.useState<any[]>([])
  const [projects, setProjects] = React.useState<any[]>([])
  const [selectedEmployee, setSelectedEmployee] = React.useState<string>('')
  const [selectedProject, setSelectedProject] = React.useState<string>('')
  const [currentWeek, setCurrentWeek] = React.useState(new Date())
  const [showForm, setShowForm] = React.useState(false)
  const [showQuickAdd, setShowQuickAdd] = React.useState(false)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [quickAddDate, setQuickAddDate] = React.useState<Date | null>(null)
  const [quickAddEmployee, setQuickAddEmployee] = React.useState<number | null>(null)
  const [formData, setFormData] = React.useState({
    employeeId: '',
    projectId: '',
    date: '',
    hours: '8',
    notes: ''
  })

  const loadTimesheets = () => {
    apiGet('/timesheets')
      .then(setItems)
      .catch(() => setItems([]))
  }

  const loadEmployees = () => {
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]))
  }

  const loadProjects = () => {
    apiGet('/projects')
      .then(setProjects)
      .catch(() => setProjects([]))
  }

  React.useEffect(() => {
    loadTimesheets()
    loadEmployees()
    loadProjects()
  }, [])

  const getWeekDays = (date: Date) => {
    const week = []
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay()) // Start from Sunday
    
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return week
  }

  const weekDays = getWeekDays(currentWeek)
  
  const getTimesheetsForDate = (employeeId: number, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    let timesheets = items.filter(t => 
      t.employeeId === employeeId && 
      t.date.split('T')[0] === dateStr
    )
    
    // Filter by project if selected
    if (selectedProject) {
      timesheets = timesheets.filter(t => 
        t.projectId && t.projectId.toString() === selectedProject
      )
    }
    
    return timesheets
  }

  const getTotalHoursForDate = (employeeId: number, date: Date) => {
    const timesheets = getTimesheetsForDate(employeeId, date)
    return timesheets.reduce((sum, ts) => sum + ts.hours, 0)
  }

  const getTotalHours = (employeeId: number) => {
    return weekDays.reduce((total, day) => {
      return total + getTotalHoursForDate(employeeId, day)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data: any = {
        ...formData,
        employeeId: parseInt(formData.employeeId),
        hours: parseFloat(formData.hours)
      }
      if (formData.projectId) {
        data.projectId = parseInt(formData.projectId)
      }
      
      if (editingId) {
        await apiPut(`/timesheets/${editingId}`, data)
        alert('Timesheet updated successfully!')
      } else {
        await apiPost('/timesheets', data)
        alert('Timesheet added successfully!')
      }
      
      setShowForm(false)
      setEditingId(null)
      setFormData({ employeeId: '', projectId: '', date: '', hours: '8', notes: '' })
      loadTimesheets()
    } catch (err: any) {
      console.error('Error saving timesheet:', err)
      alert('Failed to save timesheet: ' + (err.message || JSON.stringify(err)))
    }
  }

  const handleQuickAdd = (employeeId: number, date: Date) => {
    setQuickAddEmployee(employeeId)
    setQuickAddDate(date)
    const existingTotal = getTotalHoursForDate(employeeId, date)
    const defaultHours = existingTotal >= 8 ? 1 : Math.max(1, 8 - existingTotal)
    const defaultProject = selectedProject || (projects.length ? projects[0].id.toString() : '')
    setFormData({
      employeeId: employeeId.toString(),
      projectId: defaultProject,
      date: date.toISOString().split('T')[0],
      hours: defaultHours.toString(),
      notes: ''
    })
    setShowQuickAdd(true)
  }

  const submitQuickAdd = async () => {
    try {
      const data: any = {
        employeeId: parseInt(formData.employeeId),
        hours: parseFloat(formData.hours),
        date: formData.date,
        notes: formData.notes
      }
      if (formData.projectId) {
        data.projectId = parseInt(formData.projectId)
      }
      
      await apiPost('/timesheets', data)
      setShowQuickAdd(false)
      setFormData({ employeeId: '', projectId: '', date: '', hours: '8', notes: '' })
      loadTimesheets()
    } catch (err: any) {
      alert('Failed: ' + err.message)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this timesheet entry?')) return
    try {
      await apiDelete(`/timesheets/${id}`)
      loadTimesheets()
    } catch (err: any) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const handleEdit = (timesheet: any) => {
    setEditingId(timesheet.id)
    setFormData({
      employeeId: timesheet.employeeId.toString(),
      projectId: timesheet.projectId ? timesheet.projectId.toString() : '',
      date: timesheet.date.split('T')[0],
      hours: timesheet.hours.toString(),
      notes: timesheet.notes || ''
    })
    setShowForm(true)
  }

  const filteredEmployees = selectedEmployee 
    ? employees.filter(e => e.id.toString() === selectedEmployee)
    : employees

  const previousWeek = () => {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() - 7)
    setCurrentWeek(d)
  }

  const nextWeek = () => {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() + 7)
    setCurrentWeek(d)
  }

  const thisWeek = () => {
    setCurrentWeek(new Date())
  }

  const formatDate = (date: Date) => {
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const day = date.getDate()
    return `${month} ${day}`
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Timesheets</h2>
        <button
          onClick={() => { setEditingId(null); setShowForm(!showForm); }}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {showQuickAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add Time Entry</h3>
            <div className="space-y-3">
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="form-input w-full"
              >
                <option value="">Select Project *</option>
                {projects.map(proj => (
                  <option key={proj.id} value={proj.id}>
                    {proj.code} - {proj.name}
                  </option>
                ))}
              </select>
              
              <input
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                type="number"
                step="0.5"
                placeholder="Hours"
                className="form-input w-full"
              />
              
              <input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes (optional)"
                className="form-input w-full"
              />
              
              <div className="flex gap-2">
                <button
                  onClick={submitQuickAdd}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Add Entry
                </button>
                <button
                  onClick={() => setShowQuickAdd(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-slate-50 dark:bg-slate-800">
          <h3 className="text-lg font-semibold mb-3">{editingId ? 'Edit Entry' : 'New Entry'}</h3>
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
            
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="form-input"
            >
              <option value="">No Project</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>
                  {proj.code} - {proj.name}
                </option>
              ))}
            </select>
            
            <input
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              type="date"
              required
              className="form-input"
            />
            
            <input
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              type="number"
              step="0.5"
              placeholder="Hours (default: 8)"
              required
              className="form-input"
            />
            
            <input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes"
              className="form-input"
            />

            <div className="col-span-2 flex gap-2">
              <button type="submit" className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                {editingId ? 'Update Entry' : 'Add Entry'}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex justify-between items-center mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded">
        <button onClick={previousWeek} className="px-3 py-1 bg-slate-300 dark:bg-slate-600 rounded hover:bg-slate-400">
          ← Previous
        </button>
        <div className="flex gap-2 items-center">
          <span className="font-semibold">
            {formatDate(weekDays[0])} - {formatDate(weekDays[6])}
          </span>
          <button onClick={thisWeek} className="btn-ghost text-sm">
            This Week
          </button>
        </div>
        <button onClick={nextWeek} className="px-3 py-1 bg-slate-300 dark:bg-slate-600 rounded hover:bg-slate-400">
          Next →
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="form-input"
        >
          <option value="">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.firstName} {emp.lastName}
            </option>
          ))}
        </select>
        
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="form-input"
        >
          <option value="">All Projects</option>
          {projects.map(proj => (
            <option key={proj.id} value={proj.id}>
              {proj.code} - {proj.name}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly Timesheet Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-200 dark:bg-slate-700">
              <th className="border p-2 text-left">Employee</th>
              {weekDays.map((day, i) => (
                <th key={i} className="border p-2 text-center min-w-[100px]">
                  <div className="text-xs">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</div>
                  <div className="text-sm font-normal">{formatDate(day)}</div>
                </th>
              ))}
              <th className="border p-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="border p-2 font-medium">
                  {emp.firstName} {emp.lastName}
                </td>
                {weekDays.map((day, i) => {
                  const timesheets = getTimesheetsForDate(emp.id, day)
                  const totalHours = getTotalHoursForDate(emp.id, day)
                  return (
                    <td 
                      key={i} 
                      className="border p-1 text-center cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900"
                      onClick={() => handleQuickAdd(emp.id, day)}
                    >
                      {timesheets.length > 0 ? (
                        <div className="space-y-1">
                          {timesheets.map((ts) => (
                            <div key={ts.id} className="group relative bg-slate-50 dark:bg-slate-700 rounded p-1">
                              <div className="font-semibold text-green-600 dark:text-green-400">{ts.hours}h</div>
                              {ts.project && <div className="text-xs text-blue-600 dark:text-blue-400">{ts.project.code}</div>}
                              {ts.notes && <div className="text-xs text-slate-500 truncate">{ts.notes}</div>}
                              <div className="absolute hidden group-hover:flex gap-1 top-0 right-0 p-1 bg-white dark:bg-slate-800 rounded shadow">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEdit(ts); }}
                                  className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(ts.id); }}
                                  className="px-2 py-1 bg-red-500 text-white text-xs rounded"
                                >
                                  Del
                                </button>
                              </div>
                            </div>
                          ))}
                          {timesheets.length > 1 && (
                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 border-t pt-1">
                              Total: {totalHours}h
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-slate-300 dark:text-slate-600 text-xs">+</div>
                      )}
                    </td>
                  )
                })}
                <td className="border p-2 text-center font-bold">
                  {getTotalHours(emp.id)}h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center text-slate-500 p-8">
          No employees found. Add employees first.
        </div>
      )}
    </div>
  )
}
