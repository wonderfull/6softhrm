import express, { Request, Response } from 'express';
import { sendEmail } from '../lib/emailService';

const router = express.Router();

const DEMO_INBOX = 'hello@onsidehr.co.uk';
// Deliberately conservative: one dot-separated domain label at minimum, so
// "a@b" is refused before it reaches the mail server.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function parseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

function parseHeadcount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 100000) return null;
  return n;
}

/**
 * Public demo request from the landing page. No tenant context, no database
 * write: this only sends an email to the sales inbox. `website` is a honeypot
 * field the real form keeps hidden, so anything that fills it gets a 202 and
 * silence.
 */
router.post('/demo-request', async (req: Request, res: Response) => {
  const email = parseEmail(req.body?.email);
  if (!email) {
    return res.status(400).json({ error: 'Enter a valid work email address.' });
  }

  const headcount = parseHeadcount(req.body?.headcount);
  if (headcount === null) {
    return res.status(400).json({ error: 'Enter how many people you employ.' });
  }

  if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
    return res.status(202).json({ ok: true });
  }

  const subject = `Demo request: ${email} (${headcount} people)`;
  const text = `Demo request from the OnsideHR landing page.\n\nEmail: ${email}\nHeadcount: ${headcount}\n`;
  const html = `<p>Demo request from the OnsideHR landing page.</p><p>Email: ${email}<br>Headcount: ${headcount}</p>`;

  const sent = await sendEmail({ to: DEMO_INBOX, subject, text, html });
  if (!sent) {
    console.warn(`Demo request from ${email} could not be emailed to ${DEMO_INBOX}`);
  }

  // The visitor gets the same answer either way; a failed send is our problem.
  return res.status(202).json({ ok: true });
});

export default router;
