import React from 'react'
import Card from '../components/Card'
import { apiGet } from '../lib/api'

export default function Dashboard() {
  const [stats, setStats] = React.useState({
    totalEmployees: 0,
    totalProjects: 0,
    totalDocuments: 0,
    pendingLeave: 0
  })

  React.useEffect(() => {
    // Load dashboard statistics
    Promise.all([
      apiGet('/employees').catch(() => []),
      apiGet('/projects').catch(() => []),
      apiGet('/documents').catch(() => []),
      apiGet('/leave').catch(() => [])
    ]).then(([employees, projects, documents, leave]) => {
      setStats({
        totalEmployees: employees.length,
        totalProjects: projects.filter((p: any) => p.active).length,
        totalDocuments: documents.length,
        pendingLeave: leave.filter((l: any) => l.status === 'PENDING').length
      })
    })
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Employees</div>
          <div className="text-3xl font-bold">{stats.totalEmployees}</div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Active Projects</div>
          <div className="text-3xl font-bold">{stats.totalProjects}</div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Total Documents</div>
          <div className="text-3xl font-bold">{stats.totalDocuments}</div>
        </Card>
        
        <Card className="p-6">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">Pending Leave Requests</div>
          <div className="text-3xl font-bold text-yellow-500">{stats.pendingLeave}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
          <div className="space-y-2">
            <a href="/employees" className="block px-4 py-2 bg-blue-50 dark:bg-slate-800 rounded hover:bg-blue-100 dark:hover:bg-slate-700">
              Manage Employees
            </a>
            <a href="/time" className="block px-4 py-2 bg-blue-50 dark:bg-slate-800 rounded hover:bg-blue-100 dark:hover:bg-slate-700">
              Timesheets
            </a>
            <a href="/leave" className="block px-4 py-2 bg-blue-50 dark:bg-slate-800 rounded hover:bg-blue-100 dark:hover:bg-slate-700">
              Leave Requests
            </a>
            <a href="/documents" className="block px-4 py-2 bg-blue-50 dark:bg-slate-800 rounded hover:bg-blue-100 dark:hover:bg-slate-700">
              Documents
            </a>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">System Info</h3>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div>Version: 1.0.0</div>
            <div>Last Login: {new Date().toLocaleString()}</div>
            <div>User: {JSON.parse(localStorage.getItem('user') || '{}').email || 'N/A'}</div>
          </div>
        </Card>
      </div>
    </div>
  )
}
