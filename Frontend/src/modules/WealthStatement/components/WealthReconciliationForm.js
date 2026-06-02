import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  AlertTriangle,
  CheckCircle,
  Info,
  Calculator,
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import wealthReconciliationHelp from '../../../help/wealthReconciliationHelp';
import { formatCurrency } from '../../../utils/currency';
import {
  TaxFormShell,
  FormStateScreen,
  TaxFormRow,
  AmountRow,
  FormNav,
} from '../../../components/forms';

// Inflow/outflow input fields the reconciliation calc depends on.
const RECON_INPUT_FIELDS = [
  'personal_expenses', 'gift_value', 'gift_outflow', 'asset_disposal_gain_loss',
  'foreign_remittance', 'inheritance', 'other_inflows', 'adjustments_outflows', 'loss_on_disposal',
];

// PERF-02: the reconciliation calc + personal-expenses sync run here (headless)
// so the parent needs no bare watch(). Self-subscribes to ONLY the inflow/
// outflow inputs, computes the reconciliation, writes the DB-bound computed
// fields via setValue, and lifts the result to the parent via onResult. Math is
// byte-identical to the former in-component effects. Rendered OUTSIDE the
// parent's loading branch so it always runs (and clears loading).
const WealthReconCalc = ({ control, formData, setValue, onResult }) => {
  const w = useWatch({ control, name: RECON_INPUT_FIELDS });
  const wv = {};
  RECON_INPUT_FIELDS.forEach((f, i) => { wv[f] = w[i]; });

  // Auto-populate personal_expenses from the Expenses form (total_expenses).
  useEffect(() => {
    const totalExpenses = parseFloat(formData?.expenses?.total_expenses);
    if (totalExpenses > 0) setValue('personal_expenses', totalExpenses);
  }, [formData, setValue]);

  useEffect(() => {
    if (!(formData && Object.keys(formData).length > 0)) {
      onResult(null, 0);
      return;
    }
    try {
      const wealthData   = formData?.wealth    || {};
      const incomeData   = formData?.income    || {};
      const expensesData = formData?.expenses  || {};
      const finalTaxData = formData?.final_tax || {};

      const netAssetsCurrent  = parseFloat(wealthData.net_worth_current_year)
        || (parseFloat(wealthData.total_assets_current_year  || 0) - parseFloat(wealthData.total_liabilities_current_year  || 0));
      const netAssetsPrevious = parseFloat(wealthData.net_worth_previous_year)
        || (parseFloat(wealthData.total_assets_previous_year || 0) - parseFloat(wealthData.total_liabilities_previous_year || 0));
      const netAssetsIncrease = netAssetsCurrent - netAssetsPrevious;

      const incomeNormalTax    = parseFloat(incomeData.total_employment_income || incomeData.total_taxable_income || 0);
      const incomeExemptFromTax= parseFloat(incomeData.income_exempt_from_tax  || incomeData.total_exempt_income   || 0);
      const incomeFinalTax     = parseFloat(finalTaxData.total_final_tax || 0);
      const foreignRemittance  = parseFloat(wv.foreign_remittance   || 0);
      const inheritance        = parseFloat(wv.inheritance          || 0);
      const giftInflow         = parseFloat(wv.gift_value           || 0);
      const assetGainLoss      = parseFloat(wv.asset_disposal_gain_loss || 0);
      const otherInflows       = parseFloat(wv.other_inflows        || 0);
      const totalInflows = incomeNormalTax + incomeExemptFromTax + incomeFinalTax +
                           foreignRemittance + inheritance + giftInflow + assetGainLoss + otherInflows;

      const personalExpenses   = parseFloat(expensesData.total_expenses || wv.personal_expenses || 0);
      const adjustmentsOutflows= parseFloat(wv.adjustments_outflows || 0);
      const giftOutflow        = parseFloat(wv.gift_outflow   || 0);
      const lossOnDisposal     = parseFloat(wv.loss_on_disposal    || 0);
      const totalOutflows = personalExpenses + adjustmentsOutflows + giftOutflow + lossOnDisposal;

      const calculatedNetIncrease = totalInflows - totalOutflows;
      const unreconciledDiff      = netAssetsIncrease - calculatedNetIncrease;

      const reconciliation = {
        net_assets_current_year:  netAssetsCurrent,
        net_assets_previous_year: netAssetsPrevious,
        net_assets_increase:      netAssetsIncrease,
        income_normal_tax:        incomeNormalTax,
        income_exempt_from_tax:   incomeExemptFromTax,
        income_final_tax:         incomeFinalTax,
        total_inflows:            totalInflows,
        personal_expenses:        personalExpenses,
        total_outflows:           totalOutflows,
        calculated_net_increase:  calculatedNetIncrease,
        unreconciled_difference:  unreconciledDiff,
      };

      Object.entries(reconciliation).forEach(([key, value]) => setValue(key, value));
      onResult(reconciliation, unreconciledDiff);
    } catch {
      toast.error('Error calculating wealth reconciliation');
      onResult(null, 0);
    }
  }, [formData, wv.personal_expenses, wv.gift_value, wv.gift_outflow, wv.asset_disposal_gain_loss, wv.foreign_remittance, wv.inheritance, wv.other_inflows, wv.adjustments_outflows, wv.loss_on_disposal, setValue, onResult]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

const WealthReconciliationForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    formData,
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [unreconciledDifference, setUnreconciledDifference] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    getValues
  } = useForm({
    defaultValues: getStepData('wealth_reconciliation')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back)
  useEffect(() => {
    const savedData = formData['wealth_reconciliation'];
    if (savedData && Object.keys(savedData).length > 0) {
      reset(savedData);
    }
  }, [formData, reset]);

  // PERF-02: no bare watch() at render. The reconciliation calc + personal-
  // expenses sync run in the headless <WealthReconCalc> child below, which lifts
  // the result here. Stable callback so the child's effect dep is stable.
  const handleResult = useCallback((reconciliation, diff) => {
    setReconciliationData(reconciliation);
    setUnreconciledDifference(diff);
    setLoading(false);
  }, []);

  const onSubmit = async (data) => {
    // FBR Compliance Check - Unreconciled difference MUST be zero
    if (Math.abs(unreconciledDifference) > 0.01) {
      toast.error('Cannot submit: Unreconciled difference must be zero. Please adjust your entries to balance the reconciliation.');
      return;
    }

    const success = await saveFormStep('wealth_reconciliation', data, true);
    if (success) {
      toast.success('Wealth reconciliation completed successfully');
      navigate('/income-tax/tax-computation');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watch();
    const success = await saveFormStep('wealth_reconciliation', data, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/income-tax/tax-computation');
    }
  };
  // Always-mounted headless calc child — drives loading + reconciliation state.
  // Rendered in BOTH branches at the same position so it never remounts.
  const calcChild = (
    <WealthReconCalc control={control} formData={formData} setValue={setValue} onResult={handleResult} />
  );

  if (loading) {
    return (
      <>
        {calcChild}
        <FormStateScreen
          icon={Calculator}
          spinning
          title="Calculating reconciliation…"
          message="Pulling figures from your wealth statement and income forms."
        />
      </>
    );
  }

  const balanced = Math.abs(unreconciledDifference) < 0.01;

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="wealth-recon-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="wealth-recon-help">
      <h3 className="font-display text-sm font-bold text-navy">About wealth reconciliation</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600">
        <li>The unreconciled difference must be zero before you can submit.</li>
        <li>It reconciles your net-worth increase with declared income and expenses.</li>
        <li>Figures are pulled automatically from your wealth statement and income forms.</li>
        <li>Adjust personal expenses or other items to balance the reconciliation.</li>
        <li>Any unexplained increase in wealth may trigger an FBR audit.</li>
      </ul>
    </div>
  ) : null;

  return (
    <>
    {calcChild}
    <form onSubmit={handleSubmit(onSubmit)}>
      <TaxFormShell
        title="Wealth reconciliation"
        subtitle="Reconcile your net-worth increase with declared income and expenses"
        icon={Scale}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/wealth-statement/wealth-statement')}
            backLabel="Wealth statement"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel={
              saving ? 'Completing…' : balanced ? 'Complete reconciliation' : 'Balance required'
            }
          />
        }
      >
        {/* Hidden registered fields — keep the computed values wired into the
            form payload (display is handled by the read-only AmountRows below). */}
        <input type="hidden" {...register('net_assets_current_year')} />
        <input type="hidden" {...register('net_assets_previous_year')} />
        <input type="hidden" {...register('income_normal_tax')} />
        <input type="hidden" {...register('income_exempt_from_tax')} />
        <input type="hidden" {...register('income_final_tax')} />

        {/* Compliance status banner */}
        <div
          role={balanced ? 'status' : 'alert'}
          className={`flex items-start gap-3 rounded-brand-lg border px-4 py-3 ${
            balanced
              ? 'border-green-600/30 bg-green-600/[0.06]'
              : 'border-red-500/30 bg-red-500/[0.06]'
          }`}
        >
          {balanced ? (
            <CheckCircle size={22} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
          ) : (
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <h2 className={`font-display text-sm font-bold ${balanced ? 'text-green-800' : 'text-red-700'}`}>
              {balanced ? 'Reconciliation balanced' : 'Reconciliation not balanced'}
            </h2>
            <p className={`font-body text-sm ${balanced ? 'text-green-800/90' : 'text-red-700/90'}`}>
              Unreconciled difference: <strong className="tabular-nums">{formatCurrency(unreconciledDifference)}</strong>
              {!balanced && ' — must be zero before you can submit.'}
            </p>
          </div>
        </div>

        {/* Quick balance helper — pick a likely bucket and we add the difference. */}
        {!balanced && (
          <div className="rounded-brand-lg border border-navy/20 bg-navy/[0.03] px-4 py-3">
            <h2 className="font-display text-sm font-bold text-navy">Quick balance</h2>
            <p className="mt-1 font-body text-xs text-slate-600">
              {unreconciledDifference > 0
                ? `Your asset increase exceeds declared inflows by ${formatCurrency(unreconciledDifference)}. The most likely sources are below — pick one and we'll add the difference to it.`
                : `Your declared inflows exceed your asset increase by ${formatCurrency(Math.abs(unreconciledDifference))}. Either reduce an inflow or add to outflows below.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(unreconciledDifference > 0
                ? [
                    { field: 'foreign_remittance',       label: 'Foreign Remittance' },
                    { field: 'inheritance',              label: 'Inheritance' },
                    { field: 'gift_value',               label: 'Gift Received' },
                    { field: 'other_inflows',            label: 'Other Inflows' },
                  ]
                : [
                    { field: 'gift_outflow',             label: 'Gift Given' },
                    { field: 'adjustments_outflows',     label: 'Other Adjustments' },
                    { field: 'loss_on_disposal',         label: 'Loss on Disposal' },
                  ]
              ).map(({ field, label }) => {
                const current = parseFloat(getValues(field) || 0);
                const next    = unreconciledDifference > 0
                  ? current + unreconciledDifference
                  : current + Math.abs(unreconciledDifference);
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setValue(field, Math.round(next * 100) / 100)}
                    className="rounded-brand border-[1.5px] border-navy/30 bg-white px-3 py-2 text-left font-body text-xs font-semibold text-navy transition-colors hover:bg-navy/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/20"
                  >
                    Add to {label}
                    <span className="mt-0.5 block font-body text-[11px] font-normal tabular-nums text-slate-500">
                      {formatCurrency(current)} → {formatCurrency(next)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 font-body text-[11px] italic text-slate-500">
              Only use a category that reflects your actual financial activity. Picking the wrong bucket is worse than leaving it unbalanced — FBR can audit-flag inflated remittances or inheritances.
            </p>
          </div>
        )}

        {/* Net assets */}
        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">
            Net assets
          </h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
            <AmountRow variant="calculated" label="Net assets — current year" amount={reconciliationData?.net_assets_current_year || 0} />
            <AmountRow variant="calculated" label="Net assets — previous year" amount={reconciliationData?.net_assets_previous_year || 0} />
            <AmountRow variant="subtotal" label="Increase / (decrease) in assets" amount={reconciliationData?.net_assets_increase || 0} />
          </div>
        </div>

        {/* Inflows */}
        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">
            Inflows
          </h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200 px-3">
            <AmountRow variant="calculated" label="Income declared subject to normal tax" amount={reconciliationData?.income_normal_tax || 0} />
            <AmountRow variant="calculated" label="Income declared exempt from tax" amount={reconciliationData?.income_exempt_from_tax || 0} />
            <AmountRow variant="calculated" label="Income attributable to receipts under final / fixed tax and CGT" amount={reconciliationData?.income_final_tax || 0} />
            <TaxFormRow
              name="foreign_remittance"
              label="Foreign remittance"
              help={<HelpHint fieldId="foreign_remittance" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('foreign_remittance') }}
            />
            <TaxFormRow
              name="inheritance"
              label="Inheritance"
              help={<HelpHint fieldId="inheritance" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('inheritance') }}
            />
            <TaxFormRow
              name="gift_value"
              label="Gift received"
              sublabel="Value declared in gift deed"
              help={<HelpHint fieldId="gift_value" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('gift_value') }}
            />
            <TaxFormRow
              name="asset_disposal_gain_loss"
              label="Gain / (loss) on disposal of assets"
              sublabel="Excluding capital gain"
              help={<HelpHint fieldId="asset_disposal_gain_loss" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('asset_disposal_gain_loss') }}
            />
            <TaxFormRow
              name="other_inflows"
              label="Other inflows"
              help={<HelpHint fieldId="other_inflows" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('other_inflows') }}
            />
            <AmountRow variant="subtotal" label="Total inflows" amount={reconciliationData?.total_inflows || 0} />
          </div>
        </div>

        {/* Outflows */}
        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">
            Outflows
          </h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200 px-3">
            <TaxFormRow
              name="personal_expenses"
              label="Personal expenses"
              help={<HelpHint fieldId="personal_expenses" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('personal_expenses') }}
            />
            <TaxFormRow
              name="adjustments_outflows"
              label="Adjustments in outflows"
              help={<HelpHint fieldId="adjustments_outflows" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('adjustments_outflows') }}
            />
            <TaxFormRow
              name="gift_outflow"
              label="Gift given"
              help={<HelpHint fieldId="gift_outflow" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('gift_outflow') }}
            />
            <TaxFormRow
              name="loss_on_disposal"
              label="Loss on disposal of assets"
              help={<HelpHint fieldId="loss_on_disposal" source={wealthReconciliationHelp} />}
              inputProps={{ type: 'number', step: '0.01', ...register('loss_on_disposal') }}
            />
            <AmountRow variant="subtotal" label="Total outflows" amount={reconciliationData?.total_outflows || 0} />
          </div>
        </div>

        {/* Result */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
          <AmountRow variant="total" label="Net increase / (decrease) in assets" amount={reconciliationData?.calculated_net_increase || 0} />
          <AmountRow
            variant={balanced ? 'subtotal' : 'payable'}
            label="Unreconciled difference"
            sublabel={balanced ? 'Balanced — ready to submit' : 'Must be zero to submit your tax return'}
            amount={unreconciledDifference}
          />
        </div>
      </TaxFormShell>
    </form>
    </>
  );
};

export default WealthReconciliationForm;