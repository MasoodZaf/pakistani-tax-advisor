/* eslint-disable react-hooks/exhaustive-deps -- data load fires on tax-year change; processIncomeData is stable inside this component */
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DollarSign, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import HelpHint from '../../../components/Help/HelpHint';
import incomeFormHelp from '../../../help/incomeFormHelp';
import {
  TaxFormShell,
  FormStateScreen,
  CollapsibleSection,
  TaxFormRow,
  AmountRow,
  CalculatedRow,
  FormNav,
  LiveTotalsProvider,
  LiveAmount,
} from '../../../components/forms';

const IncomeForm = () => {
  const navigate = useNavigate();
  const { currentTaxYear } = useTaxYear();
  const {
    saveFormStep,
    stagedData,
    saving
  } = useTaxForm();

  const [showHelp, setShowHelp] = useState(false);
  const [incomeData, setIncomeData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    paymentsEmployer: true,
    nonCashBenefits: true,
    otherIncomeMinTax: true,
    otherIncomeNoMinTax: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Format number with commas for display
  const formatNumber = (value) => {
    if (!value || value === 0) return '';
    const intValue = Math.max(0, Math.round(parseFloat(value) || 0));
    return new Intl.NumberFormat('en-US').format(intValue);
  };

  // Convert value to integer for storage. Negatives CLAMP to 0 (Math.max, not
  // Math.abs) to match the backend's sanitizeNumber — typing "-100" must mean 0,
  // not silently 100 (TAX-07).
  const parseToInteger = (value) => {
    if (!value) return 0;
    return Math.max(0, Math.round(parseFloat(String(value).replace(/,/g, '')) || 0));
  };

  // Process income data to exclude calculated fields and format for display
  const processIncomeData = (rawData) => {
    if (!rawData) return {};

    const processedData = {};

    // Handle monthly fields - convert annual values back to monthly for form display
    const monthlyFields = [
      { frontend: 'monthly_basic_salary', backend: 'annual_basic_salary' },
      { frontend: 'monthly_allowances', backend: 'allowances' },
    ];

    monthlyFields.forEach(({ frontend, backend }) => {
      if (rawData[backend] !== undefined && rawData[backend] !== null) {
        const annualValue = parseFloat(rawData[backend]) || 0;
        const monthlyValue = Math.abs(Math.round(annualValue / 12));
        processedData[frontend] = monthlyValue > 0 ? formatNumber(monthlyValue) : '';
      } else {
        processedData[frontend] = '';
      }
    });

    // Handle direct annual fields (no conversion needed)
    const annualFields = [
      'bonus',
      'medical_allowance',
      'pension_from_ex_employer',
      'employment_termination_payment',
      'retirement_from_approved_funds',
      'directorship_fee',
      'other_cash_benefits',
      'employer_contribution_provident',
      'taxable_car_value',
      'other_taxable_subsidies',
      'profit_on_debt_15_percent',
      'profit_on_debt_12_5_percent',
      'other_taxable_income_rent',
      'other_taxable_income_others'
    ];

    annualFields.forEach(field => {
      if (rawData[field] !== undefined && rawData[field] !== null) {
        const value = parseFloat(rawData[field]) || 0;
        const numericValue = Math.abs(Math.round(value));
        processedData[field] = numericValue > 0 ? formatNumber(numericValue) : '';
      } else {
        processedData[field] = '';
      }
    });

    return processedData;
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control
  } = useForm({
    defaultValues: processIncomeData(incomeData)
  });

  // PERF-02: no bare `watch()` at render — it would re-render the whole form on
  // every keystroke. The live totals are isolated in <LiveTotalsProvider> below
  // (subscribes via useWatch); inputs use register() and don't re-render.


  // Load income form data from API - use the same endpoint that handles saving.
  // Wait for the real tax year (FE-02/03): firing before TaxYearContext resolves
  // used to read a hardcoded '2025-26', risking a wrong-year read; now we skip
  // until currentTaxYear is set and re-run if it changes.
  useEffect(() => {
    if (!currentTaxYear) return;
    const loadIncomeData = async () => {
      try {
        setDataLoading(true);
        // Use the working income-form API directly
        const response = await axios.get(`/api/income-form/${currentTaxYear}`);

        // Extract income form data from the response
        const incomeFormData = response.data || {};

        // Apply copy-forward values staged from the Tax History archive ON TOP
        // of the saved server data. This form loads from its own endpoint
        // (unlike the others, which read context formData), so without this
        // merge the staged queue never reaches the inputs. Staged values are
        // annual (parser output) — processIncomeData converts to monthly where
        // needed. Saving clears the staging in TaxFormContext.
        const staged = stagedData?.income;
        const mergedData = staged && Object.keys(staged).length > 0
          ? { ...incomeFormData, ...staged }
          : incomeFormData;
        setIncomeData(mergedData);

        // Reset form with the loaded data
        const formattedData = processIncomeData(mergedData);
        reset(formattedData);
      } catch (error) {
        toast.error('Failed to load income form data');
      } finally {
        setDataLoading(false);
      }
    };

    loadIncomeData();
    // stagedData in deps: a refresh restores the staged queue asynchronously
    // (after auth resolves), which can land after the first load — re-merge.
  }, [currentTaxYear, reset, stagedData]);

  // Calculate totals based on Excel formula logic - EXACTLY matching XlCal.md
  const calculateTotals = (sourceValues) => {
    const src = sourceValues || {};
    // Parse all input values - converting monthly to annual where needed
    const monthlyBasicSalary = parseToInteger(src.monthly_basic_salary) || 0;
    const monthlyAllowances = parseToInteger(src.monthly_allowances) || 0;

    // Excel formulas: B6: 600000*12, B7: 500000*12
    const annualBasicSalary = monthlyBasicSalary * 12;
    const allowances = monthlyAllowances * 12;

    const bonus = parseToInteger(src.bonus) || 0;
    const medicalAllowance = parseToInteger(src.medical_allowance) || 0;
    const pensionFromExEmployer = parseToInteger(src.pension_from_ex_employer) || 0;
    const employmentTerminationPayment = parseToInteger(src.employment_termination_payment) || 0;
    const retirementAmount = parseToInteger(src.retirement_from_approved_funds) || 0;
    const directorshipFee = parseToInteger(src.directorship_fee) || 0;
    const otherCashBenefits = parseToInteger(src.other_cash_benefits) || 0;

    // Excel formula B15: -B12-B11-B9 = -(retirement + termination + medical)
    const incomeExemptFromTax = -(retirementAmount + employmentTerminationPayment + medicalAllowance);

    // Excel formula B16: SUM(B6:B15) - Annual Salary and Wages Total
    const annualSalaryWagesTotal = annualBasicSalary + allowances + bonus + medicalAllowance +
                                   pensionFromExEmployer + employmentTerminationPayment + retirementAmount +
                                   directorshipFee + otherCashBenefits + incomeExemptFromTax;

    // Non Cash Benefits
    const employerContributionFunds = parseToInteger(src.employer_contribution_provident) || 0;
    const taxableCarValue = parseToInteger(src.taxable_car_value) || 0;
    const otherTaxableSubsidies = parseToInteger(src.other_taxable_subsidies) || 0;

    // Excel formula B22: -(MIN(B19,150000)) = -150,000 max exemption
    const providentExemption = -Math.min(employerContributionFunds, 150000);

    // Excel formula B23: SUM(B19:B22)
    const totalNonCashBenefits = employerContributionFunds + taxableCarValue + otherTaxableSubsidies + providentExemption;

    // Total Employment Income - new calculated field for database
    const totalEmploymentIncome = annualSalaryWagesTotal + totalNonCashBenefits;

    // Other Income (Subject to minimum tax)
    const profitOnDebt15 = parseToInteger(src.profit_on_debt_15_percent) || 0;
    const profitOnDebt125 = parseToInteger(src.profit_on_debt_12_5_percent) || 0;

    // Excel formula B28: B26+B27
    const totalOtherIncomeMinTax = profitOnDebt15 + profitOnDebt125;

    // Other Income (Not Subject to minimum tax)
    const rentIncome = parseToInteger(src.other_taxable_income_rent) || 0;
    const otherTaxableIncomeOthers = parseToInteger(src.other_taxable_income_others) || 0;

    // Excel formula B33: B31+B32
    const totalOtherIncomeNoMinTax = rentIncome + otherTaxableIncomeOthers;

    return {
      // Excel calculated fields
      annualBasicSalary,
      allowances,
      incomeExemptFromTax,
      annualSalaryWagesTotal,
      providentExemption,
      totalNonCashBenefits,
      totalEmploymentIncome, // New database field
      totalOtherIncomeMinTax,
      totalOtherIncomeNoMinTax
    };
  };

  const onSubmit = async (data) => {
    const liveTotals = calculateTotals(data);
    const structuredData = {
      ...data,
      // Convert monthly to annual values for database storage
      annual_basic_salary: liveTotals.annualBasicSalary,
      allowances: liveTotals.allowances,
      // Calculated fields matching database schema
      income_exempt_from_tax: liveTotals.incomeExemptFromTax,
      annual_salary_wages_total: liveTotals.annualSalaryWagesTotal,
      total_employment_income: liveTotals.totalEmploymentIncome,
      non_cash_benefit_exempt: liveTotals.providentExemption,
      total_non_cash_benefits: liveTotals.totalNonCashBenefits,
      other_income_min_tax_total: liveTotals.totalOtherIncomeMinTax,
      other_income_no_min_tax_total: liveTotals.totalOtherIncomeNoMinTax,
      isComplete: true
    };

    const success = await saveFormStep('income', structuredData, true);
    if (success) {
      toast.success('Income information saved successfully - Excel calculations applied');
      navigate('/income-tax/adjustable-tax');
    }
  };

  const onSaveAndContinue = async () => {
    const data = watch();
    const liveTotals = calculateTotals(data);
    const structuredData = {
      ...data,
      // Convert monthly to annual values for database storage
      annual_basic_salary: liveTotals.annualBasicSalary,
      allowances: liveTotals.allowances,
      // Calculated fields matching database schema
      income_exempt_from_tax: liveTotals.incomeExemptFromTax,
      annual_salary_wages_total: liveTotals.annualSalaryWagesTotal,
      total_employment_income: liveTotals.totalEmploymentIncome,
      non_cash_benefit_exempt: liveTotals.providentExemption,
      total_non_cash_benefits: liveTotals.totalNonCashBenefits,
      other_income_min_tax_total: liveTotals.totalOtherIncomeMinTax,
      other_income_no_min_tax_total: liveTotals.totalOtherIncomeNoMinTax,
      isComplete: false
    };

    const success = await saveFormStep('income', structuredData, false);
    if (success) {
      toast.success('Progress saved with Excel calculations');
      navigate('/income-tax/adjustable-tax');
    }
  };

  // One change handler for every currency input: strip commas and re-group as
  // the user types (replaces the closure that was copy-pasted into all 16 inputs).
  const reformatCommas = (e) => {
    const numericValue = e.target.value.replace(/,/g, '');
    if (!isNaN(numericValue) && numericValue !== '') {
      e.target.value = formatNumber(numericValue);
    }
  };

  // Build the register + change props for a currency input row.
  const reg = (name) => ({
    type: 'text',
    ...register(name, { setValueAs: parseToInteger, onChange: reformatCommas }),
  });

  // Show loading state while data is being fetched
  if (dataLoading) {
    return <FormStateScreen spinning title="Loading…" message="Loading your income details." />;
  }

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="income-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="income-help">
      <h3 className="font-display text-sm font-bold text-navy dark:text-[#e7eaf3]">Filling in this form</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600 dark:text-[#aab2cc]">
        <li>Enter annual amounts in rupees — monthly fields are converted to annual (×12) for you.</li>
        <li>Grey rows are calculated automatically and can&apos;t be edited.</li>
        <li>Amounts format with thousands separators as you type.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <LiveTotalsProvider control={control} compute={calculateTotals}>
      <TaxFormShell
        title="Income"
        subtitle="Income subject to normal taxation — enter your annual amounts"
        icon={DollarSign}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/tax-forms')}
            backLabel="Overview"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save & continue'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >

        <CollapsibleSection title="Payments by employer" open={expandedSections.paymentsEmployer} onToggle={() => toggleSection('paymentsEmployer')}>
          <TaxFormRow name="monthly_basic_salary" label="Monthly basic salary" hint="Monthly — converted to annual" help={<HelpHint fieldId="monthly_basic_salary" source={incomeFormHelp} />} inputProps={reg('monthly_basic_salary')} />
          <TaxFormRow name="monthly_allowances" label="Monthly allowances (excluding bonus & medical)" hint="Monthly — converted to annual" help={<HelpHint fieldId="monthly_allowances" source={incomeFormHelp} />} inputProps={reg('monthly_allowances')} />
          <LiveAmount component={CalculatedRow} field="annualBasicSalary" label="Annual basic salary (monthly × 12)" />
          <LiveAmount component={CalculatedRow} field="allowances" label="Annual allowances (monthly × 12)" />
          <TaxFormRow name="bonus" label="Bonus" help={<HelpHint fieldId="bonus" source={incomeFormHelp} />} inputProps={reg('bonus')} />
          <TaxFormRow name="medical_allowance" label="Medical allowance (where facility not provided by employer)" help={<HelpHint fieldId="medical_allowance" source={incomeFormHelp} />} inputProps={reg('medical_allowance')} />
          <TaxFormRow name="pension_from_ex_employer" label="Pension received from ex-employer" help={<HelpHint fieldId="pension_received" source={incomeFormHelp} />} inputProps={reg('pension_from_ex_employer')} />
          <TaxFormRow name="employment_termination_payment" label="Employment termination payment" sublabel="Section 12(2)(e)(iii)" help={<HelpHint fieldId="employment_termination_payment" source={incomeFormHelp} />} inputProps={reg('employment_termination_payment')} />
          <TaxFormRow name="retirement_from_approved_funds" label="Amount received on retirement from approved funds (provident, pension, gratuity)" help={<HelpHint fieldId="amount_received_on_retirement" source={incomeFormHelp} />} inputProps={reg('retirement_from_approved_funds')} />
          <TaxFormRow name="directorship_fee" label="Directorship fee" sublabel="u/s 149(3)" help={<HelpHint fieldId="directorship_fee" source={incomeFormHelp} />} inputProps={reg('directorship_fee')} />
          <TaxFormRow name="other_cash_benefits" label="Other cash benefits (LFA, children education, etc.)" help={<HelpHint fieldId="other_cash_benefits" source={incomeFormHelp} />} inputProps={reg('other_cash_benefits')} />
          <LiveAmount component={CalculatedRow} field="incomeExemptFromTax" label="Income exempt from tax" help={<HelpHint fieldId="income_exempt_from_tax" source={incomeFormHelp} />} />
          <LiveAmount component={AmountRow} variant="subtotal" field="annualSalaryWagesTotal" label="Annual salary & wages total" />
        </CollapsibleSection>

        <CollapsibleSection title="Non-cash benefits" open={expandedSections.nonCashBenefits} onToggle={() => toggleSection('nonCashBenefits')}>
          <TaxFormRow name="employer_contribution_provident" label="Employer contribution to approved provident funds" help={<HelpHint fieldId="employer_provident_fund_contribution" source={incomeFormHelp} />} inputProps={reg('employer_contribution_provident')} />
          <TaxFormRow name="taxable_car_value" label="Taxable value of car provided by employer" help={<HelpHint fieldId="taxable_value_of_car" source={incomeFormHelp} />} inputProps={reg('taxable_car_value')} />
          <TaxFormRow name="other_taxable_subsidies" label="Other taxable subsidies & non-cash benefits" help={<HelpHint fieldId="other_taxable_subsidies" source={incomeFormHelp} />} inputProps={reg('other_taxable_subsidies')} />
          <LiveAmount component={CalculatedRow} field="providentExemption" label="Non-cash benefit exempt from tax" sublabel="Up to Rs 150,000 of provident contribution is exempt" help={<HelpHint fieldId="non_cash_benefit_exempt" source={incomeFormHelp} />} />
          <LiveAmount component={AmountRow} variant="subtotal" field="totalNonCashBenefits" label="Total non-cash benefits" />
          <LiveAmount component={AmountRow} variant="total" field="totalEmploymentIncome" label="Total employment income" />
        </CollapsibleSection>

        <CollapsibleSection title="Other income (subject to minimum tax)" open={expandedSections.otherIncomeMinTax} onToggle={() => toggleSection('otherIncomeMinTax')}>
          <TaxFormRow name="profit_on_debt_15_percent" label="Profit on debt @ 15% (profit on debt exceeding Rs 5M)" sublabel="u/s 151" help={<HelpHint fieldId="profit_on_debt_151" source={incomeFormHelp} />} inputProps={reg('profit_on_debt_15_percent')} />
          <TaxFormRow name="profit_on_debt_12_5_percent" label="Profit on debt @ 12.5% (sukook exceeding Rs 5M)" sublabel="u/s 151A" help={<HelpHint fieldId="profit_on_debt_151A" source={incomeFormHelp} />} inputProps={reg('profit_on_debt_12_5_percent')} />
          <LiveAmount component={AmountRow} variant="subtotal" field="totalOtherIncomeMinTax" label="Total other income (subject to minimum tax)" />
        </CollapsibleSection>

        <CollapsibleSection title="Other income (not subject to minimum tax)" open={expandedSections.otherIncomeNoMinTax} onToggle={() => toggleSection('otherIncomeNoMinTax')}>
          <TaxFormRow name="other_taxable_income_rent" label="Other taxable income — rent" help={<HelpHint fieldId="rent_income" source={incomeFormHelp} />} inputProps={reg('other_taxable_income_rent')} />
          <TaxFormRow name="other_taxable_income_others" label="Other taxable income — others" help={<HelpHint fieldId="other_taxable_income_others" source={incomeFormHelp} />} inputProps={reg('other_taxable_income_others')} />
          <LiveAmount component={AmountRow} variant="subtotal" field="totalOtherIncomeNoMinTax" label="Other taxable income — total" />
        </CollapsibleSection>
      </TaxFormShell>
      </LiveTotalsProvider>
    </form>
  );
};

export default IncomeForm;