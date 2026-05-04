import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import * as XLSX from 'xlsx'
import { canReviewLeaveAndTime, normalizeRole, ROLES } from '../lib/roles'

const router = Router()

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user.role)
  
  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) return res.json([])

    const items = await prisma.timesheet.findMany({ 
      where: { employeeId: user.employeeId },
      include: { employee: true, project: true } 
    })
    return res.json(items)
  }

  if (!canReviewLeaveAndTime(role)) return res.status(403).json({ error: 'Unauthorized' })
  
  const items = await prisma.timesheet.findMany({ include: { employee: true, project: true } })
  res.json(items)
})

router.post('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user.role)
  let { employeeId, projectId, date, hours, notes } = req.body
  
  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res.status(403).json({ error: 'User account is not linked to an employee record' })
    }
    employeeId = user.employeeId
  } else if (!canReviewLeaveAndTime(role)) {
    return res.status(403).json({ error: 'Unauthorized' })
  } else if (!employeeId && user.employeeId) {
    employeeId = user.employeeId
  }
  
  if (!employeeId || !date || !hours) return res.status(400).json({ error: 'missing fields' })
  try {
    const data: any = {
      employeeId,
      date: new Date(date),
      hours: Number(hours),
      notes
    }
    if (projectId) data.projectId = projectId
    
    const ts = await prisma.timesheet.create({ data })
    res.json(ts)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.put('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params
  const { employeeId, projectId, date, hours, notes } = req.body
  try {
    const user = req.user
    const role = normalizeRole(user.role)
    const existing = await prisma.timesheet.findUnique({ where: { id: parseInt(id) } })
    if (!existing) return res.status(404).json({ error: 'Timesheet not found' })

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId || existing.employeeId !== user.employeeId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }
      if (employeeId && Number(employeeId) !== user.employeeId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }
    } else if (!canReviewLeaveAndTime(role)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const data: any = {}
    if (employeeId) data.employeeId = employeeId
    if (projectId !== undefined) data.projectId = projectId || null
    if (date) data.date = new Date(date)
    if (hours !== undefined) data.hours = Number(hours)
    if (notes !== undefined) data.notes = notes
    
    const ts = await prisma.timesheet.update({
      where: { id: parseInt(id) },
      data
    })
    res.json(ts)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params
  try {
    const user = req.user
    const role = normalizeRole(user.role)
    const existing = await prisma.timesheet.findUnique({ where: { id: parseInt(id) } })
    if (!existing) return res.status(404).json({ error: 'Timesheet not found' })

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId || existing.employeeId !== user.employeeId) {
        return res.status(403).json({ error: 'Unauthorized' })
      }
    } else if (!canReviewLeaveAndTime(role)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    await prisma.timesheet.delete({ where: { id: parseInt(id) } })
    res.json({ success: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// Export timesheets to Excel
router.get('/export/excel', requireAuth, async (req: any, res) => {
  try {
    const user = req.user
    const role = normalizeRole(user.role)
    
    let timesheets: any[] = []
    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId) {
        timesheets = []
      } else {
        timesheets = await prisma.timesheet.findMany({ 
          where: { employeeId: user.employeeId },
          include: { employee: true, project: true } 
        })
      }
    } else if (canReviewLeaveAndTime(role)) {
      timesheets = await prisma.timesheet.findMany({ include: { employee: true, project: true } })
    } else {
      return res.status(403).json({ error: 'Unauthorized' })
    }
    
    // Format data for Excel
    const excelData = timesheets.map(ts => ({
      'ID': ts.id,
      'Employee': ts.employee ? `${ts.employee.firstName} ${ts.employee.lastName}` : `Employee ${ts.employeeId}`,
      'Project': ts.project ? ts.project.name : 'No Project',
      'Date': new Date(ts.date).toLocaleDateString(),
      'Hours': ts.hours,
      'Notes': ts.notes || ''
    }))
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // ID
      { wch: 25 }, // Employee
      { wch: 30 }, // Project
      { wch: 12 }, // Date
      { wch: 8 },  // Hours
      { wch: 50 }  // Notes
    ]
    
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheets')
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    // Set headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=timesheets-${new Date().toISOString().split('T')[0]}.xlsx`)
    res.send(buffer)
  } catch (e: any) {
    console.error('Error exporting timesheets:', e)
    res.status(500).json({ error: 'Failed to export timesheets' })
  }
})

export default router
