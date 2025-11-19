import React from 'react'
import { apiPost } from '../lib/api'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LockClosedIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState('')
  
  const token = searchParams.get('token')

  React.useEffect(() => {
    if (!token) {
      setError('Invalid reset link - missing token')
    }
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!token) {
      setError('Invalid reset link')
      return
    }

    setLoading(true)
    
    try {
      await apiPost('/auth/reset-password', { token, newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-900/20 dark:to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <LockClosedIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Reset Password</h1>
          <p className="text-slate-600 dark:text-slate-400">Enter your new password</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Password Reset Successful!</h3>
              <p className="text-slate-600 dark:text-slate-400">Redirecting to login page...</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              {/* New Password Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="••••••••" 
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white dark:placeholder-slate-400 transition-all" 
                  />
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    placeholder="••••••••" 
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
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

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={loading || !token}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Back to Login */}
          {!success && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
              <Link 
                to="/login" 
                className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
