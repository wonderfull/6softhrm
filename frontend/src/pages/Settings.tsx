import React from 'react'
import { apiGet, apiPost, API_BASE_URL } from '../lib/api'
import Card from '../components/Card'

export default function Settings() {
  const [driveConnected, setDriveConnected] = React.useState<boolean | null>(null)
  const [restoring, setRestoring] = React.useState(false)
  const [backupStatus, setBackupStatus] = React.useState('')
  const [devToolsStatus, setDevToolsStatus] = React.useState('')
  
  const token = localStorage.getItem('token')
  const user = token ? JSON.parse(atob(token.split('.')[1])) : null
  const isAdmin = user?.role === 'ADMIN'

  React.useEffect(() => {
    apiGet('/documents/drive/status')
      .then((r) => setDriveConnected(r.connected))
      .catch(() => setDriveConnected(false))
  }, [])

  async function connectDrive() {
    try {
      const res = await apiGet('/drive/connect')
      if (res.url) {
        window.open(res.url as string, '_blank')
      }
    } catch (e) {
      alert('Failed to get connect URL')
    }
  }

  async function handleBackup() {
    try {
      setBackupStatus('Creating backup...')
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/admin/backup`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Backup failed')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `6soft-hrm-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setBackupStatus('Backup downloaded successfully!')
      setTimeout(() => setBackupStatus(''), 3000)
    } catch (err: any) {
      setBackupStatus('Backup failed: ' + err.message)
      setTimeout(() => setBackupStatus(''), 3000)
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!confirm('WARNING: This will restore data from the backup file. This may overwrite existing data. Continue?')) {
      e.target.value = ''
      return
    }
    
    try {
      setRestoring(true)
      setBackupStatus('Reading backup file...')
      
      const text = await file.text()
      const backup = JSON.parse(text)
      
      setBackupStatus('Restoring data...')
      const result = await apiPost('/admin/restore', backup)
      
      setBackupStatus(`Restore completed! ${JSON.stringify(result.results)}`)
      setTimeout(() => {
        setBackupStatus('')
        window.location.reload()
      }, 3000)
    } catch (err: any) {
      setBackupStatus('Restore failed: ' + err.message)
      setTimeout(() => setBackupStatus(''), 5000)
    } finally {
      setRestoring(false)
      e.target.value = ''
    }
  }

  const handleSeedData = async () => {
    try {
      setDevToolsStatus('Creating sample data...')
      const result = await apiPost(`${API_BASE_URL}/admin/seed-data`, {})
      setDevToolsStatus('✅ Sample data created successfully!')
      alert(
        `Sample data created successfully!\n\n` +
        `${result.employees || 0} employees\n` +
        `${result.projects || 0} projects\n` +
        `${result.timesheets || 0} timesheets\n` +
        `${result.leaveRequests || 0} leave requests\n` +
        `${result.sponsorships || 0} sponsorships\n` +
        `${result.users || 0} user accounts\n\n` +
        `Test credentials:\n` +
        `Email: john.smith@company.com\n` +
        `Password: password123`
      )
      setTimeout(() => setDevToolsStatus(''), 3000)
    } catch (error: any) {
      console.error('Seed error:', error)
      setDevToolsStatus(`❌ Failed to create sample data: ${error.message}`)
    }
  }

  const handleClearData = async () => {
    const confirmed = confirm(
      '⚠️ WARNING: This will delete ALL data from the database!\n\n' +
      'This includes:\n' +
      '- All employees\n' +
      '- All projects\n' +
      '- All timesheets\n' +
      '- All leave requests\n' +
      '- All documents\n' +
      '- All sponsorships\n' +
      '- All calendar events\n\n' +
      'User accounts will NOT be deleted.\n\n' +
      'Are you absolutely sure?'
    )
    
    if (!confirmed) return
    
    const doubleConfirm = confirm(
      '⚠️ FINAL WARNING ⚠️\n\n' +
      'This action CANNOT be undone!\n\n' +
      'Click OK to permanently delete all data.'
    )
    
    if (!doubleConfirm) return
    
    try {
      setDevToolsStatus('Clearing all data...')
      const result = await apiPost(`${API_BASE_URL}/admin/clear-data`, {})
      setDevToolsStatus('✅ All data cleared successfully!')
      alert(`Data cleared successfully!\n\nDeleted ${result.deleted || 0} records.`)
      setTimeout(() => setDevToolsStatus(''), 3000)
    } catch (error: any) {
      console.error('Clear error:', error)
      setDevToolsStatus(`❌ Failed to clear data: ${error.message}`)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>
      
      <div className="space-y-6">
        {/* Backup & Restore (Admin Only) */}
        {isAdmin && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-2xl">💾</span>
              Database Management
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Create a complete backup of all system data (employees, projects, documents, etc.)
                </p>
                <button 
                  onClick={handleBackup}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
                >
                  📥 Download Backup
                </button>
              </div>
              
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Restore data from a previous backup file
                </p>
                <label className="inline-block bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-2 rounded-lg hover:from-green-700 hover:to-teal-700 transition-all shadow-md cursor-pointer">
                  📤 Upload Backup to Restore
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleRestore}
                    disabled={restoring}
                    className="hidden"
                  />
                </label>
                {restoring && <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">Processing...</span>}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Create sample data for testing (employees, projects, timesheets, etc.)
                </p>
                <button 
                  onClick={handleSeedData}
                  className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-2 rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all shadow-md"
                >
                  🌱 Seed Sample Data
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  ⚠️ Permanently delete ALL data (employees, projects, documents, etc.). User accounts will NOT be deleted.
                </p>
                <button 
                  onClick={handleClearData}
                  className="bg-gradient-to-r from-red-600 to-rose-600 text-white px-6 py-2 rounded-lg hover:from-red-700 hover:to-rose-700 transition-all shadow-md"
                >
                  🗑️ Clear All Data
                </button>
              </div>
              
              {backupStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  backupStatus.includes('failed') || backupStatus.includes('WARNING')
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                }`}>
                  {backupStatus}
                </div>
              )}
              
              {devToolsStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  devToolsStatus.includes('Failed') || devToolsStatus.includes('❌')
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                }`}>
                  {devToolsStatus}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Google Drive Integration */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Integrations</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Google Drive</span>
                <span className={`text-sm ${driveConnected ? 'text-green-600' : 'text-slate-500'}`}>
                  {driveConnected === null ? 'Checking...' : driveConnected ? '✓ Connected' : 'Not connected'}
                </span>
              </div>
              <button onClick={connectDrive} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">
                Connect Google Drive
              </button>
            </div>
            
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Calendar Integration</span>
                <span className="text-sm text-slate-500">Not connected</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
