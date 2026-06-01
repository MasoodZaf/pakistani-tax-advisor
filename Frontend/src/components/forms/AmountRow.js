import React from 'react';
import { formatPKR } from './formatCurrency';

/**
 * Read-only computation row (label + amount). `variant` carries the ONLY colour
 * meaning in the form — this is the semantic-colour rule from the audit:
 *   line / calculated  → neutral
 *   subtotal / total   → navy emphasis band
 *   payable            → red   (amount owed to FBR)
 *   refund             → green (amount due back)
 * `signAware` derives payable/refund from the amount's sign (>=0 payable, <0 refund)
 * and shows the magnitude, so meaning never depends on colour alone.
 */
const ROW = {
  line:       { wrap: '',                                                              label: 'text-slate-700',      amount: 'text-navy' },
  calculated: { wrap: '',                                                              label: 'text-slate-500',      amount: 'text-slate-500' },
  subtotal:   { wrap: 'rounded-brand border-l-[3px] border-navy bg-navy/[0.04]',       label: 'font-semibold text-navy',  amount: 'font-semibold text-navy' },
  total:      { wrap: 'rounded-brand border-l-[3px] border-navy bg-navy/[0.08]',       label: 'font-bold text-navy',      amount: 'font-bold text-navy text-base' },
  payable:    { wrap: 'rounded-brand border-l-[3px] border-red-500 bg-red-500/[0.06]', label: 'font-bold text-red-700',   amount: 'font-bold text-red-600 text-base' },
  refund:     { wrap: 'rounded-brand border-l-[3px] border-green-600 bg-green-600/[0.06]', label: 'font-bold text-green-800', amount: 'font-bold text-green-700 text-base' },
};

export default function AmountRow({
  label, sublabel, amount = 0, variant = 'line', signAware = false, trace, className = '',
}) {
  const v = signAware ? (Number(amount) < 0 ? 'refund' : 'payable') : variant;
  const styles = ROW[v] || ROW.line;
  const display = signAware ? formatPKR(Math.abs(Number(amount))) : formatPKR(amount);

  return (
    <div
      className={`grid grid-cols-1 gap-0.5 px-3 py-2.5 md:grid-cols-[1fr_200px] md:items-baseline md:gap-4 ${styles.wrap} ${className}`}
    >
      <div className="min-w-0">
        <div className={`font-body text-sm ${styles.label}`}>{label}</div>
        {sublabel && <div className="font-body text-xs text-slate-400">{sublabel}</div>}
      </div>
      <div className="flex items-baseline gap-2 md:justify-end">
        <span className={`font-mono text-sm tabular-nums ${styles.amount}`}>{display}</span>
        {trace}
      </div>
    </div>
  );
}

// Convenience alias for derived / mirrored rows (muted treatment).
export const CalculatedRow = (props) => <AmountRow variant="calculated" {...props} />;
