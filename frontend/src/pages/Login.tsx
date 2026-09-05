import React from 'react';
import Logo from '../components/Logo';
import { apiPost } from '../lib/api';
import { storeTenant } from '../lib/tenant';
import { useNavigate, Link } from 'react-router-dom';
import { LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default function Login() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  // Two-factor step: set when login answers requires2fa
  const [pendingToken, setPendingToken] = React.useState('');
  const [totpCode, setTotpCode] = React.useState('');
  const navigate = useNavigate();

  function completeLogin(data: any) {
    localStorage.setItem('token', data.token);
    storeTenant(data.user?.tenant);
    window.location.href = '/dashboard';
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/2fa/complete', {
        pendingToken,
        code: totpCode,
      });
      if (data.token) completeLogin(data);
      else setError(data.error || 'Invalid authentication code');
    } catch (err: any) {
      setError(err.message || 'Invalid authentication code');
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiPost('/auth/login', { email, password });

      if (data.requires2fa) {
        setPendingToken(data.pendingToken);
      } else if (data.token) {
        completeLogin(data);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <Logo
            className="mb-4"
            markClassName="h-11 w-11"
            textClassName="text-3xl"
          />
          <p className="text-slate-600 dark:text-slate-400">
            Sign in to your account
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          {pendingToken ? (
            <form onSubmit={submitCode} className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Two-factor authentication
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>
              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                  {error}
                </div>
              )}
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                aria-label="Authentication code"
                placeholder="123456"
                className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 bg-white text-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-600 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-primary-600 hover:bg-primary-700 active:translate-y-px text-white py-3 rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingToken('');
                  setTotpCode('');
                  setError('');
                }}
                className="w-full text-sm text-slate-600 hover:underline dark:text-slate-400"
              >
                Back to password
              </button>
            </form>
          ) : (
          <form onSubmit={submit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition-all"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 active:translate-y-px text-white font-semibold py-3 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          )}

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              Sign in with your assigned company account. If you do not have
              access yet, ask an administrator to create your user account or
              send you a password reset link.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
          <p>© {new Date().getFullYear()} OnsideHR. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
