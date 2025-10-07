import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
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

const ReductionsForm = () => {
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
    defaultValues: getStepData('reductions')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Define comprehensive tax reduction structure matching Excel
  const reductionItems = [
    {
      id: 'teacher_researcher_reduction',
      description: 'Tax Reduction for Full Time Teacher / Researcher (Except teachers of medical professionals who derive income from private medical practice)',
      yesNo: 'Y',
      amount: 'teacher_researcher_amount',
      taxReduction: 'teacher_researcher_tax_reduction',
      limits: '25% of tax payable on his income from salary'
    },
    {
      id: 'behbood_certificates_reduction',
      description: 'Tax Reduction on Charged on Behbood Certificates / Pensioner\'s Benefit Account in excess of applicable rate',
      yesNo: 'Y',
      amount: 'behbood_certificates_amount',
      taxReduction: 'behbood_certificates_tax_reduction',
      limits: 'Tax shall not exceed 5% of such profit'
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

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_tax_reduction: totalReduction
    };

    const success = await saveFormStep('reductions', formData, true);
    if (success) {
      toast.success('Tax reductions information saved successfully');
      navigate('/tax-forms/credits');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_tax_reduction: totalReduction
    };

    const success = await saveFormStep('reductions', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/credits');
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
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.taxReduction, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={inputClasses}
                  placeholder="0"
                />
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
            onClick={() => navigate('/tax-forms/adjustable_tax')}
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