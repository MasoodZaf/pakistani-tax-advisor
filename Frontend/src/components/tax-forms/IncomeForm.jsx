import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  salary: '',
  bonus: '',
  commission: '',
  medical_allowance: '',
  conveyance_allowance: '',
  company_car_benefit: '',
  rent_allowance: '',
  utilities_allowance: '',
  special_allowance: '',
  other_allowances: '',
  tax_deducted_salary: '',
  tax_deducted_bonus: '',
  tax_deducted_commission: '',
  tax_deducted_other: '',
  employer_id: '', // Foreign key to organizations table
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  salary: Yup.number()
    .required('Salary is required')
    .min(0, 'Salary cannot be negative'),
  bonus: Yup.number()
    .min(0, 'Bonus cannot be negative'),
  commission: Yup.number()
    .min(0, 'Commission cannot be negative'),
  medical_allowance: Yup.number()
    .min(0, 'Medical allowance cannot be negative'),
  conveyance_allowance: Yup.number()
    .min(0, 'Conveyance allowance cannot be negative'),
  company_car_benefit: Yup.number()
    .min(0, 'Company car benefit cannot be negative'),
  rent_allowance: Yup.number()
    .min(0, 'Rent allowance cannot be negative'),
  utilities_allowance: Yup.number()
    .min(0, 'Utilities allowance cannot be negative'),
  special_allowance: Yup.number()
    .min(0, 'Special allowance cannot be negative'),
  other_allowances: Yup.number()
    .min(0, 'Other allowances cannot be negative'),
  tax_deducted_salary: Yup.number()
    .min(0, 'Tax deducted cannot be negative'),
  tax_deducted_bonus: Yup.number()
    .min(0, 'Tax deducted cannot be negative'),
  tax_deducted_commission: Yup.number()
    .min(0, 'Tax deducted cannot be negative'),
  tax_deducted_other: Yup.number()
    .min(0, 'Tax deducted cannot be negative'),
  employer_id: Yup.string()
    .required('Employer information is required'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  { name: 'salary', label: 'Basic Salary', type: 'number', section: 'Basic Income' },
  { name: 'bonus', label: 'Bonus', type: 'number', section: 'Basic Income' },
  { name: 'commission', label: 'Commission', type: 'number', section: 'Basic Income' },
  { name: 'medical_allowance', label: 'Medical Allowance', type: 'number', section: 'Allowances' },
  { name: 'conveyance_allowance', label: 'Conveyance Allowance', type: 'number', section: 'Allowances' },
  { name: 'company_car_benefit', label: 'Company Car Benefit', type: 'number', section: 'Allowances' },
  { name: 'rent_allowance', label: 'Rent Allowance', type: 'number', section: 'Allowances' },
  { name: 'utilities_allowance', label: 'Utilities Allowance', type: 'number', section: 'Allowances' },
  { name: 'special_allowance', label: 'Special Allowance', type: 'number', section: 'Allowances' },
  { name: 'other_allowances', label: 'Other Allowances', type: 'number', section: 'Allowances' },
  { name: 'tax_deducted_salary', label: 'Tax Deducted from Salary', type: 'number', section: 'Tax Deductions' },
  { name: 'tax_deducted_bonus', label: 'Tax Deducted from Bonus', type: 'number', section: 'Tax Deductions' },
  { name: 'tax_deducted_commission', label: 'Tax Deducted from Commission', type: 'number', section: 'Tax Deductions' },
  { name: 'tax_deducted_other', label: 'Other Tax Deductions', type: 'number', section: 'Tax Deductions' },
  { name: 'employer_id', label: 'Employer', type: 'select', section: 'Additional Information' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select', section: 'Additional Information' },
];

const IncomeForm = ({ formId }) => {
  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      formFields={formFields}
      title="Income Details"
      formType="income"
      formId={formId}
    />
  );
};

export default IncomeForm; 