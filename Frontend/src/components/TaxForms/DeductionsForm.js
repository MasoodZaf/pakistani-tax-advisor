import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  CreditCard,
  DollarSign,
  Globe,
  Calculator,
  Info
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

  // Auto-calculate total deductions
  const calculateTotal = (values) => {
    return [
      'zakat',
      'ushr',
      'tax_paid_foreign_country',
      'advance_tax',
      'other_deductions'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);
  };

  const totalDeductions = calculateTotal(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_deductions: totalDeductions
    };

    const success = await saveFormStep('deductions', formData, true);
    if (success) {
      toast.success('Tax deductions information saved successfully');
      navigate('/tax-forms/final_tax');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_deductions: totalDeductions
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

  const inputClasses = "form-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right";
  const labelClasses = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Deductions</h1>
              <p className="text-gray-600">Enter advance tax, foreign tax credits, and other deductions</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Tax Deductions Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Zakat: Religious obligation paid on wealth and income</li>
              <li>• Ushr: Agricultural produce tax (1/10th or 1/20th)</li>
              <li>• Foreign tax: Tax paid in foreign countries (for foreign income)</li>
              <li>• Advance tax: Tax paid in advance during the tax year</li>
              <li>• These deductions reduce your final tax liability</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Religious Obligations Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-green-600" />
            Religious Obligations
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Zakat Paid (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('zakat', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">
                2.5% of eligible wealth and savings
              </p>
              {errors.zakat && (
                <p className="mt-1 text-sm text-red-600">{errors.zakat.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Ushr Paid (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('ushr', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">
                Agricultural produce tax (1/10th or 1/20th)
              </p>
              {errors.ushr && (
                <p className="mt-1 text-sm text-red-600">{errors.ushr.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Foreign Tax Credit Section */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-blue-600" />
            Foreign Tax Credit
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Tax Paid in Foreign Country (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('tax_paid_foreign_country', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-blue-600">
                Tax paid abroad on foreign income (eligible for credit)
              </p>
              {errors.tax_paid_foreign_country && (
                <p className="mt-1 text-sm text-red-600">{errors.tax_paid_foreign_country.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Advance Tax Section */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-yellow-600" />
            Advance Tax Payments
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Advance Tax Paid (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('advance_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-yellow-600">
                Tax paid in advance during the tax year
              </p>
              {errors.advance_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.advance_tax.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Other Deductions Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Other Deductions
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Other Deductions (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_deductions', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-600">
                Any other eligible tax deductions
              </p>
              {errors.other_deductions && (
                <p className="mt-1 text-sm text-red-600">{errors.other_deductions.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Tax Deductions Summary</h2>
          <div className="text-center">
            <p className="text-sm text-primary-700 mb-2">Total Tax Deductions</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDeductions)}</p>
            <p className="text-xs text-primary-600 mt-1">
              These deductions reduce your final tax liability
            </p>
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
            Previous: Credits
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