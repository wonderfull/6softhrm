// P8 gate: drive the compliance moat end to end through the real HTTP stack —
// mark a sponsored worker absent to the C1.15 threshold, import payroll below
// the CoS salary, confirm both raise reportable events exactly once, export the
// Appendix D audit pack, and read the audit-readiness score back.
//
// Self-seeding and idempotent: re-running rebuilds its own tenant from scratch.
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import { platformPrisma } from '../src/prismaClient';
import { detectUnauthorisedAbsence } from '../src/lib/absenceDetection';
import { reconcileSalaries } from '../src/lib/salarySweep';

const SLUG = 'gate-compliance';

// Mon 7 Sep 2026 onwards: ten consecutive working days, spanning two weekends.
const ABSENCE_DAYS = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
];
const SWEEP_NOW = new Date('2026-09-30T00:00:00.000Z');

async function main() {
  const results: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    results.push(
      `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`,
    );
    if (!ok) process.exitCode = 1;
  };

  const hash = await bcrypt.hash('compliance-gate-pass', 10);
  await platformPrisma.platformAdmin.upsert({
    where: { email: 'gate-compliance@onsidehr.test' },
    update: { password: hash },
    create: { email: 'gate-compliance@onsidehr.test', password: hash },
  });
  const platformLogin = await request(app)
    .post('/api/platform/auth/login')
    .send({
      email: 'gate-compliance@onsidehr.test',
      password: 'compliance-gate-pass',
    });
  check('platform login', platformLogin.status === 200);
  const platformToken = `Bearer ${platformLogin.body.token}`;

  // Ordered teardown so the gate is re-runnable.
  const old = await platformPrisma.tenant.findUnique({ where: { slug: SLUG } });
  if (old) {
    const where = { tenantId: old.id };
    await platformPrisma.sponsorshipComplianceEvidence.deleteMany({ where });
    await platformPrisma.sponsorshipReportableEvent.deleteMany({ where });
    await platformPrisma.sponsorship.deleteMany({ where });
    await platformPrisma.absenceRecord.deleteMany({ where });
    await platformPrisma.payRecord.deleteMany({ where });
    await platformPrisma.leaveRequest.deleteMany({ where });
    await platformPrisma.timesheet.deleteMany({ where });
    await platformPrisma.document.deleteMany({ where });
    await platformPrisma.dataConsent.deleteMany({ where });
    await platformPrisma.auditLog.deleteMany({ where });
    await platformPrisma.user.deleteMany({ where });
    await platformPrisma.employee.deleteMany({ where });
    await platformPrisma.project.deleteMany({ where });
    await platformPrisma.tenant.delete({ where: { id: old.id } });
  }

  const created = await request(app)
    .post('/api/platform/tenants')
    .set('Authorization', platformToken)
    .send({
      name: 'Gate Compliance Ltd',
      slug: SLUG,
      plan: 'CORE_PLUS_COMPLIANCE',
      seatLimit: 20,
      adminEmail: 'hr@gate-compliance.test',
      adminName: 'Gate HR',
    });
  check('tenant created', created.status === 200 && !!created.body.setupLink);

  const setupToken = created.body.setupLink.split('token=')[1];
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token: setupToken, newPassword: 'Compliance-Pass-1' });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'hr@gate-compliance.test', password: 'Compliance-Pass-1' });
  check('admin logs in', login.status === 200 && !!login.body.token);
  const token = `Bearer ${login.body.token}`;

  // sponsored worker
  const emp = await request(app)
    .post('/api/employees')
    .set('Authorization', token)
    .send({
      firstName: 'Gate',
      lastName: 'Sponsored',
      email: 'sponsored@gate-compliance.test',
      jobTitle: 'Care Assistant',
    });
  check('sponsored employee created', emp.status === 200 || emp.status === 201);
  const employeeId = emp.body.id;

  const sponsorship = await request(app)
    .post('/api/sponsorships')
    .set('Authorization', token)
    .send({
      employeeId,
      visaType: 'Skilled Worker',
      startDate: '2026-01-01',
      cosSalary: 30000,
      socCode: '6145',
      jobTitleOnCos: 'Care worker',
    });
  check(
    'sponsorship carries CoS terms',
    sponsorship.status === 200 || sponsorship.status === 201,
  );
  const sponsorshipId = sponsorship.body.id;

  // --- unauthorised absence (C1.15) -------------------------------------
  let markedOk = true;
  for (const date of ABSENCE_DAYS.slice(0, 9)) {
    const res = await request(app)
      .post('/api/absences')
      .set('Authorization', token)
      .send({ employeeId, date, status: 'UNAUTHORISED' });
    if (res.status !== 201 && res.status !== 200) markedOk = false;
  }
  check('nine absence days recorded', markedOk);

  const nineDay = await detectUnauthorisedAbsence(SWEEP_NOW);
  check(
    'no event at nine working days',
    nineDay.eventsCreated === 0,
    `created ${nineDay.eventsCreated}`,
  );

  await request(app)
    .post('/api/absences')
    .set('Authorization', token)
    .send({ employeeId, date: ABSENCE_DAYS[9], status: 'UNAUTHORISED' });

  const tenDay = await detectUnauthorisedAbsence(SWEEP_NOW);
  check(
    'event raised at ten working days',
    tenDay.eventsCreated === 1,
    `created ${tenDay.eventsCreated}`,
  );

  const rerun = await detectUnauthorisedAbsence(SWEEP_NOW);
  check(
    'absence sweep is idempotent',
    rerun.eventsCreated === 0,
    `created ${rerun.eventsCreated}`,
  );

  const absenceEvents =
    await platformPrisma.sponsorshipReportableEvent.findMany({
      where: { sponsorshipId, eventType: 'UNAUTHORISED_ABSENCE_10_DAYS' },
    });
  const due = absenceEvents[0]?.dueDate?.toISOString().slice(0, 10);
  check(
    'due date is ten working days after the tenth day',
    due === '2026-10-02',
    `due ${due}`,
  );

  const ledger = await request(app)
    .get(`/api/absences/employee/${employeeId}?from=2026-09-01&to=2026-09-30`)
    .set('Authorization', token);
  check(
    'ledger reports a reportable spell',
    ledger.status === 200 &&
      ledger.body.unauthorisedSpells?.[0]?.reportable === true,
    `spells ${JSON.stringify(ledger.body.unauthorisedSpells ?? [])}`,
  );

  // --- salary reconciliation --------------------------------------------
  const payCsv = Buffer.from(
    'Email,Period Start,Period End,Gross Pay\n' +
      'sponsored@gate-compliance.test,2026-01-01,2026-01-31,"£1,500"\n' +
      'sponsored@gate-compliance.test,2026-02-01,2026-02-28,"£2,600"\n',
  );
  const payDry = await request(app)
    .post('/api/pay/import?dryRun=true')
    .set('Authorization', token)
    .attach('file', payCsv, 'pay.csv');
  check(
    'payroll dry run parses pound signs',
    payDry.status === 200 && payDry.body.summary.errors === 0,
    JSON.stringify(payDry.body.summary ?? payDry.body),
  );

  const payImport = await request(app)
    .post('/api/pay/import')
    .set('Authorization', token)
    .attach('file', payCsv, 'pay.csv');
  check(
    'payroll imported',
    payImport.status === 200 && payImport.body.created === 2,
    JSON.stringify(payImport.body.summary ?? payImport.body),
  );

  const salary = await reconcileSalaries();
  check(
    'underpaid period raises one event',
    salary.eventsCreated === 1,
    `created ${salary.eventsCreated}`,
  );
  const salaryRerun = await reconcileSalaries();
  check(
    'salary sweep is idempotent',
    salaryRerun.eventsCreated === 0,
    `created ${salaryRerun.eventsCreated}`,
  );

  const assessed = await request(app)
    .get(`/api/pay/employee/${employeeId}`)
    .set('Authorization', token);
  check(
    'per-period assessment exposes the shortfall',
    assessed.status === 200 &&
      assessed.body.assessments?.some((a: any) => !a.compliant),
    `threshold known: ${assessed.body.thresholdKnown}`,
  );

  // --- Appendix D pack and readiness ------------------------------------
  const pack = await request(app)
    .get(`/api/sponsorships/${sponsorshipId}/compliance/pack`)
    .set('Authorization', token)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
  const zip = pack.body as Buffer;
  check(
    'audit pack downloads as a zip',
    pack.status === 200 &&
      zip.length > 0 &&
      zip.slice(0, 2).toString() === 'PK',
    `${zip?.length ?? 0} bytes`,
  );

  const compliance = await request(app)
    .get(`/api/sponsorships/${sponsorshipId}/compliance`)
    .set('Authorization', token);
  check(
    'completeness is reported as a percentage',
    compliance.status === 200 &&
      typeof compliance.body.completenessPercentage === 'number',
    `${compliance.body.completenessPercentage}%`,
  );
  check(
    'guidance version is surfaced',
    !!compliance.body.guidance?.appendixD,
    JSON.stringify(compliance.body.guidance ?? {}),
  );

  const readiness = await request(app)
    .get('/api/sponsorships/audit-readiness')
    .set('Authorization', token);
  check(
    'readiness score reflects the outstanding failures',
    readiness.status === 200 &&
      readiness.body.score < 100 &&
      readiness.body.band !== 'READY',
    `score ${readiness.body.score} band ${readiness.body.band}`,
  );
  check(
    'readiness explains itself',
    Array.isArray(readiness.body.components) &&
      readiness.body.components.length > 0,
    (readiness.body.components ?? []).map((c: any) => c.key).join(','),
  );

  console.log('\n=== P8 COMPLIANCE GATE ===');
  results.forEach((r) => console.log(r));
  console.log(
    results.some((r) => r.startsWith('FAIL'))
      ? '\nRESULT: FAIL'
      : '\nRESULT: PASS',
  );
  await platformPrisma.$disconnect();
  process.exit(process.exitCode || 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
