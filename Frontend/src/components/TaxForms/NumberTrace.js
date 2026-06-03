import React, { useState, useRef, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * NumberTrace — wraps a headline computation number with a click-to-expand
 * breakdown of the formula that produced it.
 *
 * Why: every number on the Tax Computation page is the output of a formula
 * spanning several forms. Users (and consultants reviewing the work) ask
 * "where did 21,560,000 come from?" — this answers that without forcing
 * them to hunt across forms.
 *
 * Props:
 *   - value:      the displayed number
 *   - trace:      [{ label, value, op? }] — components feeding into `value`.
 *                 `op` is the operator displayed next to that component
 *                 ('+' default, '-' for subtractions, '×' for multiplications).
 *                 Operator on first row is suppressed.
 *   - formula:    optional one-line formula caption shown above the table
 *                 (e.g. "Salary + Other Sources + Capital Gains")
 *   - resultLabel:optional override for the row showing `value` (default:
 *                 "Result")
 *
 * Visual: the number renders inline with a small calculator icon button.
 * Clicking the icon (or the number) toggles a popover anchored to it.
 */
const NumberTrace = ({
  value,
  trace = [],
  formula,
  resultLabel = 'Result',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Move focus into the breakdown popover while it's open, close on Escape, and
  // return focus to the calculator trigger on close. Ref attaches to the
  // role="dialog" element below.
  const dialogRef = useFocusTrap(open, { onEscape: () => setOpen(false) });

  // Close on outside click. (Escape is handled by the focus trap above.)
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const visibleTrace = trace.filter(
    (r) => r && (r.value !== undefined && r.value !== null && r.value !== '')
  );
  const hasTrace = visibleTrace.length > 0;

  return (
    <span ref={ref} className={`relative inline-flex items-center gap-1.5 ${className}`}>
      <span className="font-mono">{formatCurrency(value)}</span>
      {hasTrace && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          aria-label="Show calculation breakdown"
          title="Show calculation"
          className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-navy/20 bg-navy/5 text-navy hover:bg-navy/10 transition-colors"
        >
          <Calculator size={11} strokeWidth={2.4} />
        </button>
      )}

      {open && hasTrace && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Calculation breakdown"
          className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-xl outline-none"
          style={{ minWidth: 320, maxWidth: 420 }}
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              How this was calculated
            </p>
            {formula && (
              <p className="text-sm text-gray-800 mt-1 font-mono">{formula}</p>
            )}
          </div>
          <div className="overflow-x-auto px-4 py-3">
            <table className="w-full text-sm">
              <tbody>
                {visibleTrace.map((row, i) => {
                  const op = i === 0 ? '' : (row.op || '+');
                  return (
                    <tr key={`${row.label}-${i}`} className="text-gray-700">
                      <td className="text-gray-400 font-mono pr-2 align-top w-3 text-right">
                        {op}
                      </td>
                      <td className="py-1 align-top">
                        <div>{row.label}</div>
                        {row.note && (
                          <div className="text-xs text-gray-500 mt-0.5">{row.note}</div>
                        )}
                      </td>
                      <td className="text-right font-mono py-1 align-top text-gray-900 whitespace-nowrap pl-3">
                        {formatCurrency(row.value)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-gray-200 font-semibold">
                  <td />
                  <td className="py-2 text-navy">{resultLabel}</td>
                  <td className="text-right font-mono py-2 text-navy whitespace-nowrap pl-3">
                    {formatCurrency(value)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </span>
  );
};

export default NumberTrace;
