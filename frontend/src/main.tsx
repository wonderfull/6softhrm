import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Sponsorships from './pages/Sponsorships';
import Employees from './pages/Employees';
import Leave from './pages/Leave';
import Time from './pages/Time';
import Projects from './pages/Projects';
import Documents from './pages/Documents';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AuditLogs from './pages/AuditLogs';
import DataExport from './pages/DataExport';
import Consent from './pages/Consent';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Gdpr from './pages/Gdpr';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/tailwind.css';

// Per-route document.title so browser tabs and screen-reader announcements are
// disambiguated (test report B13: every page used to read "HRM Starter").
const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/employees': 'People',
  '/sponsorships': 'Sponsorships',
  '/time': 'Time',
  '/projects': 'Projects',
  '/leave': 'Leave',
  '/documents': 'Documents',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  '/audit-logs': 'Audit Logs',
  '/data-export': 'Data Export',
  '/consent': 'Data Consent',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
  '/gdpr': 'GDPR',
  '/login': 'Sign in',
  '/register': 'Register',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
};

function RouteTitle() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    const title = ROUTE_TITLES[pathname];
    document.title = title ? `${title} · 6soft HRM` : '6soft HRM';
  }, [pathname]);
  return null;
}

function App() {
  const [dark, setDark] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(
    !!localStorage.getItem('token'),
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    window.location.href = '/login';
  };

  // Listen for login events
  React.useEffect(() => {
    const checkAuth = () => setIsLoggedIn(!!localStorage.getItem('token'));
    window.addEventListener('storage', checkAuth);
    const interval = setInterval(checkAuth, 1000);
    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  return (
    <BrowserRouter>
      <RouteTitle />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
                <NavBar
                  darkMode={dark}
                  onToggleDarkMode={() => setDark((d) => !d)}
                  onLogout={handleLogout}
                />
                <div className="flex flex-1">
                  <Sidebar />
                  <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/employees" element={<Employees />} />
                      <Route
                        path="/sponsorships"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'ADMIN',
                              'DIRECTOR',
                              'OFFICE_ASSISTANT',
                            ]}
                          >
                            <Sponsorships />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/time" element={<Time />} />
                      <Route
                        path="/projects"
                        element={
                          <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
                            <Projects />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/leave" element={<Leave />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute allowedRoles={['ADMIN']}>
                            <Settings />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/notifications"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'ADMIN',
                              'DIRECTOR',
                              'OFFICE_ASSISTANT',
                            ]}
                          >
                            <Notifications />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/audit-logs"
                        element={
                          <ProtectedRoute allowedRoles={['ADMIN']}>
                            <AuditLogs />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/data-export"
                        element={
                          <ProtectedRoute allowedRoles={['ADMIN']}>
                            <DataExport />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/consent" element={<Consent />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/gdpr" element={<Gdpr />} />
                      {/* B12: canonicalise common alt-paths back to /employees */}
                      <Route
                        path="/profile"
                        element={<Navigate to="/employees" replace />}
                      />
                      <Route
                        path="/my-profile"
                        element={<Navigate to="/employees" replace />}
                      />
                      <Route
                        path="/"
                        element={<Navigate to="/dashboard" replace />}
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </div>
                <Footer />
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
