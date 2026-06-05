import React, { useState } from 'react';
import { Calculator, TrendingUp, FileText, DollarSign } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTaxYear } from '../../../contexts/TaxYearContext';
import { formatCurrency } from '../../../utils/currency';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

const TaxCalculator = ({ onClose }) => {
  const { currentTaxYear, availableYears } = useTaxYear();
  // Trap focus inside the dialog while it's mounted; Escape closes it.
  const dialogRef = useFocusTrap(true, { onEscape: onClose });
  const [formData, setFormData] = useState({
    income: '',
    allowances: '',
    tax_year: currentTaxYear || '2025-26'
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateTax = async (e) => {
    e.preventDefault();
    
    if (!formData.income || parseFloat(formData.income) < 0) {
      toast.error('Please enter a valid income amount');
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.post('/api/admin/tax-calculator', {
        income: parseFloat(formData.income),
        allowances: parseFloat(formData.allowances) || 0,
        tax_year: formData.tax_year
      });

      if (response.data.success) {
        setResult(response.data.data);
        toast.success('Tax calculation completed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Tax calculation failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-tax-calc-title"
        className="bg-white dark:bg-[#151c30] rounded-brand w-full max-w-4xl max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="p-6 border-b dark:border-[#2a3450]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calculator className="w-6 h-6 text-navy dark:text-[#e7eaf3]" />
              <h2 id="admin-tax-calc-title" className="text-xl font-bold text-navy dark:text-[#e7eaf3]">Tax Calculator</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-[#7e88a6] hover:text-gray-600 dark:hover:text-[#aab2cc] text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600 dark:text-[#aab2cc] mt-1">
            Calculate income tax for Pakistani taxpayers
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Form */}
            <div>
              <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">
                Tax Calculation Input
              </h3>

              <form onSubmit={calculateTax} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">
                    Gross Annual Income (PKR)
                  </label>
                  <input
                    type="number"
                    name="income"
                    value={formData.income}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
                    placeholder="e.g., 1200000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">
                    Tax Allowances/Exemptions (PKR)
                  </label>
                  <input
                    type="number"
                    name="allowances"
                    value={formData.allowances}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
                    placeholder="e.g., 600000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">
                    Tax Year
                  </label>
                  <select
                    name="tax_year"
                    value={formData.tax_year}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
                  >
                    {(availableYears.length ? availableYears : ['2025-26', '2024-25']).map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-lime text-navy py-2 px-4 rounded-brand hover:bg-lime/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <div className="spinner w-4 h-4"></div>
                  ) : (
                    <Calculator className="w-4 h-4" />
                  )}
                  <span>{loading ? 'Calculating...' : 'Calculate Tax'}</span>
                </button>
              </form>
            </div>

            {/* Results */}
            <div>
              <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">
                Tax Calculation Results
              </h3>
              
              {result ? (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-navy/5 p-4 rounded-brand border border-navy/15">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="w-4 h-4 text-navy" />
                        <span className="text-sm font-medium text-navy">Gross Income</span>
                      </div>
                      <div className="text-xl font-bold text-navy">
                        {formatCurrency(result.gross_income)}
                      </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-500/15 p-4 rounded-brand border border-green-200 dark:border-green-500/30">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-900 dark:text-green-300">Net Income</span>
                      </div>
                      <div className="text-xl font-bold text-green-900 dark:text-green-300">
                        {formatCurrency(result.net_income)}
                      </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-500/15 p-4 rounded-brand border border-red-200 dark:border-red-500/30">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-medium text-red-900 dark:text-red-300">Total Tax</span>
                      </div>
                      <div className="text-xl font-bold text-red-900 dark:text-red-300">
                        {formatCurrency(result.total_tax)}
                      </div>
                    </div>

                    <div className="bg-navy/5 p-4 rounded-brand border border-navy/15">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-navy" />
                        <span className="text-sm font-medium text-navy">Tax Rate</span>
                      </div>
                      <div className="text-xl font-bold text-navy">
                        {result.effective_tax_rate}%
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="bg-gray-50 dark:bg-[#0f1426] p-4 rounded-brand">
                    <h4 className="font-semibold text-navy dark:text-[#e7eaf3] mb-3">Tax Breakdown by Slabs</h4>
                    <div className="space-y-2">
                      {result.breakdown.map((slab, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-[#2a3450] last:border-b-0">
                          <div>
                            <div className="font-medium text-navy dark:text-[#e7eaf3]">{slab.range}</div>
                            <div className="text-sm text-gray-600 dark:text-[#aab2cc]">Rate: {slab.rate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-navy dark:text-[#e7eaf3]">
                              {formatCurrency(slab.tax_amount)}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-[#aab2cc]">
                              on {formatCurrency(slab.taxable_amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-navy/5 p-4 rounded-brand border border-navy/15">
                    <div className="text-sm text-navy space-y-1">
                      <div className="flex justify-between">
                        <span>Gross Income:</span>
                        <span className="font-medium">{formatCurrency(result.gross_income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Less: Allowances:</span>
                        <span className="font-medium">({formatCurrency(result.allowances)})</span>
                      </div>
                      <div className="flex justify-between border-t border-navy/15 pt-1">
                        <span>Taxable Income:</span>
                        <span className="font-medium">{formatCurrency(result.taxable_income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Income Tax:</span>
                        <span className="font-medium">({formatCurrency(result.total_tax)})</span>
                      </div>
                      <div className="flex justify-between border-t border-navy/15 pt-1 text-lg font-bold">
                        <span>Net Income:</span>
                        <span>{formatCurrency(result.net_income)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-[#7e88a6] py-12">
                  <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-[#7e88a6]" />
                  <p>Enter income details and click "Calculate Tax" to see results</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxCalculator;