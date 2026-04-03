import React from 'react'
import { Link } from 'react-router-dom'
import { apiGet, API_BASE_URL, BACKEND_BASE_URL, apiUpload, apiDelete, getCurrentUser, hasRole } from '../lib/api'

export default function Documents() {
  const [items, setItems] = React.useState<any[]>([])
  const [file, setFile] = React.useState<File | null>(null)
  const [employeeId, setEmployeeId] = React.useState('')
  const [employees, setEmployees] = React.useState<any[]>([])
  const [name, setName] = React.useState('')
  const [docType, setDocType] = React.useState('')
  const [expiryDate, setExpiryDate] = React.useState('')
  const [filter, setFilter] = React.useState('')
  const [viewFilterEmployeeId, setViewFilterEmployeeId] = React.useState('')
  const [currentEmployee, setCurrentEmployee] = React.useState<any>(null)

  // Check if user is admin
  const user = getCurrentUser()
  const isElevated = hasRole(user, 'ADMIN', 'MANAGER')

  React.useEffect(() => {
    apiGet('/documents')
      .then(setItems)
      .catch(() => setItems([]))
    apiGet('/employees')
      .then((emps) => {
        setEmployees(emps)
        // If not admin, auto-select the current employee
        if (!isElevated && user?.email) {
          const myEmployee = emps.find((e: any) => e.email === user.email)
          if (myEmployee) {
            setCurrentEmployee(myEmployee)
            setEmployeeId(String(myEmployee.id))
          }
        }
      })
      .catch(() => setEmployees([]))
  }, [isElevated, user?.email])

  const filteredDocuments = viewFilterEmployeeId
    ? items.filter(d => d.employeeId === Number(viewFilterEmployeeId))
    : items

  async function handleDownloadAll(empId: string) {
    if (!empId) return alert('No employee selected')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/documents/download-all/${empId}`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return alert(`Download failed: ${res.status} ${text}`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename=\"(.+?)\"/)
      const filename = match ? match[1] : `documents_${empId}.zip`
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Download failed: ' + (e.message || e))
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return alert('pick a file')
    if (!employeeId) return alert('select an employee')
    if (!name || !name.trim()) return alert('give the document a name')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('employeeId', employeeId)
    fd.append('name', name)
    if (docType) fd.append('type', docType)
    if (expiryDate) fd.append('expiryDate', expiryDate)

    try {
      await apiUpload('/documents/upload', fd)
      setFile(null)
      setName('')
      setDocType('')
      setExpiryDate('')
      setEmployeeId(currentEmployee ? String(currentEmployee.id) : '')
      // Refresh the documents list
      const updatedDocs = await apiGet('/documents')
      setItems(updatedDocs)
      alert('Document uploaded successfully!')
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Unknown error'}`)
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
      <h2 className="text-2xl font-semibold mb-4">{isElevated ? 'Documents' : 'My Documents'}</h2>

      <form onSubmit={upload} className="mb-6 space-y-2">
        {isElevated && employees.length === 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">No employees found — please create employees first on the <Link to="/employees" className="underline">Employees</Link> page.</div>
        )}
        
        {isElevated && (
          <>
            <div className="flex gap-2 items-center">
              <input id="employee-search" placeholder="Search employees..." value={filter} onChange={(e) => setFilter(e.target.value)} className="form-input" />
            </div>
            <label htmlFor="document-employee" className="sr-only">Employee</label>
            <select id="document-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="form-input" disabled={employees.length === 0}>
              <option value="">Select Employee *</option>
              {employees.filter(emp => `${emp.firstName} ${emp.lastName} ${emp.email} ${emp.id}`.toLowerCase().includes(filter.toLowerCase())).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.id})</option>
              ))}
            </select>
          </>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="document-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Document Name *
            </label>
            <input 
              id="document-name"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g., Employment Contract" 
              className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
              required 
            />
          </div>
          <div>
            <label htmlFor="document-type" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Document Type (Optional)
            </label>
            <select 
              id="document-type"
              value={docType} 
              onChange={(e) => setDocType(e.target.value)} 
              className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">Select type...</option>
              <option value="CONTRACT">Employment Contract</option>
              <option value="PASSPORT">Passport</option>
              <option value="VISA">Visa Document</option>
              <option value="ID">ID Document</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="document-expiry-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Expiry Date (Optional)
          </label>
          <input 
            id="document-expiry-date"
            type="date" 
            value={expiryDate} 
            onChange={(e) => setExpiryDate(e.target.value)} 
            className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
          />
        </div>
        <div>
          <label htmlFor="document-file" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            File *
          </label>
          <input 
            id="document-file"
            type="file" 
            className="form-input w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white" 
            onChange={handleFileChange} 
            disabled={!isElevated && !currentEmployee} 
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Allowed types: PDF, PNG, JPG, DOC, DOCX • Max size: 5MB</div>
        </div>
        <button className="btn-primary" disabled={!file || !employeeId || !name || (!isElevated && !currentEmployee)}>Upload Document</button>
      </form>

      {isElevated && (
        <div className="mb-4 flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="document-filter-employee" className="block text-sm font-medium mb-2">Filter by Employee:</label>
            <select
              id="document-filter-employee"
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
          {viewFilterEmployeeId && (
            <button
              onClick={() => handleDownloadAll(viewFilterEmployeeId)}
              className="btn-primary flex items-center gap-2"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              Download All as ZIP
            </button>
          )}
        </div>
      )}

      {!isElevated && currentEmployee && (
        <div className="mb-4">
          <button
            onClick={() => handleDownloadAll(String(currentEmployee.id))}
            className="btn-primary flex items-center gap-2 w-fit"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Download All My Documents as ZIP
          </button>
        </div>
      )}

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
        {filteredDocuments.map((d) => {
          // Calculate days until expiry
          let daysUntilExpiry: number | null = null
          let expiryClass = ''
          if (d.expiryDate) {
            const now = new Date()
            const expiry = new Date(d.expiryDate)
            daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysUntilExpiry < 0) {
              expiryClass = 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400'
            } else if (daysUntilExpiry < 7) {
              expiryClass = 'bg-red-50 dark:bg-red-900/20 border-red-400 text-red-600 dark:text-red-400'
            } else if (daysUntilExpiry < 30) {
              expiryClass = 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-700 dark:text-yellow-400'
            }
          }

          // Document type badge colors
          const typeColors: Record<string, string> = {
            'CONTRACT': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            'PASSPORT': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
            'VISA': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            'ID': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
            'CERTIFICATE': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
            'OTHER': 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400'
          }

          return (
            <div key={d.id} className={`p-4 border-2 rounded-lg bg-white dark:bg-slate-800 ${expiryClass || 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-bold text-lg">{d.name}</div>
                    {d.type && (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${typeColors[d.type] || typeColors['OTHER']}`}>
                        {d.type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : `Employee ID: ${d.employeeId}`}
                  </div>
                  {d.expiryDate && (
                    <div className="text-sm font-medium">
                      {daysUntilExpiry !== null && daysUntilExpiry < 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          ⚠️ EXPIRED {Math.abs(daysUntilExpiry)} days ago ({new Date(d.expiryDate).toLocaleDateString('en-GB')})
                        </span>
                      ) : daysUntilExpiry !== null && daysUntilExpiry < 7 ? (
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          ⚠️ Expires in {daysUntilExpiry} days ({new Date(d.expiryDate).toLocaleDateString('en-GB')})
                        </span>
                      ) : daysUntilExpiry !== null && daysUntilExpiry < 30 ? (
                        <span className="text-yellow-700 dark:text-yellow-400 font-semibold">
                          ⏰ Expires in {daysUntilExpiry} days ({new Date(d.expiryDate).toLocaleDateString('en-GB')})
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          Expires: {new Date(d.expiryDate).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <a 
                    className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors" 
                    href={`${BACKEND_BASE_URL}${d.path}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Open
                  </a>
                  {isElevated && (
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to delete this document?')) return
                        try {
                          await apiDelete(`/documents/${d.id}`)
                          const updatedDocs = await apiGet('/documents')
                          setItems(updatedDocs)
                          alert('Document deleted successfully!')
                        } catch (err: any) {
                          alert(`Delete error: ${err.message}`)
                        }
                      }}
                      className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
