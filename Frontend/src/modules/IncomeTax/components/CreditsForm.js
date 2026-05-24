import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  Gift,
  Info,
  ChevronDown,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import creditsHelp from '../../../help/creditsHelp';
import { formatCurrency } from '../../../utils/currency';

const CreditsForm = () => {
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

  const [showHelp, setShowHelp] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('credits')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back)
  useEffect(() => {
    const savedData = contextFormData['credits'];
    if (savedData && Object.keys(savedData).length > 0) {
      reset(savedData);
    }
  }, [contextFormData, reset]);

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Prior year pre-fill
  const { hasPriorData: hasPriorCredits, applyPriorYear: applyPriorCredits, dismissPriorYear: dismissPriorCredits } = usePriorYearData('credits', setValue);

  // ── Rebate-at-average-rate auto-calculation (u/s 61, 62, 63) ────────────────
  // Formula (ITO 2001):
  //   Credit = eligible_amount × (normal_income_tax / taxable_income)
  //   eligible_amount = MIN(actual, cap% × taxable_income)
  //
  // Slabs and caps come from DB via useTaxRates — no hardcoded rate constants.

  // Progressive tax walk over DB-sourced slabs. Same algorithm as the backend
  // CalculationService.calculateProgressiveTax.
  const calculateNormalTax = (income) => {
    const taxable = parseFloat(income) || 0;
    if (!rates?.slabs || taxable <= 0) return 0;
    let total = 0;
    for (const slab of rates.slabs) {
      const minI = Number(slab.min_income);
      const maxI = slab.max_income === null || slab.max_income === undefined
        ? Number.POSITIVE_INFINITY
        : Number(slab.max_income);
      const rate = Number(slab.tax_rate);
      const effectiveLower = minI > 0 ? minI - 1 : 0;
      if (taxable <= effectiveLower) continue;
      const ceiling = Math.min(taxable, maxI);
      const taxableAtThisSlab = ceiling - effectiveLower;
      if (taxableAtThisSlab > 0 && rate > 0) total += taxableAtThisSlab * rate;
    }
    return Math.round(total);
  };

  // Derive taxable income from income form context data — and subtract
  // deductible allowances (zakat, POS, education) before computing credit
  // caps. The s.61/s.63 statutory base is "taxable income" which is
  // post-deductions; using the pre-deduction figure makes the caps too
  // generous when the filer has deductions.
  const incomeData = contextFormData['income'] || {};
  const deductionsData = contextFormData['deductions'] || {};
  const grossTaxable =
    (parseFloat(incomeData.total_employment_income) || parseFloat(incomeData.annual_salary_wages_total) || 0)
    + (parseFloat(incomeData.other_income_no_min_tax_total) || 0);
  const totalDeductions =
    parseFloat(deductionsData.total_deductions)
    || parseFloat(deductionsData.total_deduction_from_income)
    || 0;
  const taxableIncome = Math.max(0, grossTaxable - totalDeductions);
  const normalTax = calculateNormalTax(taxableIncome);
  const avgRate = taxableIncome > 0 ? normalTax / taxableIncome : 0;

  const computeRebateCredit = (actualAmount, capPct) => {
    if (!taxableIncome || !normalTax || !actualAmount || !capPct) return 0;
    const eligible = Math.min(parseFloat(actualAmount) || 0, taxableIncome * capPct);
    return eligible > 0 ? Math.round(eligible * avgRate) : 0;
  };

  // DB-sourced cap ratios (u/s 61: 30%, u/s 61 to associate: 15%, u/s 63: 20%).
  const donationCap = rates?.creditCaps?.donation_u61?.rate;
  const donationAssociateCap = rates?.creditCaps?.donation_u61_associate?.rate;
  const pensionCap = rates?.creditCaps?.pension_u63?.rate;

  useEffect(() => {
    if (!donationCap) return;
    const donation = parseFloat(watchedValues.charitable_donations_amount) || 0;
    if (taxableIncome > 0) {
      setValue('charitable_donations_tax_credit', computeRebateCredit(donation, donationCap));
    }
  }, [watchedValues.charitable_donations_amount, taxableIncome, normalTax, donationCap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!donationAssociateCap) return;
    const donation = parseFloat(watchedValues.charitable_donations_associate_amount) || 0;
    if (taxableIncome > 0) {
      setValue('charitable_donations_associate_tax_credit', computeRebateCredit(donation, donationAssociateCap));
    }
  }, [watchedValues.charitable_donations_associate_amount, taxableIncome, normalTax, donationAssociateCap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pensionCap) return;
    const contribution = parseFloat(watchedValues.pension_fund_amount) || 0;
    if (taxableIncome > 0) {
      setValue('pension_fund_tax_credit', computeRebateCredit(contribution, pensionCap));
    }
  }, [watchedValues.pension_fund_amount, taxableIncome, normalTax, pensionCap]); // eslint-disable-line react-hooks/exhaustive-deps
  // ────────────────────────────────────────────────────────────────────────────

  // Define comprehensive tax credits structure matching Excel. Memoised
  // so the visibility-filter useMemo below has a stable dependency.
  const creditItems = useMemo(() => [
    {
      id: 'charitable_donations_u61',
      description: 'Tax Credit for Charitable Donations u/s 61',
      yesNo: 'Y',
      amount: 'charitable_donations_amount',
      taxReduction: 'charitable_donations_tax_credit',
      limits: 'Rebate at avg rate. Eligible = MIN(donation, 30% of taxable income)',
      autoCalc: true,
      limitPct: 0.30
    },
    {
      id: 'charitable_donations_associate',
      description: 'Tax Credit for Charitable Donations where donation is made to associate',
      yesNo: 'Y',
      amount: 'charitable_donations_associate_amount',
      taxReduction: 'charitable_donations_associate_tax_credit',
      limits: 'Rebate at avg rate. Eligible = MIN(donation, 15% of taxable income)',
      autoCalc: true,
      limitPct: 0.15
    },
    {
      id: 'pension_fund_u63',
      description: 'Tax Credit for Contribution to Approved Pension Fund u/s 63',
      yesNo: 'Y',
      amount: 'pension_fund_amount',
      taxReduction: 'pension_fund_tax_credit',
      limits: 'Rebate at avg rate. Eligible = MIN(contribution, 20% of taxable income)',
      autoCalc: true,
      limitPct: 0.20
    },
    {
      id: 'surrender_tax_credit_investments',
      description: 'Surrender of Tax Credit on Investments in Shares disposed off before time limit',
      yesNo: '-',
      amount: 'surrender_tax_credit_amount',
      taxReduction: 'surrender_tax_credit_reduction',
      limits: 'Manual entry — negative credit (reversal)',
      autoCalc: false,
      limitPct: null
    }
  ], []);

  // Field-level visibility — driven by income profile. Pure salaried sees
  // only charitable-donations row (3 fields). Pension addon unlocks
  // pension-fund credit. Advanced reveals charitable-to-associate and
  // surrender-of-tax-credit (both ADVANCED in the manifest).
  const addons = useMemo(() => incomeProfile?.addons || [], [incomeProfile]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visibleFields = useMemo(
    () => visibleFieldsFor('credits_forms', addons, { advanced: showAdvanced }),
    [addons, showAdvanced]
  );
  const advancedExtraCount =
    visibleFieldsFor('credits_forms', addons, { advanced: true }).size -
    visibleFieldsFor('credits_forms', addons).size;
  const visibleCreditItems = useMemo(
    () => creditItems.filter((item) => visibleFields.has(item.amount)),
    [creditItems, visibleFields]
  );

  // Calculate total tax credit
  const calculateTotalCredit = () => {
    return creditItems.reduce((total, item) => {
      return total + (parseFloat(watchedValues[item.taxReduction]) || 0);
    }, 0);
  };

  const totalCredit = calculateTotalCredit();

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_tax_credits: totalCredit
    };

    const success = await saveFormStep('credits', formData, true);
    if (success) {
      toast.success('Tax credits information saved successfully');
      navigate('/income-tax/deductions');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_tax_credits: totalCredit
    };

    const success = await saveFormStep('credits', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/deductions');
    }
  };
  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Credits</h1>
              <p className="text-gray-600">Enter eligible tax credits for charitable donations and investments</p>
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

        {/* Help Panel */}
        {showHelp && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Tax Credits Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Rebate at average rate</strong> is allowed on donations to approved non-profit organisations</li>
              <li>• <strong>General donations</strong>: Lower of donation value and 30% of taxable income</li>
              <li>• <strong>Associate donations</strong>: Restricted to 15% of taxable income</li>
              <li>• <strong>Pension contributions</strong>: 20% of taxable income (2% per year for late joiners above 40)</li>
              <li>• <strong>Tax credits</strong> reduce your final tax liability after calculation</li>
            </ul>
          </div>
        )}
      </div>

      {/* Auto-calc context banner */}
      {taxableIncome > 0 ? (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>
            Auto-calculating credits using taxable income of <strong>{formatCurrency(taxableIncome)}</strong> and
            average tax rate of <strong>{(avgRate * 100).toFixed(2)}%</strong> (normal tax: {formatCurrency(normalTax)}).
            Credits are editable — enter the donation amount and the credit is computed automatically.
          </span>
        </div>
      ) : (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>Income form data not yet loaded. Save your Income form first for automatic credit calculation. You can also enter tax credits manually.</span>
        </div>
      )}

      {hasPriorCredits && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm text-indigo-800">Prior year donation/contribution data available — apply to pre-fill?</span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={dismissPriorCredits} className="text-xs px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100">Dismiss</button>
            <button type="button" onClick={applyPriorCredits} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">Apply Prior Year Data</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Column Headers */}
        <div className="bg-blue-600 text-white rounded-lg">
          <div className="grid grid-cols-12 gap-3 items-center py-3 px-4 font-semibold">
            <div className="col-span-5">Description</div>
            <div className="col-span-1 text-center">Y/N</div>
            <div className="col-span-2 text-center">Amount</div>
            <div className="col-span-2 text-center">Tax Credit</div>
            <div className="col-span-2 text-center">Limits/Remarks</div>
          </div>
        </div>

        {/* Tax Credits Section */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
            <Gift className="w-5 h-5 mr-2" />
            Tax Credits
          </h2>

          {visibleCreditItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center py-3 border-b border-purple-200 last:border-b-0">
              <div className="col-span-5">
                <p className="text-sm font-medium text-gray-700">
                  {item.description}
                  <HelpHint fieldId={item.id} source={creditsHelp} />
                </p>
              </div>
              <div className="col-span-1 text-center">
                {item.yesNo === '-' ? (
                  <span className="text-gray-400">-</span>
                ) : (
                  <select
                    {...register(`${item.id}_yn`)}
                    className="form-select w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">-</option>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                )}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.amount, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={inputClasses}
                  placeholder="0"
                />
                {errors[item.amount] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.amount].message}</p>
                )}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.taxReduction, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={`${inputClasses} ${item.autoCalc && taxableIncome > 0 ? 'bg-emerald-50 border-emerald-300' : ''}`}
                  placeholder="0"
                />
                {item.autoCalc && taxableIncome > 0 && (() => {
                  const donated = parseFloat(watchedValues[item.amount]) || 0;
                  const eligible = Math.min(donated, taxableIncome * item.limitPct);
                  return donated > 0 ? (
                    <p className="mt-1 text-xs text-emerald-700">
                      Auto: eligible Rs {eligible.toLocaleString('en-PK')} × {(avgRate * 100).toFixed(2)}%
                    </p>
                  ) : null;
                })()}
                {errors[item.taxReduction] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.taxReduction].message}</p>
                )}
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-600 p-2 bg-gray-50 rounded border">{item.limits}</p>
              </div>
            </div>
          ))}

          {/* Advanced toggle: reveals less-common credit lines (donations
              to associate, surrender of tax credit). Only shown when
              there's an extra to reveal — pension / charitable already in
              the always-or-addon set are filtered above. */}
          {advancedExtraCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-center gap-2 mt-4 px-4 py-3 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-200 rounded-lg hover:bg-purple-200 transition-colors"
            >
              {showAdvanced ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Hide advanced credit fields
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Show {advancedExtraCount} advanced credit field{advancedExtraCount === 1 ? '' : 's'}
                </>
              )}
            </button>
          )}

          {/* Total Tax Credits */}
          <div className="grid grid-cols-12 gap-3 items-center py-4 mt-4 bg-purple-100 rounded-lg px-4 font-semibold">
            <div className="col-span-5">
              <p className="text-purple-800">Total Tax Credit</p>
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-2"></div>
            <div className="col-span-2 text-right">
              <p className="text-xl font-bold text-purple-800">{formatCurrency(totalCredit)}</p>
            </div>
            <div className="col-span-2"></div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/income-tax/reductions')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Tax Reductions
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

export default CreditsForm;