import React from 'react'
import { Link } from 'react-router-dom'
import { HiOutlineBell, HiOutlineUserCircle } from 'react-icons/hi'

export default function NavBar() {
  const user = React.useMemo(() => {
    const token = localStorage.getItem('token')
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload
    } catch { return null }
  }, [])

  return (
    <header className="w-full bg-white dark:bg-slate-900 shadow-sm border-b border-slate-100 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xl font-bold text-slate-900 dark:text-white">6soft HRM</Link>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200">
            <HiOutlineBell size={20} />
          </button>
          <button className="p-1 flex items-center gap-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
            <HiOutlineUserCircle size={22} />
            <span className="hidden sm:inline">{user?.email || 'User'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
