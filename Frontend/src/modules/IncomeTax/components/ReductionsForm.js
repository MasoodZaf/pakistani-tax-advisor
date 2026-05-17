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
  TrendingDown,
  GraduationCap,
  Building,
  Info,
  Users,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import reductionsHelp from '../../../help/reductionsHelp';
import { formatCurrency } from '../../../utils/currency';

const ReductionsForm = () => {
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

  // DB-sourced reduction rates (rate_type='reduction' in tax_rates_config).
  const teacherReductionRate = rates?.reductions?.teacher_researcher?.rate;
  const behboodMaxRate       = rates?.reductions?.behbood_certificate_max_rate?.rate;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('reductions')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back).
  // Reverse-map DB column names → form field names for capital gain reductions,
  // since buildReductionsPayload renamed them on save.
  useEffect(() => {
    const savedData = contextFormData['reductions'];
    if (savedData && Object.keys(savedData).length > 0) {
      const normalized = {
        ...savedData,
        capital_gain_immovable_tax_reduction: savedData.capital_gain_immovable_50_reduction || 0,
        capital_gain_clause9a_tax_reduction:  savedData.capital_gain_immovable_75_reduction  || 0,
      };
      reset(normalized);
    }
  }, [contextFormData, reset]);

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Prior year pre-fill
  const { hasPriorData: hasPriorRed, applyPriorYear: applyPriorRed, dismissPriorYear: dismissPriorRed } = usePriorYearData('reductions', setValue);

  // Teacher/researcher reduction (u/s 100C). Rate sourced from DB
  // (tax_rates_config.rate_type='reduction', rate_category='teacher_researcher').
  //
  // Prefer the explicit `salary_u_s_12_7_tax_chargeable` from the Final/Min
  // form (matches what FBR records). When that form hasn't been visited yet,
  // fall back to the slab-walk × (salary / total taxable income) share so
  // the rebate isn't silently dropped to zero for a salaried teacher who
  // never opens the Final/Min form.
  useEffect(() => {
    if (watchedValues.teacher_researcher_reduction_yn !== 'Y') return;
    if (!teacherReductionRate) return; // wait for rates

    const finalMinData = contextFormData['final_min_income'] || {};
    let salaryTax = parseFloat(finalMinData.salary_u_s_12_7_tax_chargeable) ||
                    parseFloat(finalMinData.salary_tax_chargeable) ||
                    parseFloat(finalMinData.salary_employees_tax_chargeable) || 0;

    // Fallback: derive salary tax from income context + slab walk.
    if (salaryTax === 0) {
      const incomeData = contextFormData['income'] || {};
      const salary = parseFloat(incomeData.total_employment_income) ||
                     parseFloat(incomeData.annual_salary_wages_total) || 0;
      const otherTaxable = parseFloat(incomeData.other_income_no_min_tax_total) || 0;
      const totalTaxable = salary + otherTaxable;
      if (totalTaxable > 0 && rates?.slabs?.length) {
        let totalTax = 0;
        for (const s of rates.slabs) {
          const minI = Number(s.min_income), maxI = s.max_income == null ? Infinity : Number(s.max_income);
          const rate = Number(s.tax_rate);
          const lower = minI > 0 ? minI - 1 : 0;
          if (totalTaxable <= lower) continue;
          const ceil = Math.min(totalTaxable, maxI);
          if (ceil - lower > 0 && rate > 0) totalTax += (ceil - lower) * rate;
        }
        const salaryShare = salary / totalTaxable;
        salaryTax = Math.round(totalTax * salaryShare);
      }
    }

    if (salaryTax > 0) {
      const reduction = Math.round(salaryTax * teacherReductionRate);
      const current = parseFloat(watchedValues.teacher_researcher_tax_reduction) || 0;
      if (Math.abs(current - reduction) > 0.5) {
        setValue('teacher_researcher_tax_reduction', reduction);
      }
    }
  }, [watchedValues.teacher_researcher_reduction_yn, contextFormData, teacherReductionRate, rates, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Behbood certificate cap (2nd Sched Pt III cl.6) — tax not to exceed the
  // DB-sourced rate × profit amount.
  useEffect(() => {
    if (watchedValues.behbood_certificates_reduction_yn !== 'Y') return;
    if (!behboodMaxRate) return;

    const profitAmount = parseFloat(watchedValues.behbood_certificates_amount) || 0;
    if (profitAmount <= 0) return;

    const maxTax = Math.round(profitAmount * behboodMaxRate);
    const current = parseFloat(watchedValues.behbood_certificates_tax_reduction) || 0;
    if (current === 0) {
      setValue('behbood_certificates_tax_reduction', maxTax);
    }
  }, [watchedValues.behbood_certificates_reduction_yn, watchedValues.behbood_certificates_amount, behboodMaxRate, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Define comprehensive tax reduction structure matching Excel
  const reductionItems = [
    {
      id: 'teacher_researcher_reduction',
      description: 'Tax Reduction for Full Time Teacher / Researcher (Except teachers of medical professionals who derive income from private medical practice)',
      yesNo: 'Y',
      amount: 'teacher_researcher_amount',
      taxReduction: 'teacher_researcher_tax_reduction',
      limits: '25% of tax payable on salary income — auto-calculated when Y selected',
      autoCalc: true
    },
    {
      id: 'behbood_certificates_reduction',
      description: 'Tax Reduction on Charged on Behbood Certificates / Pensioner\'s Benefit Account in excess of applicable rate',
      yesNo: 'Y',
      amount: 'behbood_certificates_amount',
      taxReduction: 'behbood_certificates_tax_reduction',
      limits: 'Tax shall not exceed 5% of profit — auto-calculated when amount entered',
      autoCalc: true
    },
    {
      id: 'capital_gain_immovable_reduction',
      description: 'Tax Reduction on Capital Gain on Immovable Property under clause (9A), Part II, Second Schedule for Ex-Servicemen and serving personnel of Armed Forces and ex-employees and serving personnel of Federal & Provincial Government @50%',
      yesNo: 'Y',
      amount: 'capital_gain_immovable_amount',
      taxReduction: 'capital_gain_immovable_tax_reduction',
      limits: '50% of the normal tax on capital gain'
    },
    {
      id: 'capital_gain_clause9a_reduction',
      description: 'Tax Reduction on Capital Gain on Immovable Property under clause (9A), Part III, Second Schedule for Ex-Servicemen and serving personnel of Armed Forces and ex-employees and serving personnel of Federal & Provincial Government @75%',
      yesNo: 'Y',
      amount: 'capital_gain_clause9a_amount',
      taxReduction: 'capital_gain_clause9a_tax_reduction',
      limits: '75% of the normal tax on capital gain'
    }
  ];

  // Calculate total tax reduction
  const calculateTotalReduction = () => {
    return reductionItems.reduce((total, item) => {
      return total + (parseFloat(watchedValues[item.taxReduction]) || 0);
    }, 0);
  };

  const totalReduction = calculateTotalReduction();

  // Map frontend field names to DB column names and strip non-existent columns
  const buildReductionsPayload = (data) => {
    const {
      // Strip fields not in DB schema
      capital_gain_immovable_amount: _cgImmoAmt,
      capital_gain_clause9a_amount: _cg9aAmt,
      capital_gain_immovable_reduction_yn: _cgImmoYN,
      capital_gain_clause9a_reduction_yn: _cg9aYN,
      // Extract and rename to correct DB column names
      capital_gain_immovable_tax_reduction,
      capital_gain_clause9a_tax_reduction,
      ...rest
    } = data;

    return {
      ...rest,
      capital_gain_immovable_50_reduction: capital_gain_immovable_tax_reduction || 0,
      capital_gain_immovable_75_reduction: capital_gain_clause9a_tax_reduction || 0,
      total_tax_reductions: totalReduction,  // DB column is plural (total_tax_reductions)
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('reductions', buildReductionsPayload(data), true);
    if (success) {
      toast.success('Tax reductions information saved successfully');
      navigate('/income-tax/credits');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('reductions', buildReductionsPayload(watchedValues), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/credits');
    }
  };
  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Reduction, Credit and Deductible Allowances</h1>
              <p className="text-gray-600">Enter eligible tax reductions to reduce your tax liability</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Tax Reductions Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Special straight deduction</strong> is available for Zakat paid under the Zakat and Usher Ordinance</li>
              <li>• <strong>Rebate at average rate</strong> of tax is allowed on donations made to approved non-profit organisations</li>
              <li>• <strong>Donation limit</strong>: Lower of donation value and 30% of taxable income</li>
              <li>• <strong>Associate donations</strong>: Restricted to 15% of taxable income</li>
              <li>• <strong>Tax reductions</strong> directly reduce your calculated tax liability</li>
            </ul>
          </div>
        )}
      </div>

      {hasPriorRed && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm text-indigo-800">Prior year reduction data available — apply to pre-fill?</span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={dismissPriorRed} className="text-xs px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100">Dismiss</button>
            <button type="button" onClick={applyPriorRed} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">Apply Prior Year Data</button>
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
            <div className="col-span-2 text-center">Tax Reduction</div>
            <div className="col-span-2 text-center">Limits/Remarks</div>
          </div>
        </div>

        {/* Tax Reduction Section */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
            <TrendingDown className="w-5 h-5 mr-2" />
            Tax Reduction
          </h2>

          {reductionItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center py-3 border-b border-green-200 last:border-b-0">
              <div className="col-span-5">
                <p className="text-sm font-medium text-gray-700">
                  {item.description}
                  <HelpHint fieldId={item.id} source={reductionsHelp} />
                </p>
              </div>
              <div className="col-span-1 text-center">
                <select
                  {...register(`${item.id}_yn`)}
                  className="form-select w-full px-2 py-1 border border-gray-300 rounded text-sm"
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
                  className={`${inputClasses} ${item.autoCalc ? 'bg-green-50 border-green-300' : ''}`}
                  placeholder="0"
                  title={item.autoCalc ? 'Auto-calculated — editable' : undefined}
                />
                {item.autoCalc && (parseFloat(watchedValues[item.taxReduction]) || 0) > 0 && (
                  <p className="mt-0.5 text-xs text-green-700">Auto-calculated</p>
                )}
                {errors[item.taxReduction] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.taxReduction].message}</p>
                )}
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-600 p-2 bg-gray-50 rounded border">{item.limits}</p>
              </div>
            </div>
          ))}

          {/* Total Tax Reduction */}
          <div className="grid grid-cols-12 gap-3 items-center py-4 mt-4 bg-green-100 rounded-lg px-4 font-semibold">
            <div className="col-span-5">
              <p className="text-green-800">Total Tax Reduction</p>
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-2"></div>
            <div className="col-span-2 text-right">
              <p className="text-xl font-bold text-green-800">{formatCurrency(totalReduction)}</p>
            </div>
            <div className="col-span-2"></div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/income-tax/adjustable-tax')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Adjustable Tax
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

export default ReductionsForm;