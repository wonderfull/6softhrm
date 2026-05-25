import React from 'react';

export default function Terms() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Terms of Service</h1>
      <p className="text-sm text-slate-500">
        Last updated: {new Date().toLocaleDateString('en-GB')}
      </p>

      <h2>Acceptance</h2>
      <p>
        By accessing 6soft HRM you agree to these terms. If you are using the
        system on behalf of an employer, you confirm that you have authority to
        bind that organisation.
      </p>

      <h2>Account use</h2>
      <ul>
        <li>
          Keep your credentials confidential — your account is personal to you.
        </li>
        <li>Only access employee records you are authorised to view.</li>
        <li>
          Report suspected unauthorised access to{' '}
          <a href="mailto:info@6soft.co.uk">info@6soft.co.uk</a>.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Do not upload unlawful content, attempt to bypass access controls, or
        use the platform to process data unrelated to your employment
        relationship.
      </p>

      <h2>Availability</h2>
      <p>
        We aim for high availability but provide the service "as is" without
        warranty. Scheduled maintenance windows are communicated to
        administrators in advance where possible.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent permitted by law, 6soft Ltd's aggregate liability under
        these terms is limited to the fees paid in the twelve months preceding
        the claim.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>
    </article>
  );
}
