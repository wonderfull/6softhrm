import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Leave from '../pages/Leave';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
  };
});

const makeToken = (payload: Record<string, unknown>) =>
  `header.${btoa(JSON.stringify(payload))}.signature`;

const BALANCE = {
  leaveYear: {
    start: '2026-04-06',
    end: '2027-04-05',
    label: '6 Apr 2026 to 5 Apr 2027',
  },
  allowance: 28,
  prorated: 26,
  carriedOver: 2,
  used: 4,
  pending: 3,
  remaining: 21,
};

const REQUESTS = [
  {
    id: 1,
    employeeId: 42,
    type: 'ANNUAL',
    startDate: '2026-09-07T00:00:00.000Z',
    endDate: '2026-09-09T00:00:00.000Z',
    days: 3,
    status: 'PENDING',
    reason: 'Break',
    employee: {
      id: 42,
      firstName: 'Ada',
      lastName: 'Byron',
      department: 'Engineering',
      managerId: null,
    },
  },
];

function signIn(role: string) {
  const token = makeToken({ role, email: 'ada@example.test', employeeId: 42 });
  (localStorage.getItem as any).mockImplementation((key: string) =>
    key === 'token' ? token : null,
  );
}

describe('Leave page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn('EMPLOYEE');
    (api.apiGet as any).mockImplementation((path: string) => {
      if (path === '/leave') return Promise.resolve(REQUESTS);
      if (path === '/leave/balance') return Promise.resolve(BALANCE);
      if (path === '/leave/days') return Promise.resolve({ days: 3 });
      if (path === '/leave/calendar')
        return Promise.resolve({ entries: [], bankHolidays: [] });
      return Promise.resolve([]);
    });
  });

  // Scope to the balance card: "Pending" also appears as a status badge on
  // the request rows.
  const balanceCard = () =>
    screen.getByText('Your leave balance').closest('.card') as HTMLElement;
  const stat = (label: string) =>
    within(balanceCard()).getByText(label).parentElement!;

  it('shows the balance strip for the leave year', async () => {
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Your leave balance')).toBeInTheDocument();
    expect(screen.getByText('6 Apr 2026 to 5 Apr 2027')).toBeInTheDocument();
    expect(stat('Remaining')).toHaveTextContent('21');
    expect(stat('Allowance')).toHaveTextContent('26');
    expect(stat('Allowance')).toHaveTextContent('28 days full year');
    expect(stat('Carried over')).toHaveTextContent('2');
    expect(stat('Used')).toHaveTextContent('4');
    expect(stat('Pending')).toHaveTextContent('3');
  });

  it('offers only the valid leave types', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /Request leave/i }));

    const select = screen.getByLabelText('Leave Type *');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual([
      'ANNUAL',
      'SICK',
      'UNPAID',
      'MATERNITY',
      'PATERNITY',
      'COMPASSIONATE',
      'OTHER',
    ]);
  });

  it('asks the server how many working days the dates cover', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /Request leave/i }));

    fireEvent.change(screen.getByLabelText('Start Date *'), {
      target: { value: '2026-09-07' },
    });
    fireEvent.change(screen.getByLabelText('End Date *'), {
      target: { value: '2026-09-09' },
    });

    await waitFor(() =>
      expect(api.apiGet).toHaveBeenCalledWith('/leave/days', {
        start: '2026-09-07',
        end: '2026-09-09',
      }),
    );
    expect(
      await screen.findByText(/This request uses 3 working days/),
    ).toBeInTheDocument();
  });

  it('shows the working days on each request row', async () => {
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/3 working days/)).toBeInTheDocument();
  });

  it('surfaces a rejected submission inline instead of alerting', async () => {
    const user = userEvent.setup();
    (api.apiPost as any).mockRejectedValue(
      new Error('That overlaps a leave request you already have'),
    );
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /Request leave/i }));
    fireEvent.change(screen.getByLabelText('Start Date *'), {
      target: { value: '2026-09-07' },
    });
    fireEvent.change(screen.getByLabelText('End Date *'), {
      target: { value: '2026-09-09' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Submit request' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That overlaps a leave request you already have',
    );
    expect(api.apiPost).toHaveBeenCalledWith('/leave', {
      type: 'ANNUAL',
      startDate: '2026-09-07',
      endDate: '2026-09-09',
      reason: '',
    });
  });

  it('cancels the signed-in employee own pending request', async () => {
    const user = userEvent.setup();
    (api.apiDelete as any).mockResolvedValue({});
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Cancel request' }),
    );

    await waitFor(() => expect(api.apiDelete).toHaveBeenCalledWith('/leave/1'));
    await waitFor(() =>
      expect(screen.queryByText('Ada Byron')).not.toBeInTheDocument(),
    );
  });

  it('sends a decision note when an approver rejects', async () => {
    signIn('ADMIN');
    const user = userEvent.setup();
    (api.apiPut as any).mockResolvedValue({
      ...REQUESTS[0],
      status: 'REJECTED',
    });
    render(
      <MemoryRouter>
        <Leave />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', { name: 'Reject' }));

    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Note (optional)'),
      'Too many out that week',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/leave/1/reject', {
        note: 'Too many out that week',
      }),
    );
  });
});
