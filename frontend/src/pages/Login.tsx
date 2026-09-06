import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiPost } from '../lib/api';
import { storeTenant } from '../lib/tenant';
import { Button, Input } from '../components/ui';
import AuthLayout from '../components/AuthLayout';

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

  if (pendingToken) {
    return (
      <AuthLayout
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app."
      >
        <form onSubmit={submitCode} className="flex flex-col gap-[18px]">
          {error && (
            <p role="alert" className="text-[13px] text-bad">
              {error}
            </p>
          )}
          <Input
            size="lg"
            label="Authentication code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            className="font-mono text-center text-lg tracking-[0.4em]"
          />
          <Button
            type="submit"
            size="lg"
            loading={loading}
            disabled={totpCode.length !== 6}
            className="mt-1 w-full"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPendingToken('');
              setTotpCode('');
              setError('');
            }}
            className="w-full"
          >
            Back to password
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Use the company account your administrator set up for you."
      below={
        <p className="text-[13px] leading-[1.55] text-ink-2">
          Sign in with your assigned company account. If you do not have access
          yet, ask an administrator to create your user account or send you a
          password reset link.
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <Input
          id="login-email"
          size="lg"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
          required
        />

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label
              htmlFor="login-password"
              className="text-[13px] font-medium text-ink"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[13px] text-link hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="login-password"
            size="lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

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
