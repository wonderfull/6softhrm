import React from 'react';

export default function Terms() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Terms of Service</h1>
      <p className="text-sm text-slate-500">Last updated: 26 August 2026</p>

      <h2>1. The agreement</h2>
      <p>
        These terms govern use of OnsideHR, a hosted HR management service
        provided by 6soft Ltd ("we", "us") to the company named on the order
        ("the Customer"). Individual users access the service under their
        employer's subscription and acceptable-use rules.
      </p>

      <h2>2. The service</h2>
      <p>
        OnsideHR provides employee records, leave and time tracking, document
        storage and — where subscribed — a UK sponsor-licence compliance
        module. Compliance tooling supports the Customer's Home Office duties;
        it does not replace them, and it is not legal or immigration advice.
        Responsibility for reports to UKVI, and for the accuracy of data
        entered, remains with the Customer.
      </p>

      <h2>3. Accounts and security</h2>
      <p>
        The Customer administers its own users and roles. Credentials are
        personal and must not be shared. We may suspend access to protect the
        service or other customers, and will notify the Customer's
        administrator when we do.
      </p>

      <h2>4. Data protection</h2>
      <p>
        The Customer is the controller of the personal data it records; we
        process it under the <a href="/dpa">Data Processing Agreement</a>,
        which forms part of these terms. On termination we return the
        Customer's data on request and delete it after a 30-day grace period.
      </p>

      <h2>5. Fees and term</h2>
      <p>
        Fees, plan and any seat limit are as stated on the order. Subscriptions
        are monthly rolling with no minimum term and no setup fee, unless the
        order states otherwise. We give at least 30 days' notice of price
        changes.
      </p>

      <h2>6. Service standards</h2>
      <p>
        We operate the service with reasonable skill and care, take nightly
        backups, and target availability appropriate to a business system. The
        service is provided "as is" to the maximum extent permitted by law; our
        aggregate liability in any 12-month period is limited to the fees paid
        in that period. Nothing limits liability that cannot lawfully be
        limited.
      </p>

      <h2>7. Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales, and the
        courts of England and Wales have exclusive jurisdiction.
      </p>
    </article>
  );
}
