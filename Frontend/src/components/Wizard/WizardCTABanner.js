import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { wizardAPI } from '../../services/wizardAPI';

const DISMISS_KEY = 'wizardCtaDismissed';

// Dashboard banner that surfaces the quick-start wizard. Rules:
//   - Hidden if /api/wizard/status returns completed.
//   - "Resume" copy + button if in_progress.
//   - "Start" copy + button otherwise.
//   - Dismissible (localStorage flag, valid for the rest of this tax year).
//
// The dashboard mounts this once per page; we self-fetch the status on
// mount so the dashboard doesn't have to thread it through.
const WizardCTABanner = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await wizardAPI.status();
        if (!cancelled) setStatus(s);
      } catch {
        // Non-fatal — banner just stays hidden if the status call fails.
        if (!cancelled) setStatus(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!status || status.completed) return null;
  if (dismissed && !status.in_progress) return null;

  const isResume = status.in_progress;
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="wizard-cta" style={{
      borderRadius: 16,
      padding: '16px 18px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#28396C',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-on-cream-navy)', letterSpacing: '-0.01em' }}>
            {isResume ? "Resume your tax quick-start" : "Get a rough tax estimate in 90 seconds"}
          </p>
          <p style={{ fontSize: 12, color: 'var(--content)', fontWeight: 500, marginTop: 2 }}>
            {isResume
              ? "Pick up where you left off — your answers are saved."
              : "A few quick questions, then we'll fill your form drafts and show a rough total."}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/wizard')}
          style={{
            padding: '10px 16px',
            background: '#28396C',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Nunito', sans-serif",
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isResume ? 'Resume' : 'Start'} <ArrowRight size={14} />
        </button>
        {!isResume && (
          <button
            type="button"
            onClick={dismiss}
            title="Hide for now"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--content-subtle)',
              display: 'flex',
              alignItems: 'center',
              padding: 6,
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WizardCTABanner;
