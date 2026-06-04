import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import deductionsHelp from '../../../help/deductionsHelp';
import { formatCurrency } from '../../../utils/currency';
import MobileExpensesWidget from '../../../components/MobileExpenses/MobileExpensesWidget';
import {
  TaxFormShell,
  TaxFormRow,
  AmountRow,
  FormNav,
  LiveTotalsProvider,
  LiveAmount,
} from '../../../components/forms';

// PERF-02: the two auto-calc effects run here (headless) so their field
// subscriptions don't re-render the whole form. Logic byte-identical to the
// former in-component effects.
const DeductionsAutoCalc = ({ control, setValue, taxableIncome, profExpEligible, eduExpEligible, profPosPct, profTaxablePct, eduPerChild, eduMaxChildren }) => {
  const posAmount = useWatch({ control, name: 'professional_expenses_pos_amount' });
  const childrenCount = useWatch({ control, name: 'education_expense_children_count' });

  // Professional expenses: MIN(POS-pct × POS amount, taxable-pct × taxable income).
  useEffect(() => {
    if (!profExpEligible || taxableIncome <= 0) return;
    if (!profPosPct || !profTaxablePct) return; // wait for rates
    const pos = parseFloat(posAmount) || 0;
    if (pos > 0) {
      const posCapped    = Math.round(pos * profPosPct);
      const incomeCapped = Math.round(taxableIncome * profTaxablePct);
      setValue('professional_expenses_amount', Math.min(posCapped, incomeCapped));
    }
  }, [posAmount, taxableIncome, profExpEligible, profPosPct, profTaxablePct]); // eslint-disable-line react-hooks/exhaustive-deps

  // Education expense: per-child cap × min(count, max-children).
  useEffect(() => {
    if (eduPerChild === undefined || eduMaxChildren === undefined) return;
    if (!eduExpEligible) {
      setValue('education_expense_deduction', 0);
      return;
    }
    const numChildren = Math.min(parseInt(childrenCount) || 0, eduMaxChildren);
    setValue('education_expense_deduction', numChildren * eduPerChild);
  }, [childrenCount, taxableIncome, eduExpEligible, eduPerChild, eduMaxChildren]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

// Self-subscribing "lower of …" hint under the POS-amount input.
const ProfExpHint = ({ control, taxableIncome, posPct, taxPct }) => {
  const posAmount = useWatch({ control, name: 'professional_expenses_pos_amount' });
  const pos = parseFloat(posAmount) || 0;
  if (!(pos > 0 && taxableIncome > 0 && posPct && taxPct)) return null;
  const a = Math.round(pos * posPct);
  const b = Math.round(taxableIncome * taxPct);
  const posPctDisplay = (posPct * 100).toFixed(0);
  const taxPctDisplay = (taxPct * 100).toFixed(0);
  return (
    <p className="mt-1 text-right font-body text-xs text-slate-500">
      Lower of {posPctDisplay}% of POS (Rs {a.toLocaleString('en-PK')}) and {taxPctDisplay}% of income (Rs {b.toLocaleString('en-PK')}) = Rs {Math.min(a, b).toLocaleString('en-PK')}
    </p>
  );
};

const DeductionsForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('deductions')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back).
  // Reverse-map DB column names → form field names for the education expense group,
  // since buildDeductionsPayload renamed them on save.
  useEffect(() => {
    const savedData = contextFormData['deductions'];
    if (savedData && Object.keys(savedData).length > 0) {
      const normalized = {
        ...savedData,
        education_expense_deduction:     savedData.educational_expenses_amount         || 0,
        education_expense_children_count: savedData.educational_expenses_children_count || 0,
        education_expense_yn:            savedData.educational_expenses_yn             || '',
      };
      reset(normalized);
    }
  }, [contextFormData, reset]);

  // PERF-02: no bare watch() at render. The two auto-calc effects run in the
  // headless <DeductionsAutoCalc> child; the total is isolated in
  // <LiveTotalsProvider>; the POS hint self-subscribes via <ProfExpHint>.

  // Prior year pre-fill

  // ── Income threshold checks ──────────────────────────────────────────────────
  const incomeData = contextFormData['income'] || {};
  const taxableIncome =
    (parseFloat(incomeData.total_employment_income) || parseFloat(incomeData.annual_salary_wages_total) || 0)
    + (parseFloat(incomeData.other_income_no_min_tax_total) || 0);

  // DB-sourced thresholds (rate_type='deduction_threshold').
  //   prof_expenses_max_taxable_income  → Rs 1.5M income cap to qualify
  //   prof_expenses_pos_amount_pct      → 5% of POS amount
  //   prof_expenses_taxable_income_pct  → 25% of taxable income cap
  //   education_per_child_cap           → Rs 60,000 per child
  //   education_max_children            → 2 children max
  const dt = rates?.deductionThresholds;
  const PROF_EXP_THRESHOLD       = dt?.prof_expenses_max_taxable_income?.fixedAmount;
  const PROF_EXP_POS_PCT         = dt?.prof_expenses_pos_amount_pct?.rate;
  const PROF_EXP_TAXABLE_PCT     = dt?.prof_expenses_taxable_income_pct?.rate;
  const EDU_THRESHOLD            = dt?.education_max_taxable_income?.fixedAmount;
  const EDU_DEDUCTION_PER_CHILD  = dt?.education_per_child_cap?.fixedAmount;
  const EDU_MAX_CHILDREN         = dt?.education_max_children?.fixedAmount;

  const profExpEligible = PROF_EXP_THRESHOLD === undefined
    ? false
    : (taxableIncome === 0 || taxableIncome <= PROF_EXP_THRESHOLD);
  const eduExpEligible  = EDU_THRESHOLD === undefined
    ? false
    : (taxableIncome === 0 || taxableIncome <= EDU_THRESHOLD);

  // (auto-calc effects relocated to <DeductionsAutoCalc> — see module scope)
  // ────────────────────────────────────────────────────────────────────────────

  // Define comprehensive deductible allowances structure matching Excel
  const deductionItems = [
    {
      id: 'professional_expenses',
      description: 'Professional expenses in respect of POS u/s 60C (taxable income ≤ Rs 1.5M only)',
      yesNo: 'Y',
      amount: 'professional_expenses_amount',
      limits: 'Lower of: 5% of POS amount OR 25% of taxable income',
      incomeThreshold: PROF_EXP_THRESHOLD,
      eligible: profExpEligible
    },
    {
      id: 'zakat_paid_ordinance',
      description: 'Zakat paid under the Zakat and Usher Ordinance — straight deduction',
      yesNo: 'Y',
      amount: 'zakat_paid_amount',
      limits: 'Full amount of Zakat paid (u/s 60)',
      eligible: true
    },
    {
      id: 'education_expense',
      description: 'Education expense deduction u/s 60D (taxable income ≤ Rs 1.5M; Rs 60,000 per child, max 2 children)',
      yesNo: 'Y',
      amount: 'education_expense_deduction',
      limits: 'Rs 60,000 × no. of children (max 2)',
      incomeThreshold: PROF_EXP_THRESHOLD,
      eligible: eduExpEligible,
      computed: true
    }
  ];

  // Sum of all per-item deduction amounts. Pure.
  const sumDeductions = (values) =>
    deductionItems.reduce((total, item) => total + (parseFloat(values[item.amount]) || 0), 0);

  // Map frontend field names to DB column names and strip non-existent columns
  const buildDeductionsPayload = (data) => {
    const {
      // Strip non-DB field (used only for auto-calc, not persisted)
      professional_expenses_pos_amount: _posAmt,
      // Extract and rename to correct DB column names
      education_expense_deduction,
      education_expense_children_count,
      education_expense_yn,
      ...rest
    } = data;

    return {
      ...rest,
      educational_expenses_amount:        education_expense_deduction    || 0,
      educational_expenses_children_count: education_expense_children_count || 0,
      educational_expenses_yn:            education_expense_yn            || '',
      total_deduction_from_income:        sumDeductions(data),
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('deductions', buildDeductionsPayload(data), true);
    if (success) {
      toast.success('Deductible allowances information saved successfully');
      navigate('/income-tax/final-tax');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('deductions', buildDeductionsPayload(watch()), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/final-tax');
    }
  };
  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="deductions-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="deductions-help">
      <h3 className="font-display text-sm font-bold text-navy">About deductible allowances</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600">
        <li>Professional expenses: for taxpayers with POS and taxable income up to Rs 1.5M.</li>
        <li>Zakat: a straight deduction for Zakat paid under the Zakat and Usher Ordinance.</li>
        <li>Professional expenses are the lower of 5% of the amount paid or 25% of taxable income.</li>
        <li>Deductible allowances reduce your taxable income before tax is calculated.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DeductionsAutoCalc
        control={control}
        setValue={setValue}
        taxableIncome={taxableIncome}
        profExpEligible={profExpEligible}
        eduExpEligible={eduExpEligible}
        profPosPct={PROF_EXP_POS_PCT}
        profTaxablePct={PROF_EXP_TAXABLE_PCT}
        eduPerChild={EDU_DEDUCTION_PER_CHILD}
        eduMaxChildren={EDU_MAX_CHILDREN}
      />
      <LiveTotalsProvider control={control} compute={(v) => ({ total: sumDeductions(v) })}>
      <TaxFormShell
        title="Deductible allowances"
        subtitle="Eligible allowances that reduce your taxable income"
        icon={CreditCard}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/credits')}
            backLabel="Tax credits"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >

        {/* Mobile-captured expenses for this tax year. Zakat is the only direct
            deduction field; the rest are surfaced so the user knows about them
            and can copy to the right form (credits, etc.). */}
        <MobileExpensesWidget
          taxYear={currentTaxYear || '2025-26'}
          setValue={setValue}
          getValues={getValues}
          fieldMap={{
            zakat: { field: 'zakat_paid_amount', yn: 'zakat_paid_yn' },
          }}
        />

        {taxableIncome > 0 && (
          <div className="rounded-brand border border-navy/20 bg-navy/[0.03] px-4 py-3 font-body text-sm text-navy">
            Taxable income from your Income form: <strong className="tabular-nums">{formatCurrency(taxableIncome)}</strong>.
            {taxableIncome > PROF_EXP_THRESHOLD && (
              <span className="mt-1 block text-slate-500">
                Professional expenses and education deduction are not applicable — income exceeds the Rs 1.5M threshold.
              </span>
            )}
          </div>
        )}

        <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
          {deductionItems.map((item) => {
            const ineligible = !item.eligible && taxableIncome > 0;
            return (
              <div key={item.id} className={`px-3 py-3 sm:px-4 ${ineligible ? 'opacity-50' : ''}`}>
                <TaxFormRow
                  name={item.amount}
                  label={item.description}
                  sublabel={item.limits}
                  help={<HelpHint fieldId={item.id} source={deductionsHelp} />}
                  error={errors[item.amount]?.message}
                  hint={item.computed ? 'Auto-calculated' : undefined}
                  readOnly={item.computed}
                  inputProps={{
                    type: 'number',
                    step: '0.01',
                    readOnly: item.computed,
                    title: item.computed ? 'Auto-calculated' : undefined,
                    ...register(item.amount, {
                      min: { value: 0, message: 'Amount cannot be negative' },
                      valueAsNumber: true
                    }),
                  }}
                />

                {/* Y/N applicability selector */}
                <div className="mt-1 grid grid-cols-1 gap-1.5 md:grid-cols-[1fr_220px] md:items-center md:gap-4">
                  <label htmlFor={`${item.id}_yn`} className="font-body text-sm leading-snug text-slate-700">
                    Claim this allowance?
                  </label>
                  <div className="md:w-[220px] md:justify-self-end">
                    <select
                      id={`${item.id}_yn`}
                      {...register(`${item.id}_yn`)}
                      className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white py-2 px-3 font-body text-sm text-navy transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500"
                      disabled={ineligible}
                    >
                      <option value="">—</option>
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  </div>
                </div>

                {/* Professional expenses: POS amount input for auto-calc */}
                {item.id === 'professional_expenses' && item.eligible && (
                  <div className="mt-1 grid grid-cols-1 gap-1.5 md:grid-cols-[1fr_220px] md:items-start md:gap-4">
                    <div className="flex items-start gap-1.5">
                      <label htmlFor="professional_expenses_pos_amount" className="font-body text-sm leading-snug text-slate-700">
                        Total POS payments
                        <span className="block font-body text-xs text-slate-400">Used to auto-calculate the deduction above</span>
                      </label>
                      <HelpHint fieldId="professional_expenses_pos_amount" source={deductionsHelp} />
                    </div>
                    <div className="md:w-[220px] md:justify-self-end">
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400">Rs</span>
                        <input
                          id="professional_expenses_pos_amount"
                          type="number"
                          step="1"
                          min="0"
                          inputMode="numeric"
                          {...register('professional_expenses_pos_amount', { valueAsNumber: true })}
                          className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white py-2 pl-10 pr-3 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                          placeholder="0"
                        />
                      </div>
                      <ProfExpHint control={control} taxableIncome={taxableIncome} posPct={PROF_EXP_POS_PCT} taxPct={PROF_EXP_TAXABLE_PCT} />
                    </div>
                  </div>
                )}

                {/* Education: number-of-children input */}
                {item.id === 'education_expense' && item.eligible && (
                  <div className="mt-1 grid grid-cols-1 gap-1.5 md:grid-cols-[1fr_220px] md:items-start md:gap-4">
                    <div className="flex items-start gap-1.5">
                      <label htmlFor="education_expense_children_count" className="font-body text-sm leading-snug text-slate-700">
                        Number of children
                        <span className="block font-body text-xs text-slate-400">Maximum 2</span>
                      </label>
                      <HelpHint fieldId="education_expense_children_count" source={deductionsHelp} />
                    </div>
                    <div className="md:w-[220px] md:justify-self-end">
                      <input
                        id="education_expense_children_count"
                        type="number"
                        step="1"
                        min="0"
                        max="2"
                        inputMode="numeric"
                        {...register('education_expense_children_count', { valueAsNumber: true, min: 0, max: 2 })}
                        className="w-full rounded-brand border-[1.5px] border-slate-300 bg-white py-2 px-3 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                        placeholder="0"
                      />
                    </div>
                  </div>
                )}

                {ineligible && (
                  <p className="mt-1 font-body text-xs text-slate-500">Not applicable — taxable income exceeds Rs 1.5M.</p>
                )}
              </div>
            );
          })}

          <LiveAmount component={AmountRow} variant="total" field="total" label="Total deduction from income" />
        </div>
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default DeductionsForm;