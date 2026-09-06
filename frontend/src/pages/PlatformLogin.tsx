import React from 'react';
import { API_BASE_URL } from '../lib/api';
import { setPlatformToken } from '../lib/platformApi';
import { Button, Input } from '../components/ui';
import AuthLayout from '../components/AuthLayout';

export default function PlatformLogin() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/platform/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setPlatformToken(data.token);
        window.location.href = '/platform';
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Platform Console"
      subtitle="Operator access only. All actions are audited."
    >
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <Input
          id="platform-email"
          size="lg"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          id="platform-password"
          size="lg"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p role="alert" className="text-[13px] text-bad">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="mt-1 w-full"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
