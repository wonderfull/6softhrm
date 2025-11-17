import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Sponsorships from './pages/Sponsorships'
import Employees from './pages/Employees'
import Leave from './pages/Leave'
import Time from './pages/Time'
import Projects from './pages/Projects'
import Documents from './pages/Documents'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import './styles/tailwind.css'

function App() {
  const [dark, setDark] = React.useState(false)
  const [isLoggedIn, setIsLoggedIn] = React.useState(!!localStorage.getItem('token'))

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsLoggedIn(false)
    window.location.href = '/login'
  }

  // Listen for login events
  React.useEffect(() => {
    const checkAuth = () => setIsLoggedIn(!!localStorage.getItem('token'))
    window.addEventListener('storage', checkAuth)
    // Also check periodically
    const interval = setInterval(checkAuth, 1000)
    return () => {
      window.removeEventListener('storage', checkAuth)
      clearInterval(interval)
    }
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <header className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">HRM Starter</h1>
          <div className="space-x-4">
            {isLoggedIn ? (
              <>
                <Link to="/" className="underline">Dashboard</Link>
                <Link to="/employees" className="underline">Employees</Link>
                <Link to="/sponsorships" className="underline">Sponsorships</Link>
                <Link to="/time" className="underline">Time</Link>
                <Link to="/projects" className="underline">Projects</Link>
                <Link to="/leave" className="underline">Leave</Link>
                <Link to="/documents" className="underline">Documents</Link>
                <Link to="/settings" className="underline">Settings</Link>
                <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="underline">Login</Link>
                <Link to="/register" className="underline">Register</Link>
              </>
            )}
            <button onClick={() => setDark((d) => !d)} className="px-3 py-1 bg-yellow-300 dark:bg-yellow-600 rounded">
              Toggle Theme
            </button>
          </div>
        </header>
        <main className="p-6">
          <Routes>
            <Route path="/sponsorships" element={<Sponsorships />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/time" element={<Time />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/leave" element={<Leave />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<div>Welcome to the HRM starter. Use the menu.</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
