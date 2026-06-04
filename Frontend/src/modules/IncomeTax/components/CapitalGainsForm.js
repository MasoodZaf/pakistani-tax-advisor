import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  TrendingUp,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import capitalGainsHelp from '../../../help/capitalGainsHelp';
import { formatCurrency } from '../../../utils/currency';
import FormEmptyState from './FormEmptyState';
import { TaxFormShell, FormNav, LiveTotalsProvider, LiveWhen, useLiveTotals } from '../../../components/forms';

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

// Pure: sum the four columns across all categories. Same reduce as before.
const computeCgTotals = (values) =>
  capitalGainItems.reduce((acc, item) => {
    acc.taxable      += parseFloat(values[item.taxableAmount]) || 0;
    acc.cgt          += parseFloat(values[item.taxField])      || 0;
    acc.taxDeducted  += parseFloat(values[item.taxDeducted])   || 0;
    acc.taxCarryable += parseFloat(values[item.taxCarryable])  || 0;
    return acc;
  }, { taxable: 0, cgt: 0, taxDeducted: 0, taxCarryable: 0 });

// PERF-02: auto-calc effect runs here (headless). Watches ONLY the taxable
// amount fields; current CGT (for the no-loop guard) is read one-shot via
// getValues. Logic byte-identical to the former in-component effect.
const CapitalGainsAutoCalc = ({ control, getValues, setValue, rates, isLoadingFromDB }) => {
  const taxables = useWatch({ control, name: capitalGainItems.map(i => i.taxableAmount) });
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    if (!rates?.capitalGains) return;
    capitalGainItems.forEach((item, idx) => {
      const rate = rates.capitalGains[item.id]?.rate ?? null;
      if (rate === null) return; // missing seed — leave the field alone
      if (rate === 0) { setValue(item.taxField, 0); return; }
      const gain = parseFloat(taxables[idx]) || 0;
      const calculated = gain > 0 ? Math.round(gain * rate) : 0;
      const current = parseFloat(getValues(item.taxField)) || 0;
      if (Math.abs(current - calculated) > 0.01) {
        setValue(item.taxField, calculated);
      }
    });
  }, [...taxables, rates, getValues, setValue, isLoadingFromDB]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// Totals band (navy) — context consumer so only it re-renders on change.
const CapitalGainsTotalsBand = () => {
  const totals = useLiveTotals();
  return (
    <div className="rounded-brand-lg bg-navy p-5">
      <h3 className="mb-3 font-body text-xs font-bold uppercase tracking-wider text-white/60">Total capital gain</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-brand bg-white/5 p-3">
          <span className="block font-body text-xs font-medium uppercase tracking-wider text-white/60">Gain amount</span>
          <span className="mt-1 block break-all font-mono text-base font-bold tabular-nums text-white">{formatCurrency(totals.taxable)}</span>
        </div>
        <div className="rounded-brand bg-white/5 p-3">
          <span className="block font-body text-xs font-medium uppercase tracking-wider text-white/60">Gross CGT</span>
          <span className="mt-1 block break-all font-mono text-base font-bold tabular-nums text-white">{formatCurrency(totals.cgt)}</span>
        </div>
        <div className="rounded-brand bg-white/5 p-3">
          <span className="block font-body text-xs font-medium uppercase tracking-wider text-white/60">Tax deducted</span>
          <span className="mt-1 block break-all font-mono text-base font-bold tabular-nums text-white">{formatCurrency(totals.taxDeducted)}</span>
        </div>
        <div className="rounded-brand bg-white/5 p-3">
          <span className="block font-body text-xs font-medium uppercase tracking-wider text-white/60">Carryable</span>
          <span className="mt-1 block break-all font-mono text-base font-bold tabular-nums text-white">{formatCurrency(totals.taxCarryable)}</span>
        </div>
      </div>
    </div>
  );
};

// Net-CGT-payable headline — shown only when gross CGT > 0. Context consumer.
const NetCgtHeadline = () => {
  const totals = useLiveTotals();
  if (!(totals.cgt > 0)) return null;
  return (
    <div className="flex flex-col gap-1 rounded-brand border-l-[3px] border-red-500 bg-red-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="font-body text-sm font-bold text-red-700">Net CGT payable</div>
      <div className="font-body text-xs text-slate-500 sm:text-right">
        Gross CGT {formatCurrency(totals.cgt)} − tax deducted {formatCurrency(totals.taxDeducted)}
      </div>
      <div className="font-mono text-base font-bold tabular-nums text-red-600 sm:text-right">
        {formatCurrency(Math.max(0, totals.cgt - totals.taxDeducted))}
      </div>
    </div>
  );
};

const CapitalGainsForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving,
    incomeProfile,
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
    control,
    getValues,
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

  // PERF-02: no bare watch() at render. The auto-calc effect runs in the
  // headless <CapitalGainsAutoCalc> child; the totals band + net-CGT headline
  // are context consumers of <LiveTotalsProvider>; each row's CGT hint
  // self-subscribes via <LiveWhen>.

  // Prior year pre-fill

  // Fields computed client-side (rate × gain) that have no matching DB column —
  // strip before save to avoid PostgreSQL "column does not exist" errors.
  const CGT_EPHEMERAL = new Set(capitalGainItems.map(i => i.taxField));

  const buildFormData = (data) => {
    const t = computeCgTotals(data);
    // Remove ephemeral *_cgt fields from the form state
    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([k]) => !CGT_EPHEMERAL.has(k))
    );
    return {
      ...sanitized,
      // total_capital_gain — writable column (DB also has computed DEFAULT from *_taxable)
      total_capital_gain:           t.taxable,
      // capital_gains_tax_chargeable — net CGT after WHT offset; correct DB column name
      capital_gains_tax_chargeable: Math.max(0, t.cgt - t.taxDeducted),
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
    const success = await saveFormStep('capital_gain', buildFormData(watch()), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/expenses');
    }
  };

  // Field-level visibility — driven by income-profile addons. The
  // property group needs property_gain; the securities group needs
  // securities. Pure salaried sees nothing on this form.
  const addons = useMemo(() => incomeProfile?.addons || [], [incomeProfile]);
  const visibleFields = useMemo(
    () => visibleFieldsFor('capital_gain_forms', addons),
    [addons]
  );

  // Group for display, filtered by addon visibility.
  const propertyItems = capitalGainItems
    .filter(i => i.id.startsWith('immovable_property'))
    .filter(i => visibleFields.has(i.taxableAmount));
  const securitiesItems = capitalGainItems
    .filter(i => i.id.startsWith('securities'))
    .filter(i => visibleFields.has(i.taxableAmount));

  const renderGroup = (title, sublabel, items) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 px-3">
        <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
        {sublabel && <span className="font-body text-xs text-slate-400">{sublabel}</span>}
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
        {items.map(item => {
          const r = cgtRate(item.id);
          return (
            <div key={item.id} className="grid grid-cols-1 gap-2 px-3 py-3 md:grid-cols-[1fr_72px_140px_140px_140px_120px] md:items-start md:gap-3">
              <div className="min-w-0">
                <div className="flex items-start gap-1.5">
                  <span className="font-body text-sm leading-snug text-slate-700">{item.description}</span>
                  <HelpHint fieldId={item.id} source={capitalGainsHelp} />
                </div>
                <div className="mt-0.5 md:hidden">
                  {r === null ? (
                    <span className="font-body text-xs text-slate-400">Rate loading…</span>
                  ) : r === 0 ? (
                    <span className="font-body text-xs text-slate-400">Rate: exempt</span>
                  ) : (
                    <span className="font-body text-xs font-semibold text-navy">Rate {(r * 100).toFixed(1)}%</span>
                  )}
                </div>
              </div>

              <div className="hidden md:flex md:items-center md:justify-center md:pt-2">
                {r === null ? (
                  <span className="font-body text-xs text-slate-400">…</span>
                ) : r === 0 ? (
                  <span className="font-body text-xs font-semibold text-slate-400">NIL</span>
                ) : (
                  <span className="font-body text-sm font-bold tabular-nums text-navy">{(r * 100).toFixed(1)}%</span>
                )}
              </div>

              <div>
                <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">Gain amount</span>
                <input
                  id={item.taxableAmount}
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  aria-label={`${item.description} — gain amount`}
                  aria-invalid={errors[item.taxableAmount] ? true : undefined}
                  {...register(item.taxableAmount, { valueAsNumber: true, min: 0 })}
                  className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                  placeholder="0"
                />
                {errors[item.taxableAmount] && (
                  <p role="alert" className="mt-1 text-right font-body text-xs font-medium text-red-600">{errors[item.taxableAmount].message}</p>
                )}
              </div>

              <div>
                <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">CGT (auto)</span>
                <input
                  id={item.taxField}
                  type="number"
                  step="1"
                  min="0"
                  aria-label={`${item.description} — capital gains tax (auto-calculated)`}
                  {...register(item.taxField, { valueAsNumber: true, min: 0 })}
                  className="w-full cursor-default rounded-brand border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-slate-500 focus:outline-none"
                  placeholder="0"
                  readOnly
                  title="Auto-calculated — read-only"
                />
                {r !== null && r > 0 && (
                  <LiveWhen control={control} field={item.taxableAmount}>
                    <p className="mt-1 text-right font-body text-xs text-slate-400">Auto @ {(r * 100).toFixed(1)}%</p>
                  </LiveWhen>
                )}
              </div>

              <div>
                <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">Tax deducted</span>
                <input
                  id={item.taxDeducted}
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  aria-label={`${item.description} — tax deducted`}
                  {...register(item.taxDeducted, { valueAsNumber: true, min: 0 })}
                  className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                  placeholder="0"
                />
              </div>

              <div>
                <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">Carryable</span>
                <input
                  id={item.taxCarryable}
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  aria-label={`${item.description} — carryable`}
                  {...register(item.taxCarryable, { valueAsNumber: true, min: 0 })}
                  className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                  placeholder="0"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="cg-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="cg-help">
      <h3 className="font-display text-sm font-bold text-navy">About this form</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600">
        <li><strong className="text-navy">Immovable property u/s 37(1A)</strong>: rates step from 15% down to 2.5% by holding period; exempt after 6 years.</li>
        <li><strong className="text-navy">Securities u/s 37A</strong>: rates from 5% to 25% depending on type and acquisition date.</li>
        <li>CGT is auto-calculated from gain amount × rate (read-only column).</li>
        <li><strong className="text-navy">Tax deducted</strong>: advance tax already withheld (e.g. u/s 236C on property).</li>
        <li><strong className="text-navy">Carryable</strong>: net CGT that carries to your computation summary.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CapitalGainsAutoCalc control={control} getValues={getValues} setValue={setValue} rates={rates} isLoadingFromDB={isLoadingFromDB} />
      <LiveTotalsProvider control={control} compute={computeCgTotals}>
      <TaxFormShell
        title="Capital gains"
        subtitle="Gains from property and securities"
        icon={TrendingUp}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/final-tax')}
            backLabel="Final tax"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save data'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >

        {/* Column headers (desktop) */}
        {(propertyItems.length > 0 || securitiesItems.length > 0) && (
          <div className="hidden grid-cols-[1fr_72px_140px_140px_140px_120px] gap-3 px-3 md:grid">
            <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-400">Description</span>
            <span className="text-center font-body text-xs font-bold uppercase tracking-wider text-slate-400">Rate</span>
            <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">Gain amount</span>
            <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">CGT (auto)</span>
            <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">Tax deducted</span>
            <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">Carryable</span>
          </div>
        )}

        {propertyItems.length === 0 && securitiesItems.length === 0 ? (
          <FormEmptyState
            title="No capital-gain categories apply to your income profile yet."
            addons={['Property Sale', 'Listed Shares / Mutual Funds']}
            note="CGT brackets are very specific to the asset class and holding period — we only show the ones that match your declared streams."
          />
        ) : (
          <>
            {propertyItems.length > 0 && renderGroup('Immovable property', 'u/s 37(1A)', propertyItems)}
            {securitiesItems.length > 0 && renderGroup('Securities & mutual funds', 'u/s 37A', securitiesItems)}

            {/* Totals — navy emphasis band; net CGT payable shown as a red headline. */}
            <CapitalGainsTotalsBand />
          </>
        )}

        {/* Net CGT payable headline */}
        <NetCgtHeadline />
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default CapitalGainsForm;
