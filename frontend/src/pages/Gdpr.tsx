import React from 'react';
import { Link } from 'react-router-dom';

export default function Gdpr() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>GDPR Compliance</h1>
      <p className="text-sm text-slate-500">
        Last updated: {new Date().toLocaleDateString('en-GB')}
      </p>

      <h2>Controller</h2>
      <p>
        6soft Ltd acts as data controller for accounts created by 6soft, and as
        data processor where an employer organisation operates a tenant.
        Enquiries: <a href="mailto:hello@onsidehr.co.uk">hello@onsidehr.co.uk</a>.
      </p>

      <h2>Data subject rights</h2>
      <ul>
        <li>
          <strong>Access &amp; export.</strong> Every employee record exposes
          JSON and Excel export; administrators can use the{' '}
          <Link to="/data-export">Data Export</Link> page to fulfil subject
          access requests.
        </li>
        <li>
          <strong>Rectification.</strong> Employees can update their profile;
          administrators can correct records on request.
        </li>
        <li>
          <strong>Erasure.</strong> Subject to retention obligations (HMRC, Home
          Office), records can be erased on instruction.
        </li>
        <li>
          <strong>Consent.</strong> Granular consent grants/withdrawals are
          captured on the <Link to="/consent">Data Consent</Link> page and
          written to the audit log.
        </li>
      </ul>

      <h2>Security measures</h2>
      <ul>
        <li>
          Passwords stored using bcrypt; sessions authenticated with signed
          JWTs.
        </li>
        <li>
          Role-based access control (ADMIN / DIRECTOR / OFFICE_ASSISTANT /
          EMPLOYEE).
        </li>
        <li>All sensitive operations recorded in an immutable audit log.</li>
        <li>TLS in transit; data at rest stored in UK/EU-region MySQL.</li>
      </ul>

      <h2>Sub-processors</h2>
      <p>
        Hosting: Hostinger (UK region). SMTP email: as configured by the
        operating organisation. We do not transfer personal data outside the
        UK/EEA without an appropriate safeguard.
      </p>

      <h2>Breach notification</h2>
      <p>
        Suspected personal-data breaches will be notified to administrators
        within 72 hours of becoming aware, in line with UK GDPR Article 33.
      </p>
    </article>
  );
}
