import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Account from '../pages/Account';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPut: vi.fn(),
    apiPost: vi.fn(),
    apiUpload: vi.fn(),
    apiDelete: vi.fn(),
  };
});

const ME = {
  id: 3,
  email: 'nadia@6soft.co.uk',
  name: 'Nadia Khan',
  role: 'EMPLOYEE',
  employeeId: 12,
  totpEnabled: false,
  tenant: {
    id: 1,
    slug: 'sixsoft',
    name: '6soft Limited',
    plan: 'CORE',
    features: {},
    logoUrl: null,
    primaryColor: null,
  },
};

function mockApi() {
  (api.apiGet as any).mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.resolve(ME);
    // No photo on file yet — the endpoint 404s.
    if (path === '/employees/12/photo')
      return Promise.reject(new Error('API error 404'));
    return Promise.resolve({});
  });
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Account />
    </MemoryRouter>,
  );

async function fillPasswordForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByLabelText('Current password'),
    'oldpassword',
  );
  await user.type(screen.getByLabelText('New password'), 'longenough1');
  await user.type(screen.getByLabelText('Confirm new password'), 'longenough1');
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('Account page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi();
  });

  it('shows the signed-in user from /auth/me', async () => {
    renderPage();

    expect(await screen.findByLabelText('Display name')).toHaveValue(
      'Nadia Khan',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('nadia@6soft.co.uk');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Access role')).toHaveValue('Employee');
    expect(screen.getByLabelText('Access role')).toBeDisabled();
  });

  it('saves a new display name', async () => {
    (api.apiPut as any).mockResolvedValue({ ...ME, name: 'Nadia K' });
    const user = userEvent.setup();
    renderPage();

    const nameInput = await screen.findByLabelText('Display name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nadia K');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(api.apiPut).toHaveBeenCalledWith('/auth/me', { name: 'Nadia K' }),
    );
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('surfaces a wrong current password', async () => {
    (api.apiPost as any).mockRejectedValue(
      new Error('Current password is incorrect'),
    );
    const user = userEvent.setup();
    renderPage();

    await fillPasswordForm(user);

    expect(
      await screen.findByText('Current password is incorrect'),
    ).toBeInTheDocument();
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      'token',
      expect.anything(),
    );
  });

  it('rejects a new password under eight characters without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      await screen.findByLabelText('Current password'),
      'oldpassword',
    );
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm new password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('New password must be at least 8 characters'),
    ).toBeInTheDocument();
    expect(api.apiPost).not.toHaveBeenCalled();
  });

  it('stores the fresh token returned by a successful password change', async () => {
    (api.apiPost as any).mockResolvedValue({ token: 'fresh.jwt.token' });
    const user = userEvent.setup();
    renderPage();

    await fillPasswordForm(user);

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'oldpassword',
        newPassword: 'longenough1',
      }),
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'token',
      'fresh.jwt.token',
    );
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
  });

  it('refuses an oversized photo before it reaches the API', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await screen.findByLabelText('Display name');
    const input = container.querySelector('#account-photo') as HTMLInputElement;
    const big = new File(['x'], 'me.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });
    await user.upload(input, big);

    expect(
      await screen.findByText('Photo is too large (max 2MB).'),
    ).toBeInTheDocument();
    expect(api.apiUpload).not.toHaveBeenCalled();
  });
});
