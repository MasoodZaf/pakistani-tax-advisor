import React from 'react';
import LegalLayout, { H2, P, UL, LI, Callout, CONTACT_EMAIL } from './LegalLayout';

export default function TermsAndConditions() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      subtitle="The rules for using MeraTax. By creating an account or using the service, you agree to these terms."
    >
      <Callout>
        MeraTax is an independent software tool for preparing Pakistani income tax returns. It is
        <strong> not affiliated with, endorsed by, or operated by the Federal Board of Revenue (FBR)</strong> or
        any government body.
      </Callout>

      <H2>1. About these terms</H2>
      <P>
        These Terms &amp; Conditions ("Terms") govern your access to and use of the MeraTax web and mobile
        applications, and any related services (together, the "Service"). If you do not agree to these Terms,
        do not use the Service.
      </P>

      <H2>2. What MeraTax is — and is not</H2>
      <P>
        MeraTax helps you organise your financial information, perform tax calculations based on the applicable
        Finance Act, and prepare an income tax return for your own review and filing. MeraTax is a
        self-service tool. It does <strong>not</strong> file returns with the FBR on your behalf unless a
        feature explicitly states otherwise, and it does <strong>not</strong> provide licensed legal,
        accounting, or professional tax advice.
      </P>
      <P>
        Tax calculations are provided on a best-effort basis using the rules in force for the relevant tax year.
        You are responsible for reviewing every figure before relying on or filing your return.
      </P>

      <H2>3. Eligibility &amp; your account</H2>
      <UL>
        <LI>You must be at least 18 years old and legally able to enter into these Terms.</LI>
        <LI>You must provide accurate, current, and complete information and keep it up to date.</LI>
        <LI>You are responsible for safeguarding your password and for all activity under your account.</LI>
        <LI>Notify us immediately at {CONTACT_EMAIL} if you suspect unauthorised use of your account.</LI>
      </UL>

      <H2>4. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL>
        <LI>Use the Service for any unlawful purpose or to submit false or fraudulent information.</LI>
        <LI>Attempt to gain unauthorised access to the Service, other accounts, or our systems.</LI>
        <LI>Interfere with, disrupt, probe, or overload the Service or its security controls.</LI>
        <LI>Reverse engineer, scrape, or resell the Service except as permitted by law.</LI>
        <LI>Upload malware or content that infringes the rights of others.</LI>
      </UL>

      <H2>5. Your data &amp; privacy</H2>
      <P>
        Your use of the Service is also governed by our Privacy Policy, which explains what we collect, how we
        use it, and the safeguards we apply. By using the Service you consent to that handling of your data.
      </P>

      <H2>6. Fees &amp; payments</H2>
      <P>
        Some features may be offered free of charge and others as paid features or subscriptions. Where fees
        apply, the price, billing cycle, and what is included will be shown to you before you pay. Unless
        required by law or stated otherwise at the time of purchase, fees are non-refundable once the relevant
        service has been delivered. Payments are processed by third-party payment providers; we do not store
        your full card or banking credentials.
      </P>

      <H2>7. Accuracy &amp; your responsibility</H2>
      <P>
        You are solely responsible for the correctness and completeness of the information you enter and for
        the return you ultimately file. Always verify your figures against your own records and, where your
        situation is complex, consult a qualified professional. MeraTax is a tool to assist you — the final
        responsibility for your tax filing rests with you.
      </P>

      <H2>8. Intellectual property</H2>
      <P>
        The Service, including its software, design, content, and trademarks (including the MeraTax name and
        logo), is owned by MeraTax and protected by law. We grant you a limited, non-exclusive,
        non-transferable licence to use the Service for your personal tax-preparation purposes. The data you
        enter remains yours.
      </P>

      <H2>9. Service availability</H2>
      <P>
        We work to keep the Service available and accurate, but we provide it on an "as is" and "as available"
        basis. We may modify, suspend, or discontinue features, and we may perform maintenance that
        temporarily limits access.
      </P>

      <H2>10. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by applicable law, MeraTax and its operators will not be liable for any
        indirect, incidental, special, or consequential losses, or for any penalties, interest, surcharges,
        additional tax, or other liabilities arising from your tax filings, from errors or omissions in the
        information you provide, or from your reliance on calculations you did not independently verify. Nothing
        in these Terms excludes liability that cannot be excluded under law.
      </P>

      <H2>11. Indemnity</H2>
      <P>
        You agree to indemnify and hold MeraTax and its operators harmless from claims, losses, and expenses
        arising out of your misuse of the Service, your breach of these Terms, or the information you submit.
      </P>

      <H2>12. Suspension &amp; termination</H2>
      <P>
        We may suspend or terminate your access if you breach these Terms or use the Service in a way that risks
        harm to others or to the Service. You may stop using the Service at any time.
      </P>

      <H2>13. Changes to these terms</H2>
      <P>
        We may update these Terms from time to time. When we make material changes we will publish a new version
        and may ask you to accept it again before continuing to use the Service. Continued use after an update
        means you accept the revised Terms.
      </P>

      <H2>14. Governing law</H2>
      <P>
        These Terms are governed by the laws of the Islamic Republic of Pakistan, and the courts of Pakistan
        will have jurisdiction over any dispute, without prejudice to any mandatory consumer protections that
        apply to you.
      </P>

      <H2>15. Contact</H2>
      <P>
        Questions about these Terms? Contact us at <strong>{CONTACT_EMAIL}</strong>.
      </P>
    </LegalLayout>
  );
}
