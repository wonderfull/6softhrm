import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar, { setNavDrawer } from '../components/Sidebar';
import NavBar from '../components/NavBar';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiGet: vi.fn().mockResolvedValue([]) };
});

const TOKEN = `header.${btoa(
  JSON.stringify({
    role: 'ADMIN',
    name: 'Operations Admin',
    email: 'ops.admin@6soft.local',
  }),
)}.signature`;

const TENANT = JSON.stringify({
  id: 1,
  slug: 'northgate',
  name: 'Northgate',
  plan: 'PRO',
});

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">{`${location.pathname}${location.search}`}</span>
  );
}

function renderShell(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
      <NavBar
        darkMode={false}
        onToggleDarkMode={() => {}}
        onLogout={() => {}}
      />
      <LocationProbe />
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('app shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNavDrawer(false);
    (localStorage.getItem as any).mockImplementation((key: string) => {
      if (key === 'token') return TOKEN;
      if (key === 'tenant') return TENANT;
      return null;
    });
  });

  it('shows the tenant chip and the signed-in user in the sidebar footer', () => {
    renderShell();

    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    expect(within(sidebar).getByText('Northgate')).toBeInTheDocument();
    expect(within(sidebar).getByText('Operations Admin')).toBeInTheDocument();
    expect(within(sidebar).getByText('Administrator')).toBeInTheDocument();
  });

  it('labels the current page in the top bar', () => {
    renderShell('/leave');

    expect(screen.getByRole('banner')).toHaveTextContent('Leave');
  });

  it('opens and closes the mobile navigation drawer', async () => {
    const user = userEvent.setup();
    renderShell();

    const menu = screen.getByRole('button', { name: 'Open navigation' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('complementary', { name: 'Sidebar' }).className,
    ).toContain('max-[899px]:-translate-x-full');

    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('complementary', { name: 'Sidebar' }).className,
    ).not.toContain('max-[899px]:-translate-x-full');

    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('focuses the search on "/" and searches the people list', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.keyboard('/');
    const search = screen.getByRole('searchbox', { name: 'Search' });
    expect(search).toHaveFocus();

    await user.type(search, 'priya{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/employees?q=priya',
    );
  });
});
