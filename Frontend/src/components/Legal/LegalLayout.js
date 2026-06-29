import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Shared chrome + typography for the public legal pages (Terms, Privacy, User
// Agreement, Consultant Agreement). Plain inline styles on brand tokens so the
// pages render identically whether reached from the footer, the consent gate's
// "read" links, or a direct URL — no app shell required.

export const EFFECTIVE_DATE = '29 June 2026';
export const CONTACT_EMAIL = 'support@mera-tax.com';
export const PRIVACY_EMAIL = 'privacy@mera-tax.com';

const wrap = { maxWidth: 820, margin: '0 auto', padding: '0 24px' };

export function H2({ children }) {
  return (
    <h2 style={{
      fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700,
      color: 'var(--brand-on-cream-navy, #28396C)', margin: '34px 0 10px', letterSpacing: '-0.01em',
    }}>
      {children}
    </h2>
  );
}

export function P({ children, muted }) {
  return (
    <p style={{
      fontSize: 15, lineHeight: 1.7, margin: '0 0 14px',
      color: muted ? 'var(--content-muted, #5b6478)' : 'var(--content, #1f2533)',
    }}>
      {children}
    </p>
  );
}

export function UL({ children }) {
  return <ul style={{ margin: '0 0 14px', paddingLeft: 22, display: 'grid', gap: 8 }}>{children}</ul>;
}

export function LI({ children }) {
  return (
    <li style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--content, #1f2533)' }}>{children}</li>
  );
}

// A small "this is informational, not legal advice / get it reviewed" callout.
export function Callout({ children }) {
  return (
    <div style={{
      background: 'var(--surface-2, #f3f1ea)', border: '1px solid var(--l-border, #e3ddcf)',
      borderRadius: 12, padding: '14px 16px', margin: '8px 0 22px',
      fontSize: 13.5, lineHeight: 1.6, color: 'var(--content-muted, #5b6478)',
    }}>
      {children}
    </div>
  );
}

export default function LegalLayout({ title, subtitle, children }) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · MeraTax`;
    window.scrollTo(0, 0);
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface, #faf8f2)', paddingBottom: 64, fontFamily: "'Nunito', sans-serif" }}>
      {/* Header bar */}
      <header style={{ borderBottom: '1px solid var(--l-border, #e3ddcf)', padding: '18px 0', background: 'var(--surface, #faf8f2)' }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            color: 'var(--content-muted, #5b6478)', fontSize: 14, fontWeight: 600,
          }}>
            <ArrowLeft size={16} /> Back to MeraTax
          </Link>
          <span style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800,
            color: 'var(--brand-on-cream-navy, #28396C)', letterSpacing: '-0.02em',
          }}>
            MeraTax
          </span>
        </div>
      </header>

      <main style={{ ...wrap, paddingTop: 36 }}>
        <h1 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 30, fontWeight: 800,
          color: 'var(--content, #1f2533)', margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>
        {subtitle && <P muted>{subtitle}</P>}
        <p style={{ fontSize: 13, color: 'var(--content-muted, #5b6478)', margin: '0 0 8px', fontFamily: "'JetBrains Mono', monospace" }}>
          Version 1.0 · Effective {EFFECTIVE_DATE}
        </p>

        {children}

        <footer style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--l-border, #e3ddcf)', display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          {[
            { to: '/terms', label: 'Terms & Conditions' },
            { to: '/privacy', label: 'Privacy Policy' },
            { to: '/user-agreement', label: 'User Agreement' },
            { to: '/consultant-agreement', label: 'Tax Consultant Agreement' },
          ].map((l) => (
            <Link key={l.to} to={l.to} style={{ fontSize: 13, color: 'var(--brand-on-cream-navy, #28396C)', fontWeight: 600, textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </footer>
      </main>
    </div>
  );
}
