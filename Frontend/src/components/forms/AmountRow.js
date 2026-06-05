import React from 'react';
import { formatCurrency } from '../../utils/currency';

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
  line:       { wrap: '',                                                              label: 'text-slate-700 dark:text-[#aab2cc]', amount: 'text-navy dark:text-[#e7eaf3]' },
  calculated: { wrap: '',                                                              label: 'text-slate-500 dark:text-[#7e88a6]', amount: 'text-slate-500 dark:text-[#7e88a6]' },
  subtotal:   { wrap: 'rounded-brand border-l-[3px] border-navy bg-navy/[0.04] dark:border-navy-mid dark:bg-navy-mid/[0.18]',       label: 'font-semibold text-navy dark:text-[#dfe5f5]',  amount: 'font-semibold text-navy dark:text-[#dfe5f5]' },
  total:      { wrap: 'rounded-brand border-l-[3px] border-navy bg-navy/[0.08] dark:border-navy-mid dark:bg-navy-mid/[0.28]',       label: 'font-bold text-navy dark:text-[#e7eaf3]',      amount: 'font-bold text-navy dark:text-[#e7eaf3] text-base' },
  payable:    { wrap: 'rounded-brand border-l-[3px] border-red-500 bg-red-500/[0.06] dark:bg-red-500/[0.14]', label: 'font-bold text-red-700 dark:text-red-300',   amount: 'font-bold text-red-600 dark:text-red-400 text-base' },
  refund:     { wrap: 'rounded-brand border-l-[3px] border-green-600 bg-green-600/[0.06] dark:bg-green-500/[0.14]', label: 'font-bold text-green-800 dark:text-green-300', amount: 'font-bold text-green-700 dark:text-green-400 text-base' },
};

export default function AmountRow({
  label, sublabel, amount = 0, amountNode, variant = 'line', signAware = false, trace, help, className = '',
}) {
  const v = signAware ? (Number(amount) < 0 ? 'refund' : 'payable') : variant;
  const styles = ROW[v] || ROW.line;
  // `amountNode` lets a caller render the value themselves (e.g. <NumberTrace/>),
  // inheriting the variant's semantic colour; otherwise we format `amount`.
  const display = signAware ? formatCurrency(Math.abs(Number(amount))) : formatCurrency(amount);

  return (
    <div
      className={`grid grid-cols-1 gap-0.5 px-3 py-2.5 md:grid-cols-[1fr_200px] md:items-baseline md:gap-4 ${styles.wrap} ${className}`}
    >
      <div className="min-w-0">
        <div className="flex items-start gap-1.5">
          <div className={`font-body text-sm ${styles.label}`}>{label}</div>
          {help}
        </div>
        {sublabel && <div className="font-body text-xs text-slate-400 dark:text-[#7e88a6]">{sublabel}</div>}
      </div>
      <div className="flex items-baseline gap-2 md:justify-end">
        <span className={`font-mono text-sm tabular-nums ${styles.amount}`}>
          {amountNode != null ? amountNode : display}
        </span>
        {trace}
      </div>
    </div>
  );
}

// Convenience alias for derived / mirrored rows (muted treatment).
export const CalculatedRow = (props) => <AmountRow variant="calculated" {...props} />;
