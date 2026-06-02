import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  Calculator,
  DollarSign,
  Info,
  ChevronDown,
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
import {
  TaxFormShell,
  CollapsibleSection,
  FormNav,
} from '../../../components/forms';

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

  const inputClasses = "w-full rounded-brand border-[1.5px] border-slate-300 bg-white px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors placeholder:font-normal placeholder:text-slate-300 focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15";
  const readOnlyInputClasses = "w-full rounded-brand border-[1.5px] border-slate-200 bg-slate-100 px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-slate-500";

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="finalmin-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="finalmin-help">
      <h3 className="font-display text-sm font-bold text-navy">How this form works</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600">
        <li><strong className="text-navy">Amount</strong> — the gross income received.</li>
        <li><strong className="text-navy">Tax deducted</strong> — the tax withheld at source.</li>
        <li><strong className="text-navy">Tax chargeable</strong> — auto-calculated from the FBR rate (editable only where the rate is variable, e.g. salary/arrears).</li>
        <li>Final-tax rates depend on your filer status (set above) — non-filers pay more.</li>
      </ul>
    </div>
  ) : null;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await syncInputsToForm();
        handleSubmit(onSubmit)(e);
      }}
    >
      <TaxFormShell
        title="Final / minimum tax income"
        subtitle="Income taxed at fixed or final rates"
        icon={DollarSign}
        taxYear={currentTaxYear}
        headerActions={headerActions}
        help={helpPanel}
        footer={
          <FormNav
            onBack={() => navigate('/income-tax/income')}
            backLabel="Income"
            onSave={onSaveAndContinue}
            saveLabel={saving ? 'Saving…' : 'Save data'}
            saving={saving}
            nextType="submit"
            submitting={saving}
            nextLabel="Complete & next"
          />
        }
      >
        {/* Active Taxpayer (filer) status — drives the final-tax rates below.
            Non-filers pay the higher (≈ double) rate per the FBR Tax Card 2025-26. */}
        <div className="rounded-brand-lg border border-navy/20 bg-navy/[0.04] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h3 className="font-display text-sm font-bold text-navy">Are you an Active Taxpayer (on the FBR ATL)?</h3>
              <p className="mt-1 font-body text-sm text-slate-600">
                Final-tax rates are higher for non-filers — often double. Your answer sets the
                rate applied to the dividend, sukuk, prize and other income below.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {[{ label: 'Yes — Filer', val: true }, { label: 'No — Non-filer', val: false }].map((opt) => {
                const active = (watchedValues.is_atl !== false) === opt.val;
                return (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setValue('is_atl', opt.val, { shouldDirty: true })}
                    className={`rounded-brand border px-4 py-2 font-body text-sm font-semibold transition-colors ${
                      active ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-navy hover:bg-navy/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column headers (desktop) */}
        <div className="hidden grid-cols-[1fr_repeat(3,120px)] gap-3 px-1 md:grid">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-400">Description</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">Amount</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">Tax deducted</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400">Tax chargeable</span>
        </div>

        {/* Sections — filtered by income-profile addons via shared/formFieldVisibility.js. */}
        {visibleSections.length === 0 && (
          <FormEmptyState
            title="No final-tax income to declare based on your income profile yet."
            addons={['Bank / Savings Profit', 'Dividends from Shares', 'Sukuk / Bond Income', 'Prize Bonds / Winnings']}
            note="Final-tax income (s.150 / s.151 / s.156) only shows up if you have one of these streams. We hide the buckets otherwise so you don't have to scan past 30 rows of zeros."
          />
        )}

        {visibleSections.map((sectionDef) => (
          <CollapsibleSection
            key={sectionDef.section}
            title={sectionDef.sectionTitle}
            icon={sectionDef.sectionIcon}
            open={!!expandedSections[sectionDef.section]}
            onToggle={() => toggleSection(sectionDef.section)}
          >
            {sectionDef.fields.map((field) => (
              <div key={field.amountField} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_repeat(3,120px)] md:items-start md:gap-3">
                {/* Description */}
                <div className="min-w-0">
                  <div className="flex items-start gap-1.5">
                    <span className="font-body text-sm leading-snug text-slate-700">{field.label}</span>
                    <HelpHint fieldId={field.amountField} source={finalMinIncomeHelp} />
                  </div>
                  {field.description && <p className="mt-0.5 font-body text-xs text-slate-400">{field.description}</p>}
                  {field.slabCalculatedTaxDeducted && (() => {
                    const salary = parseFloat(watchedValues[field.amountField]) || 0;
                    if (salary <= 0) return null;
                    const { tax, baseTax, surcharge, slabLabel } = calculateFBRSalaryTax(salary);
                    const effectiveRate = ((tax / salary) * 100).toFixed(1);
                    return (
                      <div className="mt-1 space-y-0.5 rounded-brand border border-navy/15 bg-navy/[0.04] px-2 py-1 font-body text-xs">
                        <p className="font-semibold text-navy">FBR Finance Act 2025 slab: {slabLabel}</p>
                        {surcharge > 0 && (
                          <p className="text-slate-500">
                            Base tax Rs {baseTax.toLocaleString()} + 9% surcharge (income &gt; Rs 10M) Rs {surcharge.toLocaleString()}
                          </p>
                        )}
                        <p className="font-semibold text-navy">
                          Total tax Rs {tax.toLocaleString()} &nbsp;·&nbsp; effective {effectiveRate}%
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Amount */}
                <div>
                  <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">Amount</span>
                  {field.autoPopulateAmount ? (
                    <input
                      key={`${field.amountField}-${refreshKey}`}
                      type="text"
                      className={readOnlyInputClasses}
                      value={formatNumber(watchedValues[field.amountField] || 0)}
                      readOnly
                      placeholder="0"
                      aria-label={`${field.label} — amount (auto)`}
                      title="Auto-populated from Income form"
                    />
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputClasses}
                      placeholder="0"
                      aria-label={`${field.label} — amount`}
                      value={formatNumber(watchedValues[field.amountField] || 0)}
                      onFocus={(e) => handleNumberFocus(field.amountField, e)}
                      onChange={(e) => handleNumberInput(field.amountField, e)}
                      onBlur={(e) => handleNumberBlur(field.amountField, e)}
                    />
                  )}
                </div>

                {/* Tax deducted */}
                <div>
                  <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">Tax deducted</span>
                  {field.slabCalculatedTaxDeducted ? (
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          className={`${inputClasses} pr-8`}
                          placeholder="0"
                          aria-label={`${field.label} — tax deducted`}
                          value={formatNumber(watchedValues[field.taxDeductedField] || 0)}
                          onFocus={(e) => handleNumberFocus(field.taxDeductedField, e)}
                          onChange={(e) => handleNumberInput(field.taxDeductedField, e)}
                          onBlur={(e) => handleNumberBlur(field.taxDeductedField, e)}
                          title="FBR slab-calculated (editable for actual employer deduction)"
                        />
                        <button
                          type="button"
                          aria-label="Reset to FBR slab calculation"
                          title="Reset to FBR slab calculation"
                          onClick={() => {
                            const salary = parseFloat(watchedValues[field.amountField]) || 0;
                            const { tax } = calculateFBRSalaryTax(salary);
                            setValue(field.taxDeductedField, tax);
                            setRefreshKey((k) => k + 1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-navy/50 transition-colors hover:text-navy"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                      {(() => {
                        const certWHT = parseFloat(formData['adjustable_tax']?.salary_employees_149_tax_collected) || 0;
                        if (certWHT <= 0) return null;
                        return (
                          <button
                            type="button"
                            title={`Use WHT from employer certificate: ${formatCurrency(certWHT)}`}
                            onClick={() => {
                              setValue(field.taxDeductedField, certWHT);
                              setRefreshKey((k) => k + 1);
                            }}
                            className="mt-1 flex w-full items-center gap-1 rounded-brand border border-lime/40 bg-lime/15 px-2 py-0.5 font-body text-xs text-navy transition-colors hover:bg-lime/25"
                          >
                            <FileCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                            <span>Use cert. WHT: {formatCurrency(certWHT)}</span>
                          </button>
                        );
                      })()}
                    </div>
                  ) : (
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputClasses}
                      placeholder="0"
                      aria-label={`${field.label} — tax deducted`}
                      value={formatNumber(watchedValues[field.taxDeductedField] || 0)}
                      onFocus={(e) => handleNumberFocus(field.taxDeductedField, e)}
                      onChange={(e) => handleNumberInput(field.taxDeductedField, e)}
                      onBlur={(e) => handleNumberBlur(field.taxDeductedField, e)}
                    />
                  )}
                </div>

                {/* Tax chargeable — manual for salary/arrears, auto for fixed-rate rows */}
                <div>
                  <span className="mb-1 block font-body text-xs font-medium text-slate-400 md:hidden">Tax chargeable</span>
                  {field.taxChargeableManual ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      className={inputClasses}
                      placeholder="Enter tax"
                      aria-label={`${field.label} — tax chargeable`}
                      value={formatNumber(watchedValues[field.taxChargeableField] || 0)}
                      onFocus={(e) => handleNumberFocus(field.taxChargeableField, e)}
                      onChange={(e) => handleNumberInput(field.taxChargeableField, e)}
                      onBlur={(e) => handleNumberBlur(field.taxChargeableField, e)}
                      title="Manual entry — the actual tax chargeable, for the over/under-deduction check"
                    />
                  ) : (
                    <input
                      key={`${field.taxChargeableField}-${refreshKey}`}
                      type="text"
                      className={readOnlyInputClasses}
                      value={formatNumber(watchedValues[field.taxChargeableField] || 0)}
                      readOnly
                      placeholder="0"
                      aria-label={`${field.label} — tax chargeable (auto)`}
                    />
                  )}
                </div>
              </div>
            ))}
          </CollapsibleSection>
        ))}

        {advancedExtraCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-brand border-[1.5px] border-navy/20 bg-navy/[0.03] px-4 py-3 font-body text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.06] focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15"
          >
            {showAdvanced
              ? (<><ChevronDown size={16} aria-hidden="true" /> Hide advanced final-tax fields</>)
              : (<><Plus size={16} aria-hidden="true" /> Show {advancedExtraCount} more advanced final-tax item{advancedExtraCount === 1 ? '' : 's'}</>)}
          </button>
        )}

        {/* Capital gain row — auto-populated from the Capital Gain form. */}
        {visibleFields.has('capital_gain_tax_deducted') && (
          <div>
            <h2 className="mb-1 px-3 font-display text-xs font-bold uppercase tracking-wider text-slate-400">Capital gain</h2>
            <div className="overflow-hidden rounded-brand-lg border border-slate-200">
              <div className="grid grid-cols-1 gap-2 px-3 py-3 md:grid-cols-[1fr_repeat(3,120px)] md:items-center md:gap-3">
                <div className="flex items-start gap-2">
                  <Award size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-navy" />
                  <div className="min-w-0">
                    <span className="font-body text-sm text-slate-700">Capital gain (from Capital Gain form)</span>
                    <p className="font-body text-xs text-slate-400">Auto-populated — fill the Capital Gain form first</p>
                  </div>
                </div>
                <input key={`capital_gain-${refreshKey}`} type="text" className={readOnlyInputClasses} value={formatNumber(watchedValues.capital_gain)} readOnly placeholder="0" aria-label="Capital gain — amount" />
                <input key={`capital_gain_tax_deducted-${refreshKey}`} type="text" className={readOnlyInputClasses} value={formatNumber(watchedValues.capital_gain_tax_deducted)} readOnly placeholder="0" aria-label="Capital gain — tax deducted" />
                <input key={`capital_gain_tax_chargeable-${refreshKey}`} type="text" className={readOnlyInputClasses} value={formatNumber(watchedValues.capital_gain_tax_chargeable)} readOnly placeholder="0" aria-label="Capital gain — tax chargeable" />
              </div>
            </div>
          </div>
        )}

        {/* Totals — navy card; grand total in lime. */}
        <div className="space-y-3 rounded-brand-lg bg-navy p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-body text-sm font-semibold text-white/80">Subtotal tax chargeable</h3>
              <p className="font-body text-xs text-white/50">Excluding capital gain</p>
            </div>
            <p className="shrink-0 font-mono text-lg font-bold tabular-nums text-white">{formatCurrency(subtotal)}</p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/15 pt-3">
            <div className="min-w-0">
              <h3 className="font-body text-sm font-bold text-white">Grand total tax chargeable</h3>
              <p className="font-body text-xs text-white/50">Subtotal + capital-gain tax chargeable</p>
            </div>
            <p className="shrink-0 font-mono text-xl font-bold tabular-nums text-lime">{formatCurrency(grandTotal)}</p>
          </div>
        </div>
      </TaxFormShell>
    </form>
  );
};

export default FinalMinIncomeForm;
