import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { API_BASE_URL, apiGet } from '../lib/api'
import { PageHeader } from '../components/ui';

interface Employee {
 id: number
 firstName: string
 lastName: string
 email: string
}

const DataExport: React.FC = () => {
 const [employees, setEmployees] = useState<Employee[]>([])
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState<string | null>(null)
 const [exporting, setExporting] = useState<number | null>(null)
 const [exportingAll, setExportingAll] = useState(false)

 useEffect(() => {
 fetchEmployees()
  }, [])

 const fetchEmployees = async () => {
 try {
 setError(null)
 const data = await apiGet('/employees')
 setEmployees(getArrayPayload<Employee>(data))
    } catch (error: any) {
 console.error('Error fetching employees:', error)
 setEmployees([])
 setError(error.message || 'Failed to load employees')
    } finally {
 setLoading(false)
    }
  }

 const exportEmployeeDataJSON = async (employeeId: number) => {
 try {
 setExporting(employeeId)
 const token = localStorage.getItem('token')
 const response = await fetch(
 `${API_BASE_URL}/gdpr/subject-access-request/${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
 if (!response.ok) {
 const error = await response.json()
 throw new Error(error.error || 'Export failed')
      }

 const data = await response.json()
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `employee-${employeeId}-data-${new Date().toISOString().split('T')[0]}.json`
 document.body.appendChild(a)
 a.click()
 document.body.removeChild(a)
 URL.revokeObjectURL(url)
    } catch (error: any) {
 alert('Export failed: ' + error.message)
    } finally {
 setExporting(null)
    }
  }

 const exportEmployeeDataExcel = async (employeeId: number) => {
 try {
 setExporting(employeeId)
 const token = localStorage.getItem('token')
 const response = await fetch(
 `${API_BASE_URL}/gdpr/export-employee-data/${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
 if (!response.ok) {
 const error = await response.json()
 throw new Error(error.error || 'Export failed')
      }

 const blob = await response.blob()
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `employee-${employeeId}-data-${new Date().toISOString().split('T')[0]}.xlsx`
 document.body.appendChild(a)
 a.click()
 document.body.removeChild(a)
 URL.revokeObjectURL(url)
    } catch (error: any) {
 alert('Export failed: ' + error.message)
    } finally {
 setExporting(null)
    }
  }

 const exportAllData = async () => {
 try {
 setExportingAll(true)
 const token = localStorage.getItem('token')
 const response = await fetch(`${API_BASE_URL}/gdpr/export-all`, {
 headers: { Authorization: `Bearer ${token}` },
      })

 if (!response.ok) {
 const error = await response.json().catch(() => ({}))
 throw new Error(error.error || 'Export failed')
      }

 const blob = await response.blob()
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `onsidehr-full-backup-${new Date().toISOString().split('T')[0]}.zip`
 document.body.appendChild(a)
 a.click()
 document.body.removeChild(a)
 URL.revokeObjectURL(url)
    } catch (error: any) {
 alert('Export all failed: ' + error.message)
    } finally {
 setExportingAll(false)
    }
  }

 return (
    <div className="p-6">
      <PageHeader className="mb-6" title="Data export" subline="Answer a subject access request with a full copy of one employee record." />
      
      <Card className="mb-6">
        <div className="bg-surface-2 border border-line p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-ink-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-ink-2">Subject access request</h3>
              <div className="mt-2 text-sm text-ink-2">
                <p>Under UK GDPR, employees have the right to access their personal data. Use this page to export all data for an employee including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Personal information (name, email, phone, etc.)</li>
                  <li>Employment details (job title, department, dates)</li>
                  <li>Financial information (bank details, NI number)</li>
                  <li>Timesheets and project assignments</li>
                  <li>Leave requests and approvals</li>
                  <li>Documents uploaded</li>
                  <li>Audit logs (data access history)</li>
                  <li>Consent records</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Export All Data</h2>
            <p className="mt-1 text-sm text-ink-2">
 Downloads one ZIP with the database backup, document manifest, and uploaded document files.
            </p>
          </div>
          <button
 type="button"
 onClick={exportAllData}
 disabled={exportingAll}
 className="rounded-md bg-accent px-4 py-2 font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2"
          >
            {exportingAll ? 'Exporting...' : 'Export All Data'}
          </button>
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="text-center py-8 text-ink-3">Loading employees...</div>
        </Card>
      ) : (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Export Employee Data</h2>
          {error ? (
            <div className="rounded-lg border border-bad bg-bad-tint p-4 text-sm text-bad">
 Failed to load employees: {error}
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface-2 p-6 text-center text-sm text-ink-2">
 No employee records are available to export.
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map(emp => (
                <div key={emp.id} className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                    <div className="text-sm text-ink-2">{emp.email}</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
 onClick={() => exportEmployeeDataJSON(emp.id)}
 disabled={exporting === emp.id}
 className="rounded-md bg-accent px-4 py-2 text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:bg-surface-2"
                    >
                      {exporting === emp.id ? 'Exporting...' : 'Export JSON'}
                    </button>
                    <button
 onClick={() => exportEmployeeDataExcel(emp.id)}
 disabled={exporting === emp.id}
 className="rounded-md bg-accent px-4 py-2 text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:bg-surface-2"
                    >
                      {exporting === emp.id ? 'Exporting...' : 'Export Excel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function getArrayPayload<T>(payload: T[] | { data?: T[] } | unknown): T[] {
 if (Array.isArray(payload)) return payload
 if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as { data?: T[] }).data)) {
 return (payload as { data: T[] }).data
  }
 return []
}

export default DataExport
