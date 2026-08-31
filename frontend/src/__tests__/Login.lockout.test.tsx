import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import PlatformLogin from '../pages/PlatformLogin';

// The backend now answers a locked account with 429 and an explanatory body:
//   { error: "Too many failed login attempts. Try again in 2 minutes." }
// If either screen swallows that and shows a generic "Invalid credentials",
// the user keeps retrying against a lock that is still counting up. These
// tests pin the cross-layer contract, because the two screens read the error
// by different routes — Login via the api() helper, PlatformLogin via fetch.

const LOCKOUT = 'Too many failed login attempts. Try again in 2 minutes.';

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
  const inputs = screen.getAllByRole('textbox');
  await user.type(inputs[0], 'locked@example.com');
  const password = document.querySelector(
    'input[type="password"]',
  ) as HTMLInputElement;
  await user.type(password, 'whatever');
  const submit = screen
    .getAllByRole('button')
    .find((b) => b.getAttribute('type') === 'submit');
  await user.click(submit!);
};

describe('login lockout is surfaced to the user', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the lockout message on the tenant login screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: LOCKOUT }),
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await fillAndSubmit(user);

    expect(await screen.findByText(LOCKOUT)).toBeInTheDocument();
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  });

  it('shows the lockout message on the platform console screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: LOCKOUT }),
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PlatformLogin />
      </MemoryRouter>,
    );

    await fillAndSubmit(user);

    expect(await screen.findByText(LOCKOUT)).toBeInTheDocument();
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  });

  it('still shows the generic message for an ordinary bad password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    await fillAndSubmit(user);

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
