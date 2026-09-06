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
import Expenses from '../pages/Expenses';
import * as api from '../lib/api';

let mockedUser: { role: string; email: string; employeeId?: number } | null =
  null;

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    getCurrentUser: vi.fn(() => mockedUser),
  };
});

const OWN_PENDING = {
  id: 1,
  employeeId: 5,
  date: '2026-09-01T00:00:00.000Z',
  category: 'TRAVEL',
  amount: 42.5,
  description: 'Train to Leeds',
  status: 'PENDING',
  decidedBy: null,
  decidedAt: null,
  decisionNote: null,
  receipt: null,
  employee: { id: 5, firstName: 'Ella', lastName: 'Ng', department: 'Care' },
};

const REPORT_PENDING = {
  ...OWN_PENDING,
  id: 2,
  employeeId: 7,
  amount: 18,
  description: 'Parking',
  employee: { id: 7, firstName: 'Sam', lastName: 'Okoro', department: 'Care' },
};

const APPROVED = {
  ...REPORT_PENDING,
  id: 3,
  status: 'APPROVED',
  decidedBy: 9,
  decidedAt: '2026-09-03T00:00:00.000Z',
  decisionNote: 'Signed off by Priya',
};

const PAID = { ...APPROVED, id: 4, status: 'PAID', decisionNote: null };

function mockApi(expenses: any[]) {
  (api.apiGet as any).mockImplementation((path: string) =>
    path === '/expenses' ? Promise.resolve(expenses) : Promise.resolve([]),
  );
}

const renderExpenses = () =>
  render(
    <MemoryRouter>
      <Expenses />
    </MemoryRouter>,
  );

describe('Expenses page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser = null;
    mockApi([]);
  });

  it('files a claim against the person making it', async () => {
    mockedUser = { role: 'EMPLOYEE', email: 'ella@example.com', employeeId: 5 };
    (api.apiPost as any).mockResolvedValue({ ...OWN_PENDING });
    const user = userEvent.setup();
    renderExpenses();

    await user.click(await screen.findByRole('button', { name: /New claim/ }));
    fireEvent.change(screen.getByLabelText(/Date of spend/), {
      target: { value: '2026-09-01' },
    });
    await user.selectOptions(screen.getByLabelText(/Category/), 'TRAVEL');
    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '42.50' },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: 'Train to Leeds' },
    });
    await user.click(screen.getByRole('button', { name: 'Submit claim' }));

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith('/expenses', {
        date: '2026-09-01',
        category: 'TRAVEL',
        amount: 42.5,
        description: 'Train to Leeds',
        receiptDocumentId: undefined,
      }),
    );
  });

  it('never offers the claimant a decision on their own claim', async () => {
    mockedUser = { role: 'ADMIN', email: 'ella@example.com', employeeId: 5 };
    mockApi([OWN_PENDING]);
    renderExpenses();

    expect(await screen.findByText('£42.50')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Withdraw' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reject' }),
    ).not.toBeInTheDocument();
  });

  it('approves a report claim with a note', async () => {
    mockedUser = {
      role: 'DIRECTOR',
      email: 'priya@example.com',
      employeeId: 9,
    };
    mockApi([REPORT_PENDING]);
    (api.apiPut as any).mockResolvedValue({ ...REPORT_PENDING, ...APPROVED });
    const user = userEvent.setup();
    renderExpenses();

    expect(await screen.findByText('To approve (1)')).toBeInTheDocument();
    expect(screen.getByText('Sam Okoro · Care')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText(/Note/), 'Signed off by Priya');
    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/expenses/2/approve', {
        note: 'Signed off by Priya',
      }),
    );
  });

  it('shows decided claims with their status and offers payment only once approved', async () => {
    mockedUser = { role: 'ADMIN', email: 'admin@example.com', employeeId: 9 };
    mockApi([APPROVED, PAID]);
    renderExpenses();

    expect(await screen.findByText('Approved')).toBeInTheDocument();
    // "Paid" is also a filter option, so match the badge specifically.
    expect(
      screen.getAllByText('Paid').some((el) => el.className.includes('badge')),
    ).toBe(true);
    expect(screen.getByText('Signed off by Priya')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mark paid' })).toHaveLength(
      1,
    );
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
  });
});
