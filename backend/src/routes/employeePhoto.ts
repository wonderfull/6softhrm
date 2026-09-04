import { Router } from 'express';
import multer from 'multer';
import prisma from '../prismaClient';
import { currentTenantId } from '../lib/tenantContext';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { findReadableEmployee } from '../lib/employeeAccess';
import { getStorage } from '../lib/storage';
import { ROLES, canManageEmployeeRecords, normalizeRole } from '../lib/roles';

// Mounted at /api/employees/:id/photo. A profile picture is the one piece of
// their own record an employee can change without asking anyone.
const router = Router({ mergeParams: true });

const MAX_SIZE = 2 * 1024 * 1024; // 2MB — this is an avatar, not a document
const ALLOWED = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.has(file.mimetype)),
});

/** Own record, or anyone's for the roles that maintain employee records. */
function canEditPhoto(user: any, employeeId: number) {
  const role = normalizeRole(user?.role);
  if (canManageEmployeeRecords(role)) return true;
  return role === ROLES.EMPLOYEE && Number(user?.employeeId) === employeeId;
}

async function photoUrl(path: string) {
  const store = getStorage();
  const signed = await store.getSignedUrl(path, 'photo', 'inline');
  if (signed) return signed;

  // The local driver has nowhere to sign against, and an <img> cannot send an
  // Authorization header, so the bytes travel inline instead.
  const stream = await store.getStream(path);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const mime = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${Buffer.concat(chunks).toString('base64')}`;
}

router.get('/', requireAuth, async (req: any, res) => {
  const employeeId = Number(req.params.id);
  const employee = await findReadableEmployee(req, res, employeeId);
  if (!employee) return;
  if (!employee.photoPath)
    return res.status(404).json({ error: 'No photo on file' });

  try {
    res.json({ photoPath: employee.photoPath, url: await photoUrl(employee.photoPath) });
  } catch (e: any) {
    console.error('Error reading employee photo:', e);
    res.status(404).json({ error: 'No photo on file' });
  }
});

// The bytes themselves, for an <img>. A private bucket can hand out a signed
// URL; the local driver has to stream, which is why this is not a static path.
router.get('/raw', requireAuth, async (req: any, res) => {
  const employeeId = Number(req.params.id);
  const employee = await findReadableEmployee(req, res, employeeId);
  if (!employee) return;
  if (!employee.photoPath)
    return res.status(404).json({ error: 'No photo on file' });

  const store = getStorage();
  try {
    const signed = await store.getSignedUrl(
      employee.photoPath,
      'photo',
      'inline',
    );
    if (signed) return res.redirect(signed);

    res.setHeader(
      'Content-Type',
      employee.photoPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    (await store.getStream(employee.photoPath)).pipe(res);
  } catch (e: any) {
    console.error('Error streaming employee photo:', e);
    res.status(404).json({ error: 'No photo on file' });
  }
});

router.post('/', requireAuth, upload.single('file'), async (req: any, res) => {
  const employeeId = Number(req.params.id);
  if (!canEditPhoto(req.user, employeeId))
    return res.status(403).json({ error: 'Unauthorized' });

  if (!req.file)
    return res
      .status(400)
      .json({ error: 'A PNG or JPEG image of 2MB or less is required' });

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    select: { id: true, photoPath: true },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  const store = getStorage();
  const extension = ALLOWED.get(req.file.mimetype);
  const key = `tenants/${currentTenantId()}/photos/${employeeId}-${Date.now()}.${extension}`;

  try {
    await store.put(key, req.file.buffer, req.file.mimetype);
    // Replace rather than accumulate — nobody wants their old avatars kept.
    if (employee.photoPath && employee.photoPath !== key) {
      try {
        if (await store.exists(employee.photoPath))
          await store.delete(employee.photoPath);
      } catch (err) {
        console.error('Could not remove the previous photo:', err);
      }
    }
    await prisma.employee.updateMany({
      where: { id: employeeId },
      data: { photoPath: key },
    });
    await auditLog(req, 'UPDATE', 'Employee', employeeId, { photo: 'uploaded' });
    res.json({ photoPath: key, url: await photoUrl(key) });
  } catch (e: any) {
    console.error('Error storing employee photo:', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/', requireAuth, async (req: any, res) => {
  const employeeId = Number(req.params.id);
  if (!canEditPhoto(req.user, employeeId))
    return res.status(403).json({ error: 'Unauthorized' });

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    select: { photoPath: true },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });

  if (employee.photoPath) {
    const store = getStorage();
    try {
      if (await store.exists(employee.photoPath))
        await store.delete(employee.photoPath);
    } catch (err) {
      console.error('Could not delete the photo file:', err);
    }
    await prisma.employee.updateMany({
      where: { id: employeeId },
      data: { photoPath: null },
    });
    await auditLog(req, 'UPDATE', 'Employee', employeeId, { photo: 'removed' });
  }

  res.json({ success: true });
});

export default router;
