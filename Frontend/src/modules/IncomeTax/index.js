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

const IncomeTaxModule = () => {
  return (
    <Routes>
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

      {/* Default route */}
      <Route index element={<Navigate to="income" replace />} />
      <Route path="*" element={<Navigate to="income" replace />} />
    </Routes>
  );
};

export default IncomeTaxModule;