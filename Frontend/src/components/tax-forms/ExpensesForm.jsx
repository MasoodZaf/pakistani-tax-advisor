import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  rent_expense: '',
  rent_agreement_number: '',
  utilities_expense: '',
  utility_bills_reference: '',
  repair_maintenance: '',
  repair_bills_reference: '',
  vehicle_expense: '',
  vehicle_details: '',
  travel_expense: '',
  travel_details: '',
  meals_entertainment: '',
  meals_details: '',
  office_supplies: '',
  supplies_details: '',
  employee_salaries: '',
  employee_details: '',
  professional_fees: '',
  professional_details: '',
  marketing_expense: '',
  marketing_details: '',
  insurance_expense: '',
  insurance_policy_numbers: '',
  other_expenses: '',
  other_expenses_details: '',
  expense_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  rent_expense: Yup.number()
    .min(0, 'Amount cannot be negative'),
  rent_agreement_number: Yup.string()
    .when('rent_expense', {
      is: value => value > 0,
      then: Yup.string().required('Agreement number required when rent expense is entered')
    }),
  utilities_expense: Yup.number()
    .min(0, 'Amount cannot be negative'),
  utility_bills_reference: Yup.string()
    .when('utilities_expense', {
      is: value => value > 0,
      then: Yup.string().required('Bills reference required when utilities expense is entered')
    }),
  repair_maintenance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  repair_bills_reference: Yup.string()
    .when('repair_maintenance', {
      is: value => value > 0,
      then: Yup.string().required('Bills reference required when repair expense is entered')
    }),
  vehicle_expense: Yup.number()
    .min(0, 'Amount cannot be negative'),
  vehicle_details: Yup.string()
    .when('vehicle_expense', {
      is: value => value > 0,
      then: Yup.string().required('Vehicle details required when vehicle expense is entered')
    }),
  travel_expense: Yup.number()
    .min(0, 'Amount cannot be negative'),
  travel_details: Yup.string()
    .when('travel_expense', {
      is: value => value > 0,
      then: Yup.string().required('Travel details required when travel expense is entered')
    }),
  meals_entertainment: Yup.number()
    .min(0, 'Amount cannot be negative'),
  meals_details: Yup.string()
    .when('meals_entertainment', {
      is: value => value > 0,
      then: Yup.string().required('Details required when meals expense is entered')
    }),
  office_supplies: Yup.number()
    .min(0, 'Amount cannot be negative'),
  supplies_details: Yup.string()
    .when('office_supplies', {
      is: value => value > 0,
      then: Yup.string().required('Details required when supplies expense is entered')
    }),
  employee_salaries: Yup.number()
    .min(0, 'Amount cannot be negative'),
  employee_details: Yup.string()
    .when('employee_salaries', {
      is: value => value > 0,
      then: Yup.string().required('Employee details required when salary expense is entered')
    }),
  professional_fees: Yup.number()
    .min(0, 'Amount cannot be negative'),
  professional_details: Yup.string()
    .when('professional_fees', {
      is: value => value > 0,
      then: Yup.string().required('Details required when professional fees are entered')
    }),
  marketing_expense: Yup.number()
    .min(0, 'Amount cannot be negative'),
  marketing_details: Yup.string()
    .when('marketing_expense', {
      is: value => value > 0,
      then: Yup.string().required('Details required when marketing expense is entered')
    }),
  insurance_expense: Yup.number()
    .min(0, 'Amount cannot be negative'),
  insurance_policy_numbers: Yup.string()
    .when('insurance_expense', {
      is: value => value > 0,
      then: Yup.string().required('Policy numbers required when insurance expense is entered')
    }),
  other_expenses: Yup.number()
    .min(0, 'Amount cannot be negative'),
  other_expenses_details: Yup.string()
    .when('other_expenses', {
      is: value => value > 0,
      then: Yup.string().required('Details required when other expenses are entered')
    }),
  expense_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  // Rent and Utilities
  { name: 'rent_expense', label: 'Rent Expense', type: 'number', section: 'Rent and Utilities' },
  { name: 'rent_agreement_number', label: 'Rent Agreement Number', type: 'text', section: 'Rent and Utilities' },
  { name: 'utilities_expense', label: 'Utilities Expense', type: 'number', section: 'Rent and Utilities' },
  { name: 'utility_bills_reference', label: 'Utility Bills Reference', type: 'text', section: 'Rent and Utilities' },
  
  // Maintenance and Repairs
  { name: 'repair_maintenance', label: 'Repair & Maintenance', type: 'number', section: 'Maintenance' },
  { name: 'repair_bills_reference', label: 'Repair Bills Reference', type: 'text', section: 'Maintenance' },
  
  // Vehicle and Travel
  { name: 'vehicle_expense', label: 'Vehicle Expense', type: 'number', section: 'Travel' },
  { name: 'vehicle_details', label: 'Vehicle Details', type: 'textarea', section: 'Travel' },
  { name: 'travel_expense', label: 'Travel Expense', type: 'number', section: 'Travel' },
  { name: 'travel_details', label: 'Travel Details', type: 'textarea', section: 'Travel' },
  
  // Office and Supplies
  { name: 'meals_entertainment', label: 'Meals & Entertainment', type: 'number', section: 'Office Expenses' },
  { name: 'meals_details', label: 'Meals Details', type: 'textarea', section: 'Office Expenses' },
  { name: 'office_supplies', label: 'Office Supplies', type: 'number', section: 'Office Expenses' },
  { name: 'supplies_details', label: 'Supplies Details', type: 'textarea', section: 'Office Expenses' },
  
  // Employee and Professional
  { name: 'employee_salaries', label: 'Employee Salaries', type: 'number', section: 'Employee Expenses' },
  { name: 'employee_details', label: 'Employee Details', type: 'textarea', section: 'Employee Expenses' },
  { name: 'professional_fees', label: 'Professional Fees', type: 'number', section: 'Employee Expenses' },
  { name: 'professional_details', label: 'Professional Details', type: 'textarea', section: 'Employee Expenses' },
  
  // Marketing and Insurance
  { name: 'marketing_expense', label: 'Marketing Expense', type: 'number', section: 'Other Expenses' },
  { name: 'marketing_details', label: 'Marketing Details', type: 'textarea', section: 'Other Expenses' },
  { name: 'insurance_expense', label: 'Insurance Expense', type: 'number', section: 'Other Expenses' },
  { name: 'insurance_policy_numbers', label: 'Insurance Policy Numbers', type: 'text', section: 'Other Expenses' },
  { name: 'other_expenses', label: 'Other Expenses', type: 'number', section: 'Other Expenses' },
  { name: 'other_expenses_details', label: 'Other Expenses Details', type: 'textarea', section: 'Other Expenses' },
  
  // Additional Information
  { name: 'expense_description', label: 'Additional Notes', type: 'textarea', section: 'Additional Information' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select', section: 'Additional Information' },
];

const ExpensesForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save expenses form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving expenses form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Business Expenses"
    />
  );
};

export default ExpensesForm; 