import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import IncomeForm from './components/IncomeForm';
import AdjustableTaxForm from './components/AdjustableTaxForm';
import FinalMinIncomeForm from './components/FinalMinIncomeForm';
import CapitalGainsForm from './components/CapitalGainsForm';
import ReductionsForm from './components/ReductionsForm';
import CreditsForm from './components/CreditsForm';
import DeductionsForm from './components/DeductionsForm';
import FinalTaxForm from './components/FinalTaxForm';
import ExpensesForm from './components/ExpensesForm';
import TaxComputationSummary from './components/TaxComputationSummary';
import FormDeck from '../../components/TaxForms/FormDeck';

const IncomeTaxModule = () => {
  return (
    <Routes>
      <Route
        index
        element={
          <FormDeck
            scope="income-tax"
            title="Tax Return Sections"
            subtitle="All Income Tax forms — including the Tax Computation Summary."
          />
        }
      />
      <Route path="income" element={<IncomeForm />} />
      <Route path="adjustable-tax" element={<AdjustableTaxForm />} />
      <Route path="final-min-income" element={<FinalMinIncomeForm />} />
      <Route path="capital-gains" element={<CapitalGainsForm />} />
      <Route path="reductions" element={<ReductionsForm />} />
      <Route path="credits" element={<CreditsForm />} />
      <Route path="deductions" element={<DeductionsForm />} />
      <Route path="final-tax" element={<FinalTaxForm />} />
      <Route path="expenses" element={<ExpensesForm />} />
      <Route path="tax-computation" element={<TaxComputationSummary />} />

      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default IncomeTaxModule;