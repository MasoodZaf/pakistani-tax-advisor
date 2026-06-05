import React from 'react';

/**
 * Page shell for a tax form — one consistent navy/lime chrome across all 11 forms.
 * Replaces the per-form copy-pasted header card + container + footer wrappers.
 *
 * Props:
 *  - title, subtitle, icon (lucide component), taxYear
 *  - help        : optional node rendered in a cream help strip under the header
 *  - headerActions: optional nodes (Print/Export/Info) in the header right cluster
 *  - footer      : usually <FormNav />
 */
export default function TaxFormShell({
  title, subtitle, icon: Icon, taxYear, help, headerActions, children, footer, className = '',
}) {
  return (
    <div className={`mx-auto w-full max-w-5xl p-4 sm:p-6 ${className}`}>
      <div className="overflow-hidden rounded-brand-lg border border-slate-200 bg-white shadow-brand dark:border-[#2a3450] dark:bg-[#151c30]">
        {/* Navy header bar */}
        <div className="flex flex-col gap-3 bg-navy px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-brand bg-white/10 text-lime">
                <Icon size={20} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold leading-tight tracking-tight text-white sm:text-xl">
                {title}
              </h1>
              {subtitle && <p className="font-body text-sm text-white/70">{subtitle}</p>}
            </div>
          </div>
          {(taxYear || headerActions) && (
            <div className="flex flex-wrap items-center gap-2">
              {taxYear && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 font-body text-xs font-bold text-lime ring-1 ring-lime/30">
                  TY {taxYear}
                </span>
              )}
              {headerActions}
            </div>
          )}
        </div>

        {help && <div className="border-b border-slate-100 bg-cream-bg px-5 py-3 dark:border-[#2a3450] dark:bg-[#1a2238]">{help}</div>}

        <div className="space-y-4 px-3 py-4 sm:px-5">{children}</div>

        {footer && <div className="border-t border-slate-100 px-5 py-4 dark:border-[#2a3450]">{footer}</div>}
      </div>
    </div>
  );
}
