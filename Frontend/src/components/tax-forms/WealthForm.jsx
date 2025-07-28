import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  // Properties
  residential_property_value: '',
  residential_property_address: '',
  commercial_property_value: '',
  commercial_property_address: '',
  agricultural_land_value: '',
  agricultural_land_location: '',
  
  // Bank Accounts
  bank_accounts_balance: '',
  bank_account_details: '',
  foreign_bank_balance: '',
  foreign_bank_details: '',
  
  // Investments
  shares_value: '',
  shares_details: '',
  mutual_funds_value: '',
  mutual_funds_details: '',
  bonds_securities_value: '',
  bonds_securities_details: '',
  prize_bonds_value: '',
  prize_bonds_numbers: '',
  
  // Business Assets
  business_capital: '',
  business_details: '',
  business_inventory: '',
  inventory_details: '',
  machinery_equipment: '',
  machinery_details: '',
  
  // Vehicles
  motor_vehicles_value: '',
  vehicle_registration_numbers: '',
  other_vehicles_value: '',
  other_vehicles_details: '',
  
  // Personal Assets
  jewelry_value: '',
  jewelry_details: '',
  furniture_value: '',
  furniture_details: '',
  other_assets_value: '',
  other_assets_details: '',
  
  // Liabilities
  bank_loans: '',
  loan_details: '',
  credit_card_debt: '',
  credit_card_details: '',
  personal_loans: '',
  personal_loans_details: '',
  mortgage_loans: '',
  mortgage_details: '',
  other_liabilities: '',
  other_liabilities_details: '',
  
  wealth_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  // Properties
  residential_property_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  residential_property_address: Yup.string()
    .when('residential_property_value', {
      is: value => value > 0,
      then: Yup.string().required('Address required when property value is entered')
    }),
  commercial_property_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  commercial_property_address: Yup.string()
    .when('commercial_property_value', {
      is: value => value > 0,
      then: Yup.string().required('Address required when property value is entered')
    }),
  agricultural_land_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  agricultural_land_location: Yup.string()
    .when('agricultural_land_value', {
      is: value => value > 0,
      then: Yup.string().required('Location required when land value is entered')
    }),
  
  // Bank Accounts
  bank_accounts_balance: Yup.number()
    .min(0, 'Value cannot be negative'),
  bank_account_details: Yup.string()
    .when('bank_accounts_balance', {
      is: value => value > 0,
      then: Yup.string().required('Account details required when balance is entered')
    }),
  foreign_bank_balance: Yup.number()
    .min(0, 'Value cannot be negative'),
  foreign_bank_details: Yup.string()
    .when('foreign_bank_balance', {
      is: value => value > 0,
      then: Yup.string().required('Bank details required when balance is entered')
    }),
  
  // Investments
  shares_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  shares_details: Yup.string()
    .when('shares_value', {
      is: value => value > 0,
      then: Yup.string().required('Share details required when value is entered')
    }),
  mutual_funds_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  mutual_funds_details: Yup.string()
    .when('mutual_funds_value', {
      is: value => value > 0,
      then: Yup.string().required('Fund details required when value is entered')
    }),
  bonds_securities_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  bonds_securities_details: Yup.string()
    .when('bonds_securities_value', {
      is: value => value > 0,
      then: Yup.string().required('Securities details required when value is entered')
    }),
  prize_bonds_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  prize_bonds_numbers: Yup.string()
    .when('prize_bonds_value', {
      is: value => value > 0,
      then: Yup.string().required('Bond numbers required when value is entered')
    }),
  
  // Business Assets
  business_capital: Yup.number()
    .min(0, 'Value cannot be negative'),
  business_details: Yup.string()
    .when('business_capital', {
      is: value => value > 0,
      then: Yup.string().required('Business details required when capital is entered')
    }),
  business_inventory: Yup.number()
    .min(0, 'Value cannot be negative'),
  inventory_details: Yup.string()
    .when('business_inventory', {
      is: value => value > 0,
      then: Yup.string().required('Inventory details required when value is entered')
    }),
  machinery_equipment: Yup.number()
    .min(0, 'Value cannot be negative'),
  machinery_details: Yup.string()
    .when('machinery_equipment', {
      is: value => value > 0,
      then: Yup.string().required('Equipment details required when value is entered')
    }),
  
  // Vehicles
  motor_vehicles_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  vehicle_registration_numbers: Yup.string()
    .when('motor_vehicles_value', {
      is: value => value > 0,
      then: Yup.string().required('Registration numbers required when value is entered')
    }),
  other_vehicles_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  other_vehicles_details: Yup.string()
    .when('other_vehicles_value', {
      is: value => value > 0,
      then: Yup.string().required('Vehicle details required when value is entered')
    }),
  
  // Personal Assets
  jewelry_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  jewelry_details: Yup.string()
    .when('jewelry_value', {
      is: value => value > 0,
      then: Yup.string().required('Jewelry details required when value is entered')
    }),
  furniture_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  furniture_details: Yup.string()
    .when('furniture_value', {
      is: value => value > 0,
      then: Yup.string().required('Furniture details required when value is entered')
    }),
  other_assets_value: Yup.number()
    .min(0, 'Value cannot be negative'),
  other_assets_details: Yup.string()
    .when('other_assets_value', {
      is: value => value > 0,
      then: Yup.string().required('Asset details required when value is entered')
    }),
  
  // Liabilities
  bank_loans: Yup.number()
    .min(0, 'Value cannot be negative'),
  loan_details: Yup.string()
    .when('bank_loans', {
      is: value => value > 0,
      then: Yup.string().required('Loan details required when value is entered')
    }),
  credit_card_debt: Yup.number()
    .min(0, 'Value cannot be negative'),
  credit_card_details: Yup.string()
    .when('credit_card_debt', {
      is: value => value > 0,
      then: Yup.string().required('Credit card details required when debt is entered')
    }),
  personal_loans: Yup.number()
    .min(0, 'Value cannot be negative'),
  personal_loans_details: Yup.string()
    .when('personal_loans', {
      is: value => value > 0,
      then: Yup.string().required('Loan details required when value is entered')
    }),
  mortgage_loans: Yup.number()
    .min(0, 'Value cannot be negative'),
  mortgage_details: Yup.string()
    .when('mortgage_loans', {
      is: value => value > 0,
      then: Yup.string().required('Mortgage details required when value is entered')
    }),
  other_liabilities: Yup.number()
    .min(0, 'Value cannot be negative'),
  other_liabilities_details: Yup.string()
    .when('other_liabilities', {
      is: value => value > 0,
      then: Yup.string().required('Liability details required when value is entered')
    }),
  
  wealth_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  // Properties
  { name: 'residential_property_value', label: 'Residential Property Value', type: 'number', section: 'Properties' },
  { name: 'residential_property_address', label: 'Residential Property Address', type: 'textarea', section: 'Properties' },
  { name: 'commercial_property_value', label: 'Commercial Property Value', type: 'number', section: 'Properties' },
  { name: 'commercial_property_address', label: 'Commercial Property Address', type: 'textarea', section: 'Properties' },
  { name: 'agricultural_land_value', label: 'Agricultural Land Value', type: 'number', section: 'Properties' },
  { name: 'agricultural_land_location', label: 'Agricultural Land Location', type: 'textarea', section: 'Properties' },
  
  // Bank Accounts
  { name: 'bank_accounts_balance', label: 'Bank Accounts Balance', type: 'number', section: 'Bank Accounts' },
  { name: 'bank_account_details', label: 'Bank Account Details', type: 'textarea', section: 'Bank Accounts' },
  { name: 'foreign_bank_balance', label: 'Foreign Bank Balance', type: 'number', section: 'Bank Accounts' },
  { name: 'foreign_bank_details', label: 'Foreign Bank Details', type: 'textarea', section: 'Bank Accounts' },
  
  // Investments
  { name: 'shares_value', label: 'Shares Value', type: 'number', section: 'Investments' },
  { name: 'shares_details', label: 'Shares Details', type: 'textarea', section: 'Investments' },
  { name: 'mutual_funds_value', label: 'Mutual Funds Value', type: 'number', section: 'Investments' },
  { name: 'mutual_funds_details', label: 'Mutual Funds Details', type: 'textarea', section: 'Investments' },
  { name: 'bonds_securities_value', label: 'Bonds & Securities Value', type: 'number', section: 'Investments' },
  { name: 'bonds_securities_details', label: 'Bonds & Securities Details', type: 'textarea', section: 'Investments' },
  { name: 'prize_bonds_value', label: 'Prize Bonds Value', type: 'number', section: 'Investments' },
  { name: 'prize_bonds_numbers', label: 'Prize Bonds Numbers', type: 'textarea', section: 'Investments' },
  
  // Business Assets
  { name: 'business_capital', label: 'Business Capital', type: 'number', section: 'Business Assets' },
  { name: 'business_details', label: 'Business Details', type: 'textarea', section: 'Business Assets' },
  { name: 'business_inventory', label: 'Business Inventory', type: 'number', section: 'Business Assets' },
  { name: 'inventory_details', label: 'Inventory Details', type: 'textarea', section: 'Business Assets' },
  { name: 'machinery_equipment', label: 'Machinery & Equipment', type: 'number', section: 'Business Assets' },
  { name: 'machinery_details', label: 'Machinery Details', type: 'textarea', section: 'Business Assets' },
  
  // Vehicles
  { name: 'motor_vehicles_value', label: 'Motor Vehicles Value', type: 'number', section: 'Vehicles' },
  { name: 'vehicle_registration_numbers', label: 'Vehicle Registration Numbers', type: 'textarea', section: 'Vehicles' },
  { name: 'other_vehicles_value', label: 'Other Vehicles Value', type: 'number', section: 'Vehicles' },
  { name: 'other_vehicles_details', label: 'Other Vehicles Details', type: 'textarea', section: 'Vehicles' },
  
  // Personal Assets
  { name: 'jewelry_value', label: 'Jewelry Value', type: 'number', section: 'Personal Assets' },
  { name: 'jewelry_details', label: 'Jewelry Details', type: 'textarea', section: 'Personal Assets' },
  { name: 'furniture_value', label: 'Furniture Value', type: 'number', section: 'Personal Assets' },
  { name: 'furniture_details', label: 'Furniture Details', type: 'textarea', section: 'Personal Assets' },
  { name: 'other_assets_value', label: 'Other Assets Value', type: 'number', section: 'Personal Assets' },
  { name: 'other_assets_details', label: 'Other Assets Details', type: 'textarea', section: 'Personal Assets' },
  
  // Liabilities
  { name: 'bank_loans', label: 'Bank Loans', type: 'number', section: 'Liabilities' },
  { name: 'loan_details', label: 'Loan Details', type: 'textarea', section: 'Liabilities' },
  { name: 'credit_card_debt', label: 'Credit Card Debt', type: 'number', section: 'Liabilities' },
  { name: 'credit_card_details', label: 'Credit Card Details', type: 'textarea', section: 'Liabilities' },
  { name: 'personal_loans', label: 'Personal Loans', type: 'number', section: 'Liabilities' },
  { name: 'personal_loans_details', label: 'Personal Loans Details', type: 'textarea', section: 'Liabilities' },
  { name: 'mortgage_loans', label: 'Mortgage Loans', type: 'number', section: 'Liabilities' },
  { name: 'mortgage_details', label: 'Mortgage Details', type: 'textarea', section: 'Liabilities' },
  { name: 'other_liabilities', label: 'Other Liabilities', type: 'number', section: 'Liabilities' },
  { name: 'other_liabilities_details', label: 'Other Liabilities Details', type: 'textarea', section: 'Liabilities' },
  
  // Additional Information
  { name: 'wealth_description', label: 'Additional Notes', type: 'textarea', section: 'Additional Information' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select', section: 'Additional Information' },
];

const WealthForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save wealth form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving wealth form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Wealth Statement"
    />
  );
};

export default WealthForm; 