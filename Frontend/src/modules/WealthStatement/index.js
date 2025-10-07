import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import WealthStatementForm from './components/WealthStatementForm';
import WealthReconciliationForm from './components/WealthReconciliationForm';

const WealthStatementModule = () => {
  return (
    <Routes>
      <Route path="wealth-statement" element={<WealthStatementForm />} />
      <Route path="wealth-reconciliation" element={<WealthReconciliationForm />} />

      {/* Default route */}
      <Route index element={<Navigate to="wealth-statement" replace />} />
      <Route path="*" element={<Navigate to="wealth-statement" replace />} />
    </Routes>
  );
};

export default WealthStatementModule;