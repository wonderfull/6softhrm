import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import crypto from 'crypto'
import {
  canDeleteDocuments,
  canOperateDocuments,
  normalizeRole,
  ROLES,
} from '../lib/roles'

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

function canAccessDocument(user: any, employeeId: number) {
  if (!user) return false
  const role = normalizeRole(user.role)
  if (canOperateDocuments(role)) return true
  return role === ROLES.EMPLOYEE && user.employeeId === employeeId
}

function getAbsoluteFilePath(documentPath: string) {
  return path.join(process.cwd(), documentPath.replace(/^\//, ''))
}

async function createSharedDocumentRecord(data: {
  employeeId: number
  name: string
  path: string
  type?: string
  expiryDate?: string
  shareOnCreate?: boolean
}) {
  const documentData: any = {
    employeeId: data.employeeId,
    name: data.name,
    path: data.path
  }

  if (data.type) documentData.type = data.type
  if (data.expiryDate) documentData.expiryDate = new Date(data.expiryDate)
  if (data.shareOnCreate) {
    documentData.shareToken = crypto.randomBytes(24).toString('hex')
    documentData.sharedAt = new Date()
  }

  return prisma.document.create({ data: documentData })
}

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user
  const role = normalizeRole(user.role)

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res.json([])
    }
    const docs = await prisma.document.findMany({
      where: { employeeId: user.employeeId },
      include: { employee: true }
    })
    return res.json(docs)
  }

  if (!canOperateDocuments(role)) return res.status(403).json({ error: 'Unauthorized' })

  const docs = await prisma.document.findMany({ include: { employee: true } })
  res.json(docs)
})

router.get('/share/:token', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({ where: { shareToken: req.params.token } })
    if (!document) return res.status(404).json({ error: 'Shared document not found' })

    const filePath = getAbsoluteFilePath(document.path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.download(filePath, document.name)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/:id/file', requireAuth, async (req: any, res) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: Number(req.params.id) } })
    if (!document) return res.status(404).json({ error: 'Document not found' })

    if (!canAccessDocument(req.user, document.employeeId)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const filePath = getAbsoluteFilePath(document.path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.download(filePath, document.name)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// upload file and create metadata record (local storage only)
router.post('/upload', requireAuth, requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'), upload.single('file'), async (req, res) => {
  const file = req.file as Express.Multer.File | undefined
  const { employeeId, name, type, expiryDate } = req.body
  if (!file || !employeeId || !name) return res.status(400).json({ error: 'missing fields or file' })
  // Verify employee exists before writing DB record
  const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } })
  if (!emp) return res.status(400).json({ error: 'employee not found' })
  try {
    const pathToSave = `/uploads/${file.filename}`
    const d = await createSharedDocumentRecord({
      employeeId: Number(employeeId),
      name,
      path: pathToSave,
      type,
      expiryDate,
      shareOnCreate: req.body.shareOnCreate === 'true'
    })
    res.json(d)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.post('/upload-payslips', requireAuth, upload.array('files', 20), async (req: any, res) => {
  const files = (req.files || []) as Express.Multer.File[]
  const { employeeId } = req.body

  if (!canOperateDocuments(req.user?.role)) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  if (!employeeId || files.length === 0) {
    return res.status(400).json({ error: 'employeeId and at least one file are required' })
  }

  const employee = await prisma.employee.findUnique({ where: { id: Number(employeeId) } })
  if (!employee) return res.status(400).json({ error: 'employee not found' })

  try {
    const documents = await Promise.all(files.map((file) => createSharedDocumentRecord({
      employeeId: employee.id,
      name: file.originalname.replace(/\.[^.]+$/, ''),
      path: `/uploads/${file.filename}`,
      type: 'PAYSLIP',
      shareOnCreate: true
    })))

    const shareBaseUrl = `${req.protocol}://${req.get('host')}/api/documents/share`
    res.json({
      employeeId: employee.id,
      uploadedCount: documents.length,
      documents: documents.map((document) => ({
        ...document,
        shareUrl: document.shareToken ? `${shareBaseUrl}/${document.shareToken}` : null
      }))
    })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.post('/:id/share-link', requireAuth, requireRole('ADMIN', 'DIRECTOR'), async (req: any, res) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: Number(req.params.id) } })
    if (!document) return res.status(404).json({ error: 'Document not found' })

    if (!canAccessDocument(req.user, document.employeeId)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        shareToken: document.shareToken || crypto.randomBytes(24).toString('hex'),
        sharedAt: document.sharedAt || new Date()
      }
    })

    res.json({
      id: updated.id,
      shareToken: updated.shareToken,
      shareUrl: `${req.protocol}://${req.get('host')}/api/documents/share/${updated.shareToken}`
    })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const doc = await prisma.document.findUnique({ where: { id: parseInt(id) } })
    if (!doc) return res.status(404).json({ error: 'Document not found' })

    const user = (req as any).user
    if (!canDeleteDocuments(user.role)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    // Delete the physical file
    const filePath = getAbsoluteFilePath(doc.path)
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
    const user = (req as any).user
    if (!canAccessDocument(user, parseInt(employeeId))) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

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
      const filePath = getAbsoluteFilePath(doc.path)
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
    const role = normalizeRole(user.role)
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

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId) {
        return res.json([])
      }
      whereClause.employeeId = user.employeeId
    } else if (!canOperateDocuments(role)) {
      return res.status(403).json({ error: 'Unauthorized' })
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
