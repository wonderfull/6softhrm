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

const upload = multer({ storage })

router.get('/', requireAuth, async (req, res) => {
  const docs = await prisma.document.findMany({ include: { employee: true } })
  res.json(docs)
})

// return whether current user has connected Google Drive
router.get('/drive/status', requireAuth, async (req, res) => {
  const user = (req as any).user
  const acct = await prisma.googleAccount.findUnique({ where: { userId: user.id } })
  res.json({ connected: !!acct })
})

// upload file and create metadata record
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file as Express.Multer.File | undefined
  const { employeeId, name } = req.body
  if (!file || !employeeId || !name) return res.status(400).json({ error: 'missing fields or file' })
  try {
    let pathToSave = `/uploads/${file.filename}`

    // If Google Drive integration is enabled, attempt upload and store Drive link instead
    if (process.env.GOOGLE_DRIVE_ENABLED === 'true') {
      try {
        const user = (req as any).user
        const driveRes = await (await import('../lib/googleDrive')).uploadFileToDrive(user.id, file.path, file.originalname)
        // prefer webViewLink if available
        if (driveRes.webViewLink) pathToSave = driveRes.webViewLink
        else if (driveRes.id) pathToSave = `drive://${driveRes.id}`
        // remove local file after successful upload
        try { fs.unlinkSync(file.path) } catch (e) { /* ignore */ }
      } catch (e) {
        // if Drive upload fails, fall back to local path but log error
        console.error('Drive upload failed', e)
      }
    }

    const d = await prisma.document.create({ data: { employeeId: Number(employeeId), name, path: pathToSave } })
    res.json(d)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
