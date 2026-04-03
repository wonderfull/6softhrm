import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { auditLog } from '../middleware/audit'
import * as XLSX from 'xlsx'

const router = Router()

router.get('/', requireAuth, async (req: any, res) => {
  const userRole = req.user?.role || 'USER'
  const userEmail = req.user?.email

  // If user is not ADMIN/MANAGER, show only their own employee record
  if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && userEmail) {
    const employee = await prisma.employee.findUnique({
      where: { email: userEmail },
      include: { sponsorships: true, documents: true }
    })
    await auditLog(req, 'READ', 'Employee', employee?.id, { selfAccess: true })
    return res.json(employee ? [employee] : [])
  }

  // Admin/Manager users see all employees
  const employees = await prisma.employee.findMany({ include: { sponsorships: true, documents: true } })
  
  // Fetch all consents for all employees
  const allConsents = await prisma.dataConsent.findMany({
    where: {
      employeeId: { in: employees.map(e => e.id) }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Define consent types
  const consentTypes = ['data_processing', 'emergency_contact', 'photo_usage', 
                        'marketing_emails', 'third_party_payroll', 'background_checks', 'references']
  
  // Attach consent summary to each employee
  const employeesWithConsents = employees.map(emp => {
    const empConsents = allConsents.filter(c => c.employeeId === emp.id)
    
    // Get latest consent for each type
    const consentSummary = consentTypes.map(type => {
      const typeConsents = empConsents.filter(c => c.consentType === type)
      if (typeConsents.length === 0) return { type, status: 'not_given' }
      
   const latest = typeConsents.reduce((l, c) => 
        new Date(c.createdAt) > new Date(l.createdAt) ? c : l
      )
      return {
        type,
        status: latest.consentGiven ? 'granted' : 'withdrawn',
        date: latest.consentDate || latest.withdrawnDate
      }
    })
    
    return {
      ...emp,
      consents: consentSummary,
      consentCount: consentSummary.filter(c => c.status === 'granted').length
    }
  })

  await auditLog(req, 'READ', 'Employee', undefined, { count: employees.length })
  res.json(employeesWithConsents)
})

router.post('/', requireAuth, async (req: any, res) => {
  const data = req.body
  try {
    // Convert startDate to DateTime if provided, otherwise set to undefined
    if (data.startDate && data.startDate !== '') {
      data.startDate = new Date(data.startDate)
    } else {
      data.startDate = undefined
    }

    // Convert endDate to DateTime if provided
    if (data.endDate && data.endDate !== '') {
      data.endDate = new Date(data.endDate)
    } else {
      data.endDate = undefined
    }

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
  const data = req.body
  try {
    // Convert dates
    if (data.startDate && data.startDate !== '') {
      data.startDate = new Date(data.startDate)
    } else if (data.startDate === '') {
      data.startDate = null
    }

    if (data.endDate && data.endDate !== '') {
      data.endDate = new Date(data.endDate)
    } else if (data.endDate === '') {
      data.endDate = null
    }

    const emp = await prisma.employee.update({
      where: { id: parseInt(id) },
      data
    })
    await auditLog(req, 'UPDATE', 'Employee', emp.id, {
      updatedFields: Object.keys(data).filter(k => data[k] !== undefined)
    })
    res.json(emp)
  } catch (e: any) {
    console.error('Error updating employee:', e)
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req: any, res) => {
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
    const excelData = employees.map(emp => ({
      'ID': emp.id,
      'First Name': emp.firstName,
      'Last Name': emp.lastName,
      'Email': emp.email,
      'Phone': emp.phoneNumber || '',
      'Job Title': emp.jobTitle,
      'Department': emp.department || '',
      'Employee Type': emp.employeeType,
      'NI Number': emp.niNumber || '',
      'Start Date': emp.startDate ? new Date(emp.startDate).toLocaleDateString() : '',
      'Bank Name': emp.bankName || '',
      'Sort Code': emp.sortCode || '',
      'Account Number': emp.accountNumber || '',
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
