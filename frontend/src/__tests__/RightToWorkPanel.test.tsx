import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RightToWorkPanel from '../components/RightToWorkPanel';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiGet: vi.fn(), apiPost: vi.fn(), apiDelete: vi.fn() };
});

const soon = new Date(Date.now() + 20 * 86400000).toISOString();

const CHECKS = [
  {
    id: 2,
    checkDate: '2026-01-05T00:00:00.000Z',
    method: 'HOME_OFFICE_ONLINE',
    outcome: 'PASS',
    timeLimited: true,
    recheckDue: soon,
    document: { id: 9, name: 'share-code.pdf', type: 'RTW' },
    createdAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 1,
    checkDate: '2025-01-05T00:00:00.000Z',
    method: 'MANUAL',
    outcome: 'PASS',
    timeLimited: false,
    recheckDue: null,
    createdAt: '2025-01-05T00:00:00.000Z',
  },
];

describe('RightToWorkPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.apiGet as any).mockImplementation((path: string) => {
      if (path === '/employees/7/rtw') return Promise.resolve(CHECKS);
      if (path === '/documents') return Promise.resolve([{ id: 9, name: 'share-code.pdf' }]);
      return Promise.resolve([]);
    });
    (api.apiPost as any).mockResolvedValue({ id: 3 });
  });

  it('shows the latest check, the recheck badge and the history', async () => {
    render(<RightToWorkPanel employeeId={7} canRecord canDelete={false} />);
    expect(await screen.findByText(/Checked 05\/01\/2026/)).toBeInTheDocument();
    expect(screen.getByText('RTW recheck in 20 days')).toBeInTheDocument();
    expect(screen.getByText(/share-code\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('History (2)')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('records an online check with the share code and the chosen document', async () => {
    const user = userEvent.setup();
    render(<RightToWorkPanel employeeId={7} visaExpiryDate="2027-06-30" canRecord canDelete />);
    await screen.findByText(/Checked 05\/01\/2026/);
    await user.click(screen.getByRole('button', { name: 'Record check' }));
    await user.type(screen.getByPlaceholderText('e.g. W1A 2B3 C4D'), 'w1a2b3c4d');
    await user.click(screen.getByLabelText(/Time-limited permission/));
    await user.selectOptions(await screen.findByDisplayValue('None'), '9');
    await user.click(screen.getByRole('button', { name: 'Save check' }));

    await waitFor(() => expect(api.apiPost).toHaveBeenCalledTimes(1));
    const [path, body] = (api.apiPost as any).mock.calls[0];
    expect(path).toBe('/employees/7/rtw');
    expect(body).toMatchObject({
      method: 'HOME_OFFICE_ONLINE',
      shareCode: 'W1A2B3C4D',
      outcome: 'PASS',
      timeLimited: true,
      documentId: 9,
    });
    expect(body.recheckDue).toBeUndefined();
    expect(api.apiGet).toHaveBeenCalledWith('/employees/7/rtw');
  });

  it('shows the API error when the check is refused', async () => {
    const user = userEvent.setup();
    (api.apiPost as any).mockRejectedValue(new Error('shareCode is required'));
    render(<RightToWorkPanel employeeId={7} canRecord canDelete={false} />);
    await screen.findByText(/Checked 05\/01\/2026/);
    await user.click(screen.getByRole('button', { name: 'Record check' }));
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'MANUAL');
    await user.click(screen.getByRole('button', { name: 'Save check' }));
    expect(await screen.findByText('shareCode is required')).toBeInTheDocument();
  });
});
