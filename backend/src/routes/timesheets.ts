import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import * as XLSX from 'xlsx'

const router = Router()

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  
  // If user is an employee (USER role), only show their own timesheets
  if (user.role === 'USER' && user.employeeId) {
    const items = await prisma.timesheet.findMany({ 
      where: { employeeId: user.employeeId },
      include: { employee: true, project: true } 
    })
    return res.json(items)
  }
  
  // Admins and managers see all timesheets
  const items = await prisma.timesheet.findMany({ include: { employee: true, project: true } })
  res.json(items)
})

router.post('/', requireAuth, async (req: any, res) => {
  const user = req.user
  let { employeeId, projectId, date, hours, notes } = req.body
  
  // If user is an employee, they can only create timesheets for themselves
  if (user.role === 'USER') {
    if (!user.employeeId) {
      return res.status(403).json({ error: 'User account is not linked to an employee record' })
    }
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

router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { employeeId, projectId, date, hours, notes } = req.body
  try {
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

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
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
    
    let timesheets: any[] = []
    // If user is an employee, only export their own timesheets
    if (user.role === 'USER' && user.employeeId) {
      timesheets = await prisma.timesheet.findMany({ 
        where: { employeeId: user.employeeId },
        include: { employee: true, project: true } 
      })
    } else {
      timesheets = await prisma.timesheet.findMany({ include: { employee: true, project: true } })
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
