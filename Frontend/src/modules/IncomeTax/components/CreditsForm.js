import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  Gift,
  Info,
  ChevronDown,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import creditsHelp from '../../../help/creditsHelp';
import { formatCurrency } from '../../../utils/currency';
import { TaxFormShell, TaxFormRow, AmountRow, FormNav, LiveTotalsProvider, LiveAmount } from '../../../components/forms';

// PERF-02: the three rebate auto-calc effects run here (headless) so their
// field subscriptions don't re-render the whole form. Each watches only its own
// donation/contribution field; the current credit value isn't needed (the
// effects always overwrite). Logic byte-identical to the former in-component
// effects (computeRebateCredit moved here verbatim).
const CreditsAutoCalc = ({ control, setValue, taxableIncome, normalTax, avgRate, donationCap, donationAssociateCap, pensionCap }) => {
  const donation = useWatch({ control, name: 'charitable_donations_amount' });
  const donationAssociate = useWatch({ control, name: 'charitable_donations_associate_amount' });
  const pension = useWatch({ control, name: 'pension_fund_amount' });

  const computeRebateCredit = (actualAmount, capPct) => {
    if (!taxableIncome || !normalTax || !actualAmount || !capPct) return 0;
    const eligible = Math.min(parseFloat(actualAmount) || 0, taxableIncome * capPct);
    return eligible > 0 ? Math.round(eligible * avgRate) : 0;
  };

  useEffect(() => {
    if (!donationCap) return;
    const amount = parseFloat(donation) || 0;
    if (taxableIncome > 0) {
      setValue('charitable_donations_tax_credit', computeRebateCredit(amount, donationCap));
    }
  }, [donation, taxableIncome, normalTax, donationCap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!donationAssociateCap) return;
    const amount = parseFloat(donationAssociate) || 0;
    if (taxableIncome > 0) {
      setValue('charitable_donations_associate_tax_credit', computeRebateCredit(amount, donationAssociateCap));
    }
  }, [donationAssociate, taxableIncome, normalTax, donationAssociateCap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pensionCap) return;
    const amount = parseFloat(pension) || 0;
    if (taxableIncome > 0) {
      setValue('pension_fund_tax_credit', computeRebateCredit(amount, pensionCap));
    }
  }, [pension, taxableIncome, normalTax, pensionCap]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

// One credit row. Self-subscribes to its own donation amount so the live
// eligible/hint updates without re-rendering the rest of the form.
const CreditItemRow = ({ item, control, register, errors, taxableIncome, avgRate }) => {
  const donated = parseFloat(useWatch({ control, name: item.amount })) || 0;
  const eligible = item.autoCalc && taxableIncome > 0 ? Math.min(donated, taxableIncome * item.limitPct) : 0;
  const creditHint =
    item.autoCalc && taxableIncome > 0 && donated > 0
      ? `Auto: eligible Rs ${eligible.toLocaleString('en-PK')} × ${(avgRate * 100).toFixed(2)}%`
      : undefined;
  return (
    <div className="px-3 py-3">
      <div className="flex items-start gap-1.5">
        <p className="font-body text-sm font-medium leading-snug text-slate-700">
          {item.description}
          <HelpHint fieldId={item.id} source={creditsHelp} />
        </p>
      </div>
      {item.yesNo !== '-' && (
        <div className="mt-2">
          <label htmlFor={`${item.id}_yn`} className="mb-1 block font-body text-xs font-medium text-slate-500">Claiming this credit?</label>
          <select
            id={`${item.id}_yn`}
            {...register(`${item.id}_yn`)}
            className="rounded-brand border-[1.5px] border-slate-300 bg-white px-2.5 py-1.5 font-body text-xs font-semibold text-navy focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
          >
            <option value="">—</option>
            <option value="Y">Yes</option>
            <option value="N">No</option>
          </select>
        </div>
      )}
      <TaxFormRow
        name={item.amount}
        label="Amount donated / contributed"
        error={errors[item.amount]?.message}
        inputProps={{
          type: 'number',
          step: '0.01',
          ...register(item.amount, {
            min: { value: 0, message: 'Amount cannot be negative' },
            valueAsNumber: true
          })
        }}
      />
      <TaxFormRow
        name={item.taxReduction}
        label="Tax credit"
        sublabel={item.autoCalc ? 'Auto-calculated — editable' : 'Manual entry'}
        hint={creditHint}
        error={errors[item.taxReduction]?.message}
        inputProps={{
          type: 'number',
          step: '0.01',
          ...register(item.taxReduction, {
            min: { value: 0, message: 'Amount cannot be negative' },
            valueAsNumber: true
          })
        }}
      />
    </div>
  );
};

const CreditsForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving,
    incomeProfile,
  } = useTaxForm();
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  const [showHelp, setShowHelp] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    control,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('credits')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back)
  useEffect(() => {
    const savedData = contextFormData['credits'];
    if (savedData && Object.keys(savedData).length > 0) {
      reset(savedData);
    }
  }, [contextFormData, reset]);

  // PERF-02: no bare watch() at render. The three rebate effects run in the
  // headless <CreditsAutoCalc> child; the total is isolated in
  // <LiveTotalsProvider>; each row self-subscribes via <CreditItemRow>.

  // Prior year pre-fill
  const { hasPriorData: hasPriorCredits, applyPriorYear: applyPriorCredits, dismissPriorYear: dismissPriorCredits } = usePriorYearData('credits', setValue);

  // ── Rebate-at-average-rate auto-calculation (u/s 61, 62, 63) ────────────────
  // Formula (ITO 2001):
  //   Credit = eligible_amount × (normal_income_tax / taxable_income)
  //   eligible_amount = MIN(actual, cap% × taxable_income)
  //
  // Slabs and caps come from DB via useTaxRates — no hardcoded rate constants.

  // Progressive tax walk over DB-sourced slabs. Same algorithm as the backend
  // CalculationService.calculateProgressiveTax.
  const calculateNormalTax = (income) => {
    const taxable = parseFloat(income) || 0;
    if (!rates?.slabs || taxable <= 0) return 0;
    let total = 0;
    for (const slab of rates.slabs) {
      const minI = Number(slab.min_income);
      const maxI = slab.max_income === null || slab.max_income === undefined
        ? Number.POSITIVE_INFINITY
        : Number(slab.max_income);
      const rate = Number(slab.tax_rate);
      const effectiveLower = minI > 0 ? minI - 1 : 0;
      if (taxable <= effectiveLower) continue;
      const ceiling = Math.min(taxable, maxI);
      const taxableAtThisSlab = ceiling - effectiveLower;
      if (taxableAtThisSlab > 0 && rate > 0) total += taxableAtThisSlab * rate;
    }
    return Math.round(total);
  };

  // Derive taxable income from income form context data — and subtract
  // deductible allowances (zakat, POS, education) before computing credit
  // caps. The s.61/s.63 statutory base is "taxable income" which is
  // post-deductions; using the pre-deduction figure makes the caps too
  // generous when the filer has deductions.
  const incomeData = contextFormData['income'] || {};
  const deductionsData = contextFormData['deductions'] || {};
  const grossTaxable =
    (parseFloat(incomeData.total_employment_income) || parseFloat(incomeData.annual_salary_wages_total) || 0)
    + (parseFloat(incomeData.other_income_no_min_tax_total) || 0);
  const totalDeductions =
    parseFloat(deductionsData.total_deductions)
    || parseFloat(deductionsData.total_deduction_from_income)
    || 0;
  const taxableIncome = Math.max(0, grossTaxable - totalDeductions);
  const normalTax = calculateNormalTax(taxableIncome);
  const avgRate = taxableIncome > 0 ? normalTax / taxableIncome : 0;

  // DB-sourced cap ratios (u/s 61: 30%, u/s 61 to associate: 15%, u/s 63: 20%).
  const donationCap = rates?.creditCaps?.donation_u61?.rate;
  const donationAssociateCap = rates?.creditCaps?.donation_u61_associate?.rate;
  const pensionCap = rates?.creditCaps?.pension_u63?.rate;
  // (rebate auto-calc effects relocated to <CreditsAutoCalc> — see module scope)
  // ────────────────────────────────────────────────────────────────────────────

  // Define comprehensive tax credits structure matching Excel. Memoised
  // so the visibility-filter useMemo below has a stable dependency.
  const creditItems = useMemo(() => [
    {
      id: 'charitable_donations_u61',
      description: 'Tax Credit for Charitable Donations u/s 61',
      yesNo: 'Y',
      amount: 'charitable_donations_amount',
      taxReduction: 'charitable_donations_tax_credit',
      limits: 'Rebate at avg rate. Eligible = MIN(donation, 30% of taxable income)',
      autoCalc: true,
      limitPct: 0.30
    },
    {
      id: 'charitable_donations_associate',
      description: 'Tax Credit for Charitable Donations where donation is made to associate',
      yesNo: 'Y',
      amount: 'charitable_donations_associate_amount',
      taxReduction: 'charitable_donations_associate_tax_credit',
      limits: 'Rebate at avg rate. Eligible = MIN(donation, 15% of taxable income)',
      autoCalc: true,
      limitPct: 0.15
    },
    {
      id: 'pension_fund_u63',
      description: 'Tax Credit for Contribution to Approved Pension Fund u/s 63',
      yesNo: 'Y',
      amount: 'pension_fund_amount',
      taxReduction: 'pension_fund_tax_credit',
      limits: 'Rebate at avg rate. Eligible = MIN(contribution, 20% of taxable income)',
      autoCalc: true,
      limitPct: 0.20
    },
    {
      id: 'surrender_tax_credit_investments',
      description: 'Surrender of Tax Credit on Investments in Shares disposed off before time limit',
      yesNo: '-',
      amount: 'surrender_tax_credit_amount',
      taxReduction: 'surrender_tax_credit_reduction',
      limits: 'Manual entry — negative credit (reversal)',
      autoCalc: false,
      limitPct: null
    }
  ], []);

  // Field-level visibility — driven by income profile. Pure salaried sees
  // only charitable-donations row (3 fields). Pension addon unlocks
  // pension-fund credit. Advanced reveals charitable-to-associate and
  // surrender-of-tax-credit (both ADVANCED in the manifest).
  const addons = useMemo(() => incomeProfile?.addons || [], [incomeProfile]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visibleFields = useMemo(
    () => visibleFieldsFor('credits_forms', addons, { advanced: showAdvanced }),
    [addons, showAdvanced]
  );
  const visibleCreditItems = useMemo(
    () => creditItems.filter((item) => visibleFields.has(item.amount)),
    [creditItems, visibleFields]
  );
  // Count is from the FORM's actual creditItems array (not the broader
  // manifest set), so it tells the user how many extra ROWS this toggle
  // will reveal here — not how many columns exist on the DB table.
  const advancedExtraCount = useMemo(() => {
    const withAdv = visibleFieldsFor('credits_forms', addons, { advanced: true });
    const itemsWithAdv = creditItems.filter((item) => withAdv.has(item.amount)).length;
    return itemsWithAdv - visibleCreditItems.length;
  }, [addons, creditItems, visibleCreditItems]);

  // Sum of all per-item tax-credit fields. Pure.
  const sumCredits = (values) =>
    creditItems.reduce((total, item) => total + (parseFloat(values[item.taxReduction]) || 0), 0);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_tax_credits: sumCredits(data)
    };

    const success = await saveFormStep('credits', formData, true);
    if (success) {
      toast.success('Tax credits information saved successfully');
      navigate('/income-tax/deductions');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watch();
    const formData = {
      ...data,
      total_tax_credits: sumCredits(data)
    };

    const success = await saveFormStep('credits', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/deductions');
    }
  };
  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="credits-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="credits-help">
      <h3 className="font-display text-sm font-bold text-navy">About tax credits</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600">
        <li>A <strong className="text-navy">rebate at your average tax rate</strong> is allowed on donations to approved non-profit organisations.</li>
        <li>General donations: lower of the donation and 30% of taxable income.</li>
        <li>Donations to an associate are restricted to 15% of taxable income.</li>
        <li>Pension contributions: up to 20% of taxable income (2% extra per year for late joiners above 40).</li>
        <li>Tax credits reduce your final tax liability after calculation.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CreditsAutoCalc control={control} setValue={setValue} taxableIncome={taxableIncome} normalTax={normalTax} avgRate={avgRate} donationCap={donationCap} donationAssociateCap={donationAssociateCap} pensionCap={pensionCap} />
      <LiveTotalsProvider control={control} compute={(v) => ({ total: sumCredits(v) })}>
      <TaxFormShell
        title="Tax credits"
        subtitle="Charitable donations and approved pension contributions"
        icon={Gift}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/reductions')}
            backLabel="Tax reductions"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save data'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >
        {/* Auto-calc context banner — navy info band. */}
        {taxableIncome > 0 ? (
          <div className="flex items-start gap-2 rounded-brand border border-navy/20 bg-navy/[0.03] px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-navy" aria-hidden="true" />
            <span className="font-body text-sm text-navy">
              Credits are auto-calculated using a taxable income of <strong>{formatCurrency(taxableIncome)}</strong> and
              an average tax rate of <strong>{(avgRate * 100).toFixed(2)}%</strong> (normal tax: {formatCurrency(normalTax)}).
              Enter the donation amount and the credit is computed automatically — values stay editable.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-brand border border-slate-200 bg-slate-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
            <span className="font-body text-sm text-slate-600">Income data not loaded yet. Save your Income form first for automatic credit calculation, or enter tax credits manually.</span>
          </div>
        )}

        {hasPriorCredits && (
          <div className="flex flex-col gap-2 rounded-brand border border-navy/20 bg-navy/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-body text-sm text-navy">Prior-year donation / contribution data is available. Pre-fill this form?</span>
            <div className="flex gap-2">
              <button type="button" onClick={dismissPriorCredits} className="rounded-brand border-[1.5px] border-slate-300 px-3 py-1.5 font-body text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">Dismiss</button>
              <button type="button" onClick={applyPriorCredits} className="rounded-brand bg-navy px-3 py-1.5 font-body text-xs font-bold text-white transition-colors hover:bg-navy-dark">Apply prior year</button>
            </div>
          </div>
        )}

        {/* Credit rows — flat list. Each item carries a Y/N selector, a donation
            amount input and an editable computed-credit input. */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
          {visibleCreditItems.map((item) => (
            <CreditItemRow
              key={item.id}
              item={item}
              control={control}
              register={register}
              errors={errors}
              taxableIncome={taxableIncome}
              avgRate={avgRate}
            />
          ))}
        </div>

        {/* Advanced toggle: reveals less-common credit lines (donations
            to associate, surrender of tax credit). Only shown when
            there's an extra to reveal — pension / charitable already in
            the always-or-addon set are filtered above. */}
        {advancedExtraCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-brand border-[1.5px] border-navy/20 bg-navy/[0.03] px-4 py-3 font-body text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.06] focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15"
          >
            {showAdvanced ? (
              <>
                <ChevronDown size={16} aria-hidden="true" />
                Hide advanced credit fields
              </>
            ) : (
              <>
                <Plus size={16} aria-hidden="true" />
                Show {advancedExtraCount} more advanced credit item{advancedExtraCount === 1 ? '' : 's'}
              </>
            )}
          </button>
        )}

        {/* Total tax credit — navy total band. */}
        <LiveAmount component={AmountRow} field="total" label="Total tax credit" variant="total" />
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default CreditsForm;