import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Accessible accordion section (fixes audit A11Y-04: the old headers were
 * click-only <div>s). Real <button> header with aria-expanded / aria-controls,
 * a region panel, and keyboard support for free.
 *
 * Uncontrolled by default (defaultOpen); pass `open` + `onToggle` to control.
 */
export default function CollapsibleSection({
  title, subtitle, icon: Icon, defaultOpen = true, open, onToggle, children, className = '',
}) {
  const panelId = `section-${useId()}`;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const expanded = isControlled ? open : internalOpen;
  const toggle = () => (isControlled ? onToggle?.(!expanded) : setInternalOpen((v) => !v));

  return (
    <section className={`overflow-hidden rounded-brand-lg border border-slate-200 bg-white dark:border-[#2a3450] dark:bg-[#151c30] ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#1a2238] focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/20"
      >
        {Icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-brand bg-navy/10 text-navy dark:bg-navy-mid/30 dark:text-lime">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold tracking-tight text-navy dark:text-[#e7eaf3]">{title}</span>
          {subtitle && <span className="block font-body text-xs text-slate-500 dark:text-[#7e88a6]">{subtitle}</span>}
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 text-slate-400 dark:text-[#7e88a6] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={panelId} role="region" hidden={!expanded} className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-[#2a3450] dark:border-[#2a3450] px-4">
        {children}
      </div>
    </section>
  );
}
