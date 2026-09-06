import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { roleLabel } from '../lib/roles';
import NotificationBell from './NotificationBell';
import { setNavDrawer, useNavDrawer, useShellMenu } from './Sidebar';
import { Avatar, Badge } from './ui';

interface NavBarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

// Routes that are not in the signed-in user's menu still need a label.
const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/employees': 'People',
  '/sponsorships': 'Sponsorships',
  '/compliance': 'Compliance',
  '/reports': 'Reports',
  '/time': 'Time',
  '/projects': 'Projects',
  '/leave': 'Leave',
  '/expenses': 'Expenses',
  '/cases': 'Employee Relations',
  '/documents': 'Documents',
  '/payslips': 'My Payslips',
  '/account': 'My Account',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/audit-logs': 'Audit Logs',
  '/data-export': 'Data Export',
  '/consent': 'Data Consent',
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export default function NavBar({
  darkMode,
  onToggleDarkMode,
  onLogout,
}: NavBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const menu = useShellMenu();
  const drawerOpen = useNavDrawer();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const user = React.useMemo(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }, []);
  const displayName = user?.name || user?.email || 'User';

  const pageLabel =
    menu.find((m) => m.to === pathname)?.label ?? PAGE_LABELS[pathname] ?? '';

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // "/" anywhere focuses the search unless the user is already typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    navigate(`/employees?q=${encodeURIComponent(term)}`);
    searchRef.current?.blur();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 bg-surface border-b border-line px-6">
      <button
        type="button"
        onClick={() => setNavDrawer(!drawerOpen)}
        aria-label="Open navigation"
        aria-controls="app-sidebar"
        aria-expanded={drawerOpen}
        className="min-[900px]:hidden inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line-2 bg-surface text-ink hover:bg-surface-2 transition-colors duration-hover"
      >
        <Bars3Icon className="h-4 w-4" aria-hidden="true" />
      </button>

      <span className="truncate text-sm text-ink-2">{pageLabel}</span>

      <form
        role="search"
        onSubmit={submitSearch}
        className="ml-auto hidden min-[900px]:flex h-8 w-[280px] items-center gap-2 rounded-md border border-line bg-bg px-2.5 text-ink-3 transition-[border-color,box-shadow] duration-hover focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-tint"
      >
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
          placeholder="Search people, documents, requests"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd
          aria-hidden="true"
          className="font-mono text-[11px] leading-none rounded-sm border border-line px-[5px] py-[2px]"
        >
          /
        </kbd>
      </form>

      <div className="flex items-center gap-1 max-[899px]:ml-auto">
        <NotificationBell />
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            className="btn-ghost h-8 px-2 gap-2 text-[13px] font-medium text-ink"
          >
            <Avatar name={displayName} size={22} tone="muted" />
            <span className="hidden min-[900px]:inline max-w-[180px] truncate">
              {displayName}
            </span>
            <span className="sr-only">Account menu</span>
          </button>
          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 bg-surface rounded-lg shadow-md border border-line py-1 z-50"
            >
              <div className="px-3.5 py-2.5 border-b border-line">
                <p className="truncate text-sm font-medium text-ink">
                  {displayName}
                </p>
                {user?.email && (
                  <p className="truncate font-mono text-[12px] text-ink-3">
                    {user.email}
                  </p>
                )}
                <Badge className="mt-2">{roleLabel(user?.role)}</Badge>
              </div>
              <Link
                to="/account"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
                className="flex w-full items-center gap-2.5 px-3.5 h-9 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors duration-hover"
              >
                <UserCircleIcon className="h-4 w-4" aria-hidden="true" />
                My account
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onToggleDarkMode();
                  setDropdownOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 h-9 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors duration-hover"
              >
                {darkMode ? (
                  <SunIcon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <MoonIcon className="h-4 w-4" aria-hidden="true" />
                )}
                {darkMode ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 h-9 text-left text-sm text-bad hover:bg-bad-tint transition-colors duration-hover"
              >
                <ArrowRightOnRectangleIcon
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
