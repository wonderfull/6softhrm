import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sponsorships from './pages/Sponsorships'
import Employees from './pages/Employees'
import Leave from './pages/Leave'
import Time from './pages/Time'
import Projects from './pages/Projects'
import Documents from './pages/Documents'
import Settings from './pages/Settings'
import Users from './pages/Users'
import Login from './pages/Login'
import Register from './pages/Register'
import NavBar from './components/NavBar'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
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
    const interval = setInterval(checkAuth, 1000)
    return () => {
      window.removeEventListener('storage', checkAuth)
      clearInterval(interval)
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
              <NavBar />
              <div className="flex">
                <Sidebar />
                <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                  <div className="mb-6 flex items-center justify-end">
                    <div className="flex gap-2 items-center">
                      <button onClick={handleLogout} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium">
                        Logout
                      </button>
                      <button onClick={() => setDark((d) => !d)} className="btn-ghost">
                        {dark ? '☀️' : '🌙'}
                      </button>
                    </div>
                  </div>
                  <Routes>
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/sponsorships" element={<Sponsorships />} />
                    <Route path="/time" element={<Time />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/leave" element={<Leave />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/" element={<Navigate to="/employees" replace />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
