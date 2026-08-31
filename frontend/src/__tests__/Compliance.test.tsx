import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Compliance from '../pages/Compliance';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiUpload: vi.fn(),
  };
});

const EMPLOYEES = [{ id: 7, firstName: 'Absent', lastName: 'Worker' }];

const LEDGER = {
  employeeId: 7,
  from: '2026-09-01',
  to: '2026-09-30',
  days: [
    {
      date: '2026-09-07',
      status: 'UNAUTHORISED',
      source: 'MANUAL',
      notes: null,
    },
    {
      date: '2026-09-08',
      status: 'SICK',
      source: 'LEAVE_REQUEST',
      notes: null,
    },
  ],
  unauthorisedSpells: [
    {
      start: '2026-09-07',
      end: '2026-09-18',
      workingDays: 10,
      reportable: true,
    },
  ],
};

const PAY = {
  employeeId: 7,
  thresholdKnown: true,
  periods: [],
  assessments: [
    {
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      annualisedPay: 17661.29,
      requiredAnnualSalary: 30000,
      shortfall: 12338.71,
      compliant: false,
    },
  ],
};

function mockApi(overrides: Record<string, any> = {}) {
  (api.apiGet as any).mockImplementation((path: string) => {
    if (path === '/employees') return Promise.resolve(EMPLOYEES);
    if (path.startsWith('/absences/employee/'))
      return Promise.resolve(overrides.ledger ?? LEDGER);
    if (path.startsWith('/pay/employee/'))
      return Promise.resolve(overrides.pay ?? PAY);
    return Promise.resolve([]);
  });
}

describe('Compliance page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  const selectEmployee = async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Compliance />
      </MemoryRouter>,
    );
    const select = await screen.findByLabelText('Employee');
    await user.selectOptions(select, '7');
    return user;
  };

  it('asks for an employee before showing anything', async () => {
    render(
      <MemoryRouter>
        <Compliance />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Employee')).toBeInTheDocument();
    expect(screen.queryByText('Absence')).not.toBeInTheDocument();
  });

  it('warns that a ten-day spell is reportable', async () => {
    await selectEmployee();
    expect(await screen.findByText(/Reportable:/)).toBeInTheDocument();
    expect(
      screen.getByText(/10 working days from 2026-09-07 to 2026-09-18/),
    ).toBeInTheDocument();
  });

  it('shows the derived absence ledger with its sources', async () => {
    await selectEmployee();
    // Scoped to the row: "Unauthorised" is also a status dropdown option.
    const dateCell = await screen.findByText('2026-09-07');
    const row = dateCell.closest('tr')!;
    expect(within(row).getByText('Unauthorised')).toBeInTheDocument();
    expect(within(row).getByText('MANUAL')).toBeInTheDocument();

    const sickRow = screen.getByText('2026-09-08').closest('tr')!;
    expect(within(sickRow).getByText('Sick')).toBeInTheDocument();
    expect(within(sickRow).getByText('LEAVE_REQUEST')).toBeInTheDocument();
  });

  it('records an absence and refreshes the ledger', async () => {
    (api.apiPost as any).mockResolvedValue({ id: 1 });
    const user = await selectEmployee();

    await screen.findByText(/Reportable:/);
    await user.click(screen.getByRole('button', { name: 'Record' }));

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith(
        '/absences',
        expect.objectContaining({ employeeId: 7, status: 'UNAUTHORISED' }),
      ),
    );
  });

  it('flags a pay period below the CoS salary', async () => {
    await selectEmployee();
    expect(await screen.findByText('Below CoS')).toBeInTheDocument();
    expect(screen.getByText('£30,000')).toBeInTheDocument();
  });

  it('says pay cannot be checked when no CoS salary is recorded', async () => {
    mockApi({
      pay: {
        employeeId: 7,
        thresholdKnown: false,
        periods: [],
        assessments: [],
      },
    });
    await selectEmployee();
    expect(
      await screen.findByText(/No CoS salary recorded for this worker/),
    ).toBeInTheDocument();
  });
});
