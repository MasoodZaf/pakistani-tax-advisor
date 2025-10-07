import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  CreditCard,
  Calculator,
  FileText,
  Info,
  Users,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

const DeductionsForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    formState: { errors } 
  } = useForm({
    defaultValues: getStepData('deductions')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Define comprehensive deductible allowances structure matching Excel
  const deductionItems = [
    {
      id: 'professional_expenses',
      description: 'Professional expenses in respect of POS 600 if available to taxpayer with taxable income not exceeding Rs 1.5m per year (5% of the amount paid OR 25% of the taxable income after adjustment whichever is lower)',
      yesNo: 'Y',
      amount: 'professional_expenses_amount',
      limits: 'Total deduction from income'
    },
    {
      id: 'zakat_paid_ordinance',
      description: 'Zakat paid under the Zakat and Usher Ordinance',
      yesNo: 'Y',
      amount: 'zakat_paid_amount',
      limits: 'Total education Expense'
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

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_deduction_from_income: totalDeduction
    };

    const success = await saveFormStep('deductions', formData, true);
    if (success) {
      toast.success('Deductible allowances information saved successfully');
      navigate('/tax-forms/final_tax');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_deduction_from_income: totalDeduction
    };

    const success = await saveFormStep('deductions', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/final_tax');
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

          {deductionItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center py-3 border-b border-orange-200 last:border-b-0">
              <div className="col-span-6">
                <p className="text-sm font-medium text-gray-700">{item.description}</p>
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
            onClick={() => navigate('/tax-forms/credits')}
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