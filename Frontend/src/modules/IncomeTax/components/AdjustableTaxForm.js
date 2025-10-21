import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTaxForm } from '../../../contexts/TaxFormContext';
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
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';


const AdjustableTaxForm = () => {
  const navigate = useNavigate();
  const { 
    saveFormStep, 
    getStepData, 
    saving 
  } = useTaxForm();
  
  const [showHelp, setShowHelp] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [editingFields, setEditingFields] = useState({}); // Track raw values during editing
  const [refreshKey, setRefreshKey] = useState(0); // Used to force re-render after data refresh
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors }
  } = useForm({
    defaultValues: getStepData('adjustable_tax')
  });

  // Watch all values for auto-calculation
  const watchedValues = watch();

  // Auto-populate fields linked to income sheet
  useEffect(() => {
    // Get income form data for auto-fetch fields
    const incomeData = getStepData('income') || {};

    console.log('=== ADJUSTABLE TAX AUTO-FETCH DEBUG ===');
    console.log('Income data loaded:', incomeData);
    console.log('annual_salary_wages_total:', incomeData.annual_salary_wages_total);
    console.log('total_employment_income:', incomeData.total_employment_income);
    console.log('directorship_fee:', incomeData.directorship_fee);

    // Only proceed if we have income data
    if (!incomeData || Object.keys(incomeData).length === 0) {
      console.log('Auto-fetch: No income data available yet');
      return;
    }

    const autoFetchMappings = {
      // Map income form fields to adjustable tax fields
      // Salary u/s 149 = Annual Salary and Wages Total (as shown in withholding certificate)
      'salary_employees_149_gross_receipt': incomeData.annual_salary_wages_total || 0,
      'directorship_fee_149_3_gross_receipt': incomeData.directorship_fee || 0,
      'profit_debt_151_15_gross_receipt': incomeData.profit_on_debt_15_percent || 0,
      'profit_debt_sukook_151a_gross_receipt': incomeData.profit_on_debt_12_5_percent || 0,
      'tax_deducted_rent_section_155_gross_receipt': incomeData.other_taxable_income_rent || 0
    };

    console.log('Mappings to apply:', autoFetchMappings);

    // Auto-populate fields with values from income form
    Object.entries(autoFetchMappings).forEach(([fieldName, value]) => {
      if (value && value > 0) {
        console.log(`Setting ${fieldName} = ${value}`);
        setValue(fieldName, value);
      } else {
        console.log(`Skipping ${fieldName} - value is ${value}`);
      }
    });
    console.log('=== END AUTO-FETCH DEBUG ===');
  }, [getStepData, setValue]);

  // Auto-calculate tax for Directorship Fee at 20%
  useEffect(() => {
    const directorshipGross = watchedValues['directorship_fee_149_3_gross_receipt'];
    if (directorshipGross && directorshipGross > 0) {
      const calculatedTax = directorshipGross * 0.20;
      const currentTaxValue = watchedValues['directorship_fee_149_3_tax_collected'];

      // Only update if the value has changed to avoid infinite loops
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Directorship Fee tax: ${directorshipGross} × 20% = ${calculatedTax}`);
        setValue('directorship_fee_149_3_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['directorship_fee_149_3_gross_receipt'], setValue]);

  // Auto-calculate tax for Motor Vehicle Leasing at 4%
  useEffect(() => {
    const motorVehicleLeasingGross = watchedValues['motor_vehicle_leasing_231b1a_gross_receipt'];
    if (motorVehicleLeasingGross && motorVehicleLeasingGross > 0) {
      const calculatedTax = Math.round(motorVehicleLeasingGross * 0.04);
      const currentTaxValue = watchedValues['motor_vehicle_leasing_231b1a_tax_collected'];

      // Only update if the value has changed to avoid infinite loops
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Motor Vehicle Leasing tax: ${motorVehicleLeasingGross} × 4% = ${calculatedTax}`);
        setValue('motor_vehicle_leasing_231b1a_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['motor_vehicle_leasing_231b1a_gross_receipt'], setValue]);

  // Auto-calculate tax for Telephone Bill at 15%
  useEffect(() => {
    const gross = watchedValues['telephone_bill_236_1e_gross_receipt'];
    if (gross && gross > 0) {
      const calculatedTax = Math.round(gross * 0.15);
      const currentTaxValue = watchedValues['telephone_bill_236_1e_tax_collected'];
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Telephone Bill tax: ${gross} × 15% = ${calculatedTax}`);
        setValue('telephone_bill_236_1e_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['telephone_bill_236_1e_gross_receipt'], setValue]);

  // Auto-calculate tax for Cellphone Bill at 15%
  useEffect(() => {
    const gross = watchedValues['cellphone_bill_236_1f_gross_receipt'];
    if (gross && gross > 0) {
      const calculatedTax = Math.round(gross * 0.15);
      const currentTaxValue = watchedValues['cellphone_bill_236_1f_tax_collected'];
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Cellphone Bill tax: ${gross} × 15% = ${calculatedTax}`);
        setValue('cellphone_bill_236_1f_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['cellphone_bill_236_1f_gross_receipt'], setValue]);

  // Auto-calculate tax for Prepaid Telephone Card at 15%
  useEffect(() => {
    const gross = watchedValues['prepaid_telephone_card_236_1b_gross_receipt'];
    if (gross && gross > 0) {
      const calculatedTax = Math.round(gross * 0.15);
      const currentTaxValue = watchedValues['prepaid_telephone_card_236_1b_tax_collected'];
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Prepaid Telephone Card tax: ${gross} × 15% = ${calculatedTax}`);
        setValue('prepaid_telephone_card_236_1b_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['prepaid_telephone_card_236_1b_gross_receipt'], setValue]);

  // Auto-calculate tax for Phone Unit at 15%
  useEffect(() => {
    const gross = watchedValues['phone_unit_236_1c_gross_receipt'];
    if (gross && gross > 0) {
      const calculatedTax = Math.round(gross * 0.15);
      const currentTaxValue = watchedValues['phone_unit_236_1c_tax_collected'];
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Phone Unit tax: ${gross} × 15% = ${calculatedTax}`);
        setValue('phone_unit_236_1c_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['phone_unit_236_1c_gross_receipt'], setValue]);

  // Auto-calculate tax for Internet Bill at 15%
  useEffect(() => {
    const gross = watchedValues['internet_bill_236_1d_gross_receipt'];
    if (gross && gross > 0) {
      const calculatedTax = Math.round(gross * 0.15);
      const currentTaxValue = watchedValues['internet_bill_236_1d_tax_collected'];
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Internet Bill tax: ${gross} × 15% = ${calculatedTax}`);
        setValue('internet_bill_236_1d_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['internet_bill_236_1d_gross_receipt'], setValue]);

  // Auto-calculate tax for Prepaid Internet Card at 15%
  useEffect(() => {
    const gross = watchedValues['prepaid_internet_card_236_1e_gross_receipt'];
    if (gross && gross > 0) {
      const calculatedTax = Math.round(gross * 0.15);
      const currentTaxValue = watchedValues['prepaid_internet_card_236_1e_tax_collected'];
      if (Math.abs((currentTaxValue || 0) - calculatedTax) > 0.01) {
        console.log(`Auto-calculating Prepaid Internet Card tax: ${gross} × 15% = ${calculatedTax}`);
        setValue('prepaid_internet_card_236_1e_tax_collected', calculatedTax);
      }
    }
  }, [watchedValues['prepaid_internet_card_236_1e_gross_receipt'], setValue]);

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
          label: 'Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)',
          grossField: 'profit_debt_151_15_gross_receipt',
          taxField: 'profit_debt_151_15_tax_collected',
          autoFetch: true,
          remark: 'Gross receipt linked with Income sheet and tax collected is Input cell'
        },
        {
          key: 'profit_debt_sukook_151a',
          label: 'Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)',
          grossField: 'profit_debt_sukook_151a_gross_receipt',
          taxField: 'profit_debt_sukook_151a_tax_collected',
          autoFetch: true,
          remark: 'Gross receipt linked with Income sheet and tax collected is Input cell'
        },
        {
          key: 'tax_deducted_rent_section_155',
          label: 'Tax deducted on Rent received (Section 155)',
          grossField: 'tax_deducted_rent_section_155_gross_receipt',
          taxField: 'tax_deducted_rent_section_155_tax_collected',
          autoFetch: true,
          remark: 'Gross receipt linked with Income sheet and tax collected is Input cell'
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
          label: 'Motor Vehicle Transfer Fee u/s 231B(2)',
          grossField: 'motor_vehicle_transfer_fee_231b2_gross_receipt',
          taxField: 'motor_vehicle_transfer_fee_231b2_tax_collected',
          remark: 'Input cell'
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
          label: 'Electricity Bill of Domestic Consumer u/s 235',
          grossField: 'electricity_bill_domestic_235_gross_receipt',
          taxField: 'electricity_bill_domestic_235_tax_collected',
          remark: 'Input cell'
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
          label: 'Functions / Gatherings Charges u/s 236CB (ATL @ 10% / Non-ATL @ 20%)',
          grossField: 'functions_gatherings_charges_236cb_gross_receipt',
          taxField: 'functions_gatherings_charges_236cb_tax_collected',
          remark: 'Input cell'
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
      
      // Totals
      totals: {
        totalGrossReceipt: totalGrossReceipt,
        totalAdjustableTax: totalTaxCollected
      },
      
      isComplete: true
    };

    const success = await saveFormStep('adjustable_tax', structuredData, true);
    if (success) {
      toast.success('Adjustable tax information saved successfully');
      navigate('/tax-forms/reductions');
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

    // DEBUG: Log what we're getting from the form
    console.log('=== SAVE DEBUG ===');
    console.log('Raw getValues():', data);
    console.log('Salary Tax Collected:', data.salary_employees_149_tax_collected);
    console.log('Directorship Tax Collected:', data.directorship_fee_149_3_tax_collected);
    console.log('watchedValues:', watchedValues);

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
      
      // Totals
      totals: {
        totalGrossReceipt: totalGrossReceipt,
        totalAdjustableTax: totalTaxCollected
      },
      
      isComplete: false
    };

    const success = await saveFormStep('adjustable_tax', structuredData, false);
    if (success) {
      toast.success('Data saved successfully');

      // Reload the data from backend to get updated calculations
      const freshData = await getStepData('adjustable_tax');
      if (freshData) {
        console.log('Fresh data loaded from backend:', freshData);

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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
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
    console.log(`Focus on ${fieldName}`);
    // Select all text so user can immediately start typing to replace
    event.target.select();
  };

  // Debug handler to check if keyboard events are captured
  const handleKeyDown = (fieldName, event) => {
    console.log(`KeyDown on ${fieldName}, key:`, event.key);
  };

  // Handle input change - just sanitize the value, don't update React Hook Form yet
  const handleNumberInput = (fieldName, event) => {
    const rawValue = event.target.value;
    // Remove commas and allow only numbers and decimal point
    const cleaned = rawValue.replace(/,/g, '');
    const sanitized = cleaned.replace(/[^\d.-]/g, '');
    console.log(`Input on ${fieldName}:`, rawValue, '→', sanitized);

    // Update the input value if we sanitized it
    if (sanitized !== rawValue) {
      event.target.value = sanitized;
    }

    // DON'T call setValue here - wait for blur to avoid re-renders
  };

  // Handle input blur - parse value and update React Hook Form, then format for display
  const handleNumberBlur = (fieldName, event) => {
    const rawValue = event.target.value;
    // Parse the raw value
    const numericValue = parseFormattedNumber(rawValue);
    console.log(`Blur on ${fieldName}, raw:`, rawValue, '→ numeric:', numericValue);

    // Update React Hook Form
    setValue(fieldName, numericValue);

    // Format for display
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
                      {field.autoFetch && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                          Auto-fetched
                        </span>
                      )}
                    </label>
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
                      onKeyDown={(e) => handleKeyDown(field.grossField, e)}
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
                    <input
                      key={`${field.taxField}-${refreshKey}`}
                      type="text"
                      inputMode="numeric"
                      className={`${inputClasses} ${field.autoCalculateTax ? 'bg-purple-50 border-purple-300' : ''}`}
                      placeholder="0"
                      readOnly={field.autoCalculateTax}
                      defaultValue={formatNumber(watchedValues[field.taxField])}
                      onFocus={(e) => handleNumberFocus(field.taxField, e)}
                      onKeyDown={(e) => handleKeyDown(field.taxField, e)}
                      onChange={(e) => handleNumberInput(field.taxField, e)}
                      onBlur={(e) => handleNumberBlur(field.taxField, e)}
                    />
                    {field.autoCalculateTax && watchedValues[field.taxField] > 0 && (
                      <p className="mt-1 text-xs text-purple-600">Auto-calculated at {(field.taxRate * 100)}%</p>
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
        <div className="bg-gray-800 text-white rounded-lg p-6">
          <div className="grid grid-cols-12 gap-3 items-center">
            <div className="col-span-6">
              <h3 className="text-xl font-bold">Total</h3>
            </div>
            <div className="col-span-3 text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(totalGrossReceipt)}
              </p>
            </div>
            <div className="col-span-3 text-right">
              <p className="text-2xl font-bold">
                {formatCurrency(totalTaxCollected)}
              </p>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm opacity-75">This amount will be adjusted against your final tax liability</p>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/tax-forms/income')}
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