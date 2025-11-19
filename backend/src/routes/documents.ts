import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'

const router = Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const upload = multer({ 
  storage, 
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_TYPES.includes(file.mimetype))
  }
})

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  
  // If user is an employee (USER role), only show their own documents
  if (user.role === 'USER' && user.employeeId) {
    const docs = await prisma.document.findMany({ 
      where: { employeeId: user.employeeId },
      include: { employee: true } 
    })
    return res.json(docs)
  }
  
  // Admins and managers see all documents
  const docs = await prisma.document.findMany({ include: { employee: true } })
  res.json(docs)
})

// upload file and create metadata record (local storage only)
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file as Express.Multer.File | undefined
  const { employeeId, name, type, expiryDate } = req.body
  if (!file || !employeeId || !name) return res.status(400).json({ error: 'missing fields or file' })
  // Verify employee exists before writing DB record
  const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } })
  if (!emp) return res.status(400).json({ error: 'employee not found' })
  try {
    const pathToSave = `/uploads/${file.filename}`
    const data: any = { 
      employeeId: Number(employeeId), 
      name, 
      path: pathToSave 
    }
    if (type) data.type = type
    if (expiryDate) data.expiryDate = new Date(expiryDate)
    
    const d = await prisma.document.create({ data })
    res.json(d)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const doc = await prisma.document.findUnique({ where: { id: parseInt(id) } })
    if (!doc) return res.status(404).json({ error: 'Document not found' })
    
    // Delete the physical file
    const filePath = path.join(process.cwd(), doc.path.replace(/^\//, ''))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    
    // Delete the database record
    await prisma.document.delete({ where: { id: parseInt(id) } })
    res.json({ success: true })
  } catch (e: any) {
    console.error('Error deleting document:', e)
    res.status(400).json({ error: e.message })
  }
})

// Download all documents for an employee as ZIP
router.get('/download-all/:employeeId', requireAuth, async (req, res) => {
  const { employeeId } = req.params
  
  try {
    const employee = await prisma.employee.findUnique({ 
      where: { id: parseInt(employeeId) },
      include: { documents: true }
    })
    
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    if (employee.documents.length === 0) {
      return res.status(404).json({ error: 'No documents found for this employee' })
    }
    
    // Set response headers
    const filename = `${employee.firstName}_${employee.lastName}_Documents.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    
    // Create archive
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    // Pipe archive to response
    archive.pipe(res)
    
    // Add all documents to archive
    for (const doc of employee.documents) {
      const filePath = path.join(process.cwd(), doc.path.replace(/^\//, ''))
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: doc.name })
      }
    }
    
    // Finalize the archive
    await archive.finalize()
  } catch (e: any) {
    console.error('Error creating ZIP:', e)
    res.status(500).json({ error: e.message })
  }
})

// Get expiring documents (for dashboard alerts)
router.get('/expiring', requireAuth, async (req: any, res) => {
  try {
    const user = req.user
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    
    const whereClause: any = {
      expiryDate: {
        not: null,
        gte: now,
        lte: thirtyDaysFromNow
      }
    }
    
    // If user is an employee, only show their own expiring documents
    if (user.role === 'USER' && user.employeeId) {
      whereClause.employeeId = user.employeeId
    }
    
    const expiringDocs = await prisma.document.findMany({
      where: whereClause,
      include: { employee: true },
      orderBy: { expiryDate: 'asc' }
    })
    
    res.json(expiringDocs)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
