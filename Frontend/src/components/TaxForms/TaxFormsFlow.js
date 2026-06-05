import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import TaxFormsOverview from './TaxFormsOverview';

const TaxFormsFlow = () => {
  return (
    <div>
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2">Tax Forms Central Hub</h3>
        <p className="text-blue-700 dark:text-blue-300 mb-3">
          Tax forms have been organized into specialized modules for better workflow:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">Income Tax Module</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300">Income, Adjustable Tax, Capital Gains, Reductions, Credits, Deductions, Final Tax, Expenses, Tax Computation</p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">Wealth Statement Module</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300">Wealth Statement and Wealth Reconciliation forms</p>
          </div>
          <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">Admin Module</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300">Administrative forms and system management</p>
          </div>
        </div>
        <p className="text-blue-700 dark:text-blue-300 mt-3">
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