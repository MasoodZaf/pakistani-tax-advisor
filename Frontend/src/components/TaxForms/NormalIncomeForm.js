import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../contexts/TaxFormContext';
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
  Users,
  Building2,
  CreditCard,
  PiggyBank,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';

const NormalIncomeForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ 
    employerPayments: true, // Start with main section expanded
    otherSources: false 
  });
  
  const { 
    register, 
    handleSubmit, 
    watch, 
    setValue,
    formState: { errors } 
  } = useForm({
    defaultValues: getStepData('normal_income')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Define field groups matching the Excel structure
  const fieldGroups = {
    employerQuestion: {
      title: "Employment Status",
      icon: Users,
      color: "blue",
      fields: [
        { 
          key: 'multiple_employers_during_tax_year', 
          label: 'Do You have more than one employer during Tax Year', 
          field: 'multiple_employers_during_tax_year',
          type: 'select',
          options: [
            { value: '', label: 'Select' },
            { value: 'Y', label: 'Yes' },
            { value: 'N', label: 'No' }
          ]
        }
      ]
    },
    employerPayments: {
      title: "Payments by Employer", 
      icon: Building2,
      color: "green",
      subtitle: "Taxable Payments",
      fields: [
        { 
          key: 'monthly_salary', 
          label: 'Monthly Salary', 
          field: 'monthly_salary',
          type: 'currency',
          helpText: 'Enter monthly salary amount'
        },
        { 
          key: 'bonus', 
          label: 'Bonus', 
          field: 'bonus',
          type: 'currency'
        },
        { 
          key: 'taxable_value_car_provided_by_employer', 
          label: 'Taxable value of Car provided by employer', 
          field: 'taxable_value_car_provided_by_employer',
          type: 'currency'
        },
        { 
          key: 'other_taxable_payments_by_employer', 
          label: 'Other taxable payments by employer', 
          field: 'other_taxable_payments_by_employer',
          type: 'currency'
        },
        { 
          key: 'total_taxable_salary_per_salary_certificate', 
          label: 'Total Taxable Salary as per salary certificate', 
          field: 'total_taxable_salary_per_salary_certificate',
          type: 'currency',
          calculated: true
        }
      ],
      exemptFields: [
        { 
          key: 'medical_allowance', 
          label: 'Medical allowance', 
          field: 'medical_allowance',
          type: 'currency',
          helpText: 'Up to PKR 100,000 typically exempt'
        },
        { 
          key: 'employer_contribution_approved_funds', 
          label: 'Employer Contribution to Approved Funds', 
          field: 'employer_contribution_approved_funds',
          type: 'currency'
        },
        { 
          key: 'other_tax_exempt_payments_by_employer', 
          label: 'Other tax exempt payments by employer', 
          field: 'other_tax_exempt_payments_by_employer',
          type: 'currency'
        },
        { 
          key: 'total_exempt_payments', 
          label: 'Total exempt payments', 
          field: 'total_exempt_payments',
          type: 'currency',
          calculated: true
        }
      ]
    },
    otherSources: {
      title: "Income from Other Sources",
      icon: PiggyBank,
      color: "purple", 
      fields: [
        { 
          key: 'income_from_other_sources', 
          label: 'Income from other sources', 
          field: 'income_from_other_sources',
          type: 'currency'
        }
      ]
    }
  };

  // Calculate totals based on the form structure
  const calculateTotals = () => {
    // Taxable payments calculation
    const monthlySalary = parseFloat(watchedValues.monthly_salary || 0);
    const bonus = parseFloat(watchedValues.bonus || 0);
    const carValue = parseFloat(watchedValues.taxable_value_car_provided_by_employer || 0);
    const otherTaxable = parseFloat(watchedValues.other_taxable_payments_by_employer || 0);
    
    const totalTaxableSalary = monthlySalary + bonus + carValue + otherTaxable;
    
    // Exempt payments calculation
    const medicalAllowance = parseFloat(watchedValues.medical_allowance || 0);
    const employerContribution = parseFloat(watchedValues.employer_contribution_approved_funds || 0);
    const otherExempt = parseFloat(watchedValues.other_tax_exempt_payments_by_employer || 0);
    
    const totalExemptPayments = medicalAllowance + employerContribution + otherExempt;
    
    // Other income
    const otherSources = parseFloat(watchedValues.income_from_other_sources || 0);
    
    // Total gross income (this is what drives tax calculations)
    const totalGrossIncome = totalTaxableSalary + totalExemptPayments + otherSources;
    
    // Net taxable income (for final tax calculation)
    const netTaxableIncome = totalTaxableSalary + otherSources; // Exempt payments are not taxed

    return { 
      totalTaxableSalary, 
      totalExemptPayments, 
      otherSources,
      totalGrossIncome,
      netTaxableIncome,
      monthlySalary // For display purposes
    };
  };

  const totals = calculateTotals();

  // Auto-update calculated fields
  useEffect(() => {
    setValue('total_taxable_salary_per_salary_certificate', totals.totalTaxableSalary);
    setValue('total_exempt_payments', totals.totalExemptPayments);
  }, [totals.totalTaxableSalary, totals.totalExemptPayments, setValue]);

  const onSubmit = async (data) => {
    // Structure the data for backend 
    const structuredData = {
      // All form fields
      ...data,
      // Calculated totals
      total_taxable_salary_per_salary_certificate: totals.totalTaxableSalary,
      total_exempt_payments: totals.totalExemptPayments,
      total_gross_income: totals.totalGrossIncome,
      net_taxable_income: totals.netTaxableIncome,
      income_from_other_sources: totals.otherSources,
      isComplete: true
    };

    const success = await saveFormStep('normal_income', structuredData, true);
    if (success) {
      toast.success('Normal income information saved successfully');
      navigate('/tax-forms/final-min-income'); // Navigate to Final/Min Tax Income form
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const structuredData = {
      ...data,
      total_taxable_salary_per_salary_certificate: totals.totalTaxableSalary,
      total_exempt_payments: totals.totalExemptPayments,
      total_gross_income: totals.totalGrossIncome,
      net_taxable_income: totals.netTaxableIncome,
      income_from_other_sources: totals.otherSources,
      isComplete: false
    };

    const success = await saveFormStep('normal_income', structuredData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/tax-forms/final-min-income');
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
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: 'text-red-600' }
    };
    return colorMap[color] || colorMap.blue;
  };

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

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
              {group.subtitle && <span className="ml-2 text-sm font-normal opacity-75">({group.subtitle})</span>}
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
              {group.fields && group.fields.map((field) => (
                <div key={field.key} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-8">
                    <label className="text-sm font-medium text-gray-700">
                      {field.label}
                    </label>
                    {field.helpText && (
                      <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                    )}
                  </div>
                  <div className="col-span-4">
                    {field.type === 'select' ? (
                      <select
                        {...register(field.field)}
                        className="form-select w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      >
                        {field.options.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : field.calculated ? (
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-right text-sm font-semibold">
                        {formatCurrency(field.key === 'total_taxable_salary_per_salary_certificate' ? totals.totalTaxableSalary : totals.totalExemptPayments)}
                      </div>
                    ) : (
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
                    )}
                    {errors[field.field] && (
                      <p className="mt-1 text-xs text-red-600">{errors[field.field].message}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Tax Exempt Payments Subsection */}
              {group.exemptFields && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-medium text-gray-800 mb-3">Tax Exempt Payments:</h4>
                  <div className="space-y-3">
                    {group.exemptFields.map((field) => (
                      <div key={field.key} className="grid grid-cols-12 gap-3 items-center">
                        <div className="col-span-8">
                          <label className="text-sm font-medium text-gray-700">
                            {field.label}
                          </label>
                          {field.helpText && (
                            <p className="text-xs text-green-600 mt-1">{field.helpText}</p>
                          )}
                        </div>
                        <div className="col-span-4">
                          {field.calculated ? (
                            <div className="px-3 py-2 bg-green-100 border border-green-300 rounded-md text-right text-sm font-semibold">
                              {formatCurrency(totals.totalExemptPayments)}
                            </div>
                          ) : (
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
                          )}
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
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Detail of Income Subject to Normal Taxation</h1>
              <p className="text-gray-600">This is the primary income form that drives all tax calculations</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Normal Income Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• This is the <strong>primary income form</strong> that drives all tax calculations</li>
              <li>• Enter your main employment income and employer payments</li>
              <li>• Taxable payments are subject to normal tax rates</li>
              <li>• Tax exempt payments reduce your taxable income</li>
              <li>• This form feeds into the main tax calculation engine</li>
              <li>• Complete this before moving to Final/Fixed/Minimum tax income</li>
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

        {/* Dynamic Sections - All categories from Excel */}
        {Object.entries(fieldGroups).map(([key, group]) => (
          <SectionComponent key={key} groupKey={key} group={group} />
        ))}

        {/* Summary Section */}
        <div className="bg-gray-800 text-white rounded-lg p-6">
          <div className="space-y-4">
            {/* Monthly to Annual Conversion Display */}
            {totals.monthlySalary > 0 && (
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Monthly Salary Conversion:</span>
                  <span className="font-medium">
                    {formatCurrency(totals.monthlySalary)} × 12 = {formatCurrency(totals.monthlySalary * 12)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <h3 className="text-lg font-bold text-green-400">Total Gross Income</h3>
                <p className="text-2xl font-bold">{formatCurrency(totals.totalGrossIncome)}</p>
                <p className="text-sm opacity-75">All income sources</p>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-yellow-400">Net Taxable Income</h3>
                <p className="text-2xl font-bold">{formatCurrency(totals.netTaxableIncome)}</p>
                <p className="text-sm opacity-75">Subject to normal taxation</p>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm opacity-75">This income drives your main tax calculation</p>
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

export default NormalIncomeForm;