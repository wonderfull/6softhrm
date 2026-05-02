import React from 'react'
import { Link } from 'react-router-dom'
import {
  apiGet,
  API_BASE_URL,
  apiUpload,
  apiDelete,
  apiPost,
  getCurrentUser,
  hasRole,
} from '../lib/api'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

function getFileValidationError(file: File) {
  if (file.size > MAX_SIZE) return 'File is too large (max 5MB)'
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Unsupported file type. Allowed: PDF, PNG, JPG, DOC, DOCX'
  }
  return null
}

function buildSharedUrl(shareToken?: string | null) {
  if (!shareToken || typeof window === 'undefined') return ''
  const base = API_BASE_URL.startsWith('http') ? API_BASE_URL : `${window.location.origin}${API_BASE_URL}`
  return `${base}/documents/share/${shareToken}`
}

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
  const [payslipFiles, setPayslipFiles] = React.useState<File[]>([])
  const [payslipDragActive, setPayslipDragActive] = React.useState(false)
  const [payslipResults, setPayslipResults] = React.useState<any[]>([])
  const [openDocumentId, setOpenDocumentId] = React.useState<number | null>(null)
  const [shareDocumentId, setShareDocumentId] = React.useState<number | null>(null)
  const [uploadingPayslips, setUploadingPayslips] = React.useState(false)

  const user = getCurrentUser()
  const isElevated = hasRole(user, 'ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT')
  const canManageDocumentLinks = hasRole(user, 'ADMIN', 'DIRECTOR')

  async function loadDocuments() {
    try {
      setItems(await apiGet('/documents'))
    } catch {
      setItems([])
    }
  }

  React.useEffect(() => {
    loadDocuments()
    apiGet('/employees')
      .then((emps) => {
        setEmployees(emps)
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
    ? items.filter((d) => d.employeeId === Number(viewFilterEmployeeId))
    : items

  async function handleDownloadAll(empId: string) {
    if (!empId) return alert('No employee selected')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/documents/download-all/${empId}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
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

  async function handleOpenDocument(documentId: number, documentName: string) {
    try {
      setOpenDocumentId(documentId)
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/documents/${documentId}/file`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return alert(`Open failed: ${res.status} ${text}`)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        const a = document.createElement('a')
        a.href = url
        a.download = documentName
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (e: any) {
      alert('Open failed: ' + (e.message || e))
    } finally {
      setOpenDocumentId(null)
    }
  }

  async function handleCreateShareLink(documentId: number, existingShareToken?: string | null) {
    try {
      setShareDocumentId(documentId)
      const shareUrl = existingShareToken
        ? buildSharedUrl(existingShareToken)
        : (await apiPost(`/documents/${documentId}/share-link`)).shareUrl

      if (!shareUrl) {
        alert('Failed to generate share link')
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      }

      await loadDocuments()
      alert(`Share link ready${navigator.clipboard?.writeText ? ' and copied to clipboard' : ''}:\n${shareUrl}`)
    } catch (e: any) {
      alert(`Share link failed: ${e.message || e}`)
    } finally {
      setShareDocumentId(null)
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
      await loadDocuments()
      alert('Document uploaded successfully!')
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Unknown error'}`)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files ? e.target.files[0] : null
    if (!selectedFile) {
      setFile(null)
      return
    }

    const error = getFileValidationError(selectedFile)
    if (error) {
      alert(error)
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  function setValidatedPayslipFiles(candidateFiles: File[]) {
    const invalid = candidateFiles.find(getFileValidationError)
    if (invalid) {
      alert(getFileValidationError(invalid))
      return
    }
    setPayslipFiles(candidateFiles)
  }

  async function uploadPayslips() {
    if (!employeeId) return alert('Select an employee first')
    if (payslipFiles.length === 0) return alert('Drop at least one payslip file')

    try {
      setUploadingPayslips(true)
      const fd = new FormData()
      fd.append('employeeId', employeeId)
      payslipFiles.forEach((payslipFile) => fd.append('files', payslipFile))

      const response = await apiUpload('/documents/upload-payslips', fd)
      setPayslipResults(response.documents || [])
      setPayslipFiles([])
      await loadDocuments()
      alert(`Uploaded ${response.uploadedCount || 0} payslip(s)`)
    } catch (e: any) {
      alert(`Payslip upload failed: ${e.message || e}`)
    } finally {
      setUploadingPayslips(false)
    }
  }

  const employeeSelectOptions = employees
    .filter((emp) => `${emp.firstName} ${emp.lastName} ${emp.email} ${emp.id}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">{isElevated ? 'Documents' : 'My Documents'}</h2>

      {isElevated && (
        <section className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold">Payslip Drop Zone</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Select an employee, drag in one or more payslips, and the system stores them in that employee&apos;s documents with share links ready to copy.
              </p>
            </div>
          </div>

          {employees.length === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
              No employees found. Create employees first on the <Link to="/employees" className="underline">Employees</Link> page.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[1fr_1fr] mb-4">
            <div>
              <label htmlFor="payslip-employee-search" className="block text-sm font-medium mb-1">Search employees</label>
              <input
                id="payslip-employee-search"
                placeholder="Search employees..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="form-input w-full"
              />
            </div>
            <div>
              <label htmlFor="document-employee" className="block text-sm font-medium mb-1">Employee</label>
              <select
                id="document-employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="form-input w-full"
                disabled={employees.length === 0}
              >
                <option value="">Select Employee *</option>
                {employeeSelectOptions.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setPayslipDragActive(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setPayslipDragActive(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setPayslipDragActive(false)
              setValidatedPayslipFiles(Array.from(e.dataTransfer.files))
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              payslipDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40'
            }`}
          >
            <p className="font-medium mb-2">Drag and drop payslips here</p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">PDF, PNG, JPG, DOC, DOCX up to 5MB each</p>
            <label htmlFor="payslip-files" className="btn-primary cursor-pointer inline-flex">
              Select Payslips
            </label>
            <input
              id="payslip-files"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setValidatedPayslipFiles(Array.from(e.target.files || []))}
            />
          </div>

          {payslipFiles.length > 0 && (
            <div className="mt-4 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4">
              <div className="font-medium mb-2">Ready to upload</div>
              <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                {payslipFiles.map((payslipFile) => (
                  <div key={`${payslipFile.name}-${payslipFile.size}`}>{payslipFile.name}</div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={uploadPayslips}
                  disabled={!employeeId || uploadingPayslips}
                >
                  {uploadingPayslips ? 'Uploading...' : `Upload ${payslipFiles.length} Payslip${payslipFiles.length > 1 ? 's' : ''}`}
                </button>
                <button type="button" className="px-4 py-2 rounded bg-slate-200 dark:bg-slate-700" onClick={() => setPayslipFiles([])}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {payslipResults.length > 0 && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-4">
              <div className="font-medium text-green-800 dark:text-green-300 mb-2">Share links created</div>
              <div className="space-y-2">
                {payslipResults.map((result) => (
                  <div key={result.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded bg-white dark:bg-slate-900/40 p-3">
                    <div className="text-sm">
                      <div className="font-medium">{result.name}</div>
                      <div className="text-slate-600 dark:text-slate-400 break-all">{result.shareUrl}</div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={async () => {
                        if (navigator.clipboard?.writeText && result.shareUrl) {
                          await navigator.clipboard.writeText(result.shareUrl)
                          alert(`Copied share link for ${result.name}`)
                        }
                      }}
                    >
                      Copy Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <form onSubmit={upload} className="mb-6 space-y-3">
        {!isElevated && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Your self-service password reset is available from the <Link to="/login" className="underline">login page</Link> via the &quot;Forgot your password?&quot; link.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <option value="PAYSLIP">Payslip</option>
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

        <button className="btn-primary" disabled={!file || !employeeId || !name || (!isElevated && !currentEmployee)}>
          Upload Document
        </button>
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
              {employees.map((emp) => (
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

          const typeColors: Record<string, string> = {
            CONTRACT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            PASSPORT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
            VISA: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            ID: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
            CERTIFICATE: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
            PAYSLIP: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
            OTHER: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400'
          }

          const shareUrl = buildSharedUrl(d.shareToken)

          return (
            <div key={d.id} className={`p-4 border-2 rounded-lg bg-white dark:bg-slate-800 ${expiryClass || 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-bold text-lg">{d.name}</div>
                    {d.type && (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${typeColors[d.type] || typeColors.OTHER}`}>
                        {d.type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : `Employee ID: ${d.employeeId}`}
                  </div>
                  {d.shareToken && (
                    <div className="mb-2 text-xs text-slate-500 dark:text-slate-400 break-all">
                      Share link ready: {shareUrl}
                    </div>
                  )}
                  {d.expiryDate && (
                    <div className="text-sm font-medium">
                      {daysUntilExpiry !== null && daysUntilExpiry < 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          EXPIRED {Math.abs(daysUntilExpiry)} days ago ({new Date(d.expiryDate).toLocaleDateString('en-GB')})
                        </span>
                      ) : daysUntilExpiry !== null && daysUntilExpiry < 7 ? (
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          Expires in {daysUntilExpiry} days ({new Date(d.expiryDate).toLocaleDateString('en-GB')})
                        </span>
                      ) : daysUntilExpiry !== null && daysUntilExpiry < 30 ? (
                        <span className="text-yellow-700 dark:text-yellow-400 font-semibold">
                          Expires in {daysUntilExpiry} days ({new Date(d.expiryDate).toLocaleDateString('en-GB')})
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">
                          Expires: {new Date(d.expiryDate).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    onClick={() => handleOpenDocument(d.id, d.name)}
                    disabled={openDocumentId === d.id}
                  >
                    {openDocumentId === d.id ? 'Opening...' : 'Open'}
                  </button>
                  {canManageDocumentLinks && (
                    <button
                      type="button"
                      className="text-sm px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                      onClick={() => handleCreateShareLink(d.id, d.shareToken)}
                      disabled={shareDocumentId === d.id}
                    >
                      {shareDocumentId === d.id ? 'Preparing...' : d.shareToken ? 'Copy Share Link' : 'Create Share Link'}
                    </button>
                  )}
                  {canManageDocumentLinks && (
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to delete this document?')) return
                        try {
                          await apiDelete(`/documents/${d.id}`)
                          await loadDocuments()
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
