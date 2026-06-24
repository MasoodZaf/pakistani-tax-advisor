import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import finalTaxHelp from '../../../help/finalTaxHelp';
import { TaxFormShell, AmountRow, FormNav, LiveTotalsProvider, LiveAmount } from '../../../components/forms';
import { useUnsavedChangesWarning } from '../../../hooks/useUnsavedChangesWarning';

// Final Tax items. Rates are NOT stored here — they live in tax_rates_config
// (rate_type='final_tax', rate_category=item.id) and are resolved per-year
// via useTaxRates(). `manual: true` entries are user-entered (e.g. "other
// final tax" with a variable rate).
const FINAL_TAX_ITEMS = [
  { id: 'prize_bond_winnings',              section: 'u/s 156',     description: 'Winnings from Prize Bonds',                                 amountField: 'prize_bond_winnings_amount',              taxField: 'prize_bond_winnings_tax',              remark: 'Final tax, no refund' },
  { id: 'lottery_crossword_winnings',       section: 'u/s 156A',    description: 'Winnings from Lottery / Raffle / Quiz / Crossword',         amountField: 'lottery_crossword_winnings_amount',       taxField: 'lottery_crossword_winnings_tax',       remark: 'Final tax' },
  { id: 'profit_govt_securities',           section: 'u/s 151(1)(a)', description: 'Profit on National Savings Scheme / Post Office Savings', amountField: 'profit_govt_securities_amount',           taxField: 'profit_govt_securities_tax',           remark: 'Final WHT on NSS/Post Office profit' },
  { id: 'profit_defence_savings',           section: 'u/s 151(1)(b)', description: 'Profit on Defence Savings Certificates',                 amountField: 'profit_defence_savings_amount',           taxField: 'profit_defence_savings_tax',           remark: 'Final WHT on DSCs' },
  { id: 'dividend_listed_companies',        section: 'u/s 150',     description: 'Dividend from Listed Companies',                           amountField: 'dividend_listed_companies_amount',        taxField: 'dividend_listed_companies_tax',        remark: 'Final tax on dividends from listed companies' },
  { id: 'dividend_other',                   section: 'u/s 150',     description: 'Dividend from Other Companies / Mutual Funds',             amountField: 'dividend_other_amount',                   taxField: 'dividend_other_tax',                   remark: 'Final tax on dividends from unlisted / others' },
  { id: 'capital_gain_securities_less_12m', section: 'u/s 37A',     description: 'Capital Gain on Securities (holding < 12 months)',         amountField: 'capital_gain_securities_less_12m_amount', taxField: 'capital_gain_securities_less_12m_tax', remark: 'Final tax on short-term securities gain' },
  { id: 'capital_gain_securities_over_12m', section: 'u/s 37A',     description: 'Capital Gain on Securities (holding ≥ 12 months)',         amountField: 'capital_gain_securities_over_12m_amount', taxField: 'capital_gain_securities_over_12m_tax', remark: 'Final tax on long-term securities gain' },
  { id: 'commission_agents',                section: 'u/s 233',     description: 'Commission paid to Stock Exchange Members / Agents',       amountField: 'commission_agents_amount',                taxField: 'commission_agents_tax',                remark: 'Final tax on commission income' },
  { id: 'other_final_tax',                  section: 'Other',       description: 'Other Income Subject to Final Tax (specify in notes)',     amountField: 'other_final_tax_income_amount',           taxField: 'other_final_tax_income_tax',           manual: true, remark: 'Rate varies — enter tax amount manually' },
];

// All FINAL_TAX_ITEMS fields use form-specific names that differ from DB column names.
// Defined outside the component so it's not recreated on every render.
const FINAL_TAX_EPHEMERAL = new Set(
  FINAL_TAX_ITEMS.flatMap(item => [item.amountField, item.taxField, `${item.id}_yn`])
);

// Sum of all per-item final-tax fields (the form's total). Pure.
const sumFinalTax = (values) =>
  FINAL_TAX_ITEMS.reduce((sum, item) => sum + (parseFloat(values[item.taxField]) || 0), 0);

// PERF-02: the auto-calc effect lives here (headless) so its field subscription
// doesn't re-render the whole form. It watches ONLY the amount fields; the
// current tax value (for the no-loop guard) is read one-shot via getValues.
// Logic is byte-identical to the former in-component effect.
const FinalTaxAutoCalc = ({ control, getValues, setValue, rates }) => {
  const amounts = useWatch({ control, name: FINAL_TAX_ITEMS.map(i => i.amountField) });
  useEffect(() => {
    if (!rates?.finalTax) return;
    FINAL_TAX_ITEMS.forEach((item, idx) => {
      if (item.manual) return;
      const rate = rates.finalTax[item.id]?.rate ?? null;
      if (rate === null) return; // category missing from DB — leave untouched
      const amount = parseFloat(amounts[idx]) || 0;
      const calculated = amount > 0 ? Math.round(amount * rate) : 0;
      const current = parseFloat(getValues(item.taxField)) || 0;
      if (Math.abs(current - calculated) > 0.01) {
        setValue(item.taxField, calculated);
      }
    });
  }, [...amounts, rates, getValues, setValue]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

// Per-row "Auto-calculated @ X%" hint — self-subscribes to just its amount
// field so the row's hint updates without re-rendering the rest of the form.
const AutoCalcHint = ({ control, field, ratePct }) => {
  const amount = useWatch({ control, name: field });
  if (!((parseFloat(amount) || 0) > 0)) return null;
  return <p className="mt-1 text-right font-body text-xs text-slate-400 dark:text-[#7e88a6]">Auto-calculated @ {ratePct}%</p>;
};

const FinalTaxForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  // Resolve a final-tax rate for an item.id via DB. Returns null while rates
  // haven't loaded; manual-entry items intentionally skip auto-calc.
  const finalTaxRate = (id) => rates?.finalTax?.[id]?.rate ?? null;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    control,
    getValues,
    formState: { isDirty }
  } = useForm({
    defaultValues: getStepData('final_tax')
  });

  useUnsavedChangesWarning(isDirty);

  // Sync form when saved data loads from API.
  // Reverse-map DB column names → form field names for all 10 FINAL_TAX_ITEMS groups.
  useEffect(() => {
    const savedData = contextFormData['final_tax'];
    if (savedData && Object.keys(savedData).length > 0) {
      const normalized = {
        ...savedData,
        // prize_bonds_* ← prize_bond_winnings (u/s 156)
        prize_bond_winnings_yn:                  savedData.prize_bonds_yn                           || '',
        prize_bond_winnings_amount:              savedData.prize_bonds_gross_amount                 || 0,
        prize_bond_winnings_tax:                 savedData.prize_bonds_tax_amount                   || 0,
        // lottery_crossword_winnings (u/s 156A) — _amount same, only _tax renamed
        lottery_crossword_winnings_tax:          savedData.lottery_crossword_winnings_tax_amount    || 0,
        // profit_govt_securities (u/s 151(1)(a)) — _amount same, only _tax renamed
        profit_govt_securities_tax:              savedData.profit_govt_securities_tax_amount        || 0,
        // profit_defence_savings (u/s 151(1)(b)) — _amount same, only _tax renamed
        profit_defence_savings_tax:              savedData.profit_defence_savings_tax_amount        || 0,
        // dividend_listed_companies (u/s 150) — _amount same, only _tax renamed
        dividend_listed_companies_tax:           savedData.dividend_listed_companies_tax_amount     || 0,
        // dividend_other (u/s 150) — _amount same, only _tax renamed
        dividend_other_tax:                      savedData.dividend_other_tax_amount                || 0,
        // capital_gain_securities_short_* ← capital_gain_securities_less_12m (u/s 37A)
        capital_gain_securities_less_12m_yn:     savedData.capital_gain_securities_short_yn         || '',
        capital_gain_securities_less_12m_amount: savedData.capital_gain_securities_short_amount     || 0,
        capital_gain_securities_less_12m_tax:    savedData.capital_gain_securities_short_tax_amount || 0,
        // capital_gain_securities_long_* ← capital_gain_securities_over_12m (u/s 37A)
        capital_gain_securities_over_12m_yn:     savedData.capital_gain_securities_long_yn          || '',
        capital_gain_securities_over_12m_amount: savedData.capital_gain_securities_long_amount      || 0,
        capital_gain_securities_over_12m_tax:    savedData.capital_gain_securities_long_tax_amount  || 0,
        // commission_agents (u/s 233) — _amount same, only _tax renamed
        commission_agents_tax:                   savedData.commission_agents_tax_amount             || 0,
        // other_final_tax_* ← other_final_tax_income (Other)
        other_final_tax_income_amount:           savedData.other_final_tax_gross_amount             || 0,
        other_final_tax_income_tax:              savedData.other_final_tax_tax_amount               || 0,
      };
      reset(normalized);
    }
  }, [contextFormData, reset]);

  // PERF-02: no bare watch() at render. The auto-calc effect runs in the
  // headless <FinalTaxAutoCalc> child; the total is isolated in
  // <LiveTotalsProvider>; each row's auto-calc hint self-subscribes.

  // Prior year pre-fill

  const buildFinalTaxPayload = (data) => {
    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([k]) => !FINAL_TAX_EPHEMERAL.has(k))
    );
    return {
      ...sanitized,
      // u/s 156  Prize Bond Winnings → prize_bonds_* group
      prize_bonds_yn:                              data.prize_bond_winnings_yn                   || '',
      prize_bonds_gross_amount:                    data.prize_bond_winnings_amount               || 0,
      prize_bonds_tax_amount:                      data.prize_bond_winnings_tax                  || 0,
      // u/s 156A  Lottery / Crossword Winnings
      lottery_crossword_winnings_yn:               data.lottery_crossword_winnings_yn            || '',
      lottery_crossword_winnings_amount:           data.lottery_crossword_winnings_amount        || 0,
      lottery_crossword_winnings_tax_amount:       data.lottery_crossword_winnings_tax           || 0,
      // u/s 151(1)(a)  NSS / Post Office Savings Profit
      profit_govt_securities_yn:                   data.profit_govt_securities_yn                || '',
      profit_govt_securities_amount:               data.profit_govt_securities_amount            || 0,
      profit_govt_securities_tax_amount:           data.profit_govt_securities_tax               || 0,
      // u/s 151(1)(b)  Defence Savings Certificates Profit
      profit_defence_savings_yn:                   data.profit_defence_savings_yn                || '',
      profit_defence_savings_amount:               data.profit_defence_savings_amount            || 0,
      profit_defence_savings_tax_amount:           data.profit_defence_savings_tax               || 0,
      // u/s 150  Dividend from Listed Companies
      dividend_listed_companies_yn:                data.dividend_listed_companies_yn             || '',
      dividend_listed_companies_amount:            data.dividend_listed_companies_amount         || 0,
      dividend_listed_companies_tax_amount:        data.dividend_listed_companies_tax            || 0,
      // u/s 150  Dividend from Other Companies / Mutual Funds
      dividend_other_yn:                           data.dividend_other_yn                        || '',
      dividend_other_amount:                       data.dividend_other_amount                    || 0,
      dividend_other_tax_amount:                   data.dividend_other_tax                       || 0,
      // u/s 37A  Capital Gain on Securities < 12 months → short group
      capital_gain_securities_short_yn:            data.capital_gain_securities_less_12m_yn      || '',
      capital_gain_securities_short_amount:        data.capital_gain_securities_less_12m_amount  || 0,
      capital_gain_securities_short_tax_amount:    data.capital_gain_securities_less_12m_tax     || 0,
      // u/s 37A  Capital Gain on Securities ≥ 12 months → long group
      capital_gain_securities_long_yn:             data.capital_gain_securities_over_12m_yn      || '',
      capital_gain_securities_long_amount:         data.capital_gain_securities_over_12m_amount  || 0,
      capital_gain_securities_long_tax_amount:     data.capital_gain_securities_over_12m_tax     || 0,
      // u/s 233  Commission Agents
      commission_agents_yn:                        data.commission_agents_yn                     || '',
      commission_agents_amount:                    data.commission_agents_amount                 || 0,
      commission_agents_tax_amount:                data.commission_agents_tax                    || 0,
      // Other Final Tax → other_final_tax_* group
      other_final_tax_yn:                          data.other_final_tax_yn                       || '',
      other_final_tax_gross_amount:                data.other_final_tax_income_amount            || 0,
      other_final_tax_tax_amount:                  data.other_final_tax_income_tax               || 0,
      total_final_tax: sumFinalTax(data),
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('final_tax', buildFinalTaxPayload(data), true);
    if (success) {
      toast.success('Final tax information saved successfully');
      navigate('/income-tax/capital-gains');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('final_tax', buildFinalTaxPayload(watch()), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/capital-gains');
    }
  };

  // Display grouping — purely presentational.
  const groups = [
    { title: 'Prize bonds & winnings', ids: ['prize_bond_winnings', 'lottery_crossword_winnings'] },
    { title: 'Government securities profit', ids: ['profit_govt_securities', 'profit_defence_savings'] },
    { title: 'Dividend income', ids: ['dividend_listed_companies', 'dividend_other'] },
    { title: 'Capital gain (final tax)', ids: ['capital_gain_securities_less_12m', 'capital_gain_securities_over_12m'] },
    { title: 'Other final tax', ids: ['commission_agents', 'other_final_tax'] },
  ];

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="final-tax-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="final-tax-help">
      <h3 className="font-display text-sm font-bold text-navy dark:text-[#e7eaf3]">About final tax</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600 dark:text-[#aab2cc]">
        <li>Final tax is the complete liability on these income types — no further computation, no refund.</li>
        <li>These amounts are not added to your taxable income for normal slab calculation.</li>
        <li>Tax is auto-calculated for fixed-rate items; enter the gross amount received.</li>
        <li>Rates follow Finance Act 2025 / ITO 2001.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FinalTaxAutoCalc control={control} getValues={getValues} setValue={setValue} rates={rates} />
      <LiveTotalsProvider control={control} compute={(v) => ({ total: sumFinalTax(v) })}>
      <TaxFormShell
        title="Final tax"
        subtitle="Income taxed at fixed rates, outside normal computation"
        icon={Building2}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/deductions')}
            backLabel="Deductions"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >

        {/* Column headers (desktop) */}
        <div className="hidden grid-cols-[1fr_150px_150px] gap-4 px-1 md:grid">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Description</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Gross amount</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Tax</span>
        </div>

        {groups.map((group) => {
          const items = FINAL_TAX_ITEMS.filter((i) => group.ids.includes(i.id));
          return (
            <div key={group.title}>
              <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">{group.title}</h2>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200 dark:divide-[#2a3450] dark:border-[#2a3450]">
                {items.map((item) => {
                  const r = item.manual ? null : finalTaxRate(item.id);
                  const isAutoCalc = !item.manual && r !== null;
                  const ratePct = r !== null ? (r * 100).toFixed(1) : null;
                  return (
                    <div key={item.id} className="grid grid-cols-1 gap-2 px-3 py-3 md:grid-cols-[1fr_150px_150px] md:items-start md:gap-4">
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5">
                          <span className="font-body text-sm leading-snug text-slate-700 dark:text-[#aab2cc]">{item.description}</span>
                          <HelpHint fieldId={item.id} source={finalTaxHelp} />
                        </div>
                        <p className="mt-0.5 font-body text-xs text-slate-400 dark:text-[#7e88a6]">
                          {item.section !== 'Other' && <span className="mr-1">{item.section}</span>}
                          {item.remark}
                          {item.manual
                            ? ' · rate entered manually'
                            : ratePct !== null
                              ? ` · ${ratePct}%`
                              : ''}
                        </p>
                      </div>

                      <div>
                        <span className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Gross amount</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400 dark:text-[#7e88a6]">Rs</span>
                          <input
                            id={item.amountField}
                            type="number"
                            step="1"
                            min="0"
                            inputMode="numeric"
                            aria-label={`${item.description} — gross amount`}
                            {...register(item.amountField, { valueAsNumber: true, min: 0 })}
                            className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white py-2 pl-10 pr-3 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15 dark:border-[#2a3450] dark:bg-[#151c30] dark:text-[#e7eaf3]"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Tax</span>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400 dark:text-[#7e88a6]">Rs</span>
                          <input
                            id={item.taxField}
                            type="number"
                            step="1"
                            min="0"
                            inputMode="numeric"
                            aria-label={`${item.description} — tax`}
                            {...register(item.taxField, { valueAsNumber: true, min: 0 })}
                            className={`w-full rounded-brand border-[1.5px] py-2 pl-10 pr-3 text-right font-body text-sm font-semibold tabular-nums transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15 ${isAutoCalc ? 'cursor-default border-slate-200 bg-slate-50 text-slate-500 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#7e88a6]' : 'border-slate-300 bg-white text-navy dark:border-[#2a3450] dark:bg-[#151c30] dark:text-[#e7eaf3]'}`}
                            placeholder="0"
                            readOnly={isAutoCalc}
                            title={isAutoCalc ? 'Auto-calculated — read-only' : 'Enter manually'}
                          />
                        </div>
                        {isAutoCalc && <AutoCalcHint control={control} field={item.amountField} ratePct={ratePct} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Total — navy emphasis band (this is final tax owed, not a refund). */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200 dark:divide-[#2a3450] dark:border-[#2a3450]">
          <LiveAmount component={AmountRow} field="total" label="Total final tax" variant="total" />
        </div>
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default FinalTaxForm;
