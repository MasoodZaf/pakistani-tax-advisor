import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  Save,
  ArrowRight,
  ArrowLeft,
  Calculator,
  DollarSign,
  Info,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  PiggyBank,
  Award,
  RotateCcw,
  FileCheck,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import finalMinIncomeHelp from '../../../help/finalMinIncomeHelp';
import { formatCurrency } from '../../../utils/currency';
import FormEmptyState from './FormEmptyState';

// Static field definitions — kept at module scope so they aren't rebuilt on
// every render (the component has ~30 inputs; each keystroke was previously
// reallocating this structure). Values here are stable metadata only; rates
// are still DB-sourced at compute time via useTaxRates().
const FIELD_DEFINITIONS = [
  {
    section: 'salaryIncome',
    sectionTitle: 'Salary Income',
    sectionIcon: DollarSign,
    sectionColor: 'blue',
    fields: [
      {
        label: 'Salary u/s 12(7)',
        amountField: 'salary_u_s_12_7',
        taxDeductedField: 'salary_u_s_12_7_tax_deducted',
        taxChargeableField: 'salary_u_s_12_7_tax_chargeable',
        taxRate: null,
        autoPopulateAmount: true,
        slabCalculatedTaxDeducted: true,
        taxChargeableManual: true,
        description: 'Amount auto-linked from Income form. Tax Deducted calculated per FBR 2025-26 slabs (editable). Tax Chargeable = manual entry.'
      }
    ]
  },
  {
    section: 'dividendInterest',
    sectionTitle: 'Dividend Income',
    sectionIcon: TrendingUp,
    sectionColor: 'green',
    fields: [
      {
        label: 'Dividend u/s 150 @0% (REIT SPV)',
        amountField: 'dividend_u_s_150_0pc_share_profit_reit_spv_amount',
        taxDeductedField: 'dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted',
        taxChargeableField: 'dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable',
        taxRate: 0.00,
        description: 'Dividend from REIT/SPV when pass-through to CPPAG'
      },
      {
        label: 'Dividend u/s 150 @35% (Other SPV) - ATL/Non-ATL 35%/70%',
        amountField: 'dividend_u_s_150_35pc_share_profit_other_spv_amount',
        taxDeductedField: 'dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted',
        taxChargeableField: 'dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable',
        taxRate: 0.35,
        description: 'Dividend from other SPV (biomass/baggas based power projects)'
      },
      {
        label: 'Dividend u/s 150 @7.5% (IPP Shares) - ATL/Non-ATL 7.5%/15%',
        amountField: 'dividend_u_s_150_7_5pc_ipp_shares_amount',
        taxDeductedField: 'dividend_u_s_150_7_5pc_ipp_shares_tax_deducted',
        taxChargeableField: 'dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable',
        taxRate: 0.075,
        description: 'Dividend from IPP shares'
      },
      {
        label: 'Dividend u/s 150 @15% (Dividend in kind or Mutual funds with less than 50% profit on debt)',
        amountField: 'dividend_u_s_150_31pc_atl_amount',
        taxDeductedField: 'dividend_u_s_150_31pc_atl_tax_deducted',
        taxChargeableField: 'dividend_u_s_150_31pc_atl_tax_chargeable',
        taxRate: 0.15,
        description: 'Dividend in kind or from mutual funds where profit on debt is less than 50% (ATL 15%, Non-ATL 30%)'
      },
      {
        label: 'Dividend u/s 150 @25% (From Companies not paying tax due to BF losses or Mutual funds with 50% and above profit on debt)',
        amountField: 'dividend_u_s_150_25pc_bf_losses_amount',
        taxDeductedField: 'dividend_u_s_150_25pc_bf_losses_tax_deducted',
        taxChargeableField: 'dividend_u_s_150_25pc_bf_losses_tax_chargeable',
        taxRate: 0.25,
        description: 'Dividend from companies with brought-forward losses or mutual funds with 50%+ profit on debt (ATL 25%, Non-ATL 50%)'
      }
    ]
  },
  {
    section: 'investmentReturns',
    sectionTitle: 'Investment Returns (Sukuks)',
    sectionIcon: PiggyBank,
    sectionColor: 'purple',
    fields: [
      {
        label: 'Return on Investment in Sukuks u/s 151(1A) @ 25% (Above Rs. 5M)',
        amountField: 'return_on_investment_sukuk_u_s_151_1a_25pc_amount',
        taxDeductedField: 'return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted',
        taxChargeableField: 'return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable',
        taxRate: 0.25,
        description: 'Minimum tax on Sukuk investment returns above Rs. 5M'
      },
      {
        label: 'Return on Investment in Sukuks u/s 151(1A) @ 12.5% (From Rs 1M to Rs 5M)',
        amountField: 'return_invest_exceed_1m_sukuk_saa_12_5pc_amount',
        taxDeductedField: 'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted',
        taxChargeableField: 'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable',
        taxRate: 0.125,
        description: 'Final tax on Sukuk investment returns from Rs. 1M to Rs. 5M'
      },
      {
        label: 'Return on Investment in Sukuks u/s 151(1A) @ 10% (Up to Rs 1M)',
        amountField: 'return_invest_not_exceed_1m_sukuk_saa_10pc_amount',
        taxDeductedField: 'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted',
        taxChargeableField: 'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable',
        taxRate: 0.10,
        description: 'Final tax on Sukuk investment returns up to Rs. 1M'
      }
    ]
  },
  {
    section: 'profitDebt',
    sectionTitle: 'Profit on Debt',
    sectionIcon: Calculator,
    sectionColor: 'yellow',
    fields: [
      {
        label: 'Profit on Debt u/c 5(A)/5AA/5AB of Part II, Second Schedule @ 10% (via FCVA/SCRA)',
        amountField: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount',
        taxDeductedField: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted',
        taxChargeableField: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable',
        taxRate: 0.10,
        description: 'Debt instrument via FCVA/SCRA for non-resident or resident Pakistani with foreign bank accounts declared under SBP Scheme'
      },
      {
        label: 'Profit on Debt on National Savings Certificates incl. Defence Savings u/s 39(4A) @ Variable Rate',
        amountField: 'profit_debt_national_savings_defence_39_14a_amount',
        taxDeductedField: 'profit_debt_national_savings_defence_39_14a_tax_deducted',
        taxChargeableField: 'profit_debt_national_savings_defence_39_14a_tax_chargeable',
        taxRate: null,
        description: 'Chargeable to tax at rate prevailing in the relevant year. Enter Tax Chargeable manually (Amount × relevant year rate)'
      },
      {
        label: 'Interest Income — Profit on Debt u/s 7B (Bank/FI deposits, up to Rs. 5M) @ 20%',
        amountField: 'interest_income_profit_debt_7b_up_to_5m_amount',
        taxDeductedField: 'interest_income_profit_debt_7b_up_to_5m_tax_deducted',
        taxChargeableField: 'interest_income_profit_debt_7b_up_to_5m_tax_chargeable',
        taxRate: 0.20,
        description: 'Finance Act 2025: Rate increased from 15% to 20% for bank/financial institution accounts. Final tax if profit does not exceed Rs. 5M.'
      }
    ]
  },
  {
    section: 'prizeWinnings',
    sectionTitle: 'Prize/Winnings',
    sectionIcon: Award,
    sectionColor: 'indigo',
    fields: [
      {
        label: 'Prize on Raffle/Lottery/Quiz/Promotional u/s 156 @ 20%',
        amountField: 'prize_raffle_lottery_quiz_promotional_156_amount',
        taxDeductedField: 'prize_raffle_lottery_quiz_promotional_156_tax_deducted',
        taxChargeableField: 'prize_raffle_lottery_quiz_promotional_156_tax_chargeable',
        taxRate: 0.20,
        description: 'Prize on Raffle/Lottery/Quiz/Sale promotion - Final Tax'
      },
      {
        label: 'Prize on Prize Bond/Crossword Puzzle u/s 156 @ 15%',
        amountField: 'prize_bond_cross_world_puzzle_156_amount',
        taxDeductedField: 'prize_bond_cross_world_puzzle_156_tax_deducted',
        taxChargeableField: 'prize_bond_cross_world_puzzle_156_tax_chargeable',
        taxRate: 0.15,
        description: 'Prize on Prize Bond/crossword puzzle - Final Tax'
      }
    ]
  },
  {
    section: 'employmentRelated',
    sectionTitle: 'Employment-Related Income',
    sectionIcon: Award,
    sectionColor: 'red',
    fields: [
      {
        label: 'Bonus shares issued by companies u/s 236Z @ 10%',
        amountField: 'bonus_shares_companies_236f_amount',
        taxDeductedField: 'bonus_shares_companies_236f_tax_deducted',
        taxChargeableField: 'bonus_shares_companies_236f_tax_chargeable',
        taxRate: 0.10,
        description: 'Value = day-end price on first day of closure of books (listed), or prescribed value (other companies)'
      },
      {
        label: 'Salary Arrears u/s 12(7) — Chargeable to Tax at Relevant Rate',
        amountField: 'salary_arrears_12_7_relevant_rate_amount',
        taxDeductedField: 'salary_arrears_12_7_relevant_rate_tax_deducted',
        taxChargeableField: 'salary_arrears_12_7_relevant_rate_tax_chargeable',
        taxRate: null,
        description: 'Enter average rate of tax applicable. Tax Chargeable = Amount × Average Rate'
      }
    ]
  }
];

const FinalMinIncomeForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData,
    saving,
    incomeProfile,
  } = useTaxForm();
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    salaryIncome: true, // Expand first section by default
  });
  const [refreshKey, setRefreshKey] = useState(0); // Used to force re-render after data refresh

  const {
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset
  } = useForm({
    defaultValues: getStepData('final_min_income')
  });

  // Guard used by auto-populate effects so they don't fire during a reset()
  // triggered by post-save context sync. Without this, a save would:
  //   1) update context.formData
  //   2) trigger the sync effect → reset()
  //   3) trigger the salary/CG auto-populate effects → setValue() overwriting
  //      the user's just-saved values back to the computed defaults.
  const isLoadingFromDB = useRef(false);

  // Map form amount-field → DB rate_category (final_tax). Rates resolved via
  // useTaxRates(). Fields not listed here fall back to field.taxRate (kept as a
  // display-only default and a safety net until every category is seeded).
  const AMOUNT_FIELD_TO_FINAL_TAX_CATEGORY = {
    dividend_u_s_150_0pc_share_profit_reit_spv_amount:      'dividend_reit_spv_0pc',
    dividend_u_s_150_35pc_share_profit_other_spv_amount:    'dividend_other_spv_35pc',
    dividend_u_s_150_7_5pc_ipp_shares_amount:               'dividend_ipp_7_5pc',
    dividend_u_s_150_31pc_atl_amount:                       'dividend_regular_15pc',
    dividend_u_s_150_25pc_bf_losses_amount:                 'dividend_regular_25pc',
    return_on_investment_sukuk_u_s_151_1a_25pc_amount:      'sukook_individual_above_5m',
    return_invest_exceed_1m_sukuk_saa_12_5pc_amount:        'sukook_individual_1m_to_5m',
    return_invest_not_exceed_1m_sukuk_saa_10pc_amount:      'sukook_individual_up_to_1m',
    interest_income_profit_debt_7b_up_to_5m_amount:         'profit_debt_151_up_to_5m',
    prize_raffle_lottery_quiz_promotional_156_amount:       'prize_lottery',
    prize_bond_cross_world_puzzle_156_amount:               'prize_bond',
    bonus_shares_companies_236f_amount:                     'bonus_shares',
  };
  const resolveFinalTaxRate = (field) => {
    const cat = AMOUNT_FIELD_TO_FINAL_TAX_CATEGORY[field.amountField];
    const dbRate = cat ? rates?.finalTax?.[cat]?.rate : undefined;
    return dbRate !== undefined ? dbRate : field.taxRate;
  };
  // Track the salary we last auto-computed from. Re-sync only when it changes —
  // respects user edits to salary_u_s_12_7_tax_deducted between saves.
  const lastSyncedSalaryRef = useRef(null);
  const lastSyncedCGRef = useRef(null);

  // SINGLE load path: mirror context formData into the form. The standalone axios
  // fetch that used to live here was removed — TaxFormContext already loads via
  // GET /current-return and populates formData['final_min_income'].
  useEffect(() => {
    const contextData = formData['final_min_income'];
    if (!contextData || Object.keys(contextData).length === 0) return;

    isLoadingFromDB.current = true;
    reset(contextData);
    // Delay clearing the flag so auto-populate effects queued in the same tick
    // observe it as true and skip.
    setTimeout(() => {
      isLoadingFromDB.current = false;
      setRefreshKey((k) => k + 1);
    }, 50);
  }, [formData['final_min_income'], reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-populate Capital Gain row — only when the capital-gain numbers actually
  // change, not on every formData tick. Skipped during DB reset.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const capitalGainData = formData['capital_gain'] || {};
    if (Object.keys(capitalGainData).length === 0) return;

    const amount = parseFloat(capitalGainData.total_capital_gain) || 0;
    const taxDeducted = parseFloat(capitalGainData.total_tax_deducted) || 0;
    const taxChargeable =
      parseFloat(capitalGainData.total_capital_gain_tax_chargeable ||
                 capitalGainData.capital_gains_tax_chargeable) || 0;

    const signature = `${amount}|${taxDeducted}|${taxChargeable}`;
    if (lastSyncedCGRef.current === signature) return;
    lastSyncedCGRef.current = signature;

    // DB column is `capital_gain` (not `capital_gain_amount`). The legacy
    // key was being dropped server-side by the allow-list filter, producing
    // a noisy "Dropped unknown keys" warning on every save.
    setValue('capital_gain', amount);
    setValue('capital_gain_tax_deducted', taxDeducted);
    setValue('capital_gain_tax_chargeable', taxChargeable);
  }, [formData['capital_gain'], setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Salary-tax calculator — DB-sourced slabs + surcharge via useTaxRates.
  // Uses the same cumulative-marginal algorithm as the backend
  // CalculationService.calculateProgressiveTax so numbers match the engine.
  //
  // Returns { tax, baseTax, surcharge, slabLabel, rate } — when rates aren't
  // loaded yet, returns zeroes + a 'rates loading' label rather than computing
  // with stale constants.
  const calculateFBRSalaryTax = (annualIncome) => {
    const income = parseFloat(annualIncome) || 0;
    if (income <= 0 || !rates?.slabs) {
      return { tax: 0, baseTax: 0, surcharge: 0, slabLabel: rates ? '≤ Rs 600,000 @ 0%' : 'rates loading', rate: '' };
    }

    let baseTax = 0;
    let activeSlab = null;
    for (const slab of rates.slabs) {
      const minI = Number(slab.min_income);
      const maxI = slab.max_income === null || slab.max_income === undefined
        ? Number.POSITIVE_INFINITY
        : Number(slab.max_income);
      const rate = Number(slab.tax_rate);
      const effectiveLower = minI > 0 ? minI - 1 : 0;
      if (income <= effectiveLower) continue;
      const ceiling = Math.min(income, maxI);
      const taxableAtThisSlab = ceiling - effectiveLower;
      if (taxableAtThisSlab > 0 && rate > 0) baseTax += taxableAtThisSlab * rate;
      if (income <= maxI) { activeSlab = { effectiveLower, maxI, rate }; break; }
      activeSlab = { effectiveLower, maxI, rate };
    }
    baseTax = Math.round(baseTax);

    const surchargeRate = rates?.surcharge?.rate ?? 0;
    const surchargeThreshold = rates?.surcharge?.threshold ?? Infinity;
    const surcharge = income > surchargeThreshold ? Math.round(baseTax * surchargeRate) : 0;

    const slabLabel = activeSlab
      ? (activeSlab.maxI === Number.POSITIVE_INFINITY
          ? `> Rs ${Math.round(activeSlab.effectiveLower / 100000) / 10}M @ ${(activeSlab.rate * 100).toFixed(0)}%`
          : `Rs ${Math.round(activeSlab.effectiveLower / 1000)}k–${Math.round(activeSlab.maxI / 100000) / 10}M @ ${(activeSlab.rate * 100).toFixed(0)}%`)
      : '≤ Rs 600,000 @ 0%';

    return { tax: baseTax + surcharge, baseTax, surcharge, slabLabel, rate: slabLabel };
  };

  // Auto-populate Salary row from the Income form. Fires when either the linked
  // salary changes OR rates arrive (so the initial pre-fill uses DB-backed slabs
  // instead of the `rates === null` fallback). Ref-keyed on salary+rates so a
  // post-save formData tick doesn't re-overwrite the user's edits.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    if (!rates?.slabs) return; // wait for rates

    const incomeData = formData['income'] || getStepData('income') || {};
    const salaryAmount =
      parseFloat(incomeData.annual_salary_wages_total) ||
      parseFloat(incomeData.total_employment_income) ||
      0;

    if (salaryAmount <= 0) return;
    const sig = `${salaryAmount}|${rates.slabs.length}|${rates.surcharge?.rate ?? 0}`;
    if (lastSyncedSalaryRef.current === sig) return;
    lastSyncedSalaryRef.current = sig;

    setValue('salary_u_s_12_7', salaryAmount);
    const { tax } = calculateFBRSalaryTax(salaryAmount);
    setValue('salary_u_s_12_7_tax_deducted', tax);
    setTimeout(() => setRefreshKey((k) => k + 1), 0);
  }, [formData['income'], rates, setValue, getStepData]); // eslint-disable-line react-hooks/exhaustive-deps

  // fieldDefinitions lives at module scope (see FIELD_DEFINITIONS) — no longer
  // reallocated per render. Alias kept so existing references compile.
  const fieldDefinitions = FIELD_DEFINITIONS;

  // Field-level visibility — driven by the user's income-profile addons via
  // shared/formFieldVisibility.js. Pure salaried sees 0 of the 60 buckets
  // (form essentially empty); each addon (bank_profit / dividends / sukuk /
  // prizes / securities) unlocks the relevant ones. Match on
  // `taxDeductedField` because that's the canonical DB column name
  // (`amountField` carries an `_amount` suffix the schema doesn't have).
  const addons = useMemo(() => incomeProfile?.addons || [], [incomeProfile]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visibleFields = useMemo(
    () => visibleFieldsFor('final_min_income_forms', addons, { advanced: showAdvanced }),
    [addons, showAdvanced]
  );

  // Apply the visibility filter once per render and reuse below. Empty
  // sections (zero visible fields) are dropped entirely so the user
  // doesn't see "Dividend Income" headers with nothing underneath.
  const visibleSections = useMemo(() => {
    return fieldDefinitions
      .map((sectionDef) => ({
        ...sectionDef,
        fields: sectionDef.fields.filter((f) => visibleFields.has(f.taxDeductedField)),
      }))
      .filter((s) => s.fields.length > 0);
  }, [fieldDefinitions, visibleFields]);

  // Form-accurate count: how many extra ROW items the advanced toggle
  // would reveal here (not raw column count from the manifest).
  const advancedExtraCount = useMemo(() => {
    const withAdv = visibleFieldsFor('final_min_income_forms', addons, { advanced: true });
    const advRows = fieldDefinitions.reduce(
      (sum, sec) => sum + sec.fields.filter((f) => withAdv.has(f.taxDeductedField)).length, 0);
    const baseRows = visibleSections.reduce((sum, sec) => sum + sec.fields.length, 0);
    return advRows - baseRows;
  }, [addons, fieldDefinitions, visibleSections]);

  // Auto-calculate tax chargeable AND tax deducted when amount changes
  // (fixed-rate fields only). Rate resolved via resolveFinalTaxRate which
  // prefers DB values (rate_type='final_tax') and falls back to field.taxRate.
  useEffect(() => {
    fieldDefinitions.forEach(section => {
      section.fields.forEach(field => {
        // Skip salary row — handled by the slab-based effect elsewhere.
        if (field.autoPopulateAmount || field.slabCalculatedTaxDeducted) return;
        // Variable-rate rows — user enters tax manually.
        if (field.taxRate === null) return;

        const amount = parseFloat(watchedValues[field.amountField]) || 0;
        const baseRate = resolveFinalTaxRate(field);
        if (baseRate === undefined || baseRate === null) return;

        // ATL-aware preview: non-filers pay the higher final-tax rate. For every
        // line in the FBR Tax Card 2025-26 the non-filer rate is exactly 2× the
        // filer rate, so ×2 here mirrors the backend's verified pairs
        // (config/finalMinTaxRates.js), which recompute chargeable
        // authoritatively on save. Driven by the "Active Taxpayer?" toggle.
        const isATL = watchedValues.is_atl !== false;
        const taxRate = isATL ? baseRate : baseRate * 2;

        const calculatedTax = (taxRate > 0 && amount > 0) ? Math.round(amount * taxRate) : 0;

        if (Math.abs((parseFloat(watchedValues[field.taxChargeableField]) || 0) - calculatedTax) > 0.01) {
          setValue(field.taxChargeableField, calculatedTax);
        }
        if (Math.abs((parseFloat(watchedValues[field.taxDeductedField]) || 0) - calculatedTax) > 0.01) {
          setValue(field.taxDeductedField, calculatedTax);
        }
      });
    });
  }, [watchedValues, rates, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;

    fieldDefinitions.forEach(section => {
      section.fields.forEach(field => {
        const taxChargeable = parseFloat(watchedValues[field.taxChargeableField]) || 0;
        subtotal += taxChargeable;
      });
    });

    // Capital Gain from separate form
    const capitalGainTaxChargeable = parseFloat(watchedValues.capital_gain_tax_chargeable) || 0;
    const grandTotal = subtotal + capitalGainTaxChargeable;

    return { subtotal, capitalGainTaxChargeable, grandTotal };
  };

  const { subtotal, grandTotal } = calculateTotals();

  // Helper to sync uncontrolled input values to React Hook Form before saving
  const syncInputsToForm = async () => {
    // Force blur on active input to sync its value
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
    // Wait for blur handler to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  const onSubmit = async (data) => {
    await syncInputsToForm();
    const finalData = getValues();

    // Structure the data for backend, include computed totals
    const structuredData = {
      ...finalData,
      grand_total_tax_chargeable: grandTotal,
      isComplete: true
    };

    const success = await saveFormStep('final_min_income', structuredData, true);
    if (success) {
      toast.success('Final/Minimum tax income saved successfully');
      navigate('/income-tax/adjustable-tax');
    }
  };

  const onSaveAndContinue = async () => {
    await syncInputsToForm();
    const data = getValues();

    const structuredData = {
      ...data,
      grand_total_tax_chargeable: grandTotal,
      isComplete: false
    };

    const success = await saveFormStep('final_min_income', structuredData, false);
    if (success) {
      toast.success('Data saved successfully');

      // Reload the data from backend to get updated calculations
      const freshData = await getStepData('final_min_income');
      if (freshData) {
        // Update all form fields with the fresh data
        Object.keys(freshData).forEach(key => {
          if (freshData[key] !== undefined && freshData[key] !== null) {
            setValue(key, freshData[key]);
          }
        });

        // Force re-render to update input defaultValues
        setRefreshKey(prev => prev + 1);

        toast.success('Form refreshed with latest calculations');
      }
    }
  };

  const formatNumber = (num) => {
    if (!num || isNaN(num)) return '';
    return new Intl.NumberFormat('en-PK').format(num);
  };
  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const getColorClasses = (color) => {
    const colorMap = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-600' },
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-600' },
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-600' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: 'text-indigo-600' },
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600' }
    };
    return colorMap[color] || colorMap.blue;
  };

  // Input handlers
  const handleNumberFocus = (fieldName, event) => {
    // Remove formatting and select all
    const currentValue = watchedValues[fieldName] || 0;
    event.target.value = currentValue.toString();
    event.target.select();
  };

  const handleNumberInput = (fieldName, event) => {
    const rawValue = event.target.value;
    const sanitized = rawValue.replace(/[^\d.-]/g, '');
    const numericValue = parseFloat(sanitized) || 0;
    setValue(fieldName, numericValue);
  };

  const handleNumberBlur = (fieldName, event) => {
    const rawValue = event.target.value.replace(/,/g, '');
    const numericValue = parseFloat(rawValue) || 0;

    // Update React Hook Form state
    setValue(fieldName, numericValue);

    // Format for display
    event.target.value = formatNumber(numericValue);
  };

  const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";
  const readOnlyInputClasses = "w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-right text-sm font-semibold text-gray-700";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Income Subject to Final/Minimum Tax</h1>
              <p className="text-gray-600">Enter income with fixed tax rates (3-column structure: Amount, Tax Deducted, Tax Chargeable)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">How to Use This Form</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Amount/Receipt:</strong> Enter the gross amount received (green cells - user input)</li>
              <li>• <strong>Tax Deducted:</strong> Enter the tax already deducted at source (green cells - user input)</li>
              <li>• <strong>Tax Chargeable:</strong> Auto-calculated based on FBR rates (white cells - read-only)</li>
              <li>• Tax rates vary by income type: 0%, 7.5%, 10%, 12.5%, 15%, 20%, 25%, 35%</li>
              <li>• Some rates differ for ATL (Active Tax List) vs Non-ATL taxpayers</li>
              <li>• Variable rates (Salary, Termination, Arrears) use tax_deducted as tax_chargeable</li>
            </ul>
          </div>
        )}
      </div>

      {/* Active Taxpayer (filer) status — drives the final-tax rates below.
          Non-filers pay the higher (≈ double) rate per the FBR Tax Card 2025-26. */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-xl">
            <h3 className="font-semibold text-amber-900">Are you an Active Taxpayer (on the FBR ATL)?</h3>
            <p className="text-sm text-amber-800 mt-1">
              Final-tax rates are higher for non-filers — often double. Your answer sets
              the rate applied to the dividend, sukuk, prize and other income below.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {[{ label: 'Yes — Filer', val: true }, { label: 'No — Non-filer', val: false }].map((opt) => {
              const active = (watchedValues.is_atl !== false) === opt.val;
              return (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setValue('is_atl', opt.val, { shouldDirty: true })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <form onSubmit={async (e) => {
        e.preventDefault();
        await syncInputsToForm();
        handleSubmit(onSubmit)(e);
      }} className="space-y-6">

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-2 items-center py-3 mb-4 bg-gray-800 text-white rounded-lg px-4">
          <div className="col-span-6">
            <span className="font-semibold" style={{ fontSize: 'clamp(0.65rem, 1.4vw, 1rem)' }}>Description</span>
          </div>
          <div className="col-span-2 text-center">
            <span className="font-semibold leading-tight block" style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.9rem)' }}>Amount/<wbr/>Receipt</span>
          </div>
          <div className="col-span-2 text-center">
            <span className="font-semibold leading-tight block" style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.9rem)' }}>Tax<br/>Deducted</span>
          </div>
          <div className="col-span-2 text-center">
            <span className="font-semibold leading-tight block" style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.9rem)' }}>Tax<br/>Chargeable</span>
          </div>
        </div>

        {/* Dynamic Sections — filtered by the income-profile addons via
            shared/formFieldVisibility.js. A pure salaried user with no
            addons sees zero sections; selecting bank_profit / dividends /
            sukuk / prizes unlocks the relevant rows. */}
        {visibleSections.length === 0 && (
          <FormEmptyState
            title="No final-tax income to declare based on your income profile yet."
            addons={['Bank / Savings Profit', 'Dividends from Shares', 'Sukuk / Bond Income', 'Prize Bonds / Winnings']}
            note="Final-tax income (s.150 / s.151 / s.156) only shows up if you have one of these streams. We hide the buckets otherwise so you don't have to scan past 30 rows of zeros."
          />
        )}
        {visibleSections.map((sectionDef, sectionIdx) => {
          const colors = getColorClasses(sectionDef.sectionColor);
          const IconComponent = sectionDef.sectionIcon;
          const isExpanded = expandedSections[sectionDef.section];

          return (
            <div key={sectionDef.section} className={`${colors.bg} ${colors.border} border rounded-lg`}>
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleSection(sectionDef.section)}
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${colors.text} flex items-center`}>
                    <IconComponent className={`w-5 h-5 mr-2 ${colors.icon}`} />
                    {sectionDef.sectionTitle}
                  </h3>
                  {isExpanded ?
                    <ChevronDown className={`w-4 h-4 ${colors.icon}`} /> :
                    <ChevronRight className={`w-4 h-4 ${colors.icon}`} />
                  }
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="space-y-3">
                    {sectionDef.fields.map((field, fieldIdx) => (
                      <div key={field.amountField} className="grid grid-cols-12 gap-2 items-start py-2 border-b border-gray-100 last:border-0">
                        {/* Description */}
                        <div className="col-span-6">
                          <label className="text-sm font-medium text-gray-700">
                            {field.label}
                            <HelpHint fieldId={field.amountField} source={finalMinIncomeHelp} />
                          </label>
                          {field.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                          )}
                          {field.slabCalculatedTaxDeducted && (() => {
                            const salary = parseFloat(watchedValues[field.amountField]) || 0;
                            if (salary <= 0) return null;
                            const { tax, baseTax, surcharge, slabLabel, fixedPortion, varRate, threshold } = calculateFBRSalaryTax(salary);
                            const effectiveRate = ((tax / salary) * 100).toFixed(1);
                            return (
                              <div className="mt-1 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 space-y-0.5">
                                <p className="font-medium text-blue-700">FBR Finance Act 2025 Slab: {slabLabel}</p>
                                {fixedPortion !== undefined && (
                                  <p className="text-blue-600">
                                    Rs {fixedPortion.toLocaleString()} + {(varRate * 100)}% × (Rs {salary.toLocaleString()} − Rs {threshold.toLocaleString()})
                                  </p>
                                )}
                                {surcharge > 0 && (
                                  <p className="text-orange-600 font-medium">
                                    Base Tax: Rs {baseTax.toLocaleString()} + 9% Surcharge (income &gt; Rs 10M): Rs {surcharge.toLocaleString()}
                                  </p>
                                )}
                                <p className="text-blue-800 font-semibold">
                                  Total Tax = Rs {tax.toLocaleString()} &nbsp;|&nbsp; Effective Rate: {effectiveRate}%
                                </p>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Amount/Receipt */}
                        <div className="col-span-2">
                          {field.autoPopulateAmount ? (
                            <input
                              key={`${field.amountField}-${refreshKey}`}
                              type="text"
                              className={readOnlyInputClasses}
                              value={formatNumber(watchedValues[field.amountField] || 0)}
                              readOnly
                              placeholder="0"
                              title="Auto-populated from Income form"
                            />
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`${inputClasses} bg-green-50`}
                              placeholder="0"
                              value={formatNumber(watchedValues[field.amountField] || 0)}
                              onFocus={(e) => handleNumberFocus(field.amountField, e)}
                              onChange={(e) => handleNumberInput(field.amountField, e)}
                              onBlur={(e) => handleNumberBlur(field.amountField, e)}
                            />
                          )}
                        </div>

                        {/* Tax Deducted */}
                        <div className="col-span-2">
                          {field.slabCalculatedTaxDeducted ? (
                            <div>
                              <div className="relative">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className={`${inputClasses} bg-green-50 pr-8`}
                                  placeholder="0"
                                  value={formatNumber(watchedValues[field.taxDeductedField] || 0)}
                                  onFocus={(e) => handleNumberFocus(field.taxDeductedField, e)}
                                  onChange={(e) => handleNumberInput(field.taxDeductedField, e)}
                                  onBlur={(e) => handleNumberBlur(field.taxDeductedField, e)}
                                  title="FBR slab-calculated (editable for actual employer deduction)"
                                />
                                <button
                                  type="button"
                                  title="Reset to FBR slab calculation"
                                  onClick={() => {
                                    const salary = parseFloat(watchedValues[field.amountField]) || 0;
                                    const { tax } = calculateFBRSalaryTax(salary);
                                    setValue(field.taxDeductedField, tax);
                                    setRefreshKey(k => k + 1);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-700"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                              {/* Use actual WHT from employer salary certificate (AdjustableTaxForm) */}
                              {(() => {
                                const certWHT = parseFloat(formData['adjustable_tax']?.salary_employees_149_tax_collected) || 0;
                                if (certWHT <= 0) return null;
                                return (
                                  <button
                                    type="button"
                                    title={`Use WHT from employer certificate: ${formatCurrency(certWHT)}`}
                                    onClick={() => {
                                      setValue(field.taxDeductedField, certWHT);
                                      setRefreshKey(k => k + 1);
                                    }}
                                    className="mt-1 flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5 hover:bg-emerald-100 w-full"
                                  >
                                    <FileCheck className="w-3 h-3 flex-shrink-0" />
                                    <span>Use cert. WHT: {formatCurrency(certWHT)}</span>
                                  </button>
                                );
                              })()}
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`${inputClasses} bg-green-50`}
                              placeholder="0"
                              value={formatNumber(watchedValues[field.taxDeductedField] || 0)}
                              onFocus={(e) => handleNumberFocus(field.taxDeductedField, e)}
                              onChange={(e) => handleNumberInput(field.taxDeductedField, e)}
                              onBlur={(e) => handleNumberBlur(field.taxDeductedField, e)}
                            />
                          )}
                        </div>

                        {/* Tax Chargeable — manual for salary, auto-calculated for fixed-rate rows */}
                        <div className="col-span-2">
                          {field.taxChargeableManual ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`${inputClasses} bg-yellow-50 border-yellow-300`}
                              placeholder="Enter tax"
                              value={formatNumber(watchedValues[field.taxChargeableField] || 0)}
                              onFocus={(e) => handleNumberFocus(field.taxChargeableField, e)}
                              onChange={(e) => handleNumberInput(field.taxChargeableField, e)}
                              onBlur={(e) => handleNumberBlur(field.taxChargeableField, e)}
                              title="Manual entry — enter the actual tax chargeable for over/under deduction check"
                            />
                          ) : (
                            <input
                              key={`${field.taxChargeableField}-${refreshKey}`}
                              type="text"
                              className={readOnlyInputClasses}
                              value={formatNumber(watchedValues[field.taxChargeableField] || 0)}
                              readOnly
                              placeholder="0"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Advanced-fields toggle: surfaces seldom-needed final-tax buckets
            (declared in ADVANCED on the manifest). Hidden when there's
            nothing extra to reveal. */}
        {advancedExtraCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
          >
            {showAdvanced ? (
              <>
                <ChevronDown className="w-4 h-4" />
                Hide advanced final-tax fields
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Show {advancedExtraCount} more advanced final-tax item{advancedExtraCount === 1 ? '' : 's'}
              </>
            )}
          </button>
        )}

        {/* Capital Gain Row — auto-populated from Capital Gain form. Only
            shown if the user has the securities addon (which is also what
            populates capital_gain on the upstream form). */}
        {visibleFields.has('capital_gain_tax_deducted') && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-6">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Award className="w-4 h-4 inline mr-2 text-orange-600" />
                Capital Gain (from Capital Gain Form)
              </label>
              <p className="text-xs text-orange-600 mt-1">Auto-populated from Capital Gain form — fill that form first</p>
            </div>
            <div className="col-span-2">
              <input
                key={`capital_gain-${refreshKey}`}
                type="text"
                className={readOnlyInputClasses}
                value={formatNumber(watchedValues.capital_gain)}
                readOnly
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <input
                key={`capital_gain_tax_deducted-${refreshKey}`}
                type="text"
                className={readOnlyInputClasses}
                value={formatNumber(watchedValues.capital_gain_tax_deducted)}
                readOnly
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <input
                key={`capital_gain_tax_chargeable-${refreshKey}`}
                type="text"
                className={readOnlyInputClasses}
                value={formatNumber(watchedValues.capital_gain_tax_chargeable)}
                readOnly
                placeholder="0"
              />
            </div>
          </div>
        </div>
        )}

        {/* Totals Section */}
        <div className="bg-gray-800 text-white rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold opacity-80" style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1rem)' }}>
                Subtotal Tax Chargeable
              </h3>
              <p className="text-xs opacity-50">Excluding capital gain</p>
            </div>
            <p
              className="font-bold shrink-0"
              style={{ fontSize: 'clamp(0.9rem, 2vw, 1.5rem)' }}
            >
              {formatCurrency(subtotal)}
            </p>
          </div>

          <div className="border-t border-gray-600 pt-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-bold" style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.1rem)' }}>
                Grand Total Tax Chargeable
              </h3>
              <p className="text-xs opacity-50">Subtotal + Capital Gain Tax Chargeable</p>
            </div>
            <p
              className="font-bold text-yellow-400 shrink-0"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 1.8rem)' }}
            >
              {formatCurrency(grandTotal)}
            </p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/income-tax/income')}
            className="flex items-center px-6 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous: Income
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving}
              className="flex items-center px-6 py-3 text-primary-600 bg-primary-100 rounded-lg hover:bg-primary-200 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Data'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-6 py-3 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Complete & Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default FinalMinIncomeForm;
