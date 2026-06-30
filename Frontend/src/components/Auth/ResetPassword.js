import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import BrandLockup from '../common/BrandLockup';

// Reset password using the single-use token from the emailed link
// (/reset-password?token=...). On success, send the user to sign in.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < 12) return setError('Password must be at least 12 characters long.');
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const res = await axios.post('/api/reset-password', { token, password });
      if (res.data?.success) {
        toast.success('Password reset — please sign in.');
        navigate('/login', { replace: true });
      } else {
        setError(res.data?.message || 'Could not reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. The link may have expired.');
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

        {!token ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={h1}>Invalid reset link</h1>
            <p style={sub}>This link is missing its token. Please request a new password reset.</p>
            <Link to="/forgot-password" style={primaryLink}>Request a new link</Link>
            <Link to="/login" style={{ ...linkBtn, marginTop: 14 }}><ArrowLeft size={16} /> Back to sign in</Link>
          </div>
        ) : (
          <>
            <h1 style={h1}>Set a new password</h1>
            <p style={sub}>Choose a new password for your account (at least 12 characters, with a letter and a number).</p>
            <form onSubmit={submit}>
              <label style={label}>New password</label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <Lock size={17} style={iconStyle} />
                <input
                  type={show ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  style={input}
                />
                <button type="button" onClick={() => setShow((s) => !s)} style={eyeBtn} aria-label="Toggle password visibility">
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <label style={label}>Confirm new password</label>
              <div style={{ position: 'relative', marginBottom: 18 }}>
                <Lock size={17} style={iconStyle} />
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
                  style={input}
                />
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, margin: '0 0 14px' }}>{error}</p>}
              <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
            <Link to="/login" style={{ ...linkBtn, marginTop: 18 }}><ArrowLeft size={16} /> Back to sign in</Link>
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
const input = { width: '100%', padding: '11px 40px 11px 38px', borderRadius: 11, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--content)', fontSize: 15, fontFamily: "'Nunito', sans-serif", outline: 'none', boxSizing: 'border-box' };
const iconStyle = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--content-muted, #5b6478)' };
const eyeBtn = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--content-muted, #5b6478)', padding: 2 };
const primaryBtn = { width: '100%', padding: '13px 18px', borderRadius: 11, border: 'none', background: '#28396C', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" };
const primaryLink = { display: 'inline-block', padding: '11px 20px', borderRadius: 11, background: '#28396C', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' };
const linkBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', textDecoration: 'none', color: 'var(--content-muted, #5b6478)', fontSize: 13.5, fontWeight: 600, padding: '8px' };
