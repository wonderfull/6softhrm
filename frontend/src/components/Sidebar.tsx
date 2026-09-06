import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ClockIcon,
  Squares2X2Icon,
  CalendarIcon,
  CurrencyPoundIcon,
  ScaleIcon,
  FolderIcon,
  ChartBarIcon,
  BellIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { LogoMark } from './Logo';
import { Avatar } from './ui';
import { formatUnread, useUnreadCount } from './NotificationBell';
import { getCurrentUser } from '../lib/api';
import { getTenant, hasFeature } from '../lib/tenant';
import { normalizeRole } from '../lib/roles';

type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
export type MenuItem = { to: string; label: string; icon: Icon };

const adminMenu: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/employees', label: 'User/Employee Management', icon: UsersIcon },
  { to: '/sponsorships', label: 'Sponsorships', icon: DocumentTextIcon },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheckIcon },
  { to: '/time', label: 'Time', icon: ClockIcon },
  { to: '/projects', label: 'Projects', icon: Squares2X2Icon },
  { to: '/leave', label: 'Leave', icon: CalendarIcon },
  { to: '/expenses', label: 'Expenses', icon: CurrencyPoundIcon },
  { to: '/cases', label: 'Employee Relations', icon: ScaleIcon },
  { to: '/documents', label: 'Documents', icon: FolderIcon },
  { to: '/reports', label: 'Reports', icon: ChartBarIcon },
  { to: '/notifications', label: 'Notifications', icon: BellIcon },
  { to: '/audit-logs', label: 'Audit Logs', icon: ClipboardDocumentListIcon },
  { to: '/data-export', label: 'Data Export', icon: ArrowDownTrayIcon },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon },
  { to: '/account', label: 'My Account', icon: UserCircleIcon },
];

const managerMenu: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/employees', label: 'User/Employee Management', icon: UsersIcon },
  { to: '/sponsorships', label: 'Sponsorships', icon: DocumentTextIcon },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheckIcon },
  { to: '/time', label: 'Time', icon: ClockIcon },
  { to: '/projects', label: 'Projects', icon: Squares2X2Icon },
  { to: '/leave', label: 'Leave', icon: CalendarIcon },
  { to: '/expenses', label: 'Expenses', icon: CurrencyPoundIcon },
  { to: '/cases', label: 'Employee Relations', icon: ScaleIcon },
  { to: '/documents', label: 'Documents', icon: FolderIcon },
  { to: '/reports', label: 'Reports', icon: ChartBarIcon },
  { to: '/notifications', label: 'Notifications', icon: BellIcon },
  { to: '/account', label: 'My Account', icon: UserCircleIcon },
];

const assistantMenu: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/employees', label: 'Employee Records', icon: UsersIcon },
  { to: '/sponsorships', label: 'Sponsorship Support', icon: DocumentTextIcon },
  { to: '/compliance', label: 'Compliance Support', icon: ShieldCheckIcon },
  { to: '/time', label: 'Time Support', icon: ClockIcon },
  { to: '/leave', label: 'Leave Support', icon: CalendarIcon },
  { to: '/expenses', label: 'Expenses', icon: CurrencyPoundIcon },
  { to: '/documents', label: 'Document Support', icon: FolderIcon },
  { to: '/notifications', label: 'Notifications', icon: BellIcon },
  { to: '/account', label: 'My Account', icon: UserCircleIcon },
];

const userMenu: MenuItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { to: '/employees', label: 'My Profile', icon: UsersIcon },
  { to: '/time', label: 'Timesheet', icon: ClockIcon },
  { to: '/leave', label: 'Leave Requests', icon: CalendarIcon },
  { to: '/expenses', label: 'My Expenses', icon: CurrencyPoundIcon },
  { to: '/documents', label: 'My Documents', icon: FolderIcon },
  { to: '/payslips', label: 'My Payslips', icon: BanknotesIcon },
  { to: '/consent', label: 'My Consent', icon: ShieldCheckIcon },
  { to: '/account', label: 'My Account', icon: UserCircleIcon },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  DIRECTOR: 'Director',
  OFFICE_ASSISTANT: 'Office assistant',
  EMPLOYEE: 'Employee',
};

export function shellRoleLabel(role?: string | null) {
  return ROLE_LABELS[normalizeRole(role)];
}

// The menu for the signed-in user; the top bar reads it too so the page label
// uses the same wording as the highlighted item.
export function useShellMenu(): MenuItem[] {
  const currentUser = React.useMemo(() => getCurrentUser(), []);
  const userRole = normalizeRole(currentUser?.role);
  const hasEmployeeProfile = !!currentUser?.employeeId;

  return React.useMemo(() => {
    let items: MenuItem[];
    if (userRole === 'ADMIN') items = adminMenu;
    else if (userRole === 'DIRECTOR') {
      items = hasEmployeeProfile
        ? [
            ...managerMenu,
            { to: '/consent', label: 'My Consent', icon: ShieldCheckIcon },
          ]
        : managerMenu;
    } else if (userRole === 'OFFICE_ASSISTANT') items = assistantMenu;
    else items = userMenu;
    // Sponsorship compliance is a paid add-on: hide it for tenants without it.
    if (!hasFeature('compliance')) {
      items = items.filter(
        (m) => m.to !== '/sponsorships' && m.to !== '/compliance',
      );
    }
    return items;
  }, [hasEmployeeProfile, userRole]);
}

// Under 900px the sidebar is a drawer. Its open state lives here, outside any
// component, so the top bar's menu button and the drawer share it without a
// provider in the route tree.
type Listener = () => void;
const drawer = { open: false, listeners: new Set<Listener>() };

export function setNavDrawer(open: boolean) {
  if (drawer.open === open) return;
  drawer.open = open;
  drawer.listeners.forEach((listener) => listener());
}

function subscribeDrawer(listener: Listener) {
  drawer.listeners.add(listener);
  return () => {
    drawer.listeners.delete(listener);
  };
}

export function useNavDrawer() {
  return React.useSyncExternalStore(subscribeDrawer, () => drawer.open);
}

export default function Sidebar() {
  const loc = useLocation();
  const open = useNavDrawer();
  const menu = useShellMenu();
  const unread = useUnreadCount();
  const currentUser = React.useMemo(() => getCurrentUser(), []);
  const tenantName = getTenant()?.name;
  const displayName = currentUser?.name || currentUser?.email || 'User';

  React.useEffect(() => {
    setNavDrawer(false);
  }, [loc.pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavDrawer(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => setNavDrawer(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-state ease-out min-[900px]:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        id="app-sidebar"
        aria-label="Sidebar"
        className={`w-60 shrink-0 flex flex-col h-screen sticky top-0 bg-surface border-r border-line max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:z-40 max-[899px]:shadow-md max-[899px]:transition-[transform,visibility] max-[899px]:duration-layout max-[899px]:ease-out motion-reduce:transition-none ${
          open ? '' : 'max-[899px]:-translate-x-full max-[899px]:invisible'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4 border-b border-line">
          <LogoMark className="h-[22px] w-[22px]" />
          <span className="font-display text-base font-semibold tracking-[-0.01em] text-ink">
            Onside
            <span className="font-medium text-ink-2">HR</span>
          </span>
          {tenantName && (
            <span
              title={tenantName}
              className="ml-auto min-w-0 truncate font-mono text-[11px] text-ink-3 border border-line rounded-sm px-1.5 py-px"
            >
              {tenantName}
            </span>
          )}
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
          <div className="flex flex-col gap-0.5">
            {menu.map((m) => {
              const active = loc.pathname === m.to;
              const Icon = m.icon;
              const count =
                m.to === '/notifications' && unread > 0
                  ? formatUnread(unread)
                  : null;
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors duration-hover ease-out ${
                    active
                      ? 'bg-surface-3 text-ink font-medium'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{m.label}</span>
                  {count && (
                    <span className="font-mono text-[11px] text-ink-3">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
          <Avatar name={displayName} size={28} tone="muted" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink">
              {displayName}
            </span>
            <span className="block text-xs text-ink-3">
              {shellRoleLabel(currentUser?.role)}
            </span>
          </span>
        </div>
      </aside>
    </>
  );
}
