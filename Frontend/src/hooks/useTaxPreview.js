import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

/**
 * useTaxPreview(taxYear, inputs, { debounceMs })
 *
 * Debounced backend-driven tax preview. Whenever `inputs` changes, schedule a
 * call to POST /api/tax-computation/:taxYear/preview after `debounceMs` ms of
 * inactivity. The backend owns the math — frontend just submits and renders.
 *
 * `inputs` shape: { income, adjustable_tax, capital_gain, reductions,
 *                    credits, deductions, final_min_income, final_tax }
 * Each sub-object is a flat map of DB column name -> value.
 *
 * Returns: { preview, loading, error }.
 */
export function useTaxPreview(taxYear, inputs, { debounceMs = 500 } = {}) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!taxYear) return undefined;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      axios
        .post(
          `/api/tax-computation/${encodeURIComponent(taxYear)}/preview`,
          { inputs: inputs || {} },
          { signal: controller.signal }
        )
        .then((res) => {
          setPreview(res?.data?.data || null);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
          setError(err?.response?.data?.message || err?.message || 'Preview failed');
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [taxYear, JSON.stringify(inputs), debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return { preview, loading, error };
}
