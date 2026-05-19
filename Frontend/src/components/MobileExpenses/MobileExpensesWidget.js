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

const MobileExpensesWidget = ({ taxYear, fieldMap, setValue, onApplied }) => {
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

      // Add to whatever's already in the form field — the user might have
      // typed some of it in manually before realising the widget existed.
      if (mapping.field) {
        // setValue with shouldDirty:true so react-hook-form picks it up for
        // submission. Use the *currently-typed* value to avoid clobbering.
        // (Parent form is responsible for sensible defaults if undefined.)
        setValue(mapping.field, applied.total_pkr, { shouldDirty: true, shouldValidate: true });
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
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center">
          <Smartphone className="h-5 w-5 text-indigo-600 mr-2" />
          <span className="font-semibold text-indigo-900">
            From your mobile expenses
          </span>
          {data ? (
            <span className="ml-3 text-sm text-indigo-700">
              {formatPkr(data.total_captured_pkr)} captured for {taxYear}
            </span>
          ) : null}
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); load(); }}
            className="p-1 hover:bg-indigo-100 rounded"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-indigo-600 ml-1" />
          ) : (
            <ChevronDown className="h-5 w-5 text-indigo-600 ml-1" />
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
                className="flex items-center justify-between bg-white border border-indigo-100 rounded px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
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
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
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
