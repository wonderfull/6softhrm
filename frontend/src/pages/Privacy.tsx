import React from 'react';

export default function Privacy() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500">
        Last updated: {new Date().toLocaleDateString('en-GB')}
      </p>

      <h2>Who we are</h2>
      <p>
        6soft HRM is operated by 6soft Ltd (United Kingdom). For privacy
        enquiries, contact{' '}
        <a href="mailto:info@6soft.co.uk">info@6soft.co.uk</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email, role, hashed password.</li>
        <li>
          Employment data: job title, contract dates, leave, timesheets,
          sponsorship records.
        </li>
        <li>
          Documents you or your administrator upload (contracts, payslips,
          right-to-work evidence).
        </li>
        <li>
          System logs: authentication events, audit log entries, IP address for
          security forensics.
        </li>
      </ul>

      <h2>Lawful bases</h2>
      <p>
        We process personal data under UK GDPR Article 6(1)(b) (performance of
        an employment contract), 6(1)(c) (legal obligation — Home Office
        sponsor-licence record keeping) and 6(1)(f) (legitimate interest in
        operating the HR system securely).
      </p>

      <h2>Your rights</h2>
      <p>
        You have the right to access, rectify, export, or erase your personal
        data. Use the Data Consent page in-app or contact{' '}
        <a href="mailto:info@6soft.co.uk">info@6soft.co.uk</a>. You may also
        lodge a complaint with the UK Information Commissioner's Office
        (ico.org.uk).
      </p>

      <h2>Retention</h2>
      <p>
        Right-to-work and sponsorship evidence is retained for the period
        required by Home Office guidance (currently the duration of sponsorship
        plus one year). Other employment records are retained per HMRC
        requirements (six years from end of tax year).
      </p>

      <h2>Cookies</h2>
      <p>
        We use a single first-party token in <code>localStorage</code> for
        authentication. No third-party analytics or advertising cookies are set.
      </p>
    </article>
  );
}
