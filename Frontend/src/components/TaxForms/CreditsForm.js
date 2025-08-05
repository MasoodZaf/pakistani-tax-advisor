import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Gift,
  Heart,
  Shield,
  TrendingUp,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const CreditsForm = () => {
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
    defaultValues: getStepData('credits')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate total credits
  const calculateTotal = (values) => {
    return [
      'charitable_donation',
      'pension_contribution',
      'life_insurance_premium',
      'investment_tax_credit',
      'other_credits'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);
  };

  const totalCredits = calculateTotal(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_credits: totalCredits
    };

    const success = await saveFormStep('credits', formData, true);
    if (success) {
      toast.success('Tax credits information saved successfully');
      navigate('/tax-forms/deductions');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_credits: totalCredits
    };

    const success = await saveFormStep('credits', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/deductions');
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
            <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Credits</h1>
              <p className="text-gray-600">Enter eligible tax credits to reduce your tax liability</p>
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
              <li>• Charitable donations: Up to 30% of taxable income or PKR 1 million (whichever is lower)</li>
              <li>• Pension contributions: Approved pension fund contributions</li>
              <li>• Life insurance: Premium payments for approved life insurance policies</li>
              <li>• Investment credits: Credits for investments in approved instruments</li>
              <li>• Credits directly reduce your tax liability rupee for rupee</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Charitable Donations Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Heart className="w-5 h-5 mr-2 text-green-600" />
            Charitable Donations
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Charitable Donation (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('charitable_donation', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">
                Up to 30% of taxable income or PKR 1,000,000 (whichever is lower)
              </p>
              {errors.charitable_donation && (
                <p className="mt-1 text-sm text-red-600">{errors.charitable_donation.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pension & Insurance Section */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            Pension & Insurance Contributions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Pension Contribution (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('pension_contribution', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-blue-600">Contributions to approved pension funds</p>
              {errors.pension_contribution && (
                <p className="mt-1 text-sm text-red-600">{errors.pension_contribution.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Life Insurance Premium (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('life_insurance_premium', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-blue-600">Premium for approved life insurance policies</p>
              {errors.life_insurance_premium && (
                <p className="mt-1 text-sm text-red-600">{errors.life_insurance_premium.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Investment Credits Section */}
        <div className="bg-purple-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
            Investment Tax Credits
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Investment Tax Credit (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('investment_tax_credit', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-purple-600">
                Credits for investments in approved instruments (Sukuk, etc.)
              </p>
              {errors.investment_tax_credit && (
                <p className="mt-1 text-sm text-red-600">{errors.investment_tax_credit.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Other Credits Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Other Tax Credits
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className={labelClasses}>
                Other Credits (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_credits', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-600">Any other eligible tax credits</p>
              {errors.other_credits && (
                <p className="mt-1 text-sm text-red-600">{errors.other_credits.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Tax Credits Summary</h2>
          <div className="text-center">
            <p className="text-sm text-primary-700 mb-2">Total Tax Credits</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</p>
            <p className="text-xs text-primary-600 mt-1">
              These credits directly reduce your tax liability
            </p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/reductions')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Reductions
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