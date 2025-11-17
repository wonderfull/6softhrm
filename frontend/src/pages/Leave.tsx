import React from 'react'
import { apiGet, apiPut, getCurrentUser } from '../lib/api'

export default function Leave() {
  const [items, setItems] = React.useState<any[]>([])
  const [loadingIds, setLoadingIds] = React.useState<number[]>([])

  React.useEffect(() => {
    apiGet('/leave')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const user = getCurrentUser()
  const canApprove = user && (user.role === 'ADMIN' || user.role === 'MANAGER')

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

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Leave Requests</h2>
      <div className="space-y-3">
  {items.map((l: any) => (
          <div key={l.id} className="p-3 border rounded bg-white dark:bg-slate-800">
            <div className="font-bold">{l.employee?.firstName} {l.employee?.lastName}</div>
            <div>{l.type} — {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()}</div>
            <div className="text-sm">Status: {l.status}</div>
            {canApprove && (
              <div className="mt-2 space-x-2">
                <button disabled={loadingIds.includes(l.id)} onClick={() => handleApprove(l.id)} className="px-3 py-1 bg-green-500 text-white rounded">{loadingIds.includes(l.id) ? '...' : 'Approve'}</button>
                <button disabled={loadingIds.includes(l.id)} onClick={() => handleReject(l.id)} className="px-3 py-1 bg-red-500 text-white rounded">{loadingIds.includes(l.id) ? '...' : 'Reject'}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
