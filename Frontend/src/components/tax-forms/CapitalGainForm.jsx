import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  property_sale_proceeds: '',
  property_purchase_cost: '',
  property_sale_date: '',
  property_purchase_date: '',
  property_address: '',
  shares_sale_proceeds: '',
  shares_purchase_cost: '',
  shares_sale_date: '',
  shares_purchase_date: '',
  company_name: '',
  mutual_funds_sale_proceeds: '',
  mutual_funds_purchase_cost: '',
  mutual_funds_sale_date: '',
  mutual_funds_purchase_date: '',
  fund_name: '',
  other_capital_gains: '',
  other_capital_description: '',
  capital_gain_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  property_sale_proceeds: Yup.number()
    .min(0, 'Amount cannot be negative'),
  property_purchase_cost: Yup.number()
    .min(0, 'Amount cannot be negative')
    .when('property_sale_proceeds', {
      is: value => value > 0,
      then: Yup.number().required('Purchase cost required when sale proceeds are entered')
    }),
  property_sale_date: Yup.date()
    .when('property_sale_proceeds', {
      is: value => value > 0,
      then: Yup.date().required('Sale date required when sale proceeds are entered')
    }),
  property_purchase_date: Yup.date()
    .when('property_sale_proceeds', {
      is: value => value > 0,
      then: Yup.date()
        .required('Purchase date required when sale proceeds are entered')
        .max(Yup.ref('property_sale_date'), 'Purchase date must be before sale date')
    }),
  property_address: Yup.string()
    .when('property_sale_proceeds', {
      is: value => value > 0,
      then: Yup.string().required('Property address required when sale proceeds are entered')
    }),
  shares_sale_proceeds: Yup.number()
    .min(0, 'Amount cannot be negative'),
  shares_purchase_cost: Yup.number()
    .min(0, 'Amount cannot be negative')
    .when('shares_sale_proceeds', {
      is: value => value > 0,
      then: Yup.number().required('Purchase cost required when sale proceeds are entered')
    }),
  shares_sale_date: Yup.date()
    .when('shares_sale_proceeds', {
      is: value => value > 0,
      then: Yup.date().required('Sale date required when sale proceeds are entered')
    }),
  shares_purchase_date: Yup.date()
    .when('shares_sale_proceeds', {
      is: value => value > 0,
      then: Yup.date()
        .required('Purchase date required when sale proceeds are entered')
        .max(Yup.ref('shares_sale_date'), 'Purchase date must be before sale date')
    }),
  company_name: Yup.string()
    .when('shares_sale_proceeds', {
      is: value => value > 0,
      then: Yup.string().required('Company name required when sale proceeds are entered')
    }),
  mutual_funds_sale_proceeds: Yup.number()
    .min(0, 'Amount cannot be negative'),
  mutual_funds_purchase_cost: Yup.number()
    .min(0, 'Amount cannot be negative')
    .when('mutual_funds_sale_proceeds', {
      is: value => value > 0,
      then: Yup.number().required('Purchase cost required when sale proceeds are entered')
    }),
  mutual_funds_sale_date: Yup.date()
    .when('mutual_funds_sale_proceeds', {
      is: value => value > 0,
      then: Yup.date().required('Sale date required when sale proceeds are entered')
    }),
  mutual_funds_purchase_date: Yup.date()
    .when('mutual_funds_sale_proceeds', {
      is: value => value > 0,
      then: Yup.date()
        .required('Purchase date required when sale proceeds are entered')
        .max(Yup.ref('mutual_funds_sale_date'), 'Purchase date must be before sale date')
    }),
  fund_name: Yup.string()
    .when('mutual_funds_sale_proceeds', {
      is: value => value > 0,
      then: Yup.string().required('Fund name required when sale proceeds are entered')
    }),
  other_capital_gains: Yup.number()
    .min(0, 'Amount cannot be negative'),
  other_capital_description: Yup.string()
    .when('other_capital_gains', {
      is: value => value > 0,
      then: Yup.string().required('Description required when other capital gains are entered')
    }),
  capital_gain_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  // Property Capital Gains
  { name: 'property_sale_proceeds', label: 'Property Sale Proceeds', type: 'number' },
  { name: 'property_purchase_cost', label: 'Property Purchase Cost', type: 'number' },
  { name: 'property_sale_date', label: 'Property Sale Date', type: 'date' },
  { name: 'property_purchase_date', label: 'Property Purchase Date', type: 'date' },
  { name: 'property_address', label: 'Property Address', type: 'textarea' },
  
  // Shares Capital Gains
  { name: 'shares_sale_proceeds', label: 'Shares Sale Proceeds', type: 'number' },
  { name: 'shares_purchase_cost', label: 'Shares Purchase Cost', type: 'number' },
  { name: 'shares_sale_date', label: 'Shares Sale Date', type: 'date' },
  { name: 'shares_purchase_date', label: 'Shares Purchase Date', type: 'date' },
  { name: 'company_name', label: 'Company Name', type: 'text' },
  
  // Mutual Funds Capital Gains
  { name: 'mutual_funds_sale_proceeds', label: 'Mutual Funds Sale Proceeds', type: 'number' },
  { name: 'mutual_funds_purchase_cost', label: 'Mutual Funds Purchase Cost', type: 'number' },
  { name: 'mutual_funds_sale_date', label: 'Mutual Funds Sale Date', type: 'date' },
  { name: 'mutual_funds_purchase_date', label: 'Mutual Funds Purchase Date', type: 'date' },
  { name: 'fund_name', label: 'Fund Name', type: 'text' },
  
  // Other Capital Gains
  { name: 'other_capital_gains', label: 'Other Capital Gains', type: 'number' },
  { name: 'other_capital_description', label: 'Other Capital Gains Description', type: 'textarea' },
  { name: 'capital_gain_description', label: 'Additional Notes', type: 'textarea' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select' },
];

const CapitalGainForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save capital gains form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving capital gains form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Capital Gains"
    />
  );
};

export default CapitalGainForm; 