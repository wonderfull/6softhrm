import express from 'express';
import request from './helpers/http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRouter from '../routes/auth';
import employeesRouter from '../routes/employees';
import documentsRouter from '../routes/documents';
import notificationsRouter from '../routes/notifications';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';
import { platformPrisma } from '../prismaClient';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/notifications', notificationsRouter);

const PREFIX = 'self-service';
const PASSWORD = 'original-pass-1';

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000a49444154789c6360000002000100' +
    '05fe02fea7b5f2b40000000049454e44ae426082',
  'hex',
);

let employeeId: number;
let colleagueId: number;
let userId: number;
let passwordUserId: number;
let userToken: string;
let adminToken: string;
let colleagueToken: string;
let passwordToken: string;

async function cleanup() {
  const stale = await prisma.employee.findMany({
    where: { email: { contains: `@${PREFIX}.test` } },
    select: { id: true },
  });
  const ids = stale.map((e: { id: number }) => e.id);
  const users = await prisma.user.findMany({
    where: { email: { contains: `@${PREFIX}.test` } },
    select: { id: true },
  });
  const userIds = users.map((u: { id: number }) => u.id);
  if (userIds.length) {
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (ids.length) {
    await prisma.document.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  await cleanup();

  const employee = await prisma.employee.create({
    data: {
      firstName: 'Sam',
      lastName: 'Self',
      email: `sam@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
      startDate: new Date('2024-01-01'),
    },
  });
  employeeId = employee.id;

  const colleague = await prisma.employee.create({
    data: {
      firstName: 'Cal',
      lastName: 'Colleague',
      email: `cal@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
    },
  });
  colleagueId = colleague.id;

  const user = await prisma.user.create({
    data: {
      email: `sam@${PREFIX}.test`,
      name: 'Sam Self',
      password: await bcrypt.hash(PASSWORD, 10),
      role: 'EMPLOYEE',
      employeeId,
    },
  });
  userId = user.id;

  await prisma.document.create({
    data: {
      employeeId,
      name: 'March payslip',
      type: 'PAYSLIP',
      path: `tenant-${testTenantId()}/${PREFIX}/payslip.pdf`,
    },
  });
  await prisma.document.create({
    data: {
      employeeId,
      name: 'Contract',
      type: 'CONTRACT',
      path: `tenant-${testTenantId()}/${PREFIX}/contract.pdf`,
    },
  });

  await prisma.notification.create({
    data: {
      tenantId: testTenantId(),
      userId,
      type: 'LEAVE',
      title: 'Leave approved',
      link: '/leave',
    },
  });
  await prisma.notification.create({
    data: {
      tenantId: testTenantId(),
      userId,
      type: 'EXPIRY',
      title: 'Passport expiring',
      readAt: new Date(),
    },
  });

  const colleagueUser = await prisma.user.create({
    data: {
      email: `cal@${PREFIX}.test`,
      name: 'Cal Colleague',
      password: await bcrypt.hash(PASSWORD, 10),
      role: 'EMPLOYEE',
      employeeId: colleagueId,
    },
  });
  const adminUser = await prisma.user.create({
    data: {
      email: `owner@${PREFIX}.test`,
      name: 'Olive Owner',
      password: await bcrypt.hash(PASSWORD, 10),
      role: 'ADMIN',
    },
  });
  // Changing a password bumps tokenVersion and kills every other session for
  // that account, so that test gets its own user rather than logging the rest
  // of the suite out halfway through.
  const passwordUser = await prisma.user.create({
    data: {
      email: `rotate@${PREFIX}.test`,
      name: 'Rory Rotate',
      password: await bcrypt.hash(PASSWORD, 10),
      role: 'EMPLOYEE',
    },
  });
  passwordUserId = passwordUser.id;

  userToken = signTestToken({
    id: userId,
    email: `sam@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId,
  });
  colleagueToken = signTestToken({
    id: colleagueUser.id,
    email: `cal@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: colleagueId,
  });
  adminToken = signTestToken({
    id: adminUser.id,
    email: `owner@${PREFIX}.test`,
    role: 'ADMIN',
  });
  passwordToken = signTestToken({
    id: passwordUserId,
    email: `rotate@${PREFIX}.test`,
    role: 'EMPLOYEE',
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('GET/PUT /auth/me', () => {
  it('returns the caller\'s own account with the tenant on it', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: userId,
      email: `sam@${PREFIX}.test`,
      role: 'EMPLOYEE',
      employeeId,
      totpEnabled: false,
    });
    expect(res.body.tenant.id).toBe(testTenantId());
    expect(res.body.password).toBeUndefined();
  });

  it('renames the account and refuses a blank name', async () => {
    const blank = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '   ' });
    expect(blank.status).toBe(400);

    const named = await request(app)
      .put('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Samantha Self' });
    expect(named.status).toBe(200);
    expect(named.body.name).toBe('Samantha Self');
  });
});

describe('POST /auth/change-password', () => {
  it('refuses a wrong current password and a short new one', async () => {
    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${passwordToken}`)
      .send({ currentPassword: 'not-it', newPassword: 'a-long-enough-one' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toMatch(/Current password is incorrect/);

    const short = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${passwordToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error).toMatch(/at least 8 characters/);
  });

  it('changes it, invalidates every other session and hands back a fresh token', async () => {
    const before = await prisma.user.findFirst({ where: { id: passwordUserId } });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${passwordToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'a-brand-new-pass' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const after = await prisma.user.findFirst({ where: { id: passwordUserId } });
    expect(after.tokenVersion).toBe((before.tokenVersion ?? 0) + 1);
    expect(await bcrypt.compare('a-brand-new-pass', after.password)).toBe(true);

    // The replacement token carries the new version, so it still works while
    // anything issued before the change does not.
    const payload: any = jwt.verify(
      res.body.token,
      process.env.JWT_SECRET || 'test-secret-key',
    );
    expect(payload.tokenVersion).toBe(after.tokenVersion);
    expect(payload.name).toBe('Rory Rotate');

    const audit = await platformPrisma.auditLog.findFirst({
      where: { action: 'PASSWORD_CHANGED', entityId: passwordUserId },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).toBeTruthy();
  });
});

describe('profile photo', () => {
  it('refuses a colleague, accepts the owner, and serves it back', async () => {
    const refused = await request(app)
      .post(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${colleagueToken}`)
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(refused.status).toBe(403);

    const uploaded = await request(app)
      .post(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.photoPath).toContain(`tenants/${testTenantId()}/photos/`);
    expect(uploaded.body.url).toBeTruthy();

    const fetched = await request(app)
      .get(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.url).toBeTruthy();
  });

  it('refuses a type that is not an image', async () => {
    const res = await request(app)
      .post(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
  });

  it('lets the owner remove it, and an admin manage anyone\'s', async () => {
    const removed = await request(app)
      .delete(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(removed.status).toBe(200);

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId },
    });
    expect(employee.photoPath).toBeNull();

    const byAdmin = await request(app)
      .post(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', PNG, { filename: 'hr.png', contentType: 'image/png' });
    expect(byAdmin.status).toBe(200);

    await request(app)
      .delete(`/api/employees/${employeeId}/photo`)
      .set('Authorization', `Bearer ${adminToken}`);
  });
});

describe('the notification inbox', () => {
  it('returns own rows only, newest first, with an unread filter', async () => {
    const all = await request(app)
      .get('/api/notifications/inbox')
      .set('Authorization', `Bearer ${userToken}`);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);

    const unread = await request(app)
      .get('/api/notifications/inbox?unread=1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(unread.body).toHaveLength(1);
    expect(unread.body[0].title).toBe('Leave approved');

    // The colleague's token is a different user id, so it sees nothing.
    const colleague = await request(app)
      .get('/api/notifications/inbox')
      .set('Authorization', `Bearer ${colleagueToken}`);
    expect(colleague.body).toHaveLength(0);
  });

  it('marks one read, refuses somebody else\'s, then marks the rest read', async () => {
    const unread = await request(app)
      .get('/api/notifications/inbox?unread=1')
      .set('Authorization', `Bearer ${userToken}`);
    const id = unread.body[0].id;

    const theirs = await request(app)
      .put(`/api/notifications/inbox/${id}/read`)
      .set('Authorization', `Bearer ${colleagueToken}`);
    expect(theirs.status).toBe(404);

    const mine = await request(app)
      .put(`/api/notifications/inbox/${id}/read`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.readAt).toBeTruthy();

    const readAll = await request(app)
      .put('/api/notifications/inbox/read-all')
      .set('Authorization', `Bearer ${userToken}`);
    expect(readAll.status).toBe(200);

    const left = await request(app)
      .get('/api/notifications/inbox?unread=1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(left.body).toHaveLength(0);
  });
});

describe('documents and the self profile', () => {
  it('filters payslips out of the rest of the file', async () => {
    const all = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${userToken}`);
    expect(all.body).toHaveLength(2);

    const payslips = await request(app)
      .get('/api/documents?type=PAYSLIP')
      .set('Authorization', `Bearer ${userToken}`);
    expect(payslips.body).toHaveLength(1);
    expect(payslips.body[0].name).toBe('March payslip');

    const asAdmin = await request(app)
      .get(`/api/documents?type=PAYSLIP&employeeId=${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(asAdmin.body).toHaveLength(1);
  });

  it('shows an employee their own linked login instead of claiming they have none', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].user).toMatchObject({
      id: userId,
      email: `sam@${PREFIX}.test`,
      role: 'EMPLOYEE',
    });
    expect(res.body[0].user.password).toBeUndefined();
  });
});
