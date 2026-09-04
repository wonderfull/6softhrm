import React from 'react';
import Card from '../components/Card';
import { API_BASE_URL, apiGet } from '../lib/api';

// Management reporting: one read of /reports/summary feeds every panel, and
// each panel offers the same figures as a spreadsheet for board packs.

type Summary = {
  generatedAt: string;
  headcount: {
    active: number;
    starters30d: number;
    leavers30d: number;
    byDepartment: { name: string; count: number }[];
  };
  leave: {
    leaveYear: { label: string; start: string; end: string };
    pending: number;
    annualUsed: number;
    sickUsed: number;
    sickByDepartment: { name: string; days: number }[];
  };
  expiries: {
    buckets: number[];
    total: number;
    overdue: number;
    byKind: ExpiryRow[];
  };
  timesheets: {
    monthStart: string;
    hours: number;
    entries: number;
    byProject: { name: string; hours: number }[];
  };
  readiness: null | {
    score: number;
    band: 'READY' | 'AT_RISK' | 'NOT_READY';
    components: {
      key: string;
      label: string;
      penalty: number;
      count: number;
      detail?: string;
    }[];
    evidenceCompleteness: number;
    activeSponsorships: number;
  };
};

type ExpiryRow = {
  kind: string;
  overdue: number;
  '30': number;
  '60': number;
  '90': number;
};

const EXPIRY_LABELS: Record<string, string> = {
  VISA: 'Visa',
  CONTRACT: 'Contract',
  VISA_DOCUMENT: 'Visa document',
  PASSPORT: 'Passport',
  DBS_RECHECK: 'DBS recheck',
  RTW_RECHECK: 'Right-to-work recheck',
  LICENCE: 'Sponsor licence',
  ACTION_PLAN: 'Action plan',
  COS_START_BY: 'CoS start-by',
};

const BAND_STYLES: Record<string, string> = {
  READY: 'from-emerald-500 to-emerald-600',
  AT_RISK: 'from-amber-500 to-amber-600',
  NOT_READY: 'from-rose-500 to-rose-600',
};

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function bucketCount(row: ExpiryRow, bucket: number) {
  return row[String(bucket) as '30' | '60' | '90'] ?? 0;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <div className="text-sm text-slate-600 dark:text-slate-300">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </Card>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix = '',
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  // Floor the width at 2% so a small-but-real value still draws a bar.
  const width = max > 0 && value > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 flex-shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">
        {label}
      </div>
      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className="h-2 rounded-full bg-primary-500"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-20 flex-shrink-0 text-right text-sm font-semibold text-slate-900 dark:text-white">
        {formatNumber(value)}
        {suffix}
      </div>
    </div>
  );
}

function ExportButton({
  report,
  label = 'Export',
  downloading,
  onExport,
}: {
  report: string;
  label?: string;
  downloading: string | null;
  onExport: (report: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onExport(report)}
      disabled={downloading !== null}
      className="btn-primary text-sm disabled:opacity-50"
    >
      {downloading === report ? 'Exporting…' : label}
    </button>
  );
}

export default function Reports() {
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiGet('/reports/summary')
      .then((data) => setSummary(data))
      .catch((err: any) =>
        setError(err?.message || 'Could not load the reporting summary.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const exportReport = async (report: string) => {
    setDownloading(report);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/reports/export/${report}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || 'Export failed');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Export failed');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading reports…
        </p>
      </Card>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
        {error || 'No reporting data is available.'}
      </div>
    );
  }

  const { headcount, leave, expiries, timesheets, readiness } = summary;
  const maxDepartment = Math.max(
    ...headcount.byDepartment.map((d) => d.count),
    0,
  );
  const maxSickDays = Math.max(...leave.sickByDepartment.map((d) => d.days), 0);
  const maxProjectHours = Math.max(
    ...timesheets.byProject.map((p) => p.hours),
    0,
  );
  const monthLabel = new Date(timesheets.monthStart).toLocaleDateString(
    'en-GB',
    { month: 'long', year: 'numeric' },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Reports
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Headcount, leave, expiries and time across the whole organisation.
          Generated{' '}
          {new Date(summary.generatedAt).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          .
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      <div
        className={`grid gap-4 sm:grid-cols-2 ${readiness ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
      >
        <Kpi
          label="Active headcount"
          value={String(headcount.active)}
          hint="Employees currently on the books"
        />
        <Kpi
          label="Starters / leavers"
          value={`${headcount.starters30d} / ${headcount.leavers30d}`}
          hint="Last 30 days"
        />
        <Kpi
          label="Leave pending"
          value={String(leave.pending)}
          hint="Requests awaiting approval"
        />
        <Kpi
          label="Hours this month"
          value={formatNumber(timesheets.hours)}
          hint={`${timesheets.entries} entries · ${monthLabel}`}
        />
        {readiness && (
          <Kpi
            label="Audit readiness"
            value={`${readiness.score}/100`}
            hint={String(readiness.band).replace('_', ' ')}
          />
        )}
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Headcount by department
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {headcount.active} active · {headcount.starters30d} joined and{' '}
              {headcount.leavers30d} left in the last 30 days.
            </p>
          </div>
          <ExportButton
            report="headcount"
            downloading={downloading}
            onExport={exportReport}
          />
        </div>
        {headcount.byDepartment.length ? (
          <div className="space-y-2">
            {headcount.byDepartment.map((dept) => (
              <BarRow
                key={dept.name}
                label={dept.name}
                value={dept.count}
                max={maxDepartment}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No departments recorded.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Leave and absence
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Leave year {leave.leaveYear.label}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton
              report="leave"
              label="Export leave"
              downloading={downloading}
              onExport={exportReport}
            />
            <ExportButton
              report="absence"
              label="Export absence"
              downloading={downloading}
              onExport={exportReport}
            />
          </div>
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Annual leave taken
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(leave.annualUsed)} days
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Sickness taken
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {formatNumber(leave.sickUsed)} days
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Pending requests
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {leave.pending}
            </div>
          </div>
        </div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Sickness by department
        </h3>
        {leave.sickByDepartment.length ? (
          <div className="space-y-2">
            {leave.sickByDepartment.map((dept) => (
              <BarRow
                key={dept.name}
                label={dept.name}
                value={dept.days}
                max={maxSickDays}
                suffix=" d"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No sickness recorded this leave year.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Expiries
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {expiries.overdue} overdue · {expiries.total} due within{' '}
              {expiries.buckets[expiries.buckets.length - 1]} days.
            </p>
          </div>
          <ExportButton
            report="expiries"
            downloading={downloading}
            onExport={exportReport}
          />
        </div>
        {expiries.byKind.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Overdue</th>
                  {expiries.buckets.map((bucket) => (
                    <th key={bucket} className="px-3 py-2">
                      {bucket} days
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiries.byKind.map((row) => (
                  <tr
                    key={row.kind}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {EXPIRY_LABELS[row.kind] ?? row.kind}
                    </td>
                    <td className="px-3 py-2 font-semibold text-rose-700 dark:text-rose-300">
                      {row.overdue}
                    </td>
                    {expiries.buckets.map((bucket) => (
                      <td
                        key={bucket}
                        className="px-3 py-2 text-slate-600 dark:text-slate-300"
                      >
                        {bucketCount(row, bucket)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nothing expiring in the next{' '}
            {expiries.buckets[expiries.buckets.length - 1]} days.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Time by project
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {formatNumber(timesheets.hours)} hours across {timesheets.entries}{' '}
              entries in {monthLabel}.
            </p>
          </div>
          <ExportButton
            report="timesheets"
            downloading={downloading}
            onExport={exportReport}
          />
        </div>
        {timesheets.byProject.length ? (
          <div className="space-y-2">
            {timesheets.byProject.map((project) => (
              <BarRow
                key={project.name}
                label={project.name}
                value={project.hours}
                max={maxProjectHours}
                suffix=" h"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hours recorded this month.
          </p>
        )}
      </Card>

      {readiness && (
        <div
          className={`rounded-xl shadow-lg p-6 text-white bg-gradient-to-br ${BAND_STYLES[readiness.band] ?? BAND_STYLES.NOT_READY}`}
        >
          <div className="text-white/80 text-sm mb-1">
            Sponsor audit readiness
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold">{readiness.score}</span>
            <span className="text-lg font-medium">
              /100 · {String(readiness.band).replace('_', ' ')}
            </span>
          </div>
          <div className="text-white/80 text-sm mt-1">
            {readiness.activeSponsorships} sponsored{' '}
            {readiness.activeSponsorships === 1 ? 'worker' : 'workers'} ·
            evidence {readiness.evidenceCompleteness}% complete
          </div>
          {readiness.components.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-white/20 pt-3">
              {readiness.components.map((component) => (
                <li
                  key={component.key}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="text-white/90">{component.label}</span>
                  <span className="font-semibold flex-shrink-0">
                    {component.count} · −{component.penalty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
