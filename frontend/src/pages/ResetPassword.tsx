import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '../lib/api';
import { Badge, Button, Input } from '../components/ui';
import AuthLayout from '../components/AuthLayout';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState('');

  const token = searchParams.get('token');

  React.useEffect(() => {
    if (!token) {
      setError('Invalid reset link - missing token');
    }
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!token) {
      setError('Invalid reset link');
      return;
    }

    setLoading(true);

    try {
      await apiPost('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your new password."
      below={
        !success ? (
          <p className="text-[13px] text-ink-2">
            <Link to="/login" className="text-link hover:underline">
              Back to sign in
            </Link>
          </p>
        ) : undefined
      }
    >
      {success ? (
        <div role="status" className="flex flex-col items-start gap-2">
          <Badge tone="ok">Password reset</Badge>
          <p className="text-[15px] font-semibold text-ink">
            Your password has been reset.
          </p>
          <p className="text-[13px] text-ink-2">Redirecting to sign in…</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-[18px]">
          <Input
            size="lg"
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
          />

          <Input
            size="lg"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
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
            disabled={!token}
            className="mt-1 w-full"
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
