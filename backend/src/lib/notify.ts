import prisma from '../prismaClient';
import { currentTenantId } from './tenantContext';
import { sendEmail } from './emailService';

// In-app notifications, written next to (never instead of) email. Runs inside
// a tenant context: the scoped client guarantees recipients belong to the
// tenant doing the notifying.

export type NotifyInput = {
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Also email each recipient. Omit for in-app only. */
  email?: { subject: string; html: string };
  /**
   * Skip a recipient who already has an unread notification with the same
   * type and title — daily sweeps re-raise overdue items and one unread row
   * per item is enough.
   */
  skipIfUnreadDuplicate?: boolean;
};

export async function notifyUsers(
  userIds: number[],
  input: NotifyInput,
): Promise<number> {
  if (userIds.length === 0) return 0;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });

  let created = 0;
  for (const user of users) {
    if (input.skipIfUnreadDuplicate) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: input.type,
          title: input.title,
          readAt: null,
        },
        select: { id: true },
      });
      if (existing) continue;
    }

    await prisma.notification.create({
      data: {
        tenantId: currentTenantId(),
        userId: user.id,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
    created += 1;

    if (input.email && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: input.email.subject,
          html: input.email.html,
        });
      } catch (err) {
        console.error(`[notify] email to ${user.email} failed:`, err);
      }
    }
  }
  return created;
}

export async function notifyRoles(
  roles: string[],
  input: NotifyInput,
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true },
  });
  return notifyUsers(
    users.map((u) => u.id),
    input,
  );
}
