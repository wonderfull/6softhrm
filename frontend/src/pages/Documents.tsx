import React from 'react'
import { apiGet } from '../lib/api'

export default function Documents() {
  const [items, setItems] = React.useState<any[]>([])
  const [file, setFile] = React.useState<File | null>(null)
  const [employeeId, setEmployeeId] = React.useState('')
  const [name, setName] = React.useState('')

  React.useEffect(() => {
    apiGet('/documents')
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return alert('pick a file')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('employeeId', employeeId)
    fd.append('name', name)

    const token = localStorage.getItem('token')
    const res = await fetch('/api/documents/upload', { method: 'POST', body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) return alert('Upload failed')
    const d = await res.json()
    setItems((s) => [d, ...s])
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Documents</h2>

      <form onSubmit={upload} className="mb-6 space-y-2">
        <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="Employee ID" className="p-2 border rounded" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name" className="p-2 border rounded" />
        <input type="file" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
        <button className="px-3 py-1 bg-yellow-400 rounded">Upload</button>
      </form>

      <div className="space-y-3">
        {items.map((d) => (
          <div key={d.id} className="p-3 border rounded bg-white dark:bg-slate-800">
            <div className="font-bold">{d.name}</div>
            <a className="text-sm underline" href={d.path}>{d.path}</a>
          </div>
        ))}
      </div>
    </div>
  )
}
