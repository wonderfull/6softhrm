import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPut: vi.fn(),
  };
});

const now = new Date().toISOString();

const UNREAD = [
  {
    id: 1,
    type: 'LEAVE_APPROVED',
    title: 'Leave approved',
    body: 'Your 12 May request was approved.',
    link: '/leave',
    readAt: null,
    createdAt: now,
  },
  {
    id: 2,
    type: 'PAYSLIP',
    title: 'New payslip',
    body: null,
    link: '/payslips',
    readAt: null,
    createdAt: now,
  },
];

function mockInbox(rows = UNREAD) {
  (api.apiGet as any).mockImplementation(
    (path: string, query?: Record<string, any>) => {
      if (path !== '/notifications/inbox') return Promise.resolve([]);
      if (query?.unread) return Promise.resolve(rows.filter((r) => !r.readAt));
      return Promise.resolve(rows);
    },
  );
}

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInbox();
  });

  it('badges the unread count', async () => {
    renderBell();

    expect(
      await screen.findByRole('button', { name: 'Notifications (2 unread)' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.apiGet).toHaveBeenCalledWith('/notifications/inbox', {
        unread: 1,
      }),
    );
  });

  it('marks a notification read when it is opened', async () => {
    (api.apiPut as any).mockResolvedValue({ ...UNREAD[0], readAt: now });
    const user = userEvent.setup();
    renderBell();

    await user.click(
      await screen.findByRole('button', { name: 'Notifications (2 unread)' }),
    );
    await user.click(await screen.findByText('Leave approved'));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/notifications/inbox/1/read'),
    );
    expect(
      await screen.findByRole('button', { name: 'Notifications (1 unread)' }),
    ).toBeInTheDocument();
  });

  it('clears the badge when everything is marked read', async () => {
    (api.apiPut as any).mockResolvedValue({ updated: 2 });
    const user = userEvent.setup();
    renderBell();

    await user.click(
      await screen.findByRole('button', { name: 'Notifications (2 unread)' }),
    );
    await user.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/notifications/inbox/read-all'),
    );
    expect(
      await screen.findByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });

  it('says so when the inbox is empty', async () => {
    mockInbox([]);
    const user = userEvent.setup();
    renderBell();

    await user.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    );

    expect(
      await screen.findByText("You're all caught up."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mark all read' }),
    ).not.toBeInTheDocument();
  });
});
