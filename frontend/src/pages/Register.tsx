import React from 'react'

export default function Register() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) })
    const data = await res.json()
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full p-2 border rounded" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-2 border rounded" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full p-2 border rounded" />
        <button className="px-4 py-2 bg-yellow-400 rounded">Register</button>
      </form>
    </div>
  )
}
