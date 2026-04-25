import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import WealthStatementForm from './components/WealthStatementForm';
import WealthReconciliationForm from './components/WealthReconciliationForm';
import FormDeck from '../../components/TaxForms/FormDeck';

const WealthStatementModule = () => {
  return (
    <Routes>
      <Route
        index
        element={
          <FormDeck
            scope="wealth"
            title="Wealth Statement Sections"
            subtitle="Assets, liabilities, and the wealth reconciliation that FBR requires to balance to zero."
          />
        }
      />
      <Route path="wealth-statement" element={<WealthStatementForm />} />
      <Route path="wealth-reconciliation" element={<WealthReconciliationForm />} />

      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default WealthStatementModule;