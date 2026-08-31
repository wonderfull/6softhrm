import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import {
  detectUnauthorisedAbsence,
  UNAUTHORISED_ABSENCE_EVENT,
} from '../lib/absenceDetection';
import { testPrisma as prisma, testTenantId } from './helpers/tenantTest';
import { toIsoDate } from '../lib/workingDays';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// Mon 7 Sep 2026 onwards — three clean working weeks, no bank holidays.
const WEEK_1 = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
];
const WEEK_2 = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
];
const NOW = d('2026-09-30');

describe('unauthorised absence detection (C1.15)', () => {
  let employeeId: number;
  let sponsorshipId: number;

  const markAbsent = async (isos: string[]) => {
    for (const iso of isos) {
      await prisma.absenceRecord.create({
        data: {
          tenantId: testTenantId(),
          employeeId,
          date: d(iso),
          status: 'UNAUTHORISED',
          source: 'MANUAL',
        },
      });
    }
  };

  const openEvents = () =>
    prisma.sponsorshipReportableEvent.findMany({
      where: { sponsorshipId, eventType: UNAUTHORISED_ABSENCE_EVENT },
    });

  beforeAll(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.absenceRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
    await prisma.employee.deleteMany({});

    const employee = await prisma.employee.create({
      data: {
        firstName: 'Absent',
        lastName: 'Worker',
        email: 'absent@detection.test',
        employeeType: 'EMPLOYEE',
      },
    });
    employeeId = employee.id;

    const sponsorship = await prisma.sponsorship.create({
      data: {
        employeeId,
        visaType: 'Skilled Worker',
        startDate: d('2026-01-01'),
        active: true,
      },
    });
    sponsorshipId = sponsorship.id;
  });

  beforeEach(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.absenceRecord.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
  });

  afterAll(async () => {
    await prisma.sponsorshipReportableEvent.deleteMany({});
    await prisma.absenceRecord.deleteMany({});
    await prisma.sponsorship.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.$disconnect();
  });

  it('raises nothing at nine consecutive working days', async () => {
    await markAbsent([...WEEK_1, ...WEEK_2.slice(0, 4)]);
    const result = await detectUnauthorisedAbsence(NOW);
    expect(result.eventsCreated).toBe(0);
    expect(await openEvents()).toHaveLength(0);
  });

  it('raises exactly one event at ten consecutive working days', async () => {
    await markAbsent([...WEEK_1, ...WEEK_2]);
    const result = await detectUnauthorisedAbsence(NOW);
    expect(result.eventsCreated).toBe(1);

    const events = await openEvents();
    expect(events).toHaveLength(1);
    // Day 10 of the spell is Fri 18 Sep; the report is due 10 working days later.
    expect(toIsoDate(events[0].eventDate)).toBe('2026-09-18');
    expect(toIsoDate(events[0].dueDate)).toBe('2026-10-02');
    expect(events[0].status).toBe('OPEN');
  });

  it('is idempotent — a second sweep raises no duplicate', async () => {
    await markAbsent([...WEEK_1, ...WEEK_2]);
    await detectUnauthorisedAbsence(NOW);
    const second = await detectUnauthorisedAbsence(NOW);
    expect(second.eventsCreated).toBe(0);
    expect(await openEvents()).toHaveLength(1);
  });

  it('keeps the run intact when a manual mark overrides approved leave', async () => {
    await markAbsent([...WEEK_1, ...WEEK_2]);
    await prisma.leaveRequest.create({
      data: {
        tenantId: testTenantId(),
        employeeId,
        type: 'ANNUAL',
        startDate: d('2026-09-14'),
        endDate: d('2026-09-14'),
        status: 'APPROVED',
      },
    });
    // The manual mark still wins on the 14th, so the run is unbroken — this is
    // the documented precedence, and the spell should still be reportable.
    const result = await detectUnauthorisedAbsence(NOW);
    expect(result.eventsCreated).toBe(1);
  });

  it('ignores sponsorships that are no longer active', async () => {
    await markAbsent([...WEEK_1, ...WEEK_2]);
    await prisma.sponsorship.updateMany({
      where: { id: sponsorshipId },
      data: { active: false },
    });
    const result = await detectUnauthorisedAbsence(NOW);
    await prisma.sponsorship.updateMany({
      where: { id: sponsorshipId },
      data: { active: true },
    });
    expect(result.eventsCreated).toBe(0);
  });
});
