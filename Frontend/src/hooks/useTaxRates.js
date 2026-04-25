import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * useTaxRates(taxYear)
 *
 * Loads the DB-sourced rate set for a tax year once, caches per-year in module
 * memory (so every component that needs slab/surcharge values reads from the
 * same source). No hardcoded rate constants — if the backend says rates are
 * missing, the component should render a config-error state.
 *
 * Shape (matches TaxRateService.getAllRates):
 *   { taxYear, slabs, surcharge, superTax, creditCaps, deductionThresholds,
 *     reductions, finalTax, withholding, capitalGains }
 */

const cache = new Map();
const inFlight = new Map();

async function fetchRates(taxYear) {
  if (cache.has(taxYear)) return cache.get(taxYear);
  if (inFlight.has(taxYear)) return inFlight.get(taxYear);

  const promise = axios
    .get(`/api/tax-computation/${encodeURIComponent(taxYear)}/rates`)
    .then((res) => {
      const data = res?.data?.data;
      cache.set(taxYear, data);
      inFlight.delete(taxYear);
      return data;
    })
    .catch((err) => {
      inFlight.delete(taxYear);
      throw err;
    });

  inFlight.set(taxYear, promise);
  return promise;
}

export function useTaxRates(taxYear) {
  const [rates, setRates] = useState(() => (taxYear ? cache.get(taxYear) || null : null));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!rates);

  useEffect(() => {
    if (!taxYear) {
      setRates(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(!cache.has(taxYear));
    fetchRates(taxYear)
      .then((data) => {
        if (!cancelled) {
          setRates(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.response?.data?.message || err?.message || 'Failed to load tax rates';
          setError(msg);
          setRates(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [taxYear]);

  return { rates, loading, error };
}

/** Clear the module-level cache — use when rates are edited via admin UI. */
export function invalidateTaxRatesCache(taxYear) {
  if (taxYear) cache.delete(taxYear);
  else cache.clear();
}
