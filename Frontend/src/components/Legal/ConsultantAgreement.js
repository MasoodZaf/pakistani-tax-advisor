import React from 'react';
import LegalLayout, { H2, P, UL, LI, Callout, CONTACT_EMAIL } from './LegalLayout';

export default function ConsultantAgreement() {
  return (
    <LegalLayout
      title="Tax Consultant Agreement"
      subtitle="The basis on which MeraTax's tax guidance, calculations, and AI assistant are provided to you."
    >
      <Callout>
        <strong>Important:</strong> MeraTax provides tax preparation tools and general guidance — not licensed
        professional tax, legal, or accounting advice. Please read this before relying on any guidance,
        calculation, or AI response in the app.
      </Callout>

      <H2>1. Guidance is informational, not professional advice</H2>
      <P>
        Any guidance, suggestion, estimate, calculation, optimisation tip, or response provided by MeraTax —
        including by the in-app AI tax assistant — is general information to help you prepare your own return.
        It does <strong>not</strong> constitute licensed tax, legal, accounting, or financial advice, and it is
        not a substitute for advice from a qualified professional who knows your full circumstances.
      </P>

      <H2>2. No advisory relationship</H2>
      <P>
        Using MeraTax's guidance features or AI assistant does not create a client–advisor, agency, or
        fiduciary relationship between you and MeraTax. We do not act as your tax representative before the FBR
        unless a specific, separate engagement says so in writing.
      </P>

      <H2>3. The AI tax assistant</H2>
      <UL>
        <LI>The AI assistant generates responses automatically and can be incomplete or incorrect.</LI>
        <LI>It does not know facts you have not provided, and cannot judge your full legal situation.</LI>
        <LI>Always verify its output against the applicable law and your own records before acting on it.</LI>
        <LI>Do not submit information to the assistant that you do not wish to be processed for that purpose.</LI>
      </UL>

      <H2>4. Accuracy &amp; the law</H2>
      <P>
        Tax rules change and individual circumstances vary. While we aim to reflect the applicable Finance Act
        and FBR rules, we do not warrant that any guidance or calculation is complete, current, or correct for
        your specific situation. You remain responsible for ensuring your return complies with the law.
      </P>

      <H2>5. Human consultants (when applicable)</H2>
      <P>
        If you choose to connect with a human tax consultant through MeraTax, that engagement may be subject to
        separate terms between you and the consultant. MeraTax facilitates the connection and data access you
        authorise, but the professional advice given by a consultant is theirs, not MeraTax's.
      </P>

      <H2>6. Your responsibility &amp; limitation of liability</H2>
      <P>
        You are responsible for the decisions you make and the return you file. To the maximum extent permitted
        by law, MeraTax and its operators are not liable for any tax, penalty, surcharge, interest, or other
        loss arising from reliance on guidance, calculations, or AI responses that you did not independently
        verify. This is subject to the limitation of liability in the Terms &amp; Conditions.
      </P>

      <H2>7. When in doubt, get professional advice</H2>
      <P>
        For complex, high-value, or uncertain matters, consult a qualified Pakistani tax professional before
        filing. MeraTax is designed to assist you — not to replace professional judgement where it is needed.
      </P>

      <H2>8. Contact</H2>
      <P>Questions about this Agreement? Contact <strong>{CONTACT_EMAIL}</strong>.</P>
    </LegalLayout>
  );
}
