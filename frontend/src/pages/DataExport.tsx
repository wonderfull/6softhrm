import React, { useEffect, useState } from 'react'
import Card from '../components/Card'

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
}

const DataExport: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<number | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${import.meta.env.VITE_API_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportEmployeeDataJSON = async (employeeId: number) => {
    try {
      setExporting(employeeId)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/gdpr/subject-access-request/${employeeId}`,
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
        `${import.meta.env.VITE_API_URL}/gdpr/export-employee-data/${employeeId}`,
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

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Data Export (GDPR)</h1>
      
      <Card className="mb-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Subject Access Request</h3>
              <div className="mt-2 text-sm text-blue-700">
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

      {loading ? (
        <Card>
          <div className="text-center py-8 text-gray-500">Loading employees...</div>
        </Card>
      ) : (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Export Employee Data</h2>
          <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                  <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                  <div className="text-sm text-gray-600">{emp.email}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportEmployeeDataJSON(emp.id)}
                    disabled={exporting === emp.id}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {exporting === emp.id ? 'Exporting...' : 'Export JSON'}
                  </button>
                  <button
                    onClick={() => exportEmployeeDataExcel(emp.id)}
                    disabled={exporting === emp.id}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {exporting === emp.id ? 'Exporting...' : 'Export Excel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default DataExport
