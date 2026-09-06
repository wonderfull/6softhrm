import React, { useEffect, useState } from 'react'
import Card from '../components/Card'
import { API_BASE_URL, apiGet } from '../lib/api'
import { Badge, Card as UiCard, PageHeader, Table, Td, Th, Tr } from '../components/ui';

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

  // Only the three status tones exist, and most actions are simply neutral.
  const actionTone = (action: string): 'ok' | 'warn' | 'bad' | 'neutral' => {
    if (action === 'LOGIN_SUCCESS' || action === 'APPROVE' || action === 'CONSENT_GIVEN')
      return 'ok';
    if (action === 'LOGIN_FAILED' || action === 'DELETE') return 'bad';
    if (action === 'UPDATE' || action === 'REJECT' || action === 'CONSENT_WITHDRAWN')
      return 'warn';
    return 'neutral';
  };

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
 className="btn-ghost"
          >
 Clear filters
          </button>

          <button
 onClick={exportLogs}
 disabled={exporting}
 className="btn-secondary"
          >
            {exporting ? 'Exporting…' : 'Export'}
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
          <UiCard flush>
            <Table className="min-w-[820px]">
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>User</Th>
                  <Th>When</Th>
                  <Th>IP</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Tr key={log.id}>
                    <Td>
                      <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                    </Td>
                    <Td className="text-ink">
                      {log.entity}
                      {log.entityId ? (
                        <span className="ml-1 font-mono text-xs text-ink-3">
                          #{log.entityId}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-[13px] text-ink-2">
                      {log.userEmail || 'System'}
                    </Td>
                    <Td className="font-mono text-[13px] text-ink-2 whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </Td>
                    <Td className="font-mono text-[13px] text-ink-3">
                      {log.ipAddress || 'Not recorded'}
                    </Td>
                    <Td className="max-w-[280px]">
                      <span
                        className="block truncate text-xs text-ink-3"
                        title={
                          log.details ? JSON.stringify(log.details) : log.userAgent || ''
                        }
                      >
                        {log.details && Object.keys(log.details).length > 0
                          ? JSON.stringify(log.details)
                          : log.userAgent || ''}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </UiCard>

          <Card className="mt-6">
            <div className="flex justify-between items-center">
              <button
 onClick={handlePrevious}
 disabled={filters.offset === 0}
 className="btn-secondary"
              >
 Previous
              </button>
              <span className="text-sm text-ink-2">
                {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} of {total}
              </span>
              <button
 onClick={handleNext}
 disabled={filters.offset + filters.limit >= total}
 className="btn-secondary"
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
