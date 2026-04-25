import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  Home,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import capitalGainsHelp from '../../../help/capitalGainsHelp';

// Capital-gain category definitions. Rates are NOT in this array any more —
// they come from tax_rates_config via useTaxRates() (rate_type='capital_gains',
// rate_category matches item.id). Each item's field-name set still lives here
// because those are DB column names the form maps onto capital_gain_forms.
const capitalGainItems = [
  // Immovable Property u/s 37(1A) — pre-1-Jul-2024 acquisition, graduated by holding period.
  { id: 'immovable_property_1_year',              description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period ≤ 1 year',            taxableAmount: 'immovable_property_1_year_taxable',              taxField: 'immovable_property_1_year_cgt',              taxDeducted: 'immovable_property_1_year_deducted',              taxCarryable: 'immovable_property_1_year_carryable' },
  { id: 'immovable_property_2_years',             description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period > 1 year, ≤ 2 years', taxableAmount: 'immovable_property_2_years_taxable',             taxField: 'immovable_property_2_years_cgt',             taxDeducted: 'immovable_property_2_years_deducted',             taxCarryable: 'immovable_property_2_years_carryable' },
  { id: 'immovable_property_3_years',             description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period > 2 years, ≤ 3 years', taxableAmount: 'immovable_property_3_years_taxable',             taxField: 'immovable_property_3_years_cgt',             taxDeducted: 'immovable_property_3_years_deducted',             taxCarryable: 'immovable_property_3_years_carryable' },
  { id: 'immovable_property_4_years',             description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period > 3 years, ≤ 4 years', taxableAmount: 'immovable_property_4_years_taxable',             taxField: 'immovable_property_4_years_cgt',             taxDeducted: 'immovable_property_4_years_deducted',             taxCarryable: 'immovable_property_4_years_carryable' },
  { id: 'immovable_property_5_years',             description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period > 4 years, ≤ 5 years', taxableAmount: 'immovable_property_5_years_taxable',             taxField: 'immovable_property_5_years_cgt',             taxDeducted: 'immovable_property_5_years_deducted',             taxCarryable: 'immovable_property_5_years_carryable' },
  { id: 'immovable_property_6_years',             description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period > 5 years, ≤ 6 years', taxableAmount: 'immovable_property_6_years_taxable',             taxField: 'immovable_property_6_years_cgt',             taxDeducted: 'immovable_property_6_years_deducted',             taxCarryable: 'immovable_property_6_years_carryable' },
  { id: 'immovable_property_over_6_years',        description: 'Capital Gains on Immovable Property u/s 37(1A) — holding period > 6 years',            taxableAmount: 'immovable_property_over_6_years_taxable',        taxField: 'immovable_property_over_6_years_cgt',        taxDeducted: 'immovable_property_over_6_years_deducted',        taxCarryable: 'immovable_property_over_6_years_carryable' },
  // Securities u/s 37A.
  { id: 'securities_before_july_2013',            description: 'Capital Gain on Securities u/s 37A — acquired before 1-Jul-2013',                     taxableAmount: 'securities_before_july_2013_taxable',            taxField: 'securities_before_july_2013_cgt',            taxDeducted: 'securities_before_july_2013_deducted',            taxCarryable: 'securities_before_july_2013_carryable' },
  { id: 'securities_pmex_settled',                description: 'Capital Gain on Securities u/s 37A — PMEX / Cash Settled Securities',                  taxableAmount: 'securities_pmex_settled_taxable',                taxField: 'securities_pmex_settled_cgt',                taxDeducted: 'securities_pmex_settled_deducted',                taxCarryable: 'securities_pmex_settled_carryable' },
  { id: 'securities_37a_7_5_percent',             description: 'Capital Gain on Securities u/s 37A',                                                   taxableAmount: 'securities_37a_7_5_percent_taxable',             taxField: 'securities_37a_7_5_percent_cgt',             taxDeducted: 'securities_37a_7_5_percent_deducted',             taxCarryable: 'securities_37a_7_5_percent_carryable' },
  { id: 'securities_mutual_funds_10_percent',     description: 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT u/s 37A',         taxableAmount: 'securities_mutual_funds_10_percent_taxable',     taxField: 'securities_mutual_funds_10_percent_cgt',     taxDeducted: 'securities_mutual_funds_10_percent_deducted',     taxCarryable: 'securities_mutual_funds_10_percent_carryable' },
  { id: 'securities_mutual_funds_12_5_percent',   description: 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT (stock funds)',   taxableAmount: 'securities_mutual_funds_12_5_percent_taxable',   taxField: 'securities_mutual_funds_12_5_percent_cgt',   taxDeducted: 'securities_mutual_funds_12_5_percent_deducted',   taxCarryable: 'securities_mutual_funds_12_5_percent_carryable' },
  { id: 'securities_other_25_percent',            description: 'Capital Gain on Securities / Mutual Funds / REIT (other than stock funds)',             taxableAmount: 'securities_other_25_percent_taxable',            taxField: 'securities_other_25_percent_cgt',            taxDeducted: 'securities_other_25_percent_deducted',            taxCarryable: 'securities_other_25_percent_carryable' },
  { id: 'securities_12_5_percent_before_july_2022', description: 'Capital Gain on Securities u/s 37A — acquired before 1-Jul-2022 (any holding period)', taxableAmount: 'securities_12_5_percent_before_july_2022_taxable', taxField: 'securities_12_5_percent_before_july_2022_cgt', taxDeducted: 'securities_12_5_percent_before_july_2022_deducted', taxCarryable: 'securities_12_5_percent_before_july_2022_carryable' },
  { id: 'securities_15_percent',                  description: 'Capital Gain on Securities u/s 37A',                                                   taxableAmount: 'securities_15_percent_taxable',                  taxField: 'securities_15_percent_cgt',                  taxDeducted: 'securities_15_percent_deducted',                  taxCarryable: 'securities_15_percent_carryable' },
];

const CapitalGainsForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving
  } = useTaxForm();
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  // Resolve a CGT rate for an item.id via DB. Returns null until rates load so
  // auto-calc effects can early-return instead of multiplying by undefined.
  const cgtRate = (id) => rates?.capitalGains?.[id]?.rate ?? null;

  const [showHelp, setShowHelp] = useState(false);
  const isLoadingFromDB = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('capital_gain')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back)
  useEffect(() => {
    const savedData = contextFormData['capital_gain'];
    if (savedData && Object.keys(savedData).length > 0) {
      isLoadingFromDB.current = true;
      reset(savedData);
      setTimeout(() => { isLoadingFromDB.current = false; }, 50);
    }
  }, [contextFormData, reset]);

  const watchedValues = watch();

  // Prior year pre-fill
  const { hasPriorData: hasPriorCG, applyPriorYear: applyPriorCG, dismissPriorYear: dismissPriorCG } = usePriorYearData('capital_gain', setValue);

  // Auto-calculate CGT for each item: gain × DB-sourced rate.
  // Gated on `rates` — skip until tax_rates_config rows are available.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    if (!rates?.capitalGains) return;
    capitalGainItems.forEach(item => {
      const rate = cgtRate(item.id);
      if (rate === null) return; // missing seed — leave the field alone
      if (rate === 0) {
        setValue(item.taxField, 0);
        return;
      }
      const gain = parseFloat(watchedValues[item.taxableAmount]) || 0;
      const calculated = gain > 0 ? Math.round(gain * rate) : 0;
      const current = parseFloat(watchedValues[item.taxField]) || 0;
      if (Math.abs(current - calculated) > 0.01) {
        setValue(item.taxField, calculated);
      }
    });
  }, [
    // Watch all taxable amount fields and re-fire when DB rates arrive.
    ...capitalGainItems.map(i => watchedValues[i.taxableAmount]),
    rates,
    setValue,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute totals
  const totals = capitalGainItems.reduce((acc, item) => {
    acc.taxable    += parseFloat(watchedValues[item.taxableAmount]) || 0;
    acc.cgt        += parseFloat(watchedValues[item.taxField])      || 0;
    acc.taxDeducted+= parseFloat(watchedValues[item.taxDeducted])   || 0;
    acc.taxCarryable+=parseFloat(watchedValues[item.taxCarryable])  || 0;
    return acc;
  }, { taxable: 0, cgt: 0, taxDeducted: 0, taxCarryable: 0 });

  // Fields computed client-side (rate × gain) that have no matching DB column —
  // strip before save to avoid PostgreSQL "column does not exist" errors.
  const CGT_EPHEMERAL = new Set(capitalGainItems.map(i => i.taxField));

  const buildFormData = (data) => {
    // Remove ephemeral *_cgt fields from the form state
    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([k]) => !CGT_EPHEMERAL.has(k))
    );
    return {
      ...sanitized,
      // total_capital_gain — writable column (DB also has computed DEFAULT from *_taxable)
      total_capital_gain:           totals.taxable,
      // capital_gains_tax_chargeable — net CGT after WHT offset; correct DB column name
      capital_gains_tax_chargeable: Math.max(0, totals.cgt - totals.taxDeducted),
      // NOTE: total_capital_gain_tax (gross CGT) is intentionally excluded here.
      // It requires migration add-capital-gain-tax-column.sql. Until that runs,
      // TaxComputationSummary reconstructs gross CGT from capital_gains_tax_chargeable
      // + total_tax_deducted. Run the migration to persist gross CGT properly.
      // total_tax_deducted and total_tax_carryable are DB-computed from *_deducted/*_carryable.
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('capital_gain', buildFormData(data), true);
    if (success) {
      toast.success('Capital gains information saved successfully');
      navigate('/income-tax/expenses');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('capital_gain', buildFormData(watchedValues), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/expenses');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  // Group for display
  const propertyItems  = capitalGainItems.filter(i => i.id.startsWith('immovable_property'));
  const securitiesItems= capitalGainItems.filter(i => i.id.startsWith('securities'));

  const renderGroup = (title, items, color) => {
    const borderClass = color === 'orange' ? 'border-orange-200' : 'border-blue-200';
    const headerClass = color === 'orange'
      ? 'bg-orange-100 text-orange-800 border-orange-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';
    const rowBorderClass = color === 'orange' ? 'border-orange-100' : 'border-blue-100';

    return (
      <div className={`border ${borderClass} rounded-lg overflow-hidden`}>
        <div className={`px-4 py-2 font-semibold text-sm border-b ${headerClass}`}>{title}</div>
        {items.map(item => {
          const gain = parseFloat(watchedValues[item.taxableAmount]) || 0;
          const cgt  = parseFloat(watchedValues[item.taxField])      || 0;
          return (
            <div key={item.id} className={`grid grid-cols-12 gap-2 items-center py-3 px-4 border-b ${rowBorderClass} last:border-b-0 bg-white hover:bg-gray-50`}>
              <div className="col-span-4">
                <p className="text-sm font-medium text-gray-700">
                  {item.description}
                  <HelpHint fieldId={item.id} source={capitalGainsHelp} />
                </p>
              </div>
              <div className="col-span-1 text-center">
                {(() => {
                  const r = cgtRate(item.id);
                  if (r === null) return <span className="text-xs text-gray-400">…</span>;
                  if (r === 0) return <span className="text-xs text-gray-400">NIL</span>;
                  return <span className="text-sm font-semibold text-teal-700">{(r * 100).toFixed(1)}%</span>;
                })()}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...register(item.taxableAmount, { valueAsNumber: true, min: 0 })}
                  className={inputClasses}
                  placeholder="0"
                />
                {errors[item.taxableAmount] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.taxableAmount].message}</p>
                )}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...register(item.taxField, { valueAsNumber: true, min: 0 })}
                  className={`${inputClasses} bg-teal-50 border-teal-200`}
                  placeholder="0"
                  readOnly
                  title="Auto-calculated — read-only"
                />
                {(() => {
                  const r = cgtRate(item.id);
                  return gain > 0 && r !== null && r > 0 && (
                    <p className="mt-0.5 text-xs text-teal-600">Auto @ {(r * 100).toFixed(1)}%</p>
                  );
                })()}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...register(item.taxDeducted, { valueAsNumber: true, min: 0 })}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  step="1"
                  min="0"
                  {...register(item.taxCarryable, { valueAsNumber: true, min: 0 })}
                  className={inputClasses}
                  placeholder="0"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Home className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Capital Gain</h1>
              <p className="text-gray-600">Enter capital gains from property and securities — rates per Finance Act 2025</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {showHelp && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Capital Gains Tax Help — Finance Act 2025</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Immovable Property u/s 37(1A)</strong>: Rates 15% → 2.5% depending on holding period; exempt after 6 years</li>
              <li>• <strong>Securities u/s 37A</strong>: Rates from 5% to 25% depending on type and acquisition date</li>
              <li>• CGT is <strong>auto-calculated</strong> from gain amount × rate (teal fields)</li>
              <li>• <strong>Tax Deducted</strong>: Enter advance tax already deducted (e.g., u/s 236C on property)</li>
              <li>• <strong>Tax Carryable</strong>: Net CGT that carries to computation summary</li>
            </ul>
          </div>
        )}
      </div>

      {hasPriorCG && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm text-indigo-800">Prior year capital gains data available — apply to pre-fill? CGT rates will be recalculated at Finance Act 2025 rates.</span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={dismissPriorCG} className="text-xs px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100">Dismiss</button>
            <button type="button" onClick={applyPriorCG} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">Apply Prior Year Data</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Column Headers */}
        <div className="bg-teal-600 text-white rounded-lg">
          <div className="grid grid-cols-12 gap-2 items-center py-3 px-4 font-semibold text-sm">
            <div className="col-span-4">Description</div>
            <div className="col-span-1 text-center">Rate</div>
            <div className="col-span-2 text-center">Gain Amount (Rs)</div>
            <div className="col-span-2 text-center">CGT (Auto)</div>
            <div className="col-span-2 text-center">Tax Deducted (Rs)</div>
            <div className="col-span-1 text-center">Carryable</div>
          </div>
        </div>

        {renderGroup('Immovable Property — u/s 37(1A) Finance Act 2025', propertyItems, 'orange')}
        {renderGroup('Securities & Mutual Funds — u/s 37A Finance Act 2025', securitiesItems, 'blue')}

        {/* Totals */}
        <div className="grid grid-cols-12 gap-2 items-center py-4 px-4 bg-teal-100 border-2 border-teal-300 rounded-lg font-bold">
          <div className="col-span-4 text-teal-900">Total Capital Gain</div>
          <div className="col-span-1"></div>
          <div className="col-span-2 text-right text-teal-900">{formatCurrency(totals.taxable)}</div>
          <div className="col-span-2 text-right text-teal-900">{formatCurrency(totals.cgt)}</div>
          <div className="col-span-2 text-right text-teal-900">{formatCurrency(totals.taxDeducted)}</div>
          <div className="col-span-1 text-right text-teal-900">{formatCurrency(totals.taxCarryable)}</div>
        </div>

        {/* Net CGT payable banner */}
        {totals.cgt > 0 && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              Gross CGT: <strong>{formatCurrency(totals.cgt)}</strong> — Tax Deducted: <strong>{formatCurrency(totals.taxDeducted)}</strong> — Net CGT Payable: <strong>{formatCurrency(Math.max(0, totals.cgt - totals.taxDeducted))}</strong>
            </span>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/income-tax/final-tax')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Final Tax
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving}
              className="flex items-center px-6 py-3 text-primary-600 bg-primary-100 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Complete & Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CapitalGainsForm;
