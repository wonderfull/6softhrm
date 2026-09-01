import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../app';
import { getStorage } from '../lib/storage';
import {
  testPrisma as prisma,
  signTestToken,
  testTenantId,
} from './helpers/tenantTest';

// Error paths of the multi-file payslip upload and the file-serving routes.
// Deliberately the real app, not a bare router: the multer error handler that
// turns a rejected batch into a clean 4xx lives in app.ts and a hand-rolled
// test app would silently miss it.

const pdf = (label: string) => Buffer.from(`%PDF-1.4 ${label}`);

const binaryParser = (res: any, cb: (err: null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('payslip batch upload and file serving — error paths', () => {
  let employeeId: number;
  let token: string;
  let tenantDocsDir: string;

  const storedFileCount = () =>
    fs.existsSync(tenantDocsDir) ? fs.readdirSync(tenantDocsDir).length : 0;

  beforeAll(async () => {
    await prisma.document.deleteMany({});
    await prisma.employee.deleteMany({});

    const employee = await prisma.employee.create({
      data: {
        tenantId: testTenantId(),
        firstName: 'Batch',
        lastName: 'Target',
        email: 'batch@errors.test',
        employeeType: 'EMPLOYEE',
      },
    });
    employeeId = employee.id;
    token = `Bearer ${signTestToken({ email: 'admin@errors.test', role: 'ADMIN' })}`;
    tenantDocsDir = path.join(
      process.cwd(),
      'uploads',
      'tenants',
      String(testTenantId()),
      'documents',
    );
  });

  beforeEach(async () => {
    await prisma.document.deleteMany({});
    if (fs.existsSync(tenantDocsDir)) {
      fs.rmSync(tenantDocsDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await prisma.document.deleteMany({});
    await prisma.employee.deleteMany({});
    if (fs.existsSync(tenantDocsDir)) {
      fs.rmSync(tenantDocsDir, { recursive: true, force: true });
    }
    await prisma.$disconnect();
  });

  const batch = () =>
    request(app)
      .post('/api/documents/upload-payslips')
      .set('Authorization', token)
      .field('employeeId', String(employeeId));

  describe('POST /api/documents/upload-payslips', () => {
    it('refuses 21 files with a clean 4xx and stores nothing', async () => {
      let req = batch();
      for (let i = 0; i < 21; i++) {
        req = req.attach('files', pdf(`p${i}`), {
          filename: `payslip-${i}.pdf`,
          contentType: 'application/pdf',
        });
      }
      const res = await req;

      // multer throws LIMIT_UNEXPECTED_FILE for the 21st file; the app.ts
      // handler must turn that into a 400, never a 500.
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LIMIT_UNEXPECTED_FILE');
      expect(await prisma.document.count()).toBe(0);
      expect(storedFileCount()).toBe(0);
    });

    it('refuses the whole batch with 413 when one file is oversized, storing nothing', async () => {
      const res = await batch()
        .attach('files', pdf('ok'), {
          filename: 'ok.pdf',
          contentType: 'application/pdf',
        })
        .attach('files', Buffer.alloc(6 * 1024 * 1024, 0x25), {
          filename: 'big.pdf',
          contentType: 'application/pdf',
        });

      // multer aborts parsing at the size cap, so the route never runs:
      // all-or-nothing, clearly reported via the 413 from app.ts.
      expect(res.status).toBe(413);
      expect(res.body.code).toBe('LIMIT_FILE_SIZE');
      expect(await prisma.document.count()).toBe(0);
      expect(storedFileCount()).toBe(0);
    });

    it('stores the allowed files and names each type-rejected file in the response', async () => {
      const res = await batch()
        .attach('files', pdf('a'), {
          filename: 'april.pdf',
          contentType: 'application/pdf',
        })
        .attach('files', Buffer.from('#!/bin/sh\n'), {
          filename: 'evil.sh',
          contentType: 'application/x-sh',
        })
        .attach('files', pdf('b'), {
          filename: 'may.pdf',
          contentType: 'application/pdf',
        });

      // Partial success is fine, silent partial success is not: the client
      // must be told which file was dropped and why.
      expect(res.status).toBe(200);
      expect(res.body.uploadedCount).toBe(2);
      expect(res.body.skipped).toEqual([
        { name: 'evil.sh', reason: 'DISALLOWED_TYPE' },
      ]);
      expect(await prisma.document.count()).toBe(2);
      expect(storedFileCount()).toBe(2);
    });

    it('refuses a batch where every file is type-rejected, naming them', async () => {
      const res = await batch().attach('files', Buffer.from('#!/bin/sh\n'), {
        filename: 'only-evil.sh',
        contentType: 'application/x-sh',
      });

      expect(res.status).toBe(400);
      expect(res.body.skipped).toEqual([
        { name: 'only-evil.sh', reason: 'DISALLOWED_TYPE' },
      ]);
      expect(await prisma.document.count()).toBe(0);
      expect(storedFileCount()).toBe(0);
    });

    it('refuses a batch of zero files with a clean 400', async () => {
      const res = await batch();
      expect(res.status).toBe(400);
      expect(await prisma.document.count()).toBe(0);
    });

    it('refuses files sent under the wrong field name with a clean 4xx', async () => {
      const res = await batch().attach('file', pdf('x'), {
        filename: 'wrong-field.pdf',
        contentType: 'application/pdf',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LIMIT_UNEXPECTED_FILE');
      expect(await prisma.document.count()).toBe(0);
      expect(storedFileCount()).toBe(0);
    });

    it('refuses a missing employeeId with a clean 400, storing nothing', async () => {
      const res = await request(app)
        .post('/api/documents/upload-payslips')
        .set('Authorization', token)
        .attach('files', pdf('x'), {
          filename: 'no-employee.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(await prisma.document.count()).toBe(0);
      expect(storedFileCount()).toBe(0);
    });

    it('refuses a non-numeric employeeId with a clean 400, not a hang or 500', async () => {
      const res = await request(app)
        .post('/api/documents/upload-payslips')
        .set('Authorization', token)
        .field('employeeId', 'not-a-number')
        .attach('files', pdf('x'), {
          filename: 'bad-employee.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(await prisma.document.count()).toBe(0);
      expect(storedFileCount()).toBe(0);
    });

    it('reports a mid-batch storage failure per file and leaves no row without a file', async () => {
      const store = getStorage();
      const realPut = store.put.bind(store);
      store.put = async (key: string, body: Buffer, contentType?: string) => {
        if (key.includes('explodes')) throw new Error('simulated disk failure');
        return realPut(key, body, contentType);
      };

      try {
        const res = await batch()
          .attach('files', pdf('a'), {
            filename: 'june.pdf',
            contentType: 'application/pdf',
          })
          .attach('files', pdf('b'), {
            filename: 'explodes.pdf',
            contentType: 'application/pdf',
          })
          .attach('files', pdf('c'), {
            filename: 'july.pdf',
            contentType: 'application/pdf',
          });

        // Clearly-reported partial success: the two good files land, the
        // failed one is named, and the counts agree.
        expect(res.status).toBe(200);
        expect(res.body.uploadedCount).toBe(2);
        expect(res.body.failed).toHaveLength(1);
        expect(res.body.failed[0].name).toBe('explodes.pdf');

        // Invariant: never a Document row whose stored object is missing.
        const rows = await prisma.document.findMany({});
        expect(rows).toHaveLength(2);
        for (const row of rows) {
          expect(await store.exists(row.path)).toBe(true);
        }
      } finally {
        store.put = realPut;
      }
    });

    it('refuses the batch when every storage write fails, storing no rows', async () => {
      const store = getStorage();
      const realPut = store.put.bind(store);
      store.put = async () => {
        throw new Error('simulated disk failure');
      };

      try {
        const res = await batch().attach('files', pdf('x'), {
          filename: 'doomed.pdf',
          contentType: 'application/pdf',
        });

        expect(res.status).toBe(400);
        expect(res.body.failed).toHaveLength(1);
        expect(await prisma.document.count()).toBe(0);
      } finally {
        store.put = realPut;
      }
    });
  });

  describe('POST /api/documents/upload', () => {
    it('refuses a non-numeric employeeId with a clean 400, not a hang or 500', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', token)
        .field('employeeId', 'not-a-number')
        .field('name', 'Bad employee upload')
        .attach('file', pdf('x'), {
          filename: 'bad.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(await prisma.document.count()).toBe(0);
    });
  });

  describe('GET /api/documents/:id/file', () => {
    it('returns 404 when the row exists but the stored object is missing', async () => {
      const doc = await prisma.document.create({
        data: {
          tenantId: testTenantId(),
          employeeId,
          name: 'Ghost Payslip',
          path: `tenants/${testTenantId()}/documents/does-not-exist.pdf`,
          type: 'PAYSLIP',
        },
      });

      const res = await request(app)
        .get(`/api/documents/${doc.id}/file`)
        .set('Authorization', token);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('File not found');
    });

    it('returns a clean 4xx for a non-numeric document id', async () => {
      const res = await request(app)
        .get('/api/documents/not-a-number/file')
        .set('Authorization', token);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('GET /api/documents/download-all/:employeeId', () => {
    it('skips rows whose object is missing and still serves the rest', async () => {
      const realKey = `tenants/${testTenantId()}/documents/real-payslip.pdf`;
      await getStorage().put(realKey, pdf('real'));
      await prisma.document.create({
        data: {
          tenantId: testTenantId(),
          employeeId,
          name: 'RealPayslipEntry',
          path: realKey,
          type: 'PAYSLIP',
        },
      });
      await prisma.document.create({
        data: {
          tenantId: testTenantId(),
          employeeId,
          name: 'GhostPayslipEntry',
          path: `tenants/${testTenantId()}/documents/gone.pdf`,
          type: 'PAYSLIP',
        },
      });

      const res = await request(app)
        .get(`/api/documents/download-all/${employeeId}`)
        .set('Authorization', token)
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      // ZIP entry names are stored uncompressed in the archive headers.
      const body = res.body as Buffer;
      expect(body.includes('RealPayslipEntry')).toBe(true);
      expect(body.includes('GhostPayslipEntry')).toBe(false);
    });

    it('returns a clean 4xx for a non-numeric employee id', async () => {
      const res = await request(app)
        .get('/api/documents/download-all/not-a-number')
        .set('Authorization', token);

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
