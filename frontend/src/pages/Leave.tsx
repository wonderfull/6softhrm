import React from 'react'
import { apiGet, apiPost, apiPut, getCurrentUser } from '../lib/api'
import Card from '../components/Card'
import { HiPlus } from 'react-icons/hi'

export default function Leave() {
  const [items, setItems] = React.useState<any[]>([])
  const [loadingIds, setLoadingIds] = React.useState<number[]>([])
  const [showForm, setShowForm] = React.useState(false)
  const [formData, setFormData] = React.useState({
    type: 'ANNUAL',
    startDate: '',
    endDate: '',
    reason: ''
  })

  const loadLeave = () => {
    apiGet('/leave')
      .then(setItems)
      .catch(() => setItems([]))
  }

  React.useEffect(() => {
    loadLeave()
  }, [])

  const user = getCurrentUser()
  const canApprove = user && (user.role === 'ADMIN' || user.role === 'MANAGER')
  const canRequestLeave = user && user.employeeId
  const showLinkWarning = user?.role === 'USER' && !user.employeeId

  async function handleApprove(id: number) {
    try {
      setLoadingIds((s: number[]) => [...s, id])
      const updated = await apiPut(`/leave/${id}/approve`)
      setItems((list: any[]) => list.map((it: any) => (it.id === id ? updated : it)))
    } catch (e) {
      alert('Approve failed')
    } finally {
      setLoadingIds((s: number[]) => s.filter((i: number) => i !== id))
    }
  }

  async function handleReject(id: number) {
    try {
      setLoadingIds((s: number[]) => [...s, id])
      const updated = await apiPut(`/leave/${id}/reject`)
      setItems((list: any[]) => list.map((it: any) => (it.id === id ? updated : it)))
    } catch (e) {
      alert('Reject failed')
    } finally {
      setLoadingIds((s: number[]) => s.filter((i: number) => i !== id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiPost('/leave', formData)
      alert('Leave request submitted successfully!')
      setShowForm(false)
      setFormData({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' })
      loadLeave()
    } catch (err: any) {
      console.error('Error submitting leave request:', err)
      alert('Failed to submit leave request: ' + (err.message || JSON.stringify(err)))
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Leave Requests</h2>
        {canRequestLeave ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            <HiPlus /> {showForm ? 'Cancel' : 'Request Leave'}
          </button>
        ) : showLinkWarning ? (
          <div className="text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 text-sm">
            ⚠️ Your account is not linked to an employee record. Please contact HR.
          </div>
        ) : canApprove ? (
          <div className="text-slate-600 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 text-sm">
            Review and approve employee leave requests.
          </div>
        ) : null}
      </div>

      {showForm && canRequestLeave && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">New Leave Request</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Leave Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="form-input"
                required
              >
                <option value="ANNUAL">Annual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="PERSONAL">Personal Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="form-input"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Reason
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="form-input"
                rows={3}
                placeholder="Optional: Provide details about your leave request"
              />
            </div>

            <div className="col-span-2">
              <button type="submit" className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors">
                Submit Leave Request
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="p-6 text-center text-slate-600 dark:text-slate-400">
            No leave requests found. {canRequestLeave && 'Click "Request Leave" to submit a new request.'}
          </Card>
        ) : (
          items.map((l: any) => (
            <Card key={l.id} className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {l.employee?.firstName} {l.employee?.lastName}
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mt-1">
                    <span className="font-semibold">{l.type}</span> — {new Date(l.startDate).toLocaleDateString('en-GB')} to {new Date(l.endDate).toLocaleDateString('en-GB')}
                  </div>
                  {l.reason && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-medium">Reason:</span> {l.reason}
                    </div>
                  )}
                  <div className="mt-2">
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${l.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        l.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                      {l.status}
                    </span>
                  </div>
                </div>
                {canApprove && l.status === 'PENDING' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      disabled={loadingIds.includes(l.id)}
                      onClick={() => handleApprove(l.id)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {loadingIds.includes(l.id) ? '...' : 'Approve'}
                    </button>
                    <button
                      disabled={loadingIds.includes(l.id)}
                      onClick={() => handleReject(l.id)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {loadingIds.includes(l.id) ? '...' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
