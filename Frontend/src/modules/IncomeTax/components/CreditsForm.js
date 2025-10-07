import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  Gift,
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

  // Define comprehensive tax credits structure matching Excel
  const creditItems = [
    {
      id: 'charitable_donations_u61',
      description: 'Tax Credit for Charitable Donations u/s 61',
      yesNo: 'Y',
      amount: 'charitable_donations_amount',
      taxReduction: 'charitable_donations_tax_credit',
      limits: '30% of the taxable income'
    },
    {
      id: 'charitable_donations_associate',
      description: 'Tax Credit for Charitable Donations where donation is made to associate',
      yesNo: 'Y',
      amount: 'charitable_donations_associate_amount',
      taxReduction: 'charitable_donations_associate_tax_credit',
      limits: '15% of the taxable income'
    },
    {
      id: 'pension_fund_u63',
      description: 'Tax Credit for Contribution to Approved Pension Fund u/s 63',
      yesNo: 'Y',
      amount: 'pension_fund_amount',
      taxReduction: 'pension_fund_tax_credit',
      limits: '20% of the taxable income (2% per year for above 40 years if he joined at or above 41 years of age)'
    },
    {
      id: 'surrender_tax_credit_investments',
      description: 'Surrender of Tax Credit on Investments in Shares disposed off before time limit',
      yesNo: '-',
      amount: 'surrender_tax_credit_amount',
      taxReduction: 'surrender_tax_credit_reduction',
      limits: '-'
    }
  ];

  // Calculate total tax credit
  const calculateTotalCredit = () => {
    return creditItems.reduce((total, item) => {
      return total + (parseFloat(watchedValues[item.taxReduction]) || 0);
    }, 0);
  };

  const totalCredit = calculateTotalCredit();

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_tax_credits: totalCredit
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
      total_tax_credits: totalCredit
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

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Credits</h1>
              <p className="text-gray-600">Enter eligible tax credits for charitable donations and investments</p>
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
              <li>• <strong>Rebate at average rate</strong> is allowed on donations to approved non-profit organisations</li>
              <li>• <strong>General donations</strong>: Lower of donation value and 30% of taxable income</li>
              <li>• <strong>Associate donations</strong>: Restricted to 15% of taxable income</li>
              <li>• <strong>Pension contributions</strong>: 20% of taxable income (2% per year for late joiners above 40)</li>
              <li>• <strong>Tax credits</strong> reduce your final tax liability after calculation</li>
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
            <div className="col-span-2 text-center">Tax Credit</div>
            <div className="col-span-2 text-center">Limits/Remarks</div>
          </div>
        </div>

        {/* Tax Credits Section */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-purple-800 mb-4 flex items-center">
            <Gift className="w-5 h-5 mr-2" />
            Tax Credits
          </h2>

          {creditItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center py-3 border-b border-purple-200 last:border-b-0">
              <div className="col-span-5">
                <p className="text-sm font-medium text-gray-700">{item.description}</p>
              </div>
              <div className="col-span-1 text-center">
                {item.yesNo === '-' ? (
                  <span className="text-gray-400">-</span>
                ) : (
                  <select
                    {...register(`${item.id}_yn`)}
                    className="form-select w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">-</option>
                    <option value="Y">Y</option>
                    <option value="N">N</option>
                  </select>
                )}
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

          {/* Total Tax Credits */}
          <div className="grid grid-cols-12 gap-3 items-center py-4 mt-4 bg-purple-100 rounded-lg px-4 font-semibold">
            <div className="col-span-5">
              <p className="text-purple-800">Total Tax Credit</p>
            </div>
            <div className="col-span-1"></div>
            <div className="col-span-2"></div>
            <div className="col-span-2 text-right">
              <p className="text-xl font-bold text-purple-800">{formatCurrency(totalCredit)}</p>
            </div>
            <div className="col-span-2"></div>
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
            Previous: Tax Reductions
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