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
  Info,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  PiggyBank,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';

const FinalMinIncomeForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    loadTaxReturn,
    formData,
    saving
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    salaryIncome: true, // Expand first section by default
  });
  const [refreshKey, setRefreshKey] = useState(0); // Used to force re-render after data refresh

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('final_min_income')
  });

  // Watch for changes in formData from context and update the form
  useEffect(() => {
    const contextData = formData['final_min_income'];
    if (contextData && Object.keys(contextData).length > 0) {
      console.log('[FinalMinIncomeForm] Context data updated, resetting form:', {
        salary_u_s_12_7: contextData.salary_u_s_12_7,
        salary_u_s_12_7_tax_deducted: contextData.salary_u_s_12_7_tax_deducted,
        salary_u_s_12_7_tax_chargeable: contextData.salary_u_s_12_7_tax_chargeable,
        totalFields: Object.keys(contextData).length
      });
      reset(contextData);
      // Increment refreshKey to force input recreation with new default values
      setRefreshKey(prev => prev + 1);
      console.log('[FinalMinIncomeForm] Form reset and inputs recreated');
    }
  }, [formData, reset]);

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Get current form data from context for rendering inputs
  const currentFormData = formData['final_min_income'] || {};

  // Define field definitions matching database columns and Excel structure
  const fieldDefinitions = [
    // Salary Income
    {
      section: 'salaryIncome',
      sectionTitle: 'Salary Income',
      sectionIcon: DollarSign,
      sectionColor: 'blue',
      fields: [
        {
          label: 'Salary u/s 12(7)',
          amountField: 'salary_u_s_12_7',
          taxDeductedField: 'salary_u_s_12_7_tax_deducted',
          taxChargeableField: 'salary_u_s_12_7_tax_chargeable',
          taxRate: null, // Variable rate from tax computation
          description: 'Salary income subject to tax at rates in First Schedule'
        }
      ]
    },

    // Dividend & Interest Income
    {
      section: 'dividendInterest',
      sectionTitle: 'Dividend Income',
      sectionIcon: TrendingUp,
      sectionColor: 'green',
      fields: [
        {
          label: 'Dividend u/s 150 @0% (REIT SPV)',
          amountField: 'dividend_u_s_150_0pc_share_profit_reit_spv_amount',
          taxDeductedField: 'dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted',
          taxChargeableField: 'dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable',
          taxRate: 0.00,
          description: 'Dividend from REIT/SPV when pass-through to CPPAG'
        },
        {
          label: 'Dividend u/s 150 @35% (Other SPV) - ATL/Non-ATL 35%/70%',
          amountField: 'dividend_u_s_150_35pc_share_profit_other_spv_amount',
          taxDeductedField: 'dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted',
          taxChargeableField: 'dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable',
          taxRate: 0.35, // ATL rate, Non-ATL is 0.70
          description: 'Dividend from other SPV (biomass/baggas based power projects)'
        },
        {
          label: 'Dividend u/s 150 @7.5% (IPP Shares) - ATL/Non-ATL 7.5%/15%',
          amountField: 'dividend_u_s_150_7_5pc_ipp_shares_amount',
          taxDeductedField: 'dividend_u_s_150_7_5pc_ipp_shares_tax_deducted',
          taxChargeableField: 'dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable',
          taxRate: 0.075, // ATL rate, Non-ATL is 0.15
          description: 'Dividend from IPP shares'
        },
        {
          label: 'Dividend u/s 150 @15% (< 50% profit on debt) - ATL/Non-ATL 15%/30%',
          amountField: 'dividend_u_s_150_31pc_atl_amount',
          taxDeductedField: 'dividend_u_s_150_31pc_atl_tax_deducted',
          taxChargeableField: 'dividend_u_s_150_31pc_atl_tax_chargeable',
          taxRate: 0.15, // ATL rate, Non-ATL is 0.30
          description: 'Dividend where company availing exemption or benefiting from c/f business losses'
        }
      ]
    },

    // Investment Returns (Sukuks)
    {
      section: 'investmentReturns',
      sectionTitle: 'Investment Returns (Sukuks)',
      sectionIcon: PiggyBank,
      sectionColor: 'purple',
      fields: [
        {
          label: 'Return on Investment in Sukuk u/s 151(1A) @ 10%',
          amountField: 'return_on_investment_sukuk_u_s_151_1a_10pc_amount',
          taxDeductedField: 'return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted',
          taxChargeableField: 'return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable',
          taxRate: 0.10,
          description: 'Final Tax on Sukuk investment returns up to certain thresholds'
        },
        {
          label: 'Return on Investment in Sukuk u/s 151(1A) @ 12.5%',
          amountField: 'return_on_investment_sukuk_u_s_151_1a_12_5pc_amount',
          taxDeductedField: 'return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted',
          taxChargeableField: 'return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable',
          taxRate: 0.125,
          description: 'Final Tax on Sukuk investment returns at 12.5%'
        },
        {
          label: 'Return on Investment in Sukuk u/s 151(1A) @ 25%',
          amountField: 'return_on_investment_sukuk_u_s_151_1a_25pc_amount',
          taxDeductedField: 'return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted',
          taxChargeableField: 'return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable',
          taxRate: 0.25,
          description: 'Minimum Tax on Sukuk investment returns above Rs. 5M'
        },
        {
          label: 'Return on Investment exceeding Rs. 1M @ 12.5%',
          amountField: 'return_invest_exceed_1m_sukuk_saa_12_5pc_amount',
          taxDeductedField: 'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted',
          taxChargeableField: 'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable',
          taxRate: 0.125,
          description: 'Returns above Rs. 1M up to Rs. 5M @ 12.5%'
        },
        {
          label: 'Return on Investment not exceeding Rs. 1M @ 10%',
          amountField: 'return_invest_not_exceed_1m_sukuk_saa_10pc_amount',
          taxDeductedField: 'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted',
          taxChargeableField: 'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable',
          taxRate: 0.10,
          description: 'Returns up to Rs. 1M @ 10% Final Tax'
        }
      ]
    },

    // Profit on Debt
    {
      section: 'profitDebt',
      sectionTitle: 'Profit on Debt',
      sectionIcon: Calculator,
      sectionColor: 'yellow',
      fields: [
        {
          label: 'Profit on Debt u/s 151A/SAA/SAB @ 10%/20% (ATL/Non-ATL)',
          amountField: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount',
          taxDeductedField: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted',
          taxChargeableField: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable',
          taxRate: 0.10, // ATL rate, Non-ATL is 0.20
          description: 'Profit on Government securities via FCVA'
        },
        {
          label: 'Profit on Debt National Savings/Defence u/s 39(14A) @ Variable%',
          amountField: 'profit_debt_national_savings_defence_39_14a_amount',
          taxDeductedField: 'profit_debt_national_savings_defence_39_14a_tax_deducted',
          taxChargeableField: 'profit_debt_national_savings_defence_39_14a_tax_chargeable',
          taxRate: null, // Variable rate
          description: 'Profit on National Savings Certificates (variable rate)'
        },
        {
          label: 'Interest/Profit on Debt u/s 7B (up to 5M) @ 15%',
          amountField: 'interest_income_profit_debt_7b_up_to_5m_amount',
          taxDeductedField: 'interest_income_profit_debt_7b_up_to_5m_tax_deducted',
          taxChargeableField: 'interest_income_profit_debt_7b_up_to_5m_tax_chargeable',
          taxRate: 0.15,
          description: 'Profit on debt up to Rs. 5M - Final Tax'
        }
      ]
    },

    // Prize/Winnings
    {
      section: 'prizeWinnings',
      sectionTitle: 'Prize/Winnings',
      sectionIcon: Award,
      sectionColor: 'indigo',
      fields: [
        {
          label: 'Prize on Raffle/Lottery/Quiz/Promotional u/s 156 @ 20%',
          amountField: 'prize_raffle_lottery_quiz_promotional_156_amount',
          taxDeductedField: 'prize_raffle_lottery_quiz_promotional_156_tax_deducted',
          taxChargeableField: 'prize_raffle_lottery_quiz_promotional_156_tax_chargeable',
          taxRate: 0.20,
          description: 'Prize on Raffle/Lottery/Quiz/Sale promotion - Final Tax'
        },
        {
          label: 'Prize on Prize Bond/Crossword Puzzle u/s 156 @ 15%',
          amountField: 'prize_bond_cross_world_puzzle_156_amount',
          taxDeductedField: 'prize_bond_cross_world_puzzle_156_tax_deducted',
          taxChargeableField: 'prize_bond_cross_world_puzzle_156_tax_chargeable',
          taxRate: 0.15,
          description: 'Prize on Prize Bond/crossword puzzle - Final Tax'
        }
      ]
    },

    // Employment-Related
    {
      section: 'employmentRelated',
      sectionTitle: 'Employment-Related Income',
      sectionIcon: Award,
      sectionColor: 'red',
      fields: [
        {
          label: 'Bonus Shares u/s 236F',
          amountField: 'bonus_shares_companies_236f_amount',
          taxDeductedField: 'bonus_shares_companies_236f_tax_deducted',
          taxChargeableField: 'bonus_shares_companies_236f_tax_chargeable',
          taxRate: 0.00, // Typically not taxed at issuance
          description: 'Bonus shares issued by companies'
        },
        {
          label: 'Employment Termination Benefits u/s 12(6) @ Average Rate',
          amountField: 'employment_termination_benefits_12_6_avg_rate_amount',
          taxDeductedField: 'employment_termination_benefits_12_6_avg_rate_tax_deducted',
          taxChargeableField: 'employment_termination_benefits_12_6_avg_rate_tax_chargeable',
          taxRate: null, // Variable/Average rate
          description: 'Chargeable to Tax at Average Rate (0% to 100%)'
        },
        {
          label: 'Salary Arrears u/s 12(7) @ Relevant Rate',
          amountField: 'salary_arrears_12_7_relevant_rate_amount',
          taxDeductedField: 'salary_arrears_12_7_relevant_rate_tax_deducted',
          taxChargeableField: 'salary_arrears_12_7_relevant_rate_tax_chargeable',
          taxRate: null, // Relevant rate
          description: 'Chargeable to Tax at Relevant Rate'
        }
      ]
    }
  ];

  // Auto-calculate tax chargeable when amount changes
  useEffect(() => {
    fieldDefinitions.forEach(section => {
      section.fields.forEach(field => {
        const amount = watchedValues[field.amountField] || 0;
        const taxRate = field.taxRate;

        // Only auto-calculate if there's a fixed tax rate
        if (taxRate !== null && amount > 0) {
          const calculatedTax = Math.round(amount * taxRate);
          const currentTaxChargeable = watchedValues[field.taxChargeableField];

          // Only update if different to avoid infinite loops
          if (Math.abs((currentTaxChargeable || 0) - calculatedTax) > 0.01) {
            setValue(field.taxChargeableField, calculatedTax);
          }
        }
      });
    });
  }, [watchedValues, setValue]);

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;

    fieldDefinitions.forEach(section => {
      section.fields.forEach(field => {
        const taxChargeable = parseFloat(watchedValues[field.taxChargeableField]) || 0;
        subtotal += taxChargeable;
      });
    });

    // Capital Gain from separate form
    const capitalGainTaxChargeable = parseFloat(watchedValues.capital_gain_tax_chargeable) || 0;
    const grandTotal = subtotal + capitalGainTaxChargeable;

    return { subtotal, capitalGainTaxChargeable, grandTotal };
  };

  const { subtotal, capitalGainTaxChargeable, grandTotal } = calculateTotals();

  // Helper to sync uncontrolled input values to React Hook Form before saving
  const syncInputsToForm = async () => {
    // Force blur on active input to sync its value
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
    // Wait for blur handler to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  const onSubmit = async (data) => {
    await syncInputsToForm();
    const finalData = getValues();

    // Structure the data for backend
    const structuredData = {
      ...finalData,
      isComplete: true
    };

    const success = await saveFormStep('final_min_income', structuredData, true);
    if (success) {
      toast.success('Final/Minimum tax income saved successfully');
      navigate('/tax-forms/adjustable_tax');
    }
  };

  const onSaveAndContinue = async () => {
    await syncInputsToForm();
    const data = getValues();

    const structuredData = {
      ...data,
      isComplete: false
    };

    const success = await saveFormStep('final_min_income', structuredData, false);
    if (success) {
      toast.success('Data saved successfully');

      // Reload the data from backend to get updated calculations
      const freshData = await getStepData('final_min_income');
      if (freshData) {
        // Update all form fields with the fresh data
        Object.keys(freshData).forEach(key => {
          if (freshData[key] !== undefined && freshData[key] !== null) {
            setValue(key, freshData[key]);
          }
        });

        // Force re-render to update input defaultValues
        setRefreshKey(prev => prev + 1);

        toast.success('Form refreshed with latest calculations');
      }
    }
  };

  const formatNumber = (num) => {
    if (!num || isNaN(num)) return '';
    return new Intl.NumberFormat('en-PK').format(num);
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
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600' },
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600' },
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-600' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-600' },
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600' }
    };
    return colorMap[color] || colorMap.blue;
  };

  // Input handlers
  const handleNumberFocus = (fieldName, event) => {
    // Remove formatting and select all
    const currentValue = watchedValues[fieldName] || 0;
    event.target.value = currentValue.toString();
    event.target.select();
  };

  const handleNumberInput = (fieldName, event) => {
    const rawValue = event.target.value;
    const sanitized = rawValue.replace(/[^\d.-]/g, '');
    const numericValue = parseFloat(sanitized) || 0;
    setValue(fieldName, numericValue);
  };

  const handleNumberBlur = async (fieldName, event) => {
    const rawValue = event.target.value.replace(/,/g, '');
    const numericValue = parseFloat(rawValue) || 0;

    // Update React Hook Form
    setValue(fieldName, numericValue);

    // Format for display
    event.target.value = formatNumber(numericValue);

    // Auto-save on blur - get all current form values and save
    const currentFormData = getValues();

    console.log(`[FinalMinIncomeForm] Auto-saving on blur for field: ${fieldName}`, {
      fieldValue: numericValue,
      totalFields: Object.keys(currentFormData).length
    });

    try {
      await saveFormStep('final_min_income', currentFormData, false);
      console.log('[FinalMinIncomeForm] Auto-save successful');

      // Reload fresh data from backend after save to get calculated values
      // The useEffect watching formData will automatically reset the form when context updates
      await loadTaxReturn();
      console.log('[FinalMinIncomeForm] loadTaxReturn completed - form will update via useEffect');
    } catch (error) {
      console.error('[FinalMinIncomeForm] Auto-save failed:', error);
      toast.error('Auto-save failed', { id: 'auto-save-error' });
    }
  };

  const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";
  const readOnlyInputClasses = "w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-right text-sm font-semibold text-gray-700";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Income Subject to Final/Minimum Tax</h1>
              <p className="text-gray-600">Enter income with fixed tax rates (3-column structure: Amount, Tax Deducted, Tax Chargeable)</p>
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
            <h3 className="font-medium text-blue-900 mb-2">How to Use This Form</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Amount/Receipt:</strong> Enter the gross amount received (green cells - user input)</li>
              <li>• <strong>Tax Deducted:</strong> Enter the tax already deducted at source (green cells - user input)</li>
              <li>• <strong>Tax Chargeable:</strong> Auto-calculated based on FBR rates (white cells - read-only)</li>
              <li>• Tax rates vary by income type: 0%, 7.5%, 10%, 12.5%, 15%, 20%, 25%, 35%</li>
              <li>• Some rates differ for ATL (Active Tax List) vs Non-ATL taxpayers</li>
              <li>• Variable rates (Salary, Termination, Arrears) use tax_deducted as tax_chargeable</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={async (e) => {
        e.preventDefault();
        await syncInputsToForm();
        handleSubmit(onSubmit)(e);
      }} className="space-y-6">

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-3 items-center py-3 mb-4 bg-gray-800 text-white rounded-lg px-4">
          <div className="col-span-6">
            <h3 className="font-semibold">Description</h3>
          </div>
          <div className="col-span-2 text-center">
            <h3 className="font-semibold">Amount/Receipt</h3>
          </div>
          <div className="col-span-2 text-center">
            <h3 className="font-semibold">Tax Deducted</h3>
          </div>
          <div className="col-span-2 text-center">
            <h3 className="font-semibold">Tax Chargeable</h3>
          </div>
        </div>

        {/* Dynamic Sections */}
        {fieldDefinitions.map((sectionDef, sectionIdx) => {
          const colors = getColorClasses(sectionDef.sectionColor);
          const IconComponent = sectionDef.sectionIcon;
          const isExpanded = expandedSections[sectionDef.section];

          return (
            <div key={sectionDef.section} className={`${colors.bg} ${colors.border} border rounded-lg`}>
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleSection(sectionDef.section)}
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${colors.text} flex items-center`}>
                    <IconComponent className={`w-5 h-5 mr-2 ${colors.icon}`} />
                    {sectionDef.sectionTitle}
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
                    {sectionDef.fields.map((field, fieldIdx) => (
                      <div key={field.amountField} className="grid grid-cols-12 gap-3 items-center">
                        {/* Description */}
                        <div className="col-span-6">
                          <label className="text-sm font-medium text-gray-700">
                            {field.label}
                          </label>
                          {field.description && (
                            <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                          )}
                        </div>

                        {/* Amount/Receipt (green background - user input) */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`${inputClasses} bg-green-50`}
                            placeholder="0"
                            value={formatNumber(watchedValues[field.amountField] || 0)}
                            onFocus={(e) => handleNumberFocus(field.amountField, e)}
                            onChange={(e) => handleNumberInput(field.amountField, e)}
                            onBlur={(e) => handleNumberBlur(field.amountField, e)}
                          />
                        </div>

                        {/* Tax Deducted (green background - user input) */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            className={`${inputClasses} bg-green-50`}
                            placeholder="0"
                            value={formatNumber(watchedValues[field.taxDeductedField] || 0)}
                            onFocus={(e) => handleNumberFocus(field.taxDeductedField, e)}
                            onChange={(e) => handleNumberInput(field.taxDeductedField, e)}
                            onBlur={(e) => handleNumberBlur(field.taxDeductedField, e)}
                          />
                        </div>

                        {/* Tax Chargeable (read-only - auto-calculated) */}
                        <div className="col-span-2">
                          <input
                            key={`${field.taxChargeableField}-${refreshKey}`}
                            type="text"
                            className={readOnlyInputClasses}
                            value={formatNumber(currentFormData[field.taxChargeableField] || watchedValues[field.taxChargeableField] || 0)}
                            readOnly
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Capital Gain Row */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-6">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Award className="w-4 h-4 inline mr-2 text-orange-600" />
                Capital Gain (from Capital Gain Form)
              </label>
            </div>
            <div className="col-span-2">
              <input
                key={`capital_gain_amount-${refreshKey}`}
                type="text"
                inputMode="numeric"
                className={`${inputClasses} bg-green-50`}
                placeholder="0"
                defaultValue={formatNumber(watchedValues.capital_gain_amount)}
                onFocus={(e) => handleNumberFocus('capital_gain_amount', e)}
                onChange={(e) => handleNumberInput('capital_gain_amount', e)}
                onBlur={(e) => handleNumberBlur('capital_gain_amount', e)}
              />
            </div>
            <div className="col-span-2">
              <input
                key={`capital_gain_tax_deducted-${refreshKey}`}
                type="text"
                inputMode="numeric"
                className={`${inputClasses} bg-green-50`}
                placeholder="0"
                defaultValue={formatNumber(watchedValues.capital_gain_tax_deducted)}
                onFocus={(e) => handleNumberFocus('capital_gain_tax_deducted', e)}
                onChange={(e) => handleNumberInput('capital_gain_tax_deducted', e)}
                onBlur={(e) => handleNumberBlur('capital_gain_tax_deducted', e)}
              />
            </div>
            <div className="col-span-2">
              <input
                key={`capital_gain_tax_chargeable-${refreshKey}`}
                type="text"
                className={readOnlyInputClasses}
                value={formatNumber(watchedValues.capital_gain_tax_chargeable)}
                readOnly
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Totals Section */}
        <div className="bg-gray-800 text-white rounded-lg p-6">
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-6">
                <h3 className="text-lg font-bold">Subtotal Tax Chargeable</h3>
                <p className="text-sm opacity-75">Sum of all tax chargeable (excluding capital gain)</p>
              </div>
              <div className="col-span-6 text-right">
                <p className="text-2xl font-bold">
                  {formatCurrency(subtotal)}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-3">
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-6">
                  <h3 className="text-xl font-bold">Grand Total Tax Chargeable</h3>
                  <p className="text-sm opacity-75">Subtotal + Capital Gain Tax Chargeable</p>
                </div>
                <div className="col-span-6 text-right">
                  <p className="text-3xl font-bold text-yellow-400">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
              </div>
            </div>
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
              {saving ? 'Saving...' : 'Save Data'}
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
