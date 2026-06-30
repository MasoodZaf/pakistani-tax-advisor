import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import BrandLockup from '../common/BrandLockup';

// Self-service "Forgot password" — request a reset link by email. The server
// always responds generically (never reveals whether the email exists), so the
// UI shows the same "check your email" confirmation either way.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await axios.post('/api/forgot-password', { email: email.trim() });
      setSent(true);
    } catch {
      // Even on error we show the generic confirmation (no enumeration / no leak).
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22, color: 'var(--content)' }}>
          <BrandLockup width={170} tone="auto" showTagline={false} />
        </div>

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <CheckCircle size={40} color="#06D884" />
            </div>
            <h1 style={h1}>Check your email</h1>
            <p style={sub}>
              If an account exists for <strong>{email.trim()}</strong>, we've sent a link to reset your
              password. It's valid for 60 minutes. Don't forget to check your spam folder.
            </p>
            <Link to="/login" style={{ ...linkBtn, marginTop: 8 }}>
              <ArrowLeft size={16} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 style={h1}>Forgot your password?</h1>
            <p style={sub}>Enter your account email and we'll send you a link to reset it.</p>
            <form onSubmit={submit}>
              <label style={label}>Email address</label>
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <Mail size={17} style={iconStyle} />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={input}
                />
              </div>
              <button type="submit" disabled={loading || !email.trim()} style={{ ...primaryBtn, opacity: loading || !email.trim() ? 0.6 : 1 }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <Link to="/login" style={{ ...linkBtn, marginTop: 18 }}>
              <ArrowLeft size={16} /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface, #faf8f2)', padding: 24, fontFamily: "'Nunito', sans-serif" };
const card = { width: '100%', maxWidth: 420, background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 18, padding: '32px 30px', boxShadow: '0 10px 40px rgba(20,30,60,0.08)' };
const h1 = { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 23, fontWeight: 800, color: 'var(--content, #1f2533)', margin: '0 0 6px', textAlign: 'center', letterSpacing: '-0.02em' };
const sub = { fontSize: 14.5, lineHeight: 1.6, color: 'var(--content-muted, #5b6478)', margin: '0 0 22px', textAlign: 'center' };
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--content, #1f2533)', marginBottom: 7 };
const input = { width: '100%', padding: '11px 12px 11px 38px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--content)', fontSize: 15, fontFamily: "'Nunito', sans-serif", outline: 'none', boxSizing: 'border-box' };
const iconStyle = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--content-muted, #5b6478)' };
const primaryBtn = { width: '100%', padding: '13px 18px', borderRadius: 11, border: 'none', background: '#28396C', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" };
const linkBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', textDecoration: 'none', color: 'var(--content-muted, #5b6478)', fontSize: 13.5, fontWeight: 600, padding: '8px' };
