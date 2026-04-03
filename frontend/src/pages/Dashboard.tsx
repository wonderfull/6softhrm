import React from 'react'
import Card from '../components/Card'
import { apiGet } from '../lib/api'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = React.useState({
    totalEmployees: 0,
    totalProjects: 0,
    totalDocuments: 0,
    pendingLeave: 0
  })
  const [expiringDocs, setExpiringDocs] = React.useState<any[]>([])
  const [expiringSponsorships, setExpiringSponsorships] = React.useState<any[]>([])

  const token = localStorage.getItem('token')
  const user = token ? JSON.parse(atob(token.split('.')[1])) : null
  const isAdmin = user?.role === 'ADMIN'

  React.useEffect(() => {
    // Load dashboard statistics
    Promise.all([
      apiGet('/employees').catch(() => []),
      apiGet('/projects').catch(() => []),
      apiGet('/documents').catch(() => []),
      apiGet('/leave').catch(() => []),
      apiGet('/documents/expiring').catch(() => []),
      apiGet('/sponsorships/expiring').catch(() => [])
    ]).then(([employees, projects, documents, leave, expiringDocs, expiringSponsorships]) => {
      setStats({
        totalEmployees: employees.length,
        totalProjects: projects.filter((p: any) => p.active).length,
        totalDocuments: documents.length,
        pendingLeave: leave.filter((l: any) => l.status === 'PENDING').length
      })
      setExpiringDocs(expiringDocs)
      setExpiringSponsorships(expiringSponsorships)
    })
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Welcome to 6Soft HRM
        </h1>
        <p className="text-slate-600 dark:text-slate-300">Your complete HR management solution</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-100 text-sm mb-1">Total Employees</div>
              <div className="text-4xl font-bold">{stats.totalEmployees}</div>
            </div>
            <div className="text-5xl opacity-20">👥</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-purple-100 text-sm mb-1">Active Projects</div>
              <div className="text-4xl font-bold">{stats.totalProjects}</div>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-100 text-sm mb-1">Documents</div>
              <div className="text-4xl font-bold">{stats.totalDocuments}</div>
            </div>
            <div className="text-5xl opacity-20">📁</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-orange-100 text-sm mb-1">Pending Leave</div>
              <div className="text-4xl font-bold">{stats.pendingLeave}</div>
            </div>
            <div className="text-5xl opacity-20">📅</div>
          </div>
        </div>
      </div>

      {/* Critical Alerts Section */}
      {expiringDocs.length > 0 && (
        <Card className="p-6 mb-8 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-700">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚠️</div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2 text-red-900 dark:text-red-100">
                🚨 Critical Alerts - Document Expiry
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-4">
                {expiringDocs.length} document{expiringDocs.length !== 1 ? 's' : ''} require immediate attention (expiring within 30 days)
              </p>
              
              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-600 dark:bg-red-700 rounded-lg p-3 text-white text-center">
                  <div className="text-2xl font-bold">
                    {expiringDocs.filter((d: any) => {
                      const days = Math.ceil((new Date(d.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      return days < 0
                    }).length}
                  </div>
                  <div className="text-xs uppercase">Expired</div>
                </div>
                <div className="bg-orange-600 dark:bg-orange-700 rounded-lg p-3 text-white text-center">
                  <div className="text-2xl font-bold">
                    {expiringDocs.filter((d: any) => {
                      const days = Math.ceil((new Date(d.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      return days >= 0 && days < 7
                    }).length}
                  </div>
                  <div className="text-xs uppercase">{"< 7 Days"}</div>
                </div>
                <div className="bg-yellow-600 dark:bg-yellow-700 rounded-lg p-3 text-white text-center">
                  <div className="text-2xl font-bold">
                    {expiringDocs.filter((d: any) => {
                      const days = Math.ceil((new Date(d.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      return days >= 7 && days < 30
                    }).length}
                  </div>
                  <div className="text-xs uppercase">{"< 30 Days"}</div>
                </div>
              </div>

              {/* Detailed Document List */}
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Document Name</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-left">Expiry Date</th>
                        <th className="px-4 py-3 text-left">Days Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {expiringDocs.map((doc: any) => {
                        const now = new Date()
                        const expiry = new Date(doc.expiryDate)
                        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        
                        let statusIcon, statusText, statusColor, rowBgClass
                        if (daysUntilExpiry < 0) {
                          statusIcon = '⛔'
                          statusText = 'EXPIRED'
                          statusColor = 'text-red-700 dark:text-red-400 font-bold'
                          rowBgClass = 'bg-red-50 dark:bg-red-900/20'
                        } else if (daysUntilExpiry === 0) {
                          statusIcon = '🔴'
                          statusText = 'TODAY'
                          statusColor = 'text-red-600 dark:text-red-400 font-bold'
                          rowBgClass = 'bg-red-50 dark:bg-red-900/20'
                        } else if (daysUntilExpiry < 7) {
                          statusIcon = '🔴'
                          statusText = 'URGENT'
                          statusColor = 'text-red-600 dark:text-red-400 font-semibold'
                          rowBgClass = 'bg-red-50 dark:bg-red-900/10'
                        } else if (daysUntilExpiry < 30) {
                          statusIcon = '🟡'
                          statusText = 'WARNING'
                          statusColor = 'text-yellow-700 dark:text-yellow-400 font-semibold'
                          rowBgClass = 'bg-yellow-50 dark:bg-yellow-900/10'
                        }
                        
                        return (
                          <tr key={doc.id} className={`${rowBgClass} hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}>
                            <td className="px-4 py-3">
                              <div className={`flex items-center gap-1 ${statusColor}`}>
                                <span>{statusIcon}</span>
                                <span className="text-xs">{statusText}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              {doc.name}
                            </td>
                            <td className="px-4 py-3">
                              {doc.type ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {doc.type}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              {doc.employee.firstName} {doc.employee.lastName}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono">
                              {expiry.toLocaleDateString('en-GB')}
                            </td>
                            <td className={`px-4 py-3 font-semibold ${statusColor}`}>
                              {daysUntilExpiry < 0 ? (
                                <span>{Math.abs(daysUntilExpiry)} days ago</span>
                              ) : daysUntilExpiry === 0 ? (
                                <span>Expires today!</span>
                              ) : (
                                <span>{daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <Link 
                  to="/documents" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  Manage All Documents
                </Link>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Last updated: {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Sponsorship Expiry Alerts Section */}
      {expiringSponsorships.length > 0 && (
        <Card className="p-6 mb-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-300 dark:border-purple-700">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🛂</div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2 text-purple-900 dark:text-purple-100">
                🚨 Critical Alerts - Sponsorship Expiry
              </h3>
              <p className="text-purple-700 dark:text-purple-300 mb-4">
                {expiringSponsorships.length} sponsorship{expiringSponsorships.length !== 1 ? 's' : ''} require immediate attention (expiring within 30 days)
              </p>
              
              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-red-600 dark:bg-red-700 rounded-lg p-3 text-white text-center">
                  <div className="text-2xl font-bold">
                    {expiringSponsorships.filter((s: any) => {
                      const days = Math.ceil((new Date(s.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      return days < 0
                    }).length}
                  </div>
                  <div className="text-xs uppercase">Expired</div>
                </div>
                <div className="bg-orange-600 dark:bg-orange-700 rounded-lg p-3 text-white text-center">
                  <div className="text-2xl font-bold">
                    {expiringSponsorships.filter((s: any) => {
                      const days = Math.ceil((new Date(s.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      return days >= 0 && days < 7
                    }).length}
                  </div>
                  <div className="text-xs uppercase">{"< 7 Days"}</div>
                </div>
                <div className="bg-yellow-600 dark:bg-yellow-700 rounded-lg p-3 text-white text-center">
                  <div className="text-2xl font-bold">
                    {expiringSponsorships.filter((s: any) => {
                      const days = Math.ceil((new Date(s.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      return days >= 7 && days < 30
                    }).length}
                  </div>
                  <div className="text-xs uppercase">{"< 30 Days"}</div>
                </div>
              </div>

              {/* Detailed Sponsorship List */}
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-left">Visa Type</th>
                        <th className="px-4 py-3 text-left">CAS Number</th>
                        <th className="px-4 py-3 text-left">Start Date</th>
                        <th className="px-4 py-3 text-left">Expiry Date</th>
                        <th className="px-4 py-3 text-left">Days Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {expiringSponsorships.map((sponsorship: any) => {
                        const now = new Date()
                        const expiry = new Date(sponsorship.endDate)
                        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                        
                        let statusIcon, statusText, statusColor, rowBgClass
                        if (daysUntilExpiry < 0) {
                          statusIcon = '⛔'
                          statusText = 'EXPIRED'
                          statusColor = 'text-red-700 dark:text-red-400 font-bold'
                          rowBgClass = 'bg-red-50 dark:bg-red-900/20'
                        } else if (daysUntilExpiry === 0) {
                          statusIcon = '🔴'
                          statusText = 'TODAY'
                          statusColor = 'text-red-600 dark:text-red-400 font-bold'
                          rowBgClass = 'bg-red-50 dark:bg-red-900/20'
                        } else if (daysUntilExpiry < 7) {
                          statusIcon = '🔴'
                          statusText = 'URGENT'
                          statusColor = 'text-red-600 dark:text-red-400 font-semibold'
                          rowBgClass = 'bg-red-50 dark:bg-red-900/10'
                        } else if (daysUntilExpiry < 30) {
                          statusIcon = '🟡'
                          statusText = 'WARNING'
                          statusColor = 'text-yellow-700 dark:text-yellow-400 font-semibold'
                          rowBgClass = 'bg-yellow-50 dark:bg-yellow-900/10'
                        }
                        
                        return (
                          <tr key={sponsorship.id} className={`${rowBgClass} hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}>
                            <td className="px-4 py-3">
                              <div className={`flex items-center gap-1 ${statusColor}`}>
                                <span>{statusIcon}</span>
                                <span className="text-xs">{statusText}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              {sponsorship.employee.firstName} {sponsorship.employee.lastName}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-200 dark:bg-purple-700 text-purple-800 dark:text-purple-200">
                                {sponsorship.visaType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">
                              {sponsorship.casNumber || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">
                              {new Date(sponsorship.startDate).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono">
                              {expiry.toLocaleDateString('en-GB')}
                            </td>
                            <td className={`px-4 py-3 font-semibold ${statusColor}`}>
                              {daysUntilExpiry < 0 ? (
                                <span>{Math.abs(daysUntilExpiry)} days ago</span>
                              ) : daysUntilExpiry === 0 ? (
                                <span>Expires today!</span>
                              ) : (
                                <span>{daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <Link 
                  to="/sponsorships" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  Manage All Sponsorships
                </Link>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Last updated: {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Quick Access */}
      <Card className="p-6">
        <h3 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">Quick Access</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isAdmin ? (
            <>
              <Link to="/employees" className="group block p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg hover:shadow-md transition-all border border-blue-200 dark:border-blue-800">
                <div className="text-3xl mb-2">👥</div>
                <div className="font-bold text-blue-900 dark:text-blue-100 group-hover:text-blue-600 dark:group-hover:text-blue-300">Employees</div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">Manage employee records</div>
              </Link>
              <Link to="/projects" className="group block p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg hover:shadow-md transition-all border border-purple-200 dark:border-purple-800">
                <div className="text-3xl mb-2">📊</div>
                <div className="font-bold text-purple-900 dark:text-purple-100 group-hover:text-purple-600 dark:group-hover:text-purple-300">Projects</div>
                <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">View and manage projects</div>
              </Link>
              <Link to="/documents" className="group block p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg hover:shadow-md transition-all border border-green-200 dark:border-green-800">
                <div className="text-3xl mb-2">📁</div>
                <div className="font-bold text-green-900 dark:text-green-100 group-hover:text-green-600 dark:group-hover:text-green-300">Documents</div>
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">Access documents</div>
              </Link>
              <Link to="/leave" className="group block p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg hover:shadow-md transition-all border border-orange-200 dark:border-orange-800">
                <div className="text-3xl mb-2">📅</div>
                <div className="font-bold text-orange-900 dark:text-orange-100 group-hover:text-orange-600 dark:group-hover:text-orange-300">Leave Requests</div>
                <div className="text-sm text-orange-700 dark:text-orange-300 mt-1">Manage leave requests</div>
              </Link>
            </>
          ) : (
            <>
              <Link to="/employees" className="group block p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg hover:shadow-md transition-all border border-blue-200 dark:border-blue-800">
                <div className="text-3xl mb-2">👤</div>
                <div className="font-bold text-blue-900 dark:text-blue-100 group-hover:text-blue-600 dark:group-hover:text-blue-300">My Profile</div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">View and update your info</div>
              </Link>
              <Link to="/timesheets" className="group block p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg hover:shadow-md transition-all border border-purple-200 dark:border-purple-800">
                <div className="text-3xl mb-2">⏰</div>
                <div className="font-bold text-purple-900 dark:text-purple-100 group-hover:text-purple-600 dark:group-hover:text-purple-300">Timesheet</div>
                <div className="text-sm text-purple-700 dark:text-purple-300 mt-1">Track your work hours</div>
              </Link>
              <Link to="/documents" className="group block p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg hover:shadow-md transition-all border border-green-200 dark:border-green-800">
                <div className="text-3xl mb-2">📁</div>
                <div className="font-bold text-green-900 dark:text-green-100 group-hover:text-green-600 dark:group-hover:text-green-300">My Documents</div>
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">Access your documents</div>
              </Link>
              <Link to="/leave" className="group block p-6 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg hover:shadow-md transition-all border border-orange-200 dark:border-orange-800">
                <div className="text-3xl mb-2">📅</div>
                <div className="font-bold text-orange-900 dark:text-orange-100 group-hover:text-orange-600 dark:group-hover:text-orange-300">Leave Requests</div>
                <div className="text-sm text-orange-700 dark:text-orange-300 mt-1">Request time off</div>
              </Link>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
