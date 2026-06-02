import React from 'react';

/**
 * One data-entry row: label + currency input.
 *  - Stacks label-above-input below `md`; two-column at `md`+ (fixes UX-04).
 *  - Wires id/htmlFor (A11Y-01) and aria-invalid / aria-describedby + role=alert
 *    error announcement (A11Y-02).
 *  - One canonical input treatment (navy focus ring; red on error).
 *
 * Presentational: pass react-hook-form's `register(name)` output (or a manual
 * value/onChange) through `inputProps`. `help` takes a node (e.g. <HelpHint/>).
 */
export default function TaxFormRow({
  name, label, sublabel, help, hint, error,
  prefix = 'Rs', placeholder = '0', readOnly = false,
  inputMode = 'numeric', inputProps = {}, className = '',
}) {
  const errorId = error ? `${name}-error` : null;
  const hintId = hint ? `${name}-hint` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`grid grid-cols-1 gap-1.5 py-2.5 md:grid-cols-[1fr_220px] md:items-center md:gap-4 ${className}`}>
      <div className="flex items-start gap-1.5">
        <div className="min-w-0">
          <label htmlFor={name} className="font-body text-sm leading-snug text-slate-700">
            {label}
          </label>
          {sublabel && <p className="font-body text-xs text-slate-400">{sublabel}</p>}
        </div>
        {help}
      </div>

      <div className="md:w-[220px] md:justify-self-end">
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400">
              {prefix}
            </span>
          )}
          <input
            id={name}
            inputMode={inputMode}
            placeholder={placeholder}
            readOnly={readOnly}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={[
              'w-full rounded-brand border-[1.5px] bg-white py-2 pr-3 text-right font-body text-sm font-semibold tabular-nums text-navy',
              prefix ? 'pl-10' : 'pl-3',
              'transition-colors placeholder:font-normal placeholder:text-slate-300 focus:outline-none focus:ring-4',
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
                : 'border-slate-300 focus:border-navy focus:ring-navy/15',
              readOnly ? 'cursor-default bg-slate-50 text-slate-500' : '',
            ].join(' ')}
            {...inputProps}
          />
        </div>
        {hint && !error && (
          <p id={hintId} className="mt-1 text-right font-body text-xs text-slate-400">{hint}</p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-right font-body text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
