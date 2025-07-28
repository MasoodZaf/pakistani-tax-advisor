import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  advance_tax: '',
  quarterly_payment_1: '',
  quarterly_payment_2: '',
  quarterly_payment_3: '',
  quarterly_payment_4: '',
  adjustment_amount: '',
  adjustment_type: '', // 'credit' or 'debit'
  adjustment_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  advance_tax: Yup.number()
    .min(0, 'Advance tax cannot be negative'),
  quarterly_payment_1: Yup.number()
    .min(0, 'Payment cannot be negative'),
  quarterly_payment_2: Yup.number()
    .min(0, 'Payment cannot be negative'),
  quarterly_payment_3: Yup.number()
    .min(0, 'Payment cannot be negative'),
  quarterly_payment_4: Yup.number()
    .min(0, 'Payment cannot be negative'),
  adjustment_amount: Yup.number()
    .min(0, 'Adjustment amount cannot be negative'),
  adjustment_type: Yup.string()
    .oneOf(['credit', 'debit'], 'Invalid adjustment type')
    .required('Adjustment type is required'),
  adjustment_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  { name: 'advance_tax', label: 'Advance Tax', type: 'number' },
  { name: 'quarterly_payment_1', label: '1st Quarter Payment', type: 'number' },
  { name: 'quarterly_payment_2', label: '2nd Quarter Payment', type: 'number' },
  { name: 'quarterly_payment_3', label: '3rd Quarter Payment', type: 'number' },
  { name: 'quarterly_payment_4', label: '4th Quarter Payment', type: 'number' },
  { name: 'adjustment_amount', label: 'Adjustment Amount', type: 'number' },
  { 
    name: 'adjustment_type', 
    label: 'Adjustment Type', 
    type: 'select',
    options: [
      { value: 'credit', label: 'Credit' },
      { value: 'debit', label: 'Debit' },
    ]
  },
  { name: 'adjustment_description', label: 'Adjustment Description', type: 'textarea' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select' },
];

const AdjustableTaxForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save adjustable tax form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving adjustable tax form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Adjustable Tax Details"
    />
  );
};

export default AdjustableTaxForm; 