import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  charitable_donations: '',
  donation_organization_name: '',
  donation_receipt_number: '',
  health_insurance_premium: '',
  educational_insurance_premium: '',
  pension_fund_contribution: '',
  additional_voluntary_pension: '',
  shares_mutual_funds_premium: '',
  approved_pension_fund: '',
  credit_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  charitable_donations: Yup.number()
    .min(0, 'Amount cannot be negative')
    .max(Yup.ref('total_taxable_income'), 'Cannot exceed 30% of total taxable income'),
  donation_organization_name: Yup.string()
    .when('charitable_donations', {
      is: value => value > 0,
      then: Yup.string().required('Organization name required when donation is entered')
    }),
  donation_receipt_number: Yup.string()
    .when('charitable_donations', {
      is: value => value > 0,
      then: Yup.string().required('Receipt number required when donation is entered')
    }),
  health_insurance_premium: Yup.number()
    .min(0, 'Amount cannot be negative'),
  educational_insurance_premium: Yup.number()
    .min(0, 'Amount cannot be negative'),
  pension_fund_contribution: Yup.number()
    .min(0, 'Amount cannot be negative')
    .max(500000, 'Cannot exceed PKR 500,000'),
  additional_voluntary_pension: Yup.number()
    .min(0, 'Amount cannot be negative')
    .max(100000, 'Cannot exceed PKR 100,000'),
  shares_mutual_funds_premium: Yup.number()
    .min(0, 'Amount cannot be negative'),
  approved_pension_fund: Yup.number()
    .min(0, 'Amount cannot be negative'),
  credit_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  { name: 'charitable_donations', label: 'Charitable Donations', type: 'number' },
  { name: 'donation_organization_name', label: 'Organization Name', type: 'text' },
  { name: 'donation_receipt_number', label: 'Receipt Number', type: 'text' },
  { name: 'health_insurance_premium', label: 'Health Insurance Premium', type: 'number' },
  { name: 'educational_insurance_premium', label: 'Educational Insurance Premium', type: 'number' },
  { name: 'pension_fund_contribution', label: 'Pension Fund Contribution', type: 'number' },
  { name: 'additional_voluntary_pension', label: 'Additional Voluntary Pension', type: 'number' },
  { name: 'shares_mutual_funds_premium', label: 'Shares/Mutual Funds Premium', type: 'number' },
  { name: 'approved_pension_fund', label: 'Approved Pension Fund', type: 'number' },
  { name: 'credit_description', label: 'Additional Notes', type: 'textarea' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select' },
];

const CreditsForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save credits form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving credits form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Tax Credits"
    />
  );
};

export default CreditsForm; 