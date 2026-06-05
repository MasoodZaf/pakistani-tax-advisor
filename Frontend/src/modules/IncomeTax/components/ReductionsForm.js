import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  TrendingDown,
  Info,
  ChevronDown,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import reductionsHelp from '../../../help/reductionsHelp';
import { TaxFormShell, AmountRow, FormNav, LiveTotalsProvider, LiveAmount, LiveWhen } from '../../../components/forms';
import FormEmptyState from './FormEmptyState';

// PERF-02: the two auto-calc effects run here (headless) so their field
// subscriptions don't re-render the whole form. Each watches only the field(s)
// it needs; current values (for the guards) are read one-shot via getValues.
// Logic is byte-identical to the former in-component effects.
const ReductionsAutoCalc = ({ control, getValues, setValue, contextFormData, rates, teacherReductionRate, behboodMaxRate }) => {
  const teacherYN = useWatch({ control, name: 'teacher_researcher_reduction_yn' });
  const behboodYN = useWatch({ control, name: 'behbood_certificates_reduction_yn' });
  const behboodAmount = useWatch({ control, name: 'behbood_certificates_amount' });

  // Teacher/researcher reduction (u/s 100C).
  useEffect(() => {
    if (teacherYN !== 'Y') return;
    if (!teacherReductionRate) return; // wait for rates

    const finalMinData = contextFormData['final_min_income'] || {};
    let salaryTax = parseFloat(finalMinData.salary_u_s_12_7_tax_chargeable) ||
                    parseFloat(finalMinData.salary_tax_chargeable) ||
                    parseFloat(finalMinData.salary_employees_tax_chargeable) || 0;

    // Fallback: derive salary tax from income context + slab walk.
    if (salaryTax === 0) {
      const incomeData = contextFormData['income'] || {};
      const salary = parseFloat(incomeData.total_employment_income) ||
                     parseFloat(incomeData.annual_salary_wages_total) || 0;
      const otherTaxable = parseFloat(incomeData.other_income_no_min_tax_total) || 0;
      const totalTaxable = salary + otherTaxable;
      if (totalTaxable > 0 && rates?.slabs?.length) {
        let totalTax = 0;
        for (const s of rates.slabs) {
          const minI = Number(s.min_income), maxI = s.max_income == null ? Infinity : Number(s.max_income);
          const rate = Number(s.tax_rate);
          const lower = minI > 0 ? minI - 1 : 0;
          if (totalTaxable <= lower) continue;
          const ceil = Math.min(totalTaxable, maxI);
          if (ceil - lower > 0 && rate > 0) totalTax += (ceil - lower) * rate;
        }
        const salaryShare = salary / totalTaxable;
        salaryTax = Math.round(totalTax * salaryShare);
      }
    }

    if (salaryTax > 0) {
      const reduction = Math.round(salaryTax * teacherReductionRate);
      const current = parseFloat(getValues('teacher_researcher_tax_reduction')) || 0;
      if (Math.abs(current - reduction) > 0.5) {
        setValue('teacher_researcher_tax_reduction', reduction);
      }
    }
  }, [teacherYN, contextFormData, teacherReductionRate, rates, getValues, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Behbood certificate cap (2nd Sched Pt III cl.6).
  useEffect(() => {
    if (behboodYN !== 'Y') return;
    if (!behboodMaxRate) return;

    const profitAmount = parseFloat(behboodAmount) || 0;
    if (profitAmount <= 0) return;

    const maxTax = Math.round(profitAmount * behboodMaxRate);
    const current = parseFloat(getValues('behbood_certificates_tax_reduction')) || 0;
    if (current === 0) {
      setValue('behbood_certificates_tax_reduction', maxTax);
    }
  }, [behboodYN, behboodAmount, behboodMaxRate, getValues, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

const ReductionsForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving,
    incomeProfile,
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  // DB-sourced reduction rates (rate_type='reduction' in tax_rates_config).
  const teacherReductionRate = rates?.reductions?.teacher_researcher?.rate;
  const behboodMaxRate       = rates?.reductions?.behbood_certificate_max_rate?.rate;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    control,
    getValues,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('reductions')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back).
  // Reverse-map DB column names → form field names for capital gain reductions,
  // since buildReductionsPayload renamed them on save.
  useEffect(() => {
    const savedData = contextFormData['reductions'];
    if (savedData && Object.keys(savedData).length > 0) {
      const normalized = {
        ...savedData,
        capital_gain_immovable_tax_reduction: savedData.capital_gain_immovable_50_reduction || 0,
        capital_gain_clause9a_tax_reduction:  savedData.capital_gain_immovable_75_reduction  || 0,
      };
      reset(normalized);
    }
  }, [contextFormData, reset]);

  // PERF-02: no bare watch() at render. The two auto-calc effects run in the
  // headless <ReductionsAutoCalc> child; the total is isolated in
  // <LiveTotalsProvider>; each row's hint self-subscribes via <LiveWhen>.

  // Prior year pre-fill

  // Define comprehensive tax reduction structure matching Excel
  const reductionItems = [
    {
      id: 'teacher_researcher_reduction',
      description: 'Tax Reduction for Full Time Teacher / Researcher (Except teachers of medical professionals who derive income from private medical practice)',
      yesNo: 'Y',
      amount: 'teacher_researcher_amount',
      taxReduction: 'teacher_researcher_tax_reduction',
      limits: '25% of tax payable on salary income — auto-calculated when Y selected',
      autoCalc: true
    },
    {
      id: 'behbood_certificates_reduction',
      description: 'Tax Reduction on Charged on Behbood Certificates / Pensioner\'s Benefit Account in excess of applicable rate',
      yesNo: 'Y',
      amount: 'behbood_certificates_amount',
      taxReduction: 'behbood_certificates_tax_reduction',
      limits: 'Tax shall not exceed 5% of profit — auto-calculated when amount entered',
      autoCalc: true
    },
    {
      id: 'capital_gain_immovable_reduction',
      description: 'Tax Reduction on Capital Gain on Immovable Property under clause (9A), Part II, Second Schedule for Ex-Servicemen and serving personnel of Armed Forces and ex-employees and serving personnel of Federal & Provincial Government @50%',
      yesNo: 'Y',
      amount: 'capital_gain_immovable_amount',
      taxReduction: 'capital_gain_immovable_tax_reduction',
      limits: '50% of the normal tax on capital gain'
    },
    {
      id: 'capital_gain_clause9a_reduction',
      description: 'Tax Reduction on Capital Gain on Immovable Property under clause (9A), Part III, Second Schedule for Ex-Servicemen and serving personnel of Armed Forces and ex-employees and serving personnel of Federal & Provincial Government @75%',
      yesNo: 'Y',
      amount: 'capital_gain_clause9a_amount',
      taxReduction: 'capital_gain_clause9a_tax_reduction',
      limits: '75% of the normal tax on capital gain'
    }
  ];

  // Field-level visibility — driven by income-profile addons. The form's
  // local field names don't match DB column names for capital-gain rows
  // (buildReductionsPayload renames them at save time), so we map each
  // item to its canonical DB column for the visibility check.
  const ITEM_DB_COLUMN = {
    teacher_researcher_reduction:        'teacher_researcher_tax_reduction',
    behbood_certificates_reduction:      'behbood_certificates_tax_reduction',
    capital_gain_immovable_reduction:    'capital_gain_immovable_50_reduction',
    capital_gain_clause9a_reduction:     'capital_gain_immovable_75_reduction',
  };
  const addons = useMemo(() => incomeProfile?.addons || [], [incomeProfile]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visibleFields = useMemo(
    () => visibleFieldsFor('reductions_forms', addons, { advanced: showAdvanced }),
    [addons, showAdvanced]
  );
  const visibleReductionItems = useMemo(
    () => reductionItems.filter((item) => visibleFields.has(ITEM_DB_COLUMN[item.id])),
    [reductionItems, visibleFields] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Form-accurate count: how many extra rows the toggle will reveal here.
  const advancedExtraCount = useMemo(() => {
    const withAdv = visibleFieldsFor('reductions_forms', addons, { advanced: true });
    const itemsWithAdv = reductionItems.filter((item) => withAdv.has(ITEM_DB_COLUMN[item.id])).length;
    return itemsWithAdv - visibleReductionItems.length;
  }, [addons, reductionItems, visibleReductionItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sum of all per-item tax-reduction fields. Pure.
  const sumReductions = (values) =>
    reductionItems.reduce((total, item) => total + (parseFloat(values[item.taxReduction]) || 0), 0);

  // Map frontend field names to DB column names and strip non-existent columns
  const buildReductionsPayload = (data) => {
    const {
      // Strip fields not in DB schema
      capital_gain_immovable_amount: _cgImmoAmt,
      capital_gain_clause9a_amount: _cg9aAmt,
      capital_gain_immovable_reduction_yn: _cgImmoYN,
      capital_gain_clause9a_reduction_yn: _cg9aYN,
      // Extract and rename to correct DB column names
      capital_gain_immovable_tax_reduction,
      capital_gain_clause9a_tax_reduction,
      ...rest
    } = data;

    return {
      ...rest,
      capital_gain_immovable_50_reduction: capital_gain_immovable_tax_reduction || 0,
      capital_gain_immovable_75_reduction: capital_gain_clause9a_tax_reduction || 0,
      total_tax_reductions: sumReductions(data),  // DB column is plural (total_tax_reductions)
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('reductions', buildReductionsPayload(data), true);
    if (success) {
      toast.success('Tax reductions information saved successfully');
      navigate('/income-tax/credits');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('reductions', buildReductionsPayload(watch()), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/credits');
    }
  };
  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="reductions-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="reductions-help">
      <h3 className="font-display text-sm font-bold text-navy dark:text-[#e7eaf3]">About tax reductions</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600 dark:text-[#aab2cc]">
        <li>Tax reductions directly reduce your calculated tax liability.</li>
        <li>Select <strong className="text-navy dark:text-[#e7eaf3]">Y</strong> for any reduction that applies to you, then enter the relevant amount.</li>
        <li>Some reductions are auto-calculated from your salary or profit figures — these stay editable.</li>
        <li>Capital-gain reductions for armed-forces and government personnel apply only to qualifying disposals.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <ReductionsAutoCalc control={control} getValues={getValues} setValue={setValue} contextFormData={contextFormData} rates={rates} teacherReductionRate={teacherReductionRate} behboodMaxRate={behboodMaxRate} />
      <LiveTotalsProvider control={control} compute={(v) => ({ total: sumReductions(v) })}>
      <TaxFormShell
        title="Tax reductions"
        subtitle="Reductions that lower your calculated tax liability"
        icon={TrendingDown}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/adjustable-tax')}
            backLabel="Adjustable tax"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >

        {visibleReductionItems.length === 0 && (
          <FormEmptyState
            title="No tax reductions apply to your income profile yet."
            addons={['Property Sale']}
            note='Capital-gain reductions on immovable property appear when you add Property Sale. Use "Show advanced" below to reveal teacher/researcher and Behbood-certificate reductions.'
          />
        )}

        {visibleReductionItems.length > 0 && (
          <>
            <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Tax reductions</h2>
            <div className="divide-y divide-slate-100 dark:divide-[#2a3450] overflow-hidden rounded-brand-lg border border-slate-200 dark:border-[#2a3450]">
              {visibleReductionItems.map((item) => (
                <div key={item.id} className="grid grid-cols-1 gap-3 px-3 py-3 md:grid-cols-[1fr_90px_160px_160px] md:items-start md:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-start gap-1.5">
                      <span className="font-body text-sm leading-snug text-slate-700 dark:text-[#aab2cc]">{item.description}</span>
                      <HelpHint fieldId={item.id} source={reductionsHelp} />
                    </div>
                    {item.limits && <p className="mt-0.5 font-body text-xs text-slate-400 dark:text-[#7e88a6]">{item.limits}</p>}
                  </div>

                  <div>
                    <label htmlFor={`${item.id}_yn`} className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Applies?</label>
                    <select
                      id={`${item.id}_yn`}
                      {...register(`${item.id}_yn`)}
                      className="w-full rounded-brand border-[1.5px] border-slate-300 dark:border-[#2a3450] bg-white dark:bg-[#151c30] px-2.5 py-2 font-body text-sm font-semibold text-navy dark:text-[#e7eaf3] focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                    >
                      <option value="">-</option>
                      <option value="Y">Y</option>
                      <option value="N">N</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={item.amount} className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Amount</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400 dark:text-[#7e88a6]">Rs</span>
                      <input
                        id={item.amount}
                        type="number"
                        step="0.01"
                        inputMode="numeric"
                        aria-invalid={errors[item.amount] ? true : undefined}
                        {...register(item.amount, {
                          min: { value: 0, message: 'Amount cannot be negative' },
                          valueAsNumber: true
                        })}
                        className="w-full rounded-brand border-[1.5px] border-slate-300 dark:border-[#2a3450] bg-white dark:bg-[#151c30] py-2 pl-10 pr-3 text-right font-body text-sm font-semibold tabular-nums text-navy dark:text-[#e7eaf3] transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                        placeholder="0"
                      />
                    </div>
                    {errors[item.amount] && (
                      <p role="alert" className="mt-1 text-right font-body text-xs text-red-600 dark:text-red-300">{errors[item.amount].message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={item.taxReduction} className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Tax reduction</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400 dark:text-[#7e88a6]">Rs</span>
                      <input
                        id={item.taxReduction}
                        type="number"
                        step="0.01"
                        inputMode="numeric"
                        aria-invalid={errors[item.taxReduction] ? true : undefined}
                        {...register(item.taxReduction, {
                          min: { value: 0, message: 'Amount cannot be negative' },
                          valueAsNumber: true
                        })}
                        className="w-full rounded-brand border-[1.5px] border-slate-300 dark:border-[#2a3450] bg-white dark:bg-[#151c30] py-2 pl-10 pr-3 text-right font-body text-sm font-semibold tabular-nums text-navy dark:text-[#e7eaf3] transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15"
                        placeholder="0"
                        title={item.autoCalc ? 'Auto-calculated — editable' : undefined}
                      />
                    </div>
                    {item.autoCalc && (
                      <LiveWhen control={control} field={item.taxReduction}>
                        <p className="mt-1 text-right font-body text-xs text-slate-400 dark:text-[#7e88a6]">Auto-calculated — editable</p>
                      </LiveWhen>
                    )}
                    {errors[item.taxReduction] && (
                      <p role="alert" className="mt-1 text-right font-body text-xs text-red-600 dark:text-red-300">{errors[item.taxReduction].message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Advanced toggle: reveals teacher/researcher + Behbood
            certificate reductions (both ADVANCED in the manifest). */}
        {advancedExtraCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-brand border-[1.5px] border-navy/20 bg-navy/[0.03] px-4 py-3 font-body text-sm font-semibold text-navy dark:text-[#e7eaf3] transition-colors hover:bg-navy/[0.06] focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15"
          >
            {showAdvanced
              ? (<><ChevronDown size={16} aria-hidden="true" /> Hide advanced reduction fields</>)
              : (<><Plus size={16} aria-hidden="true" /> Show {advancedExtraCount} more advanced reduction item{advancedExtraCount === 1 ? '' : 's'}</>)}
          </button>
        )}

        <LiveAmount component={AmountRow} variant="total" field="total" label="Total tax reduction" />
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default ReductionsForm;