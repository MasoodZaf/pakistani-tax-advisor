import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Calculator,
  Zap,
  Phone,
  Car,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdjustableTaxForm = () => {
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
    defaultValues: getStepData('adjustable_tax')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate total adjustable tax
  const calculateTotal = (values) => {
    return [
      'profit_on_debt_tax',
      'electricity_tax',
      'phone_tax', 
      'vehicle_tax',
      'other_tax'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);
  };

  const totalAdjustableTax = calculateTotal(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_adjustable_tax: totalAdjustableTax
    };

    const success = await saveFormStep('adjustable_tax', formData, true);
    if (success) {
      toast.success('Adjustable tax information saved successfully');
      navigate('/tax-forms/reductions');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_adjustable_tax: totalAdjustableTax
    };

    const success = await saveFormStep('adjustable_tax', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/reductions');
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
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Adjustable Tax</h1>
              <p className="text-gray-600">Enter withholding taxes and advance payments already made</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Adjustable Tax Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Include taxes deducted at source on profit on debt securities</li>
              <li>• Enter withholding tax on electricity bills exceeding PKR 25,000</li>
              <li>• Include withholding tax on phone bills exceeding PKR 3,000</li>
              <li>• Enter advance tax on vehicles if applicable</li>
              <li>• These taxes can be adjusted against your final tax liability</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Profit on Debt Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-primary-600" />
            Profit on Debt Securities
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Profit on Debt Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('profit_on_debt', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.profit_on_debt && (
                <p className="mt-1 text-sm text-red-600">{errors.profit_on_debt.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Deducted on Profit (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('profit_on_debt_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.profit_on_debt_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.profit_on_debt_tax.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Utility Bills Section */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-600" />
            Utility Bills Withholding Tax
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Electricity Bill Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('electricity_bill', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-yellow-600">Withholding tax applicable on bills > PKR 25,000</p>
              {errors.electricity_bill && (
                <p className="mt-1 text-sm text-red-600">{errors.electricity_bill.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Electricity Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('electricity_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.electricity_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.electricity_tax.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Phone Bill Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('phone_bill', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-yellow-600">Withholding tax applicable on bills > PKR 3,000</p>
              {errors.phone_bill && (
                <p className="mt-1 text-sm text-red-600">{errors.phone_bill.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Phone Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('phone_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.phone_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.phone_tax.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Vehicle & Other Tax Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Car className="w-5 h-5 mr-2 text-green-600" />
            Vehicle & Other Advance Tax
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Vehicle Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('vehicle_amount', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.vehicle_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.vehicle_amount.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Vehicle Tax Paid (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('vehicle_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.vehicle_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.vehicle_tax.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className={labelClasses}>
                Other Adjustable Tax (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">Include any other withholding/advance tax paid</p>
              {errors.other_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.other_tax.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Adjustable Tax Summary</h2>
          <div className="text-center">
            <p className="text-sm text-primary-700 mb-2">Total Adjustable Tax</p>
            <p className="text-2xl font-bold text-primary-900">{formatCurrency(totalAdjustableTax)}</p>
            <p className="text-xs text-primary-600 mt-1">This amount will be adjusted against your final tax liability</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/income')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Income
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

export default AdjustableTaxForm;