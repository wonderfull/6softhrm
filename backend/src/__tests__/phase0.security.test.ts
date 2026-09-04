import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from './helpers/http';
import adminRouter from '../routes/admin';
import notificationsRouter from '../routes/notifications';
import projectsRouter from '../routes/projects';
import { testPrisma as prisma, signTestToken } from './helpers/tenantTest';

// Role guards added in the gap-closure pass. Before this, any signed-in
// employee could delete projects, trigger the seed/clear endpoints (guarded by
// a fail-open `req.user?.role || 'ADMIN'`), and pull every colleague's visa
// expiry list.

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/projects', projectsRouter);

const bearer = (payload: Record<string, unknown>) =>
  `Bearer ${signTestToken(payload)}`;

describe('Phase 0 role guards', () => {
  let employee: string;
  let roleless: string;
  let assistant: string;
  let director: string;
  let admin: string;
  let projectId: number;

  beforeAll(async () => {
    employee = bearer({ email: 'emp@phase0.test', role: 'EMPLOYEE' });
    roleless = bearer({ email: 'noRole@phase0.test' });
    assistant = bearer({
      email: 'assistant@phase0.test',
      role: 'OFFICE_ASSISTANT',
    });
    director = bearer({ email: 'director@phase0.test', role: 'DIRECTOR' });
    admin = bearer({ email: 'admin@phase0.test', role: 'ADMIN' });
    const project = await prisma.project.create({
      data: { code: 'P0SEC', name: 'Phase 0 guard project' },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { code: { startsWith: 'P0' } } });
    await prisma.auditLog.deleteMany({
      where: { userEmail: { endsWith: '@phase0.test' } },
    });
    await prisma.$disconnect();
  });

  describe('projects', () => {
    it('lets any signed-in user list projects (timesheets need them)', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', employee);
      expect(res.status).toBe(200);
    });

    it.each([
      ['EMPLOYEE', () => employee],
      ['OFFICE_ASSISTANT', () => assistant],
      ['no role', () => roleless],
    ])('refuses project mutations for %s', async (_label, token) => {
      const create = await request(app)
        .post('/api/projects')
        .set('Authorization', token())
        .send({ code: 'P0NOPE', name: 'Should not exist' });
      const update = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', token())
        .send({ name: 'Renamed' });
      const del = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', token());

      expect([create.status, update.status, del.status]).toEqual([
        403, 403, 403,
      ]);
      const survivor = await prisma.project.findFirst({
        where: { id: projectId },
      });
      expect(survivor?.name).toBe('Phase 0 guard project');
    });

    it('lets a director manage projects and audits each change', async () => {
      const create = await request(app)
        .post('/api/projects')
        .set('Authorization', director)
        .send({ code: 'P0DIR', name: 'Director project' });
      expect(create.status).toBe(200);

      const update = await request(app)
        .put(`/api/projects/${create.body.id}`)
        .set('Authorization', director)
        .send({ name: 'Director project v2' });
      expect(update.status).toBe(200);

      const del = await request(app)
        .delete(`/api/projects/${create.body.id}`)
        .set('Authorization', director);
      expect(del.status).toBe(200);

      const actions = await prisma.auditLog.findMany({
        where: { entity: 'Project', entityId: create.body.id },
        select: { action: true },
      });
      expect(actions.map((a: any) => a.action).sort()).toEqual([
        'CREATE',
        'DELETE',
        'UPDATE',
      ]);
    });
  });

  describe('admin', () => {
    it.each([
      ['EMPLOYEE', () => employee],
      ['OFFICE_ASSISTANT', () => assistant],
      ['DIRECTOR', () => director],
      ['no role', () => roleless],
    ])('refuses backup/seed/clear/restore for %s', async (_label, token) => {
      const backup = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', token());
      const seed = await request(app)
        .post('/api/admin/seed-data')
        .set('Authorization', token());
      const clear = await request(app)
        .post('/api/admin/clear-data')
        .set('Authorization', token());
      const restore = await request(app)
        .post('/api/admin/restore')
        .set('Authorization', token())
        .send({ employees: [] });

      expect([backup.status, seed.status, clear.status, restore.status]).toEqual(
        [403, 403, 403, 403],
      );
    });

    it('lets an admin export a backup and audits it', async () => {
      const res = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', admin);
      expect(res.status).toBe(200);
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'BACKUP_EXPORT', userEmail: 'admin@phase0.test' },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe('notifications', () => {
    it('hides the upcoming-expiries list from employees', async () => {
      const res = await request(app)
        .get('/api/notifications/upcoming-expiries')
        .set('Authorization', employee);
      expect(res.status).toBe(403);
    });

    it('shows the upcoming-expiries list to office assistants', async () => {
      const res = await request(app)
        .get('/api/notifications/upcoming-expiries')
        .set('Authorization', assistant);
      expect(res.status).toBe(200);
    });

    it('no longer exposes the ad-hoc notify-* email triggers', async () => {
      for (const path of [
        'notify-leave-request',
        'notify-leave-status',
        'notify-document-upload',
      ]) {
        const res = await request(app)
          .post(`/api/notifications/${path}`)
          .set('Authorization', admin)
          .send({});
        expect(res.status).toBe(404);
      }
    });

    it('audits a manual expiry check', async () => {
      const res = await request(app)
        .post('/api/notifications/check-expiries')
        .set('Authorization', director);
      expect(res.status).toBe(200);
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'CHECK_EXPIRIES_MANUAL',
          userEmail: 'director@phase0.test',
        },
      });
      expect(audit).not.toBeNull();
    });
  });
});
