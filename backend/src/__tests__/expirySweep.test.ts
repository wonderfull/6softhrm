import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  collectTenantExpiringItems,
  sweepTenantExpiries,
} from '../lib/expirySweep';
import * as emailService from '../lib/emailService';
import { platformPrisma } from '../prismaClient';
import { runWithTenant } from '../lib/tenantContext';

// Beyond visas and contracts, the sweep watches passports, DBS rechecks,
// right-to-work rechecks, the sponsor licence, action plans and CoS start-by
// dates — and mirrors every alert into the admins' in-app inbox, once.

const NOW = new Date('2026-09-30T09:00:00.000Z');
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
const SLUG = 'expiry-kinds';

describe('expiry sweep kinds', () => {
  let tenantId: number;
  let adminId: number;
  const sent: { to: string; subject: string }[] = [];

  async function dropTenant() {
    const existing = await platformPrisma.tenant.findUnique({ where: { slug: SLUG } });
    if (!existing) return;
    await platformPrisma.sponsorship.deleteMany({ where: { tenantId: existing.id } });
    await platformPrisma.tenant.delete({ where: { id: existing.id } });
  }

  beforeAll(async () => {
    await dropTenant();
    const tenant = await platformPrisma.tenant.create({
      data: { slug: SLUG, name: SLUG, status: 'ACTIVE' },
    });
    tenantId = tenant.id;
    const admin = await platformPrisma.user.create({
      data: { tenantId, email: `admin@${SLUG}.test`, password: 'x', role: 'ADMIN' },
    });
    adminId = admin.id;
    await platformPrisma.user.create({
      data: { tenantId, email: `staff@${SLUG}.test`, password: 'x', role: 'EMPLOYEE' },
    });

    const passport = await platformPrisma.employee.create({
      data: {
        tenantId,
        firstName: 'Passport',
        lastName: 'Holder',
        email: `passport@${SLUG}.test`,
        passportExpiryDate: daysFromNow(30),
        dbsRecheckDate: daysFromNow(10),
      },
    });
    await platformPrisma.rightToWorkCheck.create({
      data: {
        tenantId,
        employeeId: passport.id,
        checkDate: daysFromNow(-400),
        method: 'MANUAL',
        timeLimited: true,
        recheckDue: daysFromNow(-2),
      },
    });
    // A newer check supersedes the overdue one for a second employee.
    const rechecked = await platformPrisma.employee.create({
      data: {
        tenantId,
        firstName: 'Re',
        lastName: 'Checked',
        email: `rechecked@${SLUG}.test`,
      },
    });
    await platformPrisma.rightToWorkCheck.createMany({
      data: [
        {
          tenantId,
          employeeId: rechecked.id,
          checkDate: daysFromNow(-400),
          method: 'MANUAL',
          timeLimited: true,
          recheckDue: daysFromNow(-5),
        },
        {
          tenantId,
          employeeId: rechecked.id,
          checkDate: daysFromNow(-1),
          method: 'HOME_OFFICE_ONLINE',
          timeLimited: true,
          recheckDue: daysFromNow(300),
        },
      ],
    });
    // Anonymised records are out of scope however overdue they are.
    await platformPrisma.employee.create({
      data: {
        tenantId,
        firstName: 'Former',
        lastName: 'Employee',
        email: `erased@${SLUG}.test`,
        passportExpiryDate: daysFromNow(-10),
        anonymisedAt: daysFromNow(-100),
      },
    });
    // CoS assigned, worker not yet started, start-by date approaching.
    const pending = await platformPrisma.employee.create({
      data: {
        tenantId,
        firstName: 'Not',
        lastName: 'Started',
        email: `pending@${SLUG}.test`,
      },
    });
    await platformPrisma.sponsorship.create({
      data: {
        tenantId,
        employeeId: pending.id,
        visaType: 'Skilled Worker',
        startDate: daysFromNow(20),
        endDate: daysFromNow(900),
        cosType: 'DEFINED',
        cosAssignedDate: daysFromNow(-80),
        cosStartBy: daysFromNow(7),
        active: true,
      },
    });
    await platformPrisma.sponsorLicence.create({
      data: {
        tenantId,
        licenceNumber: 'LIC1',
        rating: 'B',
        expiryDate: daysFromNow(60),
        actionPlanDueAt: daysFromNow(5),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sent.length = 0;
  });

  afterAll(dropTenant);

  const captureMail = () =>
    jest.spyOn(emailService, 'sendEmail').mockImplementation(async (options) => {
      sent.push({ to: String(options.to), subject: options.subject });
      return true;
    });

  it('lists every kind of upcoming date, newest RTW check per person, skipping anonymised rows', async () => {
    const items = await runWithTenant({ tenantId }, () =>
      collectTenantExpiringItems(NOW, 90),
    );
    const kinds = items.map((i) => `${i.kind}:${i.daysRemaining}`);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'RTW_RECHECK:-2',
        'ACTION_PLAN:5',
        'COS_START_BY:7',
        'DBS_RECHECK:10',
        'PASSPORT:30',
        'LICENCE:60',
      ]),
    );
    expect(items.filter((i) => i.kind === 'RTW_RECHECK')).toHaveLength(1);
    expect(items.some((i) => i.employeeName?.includes('Former'))).toBe(false);
    // Sorted soonest first.
    expect(items[0].kind).toBe('RTW_RECHECK');
  });

  it('emails and mirrors only the items on a reminder threshold, without duplicate unread rows', async () => {
    captureMail();
    const first = await runWithTenant({ tenantId }, () => sweepTenantExpiries(NOW));
    expect(first.otherNotifications).toBeGreaterThan(0);
    expect(first.visaNotifications).toBe(0);

    const subjects = sent.map((m) => m.subject);
    expect(subjects.some((s) => s.includes('Right-to-work recheck'))).toBe(true);
    expect(subjects.some((s) => s.includes('Passport'))).toBe(true);
    expect(subjects.some((s) => s.includes('Sponsor licence'))).toBe(true);
    // 10 and 5 days out are not thresholds; 7 days is not either.
    expect(subjects.some((s) => s.includes('DBS'))).toBe(false);
    expect(subjects.some((s) => s.includes('Action plan'))).toBe(false);
    // The worker is copied on their own RTW/passport alerts; admins get all.
    expect(sent.some((m) => m.to === `passport@${SLUG}.test`)).toBe(true);
    expect(sent.some((m) => m.to === `staff@${SLUG}.test`)).toBe(false);

    const inbox = await platformPrisma.notification.findMany({
      where: { tenantId, userId: adminId },
    });
    expect(inbox).toHaveLength(first.inAppNotifications);
    expect(inbox.map((n) => n.type)).toEqual(inbox.map(() => 'EXPIRY'));
    expect(inbox.some((n) => n.link === '/settings')).toBe(true);
    expect(
      await platformPrisma.notification.count({ where: { tenantId, userId: { not: adminId } } }),
    ).toBe(0);

    const second = await runWithTenant({ tenantId }, () => sweepTenantExpiries(NOW));
    expect(second.inAppNotifications).toBe(0);
    expect(await platformPrisma.notification.count({ where: { tenantId } })).toBe(inbox.length);

    const audit = await platformPrisma.auditLog.findFirst({
      where: { tenantId, action: 'CRON_EXPIRY_CHECK' },
      orderBy: { id: 'desc' },
    });
    expect(JSON.parse(audit!.details!).inAppNotifications).toBe(0);
  });
});
