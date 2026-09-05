import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeeHrPanel from '../components/EmployeeHrPanel';
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

const REVIEW = {
  id: 11,
  employeeId: 3,
  reviewerId: null,
  type: 'PROBATION',
  dueDate: '2026-10-01T00:00:00.000Z',
  completedAt: null,
  rating: null,
  summary: null,
  reviewer: null,
};

const CHECKLIST = [
  {
    id: 21,
    employeeId: 3,
    kind: 'OFFBOARDING',
    actionKey: null,
    title: 'Collect the laptop',
    dueDate: null,
    completedAt: '2026-09-01T00:00:00.000Z',
    completedBy: 'hr@example.com',
    sortOrder: 1,
  },
  {
    id: 22,
    employeeId: 3,
    kind: 'OFFBOARDING',
    actionKey: 'REVOKE_LOGIN',
    title: 'Revoke the login',
    dueDate: null,
    completedAt: null,
    completedBy: null,
    sortOrder: 2,
  },
];

function mockApi(overrides: Record<string, any> = {}) {
  (api.apiGet as any).mockImplementation((path: string) => {
    if (path === '/reviews')
      return Promise.resolve(overrides.reviews ?? [REVIEW]);
    if (path === '/checklists/3')
      return Promise.resolve(overrides.checklist ?? CHECKLIST);
    return Promise.resolve([]);
  });
}

const renderPanel = () =>
  render(
    <EmployeeHrPanel
      employeeId={3}
      employees={[{ id: 4, firstName: 'Priya', lastName: 'Shah' }]}
      canManage
      canDelete
    />,
  );

describe('EmployeeHrPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('completes a review with a rating and a summary', async () => {
    (api.apiPut as any).mockResolvedValue({
      ...REVIEW,
      completedAt: '2026-09-04T00:00:00.000Z',
      rating: 'EXCEEDS',
      summary: 'Passed probation',
    });
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText('Probation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    await user.selectOptions(screen.getByLabelText('Rating'), 'EXCEEDS');
    await user.type(screen.getByLabelText('Summary'), 'Passed probation');
    await user.click(screen.getByRole('button', { name: 'Save and complete' }));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/reviews/11', {
        completed: true,
        rating: 'EXCEEDS',
        summary: 'Passed probation',
      }),
    );
    expect(await screen.findByText('Exceeds expectations')).toBeInTheDocument();
  });

  it('tracks checklist progress and says what ticking an item actually did', async () => {
    (api.apiPut as any).mockResolvedValue({
      ...CHECKLIST[1],
      completedAt: '2026-09-04T00:00:00.000Z',
      actionResult: 'Login revoked',
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Checklist' }));
    expect(await screen.findByText('1 of 2 done')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Revoke the login'));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/checklists/item/22', {
        completed: true,
      }),
    );
    expect(
      await screen.findByText('Revoke the login: Login revoked'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 of 2 done')).toBeInTheDocument();
  });

  it('starts an onboarding checklist when there is none', async () => {
    mockApi({ checklist: [] });
    (api.apiPost as any).mockResolvedValue([
      {
        ...CHECKLIST[0],
        id: 31,
        kind: 'ONBOARDING',
        title: 'Send the contract',
        completedAt: null,
        completedBy: null,
      },
    ]);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Checklist' }));
    await user.click(
      await screen.findByRole('button', { name: 'Start onboarding' }),
    );

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith('/checklists/3', {
        kind: 'ONBOARDING',
      }),
    );
    expect(await screen.findByText('Send the contract')).toBeInTheDocument();
  });
});
