import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Sponsorships from './pages/Sponsorships'
import Employees from './pages/Employees'
import Leave from './pages/Leave'
import Time from './pages/Time'
import Projects from './pages/Projects'
import Documents from './pages/Documents'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AuditLogs from './pages/AuditLogs'
import DataExport from './pages/DataExport'
import Consent from './pages/Consent'
import Notifications from './pages/Notifications'
import NavBar from './components/NavBar'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected Routes */}
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
              <NavBar darkMode={dark} onToggleDarkMode={() => setDark((d) => !d)} onLogout={handleLogout} />
              <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/sponsorships" element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT']}><Sponsorships /></ProtectedRoute>} />
                    <Route path="/time" element={<Time />} />
                    <Route path="/projects" element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}><Projects /></ProtectedRoute>} />
                    <Route path="/leave" element={<Leave />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/notifications" element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'OFFICE_ASSISTANT']}><Notifications /></ProtectedRoute>} />
                    <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN']}><AuditLogs /></ProtectedRoute>} />
                    <Route path="/data-export" element={<ProtectedRoute allowedRoles={['ADMIN']}><DataExport /></ProtectedRoute>} />
                    <Route path="/consent" element={<Consent />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </main>
              </div>
              <Footer />
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
