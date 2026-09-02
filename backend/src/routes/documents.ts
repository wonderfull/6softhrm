import { Router } from 'express';
import prisma from '../prismaClient';
import { currentTenantId } from '../lib/tenantContext';
import { requireAuth, rebindTenant } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import multer from 'multer';
import path from 'path';
import archiver from 'archiver';
import {
  getStorage,
  buildDocumentKey,
  assertKeyInTenant,
} from '../lib/storage';
import {
  canDeleteDocuments,
  canOperateDocuments,
  normalizeRole,
  ROLES,
} from '../lib/roles';

const router = Router();

// Files are buffered in memory (5MB cap) then handed to the storage driver
// under a tenant-prefixed key — never written to a shared local namespace.
const storage = multer.memoryStorage();

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req: any, file, cb) => {
    const allowed = ALLOWED_TYPES.includes(file.mimetype);
    if (!allowed) {
      // multer drops filtered files without a trace; remember them so the
      // multi-file route can report what was skipped instead of silently
      // succeeding on a smaller batch.
      req.rejectedFiles = req.rejectedFiles || [];
      req.rejectedFiles.push(file.originalname);
    }
    cb(null, allowed);
  },
});

function canAccessDocument(user: any, employeeId: number) {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (canOperateDocuments(role)) return true;
  return role === ROLES.EMPLOYEE && user.employeeId === employeeId;
}

async function createDocumentRecord(data: {
  employeeId: number;
  name: string;
  path: string;
  type?: string;
  expiryDate?: string;
}) {
  const documentData: any = {
    tenantId: currentTenantId(),
    employeeId: data.employeeId,
    name: data.name,
    path: data.path,
  };

  if (data.type) documentData.type = data.type;
  if (data.expiryDate) documentData.expiryDate = new Date(data.expiryDate);

  return prisma.document.create({ data: documentData });
}

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res.json([]);
    }
    const docs = await prisma.document.findMany({
      where: { employeeId: user.employeeId },
      include: { employee: true },
    });
    return res.json(docs);
  }

  if (!canOperateDocuments(role))
    return res.status(403).json({ error: 'Unauthorized' });

  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;
  const docs = await prisma.document.findMany({
    where: employeeId ? { employeeId } : undefined,
    include: { employee: true },
  });
  res.json(docs);
});

router.get('/:id/file', requireAuth, async (req: any, res) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id: Number(req.params.id) },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    if (!canAccessDocument(req.user, document.employeeId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Staff opening someone else's file is the access worth a trail; an
    // employee opening their own document is not.
    if (req.user.employeeId !== document.employeeId) {
      await auditLog(req, 'READ', 'Document', document.id, {
        employeeId: document.employeeId,
        name: document.name,
      });
    }

    assertKeyInTenant(document.path);
    const store = getStorage();
    if (!(await store.exists(document.path))) {
      return res.status(404).json({ error: 'File not found' });
    }

    const disposition =
      req.query.disposition === 'inline'
        ? ('inline' as const)
        : ('attachment' as const);

    // Object storage serves the bytes itself via a short-lived signed URL;
    // the local driver streams through the API.
    const signedUrl = await store.getSignedUrl(
      document.path,
      document.name,
      disposition,
    );
    if (signedUrl) return res.redirect(signedUrl);

    res.type(path.extname(document.path) || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${document.name.replace(/"/g, '')}"`,
    );
    const stream = await store.getStream(document.path);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// upload file and create metadata record (local storage only)
router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  rebindTenant,
  async (req: any, res) => {
    const file = req.file as Express.Multer.File | undefined;
    const { employeeId, name, type, expiryDate } = req.body;
    if (!file || !employeeId || !name)
      return res.status(400).json({ error: 'missing fields or file' });
    // A NaN id would throw inside Prisma below, outside any catch — reject it
    // here instead of hanging the request.
    if (!Number.isInteger(Number(employeeId)))
      return res.status(400).json({ error: 'invalid employeeId' });
    // Elevated roles can upload for anyone; employees only for their own record
    if (!canAccessDocument(req.user, Number(employeeId))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    // Verify employee exists before writing DB record
    const emp = await prisma.employee.findFirst({
      where: { id: Number(employeeId) },
    });
    if (!emp) return res.status(400).json({ error: 'employee not found' });
    try {
      const key = buildDocumentKey(file.originalname);
      await getStorage().put(key, file.buffer, file.mimetype);
      const d = await createDocumentRecord({
        employeeId: Number(employeeId),
        name,
        path: key,
        type,
        expiryDate,
      });
      await auditLog(req, 'UPLOAD', 'Document', d.id, {
        employeeId: d.employeeId,
        name,
        type,
      });
      res.json(d);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },
);

router.post(
  '/upload-payslips',
  requireAuth,
  upload.array('files', 20),
  rebindTenant,
  async (req: any, res) => {
    const files = (req.files || []) as Express.Multer.File[];
    const { employeeId } = req.body;
    // Files the fileFilter dropped for a disallowed type (see above).
    const skipped = ((req.rejectedFiles || []) as string[]).map((name) => ({
      name,
      reason: 'DISALLOWED_TYPE',
    }));

    if (!canOperateDocuments(req.user?.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!employeeId || (files.length === 0 && skipped.length === 0)) {
      return res
        .status(400)
        .json({ error: 'employeeId and at least one file are required' });
    }
    // A NaN id would throw inside Prisma below, outside any catch — reject it
    // here instead of hanging the request.
    if (!Number.isInteger(Number(employeeId))) {
      return res.status(400).json({ error: 'invalid employeeId' });
    }
    if (files.length === 0) {
      return res
        .status(400)
        .json({ error: 'every file was rejected: type not allowed', skipped });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: Number(employeeId) },
    });
    if (!employee) return res.status(400).json({ error: 'employee not found' });

    // Sequential on purpose: one file's storage failure must not abandon the
    // rest of the batch after some rows already exist (the old Promise.all
    // returned 400 while keeping the rows it had created — silent partial
    // success). Object first, then row, so a failure can only orphan an
    // unreferenced file, never leave a row whose download would 404.
    const documents = [];
    const failed: { name: string; error: string }[] = [];
    for (const file of files) {
      try {
        const key = buildDocumentKey(file.originalname);
        await getStorage().put(key, file.buffer, file.mimetype);
        documents.push(
          await createDocumentRecord({
            employeeId: employee.id,
            name: file.originalname.replace(/\.[^.]+$/, ''),
            path: key,
            type: 'PAYSLIP',
          }),
        );
      } catch (e: any) {
        failed.push({ name: file.originalname, error: e.message });
      }
    }

    if (documents.length === 0) {
      return res
        .status(400)
        .json({ error: 'no files could be stored', skipped, failed });
    }

    await auditLog(req, 'UPLOAD_PAYSLIPS', 'Document', undefined, {
      employeeId: employee.id,
      uploadedCount: documents.length,
      documentIds: documents.map((d) => d.id),
      skipped: skipped.length,
      failed: failed.length,
    });

    res.json({
      employeeId: employee.id,
      uploadedCount: documents.length,
      documents,
      skipped,
      failed,
    });
  },
);

router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const doc = await prisma.document.findFirst({
      where: { id: parseInt(id) },
    });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const user = (req as any).user;
    if (!canDeleteDocuments(user.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete the stored file (tolerant of already-missing objects)
    assertKeyInTenant(doc.path);
    await getStorage()
      .delete(doc.path)
      .catch(() => undefined);

    // Delete the database record
    await prisma.document.deleteMany({ where: { id: parseInt(id) } });
    await auditLog(req, 'DELETE', 'Document', doc.id, {
      employeeId: doc.employeeId,
      name: doc.name,
      type: doc.type,
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('Error deleting document:', e);
    res.status(400).json({ error: e.message });
  }
});

// Download all documents for an employee as ZIP
router.get('/download-all/:employeeId', requireAuth, async (req, res) => {
  const { employeeId } = req.params;

  try {
    // A NaN id would throw inside Prisma and surface as a 500 from the catch
    // below — reject it cleanly instead.
    if (!Number.isInteger(Number(employeeId))) {
      return res.status(400).json({ error: 'invalid employee id' });
    }
    const user = (req as any).user;
    if (!canAccessDocument(user, parseInt(employeeId))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: parseInt(employeeId) },
      include: { documents: true },
    });

    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    if (employee.documents.length === 0) {
      return res
        .status(404)
        .json({ error: 'No documents found for this employee' });
    }

    await auditLog(req, 'DOWNLOAD_ALL', 'Document', undefined, {
      employeeId: employee.id,
      count: employee.documents.length,
    });

    // Set response headers
    const filename = `${employee.firstName}_${employee.lastName}_Documents.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Create archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Pipe archive to response
    archive.pipe(res);

    // Add all documents to archive through the storage driver
    const store = getStorage();
    for (const doc of employee.documents) {
      assertKeyInTenant(doc.path);
      if (await store.exists(doc.path)) {
        archive.append(await store.getStream(doc.path), { name: doc.name });
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (e: any) {
    console.error('Error creating ZIP:', e);
    res.status(500).json({ error: e.message });
  }
});

// Google Drive integration status (placeholder — integration not yet wired)
router.get('/drive/status', requireAuth, (_req, res) => {
  res.json({ connected: false, provider: 'google-drive' });
});

// Get expiring documents (for dashboard alerts)
router.get('/expiring', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const whereClause: any = {
      expiryDate: {
        not: null,
        gte: now,
        lte: thirtyDaysFromNow,
      },
    };

    if (role === ROLES.EMPLOYEE) {
      if (!user.employeeId) {
        return res.json([]);
      }
      whereClause.employeeId = user.employeeId;
    } else if (!canOperateDocuments(role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const expiringDocs = await prisma.document.findMany({
      where: whereClause,
      include: { employee: true },
      orderBy: { expiryDate: 'asc' },
    });

    res.json(expiringDocs);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
