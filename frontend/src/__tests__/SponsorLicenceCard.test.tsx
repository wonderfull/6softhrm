import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SponsorLicenceCard from '../components/SponsorLicenceCard';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiGet: vi.fn(), apiPut: vi.fn() };
});

const LICENCE = {
  licenceNumber: 'ABC123',
  rating: 'B',
  expiryDate: new Date(Date.now() + 40 * 86400000).toISOString(),
  allocationYearStart: '2026-04-06T00:00:00.000Z',
  authorisingOfficer: 'Ann Owner',
  authorisingOfficerEmail: 'ann@example.test',
  keyContact: '',
  keyContactEmail: '',
  level1Users: [{ name: 'Lee', email: 'lee@example.test' }],
  level2Users: [],
  cosDefinedAllocated: 5,
  cosUndefinedAllocated: 10,
  actionPlanIssuedAt: '2026-06-01T00:00:00.000Z',
  actionPlanDueAt: '2026-09-01T00:00:00.000Z',
  actionPlanNotes: 'Fix reporting',
};

describe('SponsorLicenceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.apiGet as any).mockResolvedValue({
      licence: LICENCE,
      cosDefinedUsed: 2,
      cosUndefinedUsed: 7,
    });
    (api.apiPut as any).mockImplementation((_p: string, body: any) =>
      Promise.resolve({ licence: { ...LICENCE, ...body }, cosDefinedUsed: 2, cosUndefinedUsed: 7 }),
    );
  });

  it('shows the licence, usage counts, expiry warning and action plan for a B rating', async () => {
    render(<SponsorLicenceCard canEdit />);
    expect(await screen.findByDisplayValue('ABC123')).toBeInTheDocument();
    expect(screen.getByText('2 used this allocation year')).toBeInTheDocument();
    expect(screen.getByText('7 used this allocation year')).toBeInTheDocument();
    expect(screen.getByText(/Licence expires in 40 days/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fix reporting')).toBeInTheDocument();
    expect(screen.getByDisplayValue('lee@example.test')).toBeInTheDocument();
  });

  it('saves the whole form and hides the action plan when the rating goes back to A', async () => {
    const user = userEvent.setup();
    render(<SponsorLicenceCard canEdit />);
    const number = await screen.findByDisplayValue('ABC123');
    await user.clear(number);
    await user.type(number, 'XYZ999');
    await user.selectOptions(screen.getByDisplayValue('B, action plan in place'), 'A');
    expect(screen.queryByDisplayValue('Fix reporting')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save sponsor licence' }));

    await waitFor(() => expect(api.apiPut).toHaveBeenCalledTimes(1));
    const [path, body] = (api.apiPut as any).mock.calls[0];
    expect(path).toBe('/tenant/licence');
    expect(body.licenceNumber).toBe('XYZ999');
    expect(body.rating).toBe('A');
    expect(body.level1Users).toEqual([{ name: 'Lee', email: 'lee@example.test' }]);
    expect(await screen.findByText('Sponsor licence saved.')).toBeInTheDocument();
  });

  it('is read-only without edit rights', async () => {
    render(<SponsorLicenceCard canEdit={false} />);
    expect(await screen.findByDisplayValue('ABC123')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save sponsor licence' })).not.toBeInTheDocument();
  });
});
