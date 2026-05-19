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
  CreditCard,
  FileText,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import deductionsHelp from '../../../help/deductionsHelp';
import { formatCurrency } from '../../../utils/currency';
import MobileExpensesWidget from '../../../components/MobileExpenses/MobileExpensesWidget';

const DeductionsForm = () => {
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

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('deductions')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back).
  // Reverse-map DB column names → form field names for the education expense group,
  // since buildDeductionsPayload renamed them on save.
  useEffect(() => {
    const savedData = contextFormData['deductions'];
    if (savedData && Object.keys(savedData).length > 0) {
      const normalized = {
        ...savedData,
        education_expense_deduction:     savedData.educational_expenses_amount         || 0,
        education_expense_children_count: savedData.educational_expenses_children_count || 0,
        education_expense_yn:            savedData.educational_expenses_yn             || '',
      };
      reset(normalized);
    }
  }, [contextFormData, reset]);

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Prior year pre-fill
  const { hasPriorData: hasPriorDed, applyPriorYear: applyPriorDed, dismissPriorYear: dismissPriorDed } = usePriorYearData('deductions', setValue);

  // ── Income threshold checks ──────────────────────────────────────────────────
  const incomeData = contextFormData['income'] || {};
  const taxableIncome =
    (parseFloat(incomeData.total_employment_income) || parseFloat(incomeData.annual_salary_wages_total) || 0)
    + (parseFloat(incomeData.other_income_no_min_tax_total) || 0);

  // DB-sourced thresholds (rate_type='deduction_threshold').
  //   prof_expenses_max_taxable_income  → Rs 1.5M income cap to qualify
  //   prof_expenses_pos_amount_pct      → 5% of POS amount
  //   prof_expenses_taxable_income_pct  → 25% of taxable income cap
  //   education_per_child_cap           → Rs 60,000 per child
  //   education_max_children            → 2 children max
  const dt = rates?.deductionThresholds;
  const PROF_EXP_THRESHOLD       = dt?.prof_expenses_max_taxable_income?.fixedAmount;
  const PROF_EXP_POS_PCT         = dt?.prof_expenses_pos_amount_pct?.rate;
  const PROF_EXP_TAXABLE_PCT     = dt?.prof_expenses_taxable_income_pct?.rate;
  const EDU_THRESHOLD            = dt?.education_max_taxable_income?.fixedAmount;
  const EDU_DEDUCTION_PER_CHILD  = dt?.education_per_child_cap?.fixedAmount;
  const EDU_MAX_CHILDREN         = dt?.education_max_children?.fixedAmount;

  const profExpEligible = PROF_EXP_THRESHOLD === undefined
    ? false
    : (taxableIncome === 0 || taxableIncome <= PROF_EXP_THRESHOLD);
  const eduExpEligible  = EDU_THRESHOLD === undefined
    ? false
    : (taxableIncome === 0 || taxableIncome <= EDU_THRESHOLD);

  // Professional expenses deduction: MIN(POS-pct × POS amount, taxable-pct × taxable income).
  useEffect(() => {
    if (!profExpEligible || taxableIncome <= 0) return;
    if (!PROF_EXP_POS_PCT || !PROF_EXP_TAXABLE_PCT) return; // wait for rates
    const posAmount = parseFloat(watchedValues.professional_expenses_pos_amount) || 0;
    if (posAmount > 0) {
      const posCapped     = Math.round(posAmount * PROF_EXP_POS_PCT);
      const incomeCapped  = Math.round(taxableIncome * PROF_EXP_TAXABLE_PCT);
      setValue('professional_expenses_amount', Math.min(posCapped, incomeCapped));
    }
  }, [watchedValues.professional_expenses_pos_amount, taxableIncome, profExpEligible, PROF_EXP_POS_PCT, PROF_EXP_TAXABLE_PCT]); // eslint-disable-line react-hooks/exhaustive-deps

  // Education expense: per-child cap × min(count, max-children).
  useEffect(() => {
    if (EDU_DEDUCTION_PER_CHILD === undefined || EDU_MAX_CHILDREN === undefined) return;
    if (!eduExpEligible) {
      setValue('education_expense_deduction', 0);
      return;
    }
    const numChildren = Math.min(
      parseInt(watchedValues.education_expense_children_count) || 0,
      EDU_MAX_CHILDREN
    );
    setValue('education_expense_deduction', numChildren * EDU_DEDUCTION_PER_CHILD);
  }, [watchedValues.education_expense_children_count, taxableIncome, eduExpEligible, EDU_DEDUCTION_PER_CHILD, EDU_MAX_CHILDREN]); // eslint-disable-line react-hooks/exhaustive-deps
  // ────────────────────────────────────────────────────────────────────────────

  // Define comprehensive deductible allowances structure matching Excel
  const deductionItems = [
    {
      id: 'professional_expenses',
      description: 'Professional expenses in respect of POS u/s 60C (taxable income ≤ Rs 1.5M only)',
      yesNo: 'Y',
      amount: 'professional_expenses_amount',
      limits: 'Lower of: 5% of POS amount OR 25% of taxable income',
      incomeThreshold: PROF_EXP_THRESHOLD,
      eligible: profExpEligible
    },
    {
      id: 'zakat_paid_ordinance',
      description: 'Zakat paid under the Zakat and Usher Ordinance — straight deduction',
      yesNo: 'Y',
      amount: 'zakat_paid_amount',
      limits: 'Full amount of Zakat paid (u/s 60)',
      eligible: true
    },
    {
      id: 'education_expense',
      description: 'Education expense deduction u/s 60D (taxable income ≤ Rs 1.5M; Rs 60,000 per child, max 2 children)',
      yesNo: 'Y',
      amount: 'education_expense_deduction',
      limits: 'Rs 60,000 × no. of children (max 2)',
      incomeThreshold: PROF_EXP_THRESHOLD,
      eligible: eduExpEligible,
      computed: true
    }
  ];

  // Additional limits/remarks from the Excel
  const limitsRemarks = [
    '25% of tax payable on his income from salary',
    'Tax shall not exceed 5% of such profit',
    '',
    '50% of the normal tax on capital gain',
    '75% of the normal tax on capital gain',
    '',
    '30% of the taxable income',
    '15% of the taxable income',
    '20% of the taxable income (2% per year for above 40 years if he joined at or above 41 years of age)',
    '',
    '',
    'Total education Expense',
    'No. of Children for whom tuition fee is paid'
  ];

  // Calculate total deduction
  const calculateTotalDeduction = () => {
    return deductionItems.reduce((total, item) => {
      return total + (parseFloat(watchedValues[item.amount]) || 0);
    }, 0);
  };

  const totalDeduction = calculateTotalDeduction();

  // Map frontend field names to DB column names and strip non-existent columns
  const buildDeductionsPayload = (data) => {
    const {
      // Strip non-DB field (used only for auto-calc, not persisted)
      professional_expenses_pos_amount: _posAmt,
      // Extract and rename to correct DB column names
      education_expense_deduction,
      education_expense_children_count,
      education_expense_yn,
      ...rest
    } = data;

    return {
      ...rest,
      educational_expenses_amount:        education_expense_deduction    || 0,
      educational_expenses_children_count: education_expense_children_count || 0,
      educational_expenses_yn:            education_expense_yn            || '',
      total_deduction_from_income:        totalDeduction,
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('deductions', buildDeductionsPayload(data), true);
    if (success) {
      toast.success('Deductible allowances information saved successfully');
      navigate('/income-tax/final-tax');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('deductions', buildDeductionsPayload(watchedValues), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/final-tax');
    }
  };
  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deductible Allowance</h1>
              <p className="text-gray-600">Enter eligible deductible allowances to reduce your taxable income</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Deductible Allowances Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Professional expenses</strong>: For taxpayers with POS 600 and taxable income ≤ Rs 1.5m</li>
              <li>• <strong>Zakat deduction</strong>: Special straight deduction for Zakat paid under Zakat and Usher Ordinance</li>
              <li>• <strong>Calculation</strong>: 5% of amount paid OR 25% of taxable income (whichever is lower)</li>
              <li>• <strong>Deductible allowances</strong> reduce your taxable income before tax calculation</li>
            </ul>
          </div>
        )}
      </div>

      {hasPriorDed && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm text-indigo-800">Prior year deduction data available — apply to pre-fill?</span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={dismissPriorDed} className="text-xs px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100">Dismiss</button>
            <button type="button" onClick={applyPriorDed} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">Apply Prior Year Data</button>
          </div>
        </div>
      )}

      {/* Mobile-captured expenses for this tax year. Zakat is the only direct
          deduction field; the rest are surfaced so the user knows about them
          and can copy to the right form (credits, etc.). */}
      <MobileExpensesWidget
        taxYear={currentTaxYear || '2025-26'}
        setValue={setValue}
        fieldMap={{
          zakat: { field: 'zakat_paid_amount', yn: 'zakat_paid_yn' },
        }}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Column Headers */}
        <div className="bg-orange-600 text-white rounded-lg">
          <div className="grid grid-cols-12 gap-3 items-center py-3 px-4 font-semibold">
            <div className="col-span-6">Description</div>
            <div className="col-span-1 text-center">Y/N</div>
            <div className="col-span-2 text-center">Amount</div>
            <div className="col-span-3 text-center">Limits/Remarks</div>
          </div>
        </div>

        {/* Deductible Allowance Section */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Deductible Allowance
          </h2>

          {/* Income context banner */}
          {taxableIncome > 0 && (
            <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              Taxable income from Income form: <strong>{formatCurrency(taxableIncome)}</strong>.
              {taxableIncome > PROF_EXP_THRESHOLD && (
                <span className="text-amber-700 ml-2">Professional expenses &amp; education deduction not applicable (income exceeds Rs 1.5M threshold).</span>
              )}
            </div>
          )}

          {deductionItems.map((item) => (
            <div key={item.id} className={`grid grid-cols-12 gap-3 items-start py-3 border-b border-orange-200 last:border-b-0 ${!item.eligible && taxableIncome > 0 ? 'opacity-40' : ''}`}>
              <div className="col-span-6">
                <p className="text-sm font-medium text-gray-700">
                  {item.description}
                  <HelpHint fieldId={item.id} source={deductionsHelp} />
                </p>
                {/* Professional expenses: show POS amount input for auto-calc */}
                {item.id === 'professional_expenses' && item.eligible && (
                  <div className="mt-2">
                    <label className="text-xs text-gray-500">
                      Total POS payments (for auto-calc)
                      <HelpHint fieldId="professional_expenses_pos_amount" source={deductionsHelp} />
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register('professional_expenses_pos_amount', { valueAsNumber: true })}
                      className="mt-1 form-input w-full px-2 py-1 border border-gray-300 rounded text-right text-xs"
                      placeholder="Enter total POS amount paid"
                    />
                    {(() => {
                      const pos = parseFloat(watchedValues.professional_expenses_pos_amount) || 0;
                      if (pos > 0 && taxableIncome > 0 && PROF_EXP_POS_PCT && PROF_EXP_TAXABLE_PCT) {
                        const a = Math.round(pos * PROF_EXP_POS_PCT);
                        const b = Math.round(taxableIncome * PROF_EXP_TAXABLE_PCT);
                        const posPctDisplay = (PROF_EXP_POS_PCT * 100).toFixed(0);
                        const taxPctDisplay = (PROF_EXP_TAXABLE_PCT * 100).toFixed(0);
                        return (
                          <p className="text-xs text-emerald-700 mt-0.5">
                            Auto: MIN({posPctDisplay}% of Rs {pos.toLocaleString('en-PK')} = Rs {a.toLocaleString('en-PK')},
                            {' '}{taxPctDisplay}% of income = Rs {b.toLocaleString('en-PK')}) = Rs {Math.min(a, b).toLocaleString('en-PK')}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
                {/* Education: show number-of-children input */}
                {item.id === 'education_expense' && item.eligible && (
                  <div className="mt-2">
                    <label className="text-xs text-gray-500">
                      Number of children (max 2)
                      <HelpHint fieldId="education_expense_children_count" source={deductionsHelp} />
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="2"
                      {...register('education_expense_children_count', { valueAsNumber: true, min: 0, max: 2 })}
                      className="mt-1 form-input w-48 px-2 py-1 border border-gray-300 rounded text-right text-xs"
                      placeholder="0"
                    />
                  </div>
                )}
                {!item.eligible && taxableIncome > 0 && (
                  <p className="text-xs text-amber-600 mt-1">Not applicable — taxable income exceeds Rs 1.5M</p>
                )}
              </div>
              <div className="col-span-1 text-center">
                <select
                  {...register(`${item.id}_yn`)}
                  className="form-select w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  disabled={!item.eligible && taxableIncome > 0}
                >
                  <option value="">-</option>
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.amount, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={`${inputClasses} ${item.computed ? 'bg-emerald-50 border-emerald-300' : ''}`}
                  placeholder="0"
                  readOnly={item.computed}
                  title={item.computed ? 'Auto-calculated' : undefined}
                />
                {item.computed && (
                  <p className="mt-0.5 text-xs text-emerald-700">Auto-calculated</p>
                )}
                {errors[item.amount] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.amount].message}</p>
                )}
              </div>
              <div className="col-span-3">
                <p className="text-xs text-gray-600 p-2 bg-gray-50 rounded border">{item.limits}</p>
              </div>
            </div>
          ))}

          {/* Total Deduction */}
          <div className="grid grid-cols-12 gap-3 items-center py-4 mt-4 bg-orange-100 rounded-lg px-4 font-semibold">
            <div className="col-span-6">
              <p className="text-orange-800">Total Deduction from Income</p>
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-2 text-right">
              <p className="text-xl font-bold text-orange-800">{formatCurrency(totalDeduction)}</p>
            </div>
            <div className="col-span-3"></div>
          </div>
        </div>

        {/* Additional Limits/Remarks Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Limits/Remarks
          </h2>
          
          <div className="grid grid-cols-1 gap-2">
            {limitsRemarks.map((remark, index) => (
              <div key={index} className="py-2 border-b border-blue-100 last:border-b-0">
                <p className="text-sm text-blue-800">{remark || '—'}</p>
              </div>
            ))}
          </div>

          {/* Special Notes */}
          <div className="mt-6 p-4 bg-blue-100 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Special Notes:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Total education Expense</strong></li>
              <li>• <strong>No. of Children for whom tuition fee is paid</strong></li>
            </ul>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/income-tax/credits')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Tax Credits
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

export default DeductionsForm;