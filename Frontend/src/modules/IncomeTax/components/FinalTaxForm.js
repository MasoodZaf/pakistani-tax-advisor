/* eslint-disable react-hooks/exhaustive-deps -- auto-calc effect uses a spread of watched values; adding watchedValues/finalTaxRate to deps would loop */
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  Building2,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import finalTaxHelp from '../../../help/finalTaxHelp';
import { formatCurrency } from '../../../utils/currency';

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
    setValue
  } = useForm({
    defaultValues: getStepData('final_tax')
  });

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

  const watchedValues = watch();

  // Prior year pre-fill
  const { hasPriorData: hasPriorFT, applyPriorYear: applyPriorFT, dismissPriorYear: dismissPriorFT } = usePriorYearData('final_tax', setValue);

  // Auto-calculate tax for fixed-rate items. Rate sourced from DB; manual-entry
  // items skip auto-calc. Fires again when `rates` arrive so initial pre-fill
  // uses authoritative DB values.
  useEffect(() => {
    if (!rates?.finalTax) return;
    FINAL_TAX_ITEMS.forEach(item => {
      if (item.manual) return;
      const rate = finalTaxRate(item.id);
      if (rate === null) return; // category missing from DB — leave untouched
      const amount = parseFloat(watchedValues[item.amountField]) || 0;
      const calculated = amount > 0 ? Math.round(amount * rate) : 0;
      const current = parseFloat(watchedValues[item.taxField]) || 0;
      if (Math.abs(current - calculated) > 0.01) {
        setValue(item.taxField, calculated);
      }
    });
  }, [
    ...FINAL_TAX_ITEMS.map(i => watchedValues[i.amountField]),
    rates,
    setValue,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute total final tax
  const totalFinalTax = FINAL_TAX_ITEMS.reduce((sum, item) => {
    return sum + (parseFloat(watchedValues[item.taxField]) || 0);
  }, 0);

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
      total_final_tax: totalFinalTax,
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
    const success = await saveFormStep('final_tax', buildFinalTaxPayload(watchedValues), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/capital-gains');
    }
  };
  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  // Group items for display
  const groups = [
    { title: 'Prize Bonds & Winnings', color: 'yellow', ids: ['prize_bond_winnings', 'lottery_crossword_winnings'] },
    { title: 'Government Securities Profit', color: 'green', ids: ['profit_govt_securities', 'profit_defence_savings'] },
    { title: 'Dividend Income', color: 'blue', ids: ['dividend_listed_companies', 'dividend_other'] },
    { title: 'Capital Gain (Final Tax)', color: 'purple', ids: ['capital_gain_securities_less_12m', 'capital_gain_securities_over_12m'] },
    { title: 'Other Final Tax', color: 'gray', ids: ['commission_agents', 'other_final_tax'] }
  ];

  const colorMap = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    gray:   'bg-gray-50 border-gray-200 text-gray-800'
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Final Tax</h1>
              <p className="text-gray-600">Income taxed at fixed rates — not included in normal income computation</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Final Tax Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Final tax</strong> is the complete tax liability on these income types — no further computation, no refund</li>
              <li>• These amounts are NOT added to your taxable income for normal slab calculation</li>
              <li>• Tax is auto-calculated for fixed-rate items; enter the gross amount received</li>
              <li>• Rates are per Finance Act 2025 / ITO 2001</li>
            </ul>
          </div>
        )}
      </div>

      {hasPriorFT && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm text-indigo-800">Prior year final tax data available — apply to pre-fill?</span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={dismissPriorFT} className="text-xs px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100">Dismiss</button>
            <button type="button" onClick={applyPriorFT} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">Apply Prior Year Data</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Column Headers */}
        <div className="bg-red-600 text-white rounded-lg">
          <div className="grid grid-cols-12 gap-3 items-center py-3 px-4 font-semibold text-sm">
            <div className="col-span-1">Section</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-2 text-center">Rate</div>
            <div className="col-span-2 text-center">Gross Amount (Rs)</div>
            <div className="col-span-2 text-center">Tax (Rs)</div>
            <div className="col-span-1 text-center">Remarks</div>
          </div>
        </div>

        {groups.map(group => {
          const items = FINAL_TAX_ITEMS.filter(i => group.ids.includes(i.id));
          return (
            <div key={group.title} className={`border rounded-lg overflow-hidden ${colorMap[group.color]}`}>
              <div className={`px-4 py-2 font-semibold text-sm border-b ${colorMap[group.color]}`}>
                {group.title}
              </div>
              {items.map(item => {
                const r = item.manual ? null : finalTaxRate(item.id);
                const isAutoCalc = !item.manual && r !== null;
                return (
                <div key={item.id} className="grid grid-cols-12 gap-3 items-center py-3 px-4 border-b border-opacity-50 last:border-b-0 bg-white hover:bg-gray-50">
                  <div className="col-span-1">
                    <span className="text-xs font-mono text-gray-500">{item.section}</span>
                  </div>
                  <div className="col-span-4">
                    <p className="text-sm font-medium text-gray-700">
                      {item.description}
                      <HelpHint fieldId={item.id} source={finalTaxHelp} />
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.remark}</p>
                  </div>
                  <div className="col-span-2 text-center">
                    {item.manual ? (
                      <span className="text-xs text-gray-400">Manual</span>
                    ) : r !== null ? (
                      <span className="text-sm font-semibold text-red-700">{(r * 100).toFixed(1)}%</span>
                    ) : (
                      <span className="text-xs text-gray-400">…</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register(item.amountField, { valueAsNumber: true, min: 0 })}
                      className={inputClasses}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register(item.taxField, { valueAsNumber: true, min: 0 })}
                      className={`${inputClasses} ${isAutoCalc ? 'bg-red-50 border-red-200' : ''}`}
                      placeholder="0"
                      readOnly={isAutoCalc}
                      title={isAutoCalc ? 'Auto-calculated — read-only' : 'Enter manually'}
                    />
                    {isAutoCalc && (parseFloat(watchedValues[item.amountField]) || 0) > 0 && (
                      <p className="mt-0.5 text-xs text-red-600">Auto @ {(r * 100).toFixed(1)}%</p>
                    )}
                  </div>
                  <div className="col-span-1"></div>
                </div>
                );
              })}
            </div>
          );
        })}

        {/* Total */}
        <div className="grid grid-cols-12 gap-3 items-center py-4 px-4 bg-red-100 border-2 border-red-300 rounded-lg font-bold">
          <div className="col-span-7 text-red-900">Total Final Tax</div>
          <div className="col-span-2"></div>
          <div className="col-span-2 text-right text-xl text-red-900">
            {formatCurrency(totalFinalTax)}
          </div>
          <div className="col-span-1"></div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/income-tax/deductions')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Deductions
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

export default FinalTaxForm;
