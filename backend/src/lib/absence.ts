import {
  DEFAULT_WORKING_DAY_CONFIG,
  WorkingDayConfig,
  eachWorkingDay,
  toIsoDate,
} from './workingDays';

// Absence derivation. Deliberately conservative about UNAUTHORISED: only an
// explicit manual mark produces it. Most SMEs do not log timesheets daily, so
// treating a timesheet gap as unauthorised would raise Home Office reports off
// the back of nothing more than paperwork nobody filled in. Gaps surface as
// UNKNOWN — a prompt for HR to confirm, never a report trigger.

export type AbsenceStatus = 'AUTHORISED' | 'UNAUTHORISED' | 'SICK' | 'UNKNOWN';
export type AbsenceSource = 'LEAVE_REQUEST' | 'TIMESHEET_GAP' | 'MANUAL';

export type LedgerDay = {
  date: Date;
  iso: string;
  status: AbsenceStatus;
  source: AbsenceSource;
  notes?: string | null;
};

type LeaveInput = {
  type: string;
  status: string;
  startDate: Date;
  endDate: Date;
};
type ManualInput = {
  date: Date;
  status: string;
  source: string;
  notes?: string | null;
};

export type DeriveInput = {
  from: Date;
  to: Date;
  config?: WorkingDayConfig;
  leave?: LeaveInput[];
  /** Dates the employee logged time against. Only consulted when the tenant uses timesheets. */
  timesheetDates?: Date[];
  /** Persisted AbsenceRecord rows. These win over everything derived. */
  manual?: ManualInput[];
  /** Timesheet gaps are only meaningful for tenants that actually log time. */
  useTimesheetGaps?: boolean;
};

const SICK_TYPES = new Set(['SICK', 'SICKNESS', 'SICK_LEAVE']);

function leaveStatusFor(type: string): AbsenceStatus {
  return SICK_TYPES.has((type || '').toUpperCase()) ? 'SICK' : 'AUTHORISED';
}

function coversDay(leave: LeaveInput, iso: string) {
  return toIsoDate(leave.startDate) <= iso && iso <= toIsoDate(leave.endDate);
}

/**
 * Day-by-day status for the working days in [from, to]. Precedence is
 * MANUAL > approved LEAVE_REQUEST > TIMESHEET_GAP; plain attended days are
 * omitted entirely, so the ledger only ever holds exceptions.
 */
export function deriveLedger(input: DeriveInput): LedgerDay[] {
  const config = input.config ?? DEFAULT_WORKING_DAY_CONFIG;
  const approvedLeave = (input.leave ?? []).filter(
    (l) => l.status === 'APPROVED',
  );
  const manualByDate = new Map(
    (input.manual ?? []).map((m) => [toIsoDate(m.date), m]),
  );
  const loggedTime = new Set((input.timesheetDates ?? []).map(toIsoDate));

  const ledger: LedgerDay[] = [];

  for (const date of eachWorkingDay(input.from, input.to, config)) {
    const iso = toIsoDate(date);

    const manual = manualByDate.get(iso);
    if (manual) {
      ledger.push({
        date,
        iso,
        status: manual.status as AbsenceStatus,
        source: (manual.source as AbsenceSource) ?? 'MANUAL',
        notes: manual.notes ?? null,
      });
      continue;
    }

    const leave = approvedLeave.find((l) => coversDay(l, iso));
    if (leave) {
      ledger.push({
        date,
        iso,
        status: leaveStatusFor(leave.type),
        source: 'LEAVE_REQUEST',
      });
      continue;
    }

    if (input.useTimesheetGaps && !loggedTime.has(iso)) {
      ledger.push({ date, iso, status: 'UNKNOWN', source: 'TIMESHEET_GAP' });
    }
  }

  return ledger;
}

export type AbsenceSpell = {
  start: Date;
  end: Date;
  workingDays: number;
};

/**
 * Runs of consecutive unauthorised *working* days. A working day that is not
 * UNAUTHORISED breaks the run; weekends and bank holidays do not, which is
 * what "consecutive working days" means in sponsor guidance C1.15.
 */
export function findUnauthorisedSpells(
  ledger: LedgerDay[],
  from: Date,
  to: Date,
  config: WorkingDayConfig = DEFAULT_WORKING_DAY_CONFIG,
): AbsenceSpell[] {
  const byDate = new Map(ledger.map((day) => [day.iso, day]));
  const spells: AbsenceSpell[] = [];
  let current: Date[] = [];

  const flush = () => {
    if (current.length) {
      spells.push({
        start: current[0],
        end: current[current.length - 1],
        workingDays: current.length,
      });
      current = [];
    }
  };

  // Every working day in the range, in order. A day with no ledger entry means
  // the employee attended, which breaks the run.
  for (const date of eachWorkingDay(from, to, config)) {
    if (byDate.get(toIsoDate(date))?.status === 'UNAUTHORISED') {
      current.push(date);
    } else {
      flush();
    }
  }
  flush();

  return spells;
}
