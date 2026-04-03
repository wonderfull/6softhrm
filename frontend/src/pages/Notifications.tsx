import React, { useEffect, useState } from 'react'
import Card from '../components/Card'

interface ExpiryItem {
  id: number
  employeeId?: number
  employeeName: string
  email: string
  visaType?: string
  jobTitle?: string
  expiryDate: string
  daysRemaining: number
}

interface ExpiryData {
  visaExpiries: ExpiryItem[]
  contractExpiries: ExpiryItem[]
}

const Notifications: React.FC = () => {
  const [expiries, setExpiries] = useState<ExpiryData>({ visaExpiries: [], contractExpiries: [] })
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)
  const [days, setDays] = useState(90)

  useEffect(() => {
    fetchExpiries()
  }, [days])

  const fetchExpiries = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/notifications/upcoming-expiries?days=${days}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.ok) throw new Error('Failed to fetch expiries')

      const data = await response.json()
      setExpiries(data)
    } catch (err: any) {
      console.error('Error fetching expiries:', err)
      alert('Failed to load expiries: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const checkAndNotify = async () => {
    if (!confirm('This will send email notifications for all upcoming expiries (30, 60, 90 days). Continue?')) {
      return
    }

    try {
      setChecking(true)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/notifications/check-expiries`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!response.ok) throw new Error('Failed to check expiries')

      const result = await response.json()
      alert(
        `Expiry check completed!\n\n` +
        `Visas checked: ${result.results.visasChecked}\n` +
        `Visa notifications sent: ${result.results.visaNotifications}\n\n` +
        `Contracts checked: ${result.results.contractsChecked}\n` +
        `Contract notifications sent: ${result.results.contractNotifications}`
      )
      fetchExpiries()
    } catch (err: any) {
      console.error('Error checking expiries:', err)
      alert('Failed to check expiries: ' + err.message)
    } finally {
      setChecking(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      alert('Please enter a valid email address')
      return
    }

    try {
      setTestingEmail(true)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/notifications/test-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to: testEmail }),
        }
      )

      const result = await response.json()
      alert(result.message)
    } catch (err: any) {
      console.error('Error sending test email:', err)
      alert('Failed to send test email: ' + err.message)
    } finally {
      setTestingEmail(false)
    }
  }

  const getExpiryColor = (days: number) => {
    if (days <= 30) return 'bg-red-100 text-red-800'
    if (days <= 60) return 'bg-orange-100 text-orange-800'
    return 'bg-yellow-100 text-yellow-800'
  }

  const getUserRole = () => {
    const token = localStorage.getItem('token')
    if (!token) return 'USER'
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.role || 'USER'
    } catch {
      return 'USER'
    }
  }

  const isAdmin = getUserRole() === 'ADMIN' || getUserRole() === 'MANAGER'

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Notifications & Alerts</h1>
        <Card>
          <div className="text-center py-8 text-gray-500">Loading notifications...</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Notifications & Alerts</h1>

      {isAdmin && (
        <>
          <Card className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Email Notification System</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <h3 className="font-medium text-blue-800 mb-2">Automated Notifications</h3>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Visa expiry alerts (30, 60, 90 days before expiry)</li>
                  <li>Contract end date alerts (30, 60, 90 days before expiry)</li>
                  <li>Leave request notifications (to managers)</li>
                  <li>Leave approval/rejection notifications (to employees)</li>
                  <li>Document upload notifications</li>
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={checkAndNotify}
                  disabled={checking}
                  className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {checking ? 'Checking...' : '🔔 Check & Send Notifications'}
                </button>

                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button
                    onClick={sendTestEmail}
                    disabled={testingEmail}
                    className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {testingEmail ? 'Sending...' : '📧 Test Email'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-medium text-gray-700 mb-2">Setup Instructions</h4>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Add SMTP configuration to your <code className="bg-gray-200 px-1 rounded">.env</code> file</li>
                  <li>For Gmail: Enable 2FA and create an App Password</li>
                  <li>Set <code className="bg-gray-200 px-1 rounded">SMTP_USER</code> and <code className="bg-gray-200 px-1 rounded">SMTP_PASSWORD</code></li>
                  <li>Restart the backend server to apply changes</li>
                  <li>Use "Test Email" button to verify configuration</li>
                </ol>
              </div>
            </div>
          </Card>

          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Upcoming Expiries</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-300">Show next:</label>
                <select
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                </select>
              </div>
            </div>

            {expiries.visaExpiries.length === 0 && expiries.contractExpiries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ✅ No upcoming expiries in the next {days} days
              </div>
            ) : (
              <div className="space-y-6">
                {/* Visa Expiries */}
                {expiries.visaExpiries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      🛂 Visa Expiries ({expiries.visaExpiries.length})
                    </h3>
                    <div className="space-y-2">
                      {expiries.visaExpiries.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.employeeName}</div>
                            <div className="text-sm text-gray-600">
                              {item.visaType} • Expires: {new Date(item.expiryDate).toLocaleDateString('en-GB')}
                            </div>
                            <div className="text-xs text-gray-500">{item.email}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getExpiryColor(item.daysRemaining)}`}>
                              {item.daysRemaining} days
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract Expiries */}
                {expiries.contractExpiries.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      📄 Contract Expiries ({expiries.contractExpiries.length})
                    </h3>
                    <div className="space-y-2">
                      {expiries.contractExpiries.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.employeeName}</div>
                            <div className="text-sm text-gray-600">
                              {item.jobTitle} • Contract ends: {new Date(item.expiryDate).toLocaleDateString('en-GB')}
                            </div>
                            <div className="text-xs text-gray-500">{item.email}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getExpiryColor(item.daysRemaining)}`}>
                              {item.daysRemaining} days
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {!isAdmin && (
        <Card>
          <div className="text-center py-8 text-gray-500">
            Admin access required to view notifications
          </div>
        </Card>
      )}
    </div>
  )
}

export default Notifications
