import React from 'react';
import * as Yup from 'yup';
import BaseForm from './BaseForm';

const initialValues = {
  sukuk_profit: '',
  sukuk_certificate_number: '',
  government_securities: '',
  securities_account_number: '',
  term_finance_certificates: '',
  tfc_details: '',
  government_bonds: '',
  bond_details: '',
  prize_bonds: '',
  prize_bond_numbers: '',
  foreign_remittance: '',
  remittance_details: '',
  final_tax_description: '',
  tax_year_id: '', // Foreign key to tax_years table
};

const validationSchema = Yup.object({
  sukuk_profit: Yup.number()
    .min(0, 'Amount cannot be negative'),
  sukuk_certificate_number: Yup.string()
    .when('sukuk_profit', {
      is: value => value > 0,
      then: Yup.string().required('Certificate number required when profit is entered')
    }),
  government_securities: Yup.number()
    .min(0, 'Amount cannot be negative'),
  securities_account_number: Yup.string()
    .when('government_securities', {
      is: value => value > 0,
      then: Yup.string().required('Account number required when securities amount is entered')
    }),
  term_finance_certificates: Yup.number()
    .min(0, 'Amount cannot be negative'),
  tfc_details: Yup.string()
    .when('term_finance_certificates', {
      is: value => value > 0,
      then: Yup.string().required('TFC details required when amount is entered')
    }),
  government_bonds: Yup.number()
    .min(0, 'Amount cannot be negative'),
  bond_details: Yup.string()
    .when('government_bonds', {
      is: value => value > 0,
      then: Yup.string().required('Bond details required when amount is entered')
    }),
  prize_bonds: Yup.number()
    .min(0, 'Amount cannot be negative'),
  prize_bond_numbers: Yup.string()
    .when('prize_bonds', {
      is: value => value > 0,
      then: Yup.string().required('Bond numbers required when amount is entered')
    }),
  foreign_remittance: Yup.number()
    .min(0, 'Amount cannot be negative'),
  remittance_details: Yup.string()
    .when('foreign_remittance', {
      is: value => value > 0,
      then: Yup.string().required('Remittance details required when amount is entered')
    }),
  final_tax_description: Yup.string()
    .max(500, 'Description too long'),
  tax_year_id: Yup.string()
    .required('Tax year is required'),
});

const formFields = [
  { name: 'sukuk_profit', label: 'Sukuk Profit', type: 'number' },
  { name: 'sukuk_certificate_number', label: 'Sukuk Certificate Number', type: 'text' },
  { name: 'government_securities', label: 'Government Securities', type: 'number' },
  { name: 'securities_account_number', label: 'Securities Account Number', type: 'text' },
  { name: 'term_finance_certificates', label: 'Term Finance Certificates', type: 'number' },
  { name: 'tfc_details', label: 'TFC Details', type: 'textarea' },
  { name: 'government_bonds', label: 'Government Bonds', type: 'number' },
  { name: 'bond_details', label: 'Bond Details', type: 'textarea' },
  { name: 'prize_bonds', label: 'Prize Bonds', type: 'number' },
  { name: 'prize_bond_numbers', label: 'Prize Bond Numbers', type: 'textarea' },
  { name: 'foreign_remittance', label: 'Foreign Remittance', type: 'number' },
  { name: 'remittance_details', label: 'Remittance Details', type: 'textarea' },
  { name: 'final_tax_description', label: 'Additional Notes', type: 'textarea' },
  { name: 'tax_year_id', label: 'Tax Year', type: 'select' },
];

const FinalTaxForm = () => {
  const handleSubmit = async (values) => {
    try {
      // TODO: Implement API call to save final tax form data
      console.log('Form values:', values);
    } catch (error) {
      console.error('Error saving final tax form:', error);
      throw error;
    }
  };

  return (
    <BaseForm
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      formFields={formFields}
      title="Final Tax Details"
    />
  );
};

export default FinalTaxForm; 