import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { currentTenantId } from '../lib/tenantContext';
import { getStorage } from '../lib/storage';

// Contract and policy templates. Placeholders are filled from the employee
// record and the result is filed as an ordinary Document, so it downloads,
// exports and deletes like everything else in the file.

const router = Router();

// Only fields that are safe to drop into a letter — no bank details, no NI
// number, nothing that would leak into a document by accident.
const MERGE_FIELDS = [
  'firstName',
  'lastName',
  'jobTitle',
  'department',
  'employeeType',
  'email',
] as const;

const DATE_MERGE_FIELDS = ['startDate', 'endDate', 'probationEndDate'] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderTemplate(body: string, employee: any, extra: Record<string, string> = {}) {
  const values: Record<string, string> = { ...extra };
  for (const field of MERGE_FIELDS) values[field] = employee[field] ?? '';
  for (const field of DATE_MERGE_FIELDS) {
    values[field] = employee[field]
      ? new Date(employee[field]).toLocaleDateString('en-GB')
      : '';
  }
  values.fullName = `${employee.firstName} ${employee.lastName}`;
  values.today = new Date().toLocaleDateString('en-GB');

  // An unknown placeholder is left visible rather than blanked, so a broken
  // template is obvious in the document instead of quietly losing a clause.
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    key in values ? escapeHtml(String(values[key])) : match,
  );
}

router.get(
  '/',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  async (_req, res) => {
    const templates = await prisma.documentTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(templates);
  },
);

router.post('/', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const { name, body, documentType, requiresAcknowledgement } = req.body ?? {};
  if (!name || !body)
    return res.status(400).json({ error: 'name and body are required' });

  const template = await prisma.documentTemplate.create({
    data: {
      tenantId: currentTenantId(),
      name: String(name).trim(),
      body: String(body),
      documentType: documentType ? String(documentType) : 'CONTRACT',
      requiresAcknowledgement: requiresAcknowledgement !== false,
    },
  });
  await auditLog(req, 'CREATE', 'DocumentTemplate', template.id, {
    name: template.name,
  });
  res.json(template);
});

router.put('/:id', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const id = Number(req.params.id);
  const data: any = {};
  if (req.body?.name !== undefined) {
    if (!String(req.body.name).trim())
      return res.status(400).json({ error: 'name cannot be empty' });
    data.name = String(req.body.name).trim();
  }
  if (req.body?.body !== undefined) data.body = String(req.body.body);
  if (req.body?.documentType !== undefined)
    data.documentType = String(req.body.documentType);
  if (req.body?.requiresAcknowledgement !== undefined)
    data.requiresAcknowledgement = Boolean(req.body.requiresAcknowledgement);
  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  const updated = await prisma.documentTemplate.updateMany({ where: { id }, data });
  if (updated.count === 0)
    return res.status(404).json({ error: 'Template not found' });
  await auditLog(req, 'UPDATE', 'DocumentTemplate', id, {
    fields: Object.keys(data),
  });
  res.json(await prisma.documentTemplate.findFirst({ where: { id } }));
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req: any, res) => {
  const id = Number(req.params.id);
  const deleted = await prisma.documentTemplate.deleteMany({ where: { id } });
  if (deleted.count === 0)
    return res.status(404).json({ error: 'Template not found' });
  await auditLog(req, 'DELETE', 'DocumentTemplate', id);
  res.json({ success: true });
});

// Render for one employee and file the result as a document.
router.post(
  '/:id/generate',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR'),
  async (req: any, res) => {
    const id = Number(req.params.id);
    const employeeId = Number(req.body?.employeeId);
    if (!employeeId)
      return res.status(400).json({ error: 'employeeId is required' });

    const [template, employee] = await Promise.all([
      prisma.documentTemplate.findFirst({ where: { id } }),
      prisma.employee.findFirst({ where: { id: employeeId } }),
    ]);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const html = renderTemplate(template.body, employee);
    const key = `tenants/${currentTenantId()}/generated/${employeeId}-${Date.now()}.html`;
    await getStorage().put(key, Buffer.from(html, 'utf8'), 'text/html');

    const document = await prisma.document.create({
      data: {
        tenantId: currentTenantId(),
        employeeId,
        name: `${template.name} — ${employee.firstName} ${employee.lastName}`,
        path: key,
        type: template.documentType,
        requiresAcknowledgement: template.requiresAcknowledgement,
      },
    });
    await auditLog(req, 'CREATE', 'Document', document.id, {
      employeeId,
      generatedFrom: template.id,
    });
    res.json(document);
  },
);

export default router;
