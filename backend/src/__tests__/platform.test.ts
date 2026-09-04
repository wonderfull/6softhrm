import { describe, it, expect, beforeAll } from '@jest/globals';
import request from './helpers/http';
import bcrypt from 'bcryptjs';
import app from '../app';
import { platformPrisma } from '../prismaClient';
import { signTestToken } from './helpers/tenantTest';

describe('Platform console', () => {
  const adminEmail = 'operator@platform.test';
  const adminPassword = 'platform-secret-1';
  let platformToken: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(adminPassword, 10);
    await platformPrisma.platformAdmin.upsert({
      where: { email: adminEmail },
      update: { password: hash },
      create: { email: adminEmail, password: hash, name: 'Operator' },
    });
    await platformPrisma.tenant.deleteMany({
      where: { slug: { in: ['acme-widgets', 'acme-widgets-2'] } },
    });
    await platformPrisma.user.deleteMany({
      where: { email: { contains: '@acme-widgets.test' } },
    });

    const login = await request(app)
      .post('/api/platform/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    platformToken = `Bearer ${login.body.token}`;
  });

  it('logs a platform admin in and rejects bad credentials', async () => {
    const bad = await request(app)
      .post('/api/platform/auth/login')
      .send({ email: adminEmail, password: 'wrong' });
    expect(bad.status).toBe(401);
    expect(platformToken).toContain('Bearer ');
  });

  it('rejects tenant tokens on platform routes and platform tokens on tenant routes', async () => {
    const tenantToken = `Bearer ${signTestToken({ email: 'x@y.test', role: 'ADMIN' })}`;
    const onPlatform = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', tenantToken);
    expect(onPlatform.status).toBe(401);

    const onTenant = await request(app)
      .get('/api/employees')
      .set('Authorization', platformToken);
    expect(onTenant.status).toBe(401);
  });

  it('creates a tenant with its first admin and a setup link', async () => {
    const res = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', platformToken)
      .send({
        name: 'Acme Widgets Ltd',
        slug: 'acme-widgets',
        plan: 'CORE_PLUS_COMPLIANCE',
        seatLimit: 25,
        adminEmail: 'boss@acme-widgets.test',
        adminName: 'Acme Boss',
      });
    expect(res.status).toBe(200);
    expect(res.body.tenant.slug).toBe('acme-widgets');
    expect(res.body.admin.email).toBe('boss@acme-widgets.test');
    expect(res.body.setupLink).toContain('/reset-password?token=');

    // Setup link actually works: redeem it, then log in.
    const token = res.body.setupLink.split('token=')[1];
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'first-login-pass1' });
    expect(reset.status).toBe(200);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'boss@acme-widgets.test', password: 'first-login-pass1' });
    expect(login.status).toBe(200);
    expect(login.body.user.tenant.slug).toBe('acme-widgets');
  });

  it('rejects duplicate slugs and invalid slugs', async () => {
    const dup = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', platformToken)
      .send({ name: 'Dup', slug: 'acme-widgets', adminEmail: 'dup@acme-widgets.test' });
    expect(dup.status).toBe(409);

    const badSlug = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', platformToken)
      .send({ name: 'Bad', slug: 'Bad Slug!', adminEmail: 'bad@acme-widgets.test' });
    expect(badSlug.status).toBe(400);
  });

  it('lists tenants with counts', async () => {
    const res = await request(app)
      .get('/api/platform/tenants')
      .set('Authorization', platformToken);
    expect(res.status).toBe(200);
    const acme = res.body.find((t: any) => t.slug === 'acme-widgets');
    expect(acme).toBeTruthy();
    expect(acme.userCount).toBeGreaterThanOrEqual(1);
  });

  it('suspension locks out an already-issued tenant session immediately', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'boss@acme-widgets.test', password: 'first-login-pass1' });
    const bossToken = `Bearer ${login.body.token}`;
    const acme = await platformPrisma.tenant.findUnique({ where: { slug: 'acme-widgets' } });

    const before = await request(app).get('/api/employees').set('Authorization', bossToken);
    expect(before.status).toBe(200);

    const suspend = await request(app)
      .put(`/api/platform/tenants/${acme!.id}`)
      .set('Authorization', platformToken)
      .send({ status: 'SUSPENDED' });
    expect(suspend.status).toBe(200);

    const after = await request(app).get('/api/employees').set('Authorization', bossToken);
    expect(after.status).toBe(403);
    expect(after.body.error).toBe('ACCOUNT_SUSPENDED');

    const reactivate = await request(app)
      .put(`/api/platform/tenants/${acme!.id}`)
      .set('Authorization', platformToken)
      .send({ status: 'ACTIVE' });
    expect(reactivate.status).toBe(200);

    const restored = await request(app).get('/api/employees').set('Authorization', bossToken);
    expect(restored.status).toBe(200);
  });

  it('impersonation mints a working tenant token and audits it', async () => {
    const acme = await platformPrisma.tenant.findUnique({ where: { slug: 'acme-widgets' } });
    const res = await request(app)
      .post(`/api/platform/tenants/${acme!.id}/impersonate`)
      .set('Authorization', platformToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('boss@acme-widgets.test');

    const impToken = `Bearer ${res.body.token}`;
    const employees = await request(app).get('/api/employees').set('Authorization', impToken);
    expect(employees.status).toBe(200);

    const started = await platformPrisma.auditLog.findFirst({
      where: { tenantId: acme!.id, action: 'IMPERSONATION_STARTED' },
      orderBy: { id: 'desc' },
    });
    expect(started).toBeTruthy();

    // Actions under the impersonated token are flagged in the tenant's log.
    const flagged = await platformPrisma.auditLog.findFirst({
      where: { tenantId: acme!.id, action: 'READ', entity: 'Employee' },
      orderBy: { id: 'desc' },
    });
    expect(flagged?.details).toContain('impersonatedBy');
  });

  it('blocks impersonation into a cancelled tenant', async () => {
    const acme = await platformPrisma.tenant.findUnique({ where: { slug: 'acme-widgets' } });
    await request(app)
      .put(`/api/platform/tenants/${acme!.id}`)
      .set('Authorization', platformToken)
      .send({ status: 'CANCELLED' });
    const res = await request(app)
      .post(`/api/platform/tenants/${acme!.id}/impersonate`)
      .set('Authorization', platformToken)
      .send({});
    expect(res.status).toBe(403);
    await request(app)
      .put(`/api/platform/tenants/${acme!.id}`)
      .set('Authorization', platformToken)
      .send({ status: 'ACTIVE' });
  });
});
