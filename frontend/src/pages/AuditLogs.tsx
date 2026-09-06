import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { API_BASE_URL, apiGet } from '../lib/api'
import { PageHeader } from '../components/ui';

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
 const [error, setError] = useState('')
 const [exporting, setExporting] = useState(false)
 const [filters, setFilters] = useState({
 entity: '',
 action: '',
 from: '',
 to: '',
 limit: 50,
 offset: 0
  })

 const activeFilterQuery = () => ({
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  })

 const entities = ['User', 'Employee', 'Document', 'Timesheet', 'LeaveRequest', 'Project', 'AuditLog', 'DataConsent']
 const actions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'UPLOAD', 'EXPORT', 'DATA_EXPORT', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN']

 const fetchLogs = async () => {
 try {
 setLoading(true)
 setError('')
 const response = await apiGet('/gdpr/audit-logs', {
        ...activeFilterQuery(),
 limit: filters.limit,
 offset: filters.offset,
      })
 setLogs(Array.isArray(response?.logs) ? response.logs : [])
 setTotal(typeof response?.total === 'number' ? response.total : 0)
    } catch (err: any) {
 console.error('Error fetching audit logs:', err)
 setLogs([])
 setTotal(0)
 setError(err.message || 'Failed to fetch audit logs')
    } finally {
 setLoading(false)
    }
  }

 useEffect(() => {
 fetchLogs()
  }, [filters])

 const exportLogs = async () => {
 try {
 setExporting(true)
 setError('')
 const token = localStorage.getItem('token')
 const query = new URLSearchParams(activeFilterQuery()).toString()
 const response = await fetch(
 `${API_BASE_URL}/gdpr/audit-logs/export${query ? `?${query}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
 if (!response.ok) {
 const body = await response.json().catch(() => ({}))
 throw new Error(body.error || 'Export failed')
      }
 const blob = await response.blob()
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `audit-log-${new Date().toISOString().split('T')[0]}.xlsx`
 document.body.appendChild(a)
 a.click()
 document.body.removeChild(a)
 URL.revokeObjectURL(url)
    } catch (err: any) {
 setError(err.message || 'Export failed')
    } finally {
 setExporting(false)
    }
  }

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
 'LOGIN_SUCCESS': 'text-ok bg-ok-tint',
 'LOGIN_FAILED': 'text-bad bg-bad-tint',
 'CREATE': 'text-ink-2 bg-surface-2',
 'READ': 'text-ink-2 bg-surface-2',
 'UPDATE': 'text-warn bg-warn-tint',
 'DELETE': 'text-bad bg-bad-tint',
 'APPROVE': 'text-ok bg-ok-tint',
 'REJECT': 'text-warn bg-warn-tint',
 'UPLOAD': 'text-ink-2 bg-surface-2',
 'EXPORT': 'text-ink-2 bg-surface-2',
 'DATA_EXPORT': 'text-ink-2 bg-surface-2',
 'CONSENT_GIVEN': 'text-ok bg-ok-tint',
 'CONSENT_WITHDRAWN': 'text-warn bg-warn-tint'
    }
 return colors[action] || 'text-ink-2 bg-surface-2'
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
      <PageHeader className="mb-6" title="Audit logs" subline="Every sensitive action, who did it and when." />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-ink-2 mb-1">Entity</label>
            <select
 value={filters.entity}
 onChange={(e) => setFilters(prev => ({ ...prev, entity: e.target.value, offset: 0 }))}
 className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink"
            >
              <option value="">All Entities</option>
              {entities.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-ink-2 mb-1">Action</label>
            <select
 value={filters.action}
 onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value, offset: 0 }))}
 className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink"
            >
              <option value="">All Actions</option>
              {actions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-ink-2 mb-1">From</label>
            <input
 type="date"
 value={filters.from}
 max={filters.to || undefined}
 onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value, offset: 0 }))}
 className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink"
            />
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-ink-2 mb-1">To</label>
            <input
 type="date"
 value={filters.to}
 min={filters.from || undefined}
 onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value, offset: 0 }))}
 className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink"
            />
          </div>

          <div className="w-32">
            <label className="block text-sm font-medium text-ink-2 mb-1">Per page</label>
            <select
 value={filters.limit}
 onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value), offset: 0 }))}
 className="w-full px-3 py-2 border border-line rounded-md bg-surface text-ink"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          <button
 onClick={() => setFilters({ entity: '', action: '', from: '', to: '', limit: 50, offset: 0 })}
 className="px-4 py-2 bg-surface-2 text-ink-2 rounded-md hover:bg-surface-2"
          >
 Clear Filters
          </button>

          <button
 onClick={exportLogs}
 disabled={exporting}
 className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent disabled:bg-surface-2 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
        </div>

        <div className="mt-4 text-sm text-ink-2">
 Showing {logs.length} of {total} logs (page {Math.floor(filters.offset / filters.limit) + 1} of {Math.max(1, Math.ceil(total / filters.limit))})
        </div>
      </Card>

      {error && (
        <Card className="mb-6">
          <div className="text-center py-4 text-bad">{error}</div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="text-center py-8 text-ink-3">Loading audit logs...</div>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-ink-3">No audit logs found</div>
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
                      <span className="text-sm font-medium text-ink-2">{log.entity}</span>
                      {log.entityId && (
                        <span className="text-xs text-ink-3">ID: {log.entityId}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-ink-2 mb-2">
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
                      <div className="mt-2 p-2 bg-surface-2 rounded text-xs">
                        <strong className="text-ink-2">Details:</strong>
                        <pre className="mt-1 text-ink-2 whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {log.userAgent && (
                      <div className="mt-2 text-xs text-ink-3 truncate" title={log.userAgent}>
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
 className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent disabled:bg-surface-2 disabled:cursor-not-allowed"
              >
 Previous
              </button>
              <span className="text-sm text-ink-2">
                {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} of {total}
              </span>
              <button
 onClick={handleNext}
 disabled={filters.offset + filters.limit >= total}
 className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent disabled:bg-surface-2 disabled:cursor-not-allowed"
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
