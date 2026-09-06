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
import Compliance from './pages/Compliance';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import Leave from './pages/Leave';
import Expenses from './pages/Expenses';
import Cases from './pages/Cases';
import Time from './pages/Time';
import Projects from './pages/Projects';
import Documents from './pages/Documents';
import Payslips from './pages/Payslips';
import Account from './pages/Account';
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
import Platform from './pages/Platform';
import PlatformLogin from './pages/PlatformLogin';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Gdpr from './pages/Gdpr';
import Dpa from './pages/Dpa';
import Home from './pages/Home';
import PublicLayout from './components/marketing/PublicLayout';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/tailwind.css';

// Per-route document.title so browser tabs and screen-reader announcements are
// disambiguated (test report B13: every page used to read "HRM Starter").
const ROUTE_TITLES: Record<string, string> = {
  '/': 'HR software for UK companies',
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
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
  '/dpa': 'Data Processing Agreement',
  '/gdpr': 'GDPR',
  '/login': 'Sign in',
  '/platform': 'Platform Console',
  '/platform/login': 'Platform Console',
  '/register': 'Register',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
};

function RouteTitle() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    const title = ROUTE_TITLES[pathname];
    document.title = title ? `${title} · OnsideHR` : 'OnsideHR';
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
    localStorage.removeItem('tenant');
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
        <Route path="/" element={<Home />} />
        <Route
          path="/privacy"
          element={
            <PublicLayout>
              <Privacy />
            </PublicLayout>
          }
        />
        <Route
          path="/terms"
          element={
            <PublicLayout>
              <Terms />
            </PublicLayout>
          }
        />
        <Route
          path="/dpa"
          element={
            <PublicLayout>
              <Dpa />
            </PublicLayout>
          }
        />
        <Route
          path="/gdpr"
          element={
            <PublicLayout>
              <Gdpr />
            </PublicLayout>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Platform console (operator-only; guards itself via platformToken) */}
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route path="/platform" element={<Platform />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-bg text-ink flex">
                <Sidebar />
                <div className="flex-1 min-w-0 flex flex-col">
                  <NavBar
                    darkMode={dark}
                    onToggleDarkMode={() => setDark((d) => !d)}
                    onLogout={handleLogout}
                  />
                  <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 pt-8 pb-12 flex flex-col gap-6">
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
                      <Route
                        path="/compliance"
                        element={
                          <ProtectedRoute
                            allowedRoles={[
                              'ADMIN',
                              'DIRECTOR',
                              'OFFICE_ASSISTANT',
                            ]}
                          >
                            <Compliance />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
                            <Reports />
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
                      <Route path="/expenses" element={<Expenses />} />
                      <Route
                        path="/cases"
                        element={
                          <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']}>
                            <Cases />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/payslips" element={<Payslips />} />
                      <Route path="/account" element={<Account />} />
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
                      {/* B12: canonicalise common alt-paths back to /employees */}
                      <Route
                        path="/profile"
                        element={<Navigate to="/employees" replace />}
                      />
                      <Route
                        path="/my-profile"
                        element={<Navigate to="/employees" replace />}
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
