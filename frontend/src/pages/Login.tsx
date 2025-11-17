import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (data.token) {
      localStorage.setItem('token', data.token)
      navigate('/employees')
    } else {
      alert('Login failed')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h2 className="text-3xl font-bold mb-6">Login</h2>
      <form onSubmit={submit} className="space-y-4">
        <input 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          placeholder="Email" 
          type="email"
          required
          className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-yellow-400 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:focus:border-yellow-500 transition-colors" 
        />
        <input 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Password" 
          type="password"
          required
          className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:border-yellow-400 focus:outline-none dark:bg-slate-700 dark:border-slate-600 dark:focus:border-yellow-500 transition-colors" 
        />
        <button className="w-full px-4 py-3 bg-yellow-400 hover:bg-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700 rounded-lg font-semibold transition-colors">
          Login
        </button>
      </form>
    </div>
  )
}
