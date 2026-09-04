import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeavePolicyCard from '../components/LeavePolicyCard';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiGet: vi.fn(), apiPut: vi.fn() };
});

const SETTINGS = {
  leaveYearStart: '01-01',
  defaultLeaveDays: 25,
  carryoverCapDays: 5,
  bankHolidayRegion: 'scotland',
  workingDays: '1,2,3,4',
  companyAddress: '1 High Street, Leeds',
};

describe('LeavePolicyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.apiGet as any).mockResolvedValue(SETTINGS);
    (api.apiPut as any).mockImplementation((_path: string, body: any) =>
      Promise.resolve({ ...SETTINGS, ...body }),
    );
  });

  it('loads the tenant policy into the form', async () => {
    render(<LeavePolicyCard canEdit />);
    expect(await screen.findByDisplayValue('01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('1 High Street, Leeds'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Scotland')).toBeInTheDocument();
    expect(screen.getByLabelText('Thu')).toBeChecked();
    expect(screen.getByLabelText('Fri')).not.toBeChecked();
  });

  it('saves the whole form, including a toggled working day', async () => {
    const user = userEvent.setup();
    render(<LeavePolicyCard canEdit />);

    const leaveYearStart = await screen.findByDisplayValue('01-01');
    await user.clear(leaveYearStart);
    await user.type(leaveYearStart, '04-06');
    await user.click(screen.getByLabelText('Fri'));
    await user.selectOptions(
      screen.getByDisplayValue('Scotland'),
      'england-and-wales',
    );
    await user.click(screen.getByRole('button', { name: 'Save leave policy' }));

    await waitFor(() => expect(api.apiPut).toHaveBeenCalledTimes(1));
    const [path, body] = (api.apiPut as any).mock.calls[0];
    expect(path).toBe('/tenant/settings');
    expect(body).toEqual({
      leaveYearStart: '04-06',
      defaultLeaveDays: 25,
      carryoverCapDays: 5,
      bankHolidayRegion: 'england-and-wales',
      workingDays: '1,2,3,4,5',
      companyAddress: '1 High Street, Leeds',
    });
    expect(await screen.findByText('Leave policy saved.')).toBeInTheDocument();
  });

  it('is read-only without edit rights', async () => {
    render(<LeavePolicyCard canEdit={false} />);
    expect(await screen.findByDisplayValue('01-01')).toBeDisabled();
    expect(screen.getByLabelText('Mon')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Save leave policy' }),
    ).not.toBeInTheDocument();
  });
});
