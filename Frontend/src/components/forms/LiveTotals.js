import React, { createContext, useContext, useMemo } from 'react';
import { useWatch } from 'react-hook-form';

/**
 * PERF-02 — react-hook-form re-render isolation.
 *
 * A bare `const watchedValues = watch()` in a form subscribes the whole form
 * component to EVERY field change, so the entire (often 400–1400-line) form
 * re-renders on each keystroke — defeating RHF's uncontrolled-input design and
 * causing input lag on the longest forms.
 *
 * Wrap the form body in:
 *
 *   <LiveTotalsProvider control={control} compute={calculateTotals}>
 *     …inputs (register-based) + <LiveAmount component={…} field="…" />…
 *   </LiveTotalsProvider>
 *
 * The provider is the ONLY thing subscribed (via useWatch), so it — and the
 * <LiveAmount> context consumers — are all that re-render per keystroke. The
 * form body is passed as a *stable* `children` prop: once the parent form no
 * longer calls watch() itself it stops re-rendering on keystroke, so React
 * bails out of reconciling the register()-based input rows entirely.
 *
 * `compute` MUST be the form's existing pure totals function — the arithmetic
 * is unchanged; only WHERE it runs moves here.
 */
const TotalsContext = createContext({});

export function LiveTotalsProvider({ control, compute, children }) {
  const values = useWatch({ control });
  const totals = useMemo(() => compute(values || {}), [values, compute]);
  return <TotalsContext.Provider value={totals}>{children}</TotalsContext.Provider>;
}

export function useLiveTotals() {
  return useContext(TotalsContext);
}

/**
 * Renders `component` (e.g. AmountRow / CalculatedRow) with its `amount` pulled
 * reactively from the nearest LiveTotalsProvider's computed totals[field].
 * Everything else (label, variant, help, …) passes straight through.
 */
export function LiveAmount({ component: Component, field, ...rest }) {
  const totals = useLiveTotals();
  return <Component amount={totals?.[field] ?? 0} {...rest} />;
}
