import React from 'react'
import { apiGet, apiPost, API_BASE_URL } from '../lib/api'
import Card from '../components/Card'
import { PageHeader } from '../components/ui'
import CompanyProfileCard from '../components/CompanyProfileCard'
import SponsorLicenceCard from '../components/SponsorLicenceCard'
import LeavePolicyCard from '../components/LeavePolicyCard'
import DocumentTemplatesCard from '../components/DocumentTemplatesCard'
import { hasFeature } from '../lib/tenant'

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
 a.download = `onsidehr-backup-${new Date().toISOString().split('T')[0]}.json`
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
 const result = await apiPost('/admin/seed-data', {})
 setDevToolsStatus('Sample data created.')
 const counts = result.results || result
 alert(
 `Sample data created successfully!\n\n` +
 `${counts.employees || 0} employees\n` +
 `${counts.projects || 0} projects\n` +
 `${counts.timesheets || 0} timesheets\n` +
 `${counts.leaveRequests || 0} leave requests\n` +
 `${counts.sponsorships || 0} sponsorships\n` +
 `${counts.users || 0} user accounts\n\n` +
 `No sample login accounts were created.\n` +
 `Create real employee access from User/Employee Management when required.`
      )
 setTimeout(() => setDevToolsStatus(''), 3000)
    } catch (error: any) {
 console.error('Seed error:', error)
 setDevToolsStatus(`Could not create sample data: ${error.message}`)
    }
  }

 const handleClearData = async () => {
 const confirmed = confirm(
 'This deletes all data in the database.\n\n' +
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
 'Final warning.\n\n' +
 'This action CANNOT be undone!\n\n' +
 'Click OK to permanently delete all data.'
    )
    
 if (!doubleConfirm) return
    
 try {
 setDevToolsStatus('Clearing all data...')
 const result = await apiPost('/admin/clear-data', {})
 setDevToolsStatus('All data cleared.')
 alert(`Data cleared successfully!\n\nDeleted ${result.deleted || 0} records.`)
 setTimeout(() => setDevToolsStatus(''), 3000)
    } catch (error: any) {
 console.error('Clear error:', error)
 setDevToolsStatus(`Could not clear data: ${error.message}`)
    }
  }

 return (
    <div>
      <PageHeader
        className="mb-6"
        title="Settings"
        subline="Company profile, sponsor licence, leave policy and integrations."
      />
      
      <div className="space-y-6">
        {isAdmin && <CompanyProfileCard />}
        {hasFeature('compliance') && <SponsorLicenceCard canEdit={isAdmin} />}
        <LeavePolicyCard canEdit={isAdmin} />
        <DocumentTemplatesCard canEdit={isAdmin} />

        {/* Backup & Restore (Admin Only) */}
        {isAdmin && (
          <Card className="p-6">
            <h3 className="text-base font-semibold text-ink mb-4">
 Database management
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-ink-2 mb-3">
 Create a complete backup of all system data (employees, projects, documents, etc.)
                </p>
                <button 
 onClick={handleBackup}
 className="btn-secondary"
                >
                  Download backup
                </button>
              </div>
              
              <div className="pt-4 border-t border-line">
                <p className="text-sm text-ink-2 mb-3">
 Restore data from a previous backup file
                </p>
                <label className="inline-block btn-secondary cursor-pointer">
                  Upload a backup to restore
                  <input 
 type="file" 
 accept=".json"
 onChange={handleRestore}
 disabled={restoring}
 className="hidden"
                  />
                </label>
                {restoring && <span className="ml-3 text-sm text-ink-2">Processing...</span>}
              </div>

              <div className="pt-4 border-t border-line">
                <p className="text-sm text-ink-2 mb-3">
 Create sample business records for testing (employees, projects, timesheets, etc.). This does not create any demo login accounts.
                </p>
                <button 
 onClick={handleSeedData}
 className="btn-secondary"
                >
                  Seed sample data
                </button>
              </div>

              <div className="pt-4 border-t border-line">
                <p className="text-sm text-ink-2 mb-3">
                  Permanently delete all data (employees, projects, documents, etc.). User accounts will NOT be deleted.
                </p>
                <button 
 onClick={handleClearData}
 className="btn-secondary"
                >
                  Clear all data
                </button>
              </div>
              
              {backupStatus && (
                <div className={`p-3 rounded-lg text-sm ${ backupStatus.includes('failed') || backupStatus.includes('WARNING')
                    ? 'bg-bad-tint text-bad border border-bad'
                    : 'bg-ok-tint text-ok border border-ok'
                }`}>
                  {backupStatus}
                </div>
              )}
              
              {devToolsStatus && (
                <div className={`p-3 rounded-lg text-sm ${ devToolsStatus.includes('Failed') || devToolsStatus.includes('Could not')
                    ? 'bg-bad-tint text-bad border border-bad'
                    : 'bg-ok-tint text-ok border border-ok'
                }`}>
                  {devToolsStatus}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Google Drive Integration */}
        <Card className="p-6">
          <h3 className="text-base font-semibold text-ink mb-4">Integrations</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Google Drive</span>
                <span className={`text-sm ${driveConnected ? 'text-ok' : 'text-ink-3'}`}>
                  {driveConnected === null ? 'Checking...' : driveConnected ? '✓ Connected' : 'Not connected'}
                </span>
              </div>
              <button onClick={connectDrive} className="bg-accent text-white px-4 py-2 rounded hover:bg-accent text-sm">
 Connect Google Drive
              </button>
            </div>
            
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Calendar Integration</span>
                <span className="text-sm text-ink-3">Not connected</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
