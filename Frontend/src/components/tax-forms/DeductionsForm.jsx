import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  zakat_paid: '',
  zakat_receipt_number: '',
  workers_welfare_fund: '',
  workers_participation_fund: '',
  property_tax_paid: '',
  property_tax_receipt: '',
  motor_vehicle_tax: '',
  vehicle_registration_number: '',
  education_fees_children: '',
  education_institution_name: '',
  medical_expenses: '',
  medical_receipt_numbers: '',
  deduction_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  zakat_paid: Yup.number()
    .min(0, 'Amount cannot be negative'),
  zakat_receipt_number: Yup.string()
    .when('zakat_paid', {
      is: value => value > 0,
      then: Yup.string().required('Receipt number required when zakat is entered')
    }),
  workers_welfare_fund: Yup.number()
    .min(0, 'Amount cannot be negative'),
  workers_participation_fund: Yup.number()
    .min(0, 'Amount cannot be negative'),
  property_tax_paid: Yup.number()
    .min(0, 'Amount cannot be negative'),
  property_tax_receipt: Yup.string()
    .when('property_tax_paid', {
      is: value => value > 0,
      then: Yup.string().required('Receipt number required when property tax is entered')
    }),
  motor_vehicle_tax: Yup.number()
    .min(0, 'Amount cannot be negative'),
  vehicle_registration_number: Yup.string()
    .when('motor_vehicle_tax', {
      is: value => value > 0,
      then: Yup.string().required('Registration number required when vehicle tax is entered')
    }),
  education_fees_children: Yup.number()
    .min(0, 'Amount cannot be negative'),
  education_institution_name: Yup.string()
    .when('education_fees_children', {
      is: value => value > 0,
      then: Yup.string().required('Institution name required when education fees are entered')
    }),
  medical_expenses: Yup.number()
    .min(0, 'Amount cannot be negative'),
  medical_receipt_numbers: Yup.string()
    .when('medical_expenses', {
      is: value => value > 0,
      then: Yup.string().required('Receipt numbers required when medical expenses are entered')
    }),
  deduction_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  { name: 'zakat_paid', label: 'Zakat Paid', type: 'number' },
  { name: 'zakat_receipt_number', label: 'Zakat Receipt Number', type: 'text' },
  { name: 'workers_welfare_fund', label: 'Workers Welfare Fund', type: 'number' },
  { name: 'workers_participation_fund', label: 'Workers Participation Fund', type: 'number' },
  { name: 'property_tax_paid', label: 'Property Tax Paid', type: 'number' },
  { name: 'property_tax_receipt', label: 'Property Tax Receipt', type: 'text' },
  { name: 'motor_vehicle_tax', label: 'Motor Vehicle Tax', type: 'number' },
  { name: 'vehicle_registration_number', label: 'Vehicle Registration Number', type: 'text' },
  { name: 'education_fees_children', label: 'Education Fees (Children)', type: 'number' },
  { name: 'education_institution_name', label: 'Education Institution Name', type: 'text' },
  { name: 'medical_expenses', label: 'Medical Expenses', type: 'number' },
  { name: 'medical_receipt_numbers', label: 'Medical Receipt Numbers', type: 'text' },
  { name: 'deduction_description', label: 'Additional Notes', type: 'textarea' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select' },
];

const DeductionsForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save deductions form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving deductions form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Tax Deductions"
    />
  );
};

export default DeductionsForm; 