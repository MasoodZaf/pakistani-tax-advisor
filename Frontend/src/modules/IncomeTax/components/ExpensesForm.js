import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useNavigate } from 'react-router-dom';
import { Receipt, Upload, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import expensesHelp from '../../../help/expensesHelp';
import {
  TaxFormShell,
  TaxFormRow,
  AmountRow,
  FormNav,
} from '../../../components/forms';

const ExpensesForm = () => {
  const navigate = useNavigate();
  const { currentTaxYear } = useTaxYear();
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
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('expenses')
  });

  // Sync form when saved data loads from API (handles page refresh / navigation back)
  useEffect(() => {
    const savedData = contextFormData['expenses'];
    if (savedData && Object.keys(savedData).length > 0) {
      reset(savedData);
    }
  }, [contextFormData, reset]);

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Prior year pre-fill (expenses are good candidates for year-over-year carry-forward)
  const { hasPriorData: hasPriorExp, applyPriorYear: applyPriorExp, dismissPriorYear: dismissPriorExp } = usePriorYearData('expenses', setValue);

  // Auto-calculate total expenses
  const calculateTotal = (values) => {
    return [
      'rent',
      'rates_taxes_charges',
      'income_tax',
      'vehicle_running_maintenance',
      'travelling',
      'electricity',
      'water',
      'gas',
      'telephone',
      'medical',
      'educational',
      'donations_zakat_annuity',
      'other_expenses',
      'entertainment',
      'maintenance'
    ].reduce((sum, field) => sum + (parseFloat(values[field]) || 0), 0);
  };

  const totalExpenses = calculateTotal(watchedValues);

  const onSubmit = async (data) => {
    const formData = {
      ...data,
      total_expenses: totalExpenses
    };

    const success = await saveFormStep('expenses', formData, true);
    if (success) {
      toast.success('Expenses information saved successfully');
      navigate('/wealth-statement/wealth-statement');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watchedValues;
    const formData = {
      ...data,
      total_expenses: totalExpenses
    };

    const success = await saveFormStep('expenses', formData, false);
    if (success) {
      toast.success('Progress saved');
      navigate('/wealth-statement/wealth-statement');
    }
  };

  const reg = (name) => ({
    type: 'number',
    step: '0.01',
    ...register(name, {
      min: { value: 0, message: 'Amount cannot be negative' }
    }),
  });

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="expenses-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="expenses-help">
      <h3 className="font-display text-sm font-bold text-navy">Allowable expenses</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600">
        <li>Record all legitimate business and professional expenses.</li>
        <li>Include household expenses for wealth reconciliation.</li>
        <li>Keep receipts and documentation for all expenses.</li>
        <li>Some expenses may be tax-deductible depending on your profession.</li>
        <li>Used for wealth statement reconciliation purposes.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TaxFormShell
        title="Allowable expenses"
        subtitle="Enter your annual living and professional expenses"
        icon={Receipt}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/capital-gains')}
            backLabel="Capital gains"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >
        {hasPriorExp && (
          <div className="flex flex-col gap-2 rounded-brand border border-navy/20 bg-navy/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-body text-sm text-navy">
              <Upload size={16} aria-hidden="true" />
              <span>Prior-year expense data is available. Pre-fill this form? Adjust for any changes in your lifestyle.</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={dismissPriorExp}
                className="rounded-brand border-[1.5px] border-slate-300 px-3 py-1.5 font-body text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50">
                Dismiss
              </button>
              <button type="button" onClick={applyPriorExp}
                className="rounded-brand bg-navy px-3 py-1.5 font-body text-xs font-bold text-white transition-colors hover:bg-navy-dark">
                Apply prior year
              </button>
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">Housing &amp; property</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
            <TaxFormRow name="rent" label="Rent" help={<HelpHint fieldId="rent" source={expensesHelp} />} error={errors.rent?.message} inputProps={reg('rent')} />
            <TaxFormRow name="rates_taxes_charges" label="Property rates / taxes" help={<HelpHint fieldId="rates_taxes_charges" source={expensesHelp} />} error={errors.rates_taxes_charges?.message} inputProps={reg('rates_taxes_charges')} />
            <TaxFormRow name="maintenance" label="Maintenance" help={<HelpHint fieldId="maintenance" source={expensesHelp} />} error={errors.maintenance?.message} inputProps={reg('maintenance')} />
          </div>
        </div>

        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">Utilities</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
            <TaxFormRow name="electricity" label="Electricity" help={<HelpHint fieldId="electricity" source={expensesHelp} />} error={errors.electricity?.message} inputProps={reg('electricity')} />
            <TaxFormRow name="water" label="Water" help={<HelpHint fieldId="water" source={expensesHelp} />} error={errors.water?.message} inputProps={reg('water')} />
            <TaxFormRow name="gas" label="Gas" help={<HelpHint fieldId="gas" source={expensesHelp} />} error={errors.gas?.message} inputProps={reg('gas')} />
            <TaxFormRow name="telephone" label="Telephone / internet" help={<HelpHint fieldId="telephone" source={expensesHelp} />} error={errors.telephone?.message} inputProps={reg('telephone')} />
          </div>
        </div>

        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">Transportation</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
            <TaxFormRow name="vehicle_running_maintenance" label="Vehicle expenses" sublabel="Fuel, maintenance, insurance" help={<HelpHint fieldId="vehicle_running_maintenance" source={expensesHelp} />} error={errors.vehicle_running_maintenance?.message} inputProps={reg('vehicle_running_maintenance')} />
            <TaxFormRow name="travelling" label="Travel expenses" sublabel="Business and personal travel" help={<HelpHint fieldId="travelling" source={expensesHelp} />} error={errors.travelling?.message} inputProps={reg('travelling')} />
          </div>
        </div>

        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">Personal &amp; family</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
            <TaxFormRow name="medical" label="Medical expenses" help={<HelpHint fieldId="medical" source={expensesHelp} />} error={errors.medical?.message} inputProps={reg('medical')} />
            <TaxFormRow name="educational" label="Educational expenses" help={<HelpHint fieldId="educational" source={expensesHelp} />} error={errors.educational?.message} inputProps={reg('educational')} />
            <TaxFormRow name="entertainment" label="Entertainment" help={<HelpHint fieldId="entertainment" source={expensesHelp} />} error={errors.entertainment?.message} inputProps={reg('entertainment')} />
          </div>
        </div>

        <div>
          <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">Tax &amp; other</h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-brand-lg border border-slate-200">
            <TaxFormRow name="income_tax" label="Income tax paid" help={<HelpHint fieldId="income_tax" source={expensesHelp} />} error={errors.income_tax?.message} inputProps={reg('income_tax')} />
            <TaxFormRow name="donations_zakat_annuity" label="Charitable donations" help={<HelpHint fieldId="donations_zakat_annuity" source={expensesHelp} />} error={errors.donations_zakat_annuity?.message} inputProps={reg('donations_zakat_annuity')} />
            <TaxFormRow name="other_expenses" label="Other expenses" help={<HelpHint fieldId="other_expenses" source={expensesHelp} />} error={errors.other_expenses?.message} inputProps={reg('other_expenses')} />
          </div>
        </div>

        <div className="overflow-hidden rounded-brand-lg border border-slate-200">
          <AmountRow variant="calculated" label="Housing &amp; property" amount={(parseFloat(watchedValues.rent) || 0) + (parseFloat(watchedValues.rates_taxes_charges) || 0) + (parseFloat(watchedValues.maintenance) || 0)} />
          <AmountRow variant="calculated" label="Utilities" amount={(parseFloat(watchedValues.electricity) || 0) + (parseFloat(watchedValues.water) || 0) + (parseFloat(watchedValues.gas) || 0) + (parseFloat(watchedValues.telephone) || 0)} />
          <AmountRow variant="calculated" label="Transportation" amount={(parseFloat(watchedValues.vehicle_running_maintenance) || 0) + (parseFloat(watchedValues.travelling) || 0)} />
          <AmountRow variant="calculated" label="Personal &amp; family" amount={(parseFloat(watchedValues.medical) || 0) + (parseFloat(watchedValues.educational) || 0) + (parseFloat(watchedValues.entertainment) || 0)} />
          <AmountRow variant="total" label="Total annual expenses" sublabel="Used for wealth statement reconciliation and tax planning" amount={totalExpenses} />
        </div>
      </TaxFormShell>
    </form>
  );
};

export default ExpensesForm;
