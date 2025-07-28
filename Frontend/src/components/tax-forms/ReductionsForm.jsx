import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  teacher_allowance: '',
  researcher_allowance: '',
  flying_allowance: '',
  medical_teaching_allowance: '',
  special_risk_allowance: '',
  junior_commodity_allowance: '',
  behbood_certificates_profit: '',
  pensioner_benefit_account: '',
  special_saving_certificates: '',
  reduction_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  teacher_allowance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  researcher_allowance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  flying_allowance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  medical_teaching_allowance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  special_risk_allowance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  junior_commodity_allowance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  behbood_certificates_profit: Yup.number()
    .min(0, 'Amount cannot be negative'),
  pensioner_benefit_account: Yup.number()
    .min(0, 'Amount cannot be negative'),
  special_saving_certificates: Yup.number()
    .min(0, 'Amount cannot be negative'),
  reduction_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  { name: 'teacher_allowance', label: 'Teacher Allowance', type: 'number' },
  { name: 'researcher_allowance', label: 'Researcher Allowance', type: 'number' },
  { name: 'flying_allowance', label: 'Flying Allowance', type: 'number' },
  { name: 'medical_teaching_allowance', label: 'Medical Teaching Allowance', type: 'number' },
  { name: 'special_risk_allowance', label: 'Special Risk Allowance', type: 'number' },
  { name: 'junior_commodity_allowance', label: 'Junior Commodity Allowance', type: 'number' },
  { name: 'behbood_certificates_profit', label: 'Behbood Certificates Profit', type: 'number' },
  { name: 'pensioner_benefit_account', label: 'Pensioner Benefit Account', type: 'number' },
  { name: 'special_saving_certificates', label: 'Special Saving Certificates', type: 'number' },
  { name: 'reduction_description', label: 'Additional Notes', type: 'textarea' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select' },
];

const ReductionsForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save reductions form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving reductions form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Tax Reductions"
    />
  );
};

export default ReductionsForm; 