import React from 'react'
import { Link } from 'react-router-dom'
import { HiOutlineBell, HiOutlineUserCircle, HiOutlineLogout, HiOutlineSun, HiOutlineMoon } from 'react-icons/hi'
import { HiChevronDown } from 'react-icons/hi2'

interface NavBarProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
}

export default function NavBar({ darkMode, onToggleDarkMode, onLogout }: NavBarProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const user = React.useMemo(() => {
    const token = localStorage.getItem('token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload
    } catch { return null }
  }, [])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="w-full bg-white dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xl font-bold text-slate-900 dark:text-white">6soft HRM</Link>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 transition-colors">
            <HiOutlineBell size={20} />
          </button>
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="p-2 flex items-center gap-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
            >
              <HiOutlineUserCircle size={22} />
              <span className="hidden sm:inline font-medium">{user?.name || user?.email || 'User'}</span>
              <HiChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name || 'User'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-1">
                    <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {user?.role || 'USER'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    onToggleDarkMode()
                    setDropdownOpen(false)
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors"
                >
                  {darkMode ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />}
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false)
                    onLogout()
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                >
                  <HiOutlineLogout size={18} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
