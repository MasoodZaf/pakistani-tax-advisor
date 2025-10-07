import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Building2,
  Trophy,
  DollarSign,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const FinalTaxForm = () => {
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
    defaultValues: getStepData('final_tax')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate tax amounts and totals
  const calculateTaxAmounts = (values) => {
    const sukukTax = (parseFloat(values.sukuk_amount) || 0) * (parseFloat(values.sukuk_tax_rate) || 0.10);
    const debtTax = (parseFloat(values.debt_amount) || 0) * (parseFloat(values.debt_tax_rate) || 0.15);
    const prizeBondsTax = parseFloat(values.prize_bonds_tax) || 0;
    const otherFinalTax = parseFloat(values.other_final_tax) || 0;
    
    const totalFinalTax = sukukTax + debtTax + prizeBondsTax + otherFinalTax;
    
    return {
      sukukTax,
      debtTax,
      prizeBondsTax,
      otherFinalTax,
      totalFinalTax
    };
  };

  const taxAmounts = calculateTaxAmounts(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      sukuk_tax_amount: taxAmounts.sukukTax,
      debt_tax_amount: taxAmounts.debtTax,
      total_final_tax: taxAmounts.totalFinalTax
    };

    const success = await saveFormStep('final_tax', formData, true);
    if (success) {
      toast.success('Final tax information saved successfully');
      navigate('/tax-forms/capital_gain');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      sukuk_tax_amount: taxAmounts.sukukTax,
      debt_tax_amount: taxAmounts.debtTax,
      total_final_tax: taxAmounts.totalFinalTax
    };

    const success = await saveFormStep('final_tax', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/capital_gain');
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

  const formatPercentage = (value) => {
    return `${((value || 0) * 100).toFixed(2)}%`;
  };

  const inputClasses = "form-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right";
  const labelClasses = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Final Tax</h1>
              <p className="text-gray-600">Enter income subject to final tax (Sukuk, bonds, prizes)</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Final Tax Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Sukuk income: Subject to 10% final tax</li>
              <li>• Debt securities: Subject to 15% final tax</li>
              <li>• Prize bonds: Income from prize bond winnings</li>
              <li>• Final tax means this income is not included in total income calculation</li>
              <li>• Tax rates are automatically calculated based on current regulations</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Sukuk Income Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-green-600" />
            Sukuk Income
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Sukuk Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('sukuk_amount', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.sukuk_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.sukuk_amount.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Rate
              </label>
              <input
                type="number"
                step="0.0001"
                max="1"
                {...register('sukuk_tax_rate')}
                className={inputClasses}
                placeholder="0.10"
              />
              <p className="mt-1 text-xs text-green-600">Default: 10%</p>
            </div>

            <div>
              <label className={labelClasses}>
                Calculated Tax
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-right font-medium">
                {formatCurrency(taxAmounts.sukukTax)}
              </div>
              <p className="mt-1 text-xs text-green-600">
                Rate: {formatPercentage(watchedValues.sukuk_tax_rate || 0.10)}
              </p>
            </div>
          </div>
        </div>

        {/* Debt Securities Section */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Debt Securities Income
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Debt Securities Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('debt_amount', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.debt_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.debt_amount.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Rate
              </label>
              <input
                type="number"
                step="0.0001"
                max="1"
                {...register('debt_tax_rate')}
                className={inputClasses}
                placeholder="0.15"
              />
              <p className="mt-1 text-xs text-blue-600">Default: 15%</p>
            </div>

            <div>
              <label className={labelClasses}>
                Calculated Tax
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-right font-medium">
                {formatCurrency(taxAmounts.debtTax)}
              </div>
              <p className="mt-1 text-xs text-blue-600">
                Rate: {formatPercentage(watchedValues.debt_tax_rate || 0.15)}
              </p>
            </div>
          </div>
        </div>

        {/* Prize Bonds & Other Section */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
            Prize Bonds & Other Final Tax
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Prize Bonds Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('prize_bonds', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.prize_bonds && (
                <p className="mt-1 text-sm text-red-600">{errors.prize_bonds.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Prize Bonds Tax (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('prize_bonds_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.prize_bonds_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.prize_bonds_tax.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Other Final Tax Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_final_tax_amount', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_final_tax_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.other_final_tax_amount.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Other Final Tax (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_final_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_final_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.other_final_tax.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Final Tax Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Sukuk Tax</p>
              <p className="text-lg font-bold text-primary-900">{formatCurrency(taxAmounts.sukukTax)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Debt Tax</p>
              <p className="text-lg font-bold text-primary-900">{formatCurrency(taxAmounts.debtTax)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Other Final Tax</p>
              <p className="text-lg font-bold text-primary-900">
                {formatCurrency(taxAmounts.prizeBondsTax + taxAmounts.otherFinalTax)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Total Final Tax</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(taxAmounts.totalFinalTax)}</p>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/deductions')}
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