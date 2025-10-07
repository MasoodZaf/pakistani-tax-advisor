import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Calculator,
  DollarSign,
  FileText,
  Info,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Building2,
  CreditCard,
  PiggyBank,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';

// Section component defined outside to prevent re-creation and focus loss
const SectionComponent = ({ groupKey, group, register, errors, expandedSections, toggleSection, getColorClasses }) => {
  const colors = getColorClasses(group.color);
  const IconComponent = group.icon;
  const isExpanded = expandedSections[groupKey];
  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg mb-4`}>
      <div 
        className="p-4 cursor-pointer"
        onClick={() => toggleSection(groupKey)}
      >
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${colors.text} flex items-center`}>
            <IconComponent className={`w-5 h-5 mr-2 ${colors.icon}`} />
            {group.title}
          </h3>
          {isExpanded ? 
            <ChevronDown className={`w-4 h-4 ${colors.icon}`} /> :
            <ChevronRight className={`w-4 h-4 ${colors.icon}`} />
          }
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="space-y-3">
            {group.fields.map((field) => (
              <div key={field.key} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-8">
                  <label className="text-sm font-medium text-gray-700">
                    {field.label}
                  </label>
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    step="0.01"
                    {...register(field.field, {
                      min: { value: 0, message: 'Amount cannot be negative' },
                      valueAsNumber: true
                    })}
                    className={inputClasses}
                    placeholder="0"
                  />
                  {errors[field.field] && (
                    <p className="mt-1 text-xs text-red-600">{errors[field.field].message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FinalMinIncomeForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue,
    formState: { errors } 
  } = useForm({
    defaultValues: getStepData('final_min_income')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Define comprehensive field groups matching the Excel structure
  const fieldGroups = {
    salaryIncome: {
      title: "Salary Income",
      icon: DollarSign,
      color: "blue",
      fields: [
        { 
          key: 'salary_u_s_12_7', 
          label: 'Salary u/s 12(7)', 
          field: 'salary_u_s_12_7'
        }
      ]
    },
    dividendInterest: {
      title: "Dividend & Interest Income", 
      icon: TrendingUp,
      color: "green",
      fields: [
        { 
          key: 'dividend_u_s_150_exempt_profit_rate_mlt_30', 
          label: 'Dividend u/s 150 (Exempt profit rate MLT 30)', 
          field: 'dividend_u_s_150_exempt_profit_rate_mlt_30'
        },
        { 
          key: 'dividend_u_s_150_31_atl_15pc', 
          label: 'Dividend u/s 150 (31% ATL u/s 15%)', 
          field: 'dividend_u_s_150_31_atl_15pc'  
        },
        { 
          key: 'dividend_u_s_150_56_10_shares', 
          label: 'Dividend u/s 150 @ 56/10 Shares', 
          field: 'dividend_u_s_150_56_10_shares'
        }
      ]
    },
    investmentReturns: {
      title: "Investment Returns",
      icon: PiggyBank, 
      color: "purple",
      fields: [
        { 
          key: 'return_on_investment_sukuk_u_s_151_1a_10pc', 
          label: 'Return on Investment in Sukuk u/s 151(1A) @ 10%', 
          field: 'return_on_investment_sukuk_u_s_151_1a_10pc'
        },
        { 
          key: 'return_on_investment_sukuk_u_s_151_1a_12_5pc', 
          label: 'Return on Investment in Sukuk u/s 151(1A) @ 12.5%', 
          field: 'return_on_investment_sukuk_u_s_151_1a_12_5pc'
        },
        { 
          key: 'return_on_investment_sukuk_u_s_151_1b_15pc', 
          label: 'Return on Investment in Sukuk u/s 151(1B) @ 15%', 
          field: 'return_on_investment_sukuk_u_s_151_1b_15pc'
        },
        { 
          key: 'return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a', 
          label: 'I return on investment is exceeding 1 million on sukuk u/s SAA @ 12.5% u/s 151(1A), u/s 151(1B)', 
          field: 'return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u_s_151_1a'
        },
        { 
          key: 'return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a', 
          label: 'I return on investment is not exceeding 1 million on sukuk u/s SAA @ 10% u/s 151(1A), u/s 151(1B)', 
          field: 'return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc_u_s_151_1a'
        }
      ]
    },
    profitDebt: {
      title: "Profit on Debt",
      icon: Calculator,
      color: "yellow",
      fields: [
        { 
          key: 'profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc', 
          label: 'Profit on Debt u/s (151A)/SAA/SAB of Part II, Second Schedule (ATL@10%, non-ATL@20%)', 
          field: 'profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10pc_non_atl_20pc'
        },
        { 
          key: 'profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a', 
          label: 'Profit on debt National Savings Certificates including Defence Saving pertaining to services u/s 39(14A)', 
          field: 'profit_on_debt_national_savings_certificates_including_defence_saving_pertaining_to_services_u_s_39_14a'
        },
        { 
          key: 'profit_on_debt_u_s_7b', 
          label: 'Profit on debt u/s 7B', 
          field: 'profit_on_debt_u_s_7b'
        },
        { 
          key: 'prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156', 
          label: 'Prize on Raffle/Lottery/Quiz as promotional offer u/s 156', 
          field: 'prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156'
        },
        { 
          key: 'bonus_shares_issued_by_companies_u/s_236f', 
          label: 'Bonus shares issued by companies u/s 236F', 
          field: 'bonus_shares_issued_by_companies_u_s_236f'
        }
      ]
    },
    employmentBenefits: {
      title: "Employment Termination & Benefits",
      icon: Award,
      color: "indigo",
      fields: [
        { 
          key: 'employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate', 
          label: 'Employment Termination Benefits u/s 12(6) Chargeable to Tax at Average Rate', 
          field: 'employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_average_rate'
        }
      ]
    },
    otherIncome: {
      title: "Other Income Sources",
      icon: Building2,
      color: "red",
      fields: [
        { 
          key: 'salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate', 
          label: 'Salary Arrears u/s 12(7) Chargeable to Tax at Relevant Rate', 
          field: 'salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate'
        }
      ]
    }
  };

  // Calculate totals - Subtotal is sum of all inputs, Grand Total includes Capital Gain
  const calculateTotals = () => {
    let subtotal = 0;
    
    Object.values(fieldGroups).forEach(group => {
      group.fields.forEach(field => {
        const value = parseFloat(watchedValues[field.field]) || 0;
        subtotal += value;
      });
    });

    // Capital Gain from separate form/field (this would come from CapitalGainForm)
    const capitalGain = parseFloat(watchedValues.capital_gain) || 0;
    const grandTotal = subtotal + capitalGain;

    return { subtotal, capitalGain, grandTotal };
  };

  const { subtotal, capitalGain, grandTotal } = calculateTotals();

  const onSubmit = async (data) => {
    // Structure the data for backend 
    const structuredData = {
      // All comprehensive income fields
      ...data,
      subtotal: subtotal,
      capital_gain: capitalGain,
      grand_total: grandTotal,
      isComplete: true
    };

    const success = await saveFormStep('final_min_income', structuredData, true);
    if (success) {
      toast.success('Final/Fixed/Minimum tax income saved successfully');
      navigate('/tax-forms/adjustable_tax');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const structuredData = {
      ...data,
      subtotal: subtotal,
      capital_gain: capitalGain,  
      grand_total: grandTotal,
      isComplete: false
    };

    const success = await saveFormStep('final_min_income', structuredData, false);
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

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const getColorClasses = (color) => {
    const colorMap = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: 'text-blue-600' },
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', icon: 'text-green-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', icon: 'text-purple-600' },
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', icon: 'text-yellow-600' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', icon: 'text-indigo-600' },
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: 'text-red-600' }
    };
    return colorMap[color] || colorMap.blue;
  };

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Income Subject to Final/Fixed/Minimum/Average/Relevant/Reduced Tax</h1>
              <p className="text-gray-600">Enter specialized income categories with fixed tax rates (separate from normal taxation)</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Final/Fixed/Minimum Tax Income Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• This form covers <strong>specialized Pakistani tax categories</strong> with fixed/final tax rates</li>
              <li>• These are <strong>separate from normal taxation</strong> - they have their own tax rates</li>
              <li>• Enter amounts from certificates showing final/fixed tax deductions</li>
              <li>• Each section corresponds to specific u/s provisions (149, 150, 151, etc.)</li>
              <li>• Subtotal: Sum of all specialized income fields</li>
              <li>• Grand Total: Subtotal + Capital Gain</li>
              <li>• Complete this after Normal Income form</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-3 items-center py-3 mb-4 bg-gray-800 text-white rounded-lg px-4">
          <div className="col-span-8">
            <h3 className="font-semibold">Description</h3>
          </div>
          <div className="col-span-4 text-center">
            <h3 className="font-semibold">Amount (PKR)</h3>
          </div>
        </div>

        {/* Dynamic Sections - All income categories from Excel */}
        {Object.entries(fieldGroups).map(([key, group]) => (
          <SectionComponent 
            key={key} 
            groupKey={key} 
            group={group} 
            register={register}
            errors={errors}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            getColorClasses={getColorClasses}
          />
        ))}

        {/* Capital Gain Input */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-8">
              <label className="text-sm font-medium text-gray-700">
                <CreditCard className="w-4 h-4 inline mr-2 text-orange-600" />
                Capital Gain (from Capital Gain Form)
              </label>
            </div>
            <div className="col-span-4">
              <input
                type="number"
                step="0.01"
                {...register('capital_gain', {
                  min: { value: 0, message: 'Amount cannot be negative' },
                  valueAsNumber: true
                })}
                className={inputClasses}
                placeholder="0"
              />
              {errors.capital_gain && (
                <p className="mt-1 text-xs text-red-600">{errors.capital_gain.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Totals Section */}
        <div className="bg-gray-800 text-white rounded-lg p-6">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-8">
                <h3 className="text-lg font-bold">Subtotal</h3>
                <p className="text-sm opacity-75">Sum of all income fields</p>
              </div>
              <div className="col-span-4 text-right">
                <p className="text-2xl font-bold">
                  {formatCurrency(subtotal)}
                </p>
              </div>
            </div>
            
            <div className="border-t border-gray-600 pt-3">
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-8">
                  <h3 className="text-xl font-bold">Grand Total</h3>
                  <p className="text-sm opacity-75">Subtotal + Capital Gain</p>
                </div>
                <div className="col-span-4 text-right">
                  <p className="text-3xl font-bold text-yellow-400">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm opacity-75">This is your total income subject to Pakistani tax law</p>
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
            Previous: Normal Income
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

export default FinalMinIncomeForm;