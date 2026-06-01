import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import {
  Save,
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
import ReadinessChecklist from '../../../components/TaxForms/ReadinessChecklist';
import NumberTrace from '../../../components/TaxForms/NumberTrace';
import { formatCurrency } from '../../../utils/currency';

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
    setValue
  } = useForm({
    defaultValues: {}
  });

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

    // Income Calculation — IncomeForm saves: total_employment_income, annual_salary_wages_total.
    // `parseFloat || fallback` is the right pattern here (NOT `a || b || …`):
    // backend values come back as numeric strings like "0.00" which are
    // truthy in JS, so `"0.00" || "75000.00"` resolves to "0.00" — drops
    // the real value to 0. parseFloat first, then OR.
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
    const incomeFromSalary =
      num(incomeData.total_employment_income) ||
      num(incomeData.annual_salary_wages_total) ||
      num(incomeData.total_gross_income) ||
      num(incomeData.total_taxable_income);
    // Other Income = min-tax bucket (profit-on-debt, sukuk WHT) + no-min-tax
    // bucket (rent, other taxable). Excel's Tax Computation pools both into
    // "Other Income / Income from Other Sources"; previously the UI only
    // showed the no-min-tax portion, under-reporting Total Income.
    const incomeFromOtherMinTax    = num(incomeData.other_income_min_tax_total);
    const incomeFromOtherNoMinTax  =
      num(incomeData.other_income_no_min_tax_total) ||
      num(incomeData.other_sources) ||
      num(incomeData.income_from_other_sources);
    const incomeFromOtherSources = incomeFromOtherMinTax + incomeFromOtherNoMinTax;
    const totalIncome = incomeFromSalary + incomeFromOtherSources;

    // Deductible Allowances - prefer DB-generated `total_deductions`
    // (sums zakat + ushr + POS + education + advance + other), then the
    // legacy `total_deduction_from_income`, then component sum.
    const deductibleAllowances =
      num(deductionsData.total_deductions) ||
      num(deductionsData.total_deduction_from_income) ||
      (num(deductionsData.zakat_paid_amount) || num(deductionsData.zakat)) +
       num(deductionsData.ushr) +
       num(deductionsData.professional_expenses_amount) +
       num(deductionsData.educational_expenses_amount) +
       num(deductionsData.other_deductions);
    
    // Taxable Income before Capital Gains
    const taxableIncomeBeforeCapitalGains = Math.max(0, totalIncome - deductibleAllowances);
    
    // Capital Gains/Loss — string-truthiness-safe via `num()`.
    const capitalGainsLoss = num(capitalGainData.total_capital_gain) || num(capitalGainData.total_capital_gains);
    
    // Final Taxable Income including Capital Gains
    const taxableIncomeIncludingCapitalGains = taxableIncomeBeforeCapitalGains + capitalGainsLoss;
    
    // Tax Chargeable — progressive slabs sourced from DB (useTaxRates).
    const normalIncomeTax = calculateNormalIncomeTax(taxableIncomeBeforeCapitalGains);

    // Surcharge — rate + threshold sourced from DB. Statutorily applies to
    // income tax on regular (non-CGT) income, so the threshold test uses
    // taxable income BEFORE capital gains. Backend (taxCalculationService)
    // does the same — keeping the two in sync.
    const surchargeRate = rates?.surcharge?.rate ?? 0;
    const surchargeThreshold = rates?.surcharge?.threshold ?? Infinity;
    const surcharge = taxableIncomeBeforeCapitalGains > surchargeThreshold
      ? Math.round(normalIncomeTax * surchargeRate)
      : 0;
    
    // Capital Gain Tax (CGT) - separate calculation
    const capitalGainTax = calculateCapitalGainTax(capitalGainsLoss);
    
    // Total tax including surcharge and CGT
    const normalIncomeTaxIncludingSurchargeAndCGT = normalIncomeTax + surcharge + capitalGainTax;
    
    // Tax Reductions — ReductionsForm saves `total_tax_reductions` (plural);
    // the DB also exposes the generated column `total_reductions`. Read both
    // so the live preview is correct even before the user saves.
    const taxReductions = num(reductionsData.total_tax_reductions) || num(reductionsData.total_reductions);

    // Tax Credits — prefer total_credits (DB-computed column) over plain total_tax_credits field
    const taxCredits = num(creditsData.total_credits) || num(creditsData.total_tax_credits);
    
    // Tax after reductions and credits
    const normalIncomeTaxAfterReductionCredit = Math.max(0, 
      normalIncomeTaxIncludingSurchargeAndCGT - taxReductions - taxCredits
    );
    
    // Final/Min tax from Final/Min Income form (D20 in Excel = grand total tax chargeable).
    // For salaried scope this captures dividends (s.150), sukuk/profit-on-debt
    // (s.151(1A), s.7B), prize bonds (s.156), bonus shares (s.236Z) and salary
    // arrears at relevant rate (s.12(7)) — all FINAL tax streams under their
    // own sections, NOT min-tax variants of normal income. So the doctrine is
    // "in addition to normal tax", not "higher of" — Excel adds them too.
    const finalMinTax = num(finalMinIncomeData.grand_total_tax_chargeable);
    const finalIncomeTax = normalIncomeTaxAfterReductionCredit + finalMinTax;

    // Super Tax u/s 4C (Finance Act 2025) — charged on persons with income > Rs 150M
    // Flat rate on total income (not just the excess) per Division IIA, Part I, First Schedule
    const superTax = calculateSuperTax(taxableIncomeIncludingCapitalGains);

    // Total Tax Chargeable = income tax (after reductions/credits) + super tax
    const totalTaxChargeable = finalIncomeTax + superTax;
    
    // Final Tax already deducted at source — reduces the balance owed.
    // Two streams pool in here:
    //   1. `final_tax_forms.total_final_tax` (legacy table for sukuk/debt rows)
    //   2. The sum of every `*_tax_deducted` field on `final_min_income_forms`
    //      (the canonical final-min table for salaried scope: dividends,
    //      sukuk profit, prize bonds, salary arrears at relevant rate, etc.).
    // Without (2) the on-screen demand over-states by the finalMin WHT amount.
    const finalTaxPaidLegacy = num(finalTaxData.total_final_tax);
    // Sum every per-row `*_tax_deducted` column on final_min_income_forms,
    // EXCLUDING:
    //   - the generated rollups `subtotal_tax_deducted`/`grand_total_tax_deducted`
    //     (they're the same numbers summed at the DB level — a naive
    //     `endsWith('_tax_deducted')` filter triples the total)
    //   - `salary_u_s_12_7_tax_deducted` — auto-populates from the salary
    //     WHT (s.149), already pooled under adjustable WHT; including it
    //     would double-count by ~the entire salary WHT amount.
    const EXCLUDE_FROM_FINAL_MIN_WHT_SUM = new Set([
      'salary_u_s_12_7_tax_deducted',
      'subtotal_tax_deducted',
      'grand_total_tax_deducted',
    ]);
    const finalMinTaxDeducted = Object.entries(finalMinIncomeData)
      .filter(([k]) => k.endsWith('_tax_deducted') && !EXCLUDE_FROM_FINAL_MIN_WHT_SUM.has(k))
      .reduce((s, [, v]) => s + num(v), 0);
    const finalTaxPaid = finalTaxPaidLegacy + finalMinTaxDeducted;

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
      // Final/Fixed/Min row in the slip — actual final-min tax (separate
      // stream), NOT the combined normal+final figure.
      final_min_tax: finalMinTax,
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

  // CGT lookup — `capital_gains_tax_chargeable` is the gross tax chargeable
  // (sum of per-row `*_carryable` fields, i.e. rate × amount for every CG
  // row). It is NOT a "net of WHT" figure — earlier code added
  // `total_tax_deducted` on top, doubling the value for filers whose CG WHT
  // matches the tax due. WHT belongs on the payments side, not here.
  const calculateCapitalGainTax = (_capitalGains) => {
    const direct = parseFloat(capitalGainData.capital_gains_tax_chargeable) ||
                   parseFloat(capitalGainData.total_capital_gain_tax) ||
                   parseFloat(capitalGainData.total_capital_gains_tax);
    return Math.round(direct || 0);
  };

  // Build a payload that writes ONLY to the input columns of
  // `tax_computation_forms`. The DB has GENERATED columns
  // (`total_income`, `taxable_income_excluding_cg`, `net_tax_payable`,
  // `total_tax_liability`, `balance_payable`, etc.) that derive everything
  // else from these inputs — so we don't send the derived values, and they
  // can never drift from the inputs. The previous payload sent the derived
  // values to plain zombie columns (`surcharge`, `capital_gain_tax`,
  // `total_tax_paid`, `tax_payable_refundable`) that shadowed the generated
  // ones; those columns are being dropped (phase-w migration).
  const buildComputationPayload = () => ({
    // Income section (inputs)
    income_from_salary:              computationData?.income_from_salary        || 0,
    other_income_subject_to_min_tax: computationData?.income_from_other_sources || 0,
    income_loss_other_sources:       0,
    deductible_allowances:           computationData?.deductible_allowances     || 0,
    capital_gains_loss:              computationData?.capital_gains_loss        || 0,
    // Tax chargeable inputs
    normal_income_tax:  computationData?.normal_income_tax  || 0,
    surcharge_amount:   computationData?.surcharge          || 0,
    capital_gains_tax:  computationData?.capital_gain_tax   || 0,
    tax_reductions:     computationData?.tax_reductions     || 0,
    tax_credits:        computationData?.tax_credits        || 0,
    // Final/fixed minimum tax (input — separate from normal tax stream)
    final_fixed_tax:             computationData?.final_min_tax || 0,
    minimum_tax_on_other_income: 0,
    // Taxes paid input
    advance_tax_paid: computationData?.withholding_income_tax || 0,
  });

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

  // Build a per-slab breakdown for the Normal Income Tax trace popover.
  // Each slab contributes (ceiling − floor) × rate to the total. We render
  // only slabs that actually applied (income reached them).
  const buildSlabTrace = (taxableIncome) => {
    if (!rates?.slabs || taxableIncome <= 0) return [];
    const rows = [];
    for (const slab of rates.slabs) {
      const minI = Number(slab.min_income);
      const maxI = slab.max_income === null || slab.max_income === undefined
        ? Number.POSITIVE_INFINITY
        : Number(slab.max_income);
      const rate = Number(slab.tax_rate);
      const floor = minI > 0 ? minI - 1 : 0;
      if (taxableIncome <= floor) continue;
      const ceiling = Math.min(taxableIncome, maxI);
      const taxed = ceiling - floor;
      if (taxed <= 0) continue;
      const contrib = Math.round(taxed * rate);
      rows.push({
        label: rate === 0
          ? `Up to Rs ${(maxI === Infinity ? floor : maxI).toLocaleString()} @ 0% (exempt)`
          : `Slab Rs ${(floor + 1).toLocaleString()}–${(ceiling).toLocaleString()} @ ${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`,
        value: contrib,
        note: rate > 0 ? `Rs ${taxed.toLocaleString()} × ${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%` : null,
      });
    }
    return rows;
  };

  // Net tax paid for the Demanded/Refundable trace (depends on the
  // user-editable refundAdjustment).
  const netPaidForTrace = (computationData?.base_net_tax_paid || 0) + refundAdjustment;
  const demandedForTrace = (computationData?.total_tax_chargeable || 0) - netPaidForTrace;

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
              onClick={() => window.print()}
              className="flex items-center px-4 py-2 text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              title="Download the IRIS-format PDF from Reports"
              className="flex items-center px-4 py-2 text-green-600 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Pre-submit readiness checklist — surfaces blocking issues
            before the user wastes a click on Submit. Server enforces
            again at submit time. */}
        <div className="mt-6">
          <ReadinessChecklist />
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
              <div className="col-span-4 text-right text-blue-900 flex justify-end">
                <NumberTrace
                  value={computationData?.total_income}
                  resultLabel="Total Income"
                  formula="Salary + Other Sources"
                  trace={[
                    { label: 'Income from salary',         value: computationData?.income_from_salary },
                    { label: 'Income from other sources',  value: computationData?.income_from_other_sources },
                  ]}
                />
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
              <div className="col-span-4 text-right text-blue-900 flex justify-end">
                <NumberTrace
                  value={computationData?.taxable_income_before_capital_gains}
                  resultLabel="Taxable Income (excl. CG)"
                  formula="Total Income − Deductible Allowances"
                  trace={[
                    { label: 'Total income',           value: computationData?.total_income },
                    { label: 'Deductible allowances',  value: computationData?.deductible_allowances, op: '-' },
                  ]}
                />
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
              <div className="col-span-4 text-right text-blue-900 flex justify-end">
                <NumberTrace
                  value={computationData?.taxable_income_including_capital_gains}
                  resultLabel="Taxable Income (incl. CG)"
                  formula="Taxable Income (excl. CG) + Capital Gains"
                  trace={[
                    { label: 'Taxable income (excl. CG)',  value: computationData?.taxable_income_before_capital_gains },
                    { label: 'Gains from capital assets',  value: computationData?.capital_gains_loss },
                  ]}
                />
              </div>
            </div>

            {/* Tax Chargeable Section */}
            <div className="py-2 px-4">
              <h3 className="font-semibold text-gray-800 mb-2">Tax Chargeable</h3>
            </div>
            
            <div className="grid grid-cols-12 gap-4 py-2 px-4 hover:bg-gray-50">
              <div className="col-span-8 text-gray-700">Normal Income Tax</div>
              <div className="col-span-4 text-right flex justify-end">
                <NumberTrace
                  value={computationData?.normal_income_tax}
                  resultLabel="Normal Income Tax"
                  formula="Sum of (slab amount × slab rate)"
                  trace={buildSlabTrace(computationData?.taxable_income_before_capital_gains || 0)}
                />
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
                {formatCurrency(computationData?.final_min_tax)}
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
              <div className="col-span-4 text-right text-green-900 text-lg flex justify-end">
                <NumberTrace
                  value={computationData?.total_tax_chargeable}
                  resultLabel="Total Tax Chargeable"
                  formula="Final Income Tax + Super Tax"
                  trace={[
                    { label: 'Normal income tax',           value: computationData?.normal_income_tax },
                    { label: 'Surcharge',                   value: computationData?.surcharge },
                    { label: 'Capital gains tax',           value: computationData?.capital_gain_tax },
                    { label: 'Tax reductions',              value: computationData?.tax_reductions, op: '-' },
                    { label: 'Tax credits',                 value: computationData?.tax_credits,    op: '-' },
                    { label: 'Super tax u/s 4C',            value: computationData?.super_tax },
                  ]}
                />
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

            {/* Final Result — the headline number every user comes here for. */}
            <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-red-50 font-bold border-2 border-red-200">
              <div className="col-span-8 text-red-900 text-lg">Income Tax Demanded /(Refundable)</div>
              <div className="col-span-4 text-right text-red-900 text-xl flex justify-end">
                <NumberTrace
                  value={demandedForTrace}
                  resultLabel={demandedForTrace >= 0 ? 'Tax payable to FBR' : 'Refund due to you'}
                  formula="Tax chargeable − (WHT + Final-tax + Refund adj.)"
                  trace={[
                    { label: 'Total tax chargeable',          value: computationData?.total_tax_chargeable },
                    { label: 'Withholding income tax',        value: computationData?.withholding_income_tax,  op: '-' },
                    { label: 'Final tax already paid',        value: computationData?.final_tax_paid,          op: '-' },
                    { label: 'Refund adjustment (other yrs)', value: refundAdjustment,                          op: '-' },
                  ]}
                />
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