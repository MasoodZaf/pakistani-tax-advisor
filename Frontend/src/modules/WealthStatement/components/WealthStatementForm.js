import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import {
  Gem,
  Home,
  TrendingUp,
  Car,
  DollarSign,
  Briefcase,
  CreditCard,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import wealthStatementHelp from '../../../help/wealthStatementHelp';
import { formatCurrency } from '../../../utils/currency';
import {
  TaxFormShell,
  AmountRow,
  FormNav,
  LiveTotalsProvider,
  LiveAmount,
} from '../../../components/forms';

// Two-input wealth row (previous + current year). Defined at MODULE scope so it
// never remounts its inputs. PERF-02: it self-subscribes to ONLY its own two
// fields via useWatch, so typing in one row re-renders that row alone — not the
// whole form.
const WEALTH_INPUT_CLASSES =
  'w-full rounded-brand border-[1.5px] border-slate-300 dark:border-[#2a3450] bg-white dark:bg-[#151c30] py-2 pl-9 pr-3 text-right font-body text-sm font-semibold tabular-nums text-navy dark:text-[#e7eaf3] transition-colors placeholder:font-normal placeholder:text-slate-300 dark:placeholder:text-[#7e88a6] focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15';

const WealthRow = ({ rowKey, label, icon: Icon, register, control }) => {
  const prev = useWatch({ control, name: `${rowKey}_previous_year` });
  const curr = useWatch({ control, name: `${rowKey}_current_year` });
  const prevValue = parseFloat(prev) || 0;
  const currValue = parseFloat(curr) || 0;
  const change = currValue - prevValue;
  const prevId = `${rowKey}_previous_year`;
  const currId = `${rowKey}_current_year`;

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 px-3 py-3 md:grid-cols-[1fr_repeat(2,150px)] md:items-center">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} aria-hidden="true" className="shrink-0 text-slate-400 dark:text-[#7e88a6]" />}
        <label htmlFor={currId} className="font-body text-sm font-medium text-slate-700 dark:text-[#aab2cc]">
          {label}
        </label>
        <HelpHint fieldId={rowKey} source={wealthStatementHelp} />
      </div>
      <div>
        <label htmlFor={prevId} className="mb-1 block font-body text-xs text-slate-400 dark:text-[#7e88a6] md:hidden">
          Previous year
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400 dark:text-[#7e88a6]">
            Rs
          </span>
          <input
            id={prevId}
            type="number"
            inputMode="decimal"
            step="0.01"
            {...register(`${rowKey}_previous_year`, {
              min: { value: 0, message: 'Amount cannot be negative' }
            })}
            className={WEALTH_INPUT_CLASSES}
            placeholder="0"
          />
        </div>
      </div>
      <div>
        <label htmlFor={currId} className="mb-1 block font-body text-xs text-slate-400 dark:text-[#7e88a6] md:hidden">
          Current year
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 font-body text-xs font-semibold text-slate-400 dark:text-[#7e88a6]">
            Rs
          </span>
          <input
            id={currId}
            type="number"
            inputMode="decimal"
            step="0.01"
            {...register(`${rowKey}_current_year`, {
              min: { value: 0, message: 'Amount cannot be negative' }
            })}
            className={WEALTH_INPUT_CLASSES}
            placeholder="0"
          />
        </div>
        <p className="mt-1 text-right font-body text-xs text-slate-400 dark:text-[#7e88a6] tabular-nums">
          {change >= 0 ? '+' : ''}{formatCurrency(change)}
        </p>
      </div>
    </div>
  );
};

const WealthStatementForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData: contextFormData,
    saving
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control
  } = useForm({
    defaultValues: getStepData('wealth')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back)
  useEffect(() => {
    const savedData = contextFormData['wealth'];
    if (savedData && Object.keys(savedData).length > 0) {
      reset(savedData);
    }
  }, [contextFormData, reset]);

  // PERF-02: no bare watch() at render. Totals are isolated in
  // <LiveTotalsProvider>; each WealthRow self-subscribes to its own fields.

  // Auto-calculate wealth totals
  const calculateWealthTotals = (values) => {
    // Assets - Previous Year
    const assetsPrevious = [
      'property_previous_year',
      'investment_previous_year',
      'vehicle_previous_year',
      'jewelry_previous_year',
      'cash_previous_year',
      'pf_previous_year',
      'bank_balance_previous_year',
      'other_assets_previous_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Assets - Current Year
    const assetsCurrent = [
      'property_current_year',
      'investment_current_year',
      'vehicle_current_year',
      'jewelry_current_year',
      'cash_current_year',
      'pf_current_year',
      'bank_balance_current_year',
      'other_assets_current_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Liabilities - Previous Year
    const liabilitiesPrevious = [
      'loan_previous_year',
      'other_liabilities_previous_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Liabilities - Current Year
    const liabilitiesCurrent = [
      'loan_current_year',
      'other_liabilities_current_year'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);

    // Net Worth
    const netWorthPrevious = assetsPrevious - liabilitiesPrevious;
    const netWorthCurrent = assetsCurrent - liabilitiesCurrent;
    const netWorthIncrease = netWorthCurrent - netWorthPrevious;

    return {
      assetsPrevious,
      assetsCurrent,
      liabilitiesPrevious,
      liabilitiesCurrent,
      netWorthPrevious,
      netWorthCurrent,
      netWorthIncrease
    };
  };

  const buildWealthPayload = (data) => {
    const t = calculateWealthTotals(data);
    return {
      ...data,
      total_assets_previous_year: t.assetsPrevious,
      total_assets_current_year: t.assetsCurrent,
      total_liabilities_previous_year: t.liabilitiesPrevious,
      total_liabilities_current_year: t.liabilitiesCurrent,
      // Include computed net worth so WealthReconciliation can read it from formData
      net_worth_previous_year: t.netWorthPrevious,
      net_worth_current_year: t.netWorthCurrent,
    };
  };

  const onSubmit = async (data) => {
    const success = await saveFormStep('wealth', buildWealthPayload(data), true);
    if (success) {
      toast.success('Wealth statement completed successfully');
      navigate('/wealth-statement/wealth-reconciliation');
    }
  };

  const onSaveAndContinue = async () => {
    const success = await saveFormStep('wealth', buildWealthPayload(watch()), false);
    if (success) {
      toast.success('Progress saved');
      navigate('/wealth-statement/wealth-reconciliation');
    }
  };
  const groupHeading = (text) => (
    <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">
      {text}
    </h2>
  );

  const columnHeader = (
    <div className="hidden grid-cols-[1fr_repeat(2,150px)] gap-4 px-3 pb-1 md:grid">
      <span />
      <span className="text-right font-body text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-[#7e88a6]">Previous year</span>
      <span className="text-right font-body text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-[#7e88a6]">Current year</span>
    </div>
  );

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="wealth-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="wealth-help">
      <h3 className="font-display text-sm font-bold text-navy dark:text-[#e7eaf3]">About the wealth statement</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600 dark:text-[#aab2cc]">
        <li>Required for income reconciliation under Pakistani tax law.</li>
        <li>Include the market value of all assets as of 30 June.</li>
        <li>Previous year = 30 June 2024; current year = 30 June 2025.</li>
        <li>Include all bank accounts, investments, property and vehicles.</li>
        <li>Declare all liabilities including loans and mortgages.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <LiveTotalsProvider control={control} compute={calculateWealthTotals}>
      <TaxFormShell
        title="Wealth Statement"
        subtitle="Your assets, liabilities and wealth reconciliation"
        icon={Gem}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/expenses')}
            backLabel="Expenses"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >
        {/* Assets */}
        <div>
          {groupHeading('Assets')}
          {columnHeader}
          <div className="divide-y divide-slate-100 dark:divide-[#2a3450] overflow-hidden rounded-brand-lg border border-slate-200 dark:border-[#2a3450]">
            {[
              { key: 'property', label: 'Immovable property', icon: Home },
              { key: 'investment', label: 'Investments / securities', icon: TrendingUp },
              { key: 'vehicle', label: 'Motor vehicles', icon: Car },
              { key: 'jewelry', label: 'Jewellery / valuables', icon: Gem },
              { key: 'cash', label: 'Cash in hand', icon: DollarSign },
              { key: 'pf', label: 'Provident fund', icon: Briefcase },
              { key: 'bank_balance', label: 'Bank balances', icon: CreditCard },
              { key: 'other_assets', label: 'Other assets', icon: Briefcase }
            ].map(({ key, label, icon }) => (
              <WealthRow key={key} rowKey={key} label={label} icon={icon} register={register} control={control} />
            ))}
            <LiveAmount component={AmountRow} variant="subtotal" field="assetsPrevious" label="Total assets (previous year)" />
            <LiveAmount component={AmountRow} variant="subtotal" field="assetsCurrent" label="Total assets (current year)" />
          </div>
        </div>

        {/* Liabilities */}
        <div>
          {groupHeading('Liabilities')}
          {columnHeader}
          <div className="divide-y divide-slate-100 dark:divide-[#2a3450] overflow-hidden rounded-brand-lg border border-slate-200 dark:border-[#2a3450]">
            {[
              { key: 'loan', label: 'Loans / mortgages', icon: CreditCard },
              { key: 'other_liabilities', label: 'Other liabilities', icon: Briefcase }
            ].map(({ key, label, icon }) => (
              <WealthRow key={key} rowKey={key} label={label} icon={icon} register={register} control={control} />
            ))}
            <LiveAmount component={AmountRow} variant="subtotal" field="liabilitiesPrevious" label="Total liabilities (previous year)" />
            <LiveAmount component={AmountRow} variant="subtotal" field="liabilitiesCurrent" label="Total liabilities (current year)" />
          </div>
        </div>

        {/* Net worth */}
        <div>
          {groupHeading('Net worth')}
          <div className="divide-y divide-slate-100 dark:divide-[#2a3450] overflow-hidden rounded-brand-lg border border-slate-200 dark:border-[#2a3450]">
            <LiveAmount component={AmountRow} variant="line" field="netWorthPrevious" label="Net worth (previous year)" sublabel="As of 30 June 2024" />
            <LiveAmount component={AmountRow} variant="line" field="netWorthCurrent" label="Net worth (current year)" sublabel="As of 30 June 2025" />
            <LiveAmount component={AmountRow} variant="total" field="netWorthIncrease" label="Net wealth increase" sublabel="Change during the tax year" />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-brand border border-navy/20 bg-navy/[0.03] px-4 py-3">
            <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-navy" />
            <div>
              <p className="font-body text-sm font-semibold text-navy dark:text-[#e7eaf3]">Wealth reconciliation</p>
              <p className="font-body text-sm text-slate-600 dark:text-[#aab2cc]">
                The increase in net worth should reconcile with your declared income and expenses.
                Significant unexplained increases may trigger tax-authority scrutiny.
              </p>
            </div>
          </div>
        </div>
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default WealthStatementForm;