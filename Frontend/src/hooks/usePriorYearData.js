import { useCallback } from 'react';

/**
 * usePriorYearData — DEPRECATED shim.
 *
 * Phase C replaced the in-form sessionStorage prefill flow with a proper
 * archive model at /tax-history. Prior-year data is now read-only; to pull
 * values into the current year, the user opens the archive and uses
 * "Copy Forward", which stages values into TaxFormContext explicitly.
 *
 * This shim keeps the hook's call sites compiling (9 forms consume it) but
 * never surfaces a prefill banner. It also aggressively purges any stale
 * sessionStorage keys left over from the old flow.
 */
export function usePriorYearData(_stepKey, _setValue) {
  // Best-effort cleanup of the old sessionStorage keys. Runs on every render
  // until they're gone.
  try {
    if (
      sessionStorage.getItem('priorYearData') !== null ||
      sessionStorage.getItem('priorYearWarnings') !== null ||
      sessionStorage.getItem('priorYearDismissed') !== null
    ) {
      sessionStorage.removeItem('priorYearData');
      sessionStorage.removeItem('priorYearWarnings');
      sessionStorage.removeItem('priorYearDismissed');
    }
  } catch {
    /* ignore */
  }

  const noop = useCallback(() => {}, []);

  return {
    priorData: null,
    rateFlags: {},
    applied: false,
    hasPriorData: false,
    applyPriorYear: noop,
    dismissPriorYear: noop,
    clearAllPriorYear: noop,
    isFlagged: () => false,
  };
}
