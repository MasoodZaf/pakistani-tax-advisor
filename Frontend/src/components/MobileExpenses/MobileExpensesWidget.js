import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Smartphone, ChevronDown, ChevronUp, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// Widget that surfaces mobile-captured expenses on a tax form. Drop it on
// any screen that benefits from "you already logged ₨X this year" prefills.
//
// Props
//   taxYear              — string like '2025-26'
//   fieldMap             — { treatment: { field, yn } } telling the widget
//                          which react-hook-form fields to set for each
//                          treatment. Treatments not in the map are shown
//                          but not auto-applicable.
//   setValue             — the react-hook-form setValue from the parent form
//   getValues            — the react-hook-form getValues from the parent form.
//                          Required for Apply to be additive — without it we
//                          would clobber any value the user typed manually.
//   onApplied (optional) — called after a successful apply with the result

const formatPkr = (n) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const labels = {
  zakat: 'Zakat',
  donation: 'Donations',
  medical: 'Medical',
  advance_tax: 'Advance tax paid',
  business_expense: 'Business expenses',
  asset_purchase: 'Asset purchases',
  personal: 'Personal',
  unmapped: 'Other (uncategorised)',
};

const MobileExpensesWidget = ({ taxYear, fieldMap, setValue, getValues, onApplied }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [appliedKeys, setAppliedKeys] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!taxYear) return;
    setLoading(true);
    try {
      const r = await axios.get('/api/tax-forms/expense-suggestions', {
        params: { taxYear },
      });
      setData(r.data || null);
    } catch (err) {
      // Silent — the widget is non-essential. Show an empty state.
      console.warn('expense-suggestions fetch failed', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => { load(); }, [load]);

  const apply = async (treatment, bucket) => {
    const mapping = fieldMap?.[treatment];
    if (!mapping) {
      toast(`Captured ${formatPkr(bucket.total_pkr)} in ${labels[treatment] || treatment}, but no matching field on this form.`);
      return;
    }
    try {
      const r = await axios.post('/api/tax-forms/expense-suggestions/apply', {
        taxYear,
        expense_ids: bucket.expense_ids,
      });
      const applied = r.data?.by_treatment?.[treatment] || { total_pkr: 0, count: 0 };

      // Apply is ADDITIVE — read whatever the user has already typed and add
      // the captured amount to it. A user might have entered "₨10,000 cash
      // Zakat I don't have receipts for" and now tap Apply to add the
      // receipted mobile-captured amount on top. Without this, the manual
      // figure is silently overwritten and the filing under-reports.
      //
      // If getValues isn't passed, we fall back to a plain setValue and the
      // old (clobbering) behaviour — but log a warning so it's visible.
      if (mapping.field) {
        let nextValue = applied.total_pkr;
        if (typeof getValues === 'function') {
          const current = getValues(mapping.field);
          const currentNum = typeof current === 'number'
            ? current
            : Number(String(current ?? '').replace(/,/g, '')) || 0;
          if (Number.isFinite(currentNum) && currentNum > 0) {
            nextValue = currentNum + applied.total_pkr;
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn('[MobileExpensesWidget] getValues not provided; Apply may clobber manual entry');
        }
        setValue(mapping.field, nextValue, { shouldDirty: true, shouldValidate: true });
      }
      if (mapping.yn) {
        setValue(mapping.yn, 'Y', { shouldDirty: true });
      }

      setAppliedKeys((prev) => new Set(prev).add(treatment));
      toast.success(`Applied ${formatPkr(applied.total_pkr)} from ${applied.count} mobile expense(s)`);
      if (onApplied) onApplied({ treatment, applied });

      // Refresh so already-applied rows fall out of the list.
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Apply failed');
    }
  };

  const buckets = data
    ? [
        ...Object.entries(data.by_treatment || {}).map(([k, v]) => ({ key: k, ...v })),
        ...(data.unmapped?.count > 0 ? [{ key: 'unmapped', ...data.unmapped }] : []),
      ]
    : [];

  if (!data && !loading) return null;
  if (data && buckets.length === 0 && !loading) return null;

  return (
    <div className="bg-navy/5 border border-navy/15 rounded-brand p-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center">
          <Smartphone className="h-5 w-5 text-navy mr-2" />
          <span className="font-semibold text-navy">
            From your mobile expenses
          </span>
          {data ? (
            <span className="ml-3 text-sm text-navy">
              {formatPkr(data.total_captured_pkr)} captured for {taxYear}
            </span>
          ) : null}
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="p-1 hover:bg-navy/10 rounded"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-navy ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-navy ml-1" />
          ) : (
            <ChevronDown className="h-5 w-5 text-navy ml-1" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {buckets.map((b) => {
            const mappable = !!fieldMap?.[b.key];
            const wasApplied = appliedKeys.has(b.key);
            return (
              <div
                key={b.key}
                className="flex items-center justify-between bg-white border border-navy/15 rounded px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-navy">
                    {labels[b.key] || b.key}
                  </div>
                  <div className="text-xs text-gray-500">
                    {b.count} entr{b.count === 1 ? 'y' : 'ies'} · {formatPkr(b.total_pkr)}
                  </div>
                </div>
                {wasApplied ? (
                  <div className="flex items-center text-green-600 text-sm font-medium">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Applied
                  </div>
                ) : mappable ? (
                  <button
                    type="button"
                    onClick={() => apply(b.key, b)}
                    className="px-3 py-1 bg-lime text-navy rounded text-sm font-medium hover:bg-lime/80"
                  >
                    Apply
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">No matching field</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileExpensesWidget;
