import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Home,
  TrendingUp,
  Building,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const CapitalGainsForm = () => {
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
    defaultValues: getStepData('capital_gain')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate tax amounts and totals
  const calculateCapitalGains = (values) => {
    // Property 1 year
    const property1YearTax = (parseFloat(values.property_1_year) || 0) * 
                            (parseFloat(values.property_1_year_tax_rate) || 0.15);
    const property1YearDue = property1YearTax - (parseFloat(values.property_1_year_tax_deducted) || 0);

    // Property 2-3 years
    const property2_3YearsTax = (parseFloat(values.property_2_3_years) || 0) * 
                               (parseFloat(values.property_2_3_years_tax_rate) || 0.10);
    const property2_3YearsDue = property2_3YearsTax - (parseFloat(values.property_2_3_years_tax_deducted) || 0);

    // Property 4+ years (no tax)
    const property4PlusAmount = parseFloat(values.property_4_plus_years) || 0;
    const property4PlusDue = 0 - (parseFloat(values.property_4_plus_years_tax_deducted) || 0);

    // Securities
    const securitiesTax = (parseFloat(values.securities) || 0) * 
                         (parseFloat(values.securities_tax_rate) || 0.125);
    const securitiesDue = securitiesTax - (parseFloat(values.securities_tax_deducted) || 0);

    // Other
    const otherAmount = parseFloat(values.other_capital_gains) || 0;
    const otherTax = parseFloat(values.other_capital_gains_tax) || 0;

    // Totals
    const totalGains = (parseFloat(values.property_1_year) || 0) +
                      (parseFloat(values.property_2_3_years) || 0) +
                      property4PlusAmount +
                      (parseFloat(values.securities) || 0) +
                      otherAmount;

    const totalTax = property1YearTax + property2_3YearsTax + securitiesTax + otherTax;
    const totalDue = property1YearDue + property2_3YearsDue + property4PlusDue + securitiesDue;

    return {
      property1YearTax,
      property1YearDue,
      property2_3YearsTax,
      property2_3YearsDue,
      property4PlusDue,
      securitiesTax,
      securitiesDue,
      totalGains,
      totalTax,
      totalDue
    };
  };

  const calculations = calculateCapitalGains(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      property_1_year_tax_due: calculations.property1YearDue,
      property_2_3_years_tax_due: calculations.property2_3YearsDue,
      securities_tax_due: calculations.securitiesDue,
      total_capital_gains: calculations.totalGains,
      total_capital_gains_tax: calculations.totalTax
    };

    const success = await saveFormStep('capital_gain', formData, true);
    if (success) {
      toast.success('Capital gains information saved successfully');
      navigate('/tax-forms/expenses');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      property_1_year_tax_due: calculations.property1YearDue,
      property_2_3_years_tax_due: calculations.property2_3YearsDue,
      securities_tax_due: calculations.securitiesDue,
      total_capital_gains: calculations.totalGains,
      total_capital_gains_tax: calculations.totalTax
    };

    const success = await saveFormStep('capital_gain', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/expenses');
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
    return `${((value || 0) * 100).toFixed(1)}%`;
  };

  const inputClasses = "form-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right";
  const labelClasses = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Home className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Capital Gains</h1>
              <p className="text-gray-600">Enter capital gains from property and securities transactions</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Capital Gains Tax Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Property held ≤1 year: 15% tax</li>
              <li>• Property held 2-3 years: 10% tax</li>
              <li>• Property held 4+ years: 0% tax (exempt)</li>
              <li>• Securities: 12.5% tax</li>
              <li>• Enter any tax already deducted at source</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Property 1 Year Section */}
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Home className="w-5 h-5 mr-2 text-red-600" />
            Property Held ≤ 1 Year (15% Tax)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className={labelClasses}>
                Gain Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('property_1_year', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.property_1_year && (
                <p className="mt-1 text-sm text-red-600">{errors.property_1_year.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Rate
              </label>
              <input
                type="number"
                step="0.001"
                {...register('property_1_year_tax_rate')}
                className={inputClasses}
                placeholder="0.15"
              />
              <p className="mt-1 text-xs text-red-600">Default: 15%</p>
            </div>

            <div>
              <label className={labelClasses}>
                Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('property_1_year_tax_deducted', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
            </div>

            <div>
              <label className={labelClasses}>
                Tax Due
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-right font-medium">
                {formatCurrency(calculations.property1YearDue)}
              </div>
            </div>
          </div>
        </div>

        {/* Property 2-3 Years Section */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Home className="w-5 h-5 mr-2 text-yellow-600" />
            Property Held 2-3 Years (10% Tax)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className={labelClasses}>
                Gain Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('property_2_3_years', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.property_2_3_years && (
                <p className="mt-1 text-sm text-red-600">{errors.property_2_3_years.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Rate
              </label>
              <input
                type="number"
                step="0.001"
                {...register('property_2_3_years_tax_rate')}
                className={inputClasses}
                placeholder="0.10"
              />
              <p className="mt-1 text-xs text-yellow-600">Default: 10%</p>
            </div>

            <div>
              <label className={labelClasses}>
                Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('property_2_3_years_tax_deducted', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
            </div>

            <div>
              <label className={labelClasses}>
                Tax Due
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-right font-medium">
                {formatCurrency(calculations.property2_3YearsDue)}
              </div>
            </div>
          </div>
        </div>

        {/* Property 4+ Years Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Home className="w-5 h-5 mr-2 text-green-600" />
            Property Held 4+ Years (0% Tax - Exempt)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClasses}>
                Gain Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('property_4_plus_years', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.property_4_plus_years && (
                <p className="mt-1 text-sm text-red-600">{errors.property_4_plus_years.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('property_4_plus_years_tax_deducted', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">Refundable if deducted</p>
            </div>

            <div>
              <label className={labelClasses}>
                Tax Due/Refund
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-right font-medium">
                {formatCurrency(calculations.property4PlusDue)}
              </div>
            </div>
          </div>
        </div>

        {/* Securities Section */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Securities (12.5% Tax)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className={labelClasses}>
                Gain Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('securities', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.securities && (
                <p className="mt-1 text-sm text-red-600">{errors.securities.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Tax Rate
              </label>
              <input
                type="number"
                step="0.001"
                {...register('securities_tax_rate')}
                className={inputClasses}
                placeholder="0.125"
              />
              <p className="mt-1 text-xs text-blue-600">Default: 12.5%</p>
            </div>

            <div>
              <label className={labelClasses}>
                Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('securities_tax_deducted', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
            </div>

            <div>
              <label className={labelClasses}>
                Tax Due
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-right font-medium">
                {formatCurrency(calculations.securitiesDue)}
              </div>
            </div>
          </div>
        </div>

        {/* Other Capital Gains Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Building className="w-5 h-5 mr-2 text-gray-600" />
            Other Capital Gains
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Other Gains Amount (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_capital_gains', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_capital_gains && (
                <p className="mt-1 text-sm text-red-600">{errors.other_capital_gains.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Other Gains Tax (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_capital_gains_tax', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_capital_gains_tax && (
                <p className="mt-1 text-sm text-red-600">{errors.other_capital_gains_tax.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Capital Gains Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Total Capital Gains</p>
              <p className="text-xl font-bold text-primary-900">{formatCurrency(calculations.totalGains)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Total Tax Liability</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(calculations.totalTax)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Net Tax Due</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(calculations.totalDue)}</p>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/final_tax')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Final Tax
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

export default CapitalGainsForm;