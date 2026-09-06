import React from 'react';
import { apiPost } from '../lib/api';
import Card from './Card';

// Two-factor authentication management for the signed-in user.
export default function SecuritySettingsCard() {
 const [stage, setStage] = React.useState<'idle' | 'setup' | 'enabled'>('idle');
 const [qr, setQr] = React.useState('');
 const [otpauth, setOtpauth] = React.useState('');
 const [code, setCode] = React.useState('');
 const [message, setMessage] = React.useState('');
 const [error, setError] = React.useState('');

 async function beginSetup() {
 setError('');
 setMessage('');
 try {
 const res = await apiPost('/auth/2fa/setup');
 setQr(res.qrDataUrl);
 setOtpauth(res.otpauth);
 setStage('setup');
    } catch (e: any) {
 if (/already enabled/i.test(e.message)) setStage('enabled');
 else setError(e.message);
    }
  }

 async function enable(e: React.FormEvent) {
 e.preventDefault();
 setError('');
 try {
 await apiPost('/auth/2fa/enable', { code });
 setStage('enabled');
 setCode('');
 setMessage('Two-factor authentication is on. You will be asked for a code at every sign-in.');
    } catch (e: any) {
 setError(e.message);
    }
  }

 async function disable(e: React.FormEvent) {
 e.preventDefault();
 setError('');
 try {
 await apiPost('/auth/2fa/disable', { code });
 setStage('idle');
 setCode('');
 setQr('');
 setMessage('Two-factor authentication is off.');
    } catch (e: any) {
 setError(e.message);
    }
  }

 return (
    <Card className="p-6">
      <h3 className="text-base font-semibold text-ink mb-1">
 Two-factor authentication
      </h3>
      <p className="mb-4 text-sm text-ink-2">
 Protects the account that can see salaries, passport numbers and bank
 details. Strongly recommended for admins and directors.
      </p>

      {message && (
        <div className="mb-3 rounded-md border border-ok bg-ok-tint px-3 py-2 text-sm text-ok ">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-md border border-bad bg-bad-tint px-3 py-2 text-sm text-bad ">
          {error}
        </div>
      )}

      {stage === 'idle' && (
        <button onClick={beginSetup} className="btn-primary">
 Set up 2FA
        </button>
      )}

      {stage === 'setup' && (
        <form onSubmit={enable} className="space-y-3">
          <p className="text-sm">
 Scan this QR code with Google Authenticator, 1Password or any TOTP
 app, then enter the 6-digit code it shows.
          </p>
          {qr && <img src={qr} alt="2FA QR code" className="h-44 w-44 rounded-md border border-line" />}
          <details className="text-xs text-ink-3">
            <summary className="cursor-pointer">Can't scan? Enter the key manually</summary>
            <code className="mt-1 block break-all">{otpauth}</code>
          </details>
          <div className="flex gap-2">
            <input
 value={code}
 onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
 inputMode="numeric"
 maxLength={6}
 placeholder="123456"
 aria-label="Authentication code"
 className="w-32 rounded-md border border-line-2 px-3 py-2 text-center font-mono "
            />
            <button type="submit" disabled={code.length !== 6} className="btn-primary disabled:opacity-50">
 Turn on
            </button>
          </div>
        </form>
      )}

      {stage === 'enabled' && (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm font-medium text-ok">
            ✓ Two-factor authentication is on.
          </p>
          <p className="text-sm text-ink-2">
 To turn it off, enter a current code from your authenticator app.
          </p>
          <div className="flex gap-2">
            <input
 value={code}
 onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
 inputMode="numeric"
 maxLength={6}
 placeholder="123456"
 aria-label="Authentication code"
 className="w-32 rounded-md border border-line-2 px-3 py-2 text-center font-mono "
            />
            <button type="submit" disabled={code.length !== 6} className="btn-ghost disabled:opacity-50">
 Turn off 2FA
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
