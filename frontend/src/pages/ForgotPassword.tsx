import React from 'react'
import { apiPost } from '../lib/api'
import { Link } from 'react-router-dom'
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function ForgotPassword() {
  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [resetLink, setResetLink] = React.useState('')
  const [error, setError] = React.useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setResetLink('')
    setLoading(true)
    
    try {
      const data = await apiPost('/auth/forgot-password', { email })
      setMessage(data.message || 'Reset link generated')
      if (data.resetLink) {
        setResetLink(data.resetLink)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request')
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
            <EnvelopeIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Forgot Password?</h1>
          <p className="text-slate-600 dark:text-slate-400">Enter your email to receive a password reset link</p>
        </div>

        {/* Card */}
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

            {/* Success Message */}
            {message && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-2">{message}</p>
                {resetLink && (
                  <div className="mt-3">
                    <p className="text-xs text-green-600 dark:text-green-400 mb-2">Use this link to reset your password:</p>
                    <div className="bg-white dark:bg-slate-800 p-3 rounded border border-green-200 dark:border-green-700">
                      <a 
                        href={resetLink} 
                        className="text-xs text-blue-600 dark:text-blue-400 break-all hover:underline"
                      >
                        {resetLink}
                      </a>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">Link expires in 1 hour</p>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Link 
              to="/login" 
              className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
