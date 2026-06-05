import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowUpCircle,
  Sparkles,
  Lightbulb,
  ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { generateIrisPdf } from '../../utils/irisPdf';
import { formatCnic } from '../../utils/cnic';
import { Skeleton, SkeletonText, SkeletonCards } from '../common/Skeleton';

const Reports = () => {
  const navigate = useNavigate();
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
  // AI tax-efficiency analysis (on-demand; not tied to the report-fetch flow).
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiRaw, setAiRaw] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiMeta, setAiMeta] = useState(null); // { cached, analysedAt, needsRun }
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

  // On opening the Tax Efficiency tab, silently surface any cached analysis
  // (no AI run) so returning users see their results instantly.
  useEffect(() => {
    if (activeTab === 'efficiency' && selectedYear && !aiAnalysis && !aiLoading) {
      loadOptimization({ cacheOnly: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedYear]);

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
  // On-demand AI tax-efficiency analysis. The backend gathers the authoritative
  // DB computation and asks the grounded consultant for legal reliefs the user
  // hasn't claimed; we render the structured result (or a raw fallback).
  // opts.cacheOnly: silent probe (no spinner, never triggers the ~10s AI run) —
  // used on tab-open to show a prior cached analysis instantly.
  // opts.refresh: force a fresh run ignoring the cache.
  const loadOptimization = async (opts = {}) => {
    if (!selectedYear) { if (!opts.cacheOnly) toast.error('Select a tax year first'); return; }
    if (!opts.cacheOnly) setAiLoading(true);
    setAiError(null);
    try {
      const res = await axios.post('/api/ai-consultant/optimize', {
        taxYear: selectedYear, includePII: false,
        refresh: !!opts.refresh, cacheOnly: !!opts.cacheOnly,
      });
      if (res.data?.success) {
        if (opts.cacheOnly && res.data.needsRun) { setAiMeta({ needsRun: true }); return; }
        setAiAnalysis(res.data.analysis || null);
        setAiRaw(res.data.analysis ? null : (res.data.raw || null));
        setAiMeta({ cached: res.data.cached, analysedAt: res.data.analysedAt });
      } else if (!opts.cacheOnly) {
        setAiError(res.data?.message || 'The analysis could not be completed.');
      }
    } catch (e) {
      if (!opts.cacheOnly) setAiError(e.response?.data?.message || 'Could not run the analysis — please try again.');
    } finally {
      if (!opts.cacheOnly) setAiLoading(false);
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
          cnic:    user?.cnic ? formatCnic(user.cnic) : user?.cnic,
          ntn:     user?.ntn || (user?.cnic ? formatCnic(user.cnic) : user?.cnic),
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
      // exceljs (maintained; matches the backend) — replaces SheetJS/xlsx,
      // which had unpatched prototype-pollution + ReDoS advisories (DEP-01).
      const ExcelJSModule = await import('exceljs');
      const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
      const wb = new ExcelJS.Workbook();
      // Build a sheet from an array-of-arrays (aoa) with optional column widths.
      const addSheet = (name, rows, widths) => {
        const ws = wb.addWorksheet(name);
        ws.addRows(rows);
        if (widths) widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
      };

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
      addSheet('Summary', summaryRows, [38, 18]);

      // ── Income sheet ──
      const ri = reportData.regularIncome || {};
      const incomeRows = [
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
      ];
      addSheet('Income', incomeRows, [32, 18]);

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
      addSheet('Adjustable Tax', adjRows, [22, 28, 18]);

      // ── Wealth sheet ──
      const w = reportData.wealthStatement;
      if (w) {
        addSheet('Wealth', [
          ['Wealth Reconciliation', ''],
          ['Tax Year', selectedYear],
          [],
          ['Item', 'Previous year', 'Current year', 'Change'],
          ['Total assets',      Number(w.total_assets_previous_year)     || 0, Number(w.total_assets_current_year)     || 0, (Number(w.total_assets_current_year) || 0) - (Number(w.total_assets_previous_year) || 0)],
          ['Total liabilities', Number(w.total_liabilities_previous_year) || 0, Number(w.total_liabilities_current_year) || 0, (Number(w.total_liabilities_current_year) || 0) - (Number(w.total_liabilities_previous_year) || 0)],
          ['Net worth',         Number(w.net_worth_previous_year)         || 0, Number(w.net_worth_current_year)         || 0, Number(w.wealth_increase) || 0],
        ], [22, 16, 16, 16]);
      }

      // Write to an in-memory buffer and trigger a browser download (exceljs
      // has no writeFile in the browser).
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paktax-report-${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
          <div className="rounded-brand border border-gray-200 dark:border-[#2a3450] bg-white dark:bg-[#151c30] shadow-brand overflow-hidden">
            <div className={`px-6 py-5 ${isPayable ? 'bg-red-50 dark:bg-red-500/15 border-b border-red-100 dark:border-red-500/30' : isRefund ? 'bg-green-50 dark:bg-green-500/15 border-b border-green-100 dark:border-green-500/30' : 'bg-gray-50 dark:bg-[#0f1426] border-b border-gray-100 dark:border-[#2a3450]'}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {isPayable
                    ? <ArrowUpCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
                    : isRefund
                    ? <ArrowDownCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                    : <CheckCircle className="w-7 h-7 text-gray-500 dark:text-[#7e88a6]" />}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${isPayable ? 'text-red-700 dark:text-red-400' : isRefund ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-[#aab2cc]'}`}>
                      {isPayable ? 'Tax payable to FBR' : isRefund ? 'Refund due to you' : 'Tax position'}
                    </p>
                    <p className={`text-3xl font-bold ${isPayable ? 'text-red-900 dark:text-red-400' : isRefund ? 'text-green-900 dark:text-green-400' : 'text-navy dark:text-[#e7eaf3]'}`}>
                      {formatCurrency(Math.abs(balance || 0))}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#7e88a6] max-w-xs">
                  {isPayable
                    ? `Pay this amount when filing your return for ${selectedYear}.`
                    : isRefund
                    ? `Claim this refund when filing your return for ${selectedYear}.`
                    : 'Your withholding and advance tax fully cover the chargeable tax.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-[#2a3450]">
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-[#7e88a6] uppercase tracking-wide">Total tax chargeable</p>
                <p className="text-xl font-bold text-navy dark:text-[#e7eaf3] mt-1">{formatCurrency(totalTaxChargeable)}</p>
                <p className="text-xs text-gray-500 dark:text-[#7e88a6] mt-1">Normal + surcharge + CGT + super tax</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-[#7e88a6] uppercase tracking-wide">Tax already paid</p>
                <p className="text-xl font-bold text-navy dark:text-[#e7eaf3] mt-1">{formatCurrency(taxAlreadyPaid)}</p>
                <p className="text-xs text-gray-500 dark:text-[#7e88a6] mt-1">Withholding + advance tax u/s 147</p>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-[#7e88a6] uppercase tracking-wide">Taxable income</p>
                <p className="text-xl font-bold text-navy dark:text-[#e7eaf3] mt-1">{formatCurrency(computation?.income?.taxableIncomeIncludingCG)}</p>
                <p className="text-xs text-gray-500 dark:text-[#7e88a6] mt-1">Including capital gains</p>
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

        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Income Breakdown</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b dark:border-[#2a3450]">
              <span className="text-gray-700 dark:text-[#aab2cc]">Basic Salary</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(incomeRow.annual_basic_salary)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b dark:border-[#2a3450]">
              <span className="text-gray-700 dark:text-[#aab2cc]">Allowances</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(incomeRow.allowances)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b dark:border-[#2a3450]">
              <span className="text-gray-700 dark:text-[#aab2cc]">Bonus</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(incomeRow.bonus)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b dark:border-[#2a3450]">
              <span className="text-gray-700 dark:text-[#aab2cc]">Car Allowance</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(incomeRow.car_allowance)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b dark:border-[#2a3450]">
              <span className="text-gray-700 dark:text-[#aab2cc]">Other Taxable Income</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(incomeRow.other_taxable)}</span>
            </div>
            <div className="flex justify-between items-center py-2 bg-gray-50 dark:bg-[#0f1426] font-semibold">
              <span className="text-navy dark:text-[#e7eaf3]">Total Taxable Income</span>
              <span className="text-navy dark:text-[#e7eaf3]">{formatCurrency(totalTaxableIncome)}</span>
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
          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 border-l-4 border-navy/40">
            <h4 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-2">Regular Income</h4>
            <p className="text-3xl font-bold text-navy dark:text-[#e7eaf3]">{formatCurrency(regularIncome)}</p>
            <p className="text-sm text-gray-600 dark:text-[#aab2cc] mt-1">Salary, business income, etc.</p>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 border-l-4 border-green-500 dark:border-green-500/30">
            <h4 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-2">Capital Gains</h4>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{formatCurrency(capitalGains)}</p>
            <p className="text-sm text-gray-600 dark:text-[#aab2cc] mt-1">Property, securities sales</p>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 border-l-4 border-navy/40">
            <h4 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-2">Final Tax Income</h4>
            <p className="text-3xl font-bold text-navy dark:text-[#e7eaf3]">{formatCurrency(finalTaxIncome)}</p>
            <p className="text-sm text-gray-600 dark:text-[#aab2cc] mt-1">Sukuk, bonds, etc.</p>
          </div>
        </div>

        {data.regularIncome && (
          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Regular Income Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-navy dark:text-[#e7eaf3] mb-3">Taxable Income</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Basic Salary</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.annual_basic_salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Allowances</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.allowances)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Bonus</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.bonus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Car Allowance</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.car_allowance)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-navy dark:text-[#e7eaf3] mb-3">Exempt Income</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Medical Allowance</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.medical_allowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Employer Contribution</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.employer_contribution)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-[#aab2cc]">Other Exempt</span>
                    <span className="dark:text-[#e7eaf3]">{formatCurrency(data.regularIncome.other_exempt)}</span>
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
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3]">Total Adjustable Tax</h3>
            <span className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">{formatCurrency(data.totalAdjustableTax)}</span>
          </div>
          <p className="text-gray-600 dark:text-[#aab2cc]">This represents all withholding taxes and advance tax payments made during the tax year.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy dark:text-[#e7eaf3] mb-3 flex items-center">
              <Building className="w-5 h-5 mr-2 text-navy dark:text-[#e7eaf3]" />
              Employment
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Salary Tax</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.employment?.salaryTax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Directorship Fee</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.employment?.directorshipFee)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy dark:text-[#e7eaf3] mb-3 flex items-center">
              <Calculator className="w-5 h-5 mr-2 text-green-500" />
              Utilities
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Electricity</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.utilities?.electricity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Telephone</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.utilities?.telephone)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Cellphone</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.utilities?.cellphone)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy dark:text-[#e7eaf3] mb-3 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-navy dark:text-[#e7eaf3]" />
              Motor Vehicle
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Registration</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.motorVehicle?.registration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Transfer</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.motorVehicle?.transfer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Sale</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.motorVehicle?.sale)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy dark:text-[#e7eaf3] mb-3 flex items-center">
              <Building className="w-5 h-5 mr-2 text-red-500" />
              Property
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Sale/Transfer</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.property?.saleTransfer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Purchase</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.property?.purchase)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h4 className="font-semibold text-navy dark:text-[#e7eaf3] mb-3 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-yellow-500" />
              Financial
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Profit on Debt</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.financial?.profitOnDebt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Cash Withdrawal</span>
                <span className="dark:text-[#e7eaf3]">{formatCurrency(categories.financial?.cashWithdrawal)}</span>
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
          <AlertCircle className="w-12 h-12 text-gray-400 dark:text-[#7e88a6] mx-auto mb-4" />
          <p className="text-gray-600 dark:text-[#aab2cc]">No wealth statement data available for this year.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Assets Comparison</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Previous Year</span>
                <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(wealth.total_assets_previous_year)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Current Year</span>
                <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(wealth.total_assets_current_year)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t dark:border-[#2a3450]">
                <span className="text-navy dark:text-[#e7eaf3] font-semibold">Change</span>
                <span className={`font-semibold ${
                  (wealth.total_assets_current_year - wealth.total_assets_previous_year) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(wealth.total_assets_current_year - wealth.total_assets_previous_year)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
            <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Liabilities Comparison</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Previous Year</span>
                <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(wealth.total_liabilities_previous_year)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-[#aab2cc]">Current Year</span>
                <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(wealth.total_liabilities_current_year)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t dark:border-[#2a3450]">
                <span className="text-navy dark:text-[#e7eaf3] font-semibold">Change</span>
                <span className={`font-semibold ${
                  (wealth.total_liabilities_current_year - wealth.total_liabilities_previous_year) >= 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {formatCurrency(wealth.total_liabilities_current_year - wealth.total_liabilities_previous_year)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Net Worth Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-gray-600 dark:text-[#aab2cc] mb-1">Previous Year Net Worth</p>
              <p className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">{formatCurrency(wealth.net_worth_previous_year)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 dark:text-[#aab2cc] mb-1">Current Year Net Worth</p>
              <p className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">{formatCurrency(wealth.net_worth_current_year)}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 dark:text-[#aab2cc] mb-1">Wealth Increase</p>
              <p className={`text-2xl font-bold ${
                wealth.wealth_increase >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(wealth.wealth_increase)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Income vs. Wealth Reconciliation</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-[#aab2cc]">Total Taxable Income</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(data.totalTaxableIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-[#aab2cc]">Total Expenses</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-[#aab2cc]">Net Income</span>
              <span className="font-medium dark:text-[#e7eaf3]">{formatCurrency(data.totalTaxableIncome - data.totalExpenses)}</span>
            </div>
            <div className="flex justify-between border-t dark:border-[#2a3450] pt-2">
              <span className="text-navy dark:text-[#e7eaf3] font-semibold">Wealth Increase</span>
              <span className="font-semibold dark:text-[#e7eaf3]">{formatCurrency(wealth.wealth_increase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-navy dark:text-[#e7eaf3] font-semibold">Difference</span>
              <span className={`font-semibold ${
                Math.abs((data.totalTaxableIncome - data.totalExpenses) - wealth.wealth_increase) < 1000
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency((data.totalTaxableIncome - data.totalExpenses) - wealth.wealth_increase)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const timeAgo = (iso) => {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const TaxEfficiencyReport = () => {
    const a = aiAnalysis;
    return (
      <div className="space-y-6">
        {/* Intro + action */}
        <div className="rounded-brand-lg bg-navy p-6 text-white">
          <div className="flex flex-wrap items-start gap-4">
            <span className="inline-grid place-items-center rounded-brand bg-lime/25 p-2">
              <Sparkles className="w-6 h-6 text-lime" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold">AI Tax Efficiency Review</h3>
              <p className="mt-1 text-sm text-white/70">
                Reviews your return for <strong className="text-lime">legal</strong> reliefs, credits and allowances you may not have
                claimed — grounded in the Income Tax Ordinance &amp; FBR rules. Suggestions only; nothing is changed on your return.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <button
                onClick={() => loadOptimization(a ? { refresh: true } : {})}
                disabled={aiLoading}
                className="flex items-center gap-2 rounded-brand bg-lime px-4 py-2 font-semibold text-navy transition-colors hover:bg-lime/80 disabled:opacity-50"
              >
                {aiLoading
                  ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Analysing…</>)
                  : (<><Sparkles className="w-4 h-4" /> {a ? 'Re-run analysis' : 'Analyse my return'}</>)}
              </button>
              {a && aiMeta?.analysedAt && (
                <p className="mt-1 text-xs text-white/60">
                  Analysed {timeAgo(aiMeta.analysedAt)}{aiMeta.cached ? ' · cached' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {aiError && (
          <div className="rounded-brand border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/15 p-4 text-sm text-red-700 dark:text-red-400">{aiError}</div>
        )}

        {aiLoading && !a && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-navy dark:text-[#e7eaf3] animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-[#aab2cc]">The AI is reviewing your numbers against FBR rules…</p>
          </div>
        )}

        {a && (
          <>
            {a.summary && (
              <div className="rounded-brand border border-navy/15 bg-navy/[0.03] dark:bg-[#151c30] p-4 text-sm leading-relaxed text-gray-700 dark:text-[#aab2cc]">{a.summary}</div>
            )}

            {(a.opportunities || []).length === 0 ? (
              <div className="flex items-center gap-2 rounded-brand border border-lime/40 bg-lime/15 p-4 text-sm font-medium text-navy dark:text-[#e7eaf3]">
                <CheckCircle className="w-5 h-5" /> Your return already looks well-optimised — no additional legal reliefs identified.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(a.opportunities || []).map((o, i) => (
                  <div key={i} className="rounded-brand-lg border border-navy/12 bg-white dark:bg-[#151c30] p-5 shadow-brand">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Lightbulb className="w-5 h-5 shrink-0 text-lime mt-0.5" />
                        <h4 className="font-semibold leading-snug text-navy dark:text-[#e7eaf3]">{o.title}</h4>
                      </div>
                      {o.confidence && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          o.confidence === 'high' ? 'bg-lime/25 text-navy dark:text-[#e7eaf3]'
                            : o.confidence === 'medium' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-gray-100 dark:bg-[#1a2238] text-gray-500 dark:text-[#7e88a6]'}`}>{o.confidence}</span>
                      )}
                    </div>
                    {o.section && <p className="mt-1 font-mono text-xs text-navy/60 dark:text-[#7e88a6]">{o.section}</p>}
                    {o.rationale && <p className="mt-2 text-sm text-gray-600 dark:text-[#aab2cc]">{o.rationale}</p>}
                    {o.action && <p className="mt-2 text-sm text-navy dark:text-[#e7eaf3]"><span className="font-semibold">Action:</span> {o.action}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {o.estimatedSavingPKR != null && Number(o.estimatedSavingPKR) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-brand bg-lime/15 px-2.5 py-1 text-sm font-semibold text-navy dark:text-[#e7eaf3]">
                          <ArrowDownCircle className="w-4 h-4" /> Est. saving {formatCurrency(o.estimatedSavingPKR)}
                        </span>
                      )}
                      {o.formStep && (
                        <button
                          type="button"
                          onClick={() => navigate(`/income-tax/${o.formStep}`)}
                          className="inline-flex items-center gap-1 rounded-brand bg-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-dark"
                        >
                          Open {o.formStep.replace(/-/g, ' ')} form →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {a.disclaimer && (
              <div className="flex items-start gap-2 rounded-brand border border-gray-200 dark:border-[#2a3450] bg-gray-50 dark:bg-[#0f1426] p-3 text-xs text-gray-500 dark:text-[#7e88a6]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" /><span>{a.disclaimer}</span>
              </div>
            )}
          </>
        )}

        {aiRaw && (
          <pre className="whitespace-pre-wrap rounded-brand bg-gray-50 dark:bg-[#0f1426] p-4 text-xs text-gray-600 dark:text-[#aab2cc]">{aiRaw}</pre>
        )}

        {!a && !aiLoading && !aiError && (
          <div className="text-center py-10 text-gray-500 dark:text-[#7e88a6]">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-navy/30" />
            <p className="text-sm">Click <strong className="text-navy dark:text-[#e7eaf3]">Analyse my return</strong> for personalised, legal tax-saving suggestions.</p>
          </div>
        )}
      </div>
    );
  };

  if (availableYears.length === 0) {
    return (
      <div className="space-y-8">
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <h1 className="text-2xl font-bold text-navy dark:text-[#e7eaf3] mb-2">Tax Reports & Analysis</h1>
          <p className="text-gray-600 dark:text-[#aab2cc]">
            View your tax calculations, summaries, and detailed reports
          </p>
        </div>

        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 dark:text-[#7e88a6] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-navy dark:text-[#e7eaf3] mb-2">No Tax Data Available</h2>
          <p className="text-gray-600 dark:text-[#aab2cc] mb-6">
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
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy dark:text-[#e7eaf3] mb-2">Tax Reports & Analysis</h1>
            <p className="text-gray-600 dark:text-[#aab2cc]">
              View your tax calculations, summaries, and detailed reports
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="form-select border border-gray-300 dark:border-[#2a3450] dark:bg-[#151c30] dark:text-[#e7eaf3] rounded-brand px-3 py-2 focus:ring-2 focus:ring-navy/30 focus:border-transparent"
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
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand">
        <div className="border-b border-gray-200 dark:border-[#2a3450]">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'summary', label: 'Tax Summary', icon: BarChart3, endpoint: 'tax-calculation-summary' },
              { id: 'income', label: 'Income Analysis', icon: TrendingUp, endpoint: 'income-analysis' },
              { id: 'adjustable', label: 'Adjustable Tax', icon: Calculator, endpoint: 'adjustable-tax-report' },
              { id: 'wealth', label: 'Wealth Report', icon: Wallet, endpoint: 'wealth-reconciliation' },
              { id: 'efficiency', label: 'Tax Efficiency', icon: Sparkles, endpoint: null }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.endpoint) loadReport(tab.endpoint);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-lime text-navy dark:text-[#e7eaf3]'
                    : 'border-transparent text-gray-500 dark:text-[#7e88a6] hover:text-navy dark:hover:text-[#e7eaf3]'
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
            <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading report data">
              <SkeletonCards count={4} />
              <div className="rounded-lg border border-slate-200 p-5 dark:border-[#2a3450]">
                <Skeleton className="mb-4 h-4 w-40" />
                <SkeletonText lines={5} />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'summary' && <SummaryReport data={reportData} />}
              {activeTab === 'income' && <IncomeAnalysisReport data={reportData} />}
              {activeTab === 'adjustable' && <AdjustableTaxReport data={reportData} />}
              {activeTab === 'wealth' && <WealthReport data={reportData} />}
              {activeTab === 'efficiency' && <TaxEfficiencyReport />}
            </>
          )}
        </div>
      </div>

      {/* Export Options */}
      {reportData && (
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <h3 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] mb-4">Export Options</h3>
          <p className="text-gray-600 dark:text-[#aab2cc] mb-4">Download your tax reports in various formats</p>
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