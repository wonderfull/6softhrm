import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { auditLog } from '../middleware/audit'
import { requireRole } from '../middleware/roles'
import * as XLSX from 'xlsx'
import type { DataConsent, Employee } from '@prisma/client'
import { normalizeRole, ROLES } from '../lib/roles'

const router = Router()

const employeeListInclude = {
  sponsorships: true,
  documents: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      employeeId: true,
      createdAt: true,
    },
  },
}

function normalizeEmployeeUserRole(employee: any) {
  return {
    ...employee,
    user: employee.user ? { ...employee.user, role: normalizeRole(employee.user.role) } : employee.user,
  }
}

function redactSensitiveEmployeeFields(employee: any) {
  return {
    ...normalizeEmployeeUserRole(employee),
    niNumber: null,
    taxCode: null,
    bankName: null,
    accountName: null,
    accountNumber: null,
    sortCode: null,
    salary: null,
    salaryRate: null,
    paymentFrequency: null,
    salaryEffectiveFrom: null,
    salaryReason: null,
    payrollNumber: null,
    passportNumber: null,
    passportCountryOfIssue: null,
    passportExpiryDate: null,
    licenceNumber: null,
    licenceCountryOfIssue: null,
    licenceClass: null,
    licenceExpiryDate: null,
    visaNumber: null,
    visaExpiryDate: null,
    emergencyContactAddress: null,
  }
}

function normalizeEmployeePayload(data: any) {
  const dateFields = [
    'startDate',
    'endDate',
    'dateOfBirth',
    'probationEndDate',
    'salaryEffectiveFrom',
    'passportExpiryDate',
    'licenceExpiryDate',
    'visaExpiryDate',
  ]

  for (const field of dateFields) {
    if (data[field] && data[field] !== '') {
      data[field] = new Date(data[field])
    } else if (data[field] === '') {
      data[field] = null
    }
  }

  if (data.salary === '') data.salary = null
  if (data.salary !== undefined && data.salary !== null) data.salary = Number(data.salary)

  return data
}

const employeeSelfUpdateFields = [
  'title',
  'firstName',
  'middleName',
  'lastName',
  'gender',
  'ethnicity',
  'dateOfBirth',
  'phoneNumber',
  'workPhone',
  'address1',
  'address2',
  'address3',
  'townCity',
  'county',
  'postcode',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelation',
  'emergencyContactAddress',
  'accountName',
  'bankName',
  'bankBranch',
  'accountNumber',
  'sortCode',
] as const

function pickEmployeeSelfUpdatePayload(data: any) {
  const picked: Record<string, any> = {}
  for (const field of employeeSelfUpdateFields) {
    if (data[field] !== undefined) picked[field] = data[field]
  }
  return picked
}

router.get('/', requireAuth, async (req: any, res) => {
  const userRole = normalizeRole(req.user?.role)
  const userEmail = req.user?.email

  // If user is not elevated, show only their own employee record
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.DIRECTOR && userRole !== ROLES.OFFICE_ASSISTANT && userEmail) {
    const employee = await prisma.employee.findUnique({
      where: { email: userEmail },
      include: { sponsorships: true, documents: true }
    })
    await auditLog(req, 'READ', 'Employee', employee?.id, { selfAccess: true })
    return res.json(employee ? [employee] : [])
  }

  // Admin, Director, and Office Assistant users see all employees.
  const employees = await prisma.employee.findMany({ include: employeeListInclude })

  if (userRole === ROLES.OFFICE_ASSISTANT) {
    await auditLog(req, 'READ', 'Employee', undefined, { count: employees.length, redacted: true })
    return res.json(employees.map(redactSensitiveEmployeeFields))
  }
  
  // Fetch all consents for all employees
  const allConsents = await prisma.dataConsent.findMany({
    where: {
      employeeId: { in: employees.map((e: Employee) => e.id) }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Define consent types
  const consentTypes = ['data_processing', 'emergency_contact', 'photo_usage', 
                        'marketing_emails', 'third_party_payroll', 'background_checks', 'references']
  
  // Attach consent summary to each employee
  const employeesWithConsents = employees.map((emp: Employee) => {
    const normalizedEmployee = normalizeEmployeeUserRole(emp)
    const empConsents = allConsents.filter((c: DataConsent) => c.employeeId === normalizedEmployee.id)
    
    // Get latest consent for each type
    const consentSummary = consentTypes.map(type => {
      const typeConsents = empConsents.filter((c: DataConsent) => c.consentType === type)
      if (typeConsents.length === 0) return { type, status: 'not_given' }
      
      const latest = typeConsents.reduce((l: DataConsent, c: DataConsent) => 
        new Date(c.createdAt) > new Date(l.createdAt) ? c : l
      )
      return {
        type,
        status: latest.consentGiven ? 'granted' : 'withdrawn',
        date: latest.consentDate || latest.withdrawnDate
      }
    })
    
    return {
      ...normalizedEmployee,
      consents: consentSummary,
      consentCount: consentSummary.filter((c) => c.status === 'granted').length
    }
  })

  await auditLog(req, 'READ', 'Employee', undefined, { count: employees.length })
  res.json(employeesWithConsents)
})

router.post('/', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const data = normalizeEmployeePayload(req.body)
  try {
    const emp = await prisma.employee.create({ data })
    await auditLog(req, 'CREATE', 'Employee', emp.id, {
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email
    })
    // Auto-link to user if email matches
    const user = await prisma.user.findUnique({ where: { email: emp.email } })
    if (user && !user.employeeId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { employeeId: emp.id }
      })
    }

    res.json(emp)
  } catch (e: any) {
    console.error('Error creating employee:', e)
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params
  const employeeId = parseInt(id)
  const role = normalizeRole(req.user?.role)
  try {
    let data: any
    if (role === ROLES.ADMIN || role === ROLES.DIRECTOR) {
      data = normalizeEmployeePayload(req.body)
    } else if (role === ROLES.EMPLOYEE) {
      const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
      const ownsRecord = !!existing && (existing.id === req.user?.employeeId || existing.email === req.user?.email)
      if (!ownsRecord) return res.status(403).json({ error: 'Unauthorized' })
      data = normalizeEmployeePayload(pickEmployeeSelfUpdatePayload(req.body))
    } else {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const emp = await prisma.employee.update({
      where: { id: employeeId },
      data
    })
    await auditLog(req, 'UPDATE', 'Employee', emp.id, {
      updatedFields: Object.keys(data).filter(k => data[k] !== undefined),
      selfService: role === ROLES.EMPLOYEE,
    })
    res.json(emp)
  } catch (e: any) {
    console.error('Error updating employee:', e)
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  const { id } = req.params
  try {
    const emp = await prisma.employee.findUnique({ where: { id: parseInt(id) } })
    await prisma.employee.delete({
      where: { id: parseInt(id) }
    })
    await auditLog(req, 'DELETE', 'Employee', parseInt(id), {
      deletedEmployee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'
    })
    res.json({ success: true })
  } catch (e: any) {
    console.error('Error deleting employee:', e)
    res.status(400).json({ error: e.message })
  }
})

// Export employees to Excel
router.get('/export/excel', requireAuth, async (req: any, res) => {
  try {
    const userRole = req.user?.role || 'USER'
    const userEmail = req.user?.email

    let employees
    // If user is not ADMIN/MANAGER, show only their own employee record
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && userEmail) {
      const employee = await prisma.employee.findUnique({ where: { email: userEmail } })
      employees = employee ? [employee] : []
    } else {
      employees = await prisma.employee.findMany()
    }

    // Format data for Excel
    const excelData = employees.map((emp: Employee) => ({
      'ID': emp.id,
      'First Name': emp.firstName,
      'Last Name': emp.lastName,
      'Email': emp.email,
      'Phone': emp.phoneNumber || '',
      'Work Phone': emp.workPhone || '',
      'Job Title': emp.jobTitle,
      'Department': emp.department || '',
      'Employee Type': emp.employeeType,
      'Date of Birth': emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : '',
      'NI Number': emp.niNumber || '',
      'Start Date': emp.startDate ? new Date(emp.startDate).toLocaleDateString() : '',
      'Probation End Date': emp.probationEndDate ? new Date(emp.probationEndDate).toLocaleDateString() : '',
      'Address 1': emp.address1 || '',
      'Address 2': emp.address2 || '',
      'Town/City': emp.townCity || '',
      'Postcode': emp.postcode || '',
      'Account Name': emp.accountName || '',
      'Bank Name': emp.bankName || '',
      'Bank Branch': emp.bankBranch || '',
      'Sort Code': emp.sortCode || '',
      'Account Number': emp.accountNumber || '',
      'Salary': emp.salary ?? '',
      'Payment Frequency': emp.paymentFrequency || '',
      'Payroll Number': emp.payrollNumber || '',
      'Emergency Contact Name': emp.emergencyContactName || '',
      'Emergency Contact Phone': emp.emergencyContactPhone || '',
      'Emergency Contact Relation': emp.emergencyContactRelation || '',
      'Emergency Contact Address': emp.emergencyContactAddress || ''
    }))

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Job Title
      { wch: 15 }, // Department
      { wch: 15 }, // Employee Type
      { wch: 12 }, // NI Number
      { wch: 12 }, // Start Date
      { wch: 20 }, // Bank Name
      { wch: 12 }, // Sort Code
      { wch: 15 }, // Account Number
      { wch: 20 }, // Emergency Contact Name
      { wch: 15 }, // Emergency Contact Phone
      { wch: 15 }, // Emergency Contact Relation
      { wch: 30 }  // Emergency Contact Address
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Employees')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Set headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=employees-${new Date().toISOString().split('T')[0]}.xlsx`)
    res.send(buffer)
  } catch (e: any) {
    console.error('Error exporting employees:', e)
    res.status(500).json({ error: 'Failed to export employees' })
  }
})

export default router
