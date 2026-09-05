import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from './helpers/http';
import * as XLSX from 'xlsx';
import documentsRouter from '../routes/documents';
import employeesRouter from '../routes/employees';
import gdprRouter from '../routes/gdpr';
import sponsorshipsRouter from '../routes/sponsorships';
import timesheetsRouter from '../routes/timesheets';
import { testPrisma as prisma, signTestToken } from './helpers/tenantTest';

// Every sensitive operation must leave an AuditLog row (GDPR requirement in
// CLAUDE.md). These routes did nothing of the kind before the gap-closure
// pass. Also covers the two mass-assignment holes closed at the same time
// and the audit-log export the compliance officer hands to an inspector.

const app = express();
app.use(express.json());
app.use('/api/documents', documentsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/gdpr', gdprRouter);
app.use('/api/sponsorships', sponsorshipsRouter);
app.use('/api/timesheets', timesheetsRouter);

const PREFIX = 'audit-coverage';

describe('Audit coverage', () => {
  let admin: string;
  let assistant: string;
  let employeeToken: string;
  let employeeId: number;
  let otherEmployeeId: number;

  const auditRows = (where: Record<string, unknown>) =>
    prisma.auditLog.findMany({ where, orderBy: { id: 'asc' } });

  beforeAll(async () => {
    await prisma.employee.deleteMany({
      where: { email: { contains: `@${PREFIX}.test` } },
    });
    await prisma.auditLog.deleteMany({
      where: { userEmail: { endsWith: `@${PREFIX}.test` } },
    });

    const employee = await prisma.employee.create({
      data: {
        firstName: 'Audit',
        lastName: 'Subject',
        email: `subject@${PREFIX}.test`,
        jobTitle: 'Tester',
      },
    });
    employeeId = employee.id;
    const other = await prisma.employee.create({
      data: {
        firstName: 'Audit',
        lastName: 'Other',
        email: `other@${PREFIX}.test`,
        jobTitle: 'Tester',
      },
    });
    otherEmployeeId = other.id;

    admin = `Bearer ${signTestToken({ email: `admin@${PREFIX}.test`, role: 'ADMIN' })}`;
    assistant = `Bearer ${signTestToken({ email: `assistant@${PREFIX}.test`, role: 'OFFICE_ASSISTANT' })}`;
    employeeToken = `Bearer ${signTestToken({ email: employee.email, role: 'EMPLOYEE', employeeId })}`;
  });

  afterAll(async () => {
    const ids = [employeeId, otherEmployeeId];
    await prisma.document.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.timesheet.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.sponsorship.deleteMany({ where: { employeeId: { in: ids } } });
    await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    await prisma.auditLog.deleteMany({
      where: { userEmail: { endsWith: `@${PREFIX}.test` } },
    });
    await prisma.$disconnect();
  });

  describe('documents', () => {
    let documentId: number;

    it('audits an upload', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', assistant)
        .field('employeeId', String(employeeId))
        .field('name', 'Audited contract')
        .field('type', 'CONTRACT')
        .attach('file', Buffer.from('pdf'), 'contract.pdf');
      expect(res.status).toBe(200);
      documentId = res.body.id;

      const rows = await auditRows({
        action: 'UPLOAD',
        entity: 'Document',
        entityId: documentId,
      });
      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].details).employeeId).toBe(employeeId);
    });

    it('audits staff opening someone else\'s file, but not an employee opening their own', async () => {
      await request(app)
        .get(`/api/documents/${documentId}/file`)
        .set('Authorization', assistant);
      await request(app)
        .get(`/api/documents/${documentId}/file`)
        .set('Authorization', employeeToken);

      const rows = await auditRows({
        action: 'READ',
        entity: 'Document',
        entityId: documentId,
      });
      expect(rows.map((r: any) => r.userEmail)).toEqual([
        `assistant@${PREFIX}.test`,
      ]);
    });

    it('audits a payslip batch as one row listing the created ids', async () => {
      const res = await request(app)
        .post('/api/documents/upload-payslips')
        .set('Authorization', assistant)
        .field('employeeId', String(employeeId))
        .attach('files', Buffer.from('a'), 'jan.pdf')
        .attach('files', Buffer.from('b'), 'feb.pdf');
      expect(res.status).toBe(200);

      const rows = await auditRows({
        action: 'UPLOAD_PAYSLIPS',
        userEmail: `assistant@${PREFIX}.test`,
      });
      expect(rows).toHaveLength(1);
      const details = JSON.parse(rows[0].details);
      expect(details.uploadedCount).toBe(2);
      expect(details.documentIds).toHaveLength(2);
    });

    it('audits the download-all zip', async () => {
      const res = await request(app)
        .get(`/api/documents/download-all/${employeeId}`)
        .set('Authorization', assistant);
      expect(res.status).toBe(200);

      const rows = await auditRows({
        action: 'DOWNLOAD_ALL',
        userEmail: `assistant@${PREFIX}.test`,
      });
      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].details).employeeId).toBe(employeeId);
    });

    it('audits a delete with the document name so the trail survives the row', async () => {
      const res = await request(app)
        .delete(`/api/documents/${documentId}`)
        .set('Authorization', admin);
      expect(res.status).toBe(200);

      const rows = await auditRows({
        action: 'DELETE',
        entity: 'Document',
        entityId: documentId,
      });
      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].details).name).toBe('Audited contract');
    });
  });

  describe('timesheets', () => {
    it('audits create, update, delete and export', async () => {
      const created = await request(app)
        .post('/api/timesheets')
        .set('Authorization', employeeToken)
        .send({ date: '2026-09-01', hours: 7.5, notes: 'audited' });
      expect(created.status).toBe(200);
      const id = created.body.id;

      const updated = await request(app)
        .put(`/api/timesheets/${id}`)
        .set('Authorization', employeeToken)
        .send({ hours: 8 });
      expect(updated.status).toBe(200);

      const exported = await request(app)
        .get('/api/timesheets/export/excel')
        .set('Authorization', assistant);
      expect(exported.status).toBe(200);

      const deleted = await request(app)
        .delete(`/api/timesheets/${id}`)
        .set('Authorization', employeeToken);
      expect(deleted.status).toBe(200);

      const rows = await auditRows({ entity: 'Timesheet', entityId: id });
      expect(rows.map((r: any) => r.action)).toEqual([
        'CREATE',
        'UPDATE',
        'DELETE',
      ]);
      const exportRows = await auditRows({
        entity: 'Timesheet',
        action: 'EXPORT',
        userEmail: `assistant@${PREFIX}.test`,
      });
      expect(exportRows).toHaveLength(1);
    });
  });

  describe('mass assignment', () => {
    it('ignores id/tenantId/relations on an admin employee update', async () => {
      const res = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', admin)
        .send({
          id: 999999,
          tenantId: 999999,
          user: { create: { email: 'x', password: 'x' } },
          jobTitle: 'Promoted',
        });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(employeeId);
      expect(res.body.jobTitle).toBe('Promoted');
    });

    it('only updates the sponsorship fields on the pick-list', async () => {
      const sponsorship = await prisma.sponsorship.create({
        data: {
          employeeId,
          visaType: 'Skilled Worker',
          startDate: new Date('2026-01-01'),
        },
      });

      const res = await request(app)
        .put(`/api/sponsorships/${sponsorship.id}`)
        .set('Authorization', admin)
        .send({
          id: 999999,
          tenantId: 999999,
          visaType: 'Global Talent',
          cosSalary: '41000',
        });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sponsorship.id);
      expect(res.body.visaType).toBe('Global Talent');
      expect(res.body.cosSalary).toBe(41000);

      const moved = await request(app)
        .put(`/api/sponsorships/${sponsorship.id}`)
        .set('Authorization', admin)
        .send({ employeeId: 99999999 });
      expect(moved.status).toBe(400);
    });
  });

  describe('audit log export', () => {
    it('filters by date range on the list endpoint', async () => {
      const inRange = await request(app)
        .get('/api/gdpr/audit-logs')
        .set('Authorization', admin)
        .query({ entity: 'Timesheet', from: '2026-01-01', to: '2099-12-31' });
      expect(inRange.status).toBe(200);
      expect(inRange.body.total).toBeGreaterThan(0);

      const outOfRange = await request(app)
        .get('/api/gdpr/audit-logs')
        .set('Authorization', admin)
        .query({ entity: 'Timesheet', from: '2000-01-01', to: '2000-12-31' });
      expect(outOfRange.body.total).toBe(0);
    });

    it('exports the filtered rows as xlsx and audits the export', async () => {
      const res = await request(app)
        .get('/api/gdpr/audit-logs/export')
        .set('Authorization', admin)
        .query({ entity: 'Timesheet' })
        .buffer()
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');

      const wb = XLSX.read(res.body, { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets['Audit Log'],
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.Entity === 'Timesheet')).toBe(true);

      const audit = await auditRows({
        action: 'EXPORT',
        entity: 'AuditLog',
        userEmail: `admin@${PREFIX}.test`,
      });
      expect(audit).toHaveLength(1);
    });

    it('refuses the export to office assistants', async () => {
      const res = await request(app)
        .get('/api/gdpr/audit-logs/export')
        .set('Authorization', assistant);
      expect(res.status).toBe(403);
    });
  });
});
