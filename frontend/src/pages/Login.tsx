import React from 'react'
import { apiPost } from '../lib/api'
import { useNavigate, Link } from 'react-router-dom'
import { LockClosedIcon, UserIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const data = await apiPost('/auth/login', { email, password })
      
      if (data.token) {
        localStorage.setItem('token', data.token)
        window.location.href = '/dashboard'
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (err: any) {
      setError(err.message || 'Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <img src="/6soft-logo.png" alt="6soft" className="h-12 w-12 object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            <LockClosedIcon className="h-10 w-10 text-white" style={{ display: 'none' }} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">6soft HRM</h1>
          <p className="text-slate-600 dark:text-slate-400">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
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
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition-all" 
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
                  className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition-all" 
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
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline">
              Forgot your password?
            </Link>
          </div>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-2">Demo Credentials:</p>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-1 text-xs font-mono">
              <p className="text-slate-700 dark:text-slate-300">Admin: admin@example.com / password123</p>
              <p className="text-slate-700 dark:text-slate-300">User: user@example.com / password123</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-slate-600 dark:text-slate-400">
          <p>© 2025 6soft HRM. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
