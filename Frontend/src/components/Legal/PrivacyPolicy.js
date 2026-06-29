import React from 'react';
import LegalLayout, { H2, P, UL, LI, Callout, PRIVACY_EMAIL } from './LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How MeraTax collects, uses, and protects your personal and financial information."
    >
      <Callout>
        We treat your tax and financial data as highly sensitive. This policy explains what we hold, why, and
        the concrete security measures we use to protect it.
      </Callout>

      <H2>1. Who we are</H2>
      <P>
        MeraTax is an independent tool for preparing Pakistani income tax returns. It is not affiliated with the
        Federal Board of Revenue (FBR). For privacy questions, contact <strong>{PRIVACY_EMAIL}</strong>.
      </P>

      <H2>2. Information we collect</H2>
      <UL>
        <LI><strong>Account details:</strong> your name, email address, and password (stored only as a secure hash, never in plain text).</LI>
        <LI><strong>Identity &amp; profile:</strong> information you provide such as CNIC, NTN, and contact details needed to prepare a return.</LI>
        <LI><strong>Financial information:</strong> income, deductions, credits, assets, expenses, withholding, and other figures you enter or upload (including prior-year return PDFs and receipts).</LI>
        <LI><strong>Sign-in data:</strong> if you use Google or Apple sign-in, we receive a verified email and a provider identifier — we never receive your Google/Apple password.</LI>
        <LI><strong>Technical &amp; security data:</strong> IP address, device/browser (user-agent), timestamps, and audit records of security-relevant actions.</LI>
      </UL>

      <H2>3. How we use your information</H2>
      <UL>
        <LI>To provide the Service — preparing, calculating, saving, and presenting your tax return.</LI>
        <LI>To authenticate you and keep your account secure.</LI>
        <LI>To maintain an audit trail of security-sensitive events (e.g. logins, password changes, account access).</LI>
        <LI>To provide optional features you choose to use, such as the AI tax assistant and consultant support.</LI>
        <LI>To process payments for paid features (handled by third-party payment providers).</LI>
        <LI>To comply with legal obligations and to detect, prevent, and respond to fraud or abuse.</LI>
      </UL>

      <H2>4. How we protect your data — our security measures</H2>
      <P>
        Security is built into the product. The controls below are actually implemented in MeraTax:
      </P>
      <UL>
        <LI><strong>Encrypted connections:</strong> traffic is served over HTTPS/TLS via a hardened reverse proxy; application services are isolated on an internal network and are not directly exposed to the public internet.</LI>
        <LI><strong>Strong password protection:</strong> passwords are hashed with bcrypt (work factor 12) and are never stored or logged in plain text. A minimum-strength password policy is enforced.</LI>
        <LI><strong>Modern authentication:</strong> sessions use signed JSON Web Tokens (JWT, HS256) with a fixed algorithm to prevent token-forgery attacks, automatic expiry, and immediate revocation of all sessions when you change your password.</LI>
        <LI><strong>Verified single sign-on:</strong> Google and Apple sign-in are validated against the provider's published keys with replay protection (nonce binding) and a verified-email requirement.</LI>
        <LI><strong>Rate limiting &amp; abuse protection:</strong> login, API, and file-upload endpoints are throttled to resist brute-force and enumeration attacks.</LI>
        <LI><strong>Input validation &amp; injection defence:</strong> requests are schema-validated; database access uses parameterised queries with a strict table/column allowlist to prevent SQL injection.</LI>
        <LI><strong>Hardened web responses:</strong> security headers (via Helmet and the web server) including X-Frame-Options, X-Content-Type-Options, a Content-Security-Policy, and referrer controls.</LI>
        <LI><strong>Data minimisation in logs:</strong> our logging automatically redacts secrets and masks personal data (for example, emails and CNIC are masked) so sensitive values do not land in log files.</LI>
        <LI><strong>Audit logging:</strong> security-relevant actions are recorded with actor, action, IP, and timestamp; you can review your own account activity in the app.</LI>
        <LI><strong>Safe error handling &amp; monitoring:</strong> internal error details are never exposed to users in production; errors are monitored with sensitive fields scrubbed before reporting.</LI>
        <LI><strong>Secrets management:</strong> credentials and keys are kept in protected environment configuration, never committed to source code.</LI>
        <LI><strong>Dependency scanning:</strong> production dependencies are automatically audited for known high/critical vulnerabilities in our build pipeline.</LI>
      </UL>
      <P muted>
        No system can guarantee absolute security, and we continue to strengthen our controls over time. If you
        discover a security issue, please report it to {PRIVACY_EMAIL}.
      </P>

      <H2>5. Our technology stack</H2>
      <P>
        For transparency, MeraTax is built on a modern, well-supported stack: a React front end, a Node.js /
        Express back end, and a PostgreSQL database, deployed in isolated containers behind a TLS-terminating
        reverse proxy. Security libraries include bcrypt (password hashing), jsonwebtoken (sessions),
        Helmet (HTTP hardening), express-rate-limit (throttling), and Zod (input validation).
      </P>

      <H2>6. When we share information</H2>
      <P>We do not sell your personal data. We share it only:</P>
      <UL>
        <LI>With service providers who help us operate the Service (e.g. hosting, payment processing, error monitoring), bound to protect it and use it only for those purposes.</LI>
        <LI>With a tax consultant only if you explicitly choose to connect with one through the Service.</LI>
        <LI>Where required by law, regulation, or valid legal process.</LI>
      </UL>

      <H2>7. AI assistant</H2>
      <P>
        If you use the optional AI tax assistant, the questions and relevant figures you submit are processed to
        generate a response. Do not enter information you do not wish to be processed for that purpose. AI
        responses are guidance only and must be reviewed by you.
      </P>

      <H2>8. Data retention</H2>
      <P>
        We keep your information for as long as your account is active and as needed to provide the Service and
        meet legal, tax, and record-keeping obligations. You may request deletion of your account; some records
        may be retained where the law requires.
      </P>

      <H2>9. Your rights</H2>
      <UL>
        <LI>Access and review the information held in your account.</LI>
        <LI>Correct inaccurate information.</LI>
        <LI>Request deletion of your account, subject to legal retention requirements.</LI>
        <LI>Withdraw optional consents (for example, disconnect a linked sign-in provider).</LI>
      </UL>
      <P>To exercise these rights, contact {PRIVACY_EMAIL}.</P>

      <H2>10. Children</H2>
      <P>The Service is not intended for anyone under 18, and we do not knowingly collect their data.</P>

      <H2>11. Changes to this policy</H2>
      <P>
        We may update this policy. When changes are material we will publish a new version and may ask you to
        review and accept it before continuing to use the Service.
      </P>

      <H2>12. Contact</H2>
      <P>Privacy questions or requests: <strong>{PRIVACY_EMAIL}</strong>.</P>
    </LegalLayout>
  );
}
