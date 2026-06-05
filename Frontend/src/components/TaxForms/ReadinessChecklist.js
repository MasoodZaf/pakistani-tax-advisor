import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, AlertOctagon, RefreshCw } from 'lucide-react';
import { useTaxForm } from '../../contexts/TaxFormContext';

// Map step id → router path. Same overrides as Dashboard.
const ROUTE_OVERRIDES = {
  final_min_income:      '/income-tax/final-min-income',
  adjustable_tax:        '/income-tax/adjustable-tax',
  capital_gain:          '/income-tax/capital-gains',
  tax_computation:       '/income-tax/tax-computation',
  wealth:                '/wealth-statement/wealth',
  wealth_reconciliation: '/wealth-statement/wealth-reconciliation',
  profile:               '/settings',
};
const WEALTH = new Set(['wealth', 'wealth_reconciliation']);
const stepRoute = (id) =>
  ROUTE_OVERRIDES[id] || (WEALTH.has(id) ? `/wealth-statement/${id}` : `/income-tax/${id}`);

/**
 * ReadinessChecklist — surfaces the pre-submit punch list from
 * GET /api/tax-forms/readiness/:year. Auto-loads on mount and refreshes
 * when the parent passes a `refreshKey` change.
 *
 * Compact mode: 1-line summary + a "Show details" toggle, suitable for
 * the Dashboard. Expanded mode (default): always-visible itemised list,
 * suitable for the Tax Computation Summary page.
 */
const ReadinessChecklist = ({ compact = false, refreshKey = 0 }) => {
  const { getReadinessReport, taxReturn } = useTaxForm();
  const [report, setReport]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(!compact);
  const navigate = useNavigate();

  const load = async () => {
    if (!taxReturn?.tax_year) return;
    setLoading(true);
    const r = await getReadinessReport(taxReturn.tax_year);
    setReport(r);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxReturn?.tax_year, refreshKey]);

  if (!report && !loading) return null;

  const issues   = report?.issues   || [];
  const warnings = report?.warnings || [];
  const ready    = !!report?.ready;

  // ── Compact: single-line status banner ───────────────────────────────────
  if (compact && !showAll) {
    return (
      <div
        onClick={() => setShowAll(true)}
        style={{
          background:    ready ? 'var(--brand-cream)' : issues.length > 0 ? 'var(--status-error-bg)' : 'var(--status-warn-bg)',
          border:        `1px solid ${ready ? 'var(--brand-cream-track)' : issues.length > 0 ? 'var(--status-error-border)' : 'var(--status-warn-border)'}`,
          borderRadius:  12, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}
      >
        {ready
          ? <CheckCircle size={18} color="var(--brand-on-cream)" />
          : issues.length > 0
            ? <AlertOctagon size={18} color="var(--status-error-text)" />
            : <AlertTriangle size={18} color="var(--status-warn-text)" />}
        <p style={{ fontSize: 13, fontWeight: 700, color: ready ? 'var(--brand-on-cream-navy)' : 'var(--content)' }}>
          {ready
            ? 'Ready to submit — no blocking issues'
            : `${issues.length} blocker${issues.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''} — click to review`}
        </p>
      </div>
    );
  }

  // ── Full list ─────────────────────────────────────────────────────────────
  const tone = ready
    ? { bg: 'var(--brand-cream)', border: 'var(--brand-cream-track)', accent: 'var(--brand-on-cream)', ink: 'var(--brand-on-cream-navy)', sub: 'var(--brand-on-cream-navy)' }
    : issues.length > 0
      ? { bg: 'var(--status-error-bg)', border: 'var(--status-error-border)', accent: 'var(--status-error-text)', ink: 'var(--content)', sub: 'var(--content-muted)' }
      : { bg: 'var(--status-warn-bg)', border: 'var(--status-warn-border)', accent: 'var(--status-warn-text)', ink: 'var(--content)', sub: 'var(--content-muted)' };

  const renderIssue = (it, severity, idx) => {
    const colour = severity === 'error' ? 'var(--status-error-text)' : 'var(--status-warn-text)';
    const Icon   = severity === 'error' ? AlertOctagon : AlertTriangle;
    return (
      <div
        key={`${it.code}-${idx}`}
        style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '12px 14px',
          background: severity === 'error' ? 'var(--status-error-bg)' : 'var(--status-warn-bg)',
          border: `1px solid ${severity === 'error' ? 'var(--status-error-border)' : 'var(--status-warn-border)'}`,
          borderRadius: 10, marginBottom: 8,
        }}
      >
        <Icon size={16} color={colour} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--content)', marginBottom: 4 }}>
            {it.message}
          </p>
          {it.fix && (
            <p style={{ fontSize: 12, color: 'var(--content-muted)', fontWeight: 500, marginBottom: 6, lineHeight: 1.5 }}>
              {it.fix}
            </p>
          )}
          {it.formStep && (
            <button
              type="button"
              onClick={() => navigate(stepRoute(it.formStep))}
              style={{
                fontSize: 12, fontWeight: 700, color: colour,
                background: 'transparent', border: `1px solid ${colour}`,
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              }}
            >
              Open form to fix →
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: tone.bg, border: `1.5px solid ${tone.border}`,
        borderRadius: 14, padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {ready
            ? <CheckCircle size={20} color={tone.accent} />
            : issues.length > 0
              ? <AlertOctagon size={20} color={tone.accent} />
              : <AlertTriangle size={20} color={tone.accent} />}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: tone.ink }}>
            {ready
              ? 'Ready to submit'
              : `${issues.length} blocking issue${issues.length !== 1 ? 's' : ''} • ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
          </h3>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Re-run readiness check"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, color: tone.sub,
            background: 'var(--surface-raised)', border: '1px solid var(--line)',
            borderRadius: 6, padding: '4px 10px', cursor: loading ? 'wait' : 'pointer',
          }}
        >
          <RefreshCw size={11} style={loading ? { animation: 'spin 0.9s linear infinite' } : {}} />
          Re-check
        </button>
      </div>

      {!ready && (
        <p style={{ fontSize: 12, color: 'var(--content-muted)', fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>
          Fix all blocking issues before submitting. Warnings are advisory — they won&apos;t prevent submission but FBR may flag the return for review.
        </p>
      )}

      {issues.map((i, idx) => renderIssue(i, 'error', idx))}
      {warnings.map((w, idx) => renderIssue(w, 'warning', idx))}

      {ready && (
        <p style={{ fontSize: 13, color: tone.accent, fontWeight: 600 }}>
          Every pre-submit check passed. Click "Submit Return" on the Tax Forms page when ready.
        </p>
      )}
    </div>
  );
};

export default ReadinessChecklist;
