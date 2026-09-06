import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reports from '../pages/Reports';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
  };
});

const SUMMARY = {
  generatedAt: '2026-09-04T09:00:00.000Z',
  headcount: {
    active: 42,
    starters30d: 3,
    leavers30d: 1,
    byDepartment: [
      { name: 'Care', count: 24 },
      { name: 'Operations', count: 12 },
    ],
  },
  leave: {
    leaveYear: {
      label: '6 Apr 2026 to 5 Apr 2027',
      start: '2026-04-06',
      end: '2027-04-05',
    },
    pending: 5,
    annualUsed: 87.5,
    sickUsed: 12,
    sickByDepartment: [
      { name: 'Care', days: 9 },
      { name: 'Operations', days: 3 },
    ],
  },
  expiries: {
    buckets: [30, 60, 90],
    total: 7,
    overdue: 2,
    byKind: [
      { kind: 'RTW_RECHECK', overdue: 2, '30': 1, '60': 0, '90': 1 },
      { kind: 'COS_START_BY', overdue: 0, '30': 0, '60': 2, '90': 1 },
    ],
  },
  timesheets: {
    monthStart: '2026-09-01',
    hours: 320.5,
    entries: 48,
    byProject: [
      { name: 'Ward cover', hours: 200 },
      { name: 'Training', hours: 120.5 },
    ],
  },
  hrFile: {
    reviewsDue30d: 4,
    reviewsOverdue: 2,
    onboardingOutstanding: 6,
    expensesPending: 3,
    expensesPendingValue: 412.5,
    openCases: 1,
  },
  readiness: {
    score: 62,
    band: 'AT_RISK',
    components: [
      {
        key: 'salaryFailures',
        label: 'Pay periods below the CoS salary',
        penalty: 20,
        count: 2,
        detail: '2 periods',
      },
    ],
    evidenceCompleteness: 80,
    activeSponsorships: 3,
  },
};

function mockSummary(summary: any = SUMMARY) {
  (api.apiGet as any).mockImplementation((path: string) =>
    path === '/reports/summary'
      ? Promise.resolve(summary)
      : Promise.resolve([]),
  );
}

const renderReports = () =>
  render(
    <MemoryRouter>
      <Reports />
    </MemoryRouter>,
  );

// Several figures repeat across the page, so KPI assertions are scoped to the
// card carrying the label rather than matched globally.
const kpi = (label: string) =>
  within(screen.getByText(label).closest('.bg-surface') as HTMLElement);

describe('Reports page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockSummary();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the headline numbers from the summary', async () => {
    renderReports();

    expect(await screen.findByText('Active headcount')).toBeInTheDocument();
    expect(kpi('Active headcount').getByText('42')).toBeInTheDocument();
    expect(kpi('Starters / leavers').getByText('3 / 1')).toBeInTheDocument();
    expect(kpi('Leave pending').getByText('5')).toBeInTheDocument();
    expect(kpi('Hours this month').getByText('320.5')).toBeInTheDocument();
    expect(kpi('Hours this month').getByText(/48 entries/)).toBeInTheDocument();
    expect(kpi('Audit readiness').getByText('62/100')).toBeInTheDocument();
    expect(api.apiGet).toHaveBeenCalledWith('/reports/summary');
  });

  it('draws breakdown bars in proportion to the largest value', async () => {
    const { container } = renderReports();

    await screen.findByText('Headcount by department');
    expect(screen.getAllByText('Care')).toHaveLength(2);
    expect(screen.getByText('Ward cover')).toBeInTheDocument();
    expect(screen.getByText('200 h')).toBeInTheDocument();
    expect(screen.getByText('120.5 h')).toBeInTheDocument();

    const bars = container.querySelectorAll<HTMLElement>('[data-bar]');
    // Two departments, two sickness rows, two projects.
    expect(bars).toHaveLength(6);
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
  });

  it('labels the expiry kinds readably', async () => {
    renderReports();

    expect(
      await screen.findByText('Right-to-work recheck'),
    ).toBeInTheDocument();
    expect(screen.getByText('CoS start-by')).toBeInTheDocument();
  });

  it('summarises the HR file without naming anyone', async () => {
    renderReports();

    const section = (await screen.findByText('HR file')).closest(
      '.bg-surface',
    ) as HTMLElement;
    expect(within(section).getByText('Reviews overdue')).toBeInTheDocument();
    expect(within(section).getByText('2')).toBeInTheDocument();
    expect(
      within(section).getByText('Onboarding outstanding'),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/£412\.50 awaiting a decision/),
    ).toBeInTheDocument();
    // Cases appear as a bare count — never a name, even on this admin page.
    expect(within(section).getByText('Open cases')).toBeInTheDocument();
    expect(within(section).getByText('1')).toBeInTheDocument();
  });

  it('omits the readiness card when compliance is switched off', async () => {
    mockSummary({ ...SUMMARY, readiness: null });
    renderReports();

    expect(await screen.findByText('Active headcount')).toBeInTheDocument();
    expect(screen.queryByText('Audit readiness')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Sponsor audit readiness'),
    ).not.toBeInTheDocument();
  });

  it('downloads a spreadsheet when a report is exported', async () => {
    (localStorage.getItem as any).mockReturnValue('token');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['xlsx'])),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderReports();
    const section = (
      await screen.findByText('Headcount by department')
    ).closest('.bg-surface') as HTMLElement;

    // Spying on the anchor prototype rather than document.createElement keeps
    // React's own DOM calls working while the download runs.
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const appendChild = vi.spyOn(document.body, 'appendChild');

    fireEvent.click(within(section).getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/reports/export/headcount'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
        }),
      );
      expect(click).toHaveBeenCalled();
    });

    const anchor = appendChild.mock.calls
      .map(([node]) => node as HTMLElement)
      .find((node) => node.tagName === 'A') as HTMLAnchorElement;
    expect(anchor.href).toBe('blob:report');
    expect(anchor.download).toMatch(/^headcount-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
