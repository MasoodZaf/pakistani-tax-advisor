import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Check, Archive, Trash2, Edit2, RefreshCw, Sparkles, X, Download, Upload, Info, ChevronDown, Library, Lock, Copy } from 'lucide-react';

const FORM_STEPS = ['', 'deductions', 'credits', 'reductions', 'income', 'adjustable-tax', 'final-min-income', 'capital-gains'];
const EMPTY = { title: '', profile: '', relief: '', section: '', cap_note: '', how_to: '', caveat: '', form_step: '' };

const STATUS_STYLE = {
  approved: 'bg-lime/25 text-navy dark:text-[#e7eaf3]',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  archived: 'bg-gray-100 text-gray-500 dark:bg-[#1a2238] dark:text-[#7e88a6]',
};

const PlaybookManager = () => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [seeded, setSeeded] = useState(null);
  const [seededLoading, setSeededLoading] = useState(false);
  const [showSeeded, setShowSeeded] = useState(false);
  const fileInputRef = useRef(null);

  const loadSeeded = useCallback(async () => {
    setShowSeeded((v) => !v);
    if (seeded !== null) return;
    setSeededLoading(true);
    try {
      const r = await axios.get('/api/admin/playbook/seeded');
      if (r.data.success) setSeeded(r.data.strategies || []);
    } catch {
      toast.error('Could not load the seeded library');
      setSeeded([]);
    } finally {
      setSeededLoading(false);
    }
  }, [seeded]);

  const downloadTemplate = async () => {
    try {
      const res = await axios.get('/api/admin/playbook/template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'tax-efficiency-strategy-template.md';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the template');
    }
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post('/api/admin/playbook/import', fd);
      const { imported = 0, skipped = 0 } = res.data || {};
      toast.success(`Imported ${imported} strateg${imported === 1 ? 'y' : 'ies'} as drafts${skipped ? ` (${skipped} skipped)` : ''} — review & approve below.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed — use the provided template.');
    } finally {
      setImporting(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/admin/playbook');
      if (r.data.success) setStrategies(r.data.strategies || []);
    } catch {
      toast.error('Failed to load the playbook');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Clone a built-in seeded strategy into the editable list as a draft so the
  // admin can tweak it (e.g. update a cap for a new Finance Act) without touching
  // code. The seeded "why it saves" rationale seeds the Relief field — editable.
  const [copyingTitle, setCopyingTitle] = useState(null);
  const copyToDraft = async (s) => {
    setCopyingTitle(s.title);
    try {
      await axios.post('/api/admin/playbook', {
        title: s.title, profile: s.profile, relief: s.why, section: s.section,
        cap_note: '', how_to: s.how_to, caveat: s.caveat, form_step: s.form_step,
      });
      toast.success('Copied to your editable list as a draft — review & approve below.');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Copy failed');
    } finally {
      setCopyingTitle(null);
    }
  };

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const startAdd = () => { setForm(EMPTY); setEditingId(null); setShowForm(true); };
  const startEdit = (s) => {
    setForm({ title: s.title || '', profile: s.profile || '', relief: s.relief || '', section: s.section || '',
      cap_note: s.cap_note || '', how_to: s.how_to || '', caveat: s.caveat || '', form_step: s.form_step || '' });
    setEditingId(s.id); setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (editingId) await axios.put(`/api/admin/playbook/${editingId}`, form);
      else await axios.post('/api/admin/playbook', form);
      toast.success(editingId ? 'Strategy updated' : 'Strategy added (draft)');
      setShowForm(false); setForm(EMPTY); setEditingId(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, path, msg) => {
    try {
      await axios.post(`/api/admin/playbook/${id}/${path}`);
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Action failed');
    }
  };

  const remove = async (id) => {
    try { await axios.delete(`/api/admin/playbook/${id}`); toast.success('Deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.error || 'Delete failed'); }
  };

  const approvedCount = strategies.filter((s) => s.status === 'approved').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-grid place-items-center rounded-brand bg-lime/25 p-2 text-navy dark:text-[#e7eaf3]"><BookOpen className="w-6 h-6" /></span>
            <div>
              <h1 className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">Tax-Efficiency Playbook</h1>
              <p className="text-gray-600 dark:text-[#aab2cc] mt-1 max-w-2xl text-sm">
                Curated, legal-only strategies the AI consultant uses. <strong className="text-navy dark:text-[#e7eaf3]">Approved</strong> strategies
                are ingested into the AI knowledge base instantly. General tax knowledge only — never any user's data.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-[#7e88a6]">{approvedCount} live · {strategies.length} total</span>
            <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#7e88a6] hover:text-navy px-3 py-1.5 border border-gray-200 dark:border-[#2a3450] rounded-brand">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={loadSeeded} title="View the built-in curated strategies the AI already uses" className={`flex items-center gap-2 text-sm px-3 py-1.5 border rounded-brand ${showSeeded ? 'bg-navy text-white border-navy' : 'text-navy border-navy/15 hover:bg-navy/5'}`}>
              <Library className="w-4 h-4" /> Seeded library
            </button>
            <button onClick={downloadTemplate} title="Download the file to send to consultants" className="flex items-center gap-2 text-sm text-navy px-3 py-1.5 border border-navy/15 rounded-brand hover:bg-navy/5">
              <Download className="w-4 h-4" /> Template
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 text-sm font-semibold text-navy px-3 py-1.5 border border-navy/15 rounded-brand hover:bg-navy/5 disabled:opacity-50">
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
            </button>
            <input ref={fileInputRef} type="file" accept=".md,.txt,.csv,.xlsx,.xls" onChange={importFile} className="hidden" />
            <button onClick={startAdd} className="flex items-center gap-2 rounded-brand bg-lime px-4 py-2 font-semibold text-navy hover:bg-lime/80">
              <Plus className="w-4 h-4" /> Add strategy
            </button>
          </div>
        </div>
      </div>

      {/* How this works */}
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand overflow-hidden">
        <button onClick={() => setShowHow((v) => !v)} className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-navy/[0.02]">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy dark:text-[#e7eaf3]">
            <Info className="w-4 h-4 text-navy/60" /> How does the AI “learn” these strategies?
          </span>
          <ChevronDown className={`w-4 h-4 text-navy/50 transition-transform ${showHow ? 'rotate-180' : ''}`} />
        </button>
        {showHow && (
          <div className="border-t border-navy/10 px-6 py-5 text-sm leading-relaxed text-gray-600 dark:text-[#aab2cc] space-y-3">
            <p>
              The AI doesn’t need to be re-trained. Approved strategies are stored in a <strong className="text-navy dark:text-[#e7eaf3]">knowledge
              base</strong> that the AI <strong className="text-navy dark:text-[#e7eaf3]">reads from live</strong> at the moment a taxpayer asks —
              so the instant you <strong className="text-navy dark:text-[#e7eaf3]">Approve</strong> a strategy, it’s available in the next answer.
              No training run, no waiting.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-brand bg-lime/10 p-3">
                <p className="font-semibold text-navy dark:text-[#e7eaf3]">⚡ Instant</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-[#aab2cc]">Approve → live on the very next question. Archive → gone immediately.</p>
              </div>
              <div className="rounded-brand bg-lime/10 p-3">
                <p className="font-semibold text-navy dark:text-[#e7eaf3]">📌 Grounded</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-[#aab2cc]">The AI answers <em>from</em> your text, so it can cite the section and cap — not a black-box guess.</p>
              </div>
              <div className="rounded-brand bg-lime/10 p-3">
                <p className="font-semibold text-navy dark:text-[#e7eaf3]">🛡️ Gated</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-[#aab2cc]">Imported &amp; new entries start as <strong>drafts</strong> — nothing reaches taxpayers until you approve it.</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#7e88a6]">
              This is called <em>retrieval</em> (RAG). It’s the right fit for tax advice, where suggestions must be accurate,
              current, citable, and instantly retractable — all things a re-trained model can’t guarantee per-entry.
            </p>
          </div>
        )}
      </div>

      {/* Seeded library (read-only, built-in baseline the AI already uses) */}
      {showSeeded && (
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <div className="flex items-start gap-3 mb-1">
            <span className="inline-grid place-items-center rounded-brand bg-navy/5 p-2 text-navy dark:text-[#e7eaf3]"><Library className="w-5 h-5" /></span>
            <div>
              <h2 className="text-lg font-semibold text-navy dark:text-[#e7eaf3] flex items-center gap-2">
                Built-in seeded library
                {seeded && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy dark:text-[#e7eaf3]">{seeded.length}</span>}
                <span className="inline-flex items-center gap-1 rounded-full bg-lime/25 px-2 py-0.5 text-xs font-semibold text-navy dark:text-[#e7eaf3]"><Check className="w-3 h-3" /> live in AI</span>
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#aab2cc] mt-0.5 max-w-2xl flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-[#7e88a6] shrink-0" />
                The curated baseline shipped with the app — already used by the AI. Read-only; add your own (or import) above to extend it.
              </p>
            </div>
          </div>
          {seededLoading ? (
            <div className="text-center py-10"><RefreshCw className="w-7 h-7 text-navy animate-spin mx-auto" /></div>
          ) : !seeded || seeded.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-[#7e88a6] py-6 text-center">No seeded strategies found.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {seeded.map((s, i) => (
                <div key={i} className="rounded-brand-lg border border-navy/10 bg-navy/[0.015] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-navy dark:text-[#e7eaf3] leading-snug">{s.title}</h3>
                    <span className="shrink-0 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy/70">built-in</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-navy/60 font-mono">
                    {s.section && <span className="truncate max-w-full">{s.section}</span>}
                    {s.form_step && <span>· {s.form_step}</span>}
                  </div>
                  {s.profile && <p className="mt-2 text-sm text-gray-600 dark:text-[#aab2cc]"><span className="font-medium text-navy dark:text-[#e7eaf3]">Who:</span> {s.profile}</p>}
                  {s.why && <p className="mt-1 text-sm text-gray-600 dark:text-[#aab2cc]"><span className="font-medium text-navy dark:text-[#e7eaf3]">Why it saves:</span> {s.why}</p>}
                  {s.how_to && <p className="mt-1 text-sm text-gray-600 dark:text-[#aab2cc]"><span className="font-medium text-navy dark:text-[#e7eaf3]">How:</span> {s.how_to}</p>}
                  {s.caveat && <p className="mt-1 text-xs text-gray-500 dark:text-[#7e88a6]"><span className="font-medium">Caveat:</span> {s.caveat}</p>}
                  <div className="mt-4">
                    <button onClick={() => copyToDraft(s)} disabled={copyingTitle === s.title} title="Clone this built-in into your editable list as a draft you can tweak" className="inline-flex items-center gap-1 rounded-brand border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
                      {copyingTitle === s.title ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Copy to draft
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-navy dark:text-[#e7eaf3]">{editingId ? 'Edit strategy' : 'New strategy'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 dark:text-[#7e88a6] hover:text-navy"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title *"><input value={form.title} onChange={set('title')} className={inputCls} placeholder="e.g. Voluntary pension (VPS) contribution tax credit" /></Field>
            <Field label="Section"><input value={form.section} onChange={set('section')} className={inputCls} placeholder="s.63" /></Field>
            <Field label="Who / when it applies"><input value={form.profile} onChange={set('profile')} className={inputCls} placeholder="Salaried individuals who can contribute to an approved pension fund" /></Field>
            <Field label="Relief"><input value={form.relief} onChange={set('relief')} className={inputCls} placeholder="Tax credit for pension contribution" /></Field>
            <Field label="Statutory cap"><input value={form.cap_note} onChange={set('cap_note')} className={inputCls} placeholder="20% of taxable income" /></Field>
            <Field label="App form (deep-link)">
              <select value={form.form_step} onChange={set('form_step')} className={inputCls}>
                {FORM_STEPS.map((f) => <option key={f} value={f}>{f || '— none —'}</option>)}
              </select>
            </Field>
            <Field label="How to claim" wide><textarea value={form.how_to} onChange={set('how_to')} rows={2} className={inputCls} placeholder="Contribute to an SECP-approved pension fund and enter it in the Credits form." /></Field>
            <Field label="Caveat / eligibility" wide><textarea value={form.caveat} onChange={set('caveat')} rows={2} className={inputCls} placeholder="Must be an SECP-approved VPS fund; confirm eligibility." /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-brand border border-gray-200 dark:border-[#2a3450] text-gray-600 dark:text-[#aab2cc] hover:bg-gray-50 dark:hover:bg-[#0f1426]">Cancel</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-brand bg-navy px-4 py-2 font-semibold text-white hover:bg-navy-dark disabled:opacity-50">
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <>Save draft</>}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12"><RefreshCw className="w-8 h-8 text-navy animate-spin mx-auto" /></div>
      ) : strategies.length === 0 ? (
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-10 text-center text-gray-500 dark:text-[#7e88a6]">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-navy/30" />
          <p className="text-sm">No strategies yet. Click <strong className="text-navy dark:text-[#e7eaf3]">Add strategy</strong> to grow the master file.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {strategies.map((s) => (
            <div key={s.id} className="bg-white dark:bg-[#151c30] rounded-brand-lg shadow-brand border border-navy/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-navy dark:text-[#e7eaf3] leading-snug">{s.title}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[s.status] || ''}`}>{s.status}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-navy/60 font-mono">
                {s.section && <span>{s.section}</span>}
                {s.cap_note && <span>· {s.cap_note}</span>}
                {s.form_step && <span>· {s.form_step}</span>}
              </div>
              {s.profile && <p className="mt-2 text-sm text-gray-600 dark:text-[#aab2cc]"><span className="font-medium text-navy dark:text-[#e7eaf3]">Who:</span> {s.profile}</p>}
              {s.how_to && <p className="mt-1 text-sm text-gray-600 dark:text-[#aab2cc]"><span className="font-medium text-navy dark:text-[#e7eaf3]">How:</span> {s.how_to}</p>}
              {s.caveat && <p className="mt-1 text-xs text-gray-500 dark:text-[#7e88a6]"><span className="font-medium">Caveat:</span> {s.caveat}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={() => startEdit(s)} className="inline-flex items-center gap-1 rounded-brand border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                {s.status !== 'approved' && (
                  <button onClick={() => act(s.id, 'approve', 'Approved — now live in the AI')} className="inline-flex items-center gap-1 rounded-brand bg-lime px-3 py-1.5 text-xs font-semibold text-navy hover:bg-lime/80"><Check className="w-3.5 h-3.5" /> Approve</button>
                )}
                {s.status === 'approved' && (
                  <button onClick={() => act(s.id, 'archive', 'Archived — removed from the AI')} className="inline-flex items-center gap-1 rounded-brand border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"><Archive className="w-3.5 h-3.5" /> Archive</button>
                )}
                <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 rounded-brand border border-red-200 dark:border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const inputCls = 'w-full rounded-brand border-[1.5px] border-slate-300 dark:border-[#2a3450] dark:bg-[#0f1426] px-3 py-2 text-sm text-navy dark:text-[#e7eaf3] focus:border-navy focus:outline-none focus:ring-4 focus:ring-navy/15';
const Field = ({ label, wide, children }) => (
  <div className={wide ? 'md:col-span-2' : ''}>
    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-[#7e88a6]">{label}</label>
    {children}
  </div>
);

export default PlaybookManager;
