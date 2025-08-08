import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3,
  FileText,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  PieChart,
  Calculator,
  Building,
  Wallet,
  Eye,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    loadAvailableYears();
  }, []);

  const loadAvailableYears = async () => {
    try {
      const response = await axios.get('/api/reports/available-years');
      if (response.data.success) {
        setAvailableYears(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedYear(response.data.data[0].tax_year);
        }
      }
    } catch (error) {
      console.error('Error loading available years:', error);
      toast.error('Failed to load available tax years');
    }
  };

  const loadReport = async (reportType) => {
    if (!selectedYear) {
      toast.error('Please select a tax year');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/reports/${reportType}/${selectedYear}`);
      if (response.data.success) {
        setReportData(response.data.data);
        toast.success('Report loaded successfully');
      }
    } catch (error) {
      console.error('Error loading report:', error);
      if (error.response?.status === 404) {
        toast.error('No tax data found for selected year');
      } else {
        toast.error('Failed to load report');
      }
      setReportData(null);
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
    }).format(amount || 0);
  };

  const exportToPDF = () => {
    toast.info('PDF export functionality will be implemented with a PDF generation library');
    // TODO: Implement PDF export using libraries like jsPDF or react-pdf
  };

  const exportToExcel = () => {
    if (!reportData) return;
    
    // Create CSV content for Excel compatibility
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (activeTab === 'summary') {
      csvContent += "Tax Year,Income Type,Amount\n";
      csvContent += `${selectedYear},Total Taxable Income,${reportData.income?.total_taxable_income || 0}\n`;
      csvContent += `${selectedYear},Adjustable Tax,${reportData.adjustableTax?.total_adjustable_tax || 0}\n`;
      csvContent += `${selectedYear},Tax Credits,${reportData.credits?.total_credits || 0}\n`;
      csvContent += `${selectedYear},Tax Deductions,${reportData.deductions?.total_deductions || 0}\n`;
    } else if (activeTab === 'income') {
      csvContent += "Tax Year,Income Source,Amount\n";
      if (reportData.regularIncome) {
        csvContent += `${selectedYear},Monthly Salary,${reportData.regularIncome.monthly_salary || 0}\n`;
        csvContent += `${selectedYear},Bonus,${reportData.regularIncome.bonus || 0}\n`;
        csvContent += `${selectedYear},Car Allowance,${reportData.regularIncome.car_allowance || 0}\n`;
        csvContent += `${selectedYear},Medical Allowance,${reportData.regularIncome.medical_allowance || 0}\n`;
      }
    } else if (activeTab === 'adjustable') {
      csvContent += "Tax Year,Category,Subcategory,Amount\n";
      const categories = reportData.categories || {};
      Object.keys(categories).forEach(category => {
        Object.keys(categories[category]).forEach(subcategory => {
          csvContent += `${selectedYear},${category},${subcategory},${categories[category][subcategory] || 0}\n`;
        });
      });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tax-report-${activeTab}-${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Excel file downloaded successfully');
  };

  const exportToCSV = () => {
    exportToExcel(); // Same functionality for now
  };

  const SummaryReport = ({ data }) => {
    if (!data) return null;

    const totalTaxableIncome = data.income?.total_taxable_income || 0;
    const totalAdjustableTax = data.adjustableTax?.total_adjustable_tax || 0;
    const totalCredits = data.credits?.total_credits || 0;
    const totalDeductions = data.deductions?.total_deductions || 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Taxable Income</p>
                <p className="text-2xl font-bold">{formatCurrency(totalTaxableIncome)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Adjustable Tax Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAdjustableTax)}</p>
              </div>
              <Calculator className="w-8 h-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Tax Credits</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCredits)}</p>
              </div>
              <PieChart className="w-8 h-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Tax Deductions</p>
                <p className="text-2xl font-bold">{formatCurrency(totalDeductions)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-200" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Income Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Monthly Salary</span>
              <span className="font-medium">{formatCurrency(data.income?.monthly_salary)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Bonus</span>
              <span className="font-medium">{formatCurrency(data.income?.bonus)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Car Allowance</span>
              <span className="font-medium">{formatCurrency(data.income?.car_allowance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Other Taxable Income</span>
              <span className="font-medium">{formatCurrency(data.income?.other_taxable)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-gray-50 font-semibold">
              <span className="text-gray-900">Total Taxable Income</span>
              <span className="text-primary-600">{formatCurrency(totalTaxableIncome)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const IncomeAnalysisReport = ({ data }) => {
    if (!data) return null;

    const regularIncome = data.regularIncome?.total_taxable_income || 0;
    const capitalGains = data.capitalGains?.total_capital_gains || 0;
    const finalTaxIncome = (data.finalTaxIncome?.sukuk_amount || 0) + (data.finalTaxIncome?.debt_amount || 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Regular Income</h4>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(regularIncome)}</p>
            <p className="text-sm text-gray-600 mt-1">Salary, business income, etc.</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Capital Gains</h4>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(capitalGains)}</p>
            <p className="text-sm text-gray-600 mt-1">Property, securities sales</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Final Tax Income</h4>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(finalTaxIncome)}</p>
            <p className="text-sm text-gray-600 mt-1">Sukuk, bonds, etc.</p>
          </div>
        </div>

        {data.regularIncome && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regular Income Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Taxable Income</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly Salary</span>
                    <span>{formatCurrency(data.regularIncome.monthly_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bonus</span>
                    <span>{formatCurrency(data.regularIncome.bonus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Car Allowance</span>
                    <span>{formatCurrency(data.regularIncome.car_allowance)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Exempt Income</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medical Allowance</span>
                    <span>{formatCurrency(data.regularIncome.medical_allowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Employer Contribution</span>
                    <span>{formatCurrency(data.regularIncome.employer_contribution)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Other Exempt</span>
                    <span>{formatCurrency(data.regularIncome.other_exempt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AdjustableTaxReport = ({ data }) => {
    if (!data) return null;

    const categories = data.categories || {};

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Total Adjustable Tax</h3>
            <span className="text-2xl font-bold text-primary-600">{formatCurrency(data.totalAdjustableTax)}</span>
          </div>
          <p className="text-gray-600">This represents all withholding taxes and advance tax payments made during the tax year.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Building className="w-5 h-5 mr-2 text-blue-500" />
              Employment
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Salary Tax</span>
                <span>{formatCurrency(categories.employment?.salaryTax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Directorship Fee</span>
                <span>{formatCurrency(categories.employment?.directorshipFee)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Calculator className="w-5 h-5 mr-2 text-green-500" />
              Utilities
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Electricity</span>
                <span>{formatCurrency(categories.utilities?.electricity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Telephone</span>
                <span>{formatCurrency(categories.utilities?.telephone)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cellphone</span>
                <span>{formatCurrency(categories.utilities?.cellphone)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-purple-500" />
              Motor Vehicle
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Registration</span>
                <span>{formatCurrency(categories.motorVehicle?.registration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Transfer</span>
                <span>{formatCurrency(categories.motorVehicle?.transfer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sale</span>
                <span>{formatCurrency(categories.motorVehicle?.sale)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Building className="w-5 h-5 mr-2 text-red-500" />
              Property
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Sale/Transfer</span>
                <span>{formatCurrency(categories.property?.saleTransfer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Purchase</span>
                <span>{formatCurrency(categories.property?.purchase)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-yellow-500" />
              Financial
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Profit on Debt</span>
                <span>{formatCurrency(categories.financial?.profitOnDebt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cash Withdrawal</span>
                <span>{formatCurrency(categories.financial?.cashWithdrawal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WealthReport = ({ data }) => {
    if (!data) return null;

    const wealth = data.wealthStatement;
    if (!wealth) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No wealth statement data available for this year.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Assets Comparison</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Previous Year</span>
                <span className="font-medium">{formatCurrency(wealth.total_assets_previous_year)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Year</span>
                <span className="font-medium">{formatCurrency(wealth.total_assets_current_year)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-900 font-semibold">Change</span>
                <span className={`font-semibold ${
                  (wealth.total_assets_current_year - wealth.total_assets_previous_year) >= 0 
                    ? 'text-green-600' 
                    : 'text-red-600'
                }`}>
                  {formatCurrency(wealth.total_assets_current_year - wealth.total_assets_previous_year)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Liabilities Comparison</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Previous Year</span>
                <span className="font-medium">{formatCurrency(wealth.total_liabilities_previous_year)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Year</span>
                <span className="font-medium">{formatCurrency(wealth.total_liabilities_current_year)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-900 font-semibold">Change</span>
                <span className={`font-semibold ${
                  (wealth.total_liabilities_current_year - wealth.total_liabilities_previous_year) >= 0 
                    ? 'text-red-600' 
                    : 'text-green-600'
                }`}>
                  {formatCurrency(wealth.total_liabilities_current_year - wealth.total_liabilities_previous_year)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Net Worth Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-gray-600 mb-1">Previous Year Net Worth</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(wealth.net_worth_previous_year)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 mb-1">Current Year Net Worth</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(wealth.net_worth_current_year)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 mb-1">Wealth Increase</p>
              <p className={`text-2xl font-bold ${
                wealth.wealth_increase >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(wealth.wealth_increase)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs. Wealth Reconciliation</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Taxable Income</span>
              <span className="font-medium">{formatCurrency(data.totalTaxableIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Expenses</span>
              <span className="font-medium">{formatCurrency(data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Net Income</span>
              <span className="font-medium">{formatCurrency(data.totalTaxableIncome - data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-900 font-semibold">Wealth Increase</span>
              <span className="font-semibold">{formatCurrency(wealth.wealth_increase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-900 font-semibold">Difference</span>
              <span className={`font-semibold ${
                Math.abs((data.totalTaxableIncome - data.totalExpenses) - wealth.wealth_increase) < 1000
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {formatCurrency((data.totalTaxableIncome - data.totalExpenses) - wealth.wealth_increase)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (availableYears.length === 0) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tax Reports & Analysis</h1>
          <p className="text-gray-600">
            View your tax calculations, summaries, and detailed reports
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Tax Data Available</h2>
          <p className="text-gray-600 mb-6">
            Complete your tax forms to generate detailed reports and analysis.
          </p>
          <button 
            onClick={() => window.location.href = '/tax-forms'}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Go to Tax Forms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Tax Reports & Analysis</h1>
            <p className="text-gray-600">
              View your tax calculations, summaries, and detailed reports
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="form-select border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {availableYears.map(year => (
                <option key={year.tax_year} value={year.tax_year}>
                  {year.tax_year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'summary', label: 'Tax Summary', icon: BarChart3, endpoint: 'tax-calculation-summary' },
              { id: 'income', label: 'Income Analysis', icon: TrendingUp, endpoint: 'income-analysis' },
              { id: 'adjustable', label: 'Adjustable Tax', icon: Calculator, endpoint: 'adjustable-tax-report' },
              { id: 'wealth', label: 'Wealth Report', icon: Wallet, endpoint: 'wealth-reconciliation' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  loadReport(tab.endpoint);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading report data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && <SummaryReport data={reportData} />}
              {activeTab === 'income' && <IncomeAnalysisReport data={reportData} />}
              {activeTab === 'adjustable' && <AdjustableTaxReport data={reportData} />}
              {activeTab === 'wealth' && <WealthReport data={reportData} />}
            </>
          )}
        </div>
      </div>

      {/* Export Options */}
      {reportData && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>
          <p className="text-gray-600 mb-4">Download your tax reports in various formats</p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={exportToPDF}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;