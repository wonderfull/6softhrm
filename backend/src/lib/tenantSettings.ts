import prisma from '../prismaClient';
import { DEFAULT_WORKING_DAY_CONFIG, WorkingDayConfig } from './workingDays';

// Deadline arithmetic must use the tenant's own calendar, so every caller that
// computes a working-day due date loads this first. Falls back to the England
// and Wales Mon-Fri default when a tenant has no settings row yet.
export async function loadWorkingDayConfig(
  tenantId?: number,
): Promise<WorkingDayConfig> {
  const settings = await prisma.tenantSettings.findFirst({
    ...(tenantId ? { where: { tenantId } } : {}),
    select: { workingDays: true, bankHolidayRegion: true },
  });

  if (!settings) return DEFAULT_WORKING_DAY_CONFIG;

  return {
    workingDays: settings.workingDays || DEFAULT_WORKING_DAY_CONFIG.workingDays,
    bankHolidayRegion:
      settings.bankHolidayRegion ||
      DEFAULT_WORKING_DAY_CONFIG.bankHolidayRegion,
  };
}
