import prisma, { platformPrisma } from '../prismaClient';
import { currentTenantId, runWithTenant } from './tenantContext';
import { loadWorkingDayConfig } from './tenantSettings';
import { addWorkingDays, toIsoDate } from './workingDays';
import { SALARY_SHORTFALL_EVENT, failingPeriods } from './salaryReconciliation';

// Raises a reportable event for each pay period where a sponsored worker was
// paid below their CoS terms. Idempotent: one event per (sponsorship, period).

const REPORT_WINDOW_WORKING_DAYS = 10;

export type SalarySweepResult = {
  tenantsScanned: number;
  sponsorshipsScanned: number;
  periodsAssessed: number;
  eventsCreated: number;
  missingCosTerms: number;
  errors: string[];
};

async function sweepTenant(tenantId: number, result: SalarySweepResult) {
  const config = await loadWorkingDayConfig(tenantId);

  const sponsorships = await prisma.sponsorship.findMany({
    where: { active: true },
    include: { employee: true },
  });

  for (const sponsorship of sponsorships) {
    result.sponsorshipsScanned += 1;

    if (!sponsorship.cosSalary && !sponsorship.goingRateSalary) {
      result.missingCosTerms += 1;
      continue;
    }

    const periods = await prisma.payRecord.findMany({
      where: { employeeId: sponsorship.employeeId },
      orderBy: { periodStart: 'asc' },
    });
    result.periodsAssessed += periods.length;

    const failures = failingPeriods(periods, {
      cosSalary: sponsorship.cosSalary,
      goingRateSalary: sponsorship.goingRateSalary,
    });

    for (const failure of failures) {
      const existing = await prisma.sponsorshipReportableEvent.findFirst({
        where: {
          sponsorshipId: sponsorship.id,
          eventType: SALARY_SHORTFALL_EVENT,
          eventDate: failure.periodEnd,
        },
      });
      if (existing) continue;

      await prisma.sponsorshipReportableEvent.create({
        data: {
          tenantId: currentTenantId(),
          sponsorshipId: sponsorship.id,
          eventType: SALARY_SHORTFALL_EVENT,
          eventDate: failure.periodEnd,
          dueDate: addWorkingDays(
            failure.periodEnd,
            REPORT_WINDOW_WORKING_DAYS,
            config,
          ),
          status: 'OPEN',
          notes:
            `Pay period ${toIsoDate(failure.periodStart)} to ${toIsoDate(failure.periodEnd)}: ` +
            `gross ${failure.grossPay.toFixed(2)} annualises to ${failure.annualisedPay.toFixed(2)}, ` +
            `below the required ${failure.requiredAnnualSalary.toFixed(2)} ` +
            `(shortfall ${failure.shortfall.toFixed(2)}).`,
        },
      });
      result.eventsCreated += 1;
    }
  }
}

export async function reconcileSalaries(): Promise<SalarySweepResult> {
  const result: SalarySweepResult = {
    tenantsScanned: 0,
    sponsorshipsScanned: 0,
    periodsAssessed: 0,
    eventsCreated: 0,
    missingCosTerms: 0,
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
        sweepTenant(tenant.id, result),
      );
    } catch (err: any) {
      result.errors.push(`tenant ${tenant.id}: ${err?.message || String(err)}`);
    }
  }

  return result;
}
