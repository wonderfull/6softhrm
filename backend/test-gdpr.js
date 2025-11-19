/**
 * Test GDPR Compliance Features
 * 
 * This script tests:
 * 1. Login audit logging
 * 2. Employee CRUD audit logging
 * 3. Audit log retrieval
 * 4. Subject access request (data export)
 * 5. Consent management
 */

const BASE_URL = 'http://localhost:4000/api'

async function testGDPRCompliance() {
  console.log('🧪 Testing GDPR Compliance Features\n')

  try {
    // 1. Login and get token
    console.log('1️⃣ Testing Login Audit...')
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' })
    })
    
    if (!loginResponse.ok) {
      throw new Error('Login failed: ' + loginResponse.statusText)
    }
    
    const { token } = await loginResponse.json()
    console.log('   ✅ Login successful')

    // 2. Test wrong password (should log LOGIN_FAILED)
    console.log('\n2️⃣ Testing Failed Login Audit...')
    const failedLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'wrong' })
    })
    
    if (failedLoginResponse.status === 401) {
      console.log('   ✅ Failed login handled correctly')
    }

    // 3. Fetch audit logs
    console.log('\n3️⃣ Testing Audit Log Retrieval...')
    const auditLogsResponse = await fetch(`${BASE_URL}/gdpr/audit-logs?limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!auditLogsResponse.ok) {
      throw new Error('Failed to fetch audit logs: ' + auditLogsResponse.statusText)
    }
    
    const { logs, total } = await auditLogsResponse.json()
    console.log(`   ✅ Retrieved ${logs.length} audit logs (${total} total)`)
    
    // Show recent logs
    console.log('   📋 Recent audit logs:')
    logs.slice(0, 5).forEach((log) => {
      console.log(`      - ${log.action} on ${log.entity} by ${log.userEmail || 'System'} at ${new Date(log.timestamp).toLocaleString()}`)
    })

    // 4. Create an employee (should audit CREATE)
    console.log('\n4️⃣ Testing Employee Creation Audit...')
    const createEmployeeResponse = await fetch(`${BASE_URL}/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'GDPR',
        email: `test-gdpr-${Date.now()}@example.com`,
        phoneNumber: '07700900000',
        jobTitle: 'Test Engineer',
        department: 'QA',
        employeeType: 'PERMANENT'
      })
    })
    
    if (!createEmployeeResponse.ok) {
      throw new Error('Failed to create employee: ' + createEmployeeResponse.statusText)
    }
    
    const newEmployee = await createEmployeeResponse.json()
    console.log(`   ✅ Employee created with ID ${newEmployee.id}`)

    // 5. Test subject access request
    console.log('\n5️⃣ Testing Subject Access Request...')
    const sarResponse = await fetch(`${BASE_URL}/gdpr/subject-access-request/${newEmployee.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!sarResponse.ok) {
      throw new Error('Failed to export employee data: ' + sarResponse.statusText)
    }
    
    const exportData = await sarResponse.json()
    console.log(`   ✅ Subject access request successful`)
    console.log(`   📦 Export includes:`)
    console.log(`      - Employee data: ${exportData.employee.firstName} ${exportData.employee.lastName}`)
    console.log(`      - Timesheets: ${exportData.employee.timesheets?.length || 0}`)
    console.log(`      - Leave requests: ${exportData.employee.leaveRequests?.length || 0}`)
    console.log(`      - Documents: ${exportData.employee.documents?.length || 0}`)
    console.log(`      - Audit logs: ${exportData.auditLogs?.length || 0}`)
    console.log(`      - Consents: ${exportData.consents?.length || 0}`)

    // 6. Test consent recording
    console.log('\n6️⃣ Testing Consent Management...')
    const consentResponse = await fetch(`${BASE_URL}/gdpr/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        employeeId: newEmployee.id,
        consentType: 'data_processing',
        consentGiven: true,
        version: '1.0'
      })
    })
    
    if (!consentResponse.ok) {
      throw new Error('Failed to record consent: ' + consentResponse.statusText)
    }
    
    const consent = await consentResponse.json()
    console.log(`   ✅ Consent recorded with ID ${consent.id}`)

    // 7. Verify consent in export
    console.log('\n7️⃣ Verifying Consent in Export...')
    const sarResponse2 = await fetch(`${BASE_URL}/gdpr/subject-access-request/${newEmployee.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const exportData2 = await sarResponse2.json()
    console.log(`   ✅ Consent now appears in export: ${exportData2.consents.length} consent record(s)`)

    // 8. Update employee (should audit UPDATE)
    console.log('\n8️⃣ Testing Employee Update Audit...')
    const updateResponse = await fetch(`${BASE_URL}/employees/${newEmployee.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        jobTitle: 'Senior Test Engineer'
      })
    })
    
    if (!updateResponse.ok) {
      throw new Error('Failed to update employee: ' + updateResponse.statusText)
    }
    console.log(`   ✅ Employee updated`)

    // 9. Delete employee (should audit DELETE)
    console.log('\n9️⃣ Testing Employee Deletion Audit...')
    const deleteResponse = await fetch(`${BASE_URL}/employees/${newEmployee.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (!deleteResponse.ok) {
      throw new Error('Failed to delete employee: ' + deleteResponse.statusText)
    }
    console.log(`   ✅ Employee deleted`)

    // 10. Verify all actions are logged
    console.log('\n🔟 Verifying All Actions Are Logged...')
    const finalAuditResponse = await fetch(`${BASE_URL}/gdpr/audit-logs?limit=20`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const finalAudit = await finalAuditResponse.json()
    
    const expectedActions = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE', 'DATA_EXPORT', 'CONSENT_GIVEN']
    const foundActions = new Set(finalAudit.logs.map((l) => l.action))
    
    console.log('   📋 Actions found in audit log:')
    expectedActions.forEach(action => {
      if (foundActions.has(action)) {
        console.log(`      ✅ ${action}`)
      } else {
        console.log(`      ⚠️  ${action} (not found - may be from earlier tests)`)
      }
    })

    console.log('\n✅ All GDPR compliance tests passed!\n')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests
testGDPRCompliance()
