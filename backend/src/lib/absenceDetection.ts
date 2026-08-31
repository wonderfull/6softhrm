import prisma, { platformPrisma } from '../prismaClient';
import { currentTenantId, runWithTenant } from './tenantContext';
import { deriveLedger, findUnauthorisedSpells } from './absence';
import { loadWorkingDayConfig } from './tenantSettings';
import { addUtcDays, addWorkingDays, toIsoDate } from './workingDays';

// Sponsor guidance Part 3 C1.15: a sponsor must report a worker absent without
// permission for more than 10 consecutive working days, within 10 working days
// of that point. This sweep is the only thing that raises the event, so it has
// to be idempotent — it re-runs daily over the same window.

export const UNAUTHORISED_ABSENCE_EVENT = 'UNAUTHORISED_ABSENCE_10_DAYS';
const TRIGGER_WORKING_DAYS = 10;
const LOOKBACK_DAYS = 180;

export type AbsenceSweepResult = {
  tenantsScanned: number;
  sponsorshipsScanned: number;
  eventsCreated: number;
  errors: string[];
};

/**
 * One tenant's sweep. Runs inside that tenant's context so every query is
 * scoped and the working-day calendar is the tenant's own.
 */
async function sweepTenant(
  tenantId: number,
  now: Date,
  result: AbsenceSweepResult,
) {
  const config = await loadWorkingDayConfig(tenantId);
  const to = now;
  const from = addUtcDays(now, -LOOKBACK_DAYS);

  const sponsorships = await prisma.sponsorship.findMany({
    where: { active: true },
    include: { employee: true },
  });

  for (const sponsorship of sponsorships) {
    result.sponsorshipsScanned += 1;

    const [leave, manual] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { employeeId: sponsorship.employeeId, endDate: { gte: from } },
      }),
      prisma.absenceRecord.findMany({
        where: {
          employeeId: sponsorship.employeeId,
          date: { gte: from, lte: to },
        },
      }),
    ]);

    const ledger = deriveLedger({ from, to, config, leave, manual });
    const spells = findUnauthorisedSpells(ledger, from, to, config).filter(
      (spell) => spell.workingDays >= TRIGGER_WORKING_DAYS,
    );

    for (const spell of spells) {
      // Day 1 of the spell is the start, so the duty bites on the 10th.
      const eventDate = addWorkingDays(
        spell.start,
        TRIGGER_WORKING_DAYS - 1,
        config,
      );
      const dueDate = addWorkingDays(eventDate, TRIGGER_WORKING_DAYS, config);

      const existing = await prisma.sponsorshipReportableEvent.findFirst({
        where: {
          sponsorshipId: sponsorship.id,
          eventType: UNAUTHORISED_ABSENCE_EVENT,
          eventDate,
        },
      });
      if (existing) continue;

      await prisma.sponsorshipReportableEvent.create({
        data: {
          tenantId: currentTenantId(),
          sponsorshipId: sponsorship.id,
          eventType: UNAUTHORISED_ABSENCE_EVENT,
          eventDate,
          dueDate,
          status: 'OPEN',
          notes:
            `Unauthorised absence of ${spell.workingDays} consecutive working days ` +
            `from ${toIsoDate(spell.start)} to ${toIsoDate(spell.end)}. ` +
            'Reportable under sponsor guidance Part 3 C1.15.',
        },
      });
      result.eventsCreated += 1;
    }
  }
}

export async function detectUnauthorisedAbsence(
  now = new Date(),
): Promise<AbsenceSweepResult> {
  const result: AbsenceSweepResult = {
    tenantsScanned: 0,
    sponsorshipsScanned: 0,
    eventsCreated: 0,
    errors: [],
  };

  const tenants = await platformPrisma.tenant.findMany({
    where: { status: { not: 'SUSPENDED' } },
    select: { id: true },
  });

  for (const tenant of tenants) {
    result.tenantsScanned += 1;
    try {
      await runWithTenant({ tenantId: tenant.id }, () =>
        sweepTenant(tenant.id, now, result),
      );
    } catch (err: any) {
      // One tenant's bad data must not stop the sweep for everyone else.
      result.errors.push(`tenant ${tenant.id}: ${err?.message || String(err)}`);
    }
  }

  return result;
}
