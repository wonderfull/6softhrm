import React from 'react';

export default function Privacy() {
 return (
    <article className="prose prose-slate dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-ink-3">Last updated: 26 August 2026</p>

      <h2>Who we are</h2>
      <p>
 OnsideHR is a UK HR management platform operated by 6soft Ltd (United
 Kingdom). For privacy enquiries, contact{' '}
        <a href="mailto:hello@onsidehr.co.uk">hello@onsidehr.co.uk</a>.
      </p>

      <h2>Our role: processor for your employer</h2>
      <p>
 OnsideHR is sold to companies. If your employer uses OnsideHR, your
 employer is the <strong>data controller</strong> of the information held
 about you, and 6soft Ltd is the <strong>data processor</strong> acting
 on their documented instructions under a Data Processing Agreement.
 Questions about why your data is processed, requests for access,
 correction or erasure should go to your employer's HR administrator in
 the first instance, and we support them in fulfilling those requests.
      </p>
      <p>
 6soft Ltd acts as a <strong>controller</strong> only for the limited
 data needed to run the service itself: platform account records,
 billing contacts, support correspondence and security logs.
      </p>

      <h2>What the platform holds</h2>
      <ul>
        <li>Account data: name, email, role, hashed password.</li>
        <li>
 Employment data your employer records: job title, contract dates,
 leave, timesheets, salary details, sponsorship and right-to-work
 records.
        </li>
        <li>
 Documents uploaded by you or your administrator (contracts, payslips,
 identity and right-to-work evidence).
        </li>
        <li>
 System logs: authentication events, audit trail entries and IP
 addresses, kept for security and to meet UK GDPR accountability
 duties.
        </li>
      </ul>

      <h2>Lawful bases</h2>
      <p>
 Your employer typically relies on UK GDPR Article 6(1)(b) (performance
 of the employment contract), 6(1)(c) (legal obligation, including Home
 Office sponsor-licence record-keeping under Appendix D) and 6(1)(f)
        (legitimate interests in running HR securely). Where special-category
 data is recorded (for example equal-opportunities monitoring), an
 Article 9 condition and explicit consent are captured in the app's
 consent module.
      </p>

      <h2>Where data lives</h2>
      <p>
 Production data is hosted in the UK/EU. Uploaded documents are stored
 in private object storage with jurisdiction restricted to the EU.
 Access is authenticated, role-based, tenant-isolated and audit-logged.
 We do not sell personal data, and we never use customer data to train
 anything.
      </p>

      <h2>Retention</h2>
      <p>
 Each employer configures retention to meet their obligations, for
 example six years for payroll records (HMRC) and, for sponsored
 workers, the duration of sponsorship plus one year (Home Office
 Appendix D). When a company leaves OnsideHR, their data is returned on
 request and then deleted after a 30-day grace period.
      </p>

      <h2>Your rights</h2>
      <p>
 You have the rights of access, rectification, erasure, restriction,
 portability and objection under UK GDPR. Exercise them with your
 employer; OnsideHR gives them the tooling (subject access export,
 consent records, audit history) to respond. You can also complain to
 the ICO at <a href="https://ico.org.uk">ico.org.uk</a>.
      </p>

      <h2>Sub-processors</h2>
      <p>
 The infrastructure suppliers we use are listed on the{' '}
        <a href="/dpa">Data Processing Agreement</a> page, along with notice
 commitments before any addition.
      </p>
    </article>
  );
}
