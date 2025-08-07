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

  // Define comprehensive capital gains structure matching Excel
  const capitalGainItems = [
    // Immovable Property u/s 37(1A) by holding period
    {
      id: 'immovable_property_1_year',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period does not exceed 1 year',
      taxableAmount: 'immovable_property_1_year_taxable',
      taxDeducted: 'immovable_property_1_year_deducted',
      taxCarryable: 'immovable_property_1_year_carryable'
    },
    {
      id: 'immovable_property_2_years',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 1 year but does not exceed 2 years',
      taxableAmount: 'immovable_property_2_years_taxable',
      taxDeducted: 'immovable_property_2_years_deducted',
      taxCarryable: 'immovable_property_2_years_carryable'
    },
    {
      id: 'immovable_property_3_years',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 2 years but does not exceed 3 years',
      taxableAmount: 'immovable_property_3_years_taxable',
      taxDeducted: 'immovable_property_3_years_deducted',
      taxCarryable: 'immovable_property_3_years_carryable'
    },
    {
      id: 'immovable_property_4_years',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 3 years but does not exceed 4 years',
      taxableAmount: 'immovable_property_4_years_taxable',
      taxDeducted: 'immovable_property_4_years_deducted',
      taxCarryable: 'immovable_property_4_years_carryable'
    },
    {
      id: 'immovable_property_5_years',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 4 years but does not exceed 5 years',
      taxableAmount: 'immovable_property_5_years_taxable',
      taxDeducted: 'immovable_property_5_years_deducted',
      taxCarryable: 'immovable_property_5_years_carryable'
    },
    {
      id: 'immovable_property_6_years',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 5 years but does not exceed 6 years',
      taxableAmount: 'immovable_property_6_years_taxable',
      taxDeducted: 'immovable_property_6_years_deducted',
      taxCarryable: 'immovable_property_6_years_carryable'
    },
    {
      id: 'immovable_property_over_6_years',
      description: 'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 6 years',
      taxableAmount: 'immovable_property_over_6_years_taxable',
      taxDeducted: 'immovable_property_over_6_years_deducted',
      taxCarryable: 'immovable_property_over_6_years_carryable'
    },
    {
      id: 'securities_before_july_2013',
      description: 'Capital Gain on Securities u/s 37A @5% acquired before 1-Jul-2013',
      taxableAmount: 'securities_before_july_2013_taxable',
      taxDeducted: 'securities_before_july_2013_deducted',
      taxCarryable: 'securities_before_july_2013_carryable'
    },
    {
      id: 'securities_pmex_settled',
      description: 'Capital Gain on Securities u/s 37A @5% (PMEX/Cash Settled Securities)',
      taxableAmount: 'securities_pmex_settled_taxable',
      taxDeducted: 'securities_pmex_settled_deducted',
      taxCarryable: 'securities_pmex_settled_carryable'
    },
    {
      id: 'securities_37a_7_5_percent',
      description: 'Capital Gain on Securities u/s 37A @7.5%',
      taxableAmount: 'securities_37a_7_5_percent_taxable',
      taxDeducted: 'securities_37a_7_5_percent_deducted',
      taxCarryable: 'securities_37a_7_5_percent_carryable'
    },
    {
      id: 'securities_mutual_funds_10_percent',
      description: 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT u/s 37A @10%',
      taxableAmount: 'securities_mutual_funds_10_percent_taxable',
      taxDeducted: 'securities_mutual_funds_10_percent_deducted',
      taxCarryable: 'securities_mutual_funds_10_percent_carryable'
    },
    {
      id: 'securities_mutual_funds_12_5_percent',
      description: 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT (for stock funds) u/s 37A @12.5%',
      taxableAmount: 'securities_mutual_funds_12_5_percent_taxable',
      taxDeducted: 'securities_mutual_funds_12_5_percent_deducted',
      taxCarryable: 'securities_mutual_funds_12_5_percent_carryable'
    },
    {
      id: 'securities_other_25_percent',
      description: 'Capital Gain on Securities / Mutual Funds / Collective Schemes / REIT (Other than stock funds) u/s 37A @25%',
      taxableAmount: 'securities_other_25_percent_taxable',
      taxDeducted: 'securities_other_25_percent_deducted',
      taxCarryable: 'securities_other_25_percent_carryable'
    },
    {
      id: 'securities_12_5_percent_before_july_2022',
      description: 'Capital Gain on Securities u/s 37A @12.5% (Securities acquired before July 01, 2022 regardless of holding period)',
      taxableAmount: 'securities_12_5_percent_before_july_2022_taxable',
      taxDeducted: 'securities_12_5_percent_before_july_2022_deducted',
      taxCarryable: 'securities_12_5_percent_before_july_2022_carryable'
    },
    {
      id: 'securities_15_percent',
      description: 'Capital Gain on Securities u/s 37A @15%',
      taxableAmount: 'securities_15_percent_taxable',
      taxDeducted: 'securities_15_percent_deducted',
      taxCarryable: 'securities_15_percent_carryable'
    }
  ];

  // Calculate total capital gains
  const calculateTotalCapitalGains = () => {
    return capitalGainItems.reduce((total, item) => {
      return total + (parseFloat(watchedValues[item.taxableAmount]) || 0);
    }, 0);
  };

  const totalCapitalGains = calculateTotalCapitalGains();

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_capital_gain: totalCapitalGains
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
      total_capital_gain: totalCapitalGains
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

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Home className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Capital Gain</h1>
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
              <li>• <strong>Immovable Property</strong>: Tax rates vary by holding period (1-6 years)</li>
              <li>• <strong>Securities</strong>: Different rates apply based on type and acquisition date</li>
              <li>• <strong>REIT/Mutual Funds</strong>: Stock funds vs other funds have different rates</li>
              <li>• <strong>Special rates</strong>: Securities acquired before July 1, 2022 have preferential rates</li>
              <li>• Enter taxable amount, tax deducted, and any carryable amounts</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Column Headers */}
        <div className="bg-teal-600 text-white rounded-lg">
          <div className="grid grid-cols-12 gap-3 items-center py-3 px-4 font-semibold">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-center">Taxable Amount/Receipt</div>
            <div className="col-span-2 text-center">Tax Deducted</div>
            <div className="col-span-2 text-center">Tax Carryable</div>
          </div>
        </div>

        {/* Capital Gains Section */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-teal-800 mb-4 flex items-center">
            <Home className="w-5 h-5 mr-2" />
            Capital Gain
          </h2>

          {capitalGainItems.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-3 items-center py-3 border-b border-teal-200 last:border-b-0">
              <div className="col-span-6">
                <p className="text-sm font-medium text-gray-700">{item.description}</p>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.taxableAmount, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={inputClasses}
                  placeholder="0"
                />
                {errors[item.taxableAmount] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.taxableAmount].message}</p>
                )}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.taxDeducted, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={inputClasses}
                  placeholder="0"
                />
                {errors[item.taxDeducted] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.taxDeducted].message}</p>
                )}
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  step="0.01"
                  {...register(item.taxCarryable, {
                    min: { value: 0, message: 'Amount cannot be negative' },
                    valueAsNumber: true
                  })}
                  className={inputClasses}
                  placeholder="0"
                />
                {errors[item.taxCarryable] && (
                  <p className="mt-1 text-xs text-red-600">{errors[item.taxCarryable].message}</p>
                )}
              </div>
            </div>
          ))}

          {/* Total Capital Gain */}
          <div className="grid grid-cols-12 gap-3 items-center py-4 mt-4 bg-teal-100 rounded-lg px-4 font-semibold">
            <div className="col-span-6">
              <p className="text-teal-800">Total Capital Gain</p>
            </div>
            <div className="col-span-2 text-right">
              <p className="text-xl font-bold text-teal-800">{formatCurrency(totalCapitalGains)}</p>
            </div>
            <div className="col-span-2 text-center">
              <p className="text-xl font-bold text-teal-800">0</p>
            </div>
            <div className="col-span-2 text-center">
              <p className="text-xl font-bold text-teal-800">-</p>
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