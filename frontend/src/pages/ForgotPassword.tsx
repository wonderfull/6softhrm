import React from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../lib/api';
import { Button, Input } from '../components/ui';
import AuthLayout from '../components/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [resetLink, setResetLink] = React.useState('');
  const [error, setError] = React.useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetLink('');
    setLoading(true);

    try {
      const data = await apiPost('/auth/forgot-password', { email });
      setMessage(data.message || 'Reset link generated');
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email to receive a password reset link."
      below={
        <p className="text-[13px] text-ink-2">
          <Link to="/login" className="text-link hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-[18px]">
        <Input
          size="lg"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
          required
        />

        {message && (
          <div role="status" className="text-[13px]">
            <p className="font-medium text-ok">{message}</p>
            {resetLink && (
              <div className="mt-2">
                <p className="text-xs text-ink-2">
                  Use this link to reset your password:
                </p>
                <a
                  href={resetLink}
                  className="mt-1.5 block break-all rounded-md border border-line bg-bg px-3 py-2 font-mono text-xs text-link hover:underline"
                >
                  {resetLink}
                </a>
                <p className="mt-1.5 text-xs text-ink-3">
                  Link expires in 1 hour
                </p>
              </div>
            )}
          </div>
        )}

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
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
