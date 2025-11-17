import React from 'react'
import { apiGet } from '../lib/api'

export default function Settings() {
  const [driveConnected, setDriveConnected] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    apiGet('/documents/drive/status')
      .then((r) => setDriveConnected(r.connected))
      .catch(() => setDriveConnected(false))
  }, [])

  async function connectDrive() {
    try {
      const res = await apiGet('/drive/connect')
      if (res.url) {
        // redirect to Google consent screen
        window.open(res.url as string, '_blank')
      }
    } catch (e) {
      alert('Failed to get connect URL')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Settings</h2>
      <div className="space-y-3">
        <div className="p-3 border rounded bg-white dark:bg-slate-800">Calendar integration: Not connected</div>
        <div className="p-3 border rounded bg-white dark:bg-slate-800">
          Google Drive: {driveConnected === null ? 'Checking...' : driveConnected ? 'Connected' : 'Not connected'}
          <div className="mt-2">
            <button onClick={connectDrive} className="px-3 py-1 bg-yellow-400 rounded">Connect Google Drive</button>
          </div>
        </div>
      </div>
    </div>
  )
}
