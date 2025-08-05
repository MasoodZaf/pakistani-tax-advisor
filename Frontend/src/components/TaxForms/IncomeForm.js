import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Calculator,
  DollarSign,
  FileText,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

const IncomeForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    nextStep, 
    previousStep, 
    currentStep,
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue, 
    formState: { errors } 
  } = useForm({
    defaultValues: getStepData('income')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-calculate totals
  const calculateTotals = (values) => {
    // Convert monthly salary to annual for tax calculations
    const annualSalary = (parseFloat(values.monthly_salary) || 0) * 12;
    
    const grossIncome = [
      annualSalary, // Use annual salary instead of monthly
      parseFloat(values.bonus) || 0,
      parseFloat(values.car_allowance) || 0,
      parseFloat(values.other_taxable) || 0
    ].reduce((sum, amount) => sum + amount, 0);

    const exemptIncome = [
      'medical_allowance',
      'employer_contribution', 
      'other_exempt'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    const taxableIncome = grossIncome - exemptIncome;

    return {
      grossIncome,
      exemptIncome,
      taxableIncome,
      annualSalary // Add this for display purposes
    };
  };

  const totals = calculateTotals(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_gross_income: totals.grossIncome,
      total_exempt_income: totals.exemptIncome,
      total_taxable_income: totals.taxableIncome
    };

    const success = await saveFormStep('income', formData, true);
    if (success) {
      toast.success('Income information saved successfully');
      navigate('/tax-forms/adjustable_tax');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_gross_income: totals.grossIncome,
      total_exempt_income: totals.exemptIncome,
      total_taxable_income: totals.taxableIncome
    };

    const success = await saveFormStep('income', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/adjustable_tax');
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
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Income Information</h1>
              <p className="text-gray-600">Enter your salary, bonuses, and other income sources</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Income Information Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Enter your monthly salary (annual equivalent will be calculated automatically)</li>
              <li>• Include all bonuses received during the tax year</li>
              <li>• Car allowance should be the taxable portion only</li>
              <li>• Medical allowance up to PKR 100,000 is typically exempt</li>
              <li>• Include any tax already deducted from your salary</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Taxable Income Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-primary-600" />
            Taxable Income
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Monthly Salary (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('monthly_salary', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {watchedValues.monthly_salary && parseFloat(watchedValues.monthly_salary) > 0 && (
                <p className="mt-1 text-sm text-blue-600">
                  Annual: {formatCurrency(parseFloat(watchedValues.monthly_salary) * 12)}
                </p>
              )}
              {errors.monthly_salary && (
                <p className="mt-1 text-sm text-red-600">{errors.monthly_salary.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Annual Bonus (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('bonus', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.bonus && (
                <p className="mt-1 text-sm text-red-600">{errors.bonus.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Car Allowance (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('car_allowance', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.car_allowance && (
                <p className="mt-1 text-sm text-red-600">{errors.car_allowance.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Other Taxable Income (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_taxable', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_taxable && (
                <p className="mt-1 text-sm text-red-600">{errors.other_taxable.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Exempt Income Section */}
        <div className="bg-green-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            Exempt Income
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Medical Allowance (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('medical_allowance', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-green-600">Up to PKR 100,000 typically exempt</p>
              {errors.medical_allowance && (
                <p className="mt-1 text-sm text-red-600">{errors.medical_allowance.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Employer Contribution (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('employer_contribution', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.employer_contribution && (
                <p className="mt-1 text-sm text-red-600">{errors.employer_contribution.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className={labelClasses}>
                Other Exempt Income (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('other_exempt', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.other_exempt && (
                <p className="mt-1 text-sm text-red-600">{errors.other_exempt.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tax Deductions Section */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Tax Already Deducted
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>
                Salary Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('salary_tax_deducted', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.salary_tax_deducted && (
                <p className="mt-1 text-sm text-red-600">{errors.salary_tax_deducted.message}</p>
              )}
            </div>

            <div>
              <label className={labelClasses}>
                Multiple Employers
              </label>
              <select
                {...register('multiple_employer')}
                className="form-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelClasses}>
                Additional Tax Deducted (PKR)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('additional_tax_deducted', {
                  min: { value: 0, message: 'Amount cannot be negative' }
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.additional_tax_deducted && (
                <p className="mt-1 text-sm text-red-600">{errors.additional_tax_deducted.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Income Summary (Annual)</h2>
          
          {/* Annual Salary Breakdown */}
          {totals.annualSalary > 0 && (
            <div className="bg-white p-4 rounded-lg mb-4 border border-primary-200">
              <p className="text-sm text-gray-600 mb-2">Salary Breakdown:</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  Monthly: {formatCurrency(parseFloat(watchedValues.monthly_salary) || 0)}
                </span>
                <span className="text-sm font-medium text-primary-900">
                  Annual: {formatCurrency(totals.annualSalary)}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Total Gross Income</p>
              <p className="text-xl font-bold text-primary-900">{formatCurrency(totals.grossIncome)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Total Exempt Income</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totals.exemptIncome)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-primary-700 mb-1">Total Taxable Income</p>
              <p className="text-xl font-bold text-primary-900">{formatCurrency(totals.taxableIncome)}</p>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Overview
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

export default IncomeForm;