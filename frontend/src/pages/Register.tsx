import React from 'react'
import { apiPost } from '../lib/api'

export default function Register() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const data = await apiPost('/auth/register', { email, password, name })
    if (data.id) {
      alert('Registered. Please login.')
    } else {
      alert('Registration failed')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Register</h2>
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" className="form-input" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" className="form-input" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="new-password" className="form-input" />
        <button className="btn-primary">Register</button>
      </form>
    </div>
  )
}
