import React from 'react';
import { apiGet } from '../lib/api';
import Card from './Card';
import { LEAVE_TYPE_LABELS } from '../lib/leave';

type Entry = {
  id: number;
  employeeId: number;
  employeeName: string;
  department: string | null;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (value: number) => String(value).padStart(2, '0');

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

const dayPart = (value: string) => value.slice(0, 10);

// Monday-first column index for a day of the month.
function weekdayIndex(year: number, month: number, day: number) {
  return (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7;
}

function eachDayBetween(start: string, end: string) {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// The backend blanks the type to 'LEAVE' for colleagues whose details the
// viewer is not allowed to see — never guess a real reason from that.
function entryLabel(type: string) {
  if (type === 'LEAVE') return 'Away';
  return LEAVE_TYPE_LABELS[type] || type;
}

function chipClass(entry: Entry) {
  if (entry.status === 'PENDING')
    return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100';
  if (entry.type === 'SICK')
    return 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100';
  return 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100';
}

export default function LeaveCalendar() {
  const now = new Date();
  const [month, setMonth] = React.useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [department, setDepartment] = React.useState('');
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [bankHolidays, setBankHolidays] = React.useState<string[]>([]);
  const [departments, setDepartments] = React.useState<string[]>([]);
  const [error, setError] = React.useState('');

  const daysInMonth = new Date(
    Date.UTC(month.year, month.month + 1, 0),
  ).getUTCDate();
  const from = isoDate(month.year, month.month, 1);
  const to = isoDate(month.year, month.month, daysInMonth);

  React.useEffect(() => {
    let cancelled = false;
    apiGet(
      '/leave/calendar',
      department ? { from, to, department } : { from, to },
    )
      .then((data) => {
        if (cancelled) return;
        const rows: Entry[] = data.entries || [];
        setEntries(rows);
        setBankHolidays(data.bankHolidays || []);
        setError('');
        // Only an unfiltered response sees every department, so the filter
        // options must not be rebuilt from a filtered one.
        if (!department) {
          setDepartments(
            Array.from(
              new Set(
                rows
                  .map((entry) => entry.department)
                  .filter(Boolean) as string[],
              ),
            ).sort(),
          );
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setEntries([]);
        setBankHolidays([]);
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, department]);

  const entriesByDay = React.useMemo(() => {
    const map = new Map<string, Entry[]>();
    entries.forEach((entry) => {
      const start =
        dayPart(entry.startDate) < from ? from : dayPart(entry.startDate);
      const end = dayPart(entry.endDate) > to ? to : dayPart(entry.endDate);
      if (start > end) return;
      eachDayBetween(start, end).forEach((day) => {
        map.set(day, [...(map.get(day) || []), entry]);
      });
    });
    return map;
  }, [entries, from, to]);

  const holidaySet = React.useMemo(
    () => new Set(bankHolidays.map(dayPart)),
    [bankHolidays],
  );

  const shiftMonth = (delta: number) =>
    setMonth((current) => {
      const next = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });

  const monthLabel = new Date(
    Date.UTC(month.year, month.month, 1),
  ).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const leadingBlanks = weekdayIndex(month.year, month.month, 1);

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            ‹
          </button>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {monthLabel}
          </h3>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            ›
          </button>
        </div>
        <label className="text-sm">
          <span className="mr-2 font-medium">Department</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-700"
          >
            <option value="">All departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[45rem] grid-cols-7 gap-px rounded-lg bg-slate-200 dark:bg-slate-700">
          {WEEKDAYS.map((name) => (
            <div
              key={name}
              className="bg-slate-50 px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {name}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <div
              key={`blank-${index}`}
              className="min-h-24 bg-slate-50 dark:bg-slate-900"
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = isoDate(month.year, month.month, day);
            const column = weekdayIndex(month.year, month.month, day);
            const isWeekend = column >= 5;
            const isBankHoliday = holidaySet.has(date);
            return (
              <div
                key={date}
                data-testid={`day-${date}`}
                className={`min-h-24 p-1 ${
                  isBankHoliday
                    ? 'bg-amber-50 dark:bg-amber-900/30'
                    : isWeekend
                      ? 'bg-slate-100 dark:bg-slate-900'
                      : 'bg-white dark:bg-slate-800'
                }`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {day}
                  </span>
                  {isBankHoliday && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-200">
                      Bank holiday
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {(entriesByDay.get(date) || []).map((entry) => (
                    <div
                      key={`${entry.id}-${date}`}
                      className={`truncate rounded border px-1 py-0.5 text-[11px] ${chipClass(entry)}`}
                      title={`${entry.employeeName} — ${entryLabel(entry.type)}`}
                    >
                      {entry.employeeName} · {entryLabel(entry.type)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
