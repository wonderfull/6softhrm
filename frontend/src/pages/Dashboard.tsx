import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { apiGet, getCurrentUser, hasRole } from '../lib/api';
import { formatLeaveType } from '../lib/leave';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KpiTile,
  PageHeader,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';

// How many expiring rows the dashboard shows before sending the reader to the
// full list.
const EXPIRY_PREVIEW = 6;

const SUMMARY_TABS = [
  { key: 'leave' as const, label: 'Leave' },
  { key: 'overtime' as const, label: 'Overtime' },
];

function formatDashboardDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function daysUntil(value: string, now = new Date()) {
  return Math.ceil(
    (new Date(value).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB');
}

function remainingLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function calculateMonthlyOvertime(timesheets: any[], now = new Date()) {
  const currentMonthEntries = timesheets.filter((entry) => {
    const entryDate = new Date(entry.date);
    return (
      entryDate.getFullYear() === now.getFullYear() &&
      entryDate.getMonth() === now.getMonth()
    );
  });

  const hoursByDay = currentMonthEntries.reduce(
    (acc: Record<string, number>, entry) => {
      const key = new Date(entry.date).toISOString().slice(0, 10);
      acc[key] = (acc[key] || 0) + Number(entry.hours || 0);
      return acc;
    },
    {},
  );

  const overtimeHours = Object.values(hoursByDay).reduce(
    (sum, hours) => sum + Math.max(0, hours - 8),
    0,
  );
  const totalHours = currentMonthEntries.reduce(
    (sum, entry) => sum + Number(entry.hours || 0),
    0,
  );

  return { overtimeHours, totalHours };
}

// A label over a numeral, used inside the summary card. The KPI tile is a card
// in its own right, and cards do not nest.
function Metric({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  unit?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[13px] text-ink-2">{label}</div>
      {value !== undefined && (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-display text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-ink">
            {value}
          </span>
          {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// The shared Card header keeps its action on one line with the title; on a
// phone the document counts need to drop below it, so this section header
// wraps instead.
function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug text-ink">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>
        )}
      </div>
      {action && <div className="min-w-0">{action}</div>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState({
    totalEmployees: 0,
    totalProjects: 0,
    totalDocuments: 0,
    pendingLeave: 0,
  });
  const [loaded, setLoaded] = React.useState(false);
  const [expiringDocs, setExpiringDocs] = React.useState<any[]>([]);
  const [expiringSponsorships, setExpiringSponsorships] = React.useState<any[]>(
    [],
  );
  const [leaveRequests, setLeaveRequests] = React.useState<any[]>([]);
  const [timesheets, setTimesheets] = React.useState<any[]>([]);
  const [summaryTab, setSummaryTab] = React.useState<'leave' | 'overtime'>(
    'leave',
  );
  const [readiness, setReadiness] = React.useState<any>(null);
  const [balance, setBalance] = React.useState<any>(null);
  const [summary, setSummary] = React.useState<any>(null);

  const user = getCurrentUser();
  const isAdmin = hasRole(user, 'ADMIN');
  const isElevated = hasRole(user, 'ADMIN', 'DIRECTOR');
  const linkedEmployeeId = user?.employeeId ? Number(user.employeeId) : null;
  const hasEmployeeProfile = linkedEmployeeId !== null;
  const today = formatDashboardDate();

  React.useEffect(() => {
    // Elevated users read the organisation-wide numbers from the reporting
    // endpoint rather than counting four collections client-side. Leave and
    // timesheets are still fetched, but only for their own summary card.
    if (isElevated) {
      Promise.all([
        apiGet('/reports/summary').catch(() => null),
        apiGet('/documents/expiring').catch(() => []),
        apiGet('/sponsorships/expiring').catch(() => []),
        hasEmployeeProfile
          ? apiGet('/leave').catch(() => [])
          : Promise.resolve([]),
        hasEmployeeProfile
          ? apiGet('/timesheets').catch(() => [])
          : Promise.resolve([]),
      ]).then(
        ([
          reportSummary,
          expiringDocs,
          expiringSponsorships,
          leave,
          timesheets,
        ]) => {
          setSummary(reportSummary);
          setExpiringDocs(expiringDocs);
          setExpiringSponsorships(expiringSponsorships);
          setLeaveRequests(leave);
          setTimesheets(timesheets);
          setLoaded(true);
        },
      );
      return;
    }

    // Load dashboard statistics
    Promise.all([
      apiGet('/employees').catch(() => []),
      apiGet('/projects').catch(() => []),
      apiGet('/documents').catch(() => []),
      apiGet('/leave').catch(() => []),
      apiGet('/timesheets').catch(() => []),
      apiGet('/documents/expiring').catch(() => []),
      apiGet('/sponsorships/expiring').catch(() => []),
    ]).then(
      ([
        employees,
        projects,
        documents,
        leave,
        timesheets,
        expiringDocs,
        expiringSponsorships,
      ]) => {
        setStats({
          totalEmployees: employees.length,
          totalProjects: projects.filter((p: any) => p.active).length,
          totalDocuments: documents.length,
          pendingLeave: leave.filter((l: any) => l.status === 'PENDING').length,
        });
        setLeaveRequests(leave);
        setTimesheets(timesheets);
        setExpiringDocs(expiringDocs);
        setExpiringSponsorships(expiringSponsorships);
        setLoaded(true);
      },
    );
  }, [isElevated, hasEmployeeProfile]);

  React.useEffect(() => {
    // Compliance is a paid feature; a 403 here simply means no tile.
    if (!isAdmin) return;
    apiGet('/sponsorships/audit-readiness')
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, [isAdmin]);

  React.useEffect(() => {
    if (!hasEmployeeProfile) return;
    apiGet('/leave/balance')
      .then((r) => setBalance(typeof r?.remaining === 'number' ? r : null))
      .catch(() => setBalance(null));
  }, [hasEmployeeProfile]);

  const ownLeaveRequests = hasEmployeeProfile
    ? leaveRequests.filter(
        (leave) => Number(leave.employeeId) === linkedEmployeeId,
      )
    : [];
  const ownTimesheets = hasEmployeeProfile
    ? timesheets.filter(
        (timesheet) => Number(timesheet.employeeId) === linkedEmployeeId,
      )
    : [];

  // Entitlement is the allowance actually available this leave year: the
  // prorated allowance plus anything carried over from last year.
  const leaveEntitlement = balance ? balance.prorated + balance.carriedOver : 0;
  const leaveAllowanceLabel = balance
    ? [
        `${formatNumber(leaveEntitlement)} days allowance`,
        balance.carriedOver
          ? `${formatNumber(balance.carriedOver)} carried over`
          : null,
        balance.leaveYear?.label,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const pendingLeaveCount = ownLeaveRequests.filter(
    (leave) => leave.status === 'PENDING',
  ).length;
  const nextLeave = ownLeaveRequests
    .filter(
      (leave) =>
        leave.status === 'APPROVED' && new Date(leave.startDate) >= new Date(),
    )
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )[0];
  const monthlyOvertime = calculateMonthlyOvertime(ownTimesheets);

  const readinessScore =
    readiness && typeof readiness.score === 'number' && readiness.band
      ? readiness.score
      : null;
  const readinessBand = readiness?.band;
  const readinessTone =
    readinessBand === 'READY'
      ? 'ok'
      : readinessBand === 'AT_RISK'
        ? 'warn'
        : 'bad';
  const readinessLabel =
    readinessBand === 'READY'
      ? 'Ready'
      : readinessBand === 'AT_RISK'
        ? 'At risk'
        : 'Not ready';
  // The one component costing the most points is the thing to fix first.
  const blockingIssue: any = Array.isArray(readiness?.components)
    ? [...readiness.components].sort(
        (a: any, b: any) => b.penalty - a.penalty,
      )[0]
    : null;

  const timesheetEntries = summary?.timesheets?.entries;
  const timesheetMonth = summary?.timesheets?.monthStart
    ? new Date(summary.timesheets.monthStart).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : '';
  const hoursFootnote =
    [
      typeof timesheetEntries === 'number'
        ? `${timesheetEntries} ${timesheetEntries === 1 ? 'entry' : 'entries'}`
        : null,
      timesheetMonth,
    ]
      .filter(Boolean)
      .join(' · ') || 'Recorded this month';

  const sortedDocs = [...expiringDocs].sort(
    (a, b) =>
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
  );
  const docsShown = sortedDocs.slice(0, EXPIRY_PREVIEW);
  const docsExpired = sortedDocs.filter((d) => daysUntil(d.expiryDate) < 0);
  const docsUnder7 = sortedDocs.filter((d) => {
    const days = daysUntil(d.expiryDate);
    return days >= 0 && days < 7;
  });
  const docsUnder30 = sortedDocs.filter((d) => daysUntil(d.expiryDate) >= 7);

  const sortedSponsorships = [...expiringSponsorships].sort(
    (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime(),
  );
  const sponsorshipsShown = sortedSponsorships.slice(0, EXPIRY_PREVIEW);

  const quickLinks = isAdmin
    ? [
        {
          to: '/employees',
          label: 'Employees',
          description: 'Manage employee records',
        },
        {
          to: '/projects',
          label: 'Projects',
          description: 'View and manage projects',
        },
        {
          to: '/documents',
          label: 'Documents',
          description: 'Access documents',
        },
        {
          to: '/leave',
          label: 'Leave requests',
          description: 'Manage leave requests',
        },
      ]
    : [
        {
          to: '/employees',
          label: 'My profile',
          description: 'View and update your details',
        },
        {
          to: '/time',
          label: 'Timesheet',
          description: 'Track your work hours',
        },
        {
          to: '/documents',
          label: 'My documents',
          description: 'Access your documents',
        },
        {
          to: '/leave',
          label: 'Leave requests',
          description: 'Request time off',
        },
      ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subline={today}
        actions={
          isAdmin ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/data-export')}
            >
              Export
            </Button>
          ) : undefined
        }
      />

      {/* Audit readiness is the number a director checks weekly. Home Office
          visits can be unannounced, so readiness is the product, not records. */}
      {readinessScore !== null && (
        <Card className="p-5">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 items-start">
            <div className="flex flex-col gap-2.5">
              <div className="text-[13px] text-ink-2">
                Sponsor audit readiness
              </div>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-display text-[34px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-ink">
                  {readinessScore}
                  <span className="font-medium text-ink-3">/100</span>
                </span>
                <Badge tone={readinessTone}>{readinessLabel}</Badge>
              </div>
              <div className="h-1 max-w-[320px] overflow-hidden rounded-sm bg-surface-3">
                <div
                  className="h-full rounded-sm bg-ink-3"
                  style={{
                    width: `${Math.max(0, Math.min(100, readinessScore))}%`,
                  }}
                />
              </div>
              <div className="text-xs text-ink-3">
                {readiness.activeSponsorships} sponsored{' '}
                {readiness.activeSponsorships === 1 ? 'worker' : 'workers'} ·
                evidence {readiness.evidenceCompleteness}% complete
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="text-[13px] text-ink-2">Blocking issue</div>
              {blockingIssue ? (
                <div className="flex items-baseline justify-between gap-3 rounded-md border border-line bg-bg px-3.5 py-3">
                  <span className="text-sm font-medium text-ink">
                    {blockingIssue.label}
                  </span>
                  <span className="whitespace-nowrap font-mono text-[13px] text-ink-2">
                    {blockingIssue.count} ·{' '}
                    <span className="text-bad">−{blockingIssue.penalty}</span>
                  </span>
                </div>
              ) : (
                <div className="rounded-md border border-line bg-bg px-3.5 py-3 text-sm text-ink-2">
                  Nothing outstanding.
                </div>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                <Link
                  to="/sponsorships"
                  className="font-medium text-link hover:underline"
                >
                  Review sponsorships →
                </Link>
                {readiness.guidance && (
                  <span className="font-mono text-xs text-ink-3">
                    Guidance: Part 3 {readiness.guidance.sponsorGuidancePart3} ·
                    Appendix D {readiness.guidance.appendixD}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {isElevated ? (
          <>
            <KpiTile
              label="Active headcount"
              value={summary?.headcount?.active ?? 0}
              footnote="Employees currently on the books"
              loading={!loaded}
            />
            <KpiTile
              label="Starters / leavers"
              value={`${summary?.headcount?.starters30d ?? 0} / ${summary?.headcount?.leavers30d ?? 0}`}
              footnote="Last 30 days"
              loading={!loaded}
            />
            <KpiTile
              label="Hours this month"
              value={formatNumber(summary?.timesheets?.hours ?? 0)}
              footnote={hoursFootnote}
              loading={!loaded}
            />
            <KpiTile
              label="Pending leave"
              value={summary?.leave?.pending ?? 0}
              footnote="Requests awaiting approval"
              loading={!loaded}
            />
          </>
        ) : (
          <>
            <KpiTile
              label="Total employees"
              value={stats.totalEmployees}
              footnote="Employees currently on the books"
              loading={!loaded}
            />
            <KpiTile
              label="Active projects"
              value={stats.totalProjects}
              footnote="Projects in progress"
              loading={!loaded}
            />
            <KpiTile
              label="Documents"
              value={stats.totalDocuments}
              footnote="Files on record"
              loading={!loaded}
            />
            <KpiTile
              label="Pending leave"
              value={stats.pendingLeave}
              footnote="Requests awaiting approval"
              loading={!loaded}
            />
          </>
        )}
      </section>

      {hasEmployeeProfile && (
        <Card flush>
          <SectionHeader
            title="My summary"
            description="Your leave and overtime at a glance."
            action={
              <div className="inline-flex rounded-md border border-line bg-surface-2 p-0.5">
                {SUMMARY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={summaryTab === tab.key}
                    onClick={() => setSummaryTab(tab.key)}
                    className={`h-7 rounded-sm px-3 text-[13px] font-medium transition-colors duration-hover ease-out ${
                      summaryTab === tab.key
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-5">
            {summaryTab === 'leave' ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
                <Metric
                  label="Annual leave"
                  value={balance ? formatNumber(balance.remaining) : undefined}
                  unit={balance ? 'days remaining' : undefined}
                >
                  {balance ? (
                    <>
                      <div className="mt-2.5 h-1 max-w-[320px] overflow-hidden rounded-sm bg-surface-3">
                        <div
                          className="h-full rounded-sm bg-ink-3"
                          style={{
                            width: `${
                              leaveEntitlement > 0
                                ? Math.min(
                                    100,
                                    (balance.remaining / leaveEntitlement) *
                                      100,
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 text-xs text-ink-3">
                        {formatNumber(balance.used)} days approved
                      </div>
                      <div className="mt-1 text-xs text-ink-3">
                        {leaveAllowanceLabel}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1.5 text-[15px] text-ink-2">
                      Balance unavailable
                    </div>
                  )}
                </Metric>

                <Metric
                  label="Pending requests"
                  value={pendingLeaveCount}
                  unit={`pending request${pendingLeaveCount === 1 ? '' : 's'}`}
                >
                  <div className="mt-2 text-xs text-ink-3">
                    Awaiting approval
                  </div>
                </Metric>

                <Metric label="Next up">
                  <div className="mt-1.5 text-[15px] font-medium text-ink">
                    {nextLeave
                      ? `${formatLeaveType(nextLeave.type)}, ${shortDate(nextLeave.startDate)}`
                      : 'No absences coming up'}
                  </div>
                  <Link
                    to="/leave"
                    className="mt-2 inline-flex text-[13px] font-medium text-link hover:underline"
                  >
                    View leave requests →
                  </Link>
                </Metric>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
                <Metric
                  label="Overtime this month"
                  value={formatNumber(monthlyOvertime.overtimeHours)}
                  unit="hours"
                >
                  <div className="mt-2 text-xs text-ink-3">
                    Hours over 8 per day
                  </div>
                </Metric>
                <Metric
                  label="Recorded hours"
                  value={formatNumber(monthlyOvertime.totalHours)}
                  unit="hours"
                >
                  <div className="mt-2 text-xs text-ink-3">
                    Current calendar month
                  </div>
                </Metric>
                <Metric label="Timesheet">
                  <div className="mt-1.5 text-[15px] font-medium text-ink">
                    Keep your hours up to date
                  </div>
                  <Link
                    to="/time"
                    className="mt-2 inline-flex text-[13px] font-medium text-link hover:underline"
                  >
                    Open timesheet →
                  </Link>
                </Metric>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card flush>
        <SectionHeader
          title="Document expiry"
          description={
            sortedDocs.length === 1
              ? '1 document expires within 30 days.'
              : `${sortedDocs.length} documents expire within 30 days.`
          }
          action={
            sortedDocs.length > 0 ? (
              <div className="flex gap-5">
                <span className="flex flex-col">
                  <span className="text-[18px] font-semibold leading-tight tabular-nums text-ink">
                    {docsExpired.length}
                  </span>
                  <span className="text-xs text-ink-3">Expired</span>
                </span>
                <span className="flex flex-col">
                  <span
                    className={`text-[18px] font-semibold leading-tight tabular-nums ${
                      docsUnder7.length > 0 ? 'text-warn' : 'text-ink'
                    }`}
                  >
                    {docsUnder7.length}
                  </span>
                  <span className="text-xs text-ink-3">Under 7 days</span>
                </span>
                <span className="flex flex-col">
                  <span className="text-[18px] font-semibold leading-tight tabular-nums text-ink">
                    {docsUnder30.length}
                  </span>
                  <span className="text-xs text-ink-3">8 to 30 days</span>
                </span>
              </div>
            ) : undefined
          }
        />
        {sortedDocs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<DocumentTextIcon />}
              title="Nothing expiring"
              body="No documents expire in the next 30 days."
            />
          </div>
        ) : (
          <>
            <Table className="min-w-[760px]">
              <thead>
                <tr>
                  <Th>Document</Th>
                  <Th>Type</Th>
                  <Th>Employee</Th>
                  <Th>Expiry date</Th>
                  <Th className="text-right">Remaining</Th>
                </tr>
              </thead>
              <tbody>
                {docsShown.map((doc: any) => {
                  const days = daysUntil(doc.expiryDate);
                  return (
                    <Tr key={doc.id}>
                      <Td className="font-medium text-ink">{doc.name}</Td>
                      <Td>{doc.type ? <Badge>{doc.type}</Badge> : null}</Td>
                      <Td className="text-ink-2">
                        {doc.employee
                          ? `${doc.employee.firstName} ${doc.employee.lastName}`
                          : ''}
                      </Td>
                      <Td className="font-mono text-[13px] text-ink-2">
                        {shortDate(doc.expiryDate)}
                      </Td>
                      <Td className="text-right">
                        <Badge tone={days < 1 ? 'bad' : 'warn'}>
                          {remainingLabel(days)}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-3">
              <span>
                Showing {docsShown.length} of {sortedDocs.length}
              </span>
              <Link
                to="/documents"
                className="font-medium text-link hover:underline"
              >
                View all in Documents →
              </Link>
            </div>
          </>
        )}
      </Card>

      {sortedSponsorships.length > 0 && (
        <Card flush>
          <SectionHeader
            title="Sponsorship expiry"
            description={
              sortedSponsorships.length === 1
                ? '1 sponsorship expires within 30 days.'
                : `${sortedSponsorships.length} sponsorships expire within 30 days.`
            }
          />
          <Table className="min-w-[760px]">
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Visa type</Th>
                <Th>CAS number</Th>
                <Th>Start date</Th>
                <Th>Expiry date</Th>
                <Th className="text-right">Remaining</Th>
              </tr>
            </thead>
            <tbody>
              {sponsorshipsShown.map((sponsorship: any) => {
                const days = daysUntil(sponsorship.endDate);
                return (
                  <Tr key={sponsorship.id}>
                    <Td className="font-medium text-ink">
                      {sponsorship.employee
                        ? `${sponsorship.employee.firstName} ${sponsorship.employee.lastName}`
                        : ''}
                    </Td>
                    <Td>
                      {sponsorship.visaType ? (
                        <Badge>{sponsorship.visaType}</Badge>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-[13px] text-ink-2">
                      {sponsorship.casNumber || 'Not set'}
                    </Td>
                    <Td className="font-mono text-[13px] text-ink-2">
                      {shortDate(sponsorship.startDate)}
                    </Td>
                    <Td className="font-mono text-[13px] text-ink-2">
                      {shortDate(sponsorship.endDate)}
                    </Td>
                    <Td className="text-right">
                      <Badge tone={days < 1 ? 'bad' : 'warn'}>
                        {remainingLabel(days)}
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-3">
            <span>
              Showing {sponsorshipsShown.length} of {sortedSponsorships.length}
            </span>
            <Link
              to="/sponsorships"
              className="font-medium text-link hover:underline"
            >
              View all in Sponsorships →
            </Link>
          </div>
        </Card>
      )}

      <Card title="Quick links">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-md border border-line bg-bg px-3.5 py-3 transition-colors duration-hover ease-out hover:bg-surface-2"
            >
              <span className="block text-sm font-medium text-ink">
                {link.label}
              </span>
              <span className="mt-0.5 block text-xs text-ink-3">
                {link.description}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
