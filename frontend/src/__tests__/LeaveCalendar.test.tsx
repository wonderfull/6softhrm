import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaveCalendar from '../components/LeaveCalendar';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiGet: vi.fn() };
});

// The calendar opens on the current month, so fixtures are pinned to it
// rather than to fixed dates that rot as time passes.
const now = new Date();
const pad = (value: number) => String(value).padStart(2, '0');
const day = (value: number) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(value)}`;

const BANK_HOLIDAY = day(15);

const ENTRIES = [
  {
    id: 1,
    employeeId: 1,
    employeeName: 'Ada Byron',
    department: 'Engineering',
    type: 'ANNUAL',
    startDate: `${day(10)}T00:00:00.000Z`,
    endDate: `${day(11)}T00:00:00.000Z`,
    status: 'APPROVED',
  },
  {
    id: 2,
    employeeId: 2,
    employeeName: 'Grace Hopper',
    department: 'Finance',
    type: 'LEAVE',
    startDate: `${day(12)}T00:00:00.000Z`,
    endDate: `${day(12)}T00:00:00.000Z`,
    status: 'APPROVED',
  },
];

describe('LeaveCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.apiGet as any).mockImplementation((_path: string, query: any) =>
      Promise.resolve({
        from: query.from,
        to: query.to,
        entries: query.department
          ? ENTRIES.filter((entry) => entry.department === query.department)
          : ENTRIES,
        bankHolidays: [BANK_HOLIDAY],
      }),
    );
  });

  it('draws a chip on every day a request covers', async () => {
    render(<LeaveCalendar />);
    expect(await screen.findAllByText('Ada Byron · Annual Leave')).toHaveLength(
      2,
    );
    expect(api.apiGet).toHaveBeenCalledWith('/leave/calendar', {
      from: day(1),
      to: expect.any(String),
    });
  });

  it('shows a masked entry as Away and never leaks the raw type', async () => {
    render(<LeaveCalendar />);
    expect(await screen.findByText('Grace Hopper · Away')).toBeInTheDocument();
    expect(screen.queryByText(/Grace Hopper · LEAVE/)).not.toBeInTheDocument();
  });

  it('shades bank holidays and names them', async () => {
    render(<LeaveCalendar />);
    await screen.findByText('Grace Hopper · Away');
    const cell = screen.getByTestId(`day-${BANK_HOLIDAY}`);
    expect(cell.className).toContain('bg-warn-tint');
    expect(cell).toHaveTextContent('Bank holiday');
  });

  it('filters by department', async () => {
    const user = userEvent.setup();
    render(<LeaveCalendar />);
    await screen.findByText('Grace Hopper · Away');

    await user.selectOptions(screen.getByLabelText('Department'), 'Finance');

    await waitFor(() =>
      expect(api.apiGet).toHaveBeenCalledWith('/leave/calendar', {
        from: day(1),
        to: expect.any(String),
        department: 'Finance',
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Ada Byron · Annual Leave'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Grace Hopper · Away')).toBeInTheDocument();
  });

  it('moves to the next month', async () => {
    const user = userEvent.setup();
    render(<LeaveCalendar />);
    await screen.findByText('Grace Hopper · Away');

    await user.click(screen.getByLabelText('Next month'));

    const next = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
    const expected = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;
    await waitFor(() =>
      expect(api.apiGet).toHaveBeenCalledWith('/leave/calendar', {
        from: expected,
        to: expect.any(String),
      }),
    );
  });
});
