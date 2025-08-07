import React, { useState, useEffect } from 'react';
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
  Home,
  CreditCard,
  Building,
  Users,
  Info,
  DollarSign,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdjustableTaxFormComprehensive = () => {
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
    defaultValues: getStepData('adjustable_tax')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Define comprehensive field groups matching the Excel structure
  const fieldGroups = {
    employment: {
      title: "Employment and Salary",
      icon: Users,
      color: "green",
      fields: [
        { 
          key: 'salary_employees_149', 
          label: 'Salary of Employees u/s 149', 
          grossField: 'salary_employees_149_gross_receipt', 
          taxField: 'salary_employees_149_tax_collected' 
        },
        { 
          key: 'directorship_fee_149_3', 
          label: 'Directorship Fee u/s 149(3)', 
          grossField: 'directorship_fee_149_3_gross_receipt', 
          taxField: 'directorship_fee_149_3_tax_collected' 
        }
      ]
    },
    profitDebt: {
      title: "Profit on Debt",
      icon: Calculator,
      color: "blue",
      fields: [
        { 
          key: 'profit_debt_151_15', 
          label: 'Profit on Debt u/s 151 @ 15%', 
          grossField: 'profit_debt_151_15_gross_receipt', 
          taxField: 'profit_debt_151_15_tax_collected' 
        },
        { 
          key: 'profit_debt_non_resident_152_2', 
          label: 'Profit on Debt to a Non-Resident u/s 152(2)', 
          grossField: 'profit_debt_non_resident_152_2_gross_receipt', 
          taxField: 'profit_debt_non_resident_152_2_tax_collected' 
        }
      ]
    },
    banking: {
      title: "Banking",
      icon: CreditCard,
      color: "yellow",
      fields: [
        { 
          key: 'advance_tax_cash_withdrawal_231ab', 
          label: 'Advance tax on cash withdrawal u/s 231AB', 
          grossField: 'advance_tax_cash_withdrawal_231ab_gross_receipt', 
          taxField: 'advance_tax_cash_withdrawal_231ab_tax_collected' 
        }
      ]
    },
    motorVehicle: {
      title: "Motor Vehicle Related",
      icon: Car,
      color: "purple",
      fields: [
        { 
          key: 'motor_vehicle_registration_fee_231b1', 
          label: 'Motor Vehicle Registration Fee u/s 231B(1)', 
          grossField: 'motor_vehicle_registration_fee_231b1_gross_receipt', 
          taxField: 'motor_vehicle_registration_fee_231b1_tax_collected' 
        },
        { 
          key: 'motor_vehicle_transfer_fee_231b2', 
          label: 'Motor/Vehicle Transfer Fee u/s 231B(2)', 
          grossField: 'motor_vehicle_transfer_fee_231b2_gross_receipt', 
          taxField: 'motor_vehicle_transfer_fee_231b2_tax_collected' 
        },
        { 
          key: 'motor_vehicle_sale_231b3', 
          label: 'Motor Vehicle Sale u/s 231B(3)', 
          grossField: 'motor_vehicle_sale_231b3_gross_receipt', 
          taxField: 'motor_vehicle_sale_231b3_tax_collected' 
        },
        { 
          key: 'motor_vehicle_leasing_231b1a', 
          label: 'Motor/Vehicle Leasing u/s 231B(1A) (Non-ATL) @4%', 
          grossField: 'motor_vehicle_leasing_231b1a_gross_receipt', 
          taxField: 'motor_vehicle_leasing_231b1a_tax_collected' 
        },
        { 
          key: 'advance_tax_motor_vehicle_231b2a', 
          label: 'Advance tax on Motor Vehicle u/s 231B(2A)', 
          grossField: 'advance_tax_motor_vehicle_231b2a_gross_receipt', 
          taxField: 'advance_tax_motor_vehicle_231b2a_tax_collected' 
        }
      ]
    },
    utilities: {
      title: "Utility Bills",
      icon: Zap,
      color: "indigo",
      fields: [
        { 
          key: 'electricity_bill_domestic_235', 
          label: 'Electricity Bill of Domestic Consumer u/s 235', 
          grossField: 'electricity_bill_domestic_235_gross_receipt', 
          taxField: 'electricity_bill_domestic_235_tax_collected' 
        },
        { 
          key: 'telephone_bill_236_1e', 
          label: 'Telephone Bill u/s 236(1)(e)', 
          grossField: 'telephone_bill_236_1e_gross_receipt', 
          taxField: 'telephone_bill_236_1e_tax_collected' 
        },
        { 
          key: 'cellphone_bill_236_1f', 
          label: 'Cellphone Bill u/s 236(1)(f)', 
          grossField: 'cellphone_bill_236_1f_gross_receipt', 
          taxField: 'cellphone_bill_236_1f_tax_collected' 
        },
        { 
          key: 'prepaid_telephone_card_236_1b', 
          label: 'Prepaid Telephone Card u/s 236(1)(b)', 
          grossField: 'prepaid_telephone_card_236_1b_gross_receipt', 
          taxField: 'prepaid_telephone_card_236_1b_tax_collected' 
        },
        { 
          key: 'phone_unit_236_1c', 
          label: 'Phone Unit u/s 236(1)(c)', 
          grossField: 'phone_unit_236_1c_gross_receipt', 
          taxField: 'phone_unit_236_1c_tax_collected' 
        },
        { 
          key: 'internet_bill_236_1d', 
          label: 'Internet Bill u/s 236(1)(d)', 
          grossField: 'internet_bill_236_1d_gross_receipt', 
          taxField: 'internet_bill_236_1d_tax_collected' 
        },
        { 
          key: 'prepaid_internet_card_236_1e', 
          label: 'Prepaid Internet Card u/s 236(1)(e)', 
          grossField: 'prepaid_internet_card_236_1e_gross_receipt', 
          taxField: 'prepaid_internet_card_236_1e_tax_collected' 
        }
      ]
    },
    property: {
      title: "Property Related",
      icon: Home,
      color: "red",
      fields: [
        { 
          key: 'sale_transfer_immoveable_property_236c', 
          label: 'Sale/Transfer of Immoveable Property u/s 236C', 
          grossField: 'sale_transfer_immoveable_property_236c_gross_receipt', 
          taxField: 'sale_transfer_immoveable_property_236c_tax_collected' 
        },
        { 
          key: 'tax_deducted_236c_property_purchased_sold_same_year', 
          label: 'Tax Deducted u/s 236C where Property Purchased & Sold within Tax Year', 
          grossField: 'tax_deducted_236c_property_purchased_sold_same_year_gross_receipt', 
          taxField: 'tax_deducted_236c_property_purchased_sold_same_year_tax_collected' 
        },
        { 
          key: 'tax_deducted_236c_property_purchased_prior_year', 
          label: 'Tax Deducted u/s 236C where Property Purchased Prior to current Tax Year', 
          grossField: 'tax_deducted_236c_property_purchased_prior_year_gross_receipt', 
          taxField: 'tax_deducted_236c_property_purchased_prior_year_tax_collected' 
        },
        { 
          key: 'purchase_transfer_immoveable_property_236k', 
          label: 'Purchase/Transfer of Immoveable Property u/s 236K', 
          grossField: 'purchase_transfer_immoveable_property_236k_gross_receipt', 
          taxField: 'purchase_transfer_immoveable_property_236k_tax_collected' 
        }
      ]
    },
    events: {
      title: "Events and Services",
      icon: Building,
      color: "pink",
      fields: [
        { 
          key: 'functions_gatherings_charges_236cb', 
          label: 'Functions/Gatherings Charges u/s 236CB (ATL @ 10%/Non-ATL @ 20%)', 
          grossField: 'functions_gatherings_charges_236cb_gross_receipt', 
          taxField: 'functions_gatherings_charges_236cb_tax_collected' 
        },
        { 
          key: 'withholding_tax_sale_considerations_37e', 
          label: 'Withholding tax on Sale Considerations u/s 37(e) @ 10% of the value of shares', 
          grossField: 'withholding_tax_sale_considerations_37e_gross_receipt', 
          taxField: 'withholding_tax_sale_considerations_37e_tax_collected' 
        }
      ]
    },
    financial: {
      title: "Financial and International",
      icon: DollarSign,
      color: "teal",
      fields: [
        { 
          key: 'advance_fund_23a_part_i_second_schedule', 
          label: 'Advance fund u/s 23A of Part I of Second Schedule', 
          grossField: 'advance_fund_23a_part_i_second_schedule_gross_receipt', 
          taxField: 'advance_fund_23a_part_i_second_schedule_tax_collected' 
        },
        { 
          key: 'advance_tax_withdrawal_pension_fund_23a', 
          label: 'Advance tax on withdrawal of balance under Pension Fund u/s 23A of Part I of Second Schedule', 
          grossField: 'advance_tax_withdrawal_pension_fund_23a_gross_receipt', 
          taxField: 'advance_tax_withdrawal_pension_fund_23a_tax_collected' 
        },
        { 
          key: 'persons_remitting_amount_abroad_236v', 
          label: 'Persons remitting amount abroad through credit/debita/prepaid cards u/s 236V', 
          grossField: 'persons_remitting_amount_abroad_236v_gross_receipt', 
          taxField: 'persons_remitting_amount_abroad_236v_tax_collected' 
        },
        { 
          key: 'advance_tax_foreign_domestic_workers_231c', 
          label: 'Advance tax on foreign domestic workers u/s 231C', 
          grossField: 'advance_tax_foreign_domestic_workers_231c_gross_receipt', 
          taxField: 'advance_tax_foreign_domestic_workers_231c_tax_collected' 
        }
      ]
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalGrossReceipt = 0;
    let totalTaxCollected = 0;

    Object.values(fieldGroups).forEach(group => {
      group.fields.forEach(field => {
        const grossValue = parseFloat(watchedValues[field.grossField]) || 0;
        const taxValue = parseFloat(watchedValues[field.taxField]) || 0;
        totalGrossReceipt += grossValue;
        totalTaxCollected += taxValue;
      });
    });

    return { totalGrossReceipt, totalTaxCollected };
  };

  const { totalGrossReceipt, totalTaxCollected } = calculateTotals();

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_gross_receipt: totalGrossReceipt,
      total_adjustable_tax: totalTaxCollected
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
      total_gross_receipt: totalGrossReceipt,
      total_adjustable_tax: totalTaxCollected
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

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const getColorClasses = (color) => {
    const colorMap = {
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', icon: 'text-green-600' },
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: 'text-blue-600' },
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', icon: 'text-yellow-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', icon: 'text-purple-600' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', icon: 'text-indigo-600' },
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: 'text-red-600' },
      pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600', icon: 'text-pink-600' },
      teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-600', icon: 'text-teal-600' }
    };
    return colorMap[color] || colorMap.blue;
  };

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";
  const labelClasses = "block text-sm font-medium text-gray-700 mb-2";

  const SectionComponent = ({ groupKey, group }) => {
    const colors = getColorClasses(group.color);
    const IconComponent = group.icon;
    const isExpanded = expandedSections[groupKey];

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
                  <div className="col-span-6">
                    <label className="text-sm font-medium text-gray-700">
                      {field.label}
                    </label>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      {...register(field.grossField, {
                        min: { value: 0, message: 'Amount cannot be negative' },
                        valueAsNumber: true
                      })}
                      className={inputClasses}
                      placeholder="0"
                    />
                    {errors[field.grossField] && (
                      <p className="mt-1 text-xs text-red-600">{errors[field.grossField].message}</p>
                    )}
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      step="0.01"
                      {...register(field.taxField, {
                        min: { value: 0, message: 'Amount cannot be negative' },
                        valueAsNumber: true
                      })}
                      className={inputClasses}
                      placeholder="0"
                    />
                    {errors[field.taxField] && (
                      <p className="mt-1 text-xs text-red-600">{errors[field.taxField].message}</p>
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

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Adjustable Tax</h1>
              <p className="text-gray-600">Enter comprehensive withholding tax details as per certificates</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Comprehensive Adjustable Tax Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• This form covers all 27 Pakistani withholding tax categories from your certificates</li>
              <li>• Enter amounts exactly as shown in your withholding tax certificates</li>
              <li>• Each section corresponds to specific Pakistani tax law provisions</li>
              <li>• Gross Receipt: Total amount of transaction before tax</li>
              <li>• Tax Collected: Actual withholding tax amount deducted</li>
              <li>• Click on sections to expand and enter data - all sections from Excel implemented</li>
              <li>• These amounts will be adjusted against your final tax liability</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-3 items-center py-3 mb-4 bg-gray-800 text-white rounded-lg px-4">
          <div className="col-span-6">
            <h3 className="font-semibold">Description</h3>
          </div>
          <div className="col-span-3 text-center">
            <h3 className="font-semibold">Value as per Withholding Certificate</h3>
            <p className="text-sm opacity-75">Gross Receipt</p>
          </div>
          <div className="col-span-3 text-center">
            <h3 className="font-semibold">Tax Collected</h3>
          </div>
        </div>

        {/* Dynamic Sections - All 27 fields from Excel */}
        {Object.entries(fieldGroups).map(([key, group]) => (
          <SectionComponent key={key} groupKey={key} group={group} />
        ))}

        {/* Totals Section */}
        <div className="bg-gray-800 text-white rounded-lg p-6">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-6">
              <h3 className="text-xl font-bold">Total</h3>
            </div>
            <div className="col-span-3 text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(totalGrossReceipt)}
              </p>
            </div>
            <div className="col-span-3 text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(totalTaxCollected)}
              </p>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm opacity-75">This amount will be adjusted against your final tax liability</p>
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

export default AdjustableTaxFormComprehensive;