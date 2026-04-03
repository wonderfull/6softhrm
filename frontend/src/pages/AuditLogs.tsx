import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Card from '../components/Card'

interface AuditLog {
  id: number
  userId: number | null
  userEmail: string | null
  action: string
  entity: string
  entityId: number | null
  details: any
  ipAddress: string | null
  userAgent: string | null
  timestamp: string
}

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    entity: '',
    action: '',
    limit: 50,
    offset: 0
  })

  const entities = ['User', 'Employee', 'Document', 'Timesheet', 'LeaveRequest', 'Project', 'AuditLog', 'DataConsent']
  const actions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'DATA_EXPORT', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN']

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (filters.entity) params.append('entity', filters.entity)
      if (filters.action) params.append('action', filters.action)
      params.append('limit', filters.limit.toString())
      params.append('offset', filters.offset.toString())

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/gdpr/audit-logs?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setLogs(response.data.logs)
      setTotal(response.data.total)
    } catch (err: any) {
      console.error('Error fetching audit logs:', err)
      alert('Failed to fetch audit logs: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [filters])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'LOGIN_SUCCESS': 'text-green-600 bg-green-100',
      'LOGIN_FAILED': 'text-red-600 bg-red-100',
      'CREATE': 'text-blue-600 bg-blue-100',
      'READ': 'text-gray-600 bg-gray-100',
      'UPDATE': 'text-yellow-600 bg-yellow-100',
      'DELETE': 'text-red-600 bg-red-100',
      'DATA_EXPORT': 'text-purple-600 bg-purple-100',
      'CONSENT_GIVEN': 'text-green-600 bg-green-100',
      'CONSENT_WITHDRAWN': 'text-orange-600 bg-orange-100'
    }
    return colors[action] || 'text-gray-600 bg-gray-100'
  }

  const handlePrevious = () => {
    setFilters(prev => ({
      ...prev,
      offset: Math.max(0, prev.offset - prev.limit)
    }))
  }

  const handleNext = () => {
    if (filters.offset + filters.limit < total) {
      setFilters(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }))
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entity</label>
            <select
              value={filters.entity}
              onChange={(e) => setFilters(prev => ({ ...prev, entity: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="">All Entities</option>
              {entities.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value, offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="">All Actions</option>
              {actions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Per Page</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value), offset: 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          <button
            onClick={() => setFilters({ entity: '', action: '', limit: 50, offset: 0 })}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {logs.length} of {total} logs (page {Math.floor(filters.offset / filters.limit) + 1} of {Math.ceil(total / filters.limit)})
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="text-center py-8 text-gray-500">Loading audit logs...</div>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-gray-500">No audit logs found</div>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {logs.map(log => (
              <Card key={log.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{log.entity}</span>
                      {log.entityId && (
                        <span className="text-xs text-gray-500">ID: {log.entityId}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {log.userEmail || 'System'}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDate(log.timestamp)}
                      </span>
                      {log.ipAddress && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          {log.ipAddress}
                        </span>
                      )}
                    </div>

                    {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <strong className="text-gray-700">Details:</strong>
                        <pre className="mt-1 text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.userAgent && (
                      <div className="mt-2 text-xs text-gray-500 truncate" title={log.userAgent}>
                        {log.userAgent}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <div className="flex justify-between items-center">
              <button
                onClick={handlePrevious}
                disabled={filters.offset === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} of {total}
              </span>
              <button
                onClick={handleNext}
                disabled={filters.offset + filters.limit >= total}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export default AuditLogs
