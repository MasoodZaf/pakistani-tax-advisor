import React from 'react';
import { BarChart3, FileText, TrendingUp } from 'lucide-react';

const Reports = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tax Reports & Analysis</h1>
        <p className="text-gray-600">
          View your tax calculations, summaries, and detailed reports
        </p>
      </div>

      {/* Coming Soon */}
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Reports Coming Soon</h2>
        <p className="text-gray-600 mb-6">
          Tax calculation reports and analysis tools will be available here once you complete your tax forms.
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>• Tax liability calculations</p>
          <p>• Income vs. expense analysis</p>
          <p>• Wealth reconciliation reports</p>
          <p>• Year-over-year comparisons</p>
        </div>
      </div>
    </div>
  );
};

export default Reports;