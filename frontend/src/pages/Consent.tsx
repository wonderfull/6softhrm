import React, { useEffect, useState } from 'react'
import axios from 'axios'
import Card from '../components/Card'
import { getCurrentUser } from '../lib/api'

interface ConsentRecord {
  id: number
  employeeId: number
  consentType: string
  consentGiven: boolean
  consentDate: string | null
  withdrawnDate: string | null
  ipAddress: string | null
  version: string | null
  createdAt: string
}

interface ConsentType {
  key: string
  title: string
  description: string
  required: boolean
}

const CONSENT_TYPES: ConsentType[] = [
  {
    key: 'data_processing',
    title: 'Data Processing',
    description: 'Allow processing of personal data for employment purposes (payroll, HR administration, performance management)',
    required: true
  },
  {
    key: 'emergency_contact',
    title: 'Emergency Contact Storage',
    description: 'Store emergency contact information for health and safety purposes',
    required: false
  },
  {
    key: 'photo_usage',
    title: 'Photo and Image Usage',
    description: 'Use employee photo on internal systems, ID badges, and company directory',
    required: false
  },
  {
    key: 'marketing_emails',
    title: 'Marketing Communications',
    description: 'Receive company newsletters, event invitations, and internal marketing communications',
    required: false
  },
  {
    key: 'third_party_payroll',
    title: 'Third-Party Payroll Services',
    description: 'Share data with external payroll providers for salary processing',
    required: false
  },
  {
    key: 'background_checks',
    title: 'Background Checks',
    description: 'Conduct background verification checks as part of employment screening',
    required: false
  },
  {
    key: 'references',
    title: 'Reference Checks',
    description: 'Contact provided references for employment verification',
    required: false
  }
]

function getArrayPayload<T>(payload: T[] | { data?: T[] } | unknown): T[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: T[] }).data)) {
    return (payload as { data: T[] }).data
  }
  return []
}

const Consent: React.FC = () => {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployeeAndConsents()
  }, [])

  const fetchEmployeeAndConsents = async () => {
    try {
      const token = localStorage.getItem('token')
      const currentUser = getCurrentUser()
      const userEmail = currentUser?.email
      const userEmployeeId = currentUser?.employeeId ? Number(currentUser.employeeId) : null

      // Get employee record to find ID
      const employeesResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/employees`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const employees = getArrayPayload<any>(employeesResponse.data)
      const employee = employees.find((e: any) => {
        if (userEmployeeId) return Number(e.id) === userEmployeeId
        return e.email === userEmail
      })
      if (!employee) {
        alert('Employee record not found')
        return
      }

      setEmployeeId(employee.id)

      // Fetch consent history
      const consentsResponse = await axios.get(
        `${import.meta.env.VITE_API_URL}/gdpr/consent/${employee.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setConsents(getArrayPayload<ConsentRecord>(consentsResponse.data))
    } catch (err: any) {
      console.error('Error fetching consents:', err)
      alert('Failed to load consent data: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  const getLatestConsent = (consentType: string) => {
    const typeConsents = consents.filter(c => c.consentType === consentType)
    if (typeConsents.length === 0) return null
    return typeConsents.reduce((latest, current) =>
      new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
    )
  }

  const handleConsentChange = async (consentType: string, given: boolean) => {
    if (!employeeId) {
      alert('Employee ID not found')
      return
    }

    try {
      setSaving(consentType)
      const token = localStorage.getItem('token')

      await axios.post(
        `${import.meta.env.VITE_API_URL}/gdpr/consent`,
        {
          employeeId,
          consentType,
          consentGiven: given,
          version: '1.0'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Refresh consents
      await fetchEmployeeAndConsents()
      alert(`Consent ${given ? 'granted' : 'withdrawn'} successfully`)
    } catch (err: any) {
      console.error('Error updating consent:', err)
      alert('Failed to update consent: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(null)
    }
  }

  const getConsentHistory = (consentType: string) => {
    return consents
      .filter(c => c.consentType === consentType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Data Processing Consent</h1>
        <Card>
          <div className="text-center py-8 text-gray-500">Loading consent information...</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Data Processing Consent</h1>

      <Card className="mb-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Your Data Rights</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>Under UK GDPR, you have the right to control how your personal data is processed. You can grant or withdraw consent for specific data processing activities at any time.</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Required consents are necessary for employment and cannot be withdrawn</li>
                  <li>Optional consents can be given or withdrawn freely</li>
                  <li>All consent actions are logged for audit purposes</li>
                  <li>You can view your complete consent history below</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {CONSENT_TYPES.map(type => {
          const latestConsent = getLatestConsent(type.key)
          const isConsented = latestConsent?.consentGiven ?? false
          const history = getConsentHistory(type.key)

          return (
            <Card key={type.key}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{type.title}</h3>
                    {type.required && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                        Required
                      </span>
                    )}
                    {isConsented && !type.required && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                        ✓ Consented
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{type.description}</p>

                  {latestConsent && (
                    <div className="text-xs text-gray-500 mb-2">
                      Last updated: {formatDate(latestConsent.createdAt)}
                      {latestConsent.consentDate && (
                        <> • Granted: {formatDate(latestConsent.consentDate)}</>
                      )}
                      {latestConsent.withdrawnDate && (
                        <> • Withdrawn: {formatDate(latestConsent.withdrawnDate)}</>
                      )}
                    </div>
                  )}

                  {history.length > 0 && (
                    <button
                      onClick={() => setShowHistory(showHistory === type.key ? null : type.key)}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      {showHistory === type.key ? 'Hide' : 'View'} history ({history.length} record{history.length !== 1 ? 's' : ''})
                    </button>
                  )}

                  {showHistory === type.key && (
                    <div className="mt-3 bg-gray-50 rounded p-3 space-y-2">
                      {history.map((record, idx) => (
                        <div key={record.id} className="text-xs border-l-2 border-gray-300 pl-3 py-1">
                          <div className="font-medium">
                            {record.consentGiven ? '✓ Consent Given' : '✗ Consent Withdrawn'}
                          </div>
                          <div className="text-gray-600">
                            {formatDate(record.createdAt)}
                            {record.ipAddress && <> • IP: {record.ipAddress}</>}
                            {record.version && <> • Version: {record.version}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col gap-2">
                  {type.required ? (
                    <div className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md text-sm font-medium cursor-not-allowed">
                      Required
                    </div>
                  ) : (
                    <>
                      {!isConsented ? (
                        <button
                          onClick={() => handleConsentChange(type.key, true)}
                          disabled={saving === type.key}
                          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                          {saving === type.key ? 'Saving...' : 'Grant Consent'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConsentChange(type.key, false)}
                          disabled={saving === type.key}
                          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                          {saving === type.key ? 'Saving...' : 'Withdraw Consent'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Need Help?</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>If you have questions about how your data is processed or want to exercise your data rights:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Contact your HR department</li>
            <li>Email: hr@6soft.co.uk</li>
            <li>View our <a href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</a></li>
            <li>Request your data via the <a href="/data-export" className="text-blue-600 hover:underline">Data Export</a> page</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

export default Consent
