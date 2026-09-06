import React from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KpiTile,
  PageHeader,
  Skeleton,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
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
  hrFile: {
    reviewsDue30d: number;
    reviewsOverdue: number;
    onboardingOutstanding: number;
    expensesPending: number;
    expensesPendingValue: number;
    openCases: number;
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

const BAND_TONE: Record<string, 'ok' | 'warn' | 'bad'> = {
  READY: 'ok',
  AT_RISK: 'warn',
  NOT_READY: 'bad',
};

const BAND_LABEL: Record<string, string> = {
  READY: 'Ready',
  AT_RISK: 'At risk',
  NOT_READY: 'Not ready',
};

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

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
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return <KpiTile label={label} value={value} footnote={hint} badge={badge} />;
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
      <div className="w-40 flex-shrink-0 truncate text-sm text-ink-2">
        {label}
      </div>
      <div className="h-1.5 flex-1 rounded-full bg-surface-3">
        <div
          data-bar
          className="h-1.5 rounded-full bg-accent"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-20 flex-shrink-0 text-right text-sm font-medium tabular-nums text-ink">
        {formatNumber(value)}
        {suffix}
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'bad';
}) {
  return (
    <div>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd
        className={`mt-1 text-[26px] leading-none font-semibold tabular-nums ${
          tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'
        }`}
      >
        {value}
      </dd>
      {hint && <dd className="mt-1.5 text-xs text-ink-3">{hint}</dd>}
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
    <Button
      variant="secondary"
      size="sm"
      onClick={() => onExport(report)}
      loading={downloading === report}
      disabled={downloading !== null}
    >
      {label}
    </Button>
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
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} dense>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-[30px] w-16" />
            </Card>
          ))}
        </div>
        <Card>
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <EmptyState
        title="No reporting data is available"
        body={error || 'Nothing has been recorded for this company yet.'}
      />
    );
  }

  const { headcount, leave, expiries, timesheets, hrFile, readiness } = summary;
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
      <PageHeader
        title="Reports"
        subline={
          <>
            Headcount, leave, expiries and time across the whole organisation.
            Generated{' '}
            {new Date(summary.generatedAt).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            .
          </>
        }
      />

      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
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
            hint={`Evidence ${readiness.evidenceCompleteness}% complete`}
            badge={
              <Badge tone={BAND_TONE[readiness.band] ?? 'bad'}>
                {BAND_LABEL[readiness.band] ?? 'Not ready'}
              </Badge>
            }
          />
        )}
      </div>

      <Card
        title="Headcount by department"
        description={`${headcount.active} active · ${headcount.starters30d} joined and ${headcount.leavers30d} left in the last 30 days.`}
        action={
          <ExportButton
            report="headcount"
            downloading={downloading}
            onExport={exportReport}
          />
        }
      >
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
          <p className="text-sm text-ink-3">
            No departments recorded.
          </p>
        )}
      </Card>

      <Card
        title="Leave and absence"
        description={`Leave year ${leave.leaveYear.label}.`}
        action={
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
        }
      >
        <dl className="mb-5 grid gap-4 sm:grid-cols-3">
          <Figure
            label="Annual leave taken"
            value={`${formatNumber(leave.annualUsed)} days`}
          />
          <Figure
            label="Sickness taken"
            value={`${formatNumber(leave.sickUsed)} days`}
          />
          <Figure label="Pending requests" value={String(leave.pending)} />
        </dl>
        <h3 className="mb-3 text-[13px] font-medium text-ink-2">
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
          <p className="text-sm text-ink-3">
            No sickness recorded this leave year.
          </p>
        )}
      </Card>

      <Card
        title="Expiries"
        description={`${expiries.overdue} overdue · ${expiries.total} due within ${expiries.buckets[expiries.buckets.length - 1]} days.`}
        action={
          <ExportButton
            report="expiries"
            downloading={downloading}
            onExport={exportReport}
          />
        }
      >
        {expiries.byKind.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Kind</Th>
                <Th>Overdue</Th>
                {expiries.buckets.map((bucket) => (
                  <Th key={bucket}>{bucket} days</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expiries.byKind.map((row) => (
                <Tr key={row.kind}>
                  <Td className="text-ink">
                    {EXPIRY_LABELS[row.kind] ?? row.kind}
                  </Td>
                  <Td
                    className={`tabular-nums font-medium ${row.overdue > 0 ? 'text-bad' : 'text-ink-3'}`}
                  >
                    {row.overdue}
                  </Td>
                  {expiries.buckets.map((bucket) => (
                    <Td key={bucket} className="tabular-nums text-ink-2">
                      {bucketCount(row, bucket)}
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-ink-3">
            Nothing expiring in the next{' '}
            {expiries.buckets[expiries.buckets.length - 1]} days.
          </p>
        )}
      </Card>

      <Card
        title="Time by project"
        description={`${formatNumber(timesheets.hours)} hours across ${timesheets.entries} entries in ${monthLabel}.`}
        action={
          <ExportButton
            report="timesheets"
            downloading={downloading}
            onExport={exportReport}
          />
        }
      >
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
          <p className="text-sm text-ink-3">
            No hours recorded this month.
          </p>
        )}
      </Card>

      <Card
        title="HR file"
        description="Reviews, onboarding and expenses waiting on someone. Employee relations is a count only: who the cases concern stays on the cases screen."
      >
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Figure
            label="Reviews due in 30 days"
            value={String(hrFile.reviewsDue30d)}
          />
          <Figure
            label="Reviews overdue"
            value={String(hrFile.reviewsOverdue)}
            tone={hrFile.reviewsOverdue > 0 ? 'bad' : undefined}
          />
          <Figure
            label="Onboarding outstanding"
            value={String(hrFile.onboardingOutstanding)}
            tone={hrFile.onboardingOutstanding > 0 ? 'warn' : undefined}
          />
          <Figure
            label="Expenses pending"
            value={String(hrFile.expensesPending)}
            hint={`${gbp.format(hrFile.expensesPendingValue)} awaiting a decision`}
          />
          <Figure label="Open cases" value={String(hrFile.openCases)} />
        </dl>
      </Card>

      {readiness && (
        <Card title="Sponsor audit readiness">
          <div className="flex items-center gap-3">
            <span className="font-display text-[34px] leading-none font-semibold tabular-nums text-ink">
              {readiness.score}
            </span>
            <span className="text-[15px] font-medium text-ink-3">/100</span>
            <Badge tone={BAND_TONE[readiness.band] ?? 'bad'}>
              {BAND_LABEL[readiness.band] ?? 'Not ready'}
            </Badge>
          </div>
          <div className="mt-3 h-1 w-full max-w-[320px] rounded-full bg-surface-3">
            <div
              className="h-1 rounded-full bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, readiness.score))}%` }}
            />
          </div>
          <p className="mt-3 text-[13px] text-ink-2">
            {readiness.activeSponsorships} sponsored{' '}
            {readiness.activeSponsorships === 1 ? 'worker' : 'workers'} ·
            evidence {readiness.evidenceCompleteness}% complete
          </p>
          {readiness.components.length > 0 && (
            <ul className="mt-4 border-t border-line pt-3">
              {readiness.components.map((component) => (
                <li
                  key={component.key}
                  className="flex items-baseline justify-between gap-4 py-1.5 text-sm"
                >
                  <span className="text-ink-2">{component.label}</span>
                  <span className="font-mono text-[13px] flex-shrink-0 text-ink">
                    {component.count} ·{' '}
                    <span className="text-bad">−{component.penalty}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
