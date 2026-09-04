import { platformPrisma } from '../prismaClient';
import { runWithTenant } from '../lib/tenantContext';
import { loadLeaveSettings, loadWorkingDayConfig } from '../lib/tenantSettings';
import { testTenantId } from './helpers/tenantTest';

// TenantSettings holds the leave policy and the working calendar. The tenantId
// argument on these loaders is optional, so anything that forgets it reads
// whichever row the database happens to return first — another company's.

const SLUG = 'settings-isolation-neighbour';
let neighbourId: number;

beforeAll(async () => {
  await platformPrisma.tenantSettings.deleteMany({
    where: { tenant: { slug: SLUG } },
  });
  await platformPrisma.tenant.deleteMany({ where: { slug: SLUG } });

  const neighbour = await platformPrisma.tenant.create({
    data: {
      slug: SLUG,
      name: 'Neighbour Ltd',
      settings: {
        create: {
          leaveYearStart: '07-01',
          defaultLeaveDays: 41,
          carryoverCapDays: 9,
          bankHolidayRegion: 'northern-ireland',
          workingDays: '2,3,4',
        },
      },
    },
  });
  neighbourId = neighbour.id;

  await platformPrisma.tenantSettings.deleteMany({
    where: { tenantId: testTenantId() },
  });
  await platformPrisma.tenantSettings.create({
    data: {
      tenantId: testTenantId(),
      leaveYearStart: '01-01',
      defaultLeaveDays: 28,
      carryoverCapDays: 0,
      bankHolidayRegion: 'england-and-wales',
      workingDays: '1,2,3,4,5',
    },
  });
});

afterAll(async () => {
  await platformPrisma.tenantSettings.deleteMany({
    where: { tenantId: neighbourId },
  });
  await platformPrisma.tenant.deleteMany({ where: { id: neighbourId } });
  await platformPrisma.tenantSettings.deleteMany({
    where: { tenantId: testTenantId() },
  });
  await platformPrisma.$disconnect();
});

describe('tenant settings are scoped to the caller', () => {
  it('never hands a caller another tenant\'s leave policy', async () => {
    const settings = await runWithTenant({ tenantId: testTenantId() }, () =>
      loadLeaveSettings(),
    );
    expect(settings.defaultLeaveDays).toBe(28);
    expect(settings.leaveYearStart).toBe('01-01');
  });

  it('never hands a caller another tenant\'s working calendar', async () => {
    const config = await runWithTenant({ tenantId: testTenantId() }, () =>
      loadWorkingDayConfig(),
    );
    expect(config.workingDays).toBe('1,2,3,4,5');
    expect(config.bankHolidayRegion).toBe('england-and-wales');
  });

  it('still reads the neighbour\'s own row inside their context', async () => {
    const settings = await runWithTenant({ tenantId: neighbourId }, () =>
      loadLeaveSettings(),
    );
    expect(settings.defaultLeaveDays).toBe(41);
    expect(settings.workingDays).toBe('2,3,4');
  });
});
