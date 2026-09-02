import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { sendEmail, EmailTemplates } from '../lib/emailService';
import { canReviewLeaveAndTime, normalizeRole, ROLES } from '../lib/roles';
import { currentTenantId } from '../lib/tenantContext';

const router = Router();

router.get('/', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res.json([]);
    }
    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: user.employeeId },
      include: { employee: true },
    });
    return res.json(leaves);
  }

  if (!canReviewLeaveAndTime(role))
    return res.status(403).json({ error: 'Unauthorized' });

  const leaves = await prisma.leaveRequest.findMany({
    include: { employee: true },
  });
  res.json(leaves);
});

router.post('/', requireAuth, async (req: any, res) => {
  const user = req.user;
  const role = normalizeRole(user.role);
  let { employeeId, type, startDate, endDate, reason } = req.body;

  if (role === ROLES.EMPLOYEE) {
    if (!user.employeeId) {
      return res
        .status(403)
        .json({ error: 'User account is not linked to an employee record' });
    }
    employeeId = user.employeeId;
  } else if (!canReviewLeaveAndTime(role)) {
    return res.status(403).json({ error: 'Unauthorized' });
  } else if (!employeeId && user.employeeId) {
    employeeId = user.employeeId;
  }

  if (!employeeId || !type || !startDate || !endDate)
    return res.status(400).json({ error: 'missing fields' });
  if (new Date(endDate) < new Date(startDate))
    return res
      .status(400)
      .json({ error: 'End date cannot be before start date' });
  try {
    const lr = await prisma.leaveRequest.create({
      data: {
        tenantId: currentTenantId(),
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      },
      include: { employee: true },
    });
    await auditLog(req, 'CREATE', 'LeaveRequest', lr.id, {
      employeeId,
      type,
      startDate,
      endDate,
    });

    // Send notification to operational approvers
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'] } },
      });

      for (const admin of admins) {
        if (admin.email) {
          const template = EmailTemplates.leaveRequestPending(
            `${lr.employee.firstName} ${lr.employee.lastName}`,
            lr.type,
            lr.startDate.toISOString().split('T')[0],
            lr.endDate.toISOString().split('T')[0],
            lr.id,
          );
          await sendEmail({
            to: admin.email,
            subject: template.subject,
            html: template.html,
          });
        }
      }
    } catch (emailError) {
      console.error('Failed to send leave request notification:', emailError);
      // Don't fail the request if email fails
    }

    res.json(lr);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Approve/reject share one path: only a PENDING request can be decided (a
// second decision on the same request is a 409, not a silent overwrite), and
// nobody decides their own leave whatever their role.
async function decideLeave(
  req: any,
  res: any,
  status: 'APPROVED' | 'REJECTED',
) {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.leaveRequest.findFirst({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: 'Leave request not found' });
    if (req.user.employeeId && existing.employeeId === req.user.employeeId)
      return res
        .status(403)
        .json({ error: 'You cannot decide your own leave request' });
    if (existing.status !== 'PENDING')
      return res
        .status(409)
        .json({
          error: `Leave request already ${existing.status.toLowerCase()}`,
        });

    const updated = await prisma.leaveRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status },
    });
    if (updated.count === 0)
      return res.status(409).json({ error: 'Leave request already decided' });
    const lr = await prisma.leaveRequest.findFirst({
      where: { id },
      include: { employee: true },
    });
    if (!lr) return res.status(404).json({ error: 'Leave request not found' });

    await auditLog(
      req,
      status === 'APPROVED' ? 'APPROVE' : 'REJECT',
      'LeaveRequest',
      id,
      {
        employeeId: lr.employeeId,
        reason: req.body?.reason,
      },
    );

    // Send notification to employee
    try {
      if (lr.employee.email) {
        const name = `${lr.employee.firstName} ${lr.employee.lastName}`;
        const start = lr.startDate.toISOString().split('T')[0];
        const end = lr.endDate.toISOString().split('T')[0];
        const template =
          status === 'APPROVED'
            ? EmailTemplates.leaveRequestApproved(name, lr.type, start, end)
            : EmailTemplates.leaveRequestRejected(
                name,
                lr.type,
                start,
                end,
                req.body?.reason || 'No reason provided',
              );
        await sendEmail({
          to: lr.employee.email,
          subject: template.subject,
          html: template.html,
        });
      }
    } catch (emailError) {
      console.error('Failed to send leave decision notification:', emailError);
    }

    res.json(lr);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

router.put(
  '/:id/approve',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  (req, res) => decideLeave(req, res, 'APPROVED'),
);

router.put(
  '/:id/reject',
  requireAuth,
  requireRole('ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT'),
  (req, res) => decideLeave(req, res, 'REJECTED'),
);

export default router;
