import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
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
import {
  TaxFormShell,
  FormStateScreen,
  AmountRow,
  TaxFormRow,
  FormNav,
} from '../../../components/forms';

// Section group: a small label over a bordered, divided card of rows. Defined at
// module scope so it never remounts its children (an in-component definition
// would drop focus from the refund-adjustment input on every keystroke).
const Section = ({ title, children }) => (
  <div>
    <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">{title}</h2>
    <div className="divide-y divide-slate-100 dark:divide-[#2a3450] overflow-hidden rounded-brand-lg border border-slate-200 dark:border-[#2a3450]">
      {children}
    </div>
  </div>
);

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
    // Capital gains computed up-front so "Total Income" can INCLUDE it, matching
    // the backend's definition (TAX-06). The slab base below still excludes CG
    // (it's taxed separately), so the computed tax is unchanged.
    const capitalGainsLoss = num(capitalGainData.total_capital_gain) || num(capitalGainData.total_capital_gains);
    const totalIncome = incomeFromSalary + incomeFromOtherSources + capitalGainsLoss;

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
    const taxableIncomeBeforeCapitalGains = Math.max(0, totalIncome - capitalGainsLoss - deductibleAllowances);
    
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
    
    // Final/Min tax from Final/Min Income form. For salaried scope this captures
    // dividends (s.150), sukuk/profit-on-debt (s.151(1A), s.7B), prize bonds
    // (s.156), bonus shares (s.236Z) and salary arrears at relevant rate
    // (s.12(7)) — all FINAL tax streams under their own sections, NOT min-tax
    // variants of normal income. So the doctrine is "in addition to normal tax",
    // not "higher of".
    //
    // Use subtotal_tax_chargeable, which EXCLUDES capital gains. CGT is owned by
    // the Capital Gains form and is already added above as `capitalGainTax`; the
    // Final/Min form auto-mirrors that CGT into its capital_gain_tax_chargeable
    // row, so grand_total_tax_chargeable (= subtotal + capital_gain) would
    // double-count CGT for every capital-gains filer (audit UX-03). Fall back to
    // grand_total − capital_gain for rows predating the subtotal column.
    const finalMinTax = finalMinIncomeData.subtotal_tax_chargeable != null
      ? num(finalMinIncomeData.subtotal_tax_chargeable)
      : num(finalMinIncomeData.grand_total_tax_chargeable) - num(finalMinIncomeData.capital_gain_tax_chargeable);
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
      <FormStateScreen
        icon={Calculator}
        tone="error"
        title="Tax rates not available"
        message={`${ratesError} — the administrator must seed the rate tables for tax year ${currentTaxYear}.`}
      />
    );
  }

  if (loading) {
    return (
      <FormStateScreen
        icon={Calculator}
        spinning
        title="Calculating…"
        message="Crunching your tax computation from every form."
      />
    );
  }

  // Show message if no data is available
  if (!computationData) {
    return (
      <FormStateScreen
        icon={Calculator}
        title="No tax data yet"
        message="Complete some tax forms first to see your computation summary."
        action={
          <button
            type="button"
            onClick={() => navigate('/income-tax')}
            className="inline-flex items-center gap-2 rounded-brand bg-navy px-5 py-2.5 font-body text-sm font-bold text-white transition-colors hover:bg-navy-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/30"
          >
            Go to tax forms
          </button>
        }
      />
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

  const isRefund = (demandedForTrace || 0) < 0;

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        aria-label="Toggle help"
        aria-expanded={showHelp}
        aria-controls="taxcomp-help"
        className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
      >
        <Info size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-brand bg-white/10 px-3 py-1.5 font-body text-xs font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
      >
        <Printer size={14} aria-hidden="true" /> Print
      </button>
      <button
        type="button"
        onClick={() => navigate('/reports')}
        title="Download the IRIS-format PDF from Reports"
        className="inline-flex items-center gap-1.5 rounded-brand bg-white/10 px-3 py-1.5 font-body text-xs font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
      >
        <Download size={14} aria-hidden="true" /> Export
      </button>
    </>
  );

  const helpPanel = showHelp ? (
    <div id="taxcomp-help">
      <h3 className="font-display text-sm font-bold text-navy dark:text-[#e7eaf3]">How this summary works</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600 dark:text-[#aab2cc]">
        <li>The final tax computation, calculated from everything you entered.</li>
        <li><strong className="text-navy dark:text-[#e7eaf3]">Income</strong> — total income from all sources.</li>
        <li><strong className="text-navy dark:text-[#e7eaf3]">Deductible allowances</strong> — professional expenses, Zakat and the like.</li>
        <li><strong className="text-navy dark:text-[#e7eaf3]">Tax chargeable</strong> — tax computed on the Pakistani slabs.</li>
        <li><strong className="text-navy dark:text-[#e7eaf3]">Final result</strong> — the amount payable to FBR, or your refund.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <TaxFormShell
        title="Tax Computation"
        subtitle="Your complete return, calculated from every form"
        icon={Calculator}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/wealth-statement/wealth-statement')}
            backLabel="Wealth statement"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save summary'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete tax return"
          />
        }
      >
        {/* Pre-submit readiness checklist — surfaces blocking issues before the
            user wastes a click on Submit. Server re-enforces at submit time. */}
        <ReadinessChecklist />

        <Section title="Income">
          <AmountRow label="Income from salary" amount={computationData?.income_from_salary} />
          <AmountRow label="Income / (loss) from other sources" amount={computationData?.income_from_other_sources} />
          <AmountRow
            variant="subtotal"
            label="Total income"
            amountNode={
              <NumberTrace
                value={computationData?.total_income}
                resultLabel="Total Income"
                formula="Salary + Other Sources"
                trace={[
                  { label: 'Income from salary', value: computationData?.income_from_salary },
                  { label: 'Income from other sources', value: computationData?.income_from_other_sources },
                ]}
              />
            }
          />
        </Section>

        <Section title="Taxable income">
          <AmountRow label="Deductible allowances" amount={computationData?.deductible_allowances} />
          <AmountRow
            variant="subtotal"
            label="Taxable income before capital gains"
            amountNode={
              <NumberTrace
                value={computationData?.taxable_income_before_capital_gains}
                resultLabel="Taxable Income (excl. CG)"
                formula="Total Income − Deductible Allowances"
                trace={[
                  { label: 'Total income', value: computationData?.total_income },
                  { label: 'Deductible allowances', value: computationData?.deductible_allowances, op: '-' },
                ]}
              />
            }
          />
          <AmountRow label="Gains / (loss) from capital assets" amount={computationData?.capital_gains_loss} />
          <AmountRow
            variant="subtotal"
            label="Taxable income including capital gains"
            amountNode={
              <NumberTrace
                value={computationData?.taxable_income_including_capital_gains}
                resultLabel="Taxable Income (incl. CG)"
                formula="Taxable Income (excl. CG) + Capital Gains"
                trace={[
                  { label: 'Taxable income (excl. CG)', value: computationData?.taxable_income_before_capital_gains },
                  { label: 'Gains from capital assets', value: computationData?.capital_gains_loss },
                ]}
              />
            }
          />
        </Section>

        <Section title="Tax chargeable">
          <AmountRow
            label="Normal income tax"
            amountNode={
              <NumberTrace
                value={computationData?.normal_income_tax}
                resultLabel="Normal Income Tax"
                formula="Sum of (slab amount × slab rate)"
                trace={buildSlabTrace(computationData?.taxable_income_before_capital_gains || 0)}
              />
            }
          />
          <AmountRow
            label="Surcharge"
            sublabel="9% of income tax where taxable income exceeds Rs 10M (Finance Act 2025)"
            amount={computationData?.surcharge}
          />
          <AmountRow label="Capital gains tax (CGT)" amount={computationData?.capital_gain_tax} />
          <AmountRow variant="subtotal" label="Normal income tax incl. surcharge & CGT" amount={computationData?.normal_income_tax_including_surcharge_cgt} />
          <AmountRow label="Tax reductions" amount={computationData?.tax_reductions} />
          <AmountRow label="Tax credits" amount={computationData?.tax_credits} />
          <AmountRow variant="subtotal" label="Normal income tax after reductions & credits" amount={computationData?.normal_income_tax_after_reduction_credit} />
          <AmountRow
            label="Final / fixed tax"
            sublabel="Final / fixed / minimum / average / relevant / reduced income tax"
            amount={computationData?.final_min_tax}
          />
          {(computationData?.super_tax || 0) > 0 && (
            <AmountRow
              label="Super tax"
              sublabel="Section 4C — taxable income exceeds Rs 150M (Finance Act 2025)"
              amount={computationData?.super_tax}
            />
          )}
          <AmountRow
            variant="total"
            label="Total tax chargeable"
            amountNode={
              <NumberTrace
                value={computationData?.total_tax_chargeable}
                resultLabel="Total Tax Chargeable"
                formula="Final Income Tax + Super Tax"
                trace={[
                  { label: 'Normal income tax', value: computationData?.normal_income_tax },
                  { label: 'Surcharge', value: computationData?.surcharge },
                  { label: 'Capital gains tax', value: computationData?.capital_gain_tax },
                  { label: 'Tax reductions', value: computationData?.tax_reductions, op: '-' },
                  { label: 'Tax credits', value: computationData?.tax_credits, op: '-' },
                  { label: 'Super tax u/s 4C', value: computationData?.super_tax },
                ]}
              />
            }
          />
        </Section>

        <Section title="Taxes paid / adjusted">
          <AmountRow label="Withholding income tax" amount={computationData?.withholding_income_tax} />
          <TaxFormRow
            name="refund_adjustment"
            label="Refund carried over from prior years"
            help={<HelpHint fieldId="refund_adjustment" source={taxComputationHelp} />}
            prefix="Rs"
            inputProps={{
              type: 'number',
              step: '1',
              min: '0',
              value: refundAdjustment || '',
              onChange: (e) => setRefundAdjustment(parseFloat(e.target.value) || 0),
            }}
          />
          <AmountRow
            variant="subtotal"
            label="Net tax paid / adjusted"
            amount={(computationData?.base_net_tax_paid || 0) + refundAdjustment}
          />
        </Section>

        {/* Final result — the headline. Sign-aware: red = payable, green = refund,
            and the LABEL states the outcome so meaning is never colour-only. */}
        <AmountRow
          signAware
          amount={demandedForTrace}
          label={isRefund ? 'Refund due to you' : 'Tax payable to FBR'}
          amountNode={
            <NumberTrace
              value={Math.abs(demandedForTrace || 0)}
              resultLabel={isRefund ? 'Refund due to you' : 'Tax payable to FBR'}
              formula="Tax chargeable − (withholding + final tax + refund adj.)"
              trace={[
                { label: 'Total tax chargeable', value: computationData?.total_tax_chargeable },
                { label: 'Withholding income tax', value: computationData?.withholding_income_tax, op: '-' },
                { label: 'Final tax already paid', value: computationData?.final_tax_paid, op: '-' },
                { label: 'Refund adjustment (other years)', value: refundAdjustment, op: '-' },
              ]}
            />
          }
        />

        {/* Neutral caption — navy, NOT green, so green stays reserved for the
            refund outcome above. Worded so it holds regardless of readiness:
            this component has no readiness state, so it must not claim the
            return is submit-ready (the ReadinessChecklist owns that). */}
        <div className="flex items-center justify-center gap-2 rounded-brand border border-navy/15 dark:border-[#2a3450] bg-navy/[0.03] dark:bg-[#151c30] px-4 py-3">
          <CheckCircle size={18} className="text-navy dark:text-[#e7eaf3]" aria-hidden="true" />
          <span className="font-body text-sm font-semibold text-navy dark:text-[#e7eaf3]">Figures above reflect your saved forms — review the readiness checklist before submitting</span>
        </div>
      </TaxFormShell>
    </form>
  );
};

export default TaxComputationSummary;