/* eslint-disable react-hooks/exhaustive-deps -- auto-calc effects intentionally watch specific field values; adding watchedValues/whtRate to deps would cause re-render loops */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import { visibleFieldsFor } from '../../../shared/formFieldVisibility';
import {
  Calculator,
  Zap,
  Phone,
  Car,
  Home,
  CreditCard,
  Building,
  Users,
  Info,
  DollarSign,
  ChevronDown,
  RotateCcw,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import HelpHint from '../../../components/Help/HelpHint';
import adjustableTaxHelp from '../../../help/adjustableTaxHelp';
import { formatCurrency } from '../../../utils/currency';
import { TaxFormShell, CollapsibleSection, FormNav } from '../../../components/forms';


// Sum gross + tax across all field groups. Pure — callers pass a values
// snapshot (handleSubmit data / getValues()). The live summary card and the
// save handlers share this arithmetic.
const computeAdjustableTotals = (vals, fieldGroups) => {
  let totalGrossReceipt = 0;
  let totalTaxCollected = 0;
  Object.values(fieldGroups).forEach((group) => {
    group.fields.forEach((field) => {
      totalGrossReceipt += parseFloat(vals[field.grossField]) || 0;
      totalTaxCollected += parseFloat(vals[field.taxField]) || 0;
    });
  });
  return { totalGrossReceipt, totalTaxCollected };
};

// Live summary card — the only subscriber to the whole form (cheap: it sums and
// renders two numbers), isolated so the inputs don't re-render per keystroke.
const AdjustableTotals = ({ control, fieldGroups }) => {
  const values = useWatch({ control });
  const { totalGrossReceipt, totalTaxCollected } = computeAdjustableTotals(values || {}, fieldGroups);
  return (
    <div className="rounded-brand-lg bg-navy p-5">
      <h3 className="mb-3 font-body text-xs font-bold uppercase tracking-wider text-white/60">Summary total</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-brand bg-white/5 p-3">
          <span className="block font-body text-xs font-medium uppercase tracking-wider text-white/60">Amount on certificate</span>
          <span className="mt-1 block break-all font-mono text-lg font-bold tabular-nums text-white">{formatCurrency(totalGrossReceipt)}</span>
        </div>
        <div className="rounded-brand bg-lime/15 p-3 ring-1 ring-lime/30">
          <span className="block font-body text-xs font-medium uppercase tracking-wider text-lime">Tax collected (credit)</span>
          <span className="mt-1 block break-all font-mono text-lg font-bold tabular-nums text-lime">{formatCurrency(totalTaxCollected)}</span>
        </div>
      </div>
      <p className="mt-3 text-center font-body text-xs text-white/60">Tax collected is adjusted against your final tax liability.</p>
    </div>
  );
};

// Headless: per-field auto-calc (gross × WHT rate, only when the tax cell is
// still empty). Self-subscribes via useWatch so the effects run without the
// form body re-rendering. Renders nothing. (Logic moved verbatim from the
// parent — same rates, same "only fill if empty" guard, same ATL handling.)
const AdjustableAutoCalc = ({ control, setValue, rates, whtRate, isLoadingFromDB }) => {
  const watchedValues = useWatch({ control });

  // Auto-calculate tax for Directorship Fee at 20%
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('directorship_fee');
    if (!rate) return;
    const gross = watchedValues['directorship_fee_149_3_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['directorship_fee_149_3_tax_collected'];
      if (current === null || current === undefined) {
        setValue('directorship_fee_149_3_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['directorship_fee_149_3_gross_receipt'], setValue, rates]);

  // Motor Vehicle Leasing — rate from DB (u/s 231B(1A)).
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('motor_vehicle_leasing_231b1a');
    if (!rate) return;
    const gross = watchedValues['motor_vehicle_leasing_231b1a_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['motor_vehicle_leasing_231b1a_tax_collected'];
      if (current === null || current === undefined) {
        setValue('motor_vehicle_leasing_231b1a_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['motor_vehicle_leasing_231b1a_gross_receipt'], setValue, rates]);

  // Telephone Bill — DB (u/s 236(1)(e)).
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('telephone_bill_236_1e');
    if (!rate) return;
    const gross = watchedValues['telephone_bill_236_1e_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['telephone_bill_236_1e_tax_collected'];
      if (current === null || current === undefined) {
        setValue('telephone_bill_236_1e_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['telephone_bill_236_1e_gross_receipt'], setValue, rates]);

  // Cellphone Bill — DB (u/s 236(1)(f)).
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('cellphone_bill');
    if (!rate) return;
    const gross = watchedValues['cellphone_bill_236_1f_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['cellphone_bill_236_1f_tax_collected'];
      if (current === null || current === undefined) {
        setValue('cellphone_bill_236_1f_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['cellphone_bill_236_1f_gross_receipt'], setValue, rates]);

  // Prepaid Telephone Card — DB.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('prepaid_telephone_card_236_1b');
    if (!rate) return;
    const gross = watchedValues['prepaid_telephone_card_236_1b_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['prepaid_telephone_card_236_1b_tax_collected'];
      if (current === null || current === undefined) {
        setValue('prepaid_telephone_card_236_1b_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['prepaid_telephone_card_236_1b_gross_receipt'], setValue, rates]);

  // Phone Unit — DB.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('phone_unit_236_1c');
    if (!rate) return;
    const gross = watchedValues['phone_unit_236_1c_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['phone_unit_236_1c_tax_collected'];
      if (current === null || current === undefined) {
        setValue('phone_unit_236_1c_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['phone_unit_236_1c_gross_receipt'], setValue, rates]);

  // Internet Bill — DB.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('internet_bill_236_1d');
    if (!rate) return;
    const gross = watchedValues['internet_bill_236_1d_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['internet_bill_236_1d_tax_collected'];
      if (current === null || current === undefined) {
        setValue('internet_bill_236_1d_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['internet_bill_236_1d_gross_receipt'], setValue, rates]);

  // Prepaid Internet Card — DB.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('prepaid_internet_card_236_1e');
    if (!rate) return;
    const gross = watchedValues['prepaid_internet_card_236_1e_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['prepaid_internet_card_236_1e_tax_collected'];
      if (current === null || current === undefined) {
        setValue('prepaid_internet_card_236_1e_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['prepaid_internet_card_236_1e_gross_receipt'], setValue, rates]);

  // Profit on debt u/s 151 — FA 2025 raised individual rate from 15% to 20%.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('profit_debt_151_20');
    if (!rate) return;
    const gross = watchedValues['profit_debt_151_15_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['profit_debt_151_15_tax_collected'];
      if (current === null || current === undefined) {
        setValue('profit_debt_151_15_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['profit_debt_151_15_gross_receipt'], setValue, rates]);

  // Sukook profit u/s 151A — 12.5%.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('sukook_151a');
    if (!rate) return;
    const gross = watchedValues['profit_debt_sukook_151a_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['profit_debt_sukook_151a_tax_collected'];
      if (current === null || current === undefined) {
        setValue('profit_debt_sukook_151a_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['profit_debt_sukook_151a_gross_receipt'], setValue, rates]);

  // Rent u/s 155 — individual rate.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('rent_section_155_individual');
    if (!rate) return;
    const gross = watchedValues['tax_deducted_rent_section_155_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['tax_deducted_rent_section_155_tax_collected'];
      if (current === null || current === undefined) {
        setValue('tax_deducted_rent_section_155_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['tax_deducted_rent_section_155_gross_receipt'], setValue, rates]);

  // Electricity bill (domestic) u/s 235.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('electricity_bill_235');
    if (!rate) return;
    const gross = watchedValues['electricity_bill_domestic_235_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['electricity_bill_domestic_235_tax_collected'];
      if (current === null || current === undefined) {
        setValue('electricity_bill_domestic_235_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['electricity_bill_domestic_235_gross_receipt'], setValue, rates]);

  // Motor vehicle transfer fee u/s 231B(2).
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const rate = whtRate('motor_vehicle_transfer_231b2');
    if (!rate) return;
    const gross = watchedValues['motor_vehicle_transfer_fee_231b2_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['motor_vehicle_transfer_fee_231b2_tax_collected'];
      if (current === null || current === undefined) {
        setValue('motor_vehicle_transfer_fee_231b2_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['motor_vehicle_transfer_fee_231b2_gross_receipt'], setValue, rates]);

  // Functions/gatherings u/s 236CB — ATL vs Non-ATL rates both from DB.
  useEffect(() => {
    if (isLoadingFromDB.current) return;
    const atlStatus = watchedValues['functions_gatherings_charges_236cb_atl_status'];
    if (!atlStatus) return;
    const rate = whtRate(
      atlStatus === 'ATL' ? 'functions_gatherings_236cb_atl' : 'functions_gatherings_236cb_nonatl'
    );
    if (!rate) return;
    const gross = watchedValues['functions_gatherings_charges_236cb_gross_receipt'];
    if (gross && gross > 0) {
      const current = watchedValues['functions_gatherings_charges_236cb_tax_collected'];
      if (current === null || current === undefined) {
        setValue('functions_gatherings_charges_236cb_tax_collected', Math.round(gross * rate));
      }
    }
  }, [watchedValues['functions_gatherings_charges_236cb_gross_receipt'], watchedValues['functions_gatherings_charges_236cb_atl_status'], setValue, rates]);

  return null;
};

const AdjustableTaxForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData,
    saving,
    incomeProfile,
  } = useTaxForm();

  // Field-level visibility — pulled from the shared manifest so the same
  // declarations work across web + (eventually) mobile. Pure salaried
  // users see ~10 WHT lines instead of all 54. Advanced toggle reveals
  // the rest in one click for the rare cases.
  const addons = useMemo(() => incomeProfile?.addons || [], [incomeProfile]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visibleFields = useMemo(
    () => visibleFieldsFor('adjustable_tax_forms', addons, { advanced: showAdvanced }),
    [addons, showAdvanced]
  );
  const { currentTaxYear } = useTaxYear();
  const { rates } = useTaxRates(currentTaxYear);

  // Shorthand: look up a WHT rate by its tax_rates_config.rate_category key.
  // Returns null until rates are loaded — callers should early-return.
  const whtRate = (category) => rates?.withholding?.[category]?.rate ?? null;

  // Map form tax_collected field name → DB rate_category. Used by the Reset
  // button and display labels so they pull the authoritative rate from DB.
  // Auto-calc effects above hardcode the same mapping inline for readability.
  const TAX_FIELD_TO_WHT_CATEGORY = {
    directorship_fee_149_3_tax_collected:        'directorship_fee',
    motor_vehicle_leasing_231b1a_tax_collected:  'motor_vehicle_leasing_231b1a',
    telephone_bill_236_1e_tax_collected:         'telephone_bill_236_1e',
    cellphone_bill_236_1f_tax_collected:         'cellphone_bill',
    prepaid_telephone_card_236_1b_tax_collected: 'prepaid_telephone_card_236_1b',
    phone_unit_236_1c_tax_collected:             'phone_unit_236_1c',
    internet_bill_236_1d_tax_collected:          'internet_bill_236_1d',
    prepaid_internet_card_236_1e_tax_collected:  'prepaid_internet_card_236_1e',
    profit_debt_151_15_tax_collected:            'profit_debt_151_20',
    profit_debt_sukook_151a_tax_collected:       'sukook_151a',
    tax_deducted_rent_section_155_tax_collected: 'rent_section_155_individual',
    electricity_bill_domestic_235_tax_collected: 'electricity_bill_235',
    motor_vehicle_transfer_fee_231b2_tax_collected: 'motor_vehicle_transfer_231b2',
  };

  const resolveFieldRate = (field, atlStatus) => {
    if (field.atlStatusField) {
      return whtRate(
        atlStatus === 'NONATL' ? 'functions_gatherings_236cb_nonatl' : 'functions_gatherings_236cb_atl'
      ) ?? field.taxRate;
    }
    return whtRate(TAX_FIELD_TO_WHT_CATEGORY[field.taxField]) ?? field.taxRate;
  };

  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [refreshKey, setRefreshKey] = useState(0); // Used to force re-render after data refresh

  // Ref to suppress auto-calc effects while form is being loaded/reset from DB.
  // Prevents auto-calc from overwriting user-saved 0s when gross changes during reset().
  const isLoadingFromDB = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('adjustable_tax')
  });

  // Sync form when context formData updates (handles page load, navigation back, and post-save).
  // This is the sole data-loading path — the previous standalone axios loadFromAPI was removed
  // to eliminate the race condition where two concurrent loads would overwrite each other.
  useEffect(() => {
    const savedData = formData['adjustable_tax'];
    const incomeData = formData['income'] || {};

    if (savedData && Object.keys(savedData).length > 0) {
      // Patch salary gross receipt from income form (authoritative source)
      const correctSalary =
        parseFloat(incomeData.annual_salary_wages_total) ||
        parseFloat(incomeData.total_employment_income) ||
        parseFloat(savedData.salary_employees_149_gross_receipt) ||
        0;

      const patchedData = { ...savedData };
      if (correctSalary > 0) {
        patchedData.salary_employees_149_gross_receipt = correctSalary;
      }

      // Suppress auto-calc effects while resetting from DB so saved 0s are not overwritten
      isLoadingFromDB.current = true;
      reset(patchedData);
      // Delay refreshKey so reset() state propagates before inputs remount with defaultValue
      setTimeout(() => {
        setRefreshKey(k => k + 1);
        isLoadingFromDB.current = false;
      }, 0);
    }
  }, [formData, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prior year pre-fill

  // PERF-02: the per-field auto-calc effects that used to read a bare watch()
  // here now live in the headless <AdjustableAutoCalc> child (self-subscribing
  // via useWatch), so the parent no longer re-renders on every keystroke.

  // Auto-populate income-linked gross receipt fields when no saved adjustable_tax data exists yet
  // (fires when context loads income data — handles fresh form or out-of-sequence navigation)
  useEffect(() => {
    const incomeData = formData['income'] || {};
    if (!incomeData || Object.keys(incomeData).length === 0) return;

    // Only auto-populate if adjustable_tax hasn't been saved yet — avoid overwriting user edits
    const savedAdjustable = formData['adjustable_tax'] || {};
    if (Object.keys(savedAdjustable).length > 0) return;

    const autoFetchMappings = {
      'salary_employees_149_gross_receipt': incomeData.annual_salary_wages_total || 0,
      'directorship_fee_149_3_gross_receipt': incomeData.directorship_fee || 0,
      'profit_debt_151_15_gross_receipt': incomeData.profit_on_debt_15_percent || 0,
      'profit_debt_sukook_151a_gross_receipt': incomeData.profit_on_debt_12_5_percent || 0,
      'tax_deducted_rent_section_155_gross_receipt': incomeData.other_taxable_income_rent || 0
    };

    let anySet = false;
    Object.entries(autoFetchMappings).forEach(([fieldName, value]) => {
      if (value && value > 0) {
        setValue(fieldName, value);
        anySet = true;
      }
    });

    if (anySet) {
      setTimeout(() => setRefreshKey(k => k + 1), 0);
    }
  }, [formData, setValue]); // eslint-disable-line react-hooks/exhaustive-deps


  // Define comprehensive field groups matching the Excel structure exactly
  const fieldGroups = {
    employment: {
      title: "Employment and Salary",
      icon: Users,
      color: "green",
      fields: [
        {
          key: 'salary_employees_149',
          label: 'Salary of Employees u/s 149',
          grossField: 'salary_employees_149_gross_receipt',
          taxField: 'salary_employees_149_tax_collected',
          autoFetch: true,
          remark: 'Gross receipt linked with Income sheet and tax collected is Input cell'
        },
        {
          key: 'directorship_fee_149_3',
          label: 'Directorship Fee u/s 149(3)',
          grossField: 'directorship_fee_149_3_gross_receipt',
          taxField: 'directorship_fee_149_3_tax_collected',
          autoFetch: true,
          autoCalculateTax: true,
          taxRate: 0.20,
          remark: 'Gross receipt linked with Income sheet and tax collected is auto-calculated at 20%'
        }
      ]
    },
    profitDebt: {
      title: "Profit on Debt",
      icon: Calculator,
      color: "blue",
      fields: [
        {
          key: 'profit_debt_151_15',
          label: 'Profit on Debt u/s 151 @ 20% (Finance Act 2025 — raised from 15%)',
          grossField: 'profit_debt_151_15_gross_receipt',
          taxField: 'profit_debt_151_15_tax_collected',
          autoFetch: true,
          autoCalculateTax: true,
          taxRate: 0.20,
          remark: 'Gross receipt auto-fetched from Income form. Tax auto-calculated at 20% (Finance Act 2025) — editable if actual deduction differs.'
        },
        {
          key: 'profit_debt_sukook_151a',
          label: 'Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)',
          grossField: 'profit_debt_sukook_151a_gross_receipt',
          taxField: 'profit_debt_sukook_151a_tax_collected',
          autoFetch: true,
          autoCalculateTax: true,
          taxRate: 0.125,
          remark: 'Gross receipt auto-fetched from Income form. Tax auto-calculated at 12.5% — editable if deduction differs.'
        },
        {
          key: 'tax_deducted_rent_section_155',
          label: 'Tax deducted on Rent received (Section 155)',
          grossField: 'tax_deducted_rent_section_155_gross_receipt',
          taxField: 'tax_deducted_rent_section_155_tax_collected',
          autoFetch: true,
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Gross receipt auto-fetched from Income form. Tax auto-calculated at 15% — editable if deduction differs.'
        }
      ]
    },
    banking: {
      title: "Banking and Cash Transactions",
      icon: CreditCard,
      color: "yellow",
      fields: [
        {
          key: 'advance_tax_cash_withdrawal_231ab',
          label: 'Advance tax on cash withdrawal u/s 231AB',
          grossField: 'advance_tax_cash_withdrawal_231ab_gross_receipt',
          taxField: 'advance_tax_cash_withdrawal_231ab_tax_collected',
          remark: 'Input cell'
        }
      ]
    },
    motorVehicle: {
      title: "Motor Vehicle Related",
      icon: Car,
      color: "purple",
      fields: [
        {
          key: 'motor_vehicle_registration_fee_231b1',
          label: 'Motor Vehicle Registration Fee u/s 231B(1)',
          grossField: 'motor_vehicle_registration_fee_231b1_gross_receipt',
          taxField: 'motor_vehicle_registration_fee_231b1_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'motor_vehicle_transfer_fee_231b2',
          label: 'Motor Vehicle Transfer Fee u/s 231B(2) @3%',
          grossField: 'motor_vehicle_transfer_fee_231b2_gross_receipt',
          taxField: 'motor_vehicle_transfer_fee_231b2_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.03,
          remark: 'Tax auto-calculated at 3% — editable if actual deduction differs.'
        },
        {
          key: 'motor_vehicle_sale_231b3',
          label: 'Motor Vehicle Sale u/s 231B(3)',
          grossField: 'motor_vehicle_sale_231b3_gross_receipt',
          taxField: 'motor_vehicle_sale_231b3_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'motor_vehicle_leasing_231b1a',
          label: 'Motor Vehicle Leasing u/s 231B(1A) (Non-ATL) @4%',
          grossField: 'motor_vehicle_leasing_231b1a_gross_receipt',
          taxField: 'motor_vehicle_leasing_231b1a_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.04,
          remark: 'Tax collected is auto-calculated at 4% of gross receipt'
        },
        {
          key: 'advance_tax_motor_vehicle_231b2a',
          label: 'Advance tax on Motor Vehicle u/s 231B(2A)',
          grossField: 'advance_tax_motor_vehicle_231b2a_gross_receipt',
          taxField: 'advance_tax_motor_vehicle_231b2a_tax_collected',
          remark: 'Input cell'
        }
      ]
    },
    utilities: {
      title: "Utility Bills",
      icon: Zap,
      color: "indigo",
      fields: [
        {
          key: 'electricity_bill_domestic_235',
          label: 'Electricity Bill of Domestic Consumer u/s 235 @7.5%',
          grossField: 'electricity_bill_domestic_235_gross_receipt',
          taxField: 'electricity_bill_domestic_235_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.075,
          remark: 'Tax auto-calculated at 7.5% on annual bill total — editable if actual deduction differs.'
        }
      ]
    },
    telecommunications: {
      title: "Telecommunications",
      icon: Phone,
      color: "cyan",
      fields: [
        {
          key: 'telephone_bill_236_1e',
          label: 'Telephone Bill u/s 236(1)(a) @15%',
          grossField: 'telephone_bill_236_1e_gross_receipt',
          taxField: 'telephone_bill_236_1e_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Tax collected is auto-calculated at 15% of gross receipt'
        },
        {
          key: 'cellphone_bill_236_1f',
          label: 'Cellphone Bill u/s 236(1)(a) @15%',
          grossField: 'cellphone_bill_236_1f_gross_receipt',
          taxField: 'cellphone_bill_236_1f_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Tax collected is auto-calculated at 15% of gross receipt'
        },
        {
          key: 'prepaid_telephone_card_236_1b',
          label: 'Prepaid Telephone Card u/s 236(1)(b) @15%',
          grossField: 'prepaid_telephone_card_236_1b_gross_receipt',
          taxField: 'prepaid_telephone_card_236_1b_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Tax collected is auto-calculated at 15% of gross receipt'
        },
        {
          key: 'phone_unit_236_1c',
          label: 'Phone Unit u/s 236(1)(c) @15%',
          grossField: 'phone_unit_236_1c_gross_receipt',
          taxField: 'phone_unit_236_1c_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Tax collected is auto-calculated at 15% of gross receipt'
        },
        {
          key: 'internet_bill_236_1d',
          label: 'Internet Bill u/s 236(1)(d) @15%',
          grossField: 'internet_bill_236_1d_gross_receipt',
          taxField: 'internet_bill_236_1d_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Tax collected is auto-calculated at 15% of gross receipt'
        },
        {
          key: 'prepaid_internet_card_236_1e',
          label: 'Prepaid Internet Card u/s 236(1)(e) @15%',
          grossField: 'prepaid_internet_card_236_1e_gross_receipt',
          taxField: 'prepaid_internet_card_236_1e_tax_collected',
          autoCalculateTax: true,
          taxRate: 0.15,
          remark: 'Tax collected is auto-calculated at 15% of gross receipt'
        }
      ]
    },
    property: {
      title: "Property Related",
      icon: Home,
      color: "red",
      fields: [
        {
          key: 'sale_transfer_immoveable_property_236c',
          label: 'Sale / Transfer of Immovable Property u/s 236C',
          grossField: 'sale_transfer_immoveable_property_236c_gross_receipt',
          taxField: 'sale_transfer_immoveable_property_236c_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'tax_deducted_236c_property_purchased_sold_same_year',
          label: 'Tax Deducted u/s 236C where Property Purchased & Sold within Tax Year',
          grossField: 'tax_deducted_236c_property_purchased_sold_same_year_gross_receipt',
          taxField: 'tax_deducted_236c_property_purchased_sold_same_year_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'tax_deducted_236c_property_purchased_prior_year',
          label: 'Tax Deducted u/s 236C where Property Purchased Prior to current Tax Year',
          grossField: 'tax_deducted_236c_property_purchased_prior_year_gross_receipt',
          taxField: 'tax_deducted_236c_property_purchased_prior_year_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'purchase_transfer_immoveable_property_236k',
          label: 'Purchase / Transfer of Immovable Property u/s 236K',
          grossField: 'purchase_transfer_immoveable_property_236k_gross_receipt',
          taxField: 'purchase_transfer_immoveable_property_236k_tax_collected',
          remark: 'Input cell'
        }
      ]
    },
    events: {
      title: "Events and Services",
      icon: Building,
      color: "pink",
      fields: [
        {
          key: 'functions_gatherings_charges_236cb',
          label: 'Functions / Gatherings Charges u/s 236CB',
          grossField: 'functions_gatherings_charges_236cb_gross_receipt',
          taxField: 'functions_gatherings_charges_236cb_tax_collected',
          atlStatusField: 'functions_gatherings_charges_236cb_atl_status',
          autoCalculateTax: true,
          taxRate: 0.10, // default ATL rate; recalculated per atlStatusField
          remark: 'Select ATL/Non-ATL status — tax auto-calculated at 10% (ATL) or 20% (Non-ATL). Editable.'
        },
        {
          key: 'withholding_tax_sale_considerations_37e',
          label: 'Withholding tax on Sale Considerations u/s 37(6) @ 10% of the value of shares',
          grossField: 'withholding_tax_sale_considerations_37e_gross_receipt',
          taxField: 'withholding_tax_sale_considerations_37e_tax_collected',
          remark: 'Input cell'
        }
      ]
    },
    financial: {
      title: "Financial and International",
      icon: DollarSign,
      color: "teal",
      fields: [
        {
          key: 'advance_fund_23a_part_i_second_schedule',
          label: 'Advance Tax on Withdrawal of Balance under Pension Fund u/c 23A of Part I of Second Schedule',
          grossField: 'advance_fund_23a_part_i_second_schedule_gross_receipt',
          taxField: 'advance_fund_23a_part_i_second_schedule_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'persons_remitting_amount_abroad_236v',
          label: 'Persons remitting amount abroad through credit / debits / prepaid cards u/s 236Y',
          grossField: 'persons_remitting_amount_abroad_236v_gross_receipt',
          taxField: 'persons_remitting_amount_abroad_236v_tax_collected',
          remark: 'Input cell'
        },
        {
          key: 'advance_tax_foreign_domestic_workers_231c',
          label: 'Advance tax on foreign domestic workers u/s 231C',
          grossField: 'advance_tax_foreign_domestic_workers_231c_gross_receipt',
          taxField: 'advance_tax_foreign_domestic_workers_231c_tax_collected',
          remark: 'Input cell'
        }
      ]
    }
  };

  // Totals are computed by the module-scope computeAdjustableTotals() — the live
  // summary card uses it via <AdjustableTotals> (self-subscribing), and the save
  // handlers below call it on their values snapshot.

  const onSubmit = async (data) => {
    const { totalGrossReceipt, totalTaxCollected } = computeAdjustableTotals(data, fieldGroups);
    // Structure the data to match backend API expectations
    const structuredData = {
      // Employment and Salary
      salaryEmployees149: {
        grossReceipt: parseFloat(data.salary_employees_149_gross_receipt || 0),
        taxCollected: parseFloat(data.salary_employees_149_tax_collected || 0)
      },
      directorshipFee149_3: {
        grossReceipt: parseFloat(data.directorship_fee_149_3_gross_receipt || 0),
        taxCollected: parseFloat(data.directorship_fee_149_3_tax_collected || 0)
      },
      
      // Profit on Debt
      profitDebt151_15: {
        grossReceipt: parseFloat(data.profit_debt_151_15_gross_receipt || 0),
        taxCollected: parseFloat(data.profit_debt_151_15_tax_collected || 0)
      },
      profitDebtSukook151A: {
        grossReceipt: parseFloat(data.profit_debt_sukook_151a_gross_receipt || 0),
        taxCollected: parseFloat(data.profit_debt_sukook_151a_tax_collected || 0)
      },
      taxDeductedRentSection155: {
        grossReceipt: parseFloat(data.tax_deducted_rent_section_155_gross_receipt || 0),
        taxCollected: parseFloat(data.tax_deducted_rent_section_155_tax_collected || 0)
      },
      
      // Banking
      advanceTaxCashWithdrawal231AB: {
        grossReceipt: parseFloat(data.advance_tax_cash_withdrawal_231ab_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_cash_withdrawal_231ab_tax_collected || 0)
      },
      
      // Motor Vehicle Related
      motorVehicleRegistrationFee231B1: {
        grossReceipt: parseFloat(data.motor_vehicle_registration_fee_231b1_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_registration_fee_231b1_tax_collected || 0)
      },
      motorVehicleTransferFee231B2: {
        grossReceipt: parseFloat(data.motor_vehicle_transfer_fee_231b2_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_transfer_fee_231b2_tax_collected || 0)
      },
      motorVehicleSale231B3: {
        grossReceipt: parseFloat(data.motor_vehicle_sale_231b3_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_sale_231b3_tax_collected || 0)
      },
      motorVehicleLeasing231B1A: {
        grossReceipt: parseFloat(data.motor_vehicle_leasing_231b1a_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_leasing_231b1a_tax_collected || 0)
      },
      advanceTaxMotorVehicle231B2A: {
        grossReceipt: parseFloat(data.advance_tax_motor_vehicle_231b2a_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_motor_vehicle_231b2a_tax_collected || 0)
      },
      
      // Utility Bills
      electricityBillDomestic235: {
        grossReceipt: parseFloat(data.electricity_bill_domestic_235_gross_receipt || 0),
        taxCollected: parseFloat(data.electricity_bill_domestic_235_tax_collected || 0)
      },
      telephoneBill236_1E: {
        grossReceipt: parseFloat(data.telephone_bill_236_1e_gross_receipt || 0),
        taxCollected: parseFloat(data.telephone_bill_236_1e_tax_collected || 0)
      },
      cellphoneBill236_1F: {
        grossReceipt: parseFloat(data.cellphone_bill_236_1f_gross_receipt || 0),
        taxCollected: parseFloat(data.cellphone_bill_236_1f_tax_collected || 0)
      },
      prepaidTelephoneCard236_1B: {
        grossReceipt: parseFloat(data.prepaid_telephone_card_236_1b_gross_receipt || 0),
        taxCollected: parseFloat(data.prepaid_telephone_card_236_1b_tax_collected || 0)
      },
      phoneUnit236_1C: {
        grossReceipt: parseFloat(data.phone_unit_236_1c_gross_receipt || 0),
        taxCollected: parseFloat(data.phone_unit_236_1c_tax_collected || 0)
      },
      internetBill236_1D: {
        grossReceipt: parseFloat(data.internet_bill_236_1d_gross_receipt || 0),
        taxCollected: parseFloat(data.internet_bill_236_1d_tax_collected || 0)
      },
      prepaidInternetCard236_1E: {
        grossReceipt: parseFloat(data.prepaid_internet_card_236_1e_gross_receipt || 0),
        taxCollected: parseFloat(data.prepaid_internet_card_236_1e_tax_collected || 0)
      },
      
      // Property Related
      saleTransferImmoveableProperty236C: {
        grossReceipt: parseFloat(data.sale_transfer_immoveable_property_236c_gross_receipt || 0),
        taxCollected: parseFloat(data.sale_transfer_immoveable_property_236c_tax_collected || 0)
      },
      taxDeducted236CPropertyPurchasedSoldSameYear: {
        grossReceipt: parseFloat(data.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt || 0),
        taxCollected: parseFloat(data.tax_deducted_236c_property_purchased_sold_same_year_tax_collected || 0)
      },
      taxDeducted236CPropertyPurchasedPriorYear: {
        grossReceipt: parseFloat(data.tax_deducted_236c_property_purchased_prior_year_gross_receipt || 0),
        taxCollected: parseFloat(data.tax_deducted_236c_property_purchased_prior_year_tax_collected || 0)
      },
      purchaseTransferImmoveableProperty236K: {
        grossReceipt: parseFloat(data.purchase_transfer_immoveable_property_236k_gross_receipt || 0),
        taxCollected: parseFloat(data.purchase_transfer_immoveable_property_236k_tax_collected || 0)
      },
      
      // Events and Services
      functionsGatheringsCharges236CB: {
        grossReceipt: parseFloat(data.functions_gatherings_charges_236cb_gross_receipt || 0),
        taxCollected: parseFloat(data.functions_gatherings_charges_236cb_tax_collected || 0)
      },
      withholdingTaxSaleConsiderations37E: {
        grossReceipt: parseFloat(data.withholding_tax_sale_considerations_37e_gross_receipt || 0),
        taxCollected: parseFloat(data.withholding_tax_sale_considerations_37e_tax_collected || 0)
      },
      
      // Financial and International
      advanceFund23APartISecondSchedule: {
        grossReceipt: parseFloat(data.advance_fund_23a_part_i_second_schedule_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_fund_23a_part_i_second_schedule_tax_collected || 0)
      },
      advanceTaxWithdrawalPensionFund23A: {
        grossReceipt: parseFloat(data.advance_tax_withdrawal_pension_fund_23a_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_withdrawal_pension_fund_23a_tax_collected || 0)
      },
      personsRemittingAmountAbroad236V: {
        grossReceipt: parseFloat(data.persons_remitting_amount_abroad_236v_gross_receipt || 0),
        taxCollected: parseFloat(data.persons_remitting_amount_abroad_236v_tax_collected || 0)
      },
      advanceTaxForeignDomesticWorkers231C: {
        grossReceipt: parseFloat(data.advance_tax_foreign_domestic_workers_231c_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_foreign_domestic_workers_231c_tax_collected || 0)
      },
      
      // Totals (flat field for cross-form consumption)
      total_adjustable_tax: totalTaxCollected,
      totals: {
        totalGrossReceipt: totalGrossReceipt,
        totalAdjustableTax: totalTaxCollected
      },
      
      isComplete: true
    };

    const success = await saveFormStep('adjustable_tax', structuredData, true);
    if (success) {
      toast.success('Adjustable tax information saved successfully');
      navigate('/income-tax/reductions');
    }
  };

  // Helper to sync uncontrolled input values to React Hook Form before saving
  const syncInputsToForm = async () => {
    // Force blur on active input to sync its value
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      document.activeElement.blur();
    }
    // Wait for blur handler to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  const onSaveAndContinue = async () => {
    // Sync any active input values before saving
    await syncInputsToForm();

    const data = getValues();
    const { totalGrossReceipt, totalTaxCollected } = computeAdjustableTotals(data, fieldGroups);

    // Structure the data to match backend API expectations
    const structuredData = {
      // Employment and Salary
      salaryEmployees149: {
        grossReceipt: parseFloat(data.salary_employees_149_gross_receipt || 0),
        taxCollected: parseFloat(data.salary_employees_149_tax_collected || 0)
      },
      directorshipFee149_3: {
        grossReceipt: parseFloat(data.directorship_fee_149_3_gross_receipt || 0),
        taxCollected: parseFloat(data.directorship_fee_149_3_tax_collected || 0)
      },
      
      // Profit on Debt
      profitDebt151_15: {
        grossReceipt: parseFloat(data.profit_debt_151_15_gross_receipt || 0),
        taxCollected: parseFloat(data.profit_debt_151_15_tax_collected || 0)
      },
      profitDebtSukook151A: {
        grossReceipt: parseFloat(data.profit_debt_sukook_151a_gross_receipt || 0),
        taxCollected: parseFloat(data.profit_debt_sukook_151a_tax_collected || 0)
      },
      taxDeductedRentSection155: {
        grossReceipt: parseFloat(data.tax_deducted_rent_section_155_gross_receipt || 0),
        taxCollected: parseFloat(data.tax_deducted_rent_section_155_tax_collected || 0)
      },
      
      // Banking
      advanceTaxCashWithdrawal231AB: {
        grossReceipt: parseFloat(data.advance_tax_cash_withdrawal_231ab_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_cash_withdrawal_231ab_tax_collected || 0)
      },
      
      // Motor Vehicle Related
      motorVehicleRegistrationFee231B1: {
        grossReceipt: parseFloat(data.motor_vehicle_registration_fee_231b1_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_registration_fee_231b1_tax_collected || 0)
      },
      motorVehicleTransferFee231B2: {
        grossReceipt: parseFloat(data.motor_vehicle_transfer_fee_231b2_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_transfer_fee_231b2_tax_collected || 0)
      },
      motorVehicleSale231B3: {
        grossReceipt: parseFloat(data.motor_vehicle_sale_231b3_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_sale_231b3_tax_collected || 0)
      },
      motorVehicleLeasing231B1A: {
        grossReceipt: parseFloat(data.motor_vehicle_leasing_231b1a_gross_receipt || 0),
        taxCollected: parseFloat(data.motor_vehicle_leasing_231b1a_tax_collected || 0)
      },
      advanceTaxMotorVehicle231B2A: {
        grossReceipt: parseFloat(data.advance_tax_motor_vehicle_231b2a_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_motor_vehicle_231b2a_tax_collected || 0)
      },
      
      // Utility Bills
      electricityBillDomestic235: {
        grossReceipt: parseFloat(data.electricity_bill_domestic_235_gross_receipt || 0),
        taxCollected: parseFloat(data.electricity_bill_domestic_235_tax_collected || 0)
      },
      telephoneBill236_1E: {
        grossReceipt: parseFloat(data.telephone_bill_236_1e_gross_receipt || 0),
        taxCollected: parseFloat(data.telephone_bill_236_1e_tax_collected || 0)
      },
      cellphoneBill236_1F: {
        grossReceipt: parseFloat(data.cellphone_bill_236_1f_gross_receipt || 0),
        taxCollected: parseFloat(data.cellphone_bill_236_1f_tax_collected || 0)
      },
      prepaidTelephoneCard236_1B: {
        grossReceipt: parseFloat(data.prepaid_telephone_card_236_1b_gross_receipt || 0),
        taxCollected: parseFloat(data.prepaid_telephone_card_236_1b_tax_collected || 0)
      },
      phoneUnit236_1C: {
        grossReceipt: parseFloat(data.phone_unit_236_1c_gross_receipt || 0),
        taxCollected: parseFloat(data.phone_unit_236_1c_tax_collected || 0)
      },
      internetBill236_1D: {
        grossReceipt: parseFloat(data.internet_bill_236_1d_gross_receipt || 0),
        taxCollected: parseFloat(data.internet_bill_236_1d_tax_collected || 0)
      },
      prepaidInternetCard236_1E: {
        grossReceipt: parseFloat(data.prepaid_internet_card_236_1e_gross_receipt || 0),
        taxCollected: parseFloat(data.prepaid_internet_card_236_1e_tax_collected || 0)
      },
      
      // Property Related
      saleTransferImmoveableProperty236C: {
        grossReceipt: parseFloat(data.sale_transfer_immoveable_property_236c_gross_receipt || 0),
        taxCollected: parseFloat(data.sale_transfer_immoveable_property_236c_tax_collected || 0)
      },
      taxDeducted236CPropertyPurchasedSoldSameYear: {
        grossReceipt: parseFloat(data.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt || 0),
        taxCollected: parseFloat(data.tax_deducted_236c_property_purchased_sold_same_year_tax_collected || 0)
      },
      taxDeducted236CPropertyPurchasedPriorYear: {
        grossReceipt: parseFloat(data.tax_deducted_236c_property_purchased_prior_year_gross_receipt || 0),
        taxCollected: parseFloat(data.tax_deducted_236c_property_purchased_prior_year_tax_collected || 0)
      },
      purchaseTransferImmoveableProperty236K: {
        grossReceipt: parseFloat(data.purchase_transfer_immoveable_property_236k_gross_receipt || 0),
        taxCollected: parseFloat(data.purchase_transfer_immoveable_property_236k_tax_collected || 0)
      },
      
      // Events and Services
      functionsGatheringsCharges236CB: {
        grossReceipt: parseFloat(data.functions_gatherings_charges_236cb_gross_receipt || 0),
        taxCollected: parseFloat(data.functions_gatherings_charges_236cb_tax_collected || 0)
      },
      withholdingTaxSaleConsiderations37E: {
        grossReceipt: parseFloat(data.withholding_tax_sale_considerations_37e_gross_receipt || 0),
        taxCollected: parseFloat(data.withholding_tax_sale_considerations_37e_tax_collected || 0)
      },
      
      // Financial and International
      advanceFund23APartISecondSchedule: {
        grossReceipt: parseFloat(data.advance_fund_23a_part_i_second_schedule_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_fund_23a_part_i_second_schedule_tax_collected || 0)
      },
      advanceTaxWithdrawalPensionFund23A: {
        grossReceipt: parseFloat(data.advance_tax_withdrawal_pension_fund_23a_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_withdrawal_pension_fund_23a_tax_collected || 0)
      },
      personsRemittingAmountAbroad236V: {
        grossReceipt: parseFloat(data.persons_remitting_amount_abroad_236v_gross_receipt || 0),
        taxCollected: parseFloat(data.persons_remitting_amount_abroad_236v_tax_collected || 0)
      },
      advanceTaxForeignDomesticWorkers231C: {
        grossReceipt: parseFloat(data.advance_tax_foreign_domestic_workers_231c_gross_receipt || 0),
        taxCollected: parseFloat(data.advance_tax_foreign_domestic_workers_231c_tax_collected || 0)
      },
      
      // Totals (flat field for cross-form consumption)
      total_adjustable_tax: totalTaxCollected,
      totals: {
        totalGrossReceipt: totalGrossReceipt,
        totalAdjustableTax: totalTaxCollected
      },
      
      isComplete: false
    };

    const success = await saveFormStep('adjustable_tax', structuredData, false);
    if (success) {
      // Reload saved data from context (updated by saveFormStep with response data)
      const freshData = getStepData('adjustable_tax');
      if (freshData && Object.keys(freshData).length > 0) {
        Object.keys(freshData).forEach(key => {
          if (freshData[key] !== undefined && freshData[key] !== null) {
            setValue(key, freshData[key]);
          }
        });
        setRefreshKey(prev => prev + 1);
      }
    }
  };
  // Format number with comma delimiters (no currency symbol)
  const formatNumber = (value) => {
    if (!value && value !== 0) return '';
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Parse formatted number back to raw value
  const parseFormattedNumber = (value) => {
    if (!value) return 0;
    // Remove commas and parse
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Handle input focus - select all text for easy editing
  const handleNumberFocus = (fieldName, event) => {
    event.target.select();
  };

  // Handle input change - sanitize value AND push the parsed number into RHF
  // immediately so `watch()` stays current. Used to only commit on blur, but
  // submit can fire before blur (programmatic fills, autosave), leaving stale
  // values in the payload.
  const handleNumberInput = (fieldName, event) => {
    const rawValue = event.target.value;
    const cleaned = rawValue.replace(/,/g, '');
    const sanitized = cleaned.replace(/[^\d.-]/g, '');

    if (sanitized !== rawValue) {
      event.target.value = sanitized;
    }
    const numericValue = parseFormattedNumber(sanitized);
    setValue(fieldName, numericValue);
  };

  // Handle input blur - parse value and update React Hook Form, then format for display
  const handleNumberBlur = (fieldName, event) => {
    const rawValue = event.target.value;
    const numericValue = parseFormattedNumber(rawValue);

    setValue(fieldName, numericValue);

    const formatted = formatNumber(numericValue);
    event.target.value = formatted;
  };

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const headerActions = (
    <button
      type="button"
      onClick={() => setShowHelp((v) => !v)}
      aria-label="Toggle help"
      aria-expanded={showHelp}
      aria-controls="adj-help"
      className="grid h-9 w-9 place-items-center rounded-brand text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
    >
      <Info size={18} aria-hidden="true" />
    </button>
  );

  const helpPanel = showHelp ? (
    <div id="adj-help">
      <h3 className="font-display text-sm font-bold text-navy dark:text-[#e7eaf3]">About this form</h3>
      <ul className="mt-1 space-y-1 font-body text-sm text-slate-600 dark:text-[#aab2cc]">
        <li>Covers every Pakistani withholding-tax category from your certificates.</li>
        <li>Enter amounts exactly as shown on your certificates.</li>
        <li><strong className="text-navy dark:text-[#e7eaf3]">Amount on certificate</strong> is the gross value; <strong className="text-navy dark:text-[#e7eaf3]">tax collected</strong> is the WHT deducted.</li>
        <li>Auto-fetched rows pull from your Income form; auto-calculated tax is editable.</li>
        <li>These amounts are adjusted against your final tax liability.</li>
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
      {/* Headless: per-field auto-calc (gross × WHT rate) via useWatch. */}
      <AdjustableAutoCalc
        control={control}
        setValue={setValue}
        rates={rates}
        whtRate={whtRate}
        isLoadingFromDB={isLoadingFromDB}
      />

      <TaxFormShell
        title="Adjustable tax"
        subtitle="Withholding tax from your certificates"
        icon={Calculator}
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

        {/* Column headers (desktop) */}
        <div className="hidden grid-cols-[1fr_150px_150px] gap-4 px-1 md:grid">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Description</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Amount on certificate</span>
          <span className="text-right font-body text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7e88a6]">Tax collected</span>
        </div>

        {/* Dynamic sections — filtered by income-profile addons via shared/formFieldVisibility.js. */}
        {Object.entries(fieldGroups)
          .map(([key, group]) => ({ key, group, fields: group.fields.filter((f) => visibleFields.has(f.taxField)) }))
          .filter((g) => g.fields.length > 0)
          .map(({ key, group, fields }) => (
            <CollapsibleSection
              key={key}
              title={group.title}
              icon={group.icon}
              open={!!expandedSections[key]}
              onToggle={() => toggleSection(key)}
            >
              {fields.map((field) => {
                const grossVal = getValues(field.grossField);
                const isAutoFetched = field.autoFetch && grossVal > 0;
                const autoRate = field.autoCalculateTax ? resolveFieldRate(field, getValues(field.atlStatusField)) : null;
                return (
                  <div key={field.key} className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[1fr_150px_150px] md:items-start md:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-start gap-1.5">
                        <span className="font-body text-sm leading-snug text-slate-700 dark:text-[#aab2cc]">{field.label}</span>
                        <HelpHint fieldId={field.key} source={adjustableTaxHelp} />
                      </div>
                      {field.atlStatusField && (
                        <div className="mt-2">
                          <label htmlFor={field.atlStatusField} className="mb-1 block font-body text-xs font-medium text-slate-500 dark:text-[#7e88a6]">Filer status</label>
                          <select
                            id={field.atlStatusField}
                            key={`${field.atlStatusField}-${refreshKey}`}
                            {...register(field.atlStatusField)}
                            defaultValue={getValues(field.atlStatusField) || 'ATL'}
                            className="rounded-brand border-[1.5px] border-slate-300 bg-white px-2.5 py-1.5 font-body text-xs font-semibold text-navy focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15 dark:border-[#2a3450] dark:bg-[#151c30] dark:text-[#e7eaf3]"
                          >
                            <option value="ATL">Filer (ATL) — 10%</option>
                            <option value="NONATL">Non-filer — 20%</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Amount on certificate</span>
                      <input
                        id={field.grossField}
                        key={`${field.grossField}-${refreshKey}`}
                        type="text"
                        inputMode="numeric"
                        aria-label={`${field.label} — amount on certificate`}
                        aria-invalid={errors[field.grossField] ? true : undefined}
                        placeholder="0"
                        readOnly={isAutoFetched}
                        defaultValue={formatNumber(getValues(field.grossField))}
                        onFocus={(e) => handleNumberFocus(field.grossField, e)}
                        onChange={(e) => handleNumberInput(field.grossField, e)}
                        onBlur={(e) => handleNumberBlur(field.grossField, e)}
                        className={`w-full rounded-brand border-[1.5px] border-slate-300 px-3 py-2 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15 dark:border-[#2a3450] dark:text-[#e7eaf3] ${isAutoFetched ? 'cursor-default bg-slate-100 text-slate-500 dark:bg-[#1a2238] dark:text-[#7e88a6]' : 'bg-white dark:bg-[#151c30]'}`}
                      />
                      {isAutoFetched && <p className="mt-1 text-right font-body text-xs text-slate-400 dark:text-[#7e88a6]">From Income form</p>}
                      {errors[field.grossField] && <p role="alert" className="mt-1 text-right font-body text-xs text-red-600 dark:text-red-300">{errors[field.grossField].message}</p>}
                    </div>

                    <div>
                      <span className="mb-1 block font-body text-xs font-medium text-slate-400 dark:text-[#7e88a6] md:hidden">Tax collected</span>
                      <div className="relative">
                        <input
                          id={field.taxField}
                          key={`${field.taxField}-${refreshKey}`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`${field.label} — tax collected`}
                          aria-invalid={errors[field.taxField] ? true : undefined}
                          placeholder="0"
                          defaultValue={formatNumber(getValues(field.taxField))}
                          onFocus={(e) => handleNumberFocus(field.taxField, e)}
                          onChange={(e) => handleNumberInput(field.taxField, e)}
                          onBlur={(e) => handleNumberBlur(field.taxField, e)}
                          className={`w-full rounded-brand border-[1.5px] border-slate-300 bg-white py-2 text-right font-body text-sm font-semibold tabular-nums text-navy transition-colors focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15 dark:border-[#2a3450] dark:bg-[#151c30] dark:text-[#e7eaf3] ${field.autoCalculateTax ? 'pl-3 pr-9' : 'px-3'}`}
                        />
                        {field.autoCalculateTax && (
                          <button
                            type="button"
                            aria-label="Reset to auto-calculated value"
                            title="Reset to auto-calculated value"
                            onClick={() => {
                              const gross = parseFloat(getValues(field.grossField)) || 0;
                              const rate = resolveFieldRate(field, getValues(field.atlStatusField));
                              setValue(field.taxField, Math.round(gross * rate));
                              setRefreshKey((k) => k + 1);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-navy/50 transition-colors hover:text-navy"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {field.autoCalculateTax && autoRate != null && (
                        <p className="mt-1 text-right font-body text-xs text-slate-400 dark:text-[#7e88a6]">Auto-calculated @ {(autoRate * 100).toFixed(2).replace(/\.?0+$/, '')}% — editable</p>
                      )}
                      {errors[field.taxField] && <p role="alert" className="mt-1 text-right font-body text-xs text-red-600 dark:text-red-300">{errors[field.taxField].message}</p>}
                    </div>
                  </div>
                );
              })}
            </CollapsibleSection>
          ))}

        {/* Advanced-fields toggle — count is the number of EXTRA rows it reveals. */}
        {(() => {
          const withAdv = visibleFieldsFor('adjustable_tax_forms', addons, { advanced: true });
          const baseRows = Object.values(fieldGroups).reduce((sum, g) => sum + g.fields.filter((f) => visibleFields.has(f.taxField)).length, 0);
          const advRows = Object.values(fieldGroups).reduce((sum, g) => sum + g.fields.filter((f) => withAdv.has(f.taxField)).length, 0);
          const extra = advRows - baseRows;
          if (extra <= 0) return null;
          return (
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-brand border-[1.5px] border-navy/20 bg-navy/[0.03] px-4 py-3 font-body text-sm font-semibold text-navy transition-colors hover:bg-navy/[0.06] focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15 dark:border-[#2a3450] dark:bg-white/5 dark:text-[#e7eaf3] dark:hover:bg-white/10"
            >
              {showAdvanced
                ? (<><ChevronDown size={16} aria-hidden="true" /> Hide advanced fields</>)
                : (<><Plus size={16} aria-hidden="true" /> Show {extra} more advanced WHT item{extra === 1 ? '' : 's'}</>)}
            </button>
          );
        })()}

        {/* Totals — navy card; tax collected shown as a lime credit. */}
        <AdjustableTotals control={control} fieldGroups={fieldGroups} />
      </TaxFormShell>
    </form>
  );
};

export default AdjustableTaxForm;