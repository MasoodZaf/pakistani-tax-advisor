import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3,
  FileText,
  TrendingUp,
  Download,
  DollarSign,
  PieChart,
  Calculator,
  Building,
  Wallet,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { generateIrisPdf } from '../../utils/irisPdf';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  // Bottom-line numbers from /api/tax-computation/:taxYear — full math
  // (normal tax + surcharge + CGT + super tax − reductions − credits − WHT).
  // Loaded alongside the summary tab so the headline panel always reflects
  // the same numbers the Tax Computation form shows.
  const [computation, setComputation] = useState(null);
  // The IRIS export needs the user's profile + every form's raw payload.
  const { user } = useAuth();
  const { formData } = useTaxForm();

  useEffect(() => {
    loadAvailableYears();
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    let cancelled = false;
    axios
      .get(`/api/tax-computation/${encodeURIComponent(selectedYear)}`)
      .then((res) => {
        if (cancelled) return;
        setComputation(res?.data?.data || null);
      })
      .catch(() => {
        if (cancelled) return;
        setComputation(null);
      });
    return () => { cancelled = true; };
  }, [selectedYear]);

  // Auto-load the active tab's report as soon as we know the tax year so the
  // page isn't blank on first paint. Re-fires when the user switches year or
  // tab (the tab-click handler already calls loadReport too, but kicking it
  // off here covers the initial render and year-picker changes).
  useEffect(() => {
    if (!selectedYear) return;
    const endpointForTab = {
      summary:    'tax-calculation-summary',
      income:     'income-analysis',
      adjustable: 'adjustable-tax-report',
      wealth:     'wealth-reconciliation',
    };
    const endpoint = endpointForTab[activeTab];
    if (endpoint) loadReport(endpoint);
    // loadReport reads selectedYear from closure; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, activeTab]);

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
  // PDF export — produces an FBR Acknowledgement-Slip-format document with
  // every IRIS field code visible in column 1. The layout mirrors the real
  // IRIS slip (see Return.pdf at the repo root) so a consultant can re-key
  // the values into the IRIS portal without translating field names.
  const exportToPDF = async () => {
    if (!selectedYear) {
      toast.error('Select a tax year first');
      return;
    }
    setLoading(true);
    try {
      const filename = await generateIrisPdf({
        taxYear:        selectedYear,
        formType:       '114(1) (Return of Income filed voluntarily for complete year)',
        computation,
        income:                 formData?.income                 || {},
        adjustable_tax:         formData?.adjustable_tax         || {},
        capital_gain:           formData?.capital_gain           || {},
        reductions:             formData?.reductions             || {},
        credits:                formData?.credits                || {},
        deductions:             formData?.deductions             || {},
        final_min_income:       formData?.final_min_income       || {},
        expenses:               formData?.expenses               || {},
        wealth:                 formData?.wealth                 || {},
        wealth_reconciliation:  formData?.wealth_reconciliation  || {},
        tax_computation:        formData?.tax_computation        || {},
        profile: {
          name:    user?.name,
          email:   user?.email,
          cnic:    user?.cnic,
          ntn:     user?.ntn || user?.cnic,
          phone:   user?.phone,
          address: user?.address,
        },
      });
      toast.success(`PDF downloaded: ${filename}`);
    } catch (err) {
      toast.error('PDF export failed — please try again');
      // eslint-disable-next-line no-console
      console.error('PDF export error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build a multi-sheet workbook spanning all four report tabs (not just the
  // active one) so the user gets a single file they can hand to a consultant.
  // Lazy-loads SheetJS to keep the main bundle small.
  const exportToExcel = async () => {
    if (!reportData) return;

    setLoading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // ── Summary sheet ──
      const summaryRows = [
        ['Pakistan Tax Advisor — Summary', ''],
        ['Tax Year', selectedYear],
        ['Generated', new Date().toLocaleDateString('en-PK')],
        [],
      ];
      if (computation) {
        const balance = computation.payments?.balancePayableRefundable || 0;
        summaryRows.push(
          ['Bottom Line', ''],
          ['Total taxable income (incl. CG)', computation.income?.taxableIncomeIncludingCG || 0],
          ['Total tax chargeable',            computation.tax?.totalTaxChargeable || 0],
          ['Tax already paid (WHT + advance)', (computation.payments?.withholdingTax || 0) + (computation.payments?.advanceTax || 0)],
          [balance > 0.5 ? 'Tax payable to FBR' : balance < -0.5 ? 'Refund due' : 'Balance', Math.abs(balance)],
          [],
        );
      }
      const incomeRow = reportData.rawData?.income || reportData.income || {};
      summaryRows.push(
        ['Income breakdown', ''],
        ['Basic salary',            Number(incomeRow.annual_basic_salary)   || 0],
        ['Allowances',              Number(incomeRow.allowances)            || 0],
        ['Bonus',                   Number(incomeRow.bonus)                 || 0],
        ['Car allowance',           Number(incomeRow.car_allowance)         || 0],
        ['Other taxable income',    Number(incomeRow.other_taxable)         || 0],
        ['Total taxable income',    Number(incomeRow.total_taxable_income ?? reportData.summary?.totalIncome ?? 0)],
      );
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 38 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // ── Income sheet ──
      const ri = reportData.regularIncome || {};
      const incomeSheet = XLSX.utils.aoa_to_sheet([
        ['Income Analysis', ''],
        ['Tax Year', selectedYear],
        [],
        ['Section', 'Amount (PKR)'],
        ['Basic salary',           Number(ri.annual_basic_salary)   || 0],
        ['Allowances',             Number(ri.allowances)            || 0],
        ['Bonus',                  Number(ri.bonus)                 || 0],
        ['Car allowance',          Number(ri.car_allowance)         || 0],
        ['Medical allowance',      Number(ri.medical_allowance)     || 0],
        ['Employer contribution',  Number(ri.employer_contribution) || 0],
        ['Other exempt',           Number(ri.other_exempt)          || 0],
        ['Total taxable income',   Number(ri.total_taxable_income)  || 0],
        [],
        ['Capital gains',          Number(reportData.capitalGains?.total_capital_gain || reportData.capitalGains?.total_capital_gains || 0)],
        ['Final tax income',       Number(reportData.finalTaxIncome?.total_final_tax ?? ((reportData.finalTaxIncome?.sukuk_amount || 0) + (reportData.finalTaxIncome?.debt_amount || 0)))],
      ]);
      incomeSheet['!cols'] = [{ wch: 32 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, incomeSheet, 'Income');

      // ── Adjustable tax sheet ──
      const adjRows = [
        ['Adjustable Tax Report', ''],
        ['Tax Year', selectedYear],
        ['Total adjustable tax', Number(reportData.totalAdjustableTax) || 0],
        [],
        ['Category', 'Subcategory', 'Amount (PKR)'],
      ];
      const cats = reportData.categories || {};
      Object.entries(cats).forEach(([cat, subs]) => {
        Object.entries(subs || {}).forEach(([sub, amt]) => {
          adjRows.push([cat, sub, Number(amt) || 0]);
        });
      });
      const adjSheet = XLSX.utils.aoa_to_sheet(adjRows);
      adjSheet['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, adjSheet, 'Adjustable Tax');

      // ── Wealth sheet ──
      const w = reportData.wealthStatement;
      if (w) {
        const wealthSheet = XLSX.utils.aoa_to_sheet([
          ['Wealth Reconciliation', ''],
          ['Tax Year', selectedYear],
          [],
          ['Item', 'Previous year', 'Current year', 'Change'],
          ['Total assets',      Number(w.total_assets_previous_year)     || 0, Number(w.total_assets_current_year)     || 0, (Number(w.total_assets_current_year) || 0) - (Number(w.total_assets_previous_year) || 0)],
          ['Total liabilities', Number(w.total_liabilities_previous_year) || 0, Number(w.total_liabilities_current_year) || 0, (Number(w.total_liabilities_current_year) || 0) - (Number(w.total_liabilities_previous_year) || 0)],
          ['Net worth',         Number(w.net_worth_previous_year)         || 0, Number(w.net_worth_current_year)         || 0, Number(w.wealth_increase) || 0],
        ]);
        wealthSheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wealthSheet, 'Wealth');
      }

      XLSX.writeFile(wb, `paktax-report-${selectedYear}.xlsx`);
      toast.success('Excel file downloaded');
    } catch (err) {
      toast.error('Excel export failed — please try again');
      // eslint-disable-next-line no-console
      console.error('Excel export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;
    // Plain CSV of the active tab — handy for quick copy-paste.
    const lines = [];
    if (activeTab === 'summary') {
      lines.push('Item,Amount (PKR)');
      const incomeRow = reportData.rawData?.income || reportData.income || {};
      lines.push(`Total taxable income,${Number(incomeRow.total_taxable_income ?? reportData.summary?.totalIncome ?? 0)}`);
      lines.push(`Adjustable tax,${Number(reportData.rawData?.adjustableTax?.total_adjustable_tax ?? reportData.summary?.totalWithholdingTax ?? 0)}`);
      if (computation) {
        lines.push(`Total tax chargeable,${computation.tax?.totalTaxChargeable || 0}`);
        lines.push(`Balance payable/refundable,${computation.payments?.balancePayableRefundable || 0}`);
      }
    } else if (activeTab === 'income') {
      lines.push('Source,Amount (PKR)');
      const ri = reportData.regularIncome || {};
      ['annual_basic_salary', 'allowances', 'bonus', 'car_allowance', 'medical_allowance', 'employer_contribution', 'other_exempt']
        .forEach((k) => lines.push(`${k},${Number(ri[k]) || 0}`));
    } else if (activeTab === 'adjustable') {
      lines.push('Category,Subcategory,Amount (PKR)');
      const cats = reportData.categories || {};
      Object.entries(cats).forEach(([cat, subs]) => {
        Object.entries(subs || {}).forEach(([sub, amt]) => {
          lines.push(`${cat},${sub},${Number(amt) || 0}`);
        });
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `paktax-${activeTab}-${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const SummaryReport = ({ data }) => {
    if (!data) return null;

    // tax-calculation-summary returns { summary, rawData: { income, adjustableTax }, calculations }
    const incomeRow = data.rawData?.income || data.income || {};
    const adjustableTaxRow = data.rawData?.adjustableTax || data.adjustableTax || {};
    const totalTaxableIncome = parseFloat(incomeRow.total_taxable_income ?? data.summary?.totalIncome ?? 0);
    const totalAdjustableTax = parseFloat(adjustableTaxRow.total_adjustable_tax ?? data.summary?.totalWithholdingTax ?? 0);
    const totalCredits = data.credits?.total_credits || 0;
    const totalDeductions = data.deductions?.total_deductions || 0;

    // Bottom-line numbers — pulled from /api/tax-computation/:year and held
    // in component state above. Falls back to the simpler /reports figures
    // when the full-computation endpoint hasn't responded yet.
    const totalTaxChargeable = computation?.tax?.totalTaxChargeable ?? null;
    const taxAlreadyPaid =
      (computation?.payments?.withholdingTax ?? 0) +
      (computation?.payments?.advanceTax ?? 0);
    const balance = computation?.payments?.balancePayableRefundable ?? null;
    const isPayable = (balance ?? 0) > 0.5;
    const isRefund  = (balance ?? 0) < -0.5;

    return (
      <div className="space-y-6">
        {/* Bottom Line — the headline numbers the user actually came here for */}
        {computation && (
          <div className="rounded-brand border border-gray-200 bg-white shadow-brand overflow-hidden">
            <div className={`px-6 py-5 ${isPayable ? 'bg-red-50 border-b border-red-100' : isRefund ? 'bg-green-50 border-b border-green-100' : 'bg-gray-50 border-b border-gray-100'}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {isPayable
                    ? <ArrowUpCircle className="w-7 h-7 text-red-600" />
                    : isRefund
                    ? <ArrowDownCircle className="w-7 h-7 text-green-600" />
                    : <CheckCircle className="w-7 h-7 text-gray-500" />}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${isPayable ? 'text-red-700' : isRefund ? 'text-green-700' : 'text-gray-600'}`}>
                      {isPayable ? 'Tax payable to FBR' : isRefund ? 'Refund due to you' : 'Tax position'}
                    </p>
                    <p className={`text-3xl font-bold ${isPayable ? 'text-red-900' : isRefund ? 'text-green-900' : 'text-navy'}`}>
                      {formatCurrency(Math.abs(balance || 0))}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 max-w-xs">
                  {isPayable
                    ? `Pay this amount when filing your return for ${selectedYear}.`
                    : isRefund
                    ? `Claim this refund when filing your return for ${selectedYear}.`
                    : 'Your withholding and advance tax fully cover the chargeable tax.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total tax chargeable</p>
                <p className="text-xl font-bold text-navy mt-1">{formatCurrency(totalTaxChargeable)}</p>
                <p className="text-xs text-gray-500 mt-1">Normal + surcharge + CGT + super tax</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax already paid</p>
                <p className="text-xl font-bold text-navy mt-1">{formatCurrency(taxAlreadyPaid)}</p>
                <p className="text-xs text-gray-500 mt-1">Withholding + advance tax u/s 147</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Taxable income</p>
                <p className="text-xl font-bold text-navy mt-1">{formatCurrency(computation?.income?.taxableIncomeIncludingCG)}</p>
                <p className="text-xs text-gray-500 mt-1">Including capital gains</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-navy   text-white p-6 rounded-brand">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Total Taxable Income</p>
                <p className="text-2xl font-bold">{formatCurrency(totalTaxableIncome)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-lime" />
            </div>
          </div>

          <div className="bg-navy   text-white p-6 rounded-brand">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Adjustable Tax Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAdjustableTax)}</p>
              </div>
              <Calculator className="w-8 h-8 text-green-200" />
            </div>
          </div>

          <div className="bg-navy   text-white p-6 rounded-brand">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Tax Credits</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCredits)}</p>
              </div>
              <PieChart className="w-8 h-8 text-lime" />
            </div>
          </div>

          <div className="bg-navy   text-white p-6 rounded-brand">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Tax Deductions</p>
                <p className="text-2xl font-bold">{formatCurrency(totalDeductions)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-200" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy mb-4">Income Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Basic Salary</span>
              <span className="font-medium">{formatCurrency(incomeRow.annual_basic_salary)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Allowances</span>
              <span className="font-medium">{formatCurrency(incomeRow.allowances)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Bonus</span>
              <span className="font-medium">{formatCurrency(incomeRow.bonus)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Car Allowance</span>
              <span className="font-medium">{formatCurrency(incomeRow.car_allowance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-700">Other Taxable Income</span>
              <span className="font-medium">{formatCurrency(incomeRow.other_taxable)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-gray-50 font-semibold">
              <span className="text-navy">Total Taxable Income</span>
              <span className="text-navy">{formatCurrency(totalTaxableIncome)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const IncomeAnalysisReport = ({ data }) => {
    if (!data) return null;

    const regularIncome = data.regularIncome?.total_taxable_income || 0;
    const capitalGains = data.capitalGains?.total_capital_gain || data.capitalGains?.total_capital_gains || 0;
    const finalTaxIncome = data.finalTaxIncome?.total_final_tax ?? ((data.finalTaxIncome?.sukuk_amount || 0) + (data.finalTaxIncome?.debt_amount || 0));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-brand shadow-brand p-6 border-l-4 border-navy/40">
            <h4 className="text-lg font-semibold text-navy mb-2">Regular Income</h4>
            <p className="text-3xl font-bold text-navy">{formatCurrency(regularIncome)}</p>
            <p className="text-sm text-gray-600 mt-1">Salary, business income, etc.</p>
          </div>

          <div className="bg-white rounded-brand shadow-brand p-6 border-l-4 border-green-500">
            <h4 className="text-lg font-semibold text-navy mb-2">Capital Gains</h4>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(capitalGains)}</p>
            <p className="text-sm text-gray-600 mt-1">Property, securities sales</p>
          </div>

          <div className="bg-white rounded-brand shadow-brand p-6 border-l-4 border-navy/40">
            <h4 className="text-lg font-semibold text-navy mb-2">Final Tax Income</h4>
            <p className="text-3xl font-bold text-navy">{formatCurrency(finalTaxIncome)}</p>
            <p className="text-sm text-gray-600 mt-1">Sukuk, bonds, etc.</p>
          </div>
        </div>

        {data.regularIncome && (
          <div className="bg-white rounded-brand shadow-brand p-6">
            <h3 className="text-lg font-semibold text-navy mb-4">Regular Income Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-navy mb-3">Taxable Income</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Basic Salary</span>
                    <span>{formatCurrency(data.regularIncome.annual_basic_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Allowances</span>
                    <span>{formatCurrency(data.regularIncome.allowances)}</span>
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
                <h4 className="font-medium text-navy mb-3">Exempt Income</h4>
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
        <div className="bg-white rounded-brand shadow-brand p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-navy">Total Adjustable Tax</h3>
            <span className="text-2xl font-bold text-navy">{formatCurrency(data.totalAdjustableTax)}</span>
          </div>
          <p className="text-gray-600">This represents all withholding taxes and advance tax payments made during the tax year.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy mb-3 flex items-center">
              <Building className="w-5 h-5 mr-2 text-navy" />
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

          <div className="bg-white rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy mb-3 flex items-center">
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

          <div className="bg-white rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy mb-3 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-navy" />
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

          <div className="bg-white rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy mb-3 flex items-center">
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

          <div className="bg-white rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy mb-3 flex items-center">
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
          <div className="bg-white rounded-brand shadow-brand p-6">
            <h3 className="text-lg font-semibold text-navy mb-4">Assets Comparison</h3>
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
                <span className="text-navy font-semibold">Change</span>
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

          <div className="bg-white rounded-brand shadow-brand p-6">
            <h3 className="text-lg font-semibold text-navy mb-4">Liabilities Comparison</h3>
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
                <span className="text-navy font-semibold">Change</span>
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

        <div className="bg-white rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy mb-4">Net Worth Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-gray-600 mb-1">Previous Year Net Worth</p>
              <p className="text-2xl font-bold text-navy">{formatCurrency(wealth.net_worth_previous_year)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 mb-1">Current Year Net Worth</p>
              <p className="text-2xl font-bold text-navy">{formatCurrency(wealth.net_worth_current_year)}</p>
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

        <div className="bg-white rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy mb-4">Income vs. Wealth Reconciliation</h3>
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
              <span className="text-navy font-semibold">Wealth Increase</span>
              <span className="font-semibold">{formatCurrency(wealth.wealth_increase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy font-semibold">Difference</span>
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
        <div className="bg-white rounded-brand shadow-brand p-6">
          <h1 className="text-2xl font-bold text-navy mb-2">Tax Reports & Analysis</h1>
          <p className="text-gray-600">
            View your tax calculations, summaries, and detailed reports
          </p>
        </div>

        <div className="bg-white rounded-brand shadow-brand p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-navy mb-2">No Tax Data Available</h2>
          <p className="text-gray-600 mb-6">
            Complete your tax forms to generate detailed reports and analysis.
          </p>
          <button 
            onClick={() => window.location.href = '/tax-forms'}
            className="bg-lime text-navy px-6 py-2 rounded-brand hover:bg-lime/80 transition-colors"
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
      <div className="bg-white rounded-brand shadow-brand p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy mb-2">Tax Reports & Analysis</h1>
            <p className="text-gray-600">
              View your tax calculations, summaries, and detailed reports
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="form-select border border-gray-300 rounded-brand px-3 py-2 focus:ring-2 focus:ring-navy/30 focus:border-transparent"
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
      <div className="bg-white rounded-brand shadow-brand">
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
                    ? 'border-lime text-navy'
                    : 'border-transparent text-gray-500 hover:text-navy'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6" id="paktax-report-print">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-navy animate-spin mx-auto mb-4" />
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
        <div className="bg-white rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy mb-4">Export Options</h3>
          <p className="text-gray-600 mb-4">Download your tax reports in various formats</p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={exportToPDF}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-brand hover:bg-red-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-brand hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button 
              onClick={exportToCSV}
              className="flex items-center space-x-2 bg-lime text-navy px-4 py-2 rounded-brand hover:bg-lime/80 transition-colors"
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