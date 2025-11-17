import { Router } from 'express'
import prisma from '../prismaClient'
import { requireAuth } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

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

router.get('/', requireAuth, async (req, res) => {
  const docs = await prisma.document.findMany({ include: { employee: true } })
  res.json(docs)
})

// upload file and create metadata record (local storage only)
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file as Express.Multer.File | undefined
  const { employeeId, name } = req.body
  if (!file || !employeeId || !name) return res.status(400).json({ error: 'missing fields or file' })
  // Verify employee exists before writing DB record
  const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } })
  if (!emp) return res.status(400).json({ error: 'employee not found' })
  try {
    const pathToSave = `/uploads/${file.filename}`
    const d = await prisma.document.create({ data: { employeeId: Number(employeeId), name, path: pathToSave } })
    res.json(d)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
