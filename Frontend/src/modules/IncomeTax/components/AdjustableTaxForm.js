/* eslint-disable react-hooks/exhaustive-deps -- auto-calc effects intentionally watch specific field values; adding watchedValues/whtRate to deps would cause re-render loops */
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { useTaxRates } from '../../../hooks/useTaxRates';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowRight,
  ArrowLeft,
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
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePriorYearData } from '../../../hooks/usePriorYearData';
import HelpHint from '../../../components/Help/HelpHint';
import adjustableTaxHelp from '../../../help/adjustableTaxHelp';
import { formatCurrency } from '../../../utils/currency';


const AdjustableTaxForm = () => {
  const navigate = useNavigate();
  const {
    saveFormStep,
    getStepData,
    formData,
    saving
  } = useTaxForm();
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
    watch,
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
  const { hasPriorData: hasPriorAdjustable, applyPriorYear: applyPriorAdjustable, dismissPriorYear: dismissPriorAdjustable } = usePriorYearData('adjustable_tax', setValue);

  // Watch all values for auto-calculation
  const watchedValues = watch();

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

  // Calculate totals
  const calculateTotals = () => {
    let totalGrossReceipt = 0;
    let totalTaxCollected = 0;

    Object.values(fieldGroups).forEach(group => {
      group.fields.forEach(field => {
        const grossValue = parseFloat(watchedValues[field.grossField]) || 0;
        const taxValue = parseFloat(watchedValues[field.taxField]) || 0;
        totalGrossReceipt += grossValue;
        totalTaxCollected += taxValue;
      });
    });

    return { totalGrossReceipt, totalTaxCollected };
  };

  const { totalGrossReceipt, totalTaxCollected } = calculateTotals();

  const onSubmit = async (data) => {
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

  const getColorClasses = (color) => {
    const colorMap = {
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', icon: 'text-green-600' },
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: 'text-blue-600' },
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', icon: 'text-yellow-600' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', icon: 'text-purple-600' },
      indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', icon: 'text-indigo-600' },
      cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-600', icon: 'text-cyan-600' },
      red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: 'text-red-600' },
      pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600', icon: 'text-pink-600' },
      teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-600', icon: 'text-teal-600' }
    };
    return colorMap[color] || colorMap.blue;
  };

  const inputClasses = "form-input w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right text-sm";

  const SectionComponent = ({ groupKey, group }) => {
    const colors = getColorClasses(group.color);
    const IconComponent = group.icon;
    const isExpanded = expandedSections[groupKey];

    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg mb-4`}>
        <div 
          className="p-4 cursor-pointer"
          onClick={() => toggleSection(groupKey)}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${colors.text} flex items-center`}>
              <IconComponent className={`w-5 h-5 mr-2 ${colors.icon}`} />
              {group.title}
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
              {group.fields.map((field) => (
                <div key={field.key} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-6">
                    <label className="text-sm font-medium text-gray-700">
                      {field.label}
                      <HelpHint fieldId={field.key} source={adjustableTaxHelp} />
                      {field.autoFetch && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          Auto-fetched
                        </span>
                      )}
                    </label>
                    {field.atlStatusField && (
                      <div className="mt-1">
                        <label className="text-xs text-gray-600 mr-2">
                          ATL Status
                          <HelpHint fieldId="functions_gatherings_charges_236cb_atl_status" source={adjustableTaxHelp} />
                        </label>
                        <select
                          key={`${field.atlStatusField}-${refreshKey}`}
                          {...register(field.atlStatusField)}
                          defaultValue={watchedValues[field.atlStatusField] || 'ATL'}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="ATL">ATL (Active Tax List) — 10%</option>
                          <option value="NONATL">Non-ATL — 20%</option>
                        </select>
                      </div>
                    )}
                    {field.remark && (
                      <p className="text-xs text-gray-500 mt-1">{field.remark}</p>
                    )}
                  </div>
                  <div className="col-span-3">
                    <input
                      key={`${field.grossField}-${refreshKey}`}
                      type="text"
                      inputMode="numeric"
                      className={`${inputClasses} ${field.autoFetch && watchedValues[field.grossField] > 0 ? 'bg-blue-50 border-blue-300' : ''}`}
                      placeholder="0"
                      readOnly={field.autoFetch && watchedValues[field.grossField] > 0}
                      defaultValue={formatNumber(watchedValues[field.grossField])}
                      onFocus={(e) => handleNumberFocus(field.grossField, e)}
                      onChange={(e) => handleNumberInput(field.grossField, e)}
                      onBlur={(e) => handleNumberBlur(field.grossField, e)}
                    />
                    {field.autoFetch && watchedValues[field.grossField] > 0 && (
                      <p className="mt-1 text-xs text-blue-600">Auto-fetched from Income form</p>
                    )}
                    {errors[field.grossField] && (
                      <p className="mt-1 text-xs text-red-600">{errors[field.grossField].message}</p>
                    )}
                  </div>
                  <div className="col-span-3">
                    <div className="relative">
                      <input
                        key={`${field.taxField}-${refreshKey}`}
                        type="text"
                        inputMode="numeric"
                        className={`${inputClasses} ${field.autoCalculateTax ? 'bg-purple-50 border-purple-300 pr-8' : ''}`}
                        placeholder="0"
                        defaultValue={formatNumber(watchedValues[field.taxField])}
                        onFocus={(e) => handleNumberFocus(field.taxField, e)}
                        onChange={(e) => handleNumberInput(field.taxField, e)}
                        onBlur={(e) => handleNumberBlur(field.taxField, e)}
                      />
                      {field.autoCalculateTax && (
                        <button
                          type="button"
                          title="Reset to auto-calculated value"
                          onClick={() => {
                            const gross = parseFloat(watchedValues[field.grossField]) || 0;
                            const rate = resolveFieldRate(field, watchedValues[field.atlStatusField]);
                            setValue(field.taxField, Math.round(gross * rate));
                            setRefreshKey(k => k + 1);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-700 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {field.autoCalculateTax && (
                      <p className="mt-1 text-xs text-purple-600">
                        {(() => {
                          const r = resolveFieldRate(field, watchedValues[field.atlStatusField]);
                          return `Auto-calc @ ${(r * 100).toFixed(2).replace(/\.?0+$/, '')}% — editable`;
                        })()}
                      </p>
                    )}
                    {errors[field.taxField] && (
                      <p className="mt-1 text-xs text-red-600">{errors[field.taxField].message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Adjustable Tax</h1>
              <p className="text-gray-600">Enter comprehensive withholding tax details as per certificates</p>
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
            <h3 className="font-medium text-blue-900 mb-2">Comprehensive Adjustable Tax Help</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• This form covers all 27+ Pakistani withholding tax categories from your certificates</li>
              <li>• Enter amounts exactly as shown in your withholding tax certificates</li>
              <li>• Each section corresponds to specific Pakistani tax law provisions</li>
              <li>• Gross Receipt: Total amount of transaction before tax</li>
              <li>• Tax Collected: Actual withholding tax amount deducted</li>
              <li>• Auto-fetched fields are linked to Income sheet data</li>
              <li>• Input cells require manual entry from your withholding certificates</li>
              <li>• These amounts will be adjusted against your final tax liability</li>
            </ul>
          </div>
        )}
      </div>

      {/* Prior Year Pre-fill Banner */}
      {hasPriorAdjustable && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm text-indigo-800">Prior year WHT data available — apply to pre-fill this form?</span>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={dismissPriorAdjustable} className="text-xs px-3 py-1.5 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100">Dismiss</button>
            <button type="button" onClick={applyPriorAdjustable} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">Apply Prior Year Data</button>
          </div>
        </div>
      )}

      <form onSubmit={async (e) => {
        e.preventDefault();
        await syncInputsToForm();
        handleSubmit(onSubmit)(e);
      }} className="space-y-6">
        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-3 items-center py-3 mb-4 bg-gray-800 text-white rounded-lg px-4">
          <div className="col-span-6">
            <h3 className="font-semibold">Description</h3>
          </div>
          <div className="col-span-3 text-center">
            <h3 className="font-semibold">Value as per Withholding Certificate</h3>
            <p className="text-sm opacity-75">Gross Receipt</p>
          </div>
          <div className="col-span-3 text-center">
            <h3 className="font-semibold">Tax Collected</h3>
          </div>
        </div>

        {/* Dynamic Sections - All 27 fields from Excel */}
        {Object.entries(fieldGroups).map(([key, group]) => (
          <SectionComponent 
            key={key} 
            groupKey={key} 
            group={group}
            register={register}
            errors={errors}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            getColorClasses={getColorClasses}
          />
        ))}

        {/* Totals Section */}
        <div className="bg-gray-800 text-white rounded-xl p-5">
          <h3 className="text-base font-semibold opacity-80 mb-3 uppercase tracking-wide">Summary Total</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-lg p-3 flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider opacity-60">Gross Receipt</span>
              <span
                className="font-bold leading-tight break-all"
                style={{ fontSize: 'clamp(0.85rem, 2.2vw, 1.5rem)' }}
              >
                {formatCurrency(totalGrossReceipt)}
              </span>
            </div>
            <div className="bg-purple-700 rounded-lg p-3 flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider opacity-70">Tax Collected</span>
              <span
                className="font-bold leading-tight break-all"
                style={{ fontSize: 'clamp(0.85rem, 2.2vw, 1.5rem)' }}
              >
                {formatCurrency(totalTaxCollected)}
              </span>
            </div>
          </div>
          <p className="text-xs opacity-60 text-center mt-3">Tax Collected will be adjusted against your final tax liability</p>
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

export default AdjustableTaxForm;