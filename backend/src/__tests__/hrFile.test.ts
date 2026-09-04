import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import employeesRouter from '../routes/employees';
import reviewsRouter from '../routes/reviews';
import checklistsRouter from '../routes/checklists';
import expensesRouter from '../routes/expenses';
import trainingRouter from '../routes/training';
import casesRouter from '../routes/cases';
import templatesRouter from '../routes/documentTemplates';
import documentsRouter from '../routes/documents';
import { renderTemplate } from '../routes/documentTemplates';
import { buildChecklist } from '../lib/checklists';
import { collectTenantExpiringItems } from '../lib/expirySweep';
import { runWithTenant } from '../lib/tenantContext';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';
import { platformPrisma } from '../prismaClient';

const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/checklists', checklistsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/training', trainingRouter);
app.use('/api/cases', casesRouter);
app.use('/api/document-templates', templatesRouter);
app.use('/api/documents', documentsRouter);

const PREFIX = 'hr-file';

let managerId: number;
let reportId: number;
let strangerId: number;
let reportUserId: number;
let leaverId: number;
let leaverUserId: number;
let adminToken: string;
let assistantToken: string;
let managerToken: string;
let reportToken: string;
let strangerToken: string;

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

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
  if (users.length)
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u: { id: number }) => u.id) } },
    });
  if (ids.length) {
    await prisma.document.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.updateMany({
      where: { id: { in: ids } },
      data: { managerId: null },
    });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.documentTemplate.deleteMany({
    where: { name: { startsWith: PREFIX } },
  });
}

beforeAll(async () => {
  await cleanup();

  const manager = await prisma.employee.create({
    data: {
      firstName: 'Mo',
      lastName: 'Manager',
      email: `manager@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
      startDate: new Date('2020-01-01'),
    },
  });
  managerId = manager.id;

  const report = await prisma.employee.create({
    data: {
      firstName: 'Rae',
      lastName: 'Report',
      email: `report@${PREFIX}.test`,
      jobTitle: 'Care Assistant',
      department: 'Care',
      employeeType: 'EMPLOYEE',
      startDate: daysFromNow(-30),
      managerId,
    },
  });
  reportId = report.id;

  const stranger = await prisma.employee.create({
    data: {
      firstName: 'Sam',
      lastName: 'Stranger',
      email: `stranger@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
    },
  });
  strangerId = stranger.id;

  const reportUser = await prisma.user.create({
    data: {
      email: `report@${PREFIX}.test`,
      name: 'Rae Report',
      password: await bcrypt.hash('password-123', 10),
      role: 'EMPLOYEE',
      employeeId: reportId,
    },
  });
  reportUserId = reportUser.id;

  // Offboarding really does delete the login, so it gets its own victim
  // rather than logging the rest of the suite out halfway through.
  const leaver = await prisma.employee.create({
    data: {
      firstName: 'Lee',
      lastName: 'Leaver',
      email: `leaver@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
      startDate: new Date('2021-01-01'),
      endDate: daysFromNow(-1),
    },
  });
  leaverId = leaver.id;
  const leaverUser = await prisma.user.create({
    data: {
      email: `leaver@${PREFIX}.test`,
      name: 'Lee Leaver',
      password: await bcrypt.hash('password-123', 10),
      role: 'EMPLOYEE',
      employeeId: leaverId,
    },
  });
  leaverUserId = leaverUser.id;

  adminToken = signTestToken({ email: `owner@${PREFIX}.test`, role: 'ADMIN' });
  assistantToken = signTestToken({
    email: `assistant@${PREFIX}.test`,
    role: 'OFFICE_ASSISTANT',
  });
  managerToken = signTestToken({
    email: `manager@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: managerId,
  });
  reportToken = signTestToken({
    id: reportUserId,
    email: `report@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: reportId,
  });
  strangerToken = signTestToken({
    email: `stranger@${PREFIX}.test`,
    role: 'EMPLOYEE',
    employeeId: strangerId,
  });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('performance reviews', () => {
  afterEach(async () => {
    await prisma.performanceReview.deleteMany({
      where: { employeeId: { in: [managerId, reportId, strangerId, leaverId] } },
    });
  });

  it('schedules a probation review two weeks before probation ends', async () => {
    const probationEnd = daysFromNow(60);
    const res = await request(app)
      .put(`/api/employees/${reportId}`)
      .set(auth(adminToken))
      .send({ probationEndDate: probationEnd.toISOString().slice(0, 10) });
    expect(res.status).toBe(200);

    const review = await prisma.performanceReview.findFirst({
      where: { employeeId: reportId, type: 'PROBATION' },
    });
    expect(review).toBeTruthy();
    const expected = new Date(probationEnd);
    expected.setUTCDate(expected.getUTCDate() - 14);
    expect(review.dueDate.toISOString().slice(0, 10)).toBe(
      expected.toISOString().slice(0, 10),
    );

    // Moving the date moves the review rather than adding a second one.
    await request(app)
      .put(`/api/employees/${reportId}`)
      .set(auth(adminToken))
      .send({ probationEndDate: daysFromNow(90).toISOString().slice(0, 10) });
    const all = await prisma.performanceReview.findMany({
      where: { employeeId: reportId, type: 'PROBATION' },
    });
    expect(all).toHaveLength(1);

    await request(app)
      .put(`/api/employees/${reportId}`)
      .set(auth(adminToken))
      .send({ probationEndDate: '' });
    expect(
      await prisma.performanceReview.count({ where: { employeeId: reportId } }),
    ).toBe(0);
  });

  it('validates the type and rating', async () => {
    for (const body of [
      { employeeId: reportId, type: 'QUARTERLY', dueDate: '2026-06-01' },
      { employeeId: reportId, type: 'ANNUAL', dueDate: 'not-a-date' },
      {
        employeeId: reportId,
        type: 'ANNUAL',
        dueDate: '2026-06-01',
        rating: 'GREAT',
      },
    ]) {
      const res = await request(app)
        .post('/api/reviews')
        .set(auth(adminToken))
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('lets a manager complete their report\'s review but not their own', async () => {
    const created = await request(app)
      .post('/api/reviews')
      .set(auth(adminToken))
      .send({ employeeId: reportId, type: 'ANNUAL', dueDate: '2026-06-01' });
    expect(created.status).toBe(200);

    const bystander = await request(app)
      .put(`/api/reviews/${created.body.id}`)
      .set(auth(strangerToken))
      .send({ completed: true });
    expect(bystander.status).toBe(403);

    const byManager = await request(app)
      .put(`/api/reviews/${created.body.id}`)
      .set(auth(managerToken))
      .send({ completed: true, rating: 'MEETS', summary: 'Doing well' });
    expect(byManager.status).toBe(200);
    expect(byManager.body.completedAt).toBeTruthy();
    expect(byManager.body.rating).toBe('MEETS');

    const own = await request(app)
      .post('/api/reviews')
      .set(auth(adminToken))
      .send({ employeeId: managerId, type: 'ANNUAL', dueDate: '2026-06-01' });
    const selfEdit = await request(app)
      .put(`/api/reviews/${own.body.id}`)
      .set(auth(managerToken))
      .send({ rating: 'EXCEEDS' });
    expect(selfEdit.status).toBe(403);
  });

  it('shows an employee only their own reviews', async () => {
    await request(app)
      .post('/api/reviews')
      .set(auth(adminToken))
      .send({ employeeId: reportId, type: 'ANNUAL', dueDate: '2026-06-01' });
    await request(app)
      .post('/api/reviews')
      .set(auth(adminToken))
      .send({ employeeId: strangerId, type: 'ANNUAL', dueDate: '2026-06-01' });

    const res = await request(app).get('/api/reviews').set(auth(reportToken));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(reportId);

    const asManager = await request(app)
      .get('/api/reviews')
      .set(auth(managerToken));
    expect(asManager.body.map((r: any) => r.employeeId)).toContain(reportId);
    expect(asManager.body.map((r: any) => r.employeeId)).not.toContain(
      strangerId,
    );
  });
});

describe('onboarding and offboarding checklists', () => {
  afterEach(async () => {
    await prisma.checklistItem.deleteMany({
      where: { employeeId: { in: [managerId, reportId, strangerId, leaverId] } },
    });
  });

  it('dates the template from the anchor date', () => {
    const rows = buildChecklist('ONBOARDING', new Date('2026-03-02'));
    expect(rows[0].title).toMatch(/Right-to-work/);
    expect(rows[0].dueDate!.toISOString().slice(0, 10)).toBe('2026-03-02');
    const pension = rows.find((r) => r.title.includes('Pension'));
    expect(pension!.dueDate!.toISOString().slice(0, 10)).toBe('2026-04-01');

    // No start date is still a usable checklist, just an undated one.
    expect(buildChecklist('ONBOARDING', null)[0].dueDate).toBeNull();
  });

  it('creates a checklist once and refuses a duplicate', async () => {
    const first = await request(app)
      .post(`/api/checklists/${reportId}`)
      .set(auth(assistantToken))
      .send({ kind: 'ONBOARDING' });
    expect(first.status).toBe(200);
    expect(first.body.length).toBeGreaterThan(5);

    const second = await request(app)
      .post(`/api/checklists/${reportId}`)
      .set(auth(assistantToken))
      .send({ kind: 'ONBOARDING' });
    expect(second.status).toBe(409);

    const bad = await request(app)
      .post(`/api/checklists/${reportId}`)
      .set(auth(assistantToken))
      .send({ kind: 'MIDBOARDING' });
    expect(bad.status).toBe(400);
  });

  it('actually revokes the login and sets the retention date when those items are ticked', async () => {
    const created = await request(app)
      .post(`/api/checklists/${leaverId}`)
      .set(auth(adminToken))
      .send({ kind: 'OFFBOARDING' });
    expect(created.status).toBe(200);

    const revoke = created.body.find((i: any) => i.actionKey === 'REVOKE_LOGIN');
    const retain = created.body.find(
      (i: any) => i.actionKey === 'SET_RETAIN_UNTIL',
    );

    const revoked = await request(app)
      .put(`/api/checklists/item/${revoke.id}`)
      .set(auth(adminToken))
      .send({ completed: true });
    expect(revoked.status).toBe(200);
    expect(revoked.body.actionResult).toBe('Login revoked');
    expect(await prisma.user.count({ where: { id: leaverUserId } })).toBe(0);

    const retained = await request(app)
      .put(`/api/checklists/item/${retain.id}`)
      .set(auth(adminToken))
      .send({ completed: true });
    expect(retained.body.actionResult).toBe('Retention date set');
    const employee = await prisma.employee.findFirst({ where: { id: leaverId } });
    expect(employee.retainUntil).toBeTruthy();
  });

  it('keeps a checklist out of an unrelated colleague\'s hands', async () => {
    await request(app)
      .post(`/api/checklists/${reportId}`)
      .set(auth(adminToken))
      .send({ kind: 'ONBOARDING' });

    expect(
      (await request(app)
        .get(`/api/checklists/${reportId}`)
        .set(auth(strangerToken))).status,
    ).toBe(403);
    expect(
      (await request(app)
        .get(`/api/checklists/${reportId}`)
        .set(auth(managerToken))).status,
    ).toBe(200);
  });
});

describe('bad route ids', () => {
  it('answers a non-numeric id rather than leaving the request open', async () => {
    const res = await request(app)
      .put('/api/expenses/not-an-id/paid')
      .set(auth(adminToken))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid id');
  });
});

describe('expenses', () => {
  afterEach(async () => {
    await prisma.expenseClaim.deleteMany({
      where: { employeeId: { in: [managerId, reportId, strangerId, leaverId] } },
    });
  });

  const claim = (token: string, body: any = {}) =>
    request(app)
      .post('/api/expenses')
      .set(auth(token))
      .send({
        date: '2026-03-02',
        category: 'TRAVEL',
        amount: 42.5,
        description: 'Train to the client site',
        ...body,
      });

  it('validates the category and the amount, and files against the caller', async () => {
    expect((await claim(reportToken, { category: 'LUNCH' })).status).toBe(400);
    expect((await claim(reportToken, { amount: 0 })).status).toBe(400);

    const res = await claim(reportToken);
    expect(res.status).toBe(200);
    expect(res.body.employeeId).toBe(reportId);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.amount).toBe(42.5);
  });

  it('is decided by the line manager, never by the claimant', async () => {
    const created = await claim(reportToken);

    const bySelf = await request(app)
      .put(`/api/expenses/${created.body.id}/approve`)
      .set(auth(reportToken))
      .send({});
    expect(bySelf.status).toBe(403);

    const byStranger = await request(app)
      .put(`/api/expenses/${created.body.id}/approve`)
      .set(auth(strangerToken))
      .send({});
    expect(byStranger.status).toBe(403);

    const approved = await request(app)
      .put(`/api/expenses/${created.body.id}/approve`)
      .set(auth(managerToken))
      .send({ note: 'Receipt seen' });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.decidedBy).toBe(`manager@${PREFIX}.test`);

    const again = await request(app)
      .put(`/api/expenses/${created.body.id}/reject`)
      .set(auth(managerToken))
      .send({});
    expect(again.status).toBe(409);
  });

  it('only marks an approved claim paid', async () => {
    const created = await claim(reportToken);
    const early = await request(app)
      .put(`/api/expenses/${created.body.id}/paid`)
      .set(auth(adminToken))
      .send({});
    expect(early.status).toBe(409);

    await request(app)
      .put(`/api/expenses/${created.body.id}/approve`)
      .set(auth(adminToken))
      .send({});
    const paid = await request(app)
      .put(`/api/expenses/${created.body.id}/paid`)
      .set(auth(adminToken))
      .send({});
    expect(paid.body.status).toBe('PAID');
  });
});

describe('training records', () => {
  afterEach(async () => {
    await prisma.trainingRecord.deleteMany({
      where: { employeeId: { in: [managerId, reportId, strangerId, leaverId] } },
    });
  });

  it('refuses an expiry before completion, then records the certificate', async () => {
    const backwards = await request(app)
      .post('/api/training')
      .set(auth(adminToken))
      .send({
        employeeId: reportId,
        title: 'Moving and handling',
        completedAt: '2026-03-02',
        expiresAt: '2025-03-02',
      });
    expect(backwards.status).toBe(400);

    const res = await request(app)
      .post('/api/training')
      .set(auth(adminToken))
      .send({
        employeeId: reportId,
        title: 'Moving and handling',
        provider: 'Skills for Care',
        completedAt: '2026-03-02',
        expiresAt: daysFromNow(20).toISOString().slice(0, 10),
      });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Moving and handling');
  });

  it('puts an expiring certificate into the expiry sweep', async () => {
    await request(app)
      .post('/api/training')
      .set(auth(adminToken))
      .send({
        employeeId: reportId,
        title: 'Safeguarding',
        completedAt: '2026-01-02',
        expiresAt: daysFromNow(20).toISOString().slice(0, 10),
      });

    const items = await runWithTenant({ tenantId: testTenantId() }, () =>
      collectTenantExpiringItems(new Date(), 90),
    );
    const training = items.find(
      (i: any) => i.kind === 'TRAINING' && i.employeeId === reportId,
    );
    expect(training).toBeTruthy();
    expect(training!.detail).toBe('Safeguarding');
    expect(training!.daysRemaining).toBe(20);
  });
});

describe('disciplinary and grievance cases', () => {
  afterEach(async () => {
    await prisma.caseRecord.deleteMany({
      where: { employeeId: { in: [managerId, reportId, strangerId, leaverId] } },
    });
  });

  it('is closed to the office assistant, the manager and the employee', async () => {
    for (const token of [assistantToken, managerToken, reportToken]) {
      expect((await request(app).get('/api/cases').set(auth(token))).status).toBe(
        403,
      );
    }
    expect((await request(app).get('/api/cases').set(auth(adminToken))).status).toBe(
      200,
    );
  });

  it('records a case, moves it through its stages and audits every read', async () => {
    const created = await request(app)
      .post('/api/cases')
      .set(auth(adminToken))
      .send({
        employeeId: reportId,
        type: 'GRIEVANCE',
        openedAt: '2026-03-02',
        stage: 'INFORMAL',
        notes: 'Raised verbally with the line manager',
      });
    expect(created.status).toBe(200);

    const badStage = await request(app)
      .put(`/api/cases/${created.body.id}`)
      .set(auth(adminToken))
      .send({ stage: 'TRIBUNAL' });
    expect(badStage.status).toBe(400);

    const closed = await request(app)
      .put(`/api/cases/${created.body.id}`)
      .set(auth(adminToken))
      .send({ closed: true, outcome: 'Resolved informally' });
    expect(closed.body.closedAt).toBeTruthy();
    expect(closed.body.stage).toBe('CLOSED');

    await request(app).get(`/api/cases/${created.body.id}`).set(auth(adminToken));
    const read = await platformPrisma.auditLog.findFirst({
      where: {
        entity: 'CaseRecord',
        action: 'READ',
        entityId: created.body.id,
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(read).toBeTruthy();
  });
});

describe('templates and acknowledgement', () => {
  it('fills the placeholders it knows and leaves the ones it does not', () => {
    const html = renderTemplate(
      '<p>Dear {{firstName}} {{lastName}}, you start as {{jobTitle}} on {{startDate}}. {{salary}}</p>',
      {
        firstName: 'Rae',
        lastName: 'Report',
        jobTitle: 'Care Assistant',
        startDate: new Date('2026-03-02'),
      },
    );
    expect(html).toContain('Dear Rae Report');
    expect(html).toContain('02/03/2026');
    // Salary is not a merge field, so the placeholder stays visible rather
    // than silently emptying the sentence.
    expect(html).toContain('{{salary}}');
  });

  it('escapes anything the record carries into the document', () => {
    const html = renderTemplate('<p>{{firstName}}</p>', {
      firstName: '<script>alert(1)</script>',
      lastName: 'X',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('generates a document for an employee and takes their acknowledgement once', async () => {
    const template = await request(app)
      .post('/api/document-templates')
      .set(auth(adminToken))
      .send({
        name: `${PREFIX} contract`,
        body: '<p>Contract for {{fullName}}</p>',
      });
    expect(template.status).toBe(200);

    const generated = await request(app)
      .post(`/api/document-templates/${template.body.id}/generate`)
      .set(auth(adminToken))
      .send({ employeeId: reportId });
    expect(generated.status).toBe(200);
    expect(generated.body.requiresAcknowledgement).toBe(true);
    expect(generated.body.name).toContain('Rae Report');

    const documentId = generated.body.id;
    const blank = await request(app)
      .post(`/api/documents/${documentId}/acknowledge`)
      .set(auth(reportToken))
      .send({ typedName: '  ' });
    expect(blank.status).toBe(400);

    const theirs = await request(app)
      .post(`/api/documents/${documentId}/acknowledge`)
      .set(auth(strangerToken))
      .send({ typedName: 'Sam Stranger' });
    expect(theirs.status).toBe(404);

    const signed = await request(app)
      .post(`/api/documents/${documentId}/acknowledge`)
      .set(auth(reportToken))
      .send({ typedName: 'Rae Report' });
    expect(signed.status).toBe(200);
    expect(signed.body.typedName).toBe('Rae Report');

    const twice = await request(app)
      .post(`/api/documents/${documentId}/acknowledge`)
      .set(auth(reportToken))
      .send({ typedName: 'Rae Report' });
    expect(twice.status).toBe(409);

    const list = await request(app)
      .get(`/api/documents/${documentId}/acknowledgements`)
      .set(auth(adminToken));
    expect(list.body).toHaveLength(1);

    // A generated contract is HTML. Serving it inline would put attacker-
    // controllable markup on the same origin as the app, so it always
    // downloads however the caller asks for it.
    const inline = await request(app)
      .get(`/api/documents/${documentId}/file?disposition=inline`)
      .set(auth(reportToken));
    expect(inline.status).toBe(200);
    expect(inline.headers['content-disposition']).toMatch(/^attachment/);
    expect(inline.headers['content-type']).not.toMatch(/text\/html/);
    expect(inline.headers['x-content-type-options']).toBe('nosniff');
    // The name carries an em dash, which cannot travel raw in a header.
    expect(inline.headers['content-disposition']).toContain("filename*=UTF-8''");

    await prisma.documentAcknowledgement.deleteMany({ where: { documentId } });
    await prisma.document.deleteMany({ where: { id: documentId } });
  });
});
