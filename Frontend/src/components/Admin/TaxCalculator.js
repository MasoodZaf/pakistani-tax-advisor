import React, { useState } from 'react';
import { Calculator, TrendingUp, FileText, DollarSign } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const TaxCalculator = ({ onClose }) => {
  const [formData, setFormData] = useState({
    income: '',
    allowances: '',
    tax_year: '2025-26'
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calculator className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Tax Calculator</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600 mt-1">
            Calculate income tax for Pakistani taxpayers
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Form */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tax Calculation Input
              </h3>
              
              <form onSubmit={calculateTax} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gross Annual Income (PKR)
                  </label>
                  <input
                    type="number"
                    name="income"
                    value={formData.income}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 1200000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Allowances/Exemptions (PKR)
                  </label>
                  <input
                    type="number"
                    name="allowances"
                    value={formData.allowances}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 600000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Year
                  </label>
                  <select
                    name="tax_year"
                    value={formData.tax_year}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="2025-26">2025-26</option>
                    <option value="2024-25">2024-25</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Tax Calculation Results
              </h3>
              
              {result ? (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Gross Income</span>
                      </div>
                      <div className="text-xl font-bold text-blue-900">
                        {formatCurrency(result.gross_income)}
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">Net Income</span>
                      </div>
                      <div className="text-xl font-bold text-green-900">
                        {formatCurrency(result.net_income)}
                      </div>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">Total Tax</span>
                      </div>
                      <div className="text-xl font-bold text-red-900">
                        {formatCurrency(result.total_tax)}
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-900">Tax Rate</span>
                      </div>
                      <div className="text-xl font-bold text-purple-900">
                        {result.effective_tax_rate}%
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-3">Tax Breakdown by Slabs</h4>
                    <div className="space-y-2">
                      {result.breakdown.map((slab, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                          <div>
                            <div className="font-medium text-gray-900">{slab.range}</div>
                            <div className="text-sm text-gray-600">Rate: {slab.rate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(slab.tax_amount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              on {formatCurrency(slab.taxable_amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-sm text-blue-900 space-y-1">
                      <div className="flex justify-between">
                        <span>Gross Income:</span>
                        <span className="font-medium">{formatCurrency(result.gross_income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Less: Allowances:</span>
                        <span className="font-medium">({formatCurrency(result.allowances)})</span>
                      </div>
                      <div className="flex justify-between border-t border-blue-200 pt-1">
                        <span>Taxable Income:</span>
                        <span className="font-medium">{formatCurrency(result.taxable_income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Income Tax:</span>
                        <span className="font-medium">({formatCurrency(result.total_tax)})</span>
                      </div>
                      <div className="flex justify-between border-t border-blue-200 pt-1 text-lg font-bold">
                        <span>Net Income:</span>
                        <span>{formatCurrency(result.net_income)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
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