import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useTaxYear } from '../../contexts/TaxYearContext';
import { useTaxPreview } from '../../hooks/useTaxPreview';
import { Link } from 'react-router-dom';
import WizardCTABanner from '../Wizard/WizardCTABanner';
import {
  FileText, BarChart3, TrendingUp, Calendar,
  CheckCircle, Clock, ArrowRight, AlertCircle,
  Zap, Settings, ChevronRight, Scale, Loader2
} from 'lucide-react';

// Map step id → router path. Mirrors getRoutePath() in TaxFormsOverview.
const ROUTE_OVERRIDES = {
  final_min_income:      '/income-tax/final-min-income',
  adjustable_tax:        '/income-tax/adjustable-tax',
  capital_gain:          '/income-tax/capital-gains',
  tax_computation:       '/income-tax/tax-computation',
  wealth:                '/wealth-statement/wealth-statement',
  wealth_reconciliation: '/wealth-statement/wealth-reconciliation',
};
const WEALTH_STEP_IDS = new Set(['wealth', 'wealth_reconciliation']);
const stepRoute = (id) =>
  ROUTE_OVERRIDES[id] || (WEALTH_STEP_IDS.has(id) ? `/wealth-statement/${id}` : `/income-tax/${id}`);

const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Nunito:wght@400;500;600;700&display=swap');
    .dash-root { font-family: 'Nunito', sans-serif; -webkit-font-smoothing: antialiased; color: #1e2a4a; }
    .dash-display { font-family: 'Bricolage Grotesque', sans-serif; }
    .dash-card { background: #fff; border: 1px solid #e3e2dc; border-radius: 18px; transition: box-shadow 0.2s; }
    .dash-card:hover { box-shadow: 0 4px 20px rgba(26,28,32,0.07); }
    .dash-link-card {
      background: #fff; border: 1px solid #e3e2dc; border-radius: 14px;
      padding: 14px 16px; display: flex; align-items: center; gap: 14px;
      text-decoration: none; color: inherit;
      transition: border-color 0.2s, background 0.2s, transform 0.15s;
    }
    .dash-link-card:hover { border-color: #a8c890; background: #f5f8ea; transform: translateX(2px); }
    .form-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 10px; border-radius: 10px;
      text-decoration: none; color: inherit;
      transition: background 0.15s, transform 0.1s;
    }
    .form-row + .form-row { margin-top: 2px; }
    .form-row:hover { background: #f5f7fb; transform: translateX(2px); }
    .form-row.is-next { background: #F0FFC2; border: 1px solid #c0da94; }
    .form-row.is-next:hover { background: #e6f5b3; }
    .status-pill {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      padding: 3px 8px; border-radius: 999px; white-space: nowrap;
    }
    .progress-track { width: 100%; height: 8px; background: #EAE6BC; border-radius: 100px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #28396C, #3d5a90); border-radius: 100px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
    .cta-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 22px; background: #28396C; color: #fff;
      font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700;
      border-radius: 12px; text-decoration: none;
      transition: background 0.2s, transform 0.15s;
    }
    .cta-btn:hover { background: #1e2d5a; transform: translateY(-1px); }
    @keyframes countRing { from { stroke-dashoffset: 251; } }
    .progress-ring-fill { animation: countRing 1.2s ease-out forwards; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 0.9s linear infinite; }
  `}</style>
);

function CircularProgress({ pct, size = 96 }) {
  const r    = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * pct) / 100;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="48" cy="48" r={r} stroke="#EAE6BC" strokeWidth="8" fill="none" />
      <circle className="progress-ring-fill" cx="48" cy="48" r={r}
        stroke="url(#pgGrad)" strokeWidth="8" fill="none"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
      />
      <defs>
        <linearGradient id="pgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#28396C" />
          <stop offset="100%" stopColor="#3d5a90" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDaysRemaining() {
  const deadline = new Date('2026-09-30T23:59:59');
  return Math.max(0, Math.ceil((new Date() - deadline) / (1000 * 60 * 60 * 24)) * -1);
}

const Dashboard = () => {
  const { user } = useAuth();
  const { currentTaxYear } = useTaxYear();
  const {
    taxReturn,
    getCompletionPercentage,
    activeSteps,
    completedSteps,
    taxCalculation,
    formData,
  } = useTaxForm();

  // Live preview: keep the input set stable so the debounced hook doesn't
  // refire on every unrelated formData write (e.g. wealth statement edits).
  const previewInputs = useMemo(() => ({
    income:          formData?.income          || {},
    adjustable_tax:  formData?.adjustable_tax  || {},
    capital_gain:    formData?.capital_gain    || {},
    reductions:      formData?.reductions      || {},
    credits:         formData?.credits         || {},
    deductions:      formData?.deductions      || {},
  }), [formData]);

  // Only call the backend once income data exists — sending an empty preview
  // wastes a request and just returns zeros.
  const hasPreviewableData = !!(
    previewInputs.income?.annual_salary_wages_total ||
    previewInputs.income?.b16_annual_salary_wages_total ||
    previewInputs.income?.monthly_basic_salary ||
    previewInputs.income?.other_income_min_tax_total ||
    previewInputs.income?.other_income_no_min_tax_total ||
    previewInputs.capital_gain?.total_capital_gain
  );

  const { preview: livePreview, loading: previewLoading } = useTaxPreview(
    hasPreviewableData ? currentTaxYear : null,
    hasPreviewableData ? previewInputs : null,
    { debounceMs: 800 }
  );

  const pct          = getCompletionPercentage();
  // activeSteps reflects the user's income profile (capital_gain / final_tax
  // are conditional). Counts must match getCompletionPercentage(), which
  // already filters by activeSteps.
  const completedCount = activeSteps.filter(s => completedSteps.has(s.id)).length;
  const totalSteps   = activeSteps.length;
  const daysLeft     = getDaysRemaining();
  const firstName    = user?.name?.split(' ')[0] || 'there';
  const filingStatus = taxReturn?.filing_status || 'draft';

  const deadlineColor = daysLeft < 30 ? '#c0392b' : daysLeft < 90 ? '#4a7a2a' : '#4a7a2a';

  const taxDue = useMemo(() => {
    // Saved/explicit calculation always wins — it's been persisted.
    if (taxCalculation) {
      const due    = taxCalculation.additional_tax_due || 0;
      const refund = taxCalculation.refund_due || 0;
      if (due > 0)    return { label: `Rs ${due.toLocaleString()}`,    note: 'Additional tax due',                color: '#c0392b', live: false };
      if (refund > 0) return { label: `Rs ${refund.toLocaleString()}`, note: 'Refund expected',                   color: '#4a7a2a', live: false };
      return { label: 'Rs 0', note: 'No additional tax', color: '#4a7a2a', live: false };
    }
    // Otherwise fall back to the live preview computed from in-flight form data.
    if (livePreview?.payments) {
      const balance = Math.round(livePreview.payments.balancePayableRefundable || 0);
      if (balance > 0) return { label: `Rs ${balance.toLocaleString()}`,            note: 'Estimated tax payable',  color: '#c0392b', live: true };
      if (balance < 0) return { label: `Rs ${Math.abs(balance).toLocaleString()}`,  note: 'Estimated refund due',   color: '#4a7a2a', live: true };
      return { label: 'Rs 0', note: 'Estimated balance is zero', color: '#4a7a2a', live: true };
    }
    return { label: '—', note: pct > 0 ? 'Fill all forms to compute' : 'Start your return', color: '#7a8890', live: false };
  }, [taxCalculation, livePreview, pct]);

  const nextIncomplete = activeSteps.find(s => !completedSteps.has(s.id));

  // Wealth reconciliation: unreconciled_difference must be zero or FBR
  // rejects the return. Surface non-zero values as a dashboard alert.
  const reconDiff = Number(formData?.wealth_reconciliation?.unreconciled_difference || 0);
  const reconBreached = Math.abs(reconDiff) >= 1;

  const quickLinks = [
    { to: '/income-tax',       icon: FileText,   color: '#28396C', bg: '#EAE6BC', label: 'Income Tax Forms',   desc: 'Fill your return section by section' },
    { to: '/wealth-statement', icon: BarChart3,   color: '#3d6020', bg: '#F0FFC2', label: 'Wealth Statement',   desc: 'Assets, liabilities and reconciliation' },
    { to: '/reports',          icon: TrendingUp,  color: '#4a7a2a', bg: '#F0FFC2', label: 'Tax Summary Report', desc: 'View computed tax and download' },
    { to: '/settings',         icon: Settings,    color: '#5e6b7c', bg: '#f0f2f5', label: 'Account Settings',   desc: 'Profile and preferences' },
  ];

  return (
    <div className="dash-root" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <Styles />

      {/* ── Greeting banner ── */}
      <div style={{
        background: '#28396C',
        backgroundImage: 'radial-gradient(ellipse at 80% 0%, rgba(181,225,139,0.12) 0%, transparent 55%)',
        borderRadius: 20, padding: '28px 32px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <svg style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', opacity: 0.05 }} width="120" height="120" viewBox="0 0 120 120" fill="none">
          <rect x="60" y="4" width="78" height="78" rx="3" transform="rotate(45 60 60)" stroke="white" strokeWidth="1.5"/>
          <rect x="60" y="20" width="50" height="50" rx="3" transform="rotate(45 60 60)" stroke="white" strokeWidth="1.5"/>
        </svg>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 4 }}>{getGreeting()}</p>
            <h1 className="dash-display" style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: 8 }}>
              {firstName}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Tax Year 2025-26</span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: filingStatus === 'submitted' ? '#B5E18B' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{filingStatus}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { value: daysLeft, label: 'days left' },
              { value: `${completedCount}/${totalSteps}`, label: 'forms done' },
            ].map(({ value, label }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 18px', textAlign: 'center' }}>
                <p className="dash-display" style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 3 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick-start wizard banner — self-hides once completed or
          dismissed. Lives between the greeting and the main grid so
          first-time users see it but it stays out of the way otherwise. */}
      <WizardCTABanner />

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 20, marginBottom: 20 }}>

        {/* Progress card */}
        <div className="dash-card" style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 className="dash-display" style={{ fontSize: 17, fontWeight: 700, color: '#1e2a4a', letterSpacing: '-0.02em' }}>Return progress</h2>
              <p style={{ fontSize: 13, color: '#4a5575', fontWeight: 500, marginTop: 2 }}>
                {completedCount === 0 ? 'Start filling your forms below' : `${totalSteps - completedCount} section${totalSteps - completedCount !== 1 ? 's' : ''} remaining`}
              </p>
            </div>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress pct={pct} />
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <p className="dash-display" style={{ fontSize: 17, fontWeight: 800, color: '#28396C', lineHeight: 1 }}>{pct}%</p>
              </div>
            </div>
          </div>

          <div className="progress-track" style={{ marginBottom: 20 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div>
            {activeSteps.map(step => {
              const done   = completedSteps.has(step.id);
              const isNext = !done && nextIncomplete?.id === step.id;
              const pillStyle = done
                ? { background: '#dcfce7', color: '#166534' }
                : isNext
                ? { background: '#28396C', color: '#fff' }
                : { background: '#f1f5f9', color: '#64748b' };
              const pillLabel = done ? 'Done' : isNext ? 'Up next' : 'Pending';
              return (
                <Link
                  key={step.id}
                  to={stepRoute(step.id)}
                  className={`form-row ${isNext ? 'is-next' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{step.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2a4a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.title}</p>
                      <p style={{ fontSize: 11, color: '#7a8890', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.description}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span className="status-pill" style={pillStyle}>{pillLabel}</span>
                    {done
                      ? <CheckCircle size={16} color="#4a7a2a" />
                      : <Clock size={15} color={isNext ? '#28396C' : '#d1d5db'} />
                    }
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ marginTop: 20 }}>
            <Link to={nextIncomplete ? '/income-tax' : '/reports'} className="cta-btn" style={{ width: '100%', justifyContent: 'center' }}>
              {completedCount === 0 ? 'Start your return' : nextIncomplete ? `Continue — ${nextIncomplete.title}` : 'View tax summary'}
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Tax estimate */}
          <div className="dash-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#7a8890', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Estimated tax</p>
              {taxDue.live && (
                <span
                  title="Live preview — recalculates as you fill the forms"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 9, fontWeight: 800, color: '#28396C',
                    background: '#eef2ff', borderRadius: 999,
                    padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}
                >
                  {previewLoading
                    ? <Loader2 size={9} className="spin" />
                    : <span style={{ width: 5, height: 5, background: '#4a7a2a', borderRadius: 999 }} />}
                  Live
                </span>
              )}
            </div>
            <p className="dash-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em', color: taxDue.color, marginBottom: 4 }}>{taxDue.label}</p>
            <p style={{ fontSize: 13, color: '#4a5575', fontWeight: 500 }}>{taxDue.note}</p>
          </div>

          {/* Deadline */}
          <div className="dash-card" style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Calendar size={13} color="#7a8890" />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#7a8890', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Filing deadline</p>
            </div>
            <p className="dash-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', color: deadlineColor, marginBottom: 3 }}>Sep 30, 2026</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#4a5575' }}>
              {daysLeft > 0 ? `${daysLeft} days from today` : 'Deadline passed'}
            </p>
            {daysLeft < 90 && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: daysLeft < 30 ? '#fdf2f2' : '#F0FFC2', borderRadius: 8, padding: '6px 10px' }}>
                <AlertCircle size={13} color={daysLeft < 30 ? '#c0392b' : '#4a7a2a'} />
                <p style={{ fontSize: 12, fontWeight: 700, color: daysLeft < 30 ? '#c0392b' : '#4a7a2a' }}>
                  {daysLeft < 30 ? 'File soon — penalty applies' : 'Less than 3 months left'}
                </p>
              </div>
            )}
          </div>

          {/* Wealth reconciliation alert — must be zero or FBR rejects */}
          {reconBreached && (
            <Link
              to={stepRoute('wealth_reconciliation')}
              style={{
                display: 'block', textDecoration: 'none',
                background: '#fdf2f2', border: '1.5px solid #f3b4b4',
                borderRadius: 16, padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <Scale size={13} color="#c0392b" />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#c0392b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>FBR compliance — action needed</p>
              </div>
              <p className="dash-display" style={{ fontSize: 18, fontWeight: 800, color: '#7a1c1c', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Rs {Math.abs(reconDiff).toLocaleString()}
              </p>
              <p style={{ fontSize: 12, color: '#5b1e1e', fontWeight: 500, lineHeight: 1.5 }}>
                Your wealth statement is unreconciled by this amount. FBR will reject the return until it is zero. Open the form to fix.
              </p>
            </Link>
          )}

          {/* Next step */}
          {nextIncomplete && (
            <div style={{ background: '#F0FFC2', border: '1.5px solid #c0da94', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Zap size={13} color="#3d6020" />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#3d6020', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Up next</p>
              </div>
              <p className="dash-display" style={{ fontSize: 15, fontWeight: 700, color: '#1e2a4a', marginBottom: 3 }}>{nextIncomplete.title}</p>
              <p style={{ fontSize: 12, color: '#4a5575', fontWeight: 500, marginBottom: 12 }}>{nextIncomplete.description}</p>
              <Link to="/income-tax" className="cta-btn" style={{ fontSize: 13, padding: '9px 16px' }}>
                Open form <ChevronRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="dash-card" style={{ padding: '22px 24px', marginBottom: 20 }}>
        <h2 className="dash-display" style={{ fontSize: 16, fontWeight: 700, color: '#1e2a4a', letterSpacing: '-0.02em', marginBottom: 16 }}>Quick access</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {quickLinks.map(({ to, icon: Icon, color, bg, label, desc }) => (
            <Link key={to} to={to} className="dash-link-card">
              <div style={{ width: 38, height: 38, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2a4a' }}>{label}</p>
                <p style={{ fontSize: 12, color: '#4a5575', fontWeight: 500 }}>{desc}</p>
              </div>
            </Link>
          ))}
          {['admin', 'super_admin'].includes(user?.role) && (
            <Link to="/admin" className="dash-link-card">
              <div style={{ width: 38, height: 38, background: '#fdf2f2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={17} color="#c0392b" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2a4a' }}>Admin Panel</p>
                <p style={{ fontSize: 12, color: '#4a5575', fontWeight: 500 }}>User management and system</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Reminder strip */}
      <div style={{ background: '#F0FFC2', border: '1px solid #c0da94', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <AlertCircle size={18} color="#4a7a2a" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#2d4a10', marginBottom: 4 }}>Before you submit</p>
          <p style={{ fontSize: 13, color: '#3d6020', fontWeight: 500, lineHeight: 1.6 }}>
            Review all entered data carefully · Keep supporting documents ready · Verify CNIC and NTN · Deadline for Tax Year 2025-26 is <strong>September 30, 2026</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
