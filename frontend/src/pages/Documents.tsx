import React from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../lib/api'

export default function Documents() {
  const [items, setItems] = React.useState<any[]>([])
  const [file, setFile] = React.useState<File | null>(null)
  const [employeeId, setEmployeeId] = React.useState('')
  const [employees, setEmployees] = React.useState<any[]>([])
  const [name, setName] = React.useState('')
  const [filter, setFilter] = React.useState('')
  const [viewFilterEmployeeId, setViewFilterEmployeeId] = React.useState('')

  React.useEffect(() => {
    apiGet('/documents')
      .then(setItems)
      .catch(() => setItems([]))
    apiGet('/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]))
  }, [])

  const filteredDocuments = viewFilterEmployeeId
    ? items.filter(d => d.employeeId === Number(viewFilterEmployeeId))
    : items

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return alert('pick a file')
    if (!employeeId) return alert('select an employee')
    if (!name || !name.trim()) return alert('give the document a name')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('employeeId', employeeId)
    fd.append('name', name)

    const token = localStorage.getItem('token')
    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        return alert(`Upload failed: ${errorData.error || res.statusText}`)
      }
      const d = await res.json()
      setFile(null)
      setName('')
      setEmployeeId('')
      // Refresh the documents list
      const updatedDocs = await apiGet('/documents')
      setItems(updatedDocs)
      alert('Document uploaded successfully!')
    } catch (err: any) {
      alert(`Upload error: ${err.message}`)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files ? e.target.files[0] : null
    if (!f) { setFile(null); return }
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    if (f.size > maxSize) { alert('File is too large (max 5MB)'); setFile(null); return }
    if (!allowed.includes(f.type)) { alert('Unsupported file type. Allowed: PDF, PNG, JPG, DOC, DOCX'); setFile(null); return }
    setFile(f)
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Documents</h2>

      <form onSubmit={upload} className="mb-6 space-y-2">
        {employees.length === 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">No employees found — please create employees first on the <Link to="/employees" className="underline">Employees</Link> page.</div>
        )}
        <div className="flex gap-2 items-center">
          <input placeholder="Search employees..." value={filter} onChange={(e) => setFilter(e.target.value)} className="form-input" />
        </div>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="form-input" disabled={employees.length === 0}>
          <option value="">Select Employee *</option>
          {employees.filter(emp => `${emp.firstName} ${emp.lastName} ${emp.email} ${emp.id}`.toLowerCase().includes(filter.toLowerCase())).map(emp => (
            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.id})</option>
          ))}
        </select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name" className="form-input" required />
        <input type="file" className="form-input" onChange={handleFileChange} disabled={employees.length === 0} />
        <div className="text-xs text-slate-500 dark:text-slate-400">Allowed types: PDF, PNG, JPG, DOC, DOCX • Max size: 5MB</div>
        <button className="btn-primary" disabled={!file || !employeeId || !name || employees.length === 0}>Upload</button>
      </form>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Filter by Employee:</label>
        <select
          value={viewFilterEmployeeId}
          onChange={(e) => setViewFilterEmployeeId(e.target.value)}
          className="form-input"
        >
          <option value="">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filteredDocuments.length === 0 && items.length > 0 && (
          <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded text-center text-slate-600 dark:text-slate-300">
            No documents found for this employee
          </div>
        )}
        {filteredDocuments.length === 0 && items.length === 0 && (
          <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded text-center text-slate-600 dark:text-slate-300">
            No documents uploaded yet
          </div>
        )}
        {filteredDocuments.map((d) => (
          <div key={d.id} className="p-3 border rounded bg-white dark:bg-slate-800">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold">{d.name}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : `Employee ID: ${d.employeeId}`}</div>
              </div>
              <a className="text-sm underline truncate ml-4" href={`http://localhost:4000${d.path}`} target="_blank" rel="noopener noreferrer">Open</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
