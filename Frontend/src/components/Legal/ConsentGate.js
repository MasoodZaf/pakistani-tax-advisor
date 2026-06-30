import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Consent gate: before a filer reaches the main app they must accept the
// currently-required agreements. We ask the server which agreements are still
// pending; if any, we render a blocking acceptance screen instead of the app.
//
// A module-level cache keyed by user id means we only hit the server once per
// session — subsequent route navigations render the app instantly without a
// spinner flash. It resets naturally when a different user signs in.
let satisfiedForUserId = null;

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface, #faf8f2)' }}>
      <div className="spinner" />
    </div>
  );
}

function ConsentScreen({ pending, onAccepted }) {
  const { logout } = useAuth();
  const [checked, setChecked] = useState(() => Object.fromEntries(pending.map((p) => [p.key, false])));
  const [submitting, setSubmitting] = useState(false);

  const allChecked = pending.every((p) => checked[p.key]);

  const toggle = (key) => setChecked((c) => ({ ...c, [key]: !c[key] }));

  const accept = async () => {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    try {
      await axios.post('/api/agreements/accept', { keys: pending.map((p) => p.key) });
      onAccepted();
    } catch (e) {
      toast.error('Could not record your acceptance. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface, #faf8f2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 18, padding: '32px 30px', boxShadow: '0 10px 40px rgba(20,30,60,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 10, background: 'var(--brand-on-cream-navy, #28396C)', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <ShieldCheck size={20} />
          </span>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: 'var(--content, #1f2533)', margin: 0, letterSpacing: '-0.02em' }}>
            Before you continue
          </h1>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--content-muted, #5b6478)', margin: '0 0 22px' }}>
          To use MeraTax, please review and accept the following. Open each to read the full text — your
          acceptance is recorded for your protection and ours.
        </p>

        <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
          {pending.map((p) => (
            <label key={p.key} htmlFor={`agree-${p.key}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 14px', border: `1px solid ${checked[p.key] ? 'var(--brand-on-cream-navy, #28396C)' : 'var(--line)'}`, borderRadius: 12, cursor: 'pointer', background: checked[p.key] ? 'rgba(40,57,108,0.04)' : 'transparent', transition: 'border-color .15s, background .15s' }}>
              <input
                id={`agree-${p.key}`}
                type="checkbox"
                checked={checked[p.key]}
                onChange={() => toggle(p.key)}
                style={{ marginTop: 3, width: 17, height: 17, accentColor: '#28396C', flex: '0 0 auto' }}
              />
              <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--content, #1f2533)' }}>
                I have read and agree to the{' '}
                <Link to={p.route} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-on-cream-navy, #28396C)', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                  {p.title} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Link>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={accept}
          disabled={!allChecked || submitting}
          style={{
            width: '100%', padding: '13px 18px', borderRadius: 11, border: 'none',
            background: allChecked && !submitting ? '#28396C' : 'var(--line)',
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: allChecked && !submitting ? 'pointer' : 'not-allowed',
            fontFamily: "'Nunito', sans-serif", transition: 'background .15s',
          }}
        >
          {submitting ? 'Saving…' : 'Agree & continue'}
        </button>

        <button
          type="button"
          onClick={logout}
          style={{ width: '100%', marginTop: 12, padding: '10px', background: 'transparent', border: 'none', color: 'var(--content-muted, #5b6478)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
        >
          Decline and sign out
        </button>
      </div>
    </div>
  );
}

export default function ConsentGate({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => (user && satisfiedForUserId === user.id ? 'ok' : 'loading'));
  const [pending, setPending] = useState([]);

  useEffect(() => {
    if (!user) return;
    if (satisfiedForUserId === user.id) { setState('ok'); return; }

    let cancelled = false;
    setState('loading');
    axios.get('/api/agreements/status')
      .then((r) => {
        if (cancelled) return;
        const p = r.data?.pending || [];
        if (p.length === 0) { satisfiedForUserId = user.id; setState('ok'); }
        else { setPending(p); setState('pending'); }
      })
      .catch(() => {
        // Fail-open: a transient status-check error must not lock a legitimate
        // user out of their own tax data. The next navigation re-checks, and
        // acceptance itself is still recorded server-side when given.
        if (!cancelled) setState('ok');
      });

    return () => { cancelled = true; };
  }, [user]);

  const handleAccepted = () => {
    if (user) satisfiedForUserId = user.id;
    setState('ok');
  };

  if (!user) return children; // route guards handle the unauthenticated case
  if (state === 'loading') return <Spinner />;
  if (state === 'pending') return <ConsentScreen pending={pending} onAccepted={handleAccepted} />;
  return children;
}
