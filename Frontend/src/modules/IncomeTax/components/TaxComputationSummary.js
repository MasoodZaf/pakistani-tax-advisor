import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ArrowRight, 
  ArrowLeft, 
  Calculator,
  FileText,
  CheckCircle,
  Info,
  Download,
  Printer
} from 'lucide-react';
import toast from 'react-hot-toast';

const TaxComputationSummary = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    formData,
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  const [computationData, setComputationData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const { 
    handleSubmit, 
    watch, 
    setValue
  } = useForm({
    defaultValues: {}
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Fetch all tax computation data from database
  useEffect(() => {
    const fetchTaxComputationData = async () => {
      try {
        setLoading(true);
        
        // Use formData from context which comes from the database
        const incomeData = formData?.income || {};
        const finalMinIncomeData = formData?.finalMinIncome || {};
        const adjustableTaxData = formData?.adjustableTax || {};
        const reductionsData = formData?.reductions || {};
        const creditsData = formData?.credits || {};
        const deductionsData = formData?.deductions || {};
        const capitalGainData = formData?.capitalGain || {};
        
        // Also check for fallback data structure if formData is structured differently
        const allFormData = formData || {};
        console.log('All form data structure:', Object.keys(allFormData));
        
        // Debug logging
        console.log('Tax Computation Debug - Raw formData:', formData);
        console.log('Tax Computation Debug Data:', {
          incomeData,
          incomeDataFields: Object.keys(incomeData),
          finalMinIncomeData,
          adjustableTaxData,
          reductionsData,
          creditsData,
          deductionsData,
          capitalGainData
        });
        
        // Log specific field values for debugging
        if (incomeData && Object.keys(incomeData).length > 0) {
          console.log('Income form field debugging:', {
            total_gross_income: incomeData.total_gross_income,
            total_taxable_income: incomeData.total_taxable_income,
            salary_tax_deducted: incomeData.salary_tax_deducted,
            other_sources: incomeData.other_sources
          });
        }
        
        // Calculate tax computation
        const computation = calculateTaxComputation({
          incomeData,
          finalMinIncomeData,
          adjustableTaxData,
          reductionsData,
          creditsData,
          deductionsData,
          capitalGainData
        });
        
        setComputationData(computation);
        
        // Set form values
        Object.keys(computation).forEach(key => {
          setValue(key, computation[key]);
        });
        
      } catch (error) {
        console.error('Error fetching tax computation data:', error);
        toast.error('Failed to load tax computation data');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data if formData is available
    if (formData && Object.keys(formData).length > 0) {
      fetchTaxComputationData();
    } else {
      setLoading(false);
    }
  }, [setValue, formData]);

  // Calculate comprehensive tax computation
  const calculateTaxComputation = (data) => {
    const {
      incomeData,
      finalMinIncomeData,
      adjustableTaxData,
      reductionsData,
      creditsData,
      deductionsData,
      capitalGainData
    } = data;

    // Income Calculation - Handle both new and legacy field structures
    const incomeFromSalary = parseFloat(incomeData.total_gross_income || incomeData.total_taxable_income) || 0;
    const incomeFromOtherSources = parseFloat(incomeData.other_sources || incomeData.income_from_other_sources) || 0;
    const totalIncome = incomeFromSalary + incomeFromOtherSources;
    
    // Deductible Allowances - Handle missing deductions form gracefully
    const deductibleAllowances = parseFloat(deductionsData.total_deduction_from_income || deductionsData.total_deductions) || 0;
    
    // Taxable Income before Capital Gains
    const taxableIncomeBeforeCapitalGains = Math.max(0, totalIncome - deductibleAllowances);
    
    // Capital Gains/Loss
    const capitalGainsLoss = parseFloat(capitalGainData.total_capital_gain || capitalGainData.total_capital_gains) || 0;
    
    // Final Taxable Income including Capital Gains
    const taxableIncomeIncludingCapitalGains = taxableIncomeBeforeCapitalGains + capitalGainsLoss;
    
    // Tax Chargeable
    const normalIncomeTax = calculateNormalIncomeTax(taxableIncomeBeforeCapitalGains);
    
    // Surcharge (10% if income exceeds Rs 10m)
    const surcharge = taxableIncomeIncludingCapitalGains > 10000000 ? 
                     normalIncomeTax * 0.10 : 0;
    
    // Capital Gain Tax (CGT) - separate calculation
    const capitalGainTax = calculateCapitalGainTax(capitalGainsLoss);
    
    // Total tax including surcharge and CGT
    const normalIncomeTaxIncludingSurchargeAndCGT = normalIncomeTax + surcharge + capitalGainTax;
    
    // Tax Reductions - Handle both field name variations
    const taxReductions = parseFloat(reductionsData.total_tax_reduction || reductionsData.total_reductions) || 0;
    
    // Tax Credits - Handle both field name variations
    const taxCredits = parseFloat(creditsData.total_tax_credits || creditsData.total_credits) || 0;
    
    // Tax after reductions and credits
    const normalIncomeTaxAfterReductionCredit = Math.max(0, 
      normalIncomeTaxIncludingSurchargeAndCGT - taxReductions - taxCredits
    );
    
    // Final/Fixed/Minimum/Average/Relevant/Reduced Income Tax
    const finalIncomeTax = Math.max(600000, normalIncomeTaxAfterReductionCredit); // Minimum tax Rs 600,000
    
    // Total Tax Chargeable
    const totalTaxChargeable = finalIncomeTax;
    
    // Taxes Paid/Adjusted - Handle both adjustable_tax and income forms
    const withholdingIncomeTax = parseFloat(adjustableTaxData.total_adjustable_tax || incomeData.salary_tax_deducted) || 0;
    
    // Refund Adjustment (if any previous year refunds)
    const refundAdjustment = 0; // This would come from previous years data
    
    // Net Tax Paid/Adjusted
    const netTaxPaidAdjusted = withholdingIncomeTax + refundAdjustment;
    
    // Income Tax Demanded/(Refundable)
    const incomeTaxDemandedRefundable = totalTaxChargeable - netTaxPaidAdjusted;

    return {
      // Income Section
      income_from_salary: incomeFromSalary,
      income_from_other_sources: incomeFromOtherSources,
      total_income: totalIncome,
      
      // Deductions Section
      deductible_allowances: deductibleAllowances,
      taxable_income_before_capital_gains: taxableIncomeBeforeCapitalGains,
      capital_gains_loss: capitalGainsLoss,
      taxable_income_including_capital_gains: taxableIncomeIncludingCapitalGains,
      
      // Tax Chargeable Section
      normal_income_tax: normalIncomeTax,
      surcharge: surcharge,
      capital_gain_tax: capitalGainTax,
      normal_income_tax_including_surcharge_cgt: normalIncomeTaxIncludingSurchargeAndCGT,
      tax_reductions: taxReductions,
      tax_credits: taxCredits,
      normal_income_tax_after_reduction_credit: normalIncomeTaxAfterReductionCredit,
      final_income_tax: finalIncomeTax,
      total_tax_chargeable: totalTaxChargeable,
      
      // Taxes Paid Section
      withholding_income_tax: withholdingIncomeTax,
      refund_adjustment: refundAdjustment,
      net_tax_paid_adjusted: netTaxPaidAdjusted,
      
      // Final Result
      income_tax_demanded_refundable: incomeTaxDemandedRefundable
    };
  };

  // Calculate normal income tax using Pakistani tax slabs
  const calculateNormalIncomeTax = (taxableIncome) => {
    if (taxableIncome <= 0) return 0;
    
    // Pakistani Tax Slabs for Tax Year 2024-25 (example rates)
    const taxSlabs = [
      { min: 0, max: 600000, rate: 0.00 },
      { min: 600001, max: 1200000, rate: 0.025 },
      { min: 1200001, max: 2200000, rate: 0.125 },
      { min: 2200001, max: 3200000, rate: 0.20 },
      { min: 3200001, max: 4100000, rate: 0.225 },
      { min: 4100001, max: Infinity, rate: 0.325 }
    ];
    
    let tax = 0;
    let remainingIncome = taxableIncome;
    
    for (const slab of taxSlabs) {
      if (remainingIncome <= 0) break;
      
      const slabSize = Math.min(slab.max - slab.min + 1, remainingIncome);
      const taxableInThisSlab = Math.min(slabSize, remainingIncome);
      
      if (taxableInThisSlab > 0) {
        tax += taxableInThisSlab * slab.rate;
        remainingIncome -= taxableInThisSlab;
      }
    }
    
    return Math.round(tax);
  };

  // Calculate capital gain tax (simplified)
  const calculateCapitalGainTax = (capitalGains) => {
    // This would be calculated based on different CGT rates
    // For now, using a simplified calculation
    return capitalGains * 0.15; // 15% average rate
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('tax_computation', data, true);
    if (success) {
      toast.success('Tax return completed successfully!');
      navigate('/tax-forms');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const success = await saveFormStep('tax_computation', data, false);
    if (success) {
      toast.success('Tax computation saved');
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calculator className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Calculating tax computation...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no data is available
  if (!computationData) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tax Data Available</h3>
            <p className="text-gray-600 mb-4">Please complete some tax forms first to see the computation summary.</p>
            <button
              onClick={() => navigate('/tax-forms')}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to Tax Forms
            </button>
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
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Computation</h1>
              <p className="text-gray-600">Complete tax calculation summary based on all entered data</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <Info className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="flex items-center px-4 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
            <button
              type="button"
              className="flex items-center px-4 py-2 text-green-600 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Tax Computation Summary Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• This is the final tax computation based on all your entered data</li>
              <li>• <strong>Income</strong>: Total income from all sources</li>
              <li>• <strong>Deductible Allowances</strong>: Professional expenses and Zakat deductions</li>
              <li>• <strong>Tax Chargeable</strong>: Calculated tax using Pakistani tax slabs</li>
              <li>• <strong>Surcharge</strong>: 10% additional tax if income exceeds Rs 10 million</li>
              <li>• <strong>Final Result</strong>: Tax payable or refundable amount</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tax Computation Table */}
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-blue-600 text-white py-3 px-4">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Tax Computation
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {/* Header Row */}
            <div className="bg-blue-100 grid grid-cols-12 gap-4 py-3 px-4 font-semibold text-blue-900">
              <div className="col-span-8">Description</div>
              <div className="col-span-4 text-right">Amount PKR</div>
            </div>

            {/* Income Section */}
            <div className="py-2 px-4">
              <h3 className="font-semibold text-gray-800 mb-2">Income</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Income from Salary</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.income_from_salary)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Income / (Loss) from Other Sources</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.income_from_other_sources)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Total Income</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency(computationData?.total_income)}
              </div>
            </div>

            {/* Deductions Section */}
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Deductible Allowances</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.deductible_allowances)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Taxable Income before capital gains/(loss)</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency(computationData?.taxable_income_before_capital_gains)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Gains / (Loss) from Capital Assets</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.capital_gains_loss)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Taxable Income including capital gains/(loss)</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency(computationData?.taxable_income_including_capital_gains)}
              </div>
            </div>

            {/* Tax Chargeable Section */}
            <div className="py-2 px-4">
              <h3 className="font-semibold text-gray-800 mb-2">Tax Chargeable</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Normal Income Tax</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.normal_income_tax)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Surcharge (10% of Income Tax where income exceed Rs 10m)</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.surcharge)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Capital Gain Tax (CGT)</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.capital_gain_tax)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Normal Income Tax including Surcharge and CGT</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency(computationData?.normal_income_tax_including_surcharge_cgt)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Tax Reductions</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.tax_reductions)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Tax Credits</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.tax_credits)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Normal Income Tax after Tax Reduction/Credit</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency(computationData?.normal_income_tax_after_reduction_credit)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Final / Fixed / Minimum / Average / Relevant / Reduced Income Tax</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.final_income_tax)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-green-50 font-bold border-2 border-green-200">
              <div className="col-span-8 text-green-900">Total Tax Chargeable</div>
              <div className="col-span-4 text-right font-mono text-green-900 text-lg">
                {formatCurrency(computationData?.total_tax_chargeable)}
              </div>
            </div>

            {/* Taxes Paid Section */}
            <div className="py-2 px-4">
              <h3 className="font-semibold text-gray-800 mb-2">Taxes Paid/Adjusted</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Withholding Income Tax</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.withholding_income_tax)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Refund Adjustment of Other Year(s) against Demand of this Year</div>
              <div className="col-span-4 text-right font-mono">
                {formatCurrency(computationData?.refund_adjustment)}
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Net Tax Paid/Adjusted</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency(computationData?.net_tax_paid_adjusted)}
              </div>
            </div>

            {/* Final Result */}
            <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-red-50 font-bold border-2 border-red-200">
              <div className="col-span-8 text-red-900 text-lg">Income Tax Demanded /(Refundable)</div>
              <div className="col-span-4 text-right font-mono text-red-900 text-xl">
                {computationData?.income_tax_demanded_refundable >= 0 ? 
                  formatCurrency(computationData?.income_tax_demanded_refundable) :
                  `(${formatCurrency(Math.abs(computationData?.income_tax_demanded_refundable))})`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center space-x-3 px-6 py-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <span className="text-green-800 font-medium">
              Tax Computation Complete
            </span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/wealth')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Wealth Statement
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving}
              className="flex items-center px-6 py-3 text-primary-600 bg-primary-100 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Summary'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Complete Tax Return
              <CheckCircle className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TaxComputationSummary;