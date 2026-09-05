import prisma from '../prismaClient';
import { LeaveSettings } from './leave';
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

export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = {
  ...DEFAULT_WORKING_DAY_CONFIG,
  leaveYearStart: '01-01',
  defaultLeaveDays: 28,
  carryoverCapDays: 0,
};

/**
 * The calendar config plus the leave policy. Balances need both — the year
 * boundary and allowance come from the policy, the day count from the calendar.
 */
export async function loadLeaveSettings(
  tenantId?: number,
): Promise<LeaveSettings> {
  const settings = await prisma.tenantSettings.findFirst({
    ...(tenantId ? { where: { tenantId } } : {}),
    select: {
      workingDays: true,
      bankHolidayRegion: true,
      leaveYearStart: true,
      defaultLeaveDays: true,
      carryoverCapDays: true,
    },
  });

  if (!settings) return DEFAULT_LEAVE_SETTINGS;

  return {
    workingDays: settings.workingDays || DEFAULT_LEAVE_SETTINGS.workingDays,
    bankHolidayRegion:
      settings.bankHolidayRegion || DEFAULT_LEAVE_SETTINGS.bankHolidayRegion,
    leaveYearStart:
      settings.leaveYearStart || DEFAULT_LEAVE_SETTINGS.leaveYearStart,
    defaultLeaveDays:
      settings.defaultLeaveDays ?? DEFAULT_LEAVE_SETTINGS.defaultLeaveDays,
    carryoverCapDays:
      settings.carryoverCapDays ?? DEFAULT_LEAVE_SETTINGS.carryoverCapDays,
  };
}
