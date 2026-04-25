import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
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
import HelpHint from '../../../components/Help/HelpHint';
import taxComputationHelp from '../../../help/taxComputationHelp';

const TaxComputationSummary = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    formData,
    saving
  } = useTaxForm();
  const { currentTaxYear } = useTaxYear();
  const { rates, error: ratesError } = useTaxRates(currentTaxYear);

  const [showHelp, setShowHelp] = useState(false);
  const [computationData, setComputationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refundAdjustment, setRefundAdjustment] = useState(0);
  // Component-level capital gain data derived from context formData
  const capitalGainData = formData?.capital_gain || {};
  
  const { 
 
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
        // Keys match TaxFormContext FORM_STEPS[].id values
        const incomeData = formData?.income || {};
        const finalMinIncomeData = formData?.final_min_income || {};
        const adjustableTaxData = formData?.adjustable_tax || {};
        const reductionsData = formData?.reductions || {};
        const creditsData = formData?.credits || {};
        const deductionsData = formData?.deductions || {};
        const capitalGainData = formData?.capital_gain || {};
        const finalTaxData = formData?.final_tax || {};
        
        // Calculate tax computation
        const computation = calculateTaxComputation({
          incomeData,
          finalMinIncomeData,
          adjustableTaxData,
          reductionsData,
          creditsData,
          deductionsData,
          capitalGainData,
          finalTaxData
        });
        
        setComputationData(computation);

        // Restore saved refund adjustment from prior tax_computation save
        const savedRefundAdj = parseFloat(formData?.tax_computation?.refund_adjustment) || 0;
        setRefundAdjustment(savedRefundAdj);

        // Set form values
        Object.keys(computation).forEach(key => {
          setValue(key, computation[key]);
        });
        
      } catch (error) {
        toast.error('Failed to load tax computation data');
      } finally {
        setLoading(false);
      }
    };

    // Compute only when rates are loaded AND formData is present — rates source
    // slabs + surcharge + super-tax, so running without them would yield zeros.
    if (rates && formData && Object.keys(formData).length > 0) {
      fetchTaxComputationData();
    } else if (!rates && ratesError) {
      // Rates failed to load — keep showing a friendly error via the !computationData branch.
      setLoading(false);
    }
  }, [setValue, formData, rates, ratesError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate comprehensive tax computation
  const calculateTaxComputation = (data) => {
    const {
      incomeData,
      finalMinIncomeData,
      adjustableTaxData,
      reductionsData,
      creditsData,
      deductionsData,
      capitalGainData,
      finalTaxData = {}
    } = data;

    // Income Calculation — IncomeForm saves: total_employment_income, annual_salary_wages_total
    const incomeFromSalary = parseFloat(
      incomeData.total_employment_income ||
      incomeData.annual_salary_wages_total ||
      incomeData.total_gross_income ||
      incomeData.total_taxable_income
    ) || 0;
    const incomeFromOtherSources = parseFloat(
      incomeData.other_income_no_min_tax_total ||
      incomeData.other_sources ||
      incomeData.income_from_other_sources
    ) || 0;
    const totalIncome = incomeFromSalary + incomeFromOtherSources;
    
    // Deductible Allowances - Handle missing deductions form gracefully
    const deductibleAllowances = parseFloat(deductionsData.total_deduction_from_income || deductionsData.total_deductions) || 0;
    
    // Taxable Income before Capital Gains
    const taxableIncomeBeforeCapitalGains = Math.max(0, totalIncome - deductibleAllowances);
    
    // Capital Gains/Loss
    const capitalGainsLoss = parseFloat(capitalGainData.total_capital_gain || capitalGainData.total_capital_gains) || 0;
    
    // Final Taxable Income including Capital Gains
    const taxableIncomeIncludingCapitalGains = taxableIncomeBeforeCapitalGains + capitalGainsLoss;
    
    // Tax Chargeable — progressive slabs sourced from DB (useTaxRates).
    const normalIncomeTax = calculateNormalIncomeTax(taxableIncomeBeforeCapitalGains);

    // Surcharge — rate + threshold sourced from DB, not hardcoded.
    const surchargeRate = rates?.surcharge?.rate ?? 0;
    const surchargeThreshold = rates?.surcharge?.threshold ?? Infinity;
    const surcharge = taxableIncomeIncludingCapitalGains > surchargeThreshold
      ? Math.round(normalIncomeTax * surchargeRate)
      : 0;
    
    // Capital Gain Tax (CGT) - separate calculation
    const capitalGainTax = calculateCapitalGainTax(capitalGainsLoss);
    
    // Total tax including surcharge and CGT
    const normalIncomeTaxIncludingSurchargeAndCGT = normalIncomeTax + surcharge + capitalGainTax;
    
    // Tax Reductions - Handle both field name variations
    const taxReductions = parseFloat(reductionsData.total_tax_reduction || reductionsData.total_reductions) || 0;
    
    // Tax Credits — prefer total_credits (DB-computed column) over plain total_tax_credits field
    const taxCredits = parseFloat(creditsData.total_credits || creditsData.total_tax_credits) || 0;
    
    // Tax after reductions and credits
    const normalIncomeTaxAfterReductionCredit = Math.max(0, 
      normalIncomeTaxIncludingSurchargeAndCGT - taxReductions - taxCredits
    );
    
    // Final/Min tax from Final/Min Income form (D20 in Excel = grand total tax chargeable)
    const finalMinTax = parseFloat(finalMinIncomeData.grand_total_tax_chargeable) || 0;
    // Total tax is the higher of computed normal tax or final/min tax (FBR minimum tax rules)
    const finalIncomeTax = Math.max(normalIncomeTaxAfterReductionCredit, finalMinTax);

    // Super Tax u/s 4C (Finance Act 2025) — charged on persons with income > Rs 150M
    // Flat rate on total income (not just the excess) per Division IIA, Part I, First Schedule
    const superTax = calculateSuperTax(taxableIncomeIncludingCapitalGains);

    // Total Tax Chargeable = income tax (after reductions/credits) + super tax
    const totalTaxChargeable = finalIncomeTax + superTax;
    
    // Final Tax (Sukuk, bonds etc.) — already paid at source, reduces balance
    const finalTaxPaid = parseFloat(finalTaxData.total_final_tax) || 0;

    // Taxes Paid/Adjusted — total_adjustable_tax is a DB-computed column returned in formData
    const adjustableTax = parseFloat(adjustableTaxData.total_adjustable_tax) || 0;
    // Fallback: sum key adjustable tax fields if total not available yet
    const adjustableTaxFallback = adjustableTax || (
      parseFloat(adjustableTaxData.salary_employees_149_tax_collected || 0) +
      parseFloat(adjustableTaxData.directorship_fee_149_3_tax_collected || 0) +
      parseFloat(adjustableTaxData.profit_debt_151_15_tax_collected || 0) +
      parseFloat(adjustableTaxData.profit_debt_sukook_151a_tax_collected || 0) +
      parseFloat(adjustableTaxData.tax_deducted_rent_section_155_tax_collected || 0)
    );
    const withholdingIncomeTax = adjustableTaxFallback || parseFloat(incomeData.salary_tax_deducted) || 0;
    
    // Refund Adjustment — populated from saved data or user input; not computed here
    const refundAdjustmentValue = 0; // placeholder; actual value handled via refundAdjustment state

    // Net Tax Paid/Adjusted (adjustable WHT + final tax already paid at source)
    const netTaxPaidAdjusted = withholdingIncomeTax + finalTaxPaid + refundAdjustmentValue;

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
      super_tax: superTax,
      total_tax_chargeable: totalTaxChargeable,

      // Taxes Paid Section — refund_adjustment handled separately via state
      withholding_income_tax: withholdingIncomeTax,
      final_tax_paid: finalTaxPaid,
      base_net_tax_paid: withholdingIncomeTax + finalTaxPaid  // without refund adj; applied in JSX
    };
  };

  // Normal income tax — slabs loaded from DB via useTaxRates (no hardcoded array).
  // Uses the same cumulative-marginal method as the backend CalculationService.
  const calculateNormalIncomeTax = (taxableIncome) => {
    if (!rates?.slabs || taxableIncome <= 0) return 0;
    let total = 0;
    for (const slab of rates.slabs) {
      const minI = Number(slab.min_income);
      const maxI = slab.max_income === null || slab.max_income === undefined
        ? Number.POSITIVE_INFINITY
        : Number(slab.max_income);
      const rate = Number(slab.tax_rate);
      const effectiveLower = minI > 0 ? minI - 1 : 0;
      if (taxableIncome <= effectiveLower) continue;
      const ceiling = Math.min(taxableIncome, maxI);
      const taxableAtThisSlab = ceiling - effectiveLower;
      if (taxableAtThisSlab > 0 && rate > 0) total += taxableAtThisSlab * rate;
    }
    return Math.round(total);
  };

  // Super Tax u/s 4C — brackets loaded from DB via useTaxRates.
  // Flat rate applied to TOTAL taxable income when within a bracket.
  const calculateSuperTax = (income) => {
    if (!rates?.superTax?.length || income <= 0) return 0;
    for (const b of rates.superTax) {
      if (income >= b.minIncome && income <= b.maxIncome) {
        return Math.round(income * b.rate);
      }
    }
    return 0;
  };

  // Gross CGT lookup — three-tier fallback:
  // 1. total_capital_gain_tax  — persisted after migration add-capital-gain-tax-column.sql is run
  // 2. total_capital_gains_tax — DB legacy computed column (old aggregate fields, usually 0 with new form)
  // 3. Reconstruct: net CGT (capital_gains_tax_chargeable) + total WHT deducted (total_tax_deducted)
  //    Works because: gross = net + total_tax_deducted (by definition, assuming no negative CGT)
  const calculateCapitalGainTax = (_capitalGains) => {
    const direct = parseFloat(capitalGainData.total_capital_gain_tax) ||
                   parseFloat(capitalGainData.total_capital_gains_tax);
    if (direct) return Math.round(direct);
    const net     = parseFloat(capitalGainData.capital_gains_tax_chargeable) || 0;
    const deducted= parseFloat(capitalGainData.total_tax_deducted)            || 0;
    return Math.round(net + deducted);
  };

  // Build a payload containing ONLY snake_case fields that exist in tax_computation_forms DB schema.
  // computationData uses frontend field names that don't always match DB column names.
  const buildComputationPayload = () => {
    const netPaid  = (computationData?.base_net_tax_paid   || 0) + refundAdjustment;
    const demanded = (computationData?.total_tax_chargeable || 0) - netPaid;
    return {
      // Income section
      income_from_salary:        computationData?.income_from_salary        || 0,
      income_from_other_sources: computationData?.income_from_other_sources || 0,
      total_income:              (computationData?.income_from_salary || 0) + (computationData?.income_from_other_sources || 0),
      deductible_allowances:     computationData?.deductible_allowances     || 0,
      capital_gains_loss:        computationData?.capital_gains_loss        || 0,
      // Tax chargeable section — surcharge has two DB columns (surcharge + surcharge_amount)
      normal_income_tax:  computationData?.normal_income_tax  || 0,
      surcharge:          computationData?.surcharge          || 0,
      surcharge_amount:   computationData?.surcharge          || 0,
      capital_gain_tax:   computationData?.capital_gain_tax   || 0,
      capital_gains_tax:  computationData?.capital_gain_tax   || 0,
      tax_reductions:     computationData?.tax_reductions     || 0,
      tax_credits:        computationData?.tax_credits        || 0,
      super_tax:          computationData?.super_tax          || 0,
      // Taxes paid
      advance_tax_paid:            computationData?.withholding_income_tax || 0,
      total_tax_paid:              netPaid,
      total_tax_paid_with_advance: netPaid,
      tax_payable_refundable:      demanded,
    };
  };

  const onSubmit = async () => {
    const success = await saveFormStep('tax_computation', buildComputationPayload(), true);
    if (success) {
      toast.success('Tax return completed successfully!');
      navigate('/income-tax');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('tax_computation', buildComputationPayload(), false);
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

  if (ratesError) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calculator className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tax rates not available</h3>
            <p className="text-gray-600 mb-4">
              {ratesError} — the administrator must seed the rate tables for
              tax year <strong>{currentTaxYear}</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => navigate('/income-tax')}
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
              <h1 className="text-2xl font-bold text-gray-900">
                Tax Computation
                <HelpHint fieldId="page_overview" source={taxComputationHelp} />
              </h1>
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
              <li>• <strong>Surcharge</strong>: 9% additional tax if income exceeds Rs 10 million (Finance Act 2025)</li>
              <li>• <strong>Final Result</strong>: Tax payable or refundable amount</li>
            </ul>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
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
              <div className="col-span-8 text-gray-700">Surcharge (9% of Income Tax where income exceeds Rs 10m — Finance Act 2025)</div>
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

            {(computationData?.super_tax || 0) > 0 && (
              <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-red-50 hover:bg-red-100">
                <div className="col-span-8 text-red-800 font-medium">
                  Super Tax u/s 4C — Finance Act 2025
                  <span className="ml-2 text-xs text-red-600">(Income exceeds Rs 150M)</span>
                </div>
                <div className="col-span-4 text-right font-mono text-red-800 font-semibold">
                  {formatCurrency(computationData?.super_tax)}
                </div>
              </div>
            )}

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

            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50 items-center">
              <div className="col-span-8 text-gray-700">
                Refund Adjustment of Other Year(s) against Demand of this Year
                <HelpHint fieldId="refund_adjustment" source={taxComputationHelp} />
              </div>
              <div className="col-span-4 text-right">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={refundAdjustment || ''}
                  onChange={(e) => setRefundAdjustment(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 py-2 px-4 bg-blue-50 font-semibold">
              <div className="col-span-8 text-blue-900">Net Tax Paid/Adjusted</div>
              <div className="col-span-4 text-right font-mono text-blue-900">
                {formatCurrency((computationData?.base_net_tax_paid || 0) + refundAdjustment)}
              </div>
            </div>

            {/* Final Result */}
            {(() => {
              const netPaid = (computationData?.base_net_tax_paid || 0) + refundAdjustment;
              const demanded = (computationData?.total_tax_chargeable || 0) - netPaid;
              return (
                <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-red-50 font-bold border-2 border-red-200">
                  <div className="col-span-8 text-red-900 text-lg">Income Tax Demanded /(Refundable)</div>
                  <div className="col-span-4 text-right font-mono text-red-900 text-xl">
                    {demanded >= 0
                      ? formatCurrency(demanded)
                      : `(${formatCurrency(Math.abs(demanded))})`
                    }
                  </div>
                </div>
              );
            })()}
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
            onClick={() => navigate('/wealth-statement/wealth-statement')}
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