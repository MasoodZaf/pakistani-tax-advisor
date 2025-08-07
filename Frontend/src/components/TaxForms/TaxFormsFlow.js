import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TaxFormsOverview from './TaxFormsOverview';
import IncomeForm from './IncomeForm';
import FinalMinIncomeForm from './FinalMinIncomeForm';
import AdjustableTaxForm from './AdjustableTaxForm';
import ReductionsForm from './ReductionsForm';
import CreditsForm from './CreditsForm';
import DeductionsForm from './DeductionsForm';
import FinalTaxForm from './FinalTaxForm';
import CapitalGainsForm from './CapitalGainsForm';
import ExpensesForm from './ExpensesForm';
import WealthStatementForm from './WealthStatementForm';
import WealthReconciliationForm from './WealthReconciliationForm';
import TaxComputationSummary from './TaxComputationSummary';

const TaxFormsFlow = () => {
  return (
    <Routes>
      {/* Tax Forms Overview */}
      <Route index element={<TaxFormsOverview />} />
      
      {/* Individual Form Steps */}
      <Route path="income" element={<IncomeForm />} />
      <Route path="final-min-income" element={<FinalMinIncomeForm />} />
      <Route path="adjustable_tax" element={<AdjustableTaxForm />} />
      <Route path="reductions" element={<ReductionsForm />} />
      <Route path="credits" element={<CreditsForm />} />
      <Route path="deductions" element={<DeductionsForm />} />
      <Route path="final_tax" element={<FinalTaxForm />} />
      <Route path="capital_gain" element={<CapitalGainsForm />} />
      <Route path="expenses" element={<ExpensesForm />} />
      <Route path="wealth" element={<WealthStatementForm />} />
      <Route path="wealth-reconciliation" element={<WealthReconciliationForm />} />
      <Route path="tax-computation" element={<TaxComputationSummary />} />
      
      {/* Redirect unknown paths to overview */}
      <Route path="*" element={<Navigate to="/tax-forms" replace />} />
    </Routes>
  );
};

export default TaxFormsFlow;