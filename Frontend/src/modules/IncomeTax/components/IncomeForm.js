import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

const IncomeForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    saving
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);
  const [incomeData, setIncomeData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    paymentsEmployer: true,
    nonCashBenefits: true,
    otherIncomeMinTax: true,
    otherIncomeNoMinTax: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Format number with commas for display
  const formatNumber = (value) => {
    if (!value || value === 0) return '';
    const intValue = Math.abs(Math.round(parseFloat(value) || 0));
    return new Intl.NumberFormat('en-US').format(intValue);
  };

  // Convert value to integer for storage
  const parseToInteger = (value) => {
    if (!value) return 0;
    return Math.abs(Math.round(parseFloat(String(value).replace(/,/g, '')) || 0));
  };

  // Process income data to exclude calculated fields and format for display
  const processIncomeData = (rawData) => {
    if (!rawData) return {};

    const processedData = {};

    // Handle monthly fields - convert annual values back to monthly for form display
    const monthlyFields = [
      { frontend: 'monthly_basic_salary', backend: 'annual_basic_salary' },
      { frontend: 'monthly_allowances', backend: 'allowances' },
    ];

    monthlyFields.forEach(({ frontend, backend }) => {
      if (rawData[backend] !== undefined && rawData[backend] !== null) {
        const annualValue = parseFloat(rawData[backend]) || 0;
        const monthlyValue = Math.abs(Math.round(annualValue / 12));
        console.log(`Processing ${frontend}: annual=${annualValue} -> monthly=${monthlyValue}`);
        processedData[frontend] = monthlyValue > 0 ? formatNumber(monthlyValue) : '';
      } else {
        processedData[frontend] = '';
      }
    });

    // Handle direct annual fields (no conversion needed)
    const annualFields = [
      'bonus',
      'medical_allowance',
      'pension_from_ex_employer',
      'employment_termination_payment',
      'retirement_from_approved_funds',
      'directorship_fee',
      'other_cash_benefits',
      'employer_contribution_provident',
      'taxable_car_value',
      'other_taxable_subsidies',
      'profit_on_debt_15_percent',
      'profit_on_debt_12_5_percent',
      'other_taxable_income_rent',
      'other_taxable_income_others'
    ];

    annualFields.forEach(field => {
      if (rawData[field] !== undefined && rawData[field] !== null) {
        const value = parseFloat(rawData[field]) || 0;
        const numericValue = Math.abs(Math.round(value));
        console.log(`Processing ${field}: raw=${rawData[field]} -> parsed=${value} -> numeric=${numericValue}`);
        processedData[field] = numericValue > 0 ? formatNumber(numericValue) : '';
      } else {
        processedData[field] = '';
      }
    });

    console.log('Final processedData:', processedData);
    return processedData;
  };

  const {
    register,
    handleSubmit,
    watch,
    reset
  } = useForm({
    defaultValues: processIncomeData(incomeData)
  });

  const watchedValues = watch();

  // Load income form data from API - use the same endpoint that handles saving
  useEffect(() => {
    const loadIncomeData = async () => {
      try {
        setDataLoading(true);
        // Use the working income-form API directly
        const response = await axios.get('/api/income-form/2025-26');

        // Extract income form data from the response
        const incomeFormData = response.data || {};
        console.log('RAW API RESPONSE:', incomeFormData);
        console.log('Allowances from API:', incomeFormData.allowances);
        console.log('Bonus from API:', incomeFormData.bonus);
        setIncomeData(incomeFormData);

        // Reset form with the loaded data
        const formattedData = processIncomeData(incomeFormData);
        console.log('PROCESSED FORM DATA:', formattedData);
        console.log('Allowances processed:', formattedData.allowances);
        console.log('Bonus processed:', formattedData.bonus);
        reset(formattedData);

        console.log('Income data loaded successfully:', incomeFormData);
      } catch (error) {
        console.error('Error loading income data:', error);
        toast.error('Failed to load income form data');
      } finally {
        setDataLoading(false);
      }
    };

    loadIncomeData();
  }, [reset]);

  // Calculate totals based on Excel formula logic - EXACTLY matching XlCal.md
  const calculateTotals = () => {
    // Parse all input values - converting monthly to annual where needed
    const monthlyBasicSalary = parseToInteger(watchedValues.monthly_basic_salary) || 0;
    const monthlyAllowances = parseToInteger(watchedValues.monthly_allowances) || 0;

    // Excel formulas: B6: 600000*12, B7: 500000*12
    const annualBasicSalary = monthlyBasicSalary * 12;
    const allowances = monthlyAllowances * 12;

    const bonus = parseToInteger(watchedValues.bonus) || 0;
    const medicalAllowance = parseToInteger(watchedValues.medical_allowance) || 0;
    const pensionFromExEmployer = parseToInteger(watchedValues.pension_from_ex_employer) || 0;
    const employmentTerminationPayment = parseToInteger(watchedValues.employment_termination_payment) || 0;
    const retirementAmount = parseToInteger(watchedValues.retirement_from_approved_funds) || 0;
    const directorshipFee = parseToInteger(watchedValues.directorship_fee) || 0;
    const otherCashBenefits = parseToInteger(watchedValues.other_cash_benefits) || 0;

    // Excel formula B15: -B12-B11-B9 = -(retirement + termination + medical)
    const incomeExemptFromTax = -(retirementAmount + employmentTerminationPayment + medicalAllowance);

    // Excel formula B16: SUM(B6:B15) - Annual Salary and Wages Total
    const annualSalaryWagesTotal = annualBasicSalary + allowances + bonus + medicalAllowance +
                                   pensionFromExEmployer + employmentTerminationPayment + retirementAmount +
                                   directorshipFee + otherCashBenefits + incomeExemptFromTax;

    // Non Cash Benefits
    const employerContributionFunds = parseToInteger(watchedValues.employer_contribution_provident) || 0;
    const taxableCarValue = parseToInteger(watchedValues.taxable_car_value) || 0;
    const otherTaxableSubsidies = parseToInteger(watchedValues.other_taxable_subsidies) || 0;

    // Excel formula B22: -(MIN(B19,150000)) = -150,000 max exemption
    const providentExemption = -Math.min(employerContributionFunds, 150000);

    // Excel formula B23: SUM(B19:B22)
    const totalNonCashBenefits = employerContributionFunds + taxableCarValue + otherTaxableSubsidies + providentExemption;

    // Total Employment Income - new calculated field for database
    const totalEmploymentIncome = annualSalaryWagesTotal + totalNonCashBenefits;

    // Other Income (Subject to minimum tax)
    const profitOnDebt15 = parseToInteger(watchedValues.profit_on_debt_15_percent) || 0;
    const profitOnDebt125 = parseToInteger(watchedValues.profit_on_debt_12_5_percent) || 0;

    // Excel formula B28: B26+B27
    const totalOtherIncomeMinTax = profitOnDebt15 + profitOnDebt125;

    // Other Income (Not Subject to minimum tax)
    const rentIncome = parseToInteger(watchedValues.other_taxable_income_rent) || 0;
    const otherTaxableIncomeOthers = parseToInteger(watchedValues.other_taxable_income_others) || 0;

    // Excel formula B33: B31+B32
    const totalOtherIncomeNoMinTax = rentIncome + otherTaxableIncomeOthers;

    return {
      // Excel calculated fields
      annualBasicSalary,
      allowances,
      incomeExemptFromTax,
      annualSalaryWagesTotal,
      providentExemption,
      totalNonCashBenefits,
      totalEmploymentIncome, // New database field
      totalOtherIncomeMinTax,
      totalOtherIncomeNoMinTax
    };
  };

  const totals = calculateTotals();

  const onSubmit = async (data) => {
    const structuredData = {
      ...data,
      // Convert monthly to annual values for database storage
      annual_basic_salary: totals.annualBasicSalary,
      allowances: totals.allowances,
      // Calculated fields matching database schema
      income_exempt_from_tax: totals.incomeExemptFromTax,
      annual_salary_wages_total: totals.annualSalaryWagesTotal,
      total_employment_income: totals.totalEmploymentIncome,
      non_cash_benefit_exempt: totals.providentExemption,
      total_non_cash_benefits: totals.totalNonCashBenefits,
      other_income_min_tax_total: totals.totalOtherIncomeMinTax,
      other_income_no_min_tax_total: totals.totalOtherIncomeNoMinTax,
      isComplete: true
    };

    const success = await saveFormStep('income', structuredData, true);
    if (success) {
      toast.success('Income information saved successfully - Excel calculations applied');
      navigate('/tax-forms/adjustable-tax');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const structuredData = {
      ...data,
      // Convert monthly to annual values for database storage
      annual_basic_salary: totals.annualBasicSalary,
      allowances: totals.allowances,
      // Calculated fields matching database schema
      income_exempt_from_tax: totals.incomeExemptFromTax,
      annual_salary_wages_total: totals.annualSalaryWagesTotal,
      total_employment_income: totals.totalEmploymentIncome,
      non_cash_benefit_exempt: totals.providentExemption,
      total_non_cash_benefits: totals.totalNonCashBenefits,
      other_income_min_tax_total: totals.totalOtherIncomeMinTax,
      other_income_no_min_tax_total: totals.totalOtherIncomeNoMinTax,
      isComplete: false
    };

    const success = await saveFormStep('income', structuredData, false);
    if (success) {
      toast.success('Progress saved with Excel calculations');
      navigate('/tax-forms/adjustable-tax');
    }
  };

  const inputClasses = "form-input w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm font-medium";

  const displayClasses = "h-10 px-3 py-2 border border-gray-300 rounded-md text-right text-sm font-medium flex items-center justify-end";

  const inputLabelClasses = "text-xs text-gray-500 mt-1 text-center h-4";

  const formatDisplayNumber = (value) => {
    if (!value || value === 0) return '';
    return new Intl.NumberFormat('en-US').format(Math.abs(value));
  };

  // Show loading state while data is being fetched
  if (dataLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <p className="text-gray-600">Loading income form data...</p>
          </div>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900">Detail of Income Subject to Normal Taxation</h1>
              <p className="text-gray-600">Enter your annual income details for tax year</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Income Form Instructions</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Enter amounts in PKR without commas (e.g., 1000000 for 10 lakh)</li>
              <li>• Fields marked "Please Input" require your data entry</li>
              <li>• Calculated fields are automatically computed</li>
              <li>• All values are displayed with comma formatting for readability</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Main Table */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">

          {/* Table Header */}
          <div className="bg-blue-900 text-white">
            <div className="grid grid-cols-12 p-4">
              <div className="col-span-8">
                <h2 className="text-lg font-bold">Description</h2>
              </div>
              <div className="col-span-4 text-center">
                <h2 className="text-lg font-bold">Annual Value in PKR</h2>
              </div>
            </div>
          </div>

          {/* Payments By Employer Section */}
          <div
            className="bg-gray-100 p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() => toggleSection('paymentsEmployer')}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Payments By Employer</h3>
              {expandedSections.paymentsEmployer ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </div>
          </div>

          {expandedSections.paymentsEmployer && (
            <>
          {/* Annual Salary and Wages Subsection */}
          <div className="bg-gray-50 p-2 border-b border-gray-200">
            <h4 className="font-medium text-gray-700">Annual Salary and Wages</h4>
          </div>

          {/* Monthly Basic Salary (will be multiplied by 12) */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Monthly Basic Salary (will be converted to annual)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('monthly_basic_salary', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input Monthly</div>
            </div>
          </div>

          {/* Monthly Allowances (will be multiplied by 12) */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Monthly Allowances (excluding bonus and medical allowance)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('monthly_allowances', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input Monthly</div>
            </div>
          </div>

          {/* Annual Basic Salary - Calculated Display */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800 font-medium">Annual Basic Salary (Monthly × 12)</label>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-blue-100 border-blue-300`}>
                {formatDisplayNumber(totals.annualBasicSalary)}
              </div>
            </div>
          </div>

          {/* Annual Allowances - Calculated Display */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800 font-medium">Annual Allowances (Monthly × 12)</label>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-blue-100 border-blue-300`}>
                {formatDisplayNumber(totals.allowances)}
              </div>
            </div>
          </div>

          {/* Bonus */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Bonus</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('bonus', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Medical allowance */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Medical allowance (Where medical facility not provided by employer)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('medical_allowance', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Pension received from ex-employer */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Pension received from ex-employer</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('pension_from_ex_employer', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Employment Termination payment */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Employment Termination payment (Section 12 (2) e iii)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('employment_termination_payment', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Amount received on retirement - highlighted in yellow */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200">
            <div className="col-span-8">
              <label className="text-gray-800">Amount received on retirement from approved funds (Provident, pension, gratuity)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('retirement_from_approved_funds', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Directorship Fee - highlighted in yellow */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200">
            <div className="col-span-8">
              <label className="text-gray-800">Directorship Fee u/s 149(3)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('directorship_fee', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Other cash benefits */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Other cash benefits (LFA, Children education, etc.)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('other_cash_benefits', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Income Exempt from tax - Calculated Field */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-gray-50">
            <div className="col-span-8">
              <label className="text-gray-800">Income Exempt from tax</label>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-gray-100`}>
                ({formatDisplayNumber(Math.abs(totals.incomeExemptFromTax))})
              </div>
            </div>
          </div>

          {/* Annual Salary and Wages Total - Calculated Field (Excel B16) */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-300 bg-green-50">
            <div className="col-span-8">
              <label className="font-bold text-green-800">Annual Salary and Wages Total</label>
              <div className="text-xs text-gray-600 mt-1">SUM of all above fields (Excel Formula B16)</div>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-green-100 border-green-300 font-bold text-lg`}>
                {formatDisplayNumber(totals.annualSalaryWagesTotal)}
              </div>
            </div>
          </div>
            </>
          )}

          {/* Non cash benefits Section Header */}
          <div
            className="bg-gray-100 p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() => toggleSection('nonCashBenefits')}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Non cash benefits</h3>
              {expandedSections.nonCashBenefits ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </div>
          </div>

          {expandedSections.nonCashBenefits && (
            <>
          {/* Employer Contribution to Approved Provident Funds */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Employer Contribution to Approved Provident Funds</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('employer_contribution_provident', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Taxable value of Car provided by employer */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Taxable value of Car provided by employer</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('taxable_car_value', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Other taxable subsidies and non cash benefits */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 hover:bg-blue-50">
            <div className="col-span-8">
              <label className="text-gray-800">Other taxable subsidies and non cash benefits</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('other_taxable_subsidies', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Non cash benefit exempt from tax - Calculated Field (Excel B22) */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-gray-50">
            <div className="col-span-8">
              <label className="text-gray-800">Non cash benefit exempt from tax</label>
              <div className="text-xs text-gray-600 mt-1">-MIN(Provident, 150,000) - Excel Formula B22</div>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-gray-100`}>
                ({formatDisplayNumber(Math.abs(totals.providentExemption))})
              </div>
            </div>
          </div>

          {/* Total non cash benefits - Calculated Field (Excel B23) */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-purple-50">
            <div className="col-span-8">
              <label className="font-bold text-purple-800">Total non cash benefits</label>
              <div className="text-xs text-gray-600 mt-1">SUM(B19:B22) - Excel Formula B23</div>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-purple-100 border-purple-300 font-bold`}>
                {formatDisplayNumber(totals.totalNonCashBenefits)}
              </div>
            </div>
          </div>

          {/* Total Employment Income - New Database Field */}
          <div className="grid grid-cols-12 p-4 border-b border-gray-300 bg-indigo-50">
            <div className="col-span-8">
              <label className="font-bold text-indigo-900 text-lg">Total Employment Income</label>
              <div className="text-xs text-gray-700 mt-1">Annual Salary + Non-Cash Benefits (Database Field)</div>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-indigo-100 border-indigo-400 font-bold text-lg`}>
                {formatDisplayNumber(totals.totalEmploymentIncome)}
              </div>
            </div>
          </div>
            </>
          )}

          {/* Other Income (Subject to minimum tax) Section Header */}
          <div
            className="bg-gray-100 p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() => toggleSection('otherIncomeMinTax')}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Other Income (Subject to minimum tax)</h3>
              {expandedSections.otherIncomeMinTax ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </div>
          </div>

          {expandedSections.otherIncomeMinTax && (
            <>
          {/* Profit on Debt u/s 151 @ 15% - highlighted in yellow */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200">
            <div className="col-span-8">
              <label className="text-gray-800">Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('profit_on_debt_15_percent', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Profit on Debt u/s 151A @ 12.5% - highlighted in yellow */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200">
            <div className="col-span-8">
              <label className="text-gray-800">Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('profit_on_debt_12_5_percent', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Total Other Income (Subject to minimum tax) - Calculated Field */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-300 bg-yellow-50">
            <div className="col-span-8">
              <label className="font-bold text-yellow-800"></label>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-yellow-100 border-yellow-300 font-bold`}>
                {formatDisplayNumber(totals.totalOtherIncomeMinTax)}
              </div>
            </div>
          </div>
            </>
          )}

          {/* Other Income (Not Subject to minimum tax) Section Header */}
          <div
            className="bg-gray-100 p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() => toggleSection('otherIncomeNoMinTax')}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Other Income (Not Subject to minimum tax)</h3>
              {expandedSections.otherIncomeNoMinTax ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </div>
          </div>

          {expandedSections.otherIncomeNoMinTax && (
            <>
          {/* Other taxable income - Rent income - highlighted in yellow */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200">
            <div className="col-span-8">
              <label className="text-gray-800">Other taxable income - Rent income</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('other_taxable_income_rent', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Other taxable income - Others - highlighted in yellow */}
          <div className="grid grid-cols-12 p-3 border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200">
            <div className="col-span-8">
              <label className="text-gray-800">Other taxable income - Others</label>
            </div>
            <div className="col-span-4">
              <input
                type="text"
                {...register('other_taxable_income_others', {
                  setValueAs: parseToInteger,
                })}
                className={inputClasses}
                placeholder="0"
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '');
                  if (!isNaN(numericValue) && numericValue !== '') {
                    e.target.value = formatNumber(numericValue);
                  }
                }}
              />
              <div className={inputLabelClasses}>Please Input</div>
            </div>
          </div>

          {/* Other taxable income - Total - Calculated Field */}
          <div className="grid grid-cols-12 p-4 border-b border-gray-300 bg-yellow-50">
            <div className="col-span-8">
              <label className="font-bold text-yellow-800 text-lg">Other taxable income - Total</label>
            </div>
            <div className="col-span-4">
              <div className={`${displayClasses} bg-yellow-100 border-yellow-300 font-bold text-lg`}>
                {formatDisplayNumber(totals.totalOtherIncomeNoMinTax)}
              </div>
            </div>
          </div>
            </>
          )}

        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200 mt-8">
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