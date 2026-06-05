import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { wizardAPI } from '../../services/wizardAPI';
import WizardField from './WizardField';

// AI quick-start wizard — full-page chat-style intake. See
// docs/wizard-design.md for the design. Backend at /api/wizard/*.

const formatPkr = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(n));
};

// Seed initial values for a step from the prior captured_data (re-run flow)
// or empty if first time through. Used to pre-fill widgets on step entry.
function seedValuesForStep(promptSchema, capturedForStep) {
  if (!promptSchema) return { values: {}, rawText: {} };
  const values = {};
  const rawText = {};
  for (const f of promptSchema.fields) {
    if (capturedForStep && capturedForStep[f.key] !== undefined) {
      values[f.key] = capturedForStep[f.key];
      // For pkr inputs we want to display the formatted number, not the
      // raw integer string, so the user sees what they typed last time.
      if (
        (f.input_type === 'pkr_amount' || f.input_type === 'pkr_optional' || f.input_type === 'number') &&
        capturedForStep[f.key] != null
      ) {
        rawText[f.key] = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(
          capturedForStep[f.key]
        );
      }
    } else if (f.default != null) {
      values[f.key] = f.default;
    }
  }
  return { values, rawText };
}

const Wizard = () => {
  const navigate = useNavigate();
  // Pull TaxFormContext so we can refresh it after finalize. Without this,
  // the dashboard's useTaxPreview hook keeps using stale (empty) in-memory
  // formData and shows "Estimated tax: Rs 0" even though the wizard just
  // wrote real draft values to the form tables.
  const { loadTaxReturn } = useTaxForm();

  // mode: 'loading' | 'turn' | 'finalizing' | 'review' | 'error'
  const [mode, setMode] = useState('loading');
  const [error, setError] = useState(null);

  // Session
  const [session, setSession] = useState(null); // { id, captured_data }
  const [step, setStep] = useState(null); // { id, prompt, progress }
  const [values, setValues] = useState({});
  const [rawText, setRawText] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [rawReply, setRawReply] = useState('');
  const [lastEcho, setLastEcho] = useState(null);

  // Review
  const [review, setReview] = useState(null); // /finalize response

  const submitLockRef = useRef(false);

  // ── Boot: start a session (or resume an in-progress one). If a completed
  // session exists for this year, the dashboard CTA shouldn't have brought
  // the user here at all — but if they hit /wizard directly, route them
  // back with a message.
  const boot = useCallback(async () => {
    setMode('loading');
    setError(null);
    try {
      const status = await wizardAPI.status();
      if (status.completed && !status.in_progress) {
        toast('Quick-start was already completed for this year. Open Settings to re-run.', { icon: 'ℹ️' });
        navigate('/dashboard');
        return;
      }
      const started = await wizardAPI.start({});
      setSession({
        id: started.session_id,
        captured_data: started.captured_data || {},
      });
      const seed = seedValuesForStep(
        started.prompt,
        (started.captured_data || {})[started.current_step]
      );
      setStep({
        id: started.current_step,
        prompt: started.prompt,
        progress: started.progress,
      });
      setValues(seed.values);
      setRawText(seed.rawText);
      setFieldErrors({});
      setRawReply('');
      setLastEcho(null);
      setMode('turn');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('wizard boot failed', e);
      setError(e?.response?.data?.error || e?.message || 'wizard_failed');
      setMode('error');
    }
  }, [navigate]);

  useEffect(() => { boot(); }, [boot]);

  // ── Submit current step ───────────────────────────────────────────────
  const submitTurn = useCallback(async () => {
    if (submitLockRef.current || !session || !step) return;
    submitLockRef.current = true;
    try {
      const turn = await wizardAPI.turn({
        sessionId: session.id,
        stepId: step.id,
        values,
        rawReply: rawReply || undefined,
      });

      // Backend always echoes captured_data forward in done case — patch our
      // local copy regardless so re-render shows the latest.
      setSession((s) => ({ ...s, captured_data: { ...s.captured_data, [step.id]: values } }));

      if (turn.done) {
        setLastEcho(turn.echo || null);
        // Move into finalize.
        setMode('finalizing');
        try {
          const fin = await wizardAPI.finalize({ sessionId: session.id });
          setReview(fin);
          setMode('review');
          // Refresh TaxFormContext so the dashboard's live preview reflects
          // the freshly-written draft values. Fire-and-forget — if it fails
          // (network blip) the dashboard will eventually re-fetch on its
          // next mount; we don't want to block the review screen on it.
          loadTaxReturn().catch(() => { /* non-blocking */ });
        } catch (e) {
          // finalize failed — let the user retry.
          toast.error(e?.response?.data?.error || 'Could not finalize. Retry?');
          setMode('turn');
        }
        return;
      }

      // Advance to next step.
      setStep({
        id: turn.next_step,
        prompt: turn.prompt,
        progress: turn.progress,
      });
      const seed = seedValuesForStep(
        turn.prompt,
        // No prior data for the next step on first run — re-run flow
        // pre-fills from session.captured_data which the backend mutated.
        (session.captured_data || {})[turn.next_step]
      );
      setValues(seed.values);
      setRawText(seed.rawText);
      setFieldErrors({});
      setRawReply('');
      setLastEcho(turn.echo || null);
    } catch (e) {
      const data = e?.response?.data;
      if (e?.response?.status === 422 && data?.field_errors) {
        setFieldErrors(data.field_errors);
        setLastEcho(data.echo || null);
        toast.error('Please check the highlighted fields.');
      } else {
        toast.error(data?.error || e?.message || 'Could not save. Try again.');
      }
    } finally {
      submitLockRef.current = false;
    }
  }, [session, step, values, rawReply, loadTaxReturn]);

  // ── Per-field setters used by WizardField ────────────────────────────
  const setValueAt = useCallback((key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);
  const setRawTextAt = useCallback((key, t) => {
    setRawText((prev) => ({ ...prev, [key]: t }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  if (mode === 'loading') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--content-subtle)', fontWeight: 600 }}>
          Loading wizard…
        </div>
      </Shell>
    );
  }

  if (mode === 'error') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <AlertCircle size={32} color="#ef4444" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700, color: 'var(--content)', marginBottom: 4 }}>Couldn't start the wizard.</p>
          <p style={{ fontSize: 13, color: 'var(--content-subtle)', marginBottom: 16 }}>{error}</p>
          <Button onClick={boot}>Try again</Button>
        </div>
      </Shell>
    );
  }

  if (mode === 'finalizing') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--content-subtle)', fontWeight: 600 }}>
          Calculating your rough tax estimate…
        </div>
      </Shell>
    );
  }

  if (mode === 'review') {
    return (
      <Shell>
        <ReviewScreen review={review} onDone={() => navigate('/dashboard')} />
      </Shell>
    );
  }

  // mode === 'turn'
  return (
    <Shell>
      <ProgressBar current={step.progress.current} total={step.progress.total} />

      {lastEcho && (
        <div style={{
          background: 'var(--brand-cream)', border: '1.5px solid var(--brand-cream-track)', borderRadius: 12,
          padding: '10px 14px', marginBottom: 16,
          fontSize: 13, color: 'var(--brand-on-cream-navy)', fontWeight: 600,
        }}>
          {lastEcho}
        </div>
      )}

      {/* Assistant prompt bubble */}
      <div style={{
        background: 'var(--surface-raised)', border: '1.5px solid var(--line)', borderRadius: 14,
        padding: '16px 18px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={16} color="#28396C" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#28396C', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Assistant
          </span>
        </div>
        <p style={{ fontSize: 15, color: 'var(--content)', lineHeight: 1.55 }}>
          {step.prompt.prompt}
        </p>
      </div>

      {/* Structured inputs */}
      <div style={{ marginBottom: 16 }}>
        {step.prompt.fields.map((f) => (
          <WizardField
            key={f.key}
            field={f}
            value={values[f.key]}
            rawText={rawText[f.key]}
            setRawText={setRawTextAt}
            setValue={setValueAt}
            error={fieldErrors[f.key]}
          />
        ))}
      </div>

      {/* Optional free-text — opt-in for natural-language replies */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--content-subtle)' }}>
          Prefer to describe it in words?
        </summary>
        <textarea
          rows={2}
          value={rawReply}
          onChange={(e) => setRawReply(e.target.value)}
          placeholder='e.g. "Basic 15 lakh, allowance 2 lakh, no bonus"'
          style={{
            width: '100%', marginTop: 8, padding: '10px 12px',
            fontSize: 14, fontFamily: "'Nunito', sans-serif",
            background: 'var(--surface-raised)',
            border: '1.5px solid var(--line)', borderRadius: 10, outline: 'none',
            resize: 'vertical', color: 'var(--content)',
          }}
        />
        <p style={{ marginTop: 4, fontSize: 11, color: 'var(--content-subtle)', fontWeight: 500 }}>
          We'll fill the boxes above from this — you can still adjust before continuing.
        </p>
      </details>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={submitTurn}>
          Continue <ArrowRight size={16} />
        </Button>
      </div>
    </Shell>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────

const Shell = ({ children }) => (
  <div style={{
    minHeight: 'calc(100vh - 80px)',
    background: 'var(--surface)',
    padding: '32px 16px',
    fontFamily: "'Nunito', sans-serif",
  }}>
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 18, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.02em' }}>
          Tax Quick-Start
        </h1>
        <p style={{ fontSize: 13, color: 'var(--content-subtle)', fontWeight: 500, marginTop: 2 }}>
          A few quick questions to get you a rough estimate.
        </p>
      </div>
      {children}
    </div>
  </div>
);

const ProgressBar = ({ current, total }) => {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--content-subtle)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Step {current} of {total}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--content-subtle)' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#28396C', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
};

const Button = ({ children, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '12px 20px',
      background: '#28396C',
      color: '#fff',
      fontSize: 14,
      fontWeight: 700,
      fontFamily: "'Nunito', sans-serif",
      border: 'none',
      borderRadius: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.55 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    {children}
  </button>
);

const ReviewScreen = ({ review, onDone }) => {
  const rough = review?.rough_calc;
  const totalIncome = rough?.income?.totalIncome;
  const totalTax = rough?.tax?.totalTaxChargeable;
  const balance = rough?.payments?.balancePayableRefundable;
  const balanceIsRefund = balance != null && balance < 0;

  return (
    <div>
      <div style={{
        background: 'var(--surface-raised)',
        border: '1.5px solid var(--line)',
        borderRadius: 16,
        padding: '24px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <CheckCircle size={24} color="#16a34a" />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.02em' }}>
            Done — here's your rough estimate
          </h2>
        </div>

        {rough ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="Total income" value={formatPkr(totalIncome)} />
            <Stat label="Tax chargeable" value={formatPkr(totalTax)} />
            <Stat
              label={balanceIsRefund ? 'Refund due' : 'Balance to pay'}
              value={formatPkr(Math.abs(balance ?? 0))}
              tone={balanceIsRefund ? 'good' : 'neutral'}
            />
            <Stat label="Tax year" value={rough.taxYear} />
          </div>
        ) : (
          <p style={{ color: 'var(--content-subtle)', fontSize: 13, fontWeight: 500 }}>
            We couldn't auto-calculate, but your inputs are saved. Open the app to see the full breakdown.
          </p>
        )}

        <div style={{
          marginTop: 18,
          padding: '12px 14px',
          background: '#fef3c7',
          border: '1.5px solid #fbbf24',
          borderRadius: 10,
        }}>
          <p style={{ fontSize: 13, color: '#78350f', fontWeight: 600, lineHeight: 1.5 }}>
            These are rough estimates based on what you told the wizard.
            Open each form in the app and verify the numbers before submitting your return to FBR.
          </p>
        </div>

        {review?.tables_written?.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--content-subtle)', fontWeight: 500, marginTop: 12 }}>
            Drafts saved to {review.tables_written.length} form{review.tables_written.length > 1 ? 's' : ''} —
            ready for you to review in the app.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button onClick={onDone}>
          Open the app <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone = 'neutral' }) => (
  <div style={{ background: 'var(--surface-sunken)', borderRadius: 10, padding: '12px 14px' }}>
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--content-subtle)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </p>
    <p style={{
      fontSize: 18,
      fontWeight: 800,
      color: tone === 'good' ? '#16a34a' : 'var(--content)',
      marginTop: 4,
      letterSpacing: '-0.01em',
    }}>
      {value}
    </p>
  </div>
);

export default Wizard;
