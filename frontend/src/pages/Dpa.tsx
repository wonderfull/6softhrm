import React from 'react';

const SUB_PROCESSORS = [
  {
 name: 'Hostinger International Ltd',
 role: 'Application and database hosting (VPS)',
 location: 'UK/EU',
  },
  {
 name: 'Cloudflare, Inc. (R2)',
 role: 'Document object storage, EU jurisdiction restriction',
 location: 'EU',
  },
  {
 name: 'SMTP email provider',
 role: 'Transactional email delivery (notifications, password resets)',
 location: 'UK/EU',
  },
];

export default function Dpa() {
 return (
    <article className="prose prose-slate dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Data Processing Agreement</h1>
      <p className="text-sm text-ink-3">Version 1.0 · 26 August 2026</p>

      <p>
 This DPA is entered into between the Customer (controller) and 6soft
 Ltd (processor) and applies whenever OnsideHR processes personal data
 on the Customer's behalf. It is incorporated into the Terms of Service.
      </p>

      <h2>1. Subject matter and instructions</h2>
      <p>
 We process the personal data the Customer records in OnsideHR (staff
 records, leave, time, documents, sponsorship compliance data) solely
 to provide the service, on the Customer's documented instructions, for
 the duration of the subscription (UK GDPR Article 28(3)).
      </p>

      <h2>2. Confidentiality and security</h2>
      <p>
 Access to customer data is limited to personnel bound by
 confidentiality. Measures include tenant isolation enforced in the data
 layer, role-based access control, encrypted transport, hashed
 credentials, private object storage with signed time-limited URLs,
 audit logging of sensitive operations, and nightly backups with a
 30-day retention cycle.
      </p>

      <h2>3. Support access</h2>
      <p>
 Where our operators access a Customer tenant for support, the session
 is time-limited and every action is written to the Customer's own
 audit log, flagged as operator access.
      </p>

      <h2>4. Sub-processors</h2>
      <p>
 The Customer authorises the sub-processors below. We will give at least
 14 days' notice before adding or replacing one, during which the
 Customer may object.
      </p>
      <table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Purpose</th>
            <th>Region</th>
          </tr>
        </thead>
        <tbody>
          {SUB_PROCESSORS.map((sp) => (
            <tr key={sp.name}>
              <td>{sp.name}</td>
              <td>{sp.role}</td>
              <td>{sp.location}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>5. Data subject rights and assistance</h2>
      <p>
 OnsideHR provides subject-access export, consent records, rectification
 and deletion tooling so the Customer can answer data subject requests
 within statutory deadlines. We assist with security, breach
 notification and impact-assessment obligations (Articles 32–36).
      </p>

      <h2>6. Personal data breach</h2>
      <p>
 We notify the Customer's administrator without undue delay after
 becoming aware of a personal data breach affecting their tenant,
 with enough detail to meet the Customer's ICO reporting duties.
      </p>

      <h2>7. Return and deletion</h2>
      <p>
 On termination, the Customer may export all tenant data (database
 export and document archive). Thirty days after termination we delete
 the tenant's data from production and it ages out of backups on the
 backup retention cycle (Article 28(3)(g)).
      </p>

      <h2>8. International transfers</h2>
      <p>
 Processing takes place in the UK/EU. We do not transfer Customer
 personal data outside the UK/EU without safeguards recognised by UK
 GDPR and prior notice to the Customer.
      </p>
    </article>
  );
}
