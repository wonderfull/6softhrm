import React from 'react';
import { apiPost } from '../../lib/api';
import { Button, Input } from '../ui';
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_TEL } from './SiteHeader';

type Status = 'idle' | 'sending' | 'sent' | 'failed';

// Demo request card: work email, headcount, one primary button. Posts to the
// public endpoint; the `website` field is a honeypot the server drops.
export default function DemoForm() {
  const [email, setEmail] = React.useState('');
  const [headcount, setHeadcount] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    try {
      await apiPost('/public/demo-request', {
        email: email.trim(),
        headcount: Number(headcount),
        website,
      });
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  }

  const card =
    'relative bg-surface border border-line rounded-lg shadow-sm p-6 w-full max-w-[440px] min-[760px]:justify-self-end';

  if (status === 'sent') {
    return (
      <div role="status" className={`${card} flex flex-col gap-2`}>
        <p className="text-base font-semibold text-ink">Request received.</p>
        <p className="text-sm text-ink-2">
          We will email you from{' '}
          <span className="font-mono text-[13px]">{CONTACT_EMAIL}</span> to
          arrange the call.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`${card} flex flex-col gap-4`}>
      <Input
        label="Work email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@company.co.uk"
        required
        maxLength={254}
        size="lg"
        className="input-lg"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Headcount"
        type="number"
        name="headcount"
        inputMode="numeric"
        min={1}
        max={100000}
        step={1}
        placeholder="How many people you employ"
        required
        size="lg"
        className="input-lg"
        value={headcount}
        onChange={(e) => setHeadcount(e.target.value)}
      />
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden"
      >
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      <Button
        type="submit"
        size="lg"
        loading={status === 'sending'}
        className="btn-hero cta-spring w-full"
      >
        Book a demo
      </Button>
      {status === 'failed' ? (
        <p role="alert" className="text-xs text-bad">
          That did not send. Email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-mono underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>{' '}
          or call{' '}
          <a
            href={CONTACT_TEL}
            className="font-mono underline underline-offset-2"
          >
            {CONTACT_PHONE}
          </a>{' '}
          instead.
        </p>
      ) : (
        <p className="text-xs text-ink-3">
          A 30-minute call. Bring your employee CSV.
        </p>
      )}
    </form>
  );
}
