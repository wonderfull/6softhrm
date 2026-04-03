import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { HiHome, HiUsers, HiDocumentText, HiClock, HiOutlineSquares2X2, HiUserGroup, HiCalendar, HiFolder, HiClipboardDocumentList, HiArrowDownTray, HiShieldCheck, HiBell, HiCog6Tooth } from 'react-icons/hi2'
import { getCurrentUser } from '../lib/api'

const adminMenu = [
  { to: '/dashboard', label: 'Dashboard', icon: <HiHome size={18} /> },
  { to: '/employees', label: 'Employees', icon: <HiUsers size={18} /> },
  { to: '/users', label: 'User Management', icon: <HiUserGroup size={18} /> },
  { to: '/sponsorships', label: 'Sponsorships', icon: <HiDocumentText size={18} /> },
  { to: '/time', label: 'Time', icon: <HiClock size={18} /> },
  { to: '/projects', label: 'Projects', icon: <HiOutlineSquares2X2 size={18} /> },
  { to: '/leave', label: 'Leave', icon: <HiCalendar size={18} /> },
  { to: '/documents', label: 'Documents', icon: <HiFolder size={18} /> },
  { to: '/notifications', label: 'Notifications', icon: <HiBell size={18} /> },
  { to: '/audit-logs', label: 'Audit Logs', icon: <HiClipboardDocumentList size={18} /> },
  { to: '/data-export', label: 'Data Export', icon: <HiArrowDownTray size={18} /> },
  { to: '/settings', label: 'Settings', icon: <HiCog6Tooth size={18} /> },
]

const managerMenu = [
  { to: '/dashboard', label: 'Dashboard', icon: <HiHome size={18} /> },
  { to: '/employees', label: 'Employees', icon: <HiUsers size={18} /> },
  { to: '/sponsorships', label: 'Sponsorships', icon: <HiDocumentText size={18} /> },
  { to: '/time', label: 'Time', icon: <HiClock size={18} /> },
  { to: '/projects', label: 'Projects', icon: <HiOutlineSquares2X2 size={18} /> },
  { to: '/leave', label: 'Leave', icon: <HiCalendar size={18} /> },
  { to: '/documents', label: 'Documents', icon: <HiFolder size={18} /> },
  { to: '/notifications', label: 'Notifications', icon: <HiBell size={18} /> },
  { to: '/settings', label: 'Settings', icon: <HiCog6Tooth size={18} /> },
]

const userMenu = [
  { to: '/dashboard', label: 'Dashboard', icon: <HiHome size={18} /> },
  { to: '/employees', label: 'My Profile', icon: <HiUsers size={18} /> },
  { to: '/time', label: 'Timesheet', icon: <HiClock size={18} /> },
  { to: '/leave', label: 'Leave Requests', icon: <HiCalendar size={18} /> },
  { to: '/documents', label: 'My Documents', icon: <HiFolder size={18} /> },
  { to: '/consent', label: 'My Consent', icon: <HiShieldCheck size={18} /> },
]

export default function Sidebar() {
  const loc = useLocation()
  
  const userRole = React.useMemo(() => getCurrentUser()?.role || 'USER', [])

  const menu = userRole === 'ADMIN'
    ? adminMenu
    : userRole === 'MANAGER'
      ? managerMenu
      : userMenu

  return (
    <aside className="w-64 hidden md:block border-r border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 h-screen sticky top-0">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center py-4 px-4 border-b border-slate-200 dark:border-slate-700">
          <img src="/6soft-logo.png" alt="6soft" className="h-12" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-1">
            {menu.map((m) => (
              <Link key={m.to} to={m.to} className={`flex items-center gap-3 p-3 rounded-md ${loc.pathname === m.to ? 'bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <span className="text-xl">{m.icon}</span>
                <span className="font-medium">{m.label}</span>
              </Link>
            ))}
          </div>
        </nav>
        <div className="p-4 text-xs text-center text-slate-500 border-t border-slate-200 dark:border-slate-700">© 2025 6soft HRM</div>
      </div>
    </aside>
  )
}
