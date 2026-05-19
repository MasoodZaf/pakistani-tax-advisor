/* eslint-disable react-hooks/exhaustive-deps -- bootstrap effects intentionally fire once on mount; loader callbacks are stable but not memoized */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Plus, Edit2, Trash2, Copy, Calculator, ChevronDown,
  CheckCircle, AlertTriangle, RefreshCw, X, Save,
  TrendingUp, BarChart2, Info, ArrowRight, Package, Download
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

/* ── Styles ── */
const S = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Nunito:wght@500;600;700&display=swap');
    .trm-root { font-family:'Nunito',sans-serif; }
    .trm-badge { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.02em; }
    .trm-rate-pill { display:inline-flex;align-items:center;justify-content:center;padding:4px 12px;border-radius:100px;font-family:'Bricolage Grotesque',sans-serif;font-size:13px;font-weight:800; }
    .trm-input { width:100%;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;color:#111827;outline:none;transition:border-color .18s,box-shadow .18s; }
    .trm-input:focus { border-color:#28396C;box-shadow:0 0 0 3px rgba(40,57,108,.1); }
    .trm-btn { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:9px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;border:none; }
    .trm-btn-primary { background:#28396C;color:#fff; }
    .trm-btn-primary:hover { background:#1e2d5a; }
    .trm-btn-danger  { background:#fee2e2;color:#dc2626; }
    .trm-btn-danger:hover  { background:#fecaca; }
    .trm-btn-ghost   { background:#f3f4f6;color:#374151; }
    .trm-btn-ghost:hover   { background:#e5e7eb; }
    .trm-btn-green   { background:#ecfdf5;color:#059669; }
    .trm-btn-green:hover   { background:#d1fae5; }
    .trm-slab-row { display:grid;grid-template-columns:40px 1fr 1fr 1fr 100px 90px;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;transition:background .15s; }
    .trm-slab-row:hover { background:#f9fafb; }
    .trm-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px; }
    .trm-modal { background:#fff;border-radius:16px;width:100%;max-width:520px;box-shadow:0 24px 64px rgba(0,0,0,.18);overflow:hidden; }
    .trm-preview-bar { height:28px;border-radius:4px;transition:width .5s ease;min-width:4px; }
    .rate-0    { background:#f0fdf4;color:#15803d; }
    .rate-low  { background:#fef9c3;color:#854d0e; }
    .rate-mid  { background:#fff7ed;color:#c2410c; }
    .rate-high { background:#fef2f2;color:#b91c1c; }
  `}</style>
);

const formatPKR = n => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const pct = r => (parseFloat(r) * 100).toFixed(2);

const rateClass = r => {
  const p = parseFloat(r) * 100;
  if (p === 0) return 'rate-0';
  if (p < 15)  return 'rate-low';
  if (p < 30)  return 'rate-mid';
  return 'rate-high';
};

const SLAB_TYPES = [
  { id: 'individual', label: 'Salaried / Individual' },
  { id: 'non_filer',  label: 'Non-Filer' },
  { id: 'aop',        label: 'AOP / Firm' },
  { id: 'company',    label: 'Company' },
  { id: 'small_company', label: 'Small Company' },
];

// Non-slab rate types — stored in tax_rates_config, previously only editable via SQL.
const RATE_TYPES = [
  { id: 'surcharge',           label: 'Surcharge',            desc: '10% on high-income individuals (taxable income > 10M)' },
  { id: 'super_tax',           label: 'Super Tax',            desc: 'Section 4C progressive super tax on corporate / high income' },
  { id: 'withholding',         label: 'Withholding (WHT)',    desc: 'Withholding tax rates by category (salary, dividend, rent, etc.)' },
  { id: 'capital_gains',       label: 'Capital Gains',        desc: 'CGT on securities / immovable property by holding period' },
  { id: 'final_tax',           label: 'Final Tax',            desc: 'Final-tax regime rates (export, prize, commission, etc.)' },
  { id: 'credit_cap',          label: 'Credit Cap',           desc: 'Caps and thresholds for tax credits (charity, pension, etc.)' },
  { id: 'deduction_threshold', label: 'Deduction Threshold',  desc: 'Deduction allowances and thresholds (profit on debt, etc.)' },
  { id: 'reduction',           label: 'Reduction',            desc: 'Tax reductions (teachers, IT exports, full-time researchers)' },
];

export default function TaxRatesManager() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Top-level mode: 'slabs' = progressive income-tax slabs, 'rates' = all other
  // rate_types in tax_rates_config, 'bundle' = pull curated rates-bundle from disk/URL.
  const [mode, setMode] = useState('slabs');

  const [taxYears, setTaxYears]         = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedType, setSelectedType] = useState('individual');
  const [slabs, setSlabs]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);

  // Non-slab rates state.
  const [selectedRateType, setSelectedRateType] = useState('surcharge');
  const [rateRows, setRateRows]                 = useState([]);
  const [loadingRates, setLoadingRates]         = useState(false);
  const [showRateModal, setShowRateModal]       = useState(false);
  const [editingRate, setEditingRate]           = useState(null);
  const emptyRateForm = {
    tax_year: '', rate_type: 'surcharge', rate_category: '',
    tax_rate: '', min_amount: '', max_amount: '', fixed_amount: '',
    description: '', fbr_reference: '',
  };
  const [rateForm, setRateForm] = useState(emptyRateForm);

  // Rates-bundle state.
  const [bundleInfo, setBundleInfo]         = useState(null);
  const [bundlePreview, setBundlePreview]   = useState(null);
  const [bundleLoading, setBundleLoading]   = useState(false);
  const [bundleApplying, setBundleApplying] = useState(false);

  // Modals
  const [showSlabModal, setShowSlabModal]   = useState(false);
  const [editingSlab, setEditingSlab]       = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [showYearModal, setShowYearModal]   = useState(false);
  const [showPreview, setShowPreview]       = useState(false);

  // Preview
  const [previewIncome, setPreviewIncome] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form state
  const emptyForm = { slab_name:'', slab_order:'', min_income:'', max_income:'', tax_rate:'', slab_type: selectedType, effective_from:'' };
  const [form, setForm] = useState(emptyForm);
  const [cloneForm, setCloneForm] = useState({ fromYearId:'', toYearId:'' });
  const [yearForm, setYearForm] = useState({ taxYear:'', startDate:'', endDate:'', filingDeadline:'', isCurrent: false, description:'' });

  const loadTaxYears = useCallback(async () => {
    try {
      const r = await axios.get('/api/admin/tax-years');
      if (r.data.success) {
        setTaxYears(r.data.data);
        if (!selectedYear && r.data.data.length) setSelectedYear(r.data.data[0].id);
      }
    } catch { toast.error('Failed to load tax years'); }
  }, [selectedYear]);

  const loadSlabs = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    try {
      const r = await axios.get('/api/admin/tax-slabs', { params: { taxYearId: selectedYear, slabType: selectedType } });
      if (r.data.success) setSlabs(r.data.data);
    } catch { toast.error('Failed to load tax slabs'); }
    finally { setLoading(false); }
  }, [selectedYear, selectedType]);

  const currentYearData = taxYears.find(y => y.id === selectedYear);

  const loadRates = useCallback(async () => {
    if (!currentYearData) return;
    setLoadingRates(true);
    try {
      const r = await axios.get('/api/admin/tax-rates', {
        params: { taxYear: currentYearData.tax_year, rateType: selectedRateType },
      });
      if (r.data.success) setRateRows(r.data.data);
    } catch { toast.error('Failed to load rates'); }
    finally { setLoadingRates(false); }
  }, [currentYearData, selectedRateType]);

  const loadBundleInfo = useCallback(async () => {
    try {
      const r = await axios.get('/api/admin/rates-bundle/info');
      if (r.data.success) setBundleInfo(r.data.data);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to load bundle info'); }
  }, []);

  const loadBundlePreview = useCallback(async () => {
    setBundleLoading(true);
    try {
      const r = await axios.get('/api/admin/rates-bundle/preview');
      if (r.data.success) setBundlePreview(r.data.data);
    } catch (e) { toast.error(e.response?.data?.error || 'Preview failed'); }
    finally { setBundleLoading(false); }
  }, []);

  useEffect(() => { loadTaxYears(); }, []);
  useEffect(() => { loadSlabs(); }, [selectedYear, selectedType]);
  useEffect(() => {
    if (mode === 'rates') loadRates();
  }, [mode, selectedRateType, selectedYear, loadRates]);
  useEffect(() => {
    if (mode === 'bundle') {
      loadBundleInfo();
      loadBundlePreview();
    }
  }, [mode, loadBundleInfo, loadBundlePreview]);

  const openAdd = () => {
    const nextOrder = slabs.length ? Math.max(...slabs.map(s => s.slab_order)) + 1 : 1;
    const lastMax = slabs.length && slabs[slabs.length-1].max_income
      ? (parseFloat(slabs[slabs.length-1].max_income) + 1).toString()
      : '';
    setForm({ ...emptyForm, slab_order: nextOrder, min_income: lastMax, slab_type: selectedType });
    setEditingSlab(null);
    setShowSlabModal(true);
  };

  const openEdit = slab => {
    setForm({
      slab_name: slab.slab_name, slab_order: slab.slab_order,
      min_income: slab.min_income, max_income: slab.max_income || '',
      tax_rate: (parseFloat(slab.tax_rate) * 100).toFixed(2),
      slab_type: slab.slab_type, effective_from: slab.effective_from?.slice(0,10) || ''
    });
    setEditingSlab(slab);
    setShowSlabModal(true);
  };

  const saveSlab = async () => {
    if (!form.slab_order || form.min_income === '' || form.tax_rate === '') {
      toast.error('Slab order, minimum income, and tax rate are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tax_year_id: selectedYear,
        slab_name: form.slab_name || `Slab ${form.slab_order}`,
        slab_order: parseInt(form.slab_order),
        min_income: parseFloat(form.min_income),
        max_income: form.max_income !== '' ? parseFloat(form.max_income) : null,
        tax_rate: parseFloat(form.tax_rate) / 100, // convert % to decimal
        slab_type: form.slab_type,
        effective_from: form.effective_from || undefined,
      };
      if (editingSlab) {
        await axios.put(`/api/admin/tax-slabs/${editingSlab.id}`, payload);
        toast.success('Slab updated');
      } else {
        await axios.post('/api/admin/tax-slabs', payload);
        toast.success('Slab created');
      }
      setShowSlabModal(false);
      loadSlabs();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteSlab = async slab => {
    if (!window.confirm(`Delete "${slab.slab_name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/admin/tax-slabs/${slab.id}`);
      toast.success('Slab deleted');
      loadSlabs();
    } catch (e) { toast.error(e.response?.data?.error || 'Delete failed'); }
  };

  const cloneSlabs = async () => {
    if (!cloneForm.fromYearId || !cloneForm.toYearId) { toast.error('Select both source and target years'); return; }
    if (cloneForm.fromYearId === cloneForm.toYearId)  { toast.error('Source and target must differ'); return; }
    setSaving(true);
    try {
      const r = await axios.post('/api/admin/tax-slabs/clone', {
        fromTaxYearId: cloneForm.fromYearId,
        toTaxYearId:   cloneForm.toYearId,
        slabType:      selectedType,
      });
      toast.success(r.data.message);
      setShowCloneModal(false);
      if (cloneForm.toYearId === selectedYear) loadSlabs();
    } catch (e) { toast.error(e.response?.data?.error || 'Clone failed'); }
    finally { setSaving(false); }
  };

  const runPreview = async () => {
    if (!previewIncome || isNaN(parseFloat(previewIncome))) { toast.error('Enter a valid income amount'); return; }
    setPreviewLoading(true);
    try {
      const r = await axios.post('/api/admin/tax-slabs/preview', {
        taxYearId: selectedYear,
        income: parseFloat(previewIncome),
        slabType: selectedType,
      });
      setPreviewResult(r.data.data);
    } catch (e) { toast.error(e.response?.data?.error || 'Preview failed'); }
    finally { setPreviewLoading(false); }
  };

  const createYear = async () => {
    if (!yearForm.taxYear) { toast.error('Tax year is required'); return; }
    setSaving(true);
    try {
      await axios.post('/api/admin/tax-years', yearForm);
      toast.success(`Tax year ${yearForm.taxYear} created`);
      setShowYearModal(false);
      setYearForm({ taxYear:'', startDate:'', endDate:'', filingDeadline:'', isCurrent: false, description:'' });
      loadTaxYears();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create year'); }
    finally { setSaving(false); }
  };

  // ── Non-slab rate CRUD ────────────────────────────────────────────────
  const openAddRate = () => {
    setRateForm({
      ...emptyRateForm,
      tax_year: currentYearData?.tax_year || '',
      rate_type: selectedRateType,
    });
    setEditingRate(null);
    setShowRateModal(true);
  };

  const openEditRate = (row) => {
    setRateForm({
      tax_year: row.tax_year,
      rate_type: row.rate_type,
      rate_category: row.rate_category,
      tax_rate: row.tax_rate !== null ? (parseFloat(row.tax_rate) * 100).toFixed(2) : '',
      min_amount: row.min_amount ?? '',
      max_amount: row.max_amount ?? '',
      fixed_amount: row.fixed_amount ?? '',
      description: row.description || '',
      fbr_reference: row.fbr_reference || '',
    });
    setEditingRate(row);
    setShowRateModal(true);
  };

  const saveRate = async () => {
    if (!rateForm.rate_category || rateForm.tax_rate === '') {
      toast.error('Rate category and tax rate are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tax_year: rateForm.tax_year,
        rate_type: rateForm.rate_type,
        rate_category: rateForm.rate_category,
        tax_rate: parseFloat(rateForm.tax_rate) / 100,
        min_amount: rateForm.min_amount !== '' ? parseFloat(rateForm.min_amount) : 0,
        max_amount: rateForm.max_amount !== '' ? parseFloat(rateForm.max_amount) : 999999999999,
        fixed_amount: rateForm.fixed_amount !== '' ? parseFloat(rateForm.fixed_amount) : 0,
        description: rateForm.description || null,
        fbr_reference: rateForm.fbr_reference || null,
      };
      if (editingRate) {
        await axios.put(`/api/admin/tax-rates/${editingRate.id}`, payload);
        toast.success('Rate updated');
      } else {
        await axios.post('/api/admin/tax-rates', payload);
        toast.success('Rate created');
      }
      setShowRateModal(false);
      loadRates();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteRate = async (row) => {
    if (!window.confirm(`Delete rate "${row.rate_category}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/admin/tax-rates/${row.id}`);
      toast.success('Rate deleted');
      loadRates();
    } catch (e) { toast.error(e.response?.data?.error || 'Delete failed'); }
  };

  // ── Bundle apply ──────────────────────────────────────────────────────
  const applyBundle = async () => {
    if (!bundlePreview || bundlePreview.total_changes === 0) {
      toast('No changes to apply', { icon: 'ℹ️' });
      return;
    }
    if (!window.confirm(`Apply ${bundlePreview.total_changes} change(s) from the rates bundle? Slabs and rates will be upserted atomically.`)) return;
    setBundleApplying(true);
    try {
      const r = await axios.post('/api/admin/rates-bundle/apply');
      if (r.data.success) {
        toast.success(`Bundle applied: ${r.data.data.applied.length} year(s) updated`);
        await loadBundlePreview();
        loadSlabs();
        if (mode === 'rates') loadRates();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Apply failed');
    } finally { setBundleApplying(false); }
  };

  const maxTax = Math.max(...slabs.map(s => parseFloat(s.tax_rate) * 100), 1);

  return (
    <div className="trm-root space-y-6">
      <S />

      {/* ── Header ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontSize:22, fontWeight:800, color:'#111827', margin:0 }}>
              Tax Rates Manager
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Configure FBR tax slabs and rates by year. Changes apply to all new calculations immediately.
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2">
              {mode === 'slabs' && (
                <>
                  <button className="trm-btn trm-btn-ghost" onClick={() => setShowCloneModal(true)}>
                    <Copy size={15} /> Clone Year
                  </button>
                  <button className="trm-btn trm-btn-ghost" onClick={() => setShowYearModal(true)}>
                    <Plus size={15} /> New Tax Year
                  </button>
                  <button className="trm-btn trm-btn-primary" onClick={openAdd}>
                    <Plus size={15} /> Add Slab
                  </button>
                </>
              )}
              {mode === 'rates' && (
                <button className="trm-btn trm-btn-primary" onClick={openAddRate}>
                  <Plus size={15} /> Add Rate
                </button>
              )}
              {mode === 'bundle' && (
                <>
                  <button className="trm-btn trm-btn-ghost" onClick={() => { loadBundleInfo(); loadBundlePreview(); }}>
                    <RefreshCw size={15} className={bundleLoading ? 'animate-spin' : ''} /> Re-check
                  </button>
                  <button
                    className="trm-btn trm-btn-primary"
                    onClick={applyBundle}
                    disabled={bundleApplying || !bundlePreview || bundlePreview.total_changes === 0}
                    title={!bundlePreview ? 'Loading…' : bundlePreview.total_changes === 0 ? 'Nothing to apply' : ''}
                  >
                    {bundleApplying ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                    Apply Bundle
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Mode switcher — Slabs / Other Rates / Bundle Updates */}
        <div className="flex gap-2 mt-5" style={{ borderBottom: '1px solid #f3f4f6' }}>
          {[
            { id: 'slabs',  label: 'Tax Slabs',      icon: <BarChart2 size={14} /> },
            { id: 'rates',  label: 'Other Rates',    icon: <TrendingUp size={14} /> },
            { id: 'bundle', label: 'Bundle Updates', icon: <Package size={14} /> },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'10px 16px', border:'none', background:'none', cursor:'pointer',
                fontFamily:'Nunito,sans-serif', fontSize:13, fontWeight:700,
                color: mode === m.id ? '#28396C' : '#6b7280',
                borderBottom: mode === m.id ? '2px solid #28396C' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Year + Type selectors (slabs & rates only; bundle has none) */}
        {mode !== 'bundle' && (
        <div className="flex flex-wrap gap-4 mt-5">
          <div>
            <label className="block text-xs font-700 text-gray-500 mb-1 uppercase tracking-wider">Tax Year</label>
            <div className="relative">
              <select
                value={selectedYear || ''}
                onChange={e => setSelectedYear(e.target.value)}
                className="trm-input pr-8 cursor-pointer"
                style={{ minWidth: 140 }}
              >
                {taxYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.tax_year}{y.is_current ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#6b7280' }} />
            </div>
          </div>

          {mode === 'slabs' && (
            <div>
              <label className="block text-xs font-700 text-gray-500 mb-1 uppercase tracking-wider">Slab Type</label>
              <div className="flex flex-wrap gap-2">
                {SLAB_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedType(t.id)}
                    style={{
                      padding:'6px 14px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', border:'1.5px solid',
                      borderColor: selectedType === t.id ? '#28396C' : '#e5e7eb',
                      background:  selectedType === t.id ? '#28396C' : '#fff',
                      color:       selectedType === t.id ? '#fff' : '#374151',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'rates' && (
            <div>
              <label className="block text-xs font-700 text-gray-500 mb-1 uppercase tracking-wider">Rate Type</label>
              <div className="flex flex-wrap gap-2">
                {RATE_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedRateType(t.id)}
                    title={t.desc}
                    style={{
                      padding:'6px 14px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', border:'1.5px solid',
                      borderColor: selectedRateType === t.id ? '#28396C' : '#e5e7eb',
                      background:  selectedRateType === t.id ? '#28396C' : '#fff',
                      color:       selectedRateType === t.id ? '#fff' : '#374151',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── Slabs Table (mode === 'slabs') ── */}
      {mode === 'slabs' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, color:'#111827', fontSize:16 }}>
              {SLAB_TYPES.find(t=>t.id===selectedType)?.label} — {currentYearData?.tax_year}
            </span>
            <span className="ml-3 text-xs text-gray-400 font-600">{slabs.length} slab{slabs.length!==1?'s':''}</span>
          </div>
          <div className="flex gap-2">
            <button className="trm-btn trm-btn-ghost" style={{ padding:'6px 12px' }} onClick={() => setShowPreview(!showPreview)}>
              <Calculator size={14} /> {showPreview ? 'Hide' : 'Preview'} Tax
            </button>
            <button className="trm-btn trm-btn-ghost" style={{ padding:'6px 12px' }} onClick={loadSlabs}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Column headers */}
        {slabs.length > 0 && (
          <div className="trm-slab-row" style={{ background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>#</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Min Income</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Max Income</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Slab Name</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Rate</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Actions</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-gray-300" size={28} />
          </div>
        ) : slabs.length === 0 ? (
          <div className="py-16 text-center">
            <BarChart2 size={40} style={{ margin:'0 auto 12px', color:'#d1d5db' }} />
            <p style={{ fontWeight:700, color:'#374151', marginBottom:4 }}>No slabs configured</p>
            <p style={{ fontSize:13, color:'#9ca3af' }}>
              {isSuperAdmin ? 'Click "Add Slab" to add the first tax slab for this year and type.' : 'Contact Super Admin to configure tax slabs.'}
            </p>
            {isSuperAdmin && (
              <button className="trm-btn trm-btn-primary" style={{ marginTop:16 }} onClick={openAdd}>
                <Plus size={15} /> Add First Slab
              </button>
            )}
          </div>
        ) : (
          <div>
            {slabs.map((slab, idx) => (
              <div key={slab.id} className="trm-slab-row" style={{ borderBottom: idx < slabs.length-1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ width:28, height:28, borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#6b7280' }}>
                  {slab.slab_order}
                </span>
                <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:14, color:'#111827' }}>
                  {formatPKR(slab.min_income)}
                </span>
                <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:14, color:'#111827' }}>
                  {slab.max_income ? formatPKR(slab.max_income) : <span style={{ color:'#9ca3af', fontStyle:'italic' }}>Unlimited</span>}
                </span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:'#374151', margin:0 }}>{slab.slab_name}</p>
                  {/* Rate bar */}
                  <div style={{ marginTop:4, height:4, background:'#f3f4f6', borderRadius:4, overflow:'hidden', maxWidth:120 }}>
                    <div style={{ height:'100%', background: parseFloat(slab.tax_rate) === 0 ? '#86efac' : '#28396C', borderRadius:4, width: `${Math.min((parseFloat(slab.tax_rate)*100/maxTax)*100, 100)}%`, transition:'width .4s' }} />
                  </div>
                </div>
                <span className={`trm-rate-pill ${rateClass(slab.tax_rate)}`}>
                  {pct(slab.tax_rate)}%
                </span>
                {isSuperAdmin ? (
                  <div className="flex gap-1">
                    <button className="trm-btn trm-btn-ghost" style={{ padding:'5px 8px' }} onClick={() => openEdit(slab)} title="Edit">
                      <Edit2 size={13} />
                    </button>
                    <button className="trm-btn trm-btn-danger" style={{ padding:'5px 8px' }} onClick={() => deleteSlab(slab)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize:11, color:'#9ca3af' }}>Read-only</span>
                )}
              </div>
            ))}

            {/* Summary footer */}
            <div style={{ padding:'12px 16px', background:'#f9fafb', borderTop:'1px solid #f3f4f6', display:'flex', gap:24 }}>
              <div>
                <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>Min Rate</span>
                <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:18, color:'#059669', margin:'2px 0 0' }}>
                  {Math.min(...slabs.map(s => parseFloat(s.tax_rate)*100)).toFixed(0)}%
                </p>
              </div>
              <div>
                <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>Max Rate</span>
                <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:18, color:'#dc2626', margin:'2px 0 0' }}>
                  {Math.max(...slabs.map(s => parseFloat(s.tax_rate)*100)).toFixed(0)}%
                </p>
              </div>
              <div>
                <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>Brackets</span>
                <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:18, color:'#28396C', margin:'2px 0 0' }}>
                  {slabs.length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      )}

      {/* ── Other Rates Table (mode === 'rates') ── */}
      {mode === 'rates' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, color:'#111827', fontSize:16 }}>
              {RATE_TYPES.find(t=>t.id===selectedRateType)?.label} — {currentYearData?.tax_year}
            </span>
            <span className="ml-3 text-xs text-gray-400 font-600">{rateRows.length} row{rateRows.length!==1?'s':''}</span>
            <p style={{ fontSize:12, color:'#6b7280', margin:'4px 0 0' }}>
              {RATE_TYPES.find(t=>t.id===selectedRateType)?.desc}
            </p>
          </div>
          <button className="trm-btn trm-btn-ghost" style={{ padding:'6px 12px' }} onClick={loadRates}>
            <RefreshCw size={14} className={loadingRates ? 'animate-spin' : ''} />
          </button>
        </div>

        {rateRows.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'minmax(220px, 2.2fr) 120px 120px 120px 100px minmax(200px, 2.5fr) 90px', gap:12, padding:'12px 20px', background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
            {[
              { label:'Category', align:'left' },
              { label:'Min',      align:'right' },
              { label:'Max',      align:'right' },
              { label:'Fixed',    align:'right' },
              { label:'Rate',     align:'center' },
              { label:'Description', align:'left' },
              { label:'Actions',  align:'right' },
            ].map(h => (
              <span key={h.label} style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', textAlign: h.align, letterSpacing:'.03em' }}>{h.label}</span>
            ))}
          </div>
        )}

        {loadingRates ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-gray-300" size={28} />
          </div>
        ) : rateRows.length === 0 ? (
          <div className="py-16 text-center">
            <TrendingUp size={40} style={{ margin:'0 auto 12px', color:'#d1d5db' }} />
            <p style={{ fontWeight:700, color:'#374151', marginBottom:4 }}>No {RATE_TYPES.find(t=>t.id===selectedRateType)?.label.toLowerCase()} rates configured</p>
            <p style={{ fontSize:13, color:'#9ca3af' }}>
              {isSuperAdmin ? 'Click "Add Rate" to create one.' : 'Contact Super Admin to configure.'}
            </p>
            {isSuperAdmin && (
              <button className="trm-btn trm-btn-primary" style={{ marginTop:16 }} onClick={openAddRate}>
                <Plus size={15} /> Add First Rate
              </button>
            )}
          </div>
        ) : (
          <div>
            {rateRows.map((row, idx) => {
              const minVal  = row.min_amount;
              const maxVal  = row.max_amount;
              const fixVal  = row.fixed_amount;
              const minTxt  = minVal > 0 ? formatPKR(minVal) : '—';
              const maxTxt  = (maxVal == null || maxVal === 0)
                ? '—'
                : maxVal >= 999999999999
                  ? 'Unlimited'
                  : formatPKR(maxVal);
              const fixTxt  = fixVal > 0 ? formatPKR(fixVal) : '—';
              return (
                <div
                  key={row.id}
                  style={{
                    display:'grid',
                    gridTemplateColumns:'minmax(220px, 2.2fr) 120px 120px 120px 100px minmax(200px, 2.5fr) 90px',
                    gap:12,
                    padding:'14px 20px',
                    alignItems:'center',
                    borderBottom: idx < rateRows.length-1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <span style={{ fontSize:13, fontWeight:700, color:'#111827', wordBreak:'break-word', lineHeight:1.4 }}>
                    {row.rate_category}
                  </span>
                  <span style={{ fontSize:13, fontWeight:600, color: minTxt === '—' ? '#9ca3af' : '#374151', textAlign:'right', fontFamily: minTxt === '—' ? 'inherit' : 'Bricolage Grotesque,sans-serif' }}>
                    {minTxt}
                  </span>
                  <span style={{ fontSize:13, fontWeight:600, textAlign:'right',
                                 color: maxTxt === '—' ? '#9ca3af' : maxTxt === 'Unlimited' ? '#9ca3af' : '#374151',
                                 fontStyle: maxTxt === 'Unlimited' ? 'italic' : 'normal',
                                 fontFamily: (maxTxt === '—' || maxTxt === 'Unlimited') ? 'inherit' : 'Bricolage Grotesque,sans-serif' }}>
                    {maxTxt}
                  </span>
                  <span style={{ fontSize:13, fontWeight:600, color: fixTxt === '—' ? '#9ca3af' : '#374151', textAlign:'right', fontFamily: fixTxt === '—' ? 'inherit' : 'Bricolage Grotesque,sans-serif' }}>
                    {fixTxt}
                  </span>
                  <span className={`trm-rate-pill ${rateClass(row.tax_rate)}`} style={{ justifySelf:'center' }}>
                    {pct(row.tax_rate)}%
                  </span>
                  <span style={{ fontSize:12, color:'#6b7280', lineHeight:1.4 }} title={row.fbr_reference || ''}>
                    {row.description || <em style={{color:'#9ca3af'}}>—</em>}
                  </span>
                  {isSuperAdmin ? (
                    <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                      <button className="trm-btn trm-btn-ghost" style={{ padding:'5px 8px' }} onClick={() => openEditRate(row)} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button className="trm-btn trm-btn-danger" style={{ padding:'5px 8px' }} onClick={() => deleteRate(row)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize:11, color:'#9ca3af', textAlign:'right' }}>Read-only</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Bundle Updates (mode === 'bundle') ── */}
      {mode === 'bundle' && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Package size={18} style={{ color:'#28396C' }} />
            <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, color:'#111827', fontSize:16 }}>
              Rates Bundle
            </span>
            {bundleInfo?.checksum_ok && (
              <span className="trm-badge" style={{ background:'#ecfdf5', color:'#059669' }}>
                <CheckCircle size={11} /> Verified
              </span>
            )}
            {bundleInfo && !bundleInfo.checksum_ok && (
              <span className="trm-badge" style={{ background:'#fef2f2', color:'#b91c1c' }}>
                <AlertTriangle size={11} /> Checksum mismatch
              </span>
            )}
          </div>
          <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>
            Curated JSON bundle of Finance Act slabs &amp; rates. Preview the diff against your database, then apply atomically. Source:&nbsp;
            <code style={{ fontSize:12, background:'#f3f4f6', padding:'2px 6px', borderRadius:4 }}>
              {bundleInfo?.source?.startsWith('http') ? bundleInfo.source : 'local file'}
            </code>
          </p>
        </div>

        {bundleInfo && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12, padding:'16px 24px', borderBottom:'1px solid #f3f4f6' }}>
            {[
              { label:'Version',     value: bundleInfo.version || '—' },
              { label:'Generated',   value: bundleInfo.generated_at ? new Date(bundleInfo.generated_at).toLocaleDateString() : '—' },
              { label:'Years',       value: (bundleInfo.years || []).join(', ') || '—' },
              { label:'Total Slabs', value: bundleInfo.total_slabs ?? '—' },
              { label:'Total Rates', value: bundleInfo.total_rates ?? '—' },
            ].map(c => (
              <div key={c.label}>
                <p style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', margin:0 }}>{c.label}</p>
                <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:15, color:'#111827', margin:'4px 0 0' }}>{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {bundleLoading && !bundlePreview ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-gray-300" size={28} />
          </div>
        ) : bundlePreview ? (
          <div>
            <div style={{ padding:'12px 24px', background:'#f9fafb', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>
                Total changes: <strong style={{ color: bundlePreview.total_changes > 0 ? '#d97706' : '#059669' }}>{bundlePreview.total_changes}</strong>
              </span>
              {bundlePreview.total_changes === 0 && (
                <span style={{ fontSize:12, color:'#059669', fontWeight:600 }}>
                  <CheckCircle size={12} style={{ display:'inline', marginRight:4 }} />
                  Database matches bundle — nothing to apply
                </span>
              )}
            </div>

            {(bundlePreview.years || []).map(y => {
              const s = y.summary;
              const nothing = s.slabs_add + s.slabs_update + s.slabs_remove + s.rates_add + s.rates_update + s.rates_remove === 0;
              return (
                <div key={y.tax_year} style={{ padding:'14px 24px', borderBottom:'1px solid #f3f4f6' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:14, color:'#111827' }}>
                      Tax Year {y.tax_year}
                    </span>
                    {nothing && <span className="trm-badge" style={{ background:'#ecfdf5', color:'#059669' }}>No changes</span>}
                  </div>
                  {!nothing && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:16, fontSize:12, color:'#374151' }}>
                      {s.slabs_add    > 0 && <span><strong style={{color:'#059669'}}>+{s.slabs_add}</strong> slabs</span>}
                      {s.slabs_update > 0 && <span><strong style={{color:'#d97706'}}>~{s.slabs_update}</strong> slabs changed</span>}
                      {s.slabs_remove > 0 && <span><strong style={{color:'#dc2626'}}>-{s.slabs_remove}</strong> slabs</span>}
                      {s.rates_add    > 0 && <span><strong style={{color:'#059669'}}>+{s.rates_add}</strong> rates</span>}
                      {s.rates_update > 0 && <span><strong style={{color:'#d97706'}}>~{s.rates_update}</strong> rates changed</span>}
                      {s.rates_remove > 0 && <span><strong style={{color:'#dc2626'}}>-{s.rates_remove}</strong> rates</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Package size={36} style={{ margin:'0 auto 12px', color:'#d1d5db' }} />
            <p style={{ fontSize:13, color:'#6b7280' }}>Click Re-check to load the bundle diff.</p>
          </div>
        )}
      </div>
      )}

      {/* ── Tax Preview Panel (slabs mode only) ── */}
      {mode === 'slabs' && showPreview && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} style={{ color:'#28396C' }} />
            <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, color:'#111827', fontSize:16 }}>
              Tax Calculator Preview
            </span>
          </div>
          <div className="flex gap-3 mb-5">
            <input
              type="number"
              placeholder="Enter annual income (PKR)"
              value={previewIncome}
              onChange={e => setPreviewIncome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runPreview()}
              className="trm-input"
              style={{ maxWidth:280 }}
            />
            <button className="trm-btn trm-btn-primary" onClick={runPreview} disabled={previewLoading}>
              {previewLoading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              Calculate
            </button>
          </div>

          {previewResult && (
            <div>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {[
                  { label:'Annual Income',   value: formatPKR(previewResult.income),     color:'#3b82f6' },
                  { label:'Total Tax',       value: formatPKR(previewResult.totalTax),   color:'#ef4444' },
                  { label:'Effective Rate',  value: previewResult.effectiveRate,          color:'#f59e0b' },
                  { label:'Marginal Rate',   value: previewResult.marginalRate,           color:'#8b5cf6' },
                ].map(c => (
                  <div key={c.label} style={{ background:'#f9fafb', borderRadius:12, padding:'14px 16px', borderLeft:`4px solid ${c.color}` }}>
                    <p style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', margin:0 }}>{c.label}</p>
                    <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:18, color:'#111827', margin:'4px 0 0' }}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Slab breakdown */}
              <div style={{ border:'1px solid #f3f4f6', borderRadius:10, overflow:'hidden' }}>
                <div style={{ padding:'10px 16px', background:'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>Slab Breakdown</span>
                </div>
                {previewResult.breakdown.map((b, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 100px 100px', gap:12, padding:'10px 16px', borderBottom: i < previewResult.breakdown.length-1 ? '1px solid #f9fafb' : 'none', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#6b7280' }}>{b.slab_name}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{formatPKR(b.taxable_amount)}</span>
                    <span className={`trm-rate-pill ${rateClass(parseFloat(b.rate)/100)}`} style={{ fontSize:12 }}>{b.rate}</span>
                    <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:700, fontSize:14, color:'#dc2626' }}>{formatPKR(b.tax_amount)}</span>
                  </div>
                ))}
                <div style={{ padding:'12px 16px', background:'#eff6ff', borderTop:'2px solid #dbeafe', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, color:'#1e40af' }}>Total Tax Liability</span>
                  <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:20, color:'#1e40af' }}>{formatPKR(previewResult.totalTax)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FBR Notice ── */}
      <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'14px 18px', display:'flex', gap:10, alignItems:'flex-start' }}>
        <Info size={16} style={{ color:'#d97706', flexShrink:0, marginTop:2 }} />
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:'#92400e', margin:0 }}>FBR Rate Update Guidance</p>
          <p style={{ fontSize:12, color:'#b45309', margin:'4px 0 0', lineHeight:1.5 }}>
            When the Finance Act is published (typically June–July), create a new tax year, use <strong>Clone Year</strong> to copy existing slabs, then edit each slab to reflect the new FBR rates.
            All users filing under the new year will automatically use the updated rates.
          </p>
        </div>
      </div>

      {/* ── Slab Modal ── */}
      {showSlabModal && (
        <div className="trm-modal-overlay" onClick={e => e.target === e.currentTarget && setShowSlabModal(false)}>
          <div className="trm-modal">
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:17, color:'#111827' }}>
                {editingSlab ? 'Edit Tax Slab' : 'Add Tax Slab'}
              </span>
              <button onClick={() => setShowSlabModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-700 text-gray-500 mb-1">Slab Name</label>
                  <input className="trm-input" placeholder="e.g. Up to 600K" value={form.slab_name} onChange={e => setForm(p=>({...p,slab_name:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Order #</label>
                  <input className="trm-input" type="number" min="1" value={form.slab_order} onChange={e => setForm(p=>({...p,slab_order:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Slab Type</label>
                  <select className="trm-input" value={form.slab_type} onChange={e => setForm(p=>({...p,slab_type:e.target.value}))}>
                    {SLAB_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Min Income (PKR) *</label>
                  <input className="trm-input" type="number" min="0" placeholder="0" value={form.min_income} onChange={e => setForm(p=>({...p,min_income:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Max Income (PKR) <span style={{color:'#9ca3af'}}>leave blank = unlimited</span></label>
                  <input className="trm-input" type="number" min="0" placeholder="Unlimited" value={form.max_income} onChange={e => setForm(p=>({...p,max_income:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Tax Rate (%) *</label>
                  <input className="trm-input" type="number" min="0" max="100" step="0.01" placeholder="e.g. 15.00" value={form.tax_rate} onChange={e => setForm(p=>({...p,tax_rate:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Effective From</label>
                  <input className="trm-input" type="date" value={form.effective_from} onChange={e => setForm(p=>({...p,effective_from:e.target.value}))} />
                </div>
              </div>

              {form.tax_rate !== '' && (
                <div style={{ marginTop:16, padding:'12px 14px', background:'#f0fdf4', borderRadius:8, display:'flex', alignItems:'center', gap:8 }}>
                  <CheckCircle size={14} style={{ color:'#16a34a' }} />
                  <span style={{ fontSize:13, color:'#15803d', fontWeight:600 }}>
                    Rate: <strong>{parseFloat(form.tax_rate||0).toFixed(2)}%</strong>
                    {form.min_income && <> &nbsp;·&nbsp; Income {formatPKR(form.min_income)}{form.max_income ? ` – ${formatPKR(form.max_income)}` : '+'}</>}
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="trm-btn trm-btn-ghost" onClick={() => setShowSlabModal(false)}>Cancel</button>
              <button className="trm-btn trm-btn-primary" onClick={saveSlab} disabled={saving}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                {editingSlab ? 'Update Slab' : 'Create Slab'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rate Modal (non-slab rates) ── */}
      {showRateModal && (
        <div className="trm-modal-overlay" onClick={e => e.target === e.currentTarget && setShowRateModal(false)}>
          <div className="trm-modal" style={{ maxWidth: 600 }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:17, color:'#111827' }}>
                {editingRate ? 'Edit Rate' : 'Add Rate'} — {RATE_TYPES.find(t=>t.id===rateForm.rate_type)?.label}
              </span>
              <button onClick={() => setShowRateModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Tax Year *</label>
                  <select className="trm-input" value={rateForm.tax_year} onChange={e => setRateForm(p=>({...p,tax_year:e.target.value}))} disabled={!!editingRate}>
                    {taxYears.map(y => <option key={y.id} value={y.tax_year}>{y.tax_year}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Rate Type *</label>
                  <select className="trm-input" value={rateForm.rate_type} onChange={e => setRateForm(p=>({...p,rate_type:e.target.value}))} disabled={!!editingRate}>
                    {RATE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-700 text-gray-500 mb-1">Category *</label>
                  <input
                    className="trm-input"
                    placeholder="e.g. salary, dividend, rent_immovable"
                    value={rateForm.rate_category}
                    onChange={e => setRateForm(p=>({...p,rate_category:e.target.value}))}
                    disabled={!!editingRate}
                  />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Tax Rate (%) *</label>
                  <input className="trm-input" type="number" min="0" max="100" step="0.01" placeholder="10.00" value={rateForm.tax_rate} onChange={e => setRateForm(p=>({...p,tax_rate:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Fixed Amount (PKR)</label>
                  <input className="trm-input" type="number" min="0" placeholder="0" value={rateForm.fixed_amount} onChange={e => setRateForm(p=>({...p,fixed_amount:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Min Amount (PKR)</label>
                  <input className="trm-input" type="number" min="0" placeholder="0" value={rateForm.min_amount} onChange={e => setRateForm(p=>({...p,min_amount:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Max Amount (PKR) <span style={{color:'#9ca3af'}}>blank = unlimited</span></label>
                  <input className="trm-input" type="number" min="0" placeholder="Unlimited" value={rateForm.max_amount} onChange={e => setRateForm(p=>({...p,max_amount:e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-700 text-gray-500 mb-1">Description</label>
                  <input className="trm-input" placeholder="Human-readable note" value={rateForm.description} onChange={e => setRateForm(p=>({...p,description:e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-700 text-gray-500 mb-1">FBR Reference</label>
                  <input className="trm-input" placeholder="e.g. Section 4C / Division I" value={rateForm.fbr_reference} onChange={e => setRateForm(p=>({...p,fbr_reference:e.target.value}))} />
                </div>
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="trm-btn trm-btn-ghost" onClick={() => setShowRateModal(false)}>Cancel</button>
              <button className="trm-btn trm-btn-primary" onClick={saveRate} disabled={saving}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                {editingRate ? 'Update Rate' : 'Create Rate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clone Modal ── */}
      {showCloneModal && (
        <div className="trm-modal-overlay" onClick={e => e.target === e.currentTarget && setShowCloneModal(false)}>
          <div className="trm-modal">
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:17, color:'#111827' }}>Clone Tax Slabs</span>
              <button onClick={() => setShowCloneModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={20} /></button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <p style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
                Copy all <strong>{SLAB_TYPES.find(t=>t.id===selectedType)?.label}</strong> slabs from one tax year to another.
                Existing slabs in the target year (for this type) will be replaced.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Source Year (copy FROM)</label>
                  <select className="trm-input" value={cloneForm.fromYearId} onChange={e => setCloneForm(p=>({...p,fromYearId:e.target.value}))}>
                    <option value="">Select year...</option>
                    {taxYears.map(y => <option key={y.id} value={y.id}>{y.tax_year}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Target Year (copy TO)</label>
                  <select className="trm-input" value={cloneForm.toYearId} onChange={e => setCloneForm(p=>({...p,toYearId:e.target.value}))}>
                    <option value="">Select year...</option>
                    {taxYears.map(y => <option key={y.id} value={y.id}>{y.tax_year}</option>)}
                  </select>
                </div>
              </div>
              {cloneForm.fromYearId && cloneForm.toYearId && cloneForm.fromYearId !== cloneForm.toYearId && (
                <div style={{ marginTop:14, padding:'12px 14px', background:'#fffbeb', borderRadius:8, display:'flex', gap:8 }}>
                  <AlertTriangle size={14} style={{ color:'#d97706', flexShrink:0, marginTop:2 }} />
                  <span style={{ fontSize:12, color:'#92400e' }}>
                    This will <strong>replace</strong> all {SLAB_TYPES.find(t=>t.id===selectedType)?.label} slabs in the target year.
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="trm-btn trm-btn-ghost" onClick={() => setShowCloneModal(false)}>Cancel</button>
              <button className="trm-btn trm-btn-primary" onClick={cloneSlabs} disabled={saving}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Copy size={13} />}
                Clone Slabs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Tax Year Modal ── */}
      {showYearModal && (
        <div className="trm-modal-overlay" onClick={e => e.target === e.currentTarget && setShowYearModal(false)}>
          <div className="trm-modal">
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:800, fontSize:17, color:'#111827' }}>New Tax Year</span>
              <button onClick={() => setShowYearModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={20} /></button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-700 text-gray-500 mb-1">Tax Year * (format: YYYY-YY)</label>
                  <input className="trm-input" placeholder="e.g. 2026-27" value={yearForm.taxYear} onChange={e => setYearForm(p=>({...p,taxYear:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Start Date</label>
                  <input className="trm-input" type="date" value={yearForm.startDate} onChange={e => setYearForm(p=>({...p,startDate:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">End Date</label>
                  <input className="trm-input" type="date" value={yearForm.endDate} onChange={e => setYearForm(p=>({...p,endDate:e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-700 text-gray-500 mb-1">Filing Deadline</label>
                  <input className="trm-input" type="date" value={yearForm.filingDeadline} onChange={e => setYearForm(p=>({...p,filingDeadline:e.target.value}))} />
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:20 }}>
                  <input type="checkbox" id="isCurrent" checked={yearForm.isCurrent} onChange={e => setYearForm(p=>({...p,isCurrent:e.target.checked}))} style={{ width:16, height:16 }} />
                  <label htmlFor="isCurrent" style={{ fontSize:13, fontWeight:700, color:'#374151', cursor:'pointer' }}>Set as current year</label>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-700 text-gray-500 mb-1">Description</label>
                  <input className="trm-input" placeholder="e.g. Finance Act 2026 rates" value={yearForm.description} onChange={e => setYearForm(p=>({...p,description:e.target.value}))} />
                </div>
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="trm-btn trm-btn-ghost" onClick={() => setShowYearModal(false)}>Cancel</button>
              <button className="trm-btn trm-btn-primary" onClick={createYear} disabled={saving}>
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                Create Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
