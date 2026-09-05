import express from 'express';
import request from './helpers/http';
import * as XLSX from 'xlsx';
import employeesRouter from '../routes/employees';
import { testPrisma as prisma, signTestToken } from './helpers/tenantTest';

const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);

const PREFIX = 'export-security';

// The spreadsheet carries NI numbers, bank details and salaries in the clear,
// so who may ask for it is the whole of its security.

let selfId: number;
let otherId: number;

async function cleanup() {
  await prisma.employee.deleteMany({
    where: { email: { contains: `@${PREFIX}.test` } },
  });
}

const rowsFrom = (body: Buffer) => {
  const workbook = XLSX.read(body, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[workbook.SheetNames[0]],
  );
};

const download = (token: string) =>
  request(app)
    .get('/api/employees/export/excel')
    .set('Authorization', `Bearer ${token}`)
    .buffer()
    .parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (c: Buffer) => chunks.push(c));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
    });

beforeAll(async () => {
  await cleanup();
  const self = await prisma.employee.create({
    data: {
      firstName: 'Sam',
      lastName: 'Self',
      email: `self@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
      niNumber: 'QQ123456C',
    },
  });
  selfId = self.id;
  const other = await prisma.employee.create({
    data: {
      firstName: 'Ota',
      lastName: 'Other',
      email: `other@${PREFIX}.test`,
      employeeType: 'EMPLOYEE',
      niNumber: 'QQ999999C',
      accountNumber: '12345678',
    },
  });
  otherId = other.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('GET /employees/export/excel', () => {
  it('gives an employee only their own row', async () => {
    const token = signTestToken({
      email: `self@${PREFIX}.test`,
      role: 'EMPLOYEE',
      employeeId: selfId,
    });
    const rows = rowsFrom((await download(token)).body);
    expect(rows).toHaveLength(1);
    expect(rows[0].Email).toBe(`self@${PREFIX}.test`);
  });

  // The old check compared the raw role against 'MANAGER', a value
  // normalizeRole never produces, and fell through to "export everything"
  // whenever the token carried no email.
  it('refuses a token with no email rather than exporting the whole company', async () => {
    const token = signTestToken({ role: 'EMPLOYEE' });
    const res = await download(token);
    expect(res.status).toBe(403);
  });

  it('does not treat a director as an ordinary employee', async () => {
    const token = signTestToken({
      email: `boss@${PREFIX}.test`,
      role: 'DIRECTOR',
    });
    const rows = rowsFrom((await download(token)).body);
    const emails = rows.map((r) => r.Email);
    expect(emails).toContain(`self@${PREFIX}.test`);
    expect(emails).toContain(`other@${PREFIX}.test`);
  });

  it('keeps bank and NI details out of an office assistant\'s copy', async () => {
    const token = signTestToken({
      email: `assistant@${PREFIX}.test`,
      role: 'OFFICE_ASSISTANT',
    });
    const rows = rowsFrom((await download(token)).body);
    const other = rows.find((r) => r.Email === `other@${PREFIX}.test`);
    expect(other).toBeTruthy();
    expect(other!['NI Number']).toBe('');
    expect(other!['Account Number']).toBe('');
  });
});
