import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TaxFormsOverview from './TaxFormsOverview';

const TaxFormsFlow = () => {
  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">Tax Forms Central Hub</h3>
        <p className="text-blue-700 mb-3">
          Tax forms have been organized into specialized modules for better workflow:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <h4 className="font-semibold text-blue-900">Income Tax Module</h4>
            <p className="text-sm text-blue-800">Income, Adjustable Tax, Capital Gains, Reductions, Credits, Deductions, Final Tax, Expenses, Tax Computation</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <h4 className="font-semibold text-blue-900">Wealth Statement Module</h4>
            <p className="text-sm text-blue-800">Wealth Statement and Wealth Reconciliation forms</p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <h4 className="font-semibold text-blue-900">Admin Module</h4>
            <p className="text-sm text-blue-800">Administrative forms and system management</p>
          </div>
        </div>
        <p className="text-blue-700 mt-3">
          Use the overview below to track your progress and navigate between forms.
        </p>
      </div>

      <Routes>
        {/* Tax Forms Overview */}
        <Route index element={<TaxFormsOverview />} />

        {/* Redirect unknown paths to overview */}
        <Route path="*" element={<Navigate to="/tax-forms" replace />} />
      </Routes>
    </div>
  );
};

export default TaxFormsFlow;