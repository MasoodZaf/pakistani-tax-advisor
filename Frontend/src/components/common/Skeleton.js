import React from 'react';

/**
 * Branded skeleton loaders (UX-08) — replace centered spinners on data-heavy
 * surfaces so the page keeps its shape while loading (less layout shift, lower
 * perceived latency). Dark-mode aware via fixed token-matched shades; the global
 * `prefers-reduced-motion` rule (index.css) already neutralises the pulse.
 *
 *   <Skeleton className="h-4 w-32" />     → one pulsing block
 *   <SkeletonText lines={3} />            → stacked text lines
 *   <SkeletonTable rows={6} cols={5} />   → a table placeholder (header + rows)
 *   <SkeletonCards count={4} />           → a grid of card placeholders
 */

export const Skeleton = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded bg-slate-200 dark:bg-[#222c46] ${className}`}
  />
);

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
    ))}
  </div>
);

/**
 * Table placeholder. `widths` optionally sets per-column flex weights so the
 * skeleton roughly mirrors the real table's column rhythm.
 */
export const SkeletonTable = ({ rows = 6, cols = 5, widths, className = '' }) => {
  const colW = (c) => (widths && widths[c]) || 'flex-1';
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading…"
      className={`overflow-hidden rounded-lg border border-slate-200 dark:border-[#2a3450] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#2a3450] dark:bg-[#0f1426]">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={`h-3 ${colW(c)}`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0 dark:border-[#202a44]"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 ${colW(c)}`} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonCards = ({ count = 4, className = '' }) => (
  <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-lg border border-slate-200 bg-white p-5 dark:border-[#2a3450] dark:bg-[#151c30]"
      >
        <Skeleton className="mb-3 h-3 w-1/2" />
        <Skeleton className="h-7 w-3/4" />
      </div>
    ))}
  </div>
);

export default Skeleton;
