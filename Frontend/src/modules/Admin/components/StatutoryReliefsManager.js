/**
 * Statutory Reliefs — the open legal questions, as settings someone can answer.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * The FBR research behind phase-z19 ended with three points that code cannot
 * honestly settle: the wording of the s.60D income threshold, whether any
 * provision supports the "professional expenses" allowance the app used to
 * grant, and the parameters of the Finance Act 2025 housing-loan tax credit.
 *
 * Left as report footnotes, each of those becomes an answer the app ships
 * silently. This screen turns them into questions the owner or their tax counsel
 * can read, understand and answer — with the statutory background attached, the
 * consequence of changing it spelled out, and a required note recording who
 * decided and on what authority.
 *
 * DESIGN NOTES
 * ------------
 *  - The catalogue lives on the SERVER (`Admin/routes/statutoryReliefs.js`).
 *    This component renders whatever the API describes, so adding a question
 *    later needs no frontend change.
 *  - The note field is mandatory and enforced server-side too. An answer to a
 *    legal question with no stated authority is not auditable a year later.
 *  - Dark mode: every colour is a CSS variable or a `dark:` class. Inline colour
 *    literals defeat the theme overrides — this codebase has been bitten by that
 *    three times (see design-system/MASTER.md).
 */

/* eslint-disable react-hooks/exhaustive-deps -- bootstrap effect fires once on mount */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Scale, AlertTriangle, CheckCircle, XCircle, Info, RefreshCw,
  Save, ChevronDown, ChevronRight, BookOpen, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';

const S = () => (
  <style>{`
    .srm-root { font-family:'Nunito',sans-serif; }
    .srm-badge { display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:uppercase; }
    .srm-input { width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;color:var(--content);background:var(--surface-raised);outline:none;transition:border-color .18s,box-shadow .18s; }
    .srm-input:focus { border-color:#28396C;box-shadow:0 0 0 3px rgba(40,57,108,.1); }
    [data-theme="dark"] .srm-input:focus { border-color:#3d5a90; }
    .srm-btn { display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;border:none; }
    .srm-btn-primary { background:#28396C;color:#fff; }
    .srm-btn-primary:hover:not(:disabled) { background:#1e2d5a; }
    .srm-btn-primary:disabled { opacity:.5;cursor:not-allowed; }
    .srm-btn-ghost { background:#f3f4f6;color:#374151; }
    .srm-btn-ghost:hover { background:#e5e7eb; }
    [data-theme="dark"] .srm-btn-ghost { background:var(--surface-sunken);color:var(--content-muted); }
    [data-theme="dark"] .srm-btn-ghost:hover { background:#1a2238; }
    .srm-option { display:flex;gap:11px;align-items:flex-start;padding:12px 14px;border:1.5px solid var(--line);border-radius:10px;cursor:pointer;transition:border-color .18s,background .18s; }
    .srm-option:hover { background:var(--surface-sunken); }
    .srm-option-on { border-color:#28396C;background:rgba(40,57,108,.05); }
    [data-theme="dark"] .srm-option-on { border-color:#3d5a90;background:rgba(61,90,144,.14); }
    .srm-prose { font-size:13.5px;line-height:1.65;font-weight:600;color:var(--content-muted); }
    .srm-label { display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--content-muted);margin-bottom:5px; }
  `}</style>
);

/* Status → how the card is framed. `retired` and `not_implemented` are the two
   that cost somebody money right now, in opposite directions, so neither is
   presented as merely informational. */
const STATUS_META = {
  unsettled: {
    label: 'Wording unsettled',
    Icon: HelpCircle,
    cls: 'bg-amber-50 text-amber-700 dark:bg-[#3a2f10] dark:text-amber-300',
  },
  retired: {
    label: 'Switched off — no basis found',
    Icon: XCircle,
    cls: 'bg-red-50 text-red-700 dark:bg-[#3a1d1d] dark:text-red-300',
  },
  not_implemented: {
    label: 'Not offered — your users may be over-paying',
    Icon: AlertTriangle,
    cls: 'bg-orange-50 text-orange-700 dark:bg-[#3a2413] dark:text-orange-300',
  },
};

const fmt = (n) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('en-PK');

export default function StatutoryReliefsManager() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [taxYears, setTaxYears] = useState([]);
  const [taxYear, setTaxYear] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [expanded, setExpanded] = useState({});
  // Per-question draft: { value, params:{}, counselNote, authority }
  const [draft, setDraft] = useState({});

  const loadYears = useCallback(async () => {
    try {
      const r = await axios.get('/api/admin/tax-years');
      if (r.data.success) {
        setTaxYears(r.data.data);
        const current = r.data.data.find((y) => y.is_current) || r.data.data[0];
        if (current && !taxYear) setTaxYear(current.tax_year);
      }
    } catch {
      toast.error('Failed to load tax years');
    }
  }, [taxYear]);

  const load = useCallback(async () => {
    if (!taxYear) return;
    setLoading(true);
    try {
      const r = await axios.get('/api/admin/statutory-reliefs', { params: { taxYear } });
      if (r.data.success) {
        setItems(r.data.data);
        // Seed each draft from what is actually in force, so an operator who
        // only edits the note cannot accidentally also change the answer.
        const next = {};
        for (const it of r.data.data) {
          const params = {};
          for (const f of it.fields || []) {
            params[f.name] = it.currentRows[0]?.[f.name] ?? '';
          }
          next[it.key] = {
            value: it.currentValue,
            params,
            counselNote: '',
            authority: it.currentRows[0]?.fbr_reference || '',
          };
        }
        setDraft(next);
      }
    } catch {
      toast.error('Failed to load statutory relief settings');
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => { loadYears(); }, []);
  useEffect(() => { load(); }, [taxYear]);

  const setField = (key, patch) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const save = async (item) => {
    const d = draft[item.key] || {};
    if (!d.counselNote || d.counselNote.trim().length < 10) {
      toast.error('Record who settled this and on what authority before saving.');
      return;
    }
    setSavingKey(item.key);
    try {
      const r = await axios.put(`/api/admin/statutory-reliefs/${item.key}`, {
        taxYear,
        value: d.value,
        params: d.params,
        counselNote: d.counselNote,
        authority: d.authority,
      });
      toast.success(r.data.message || 'Saved');
      await load();
    } catch (e) {
      // The server refuses some combinations for stated reasons (a half-enabled
      // relief, an unlimited credit). Surface its reason verbatim rather than a
      // generic failure — the reason is the useful part.
      toast.error(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="srm-root space-y-6">
      <S />

      {/* Header */}
      <div className="bg-white dark:bg-[#151c30] rounded-xl shadow-sm border border-gray-100 dark:border-[#2a3450] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1
              className="text-gray-900 dark:text-white"
              style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 24, fontWeight: 800 }}
            >
              <Scale size={22} className="inline mr-2 -mt-1" />
              Statutory Reliefs
            </h1>
            <p className="srm-prose mt-2" style={{ maxWidth: '58ch' }}>
              Points where the law is unsettled, or where the app&apos;s own citation turned out to be
              wrong. Each one is a decision the application must make on every return, so it is set
              here rather than buried in code — with the background, the consequence, and a record
              of who decided.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="srm-label" htmlFor="srm-year">Tax Year</label>
              <div className="relative">
                <select
                  id="srm-year"
                  className="srm-input pr-8 cursor-pointer"
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                >
                  {taxYears.map((y) => (
                    <option key={y.id} value={y.tax_year}>{y.tax_year}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-2.5 top-3 pointer-events-none text-gray-400" />
              </div>
            </div>
            <button className="srm-btn srm-btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="mt-4 flex gap-2.5 items-start rounded-lg p-3 bg-amber-50 dark:bg-[#3a2f10]">
            <Info size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="srm-prose" style={{ margin: 0 }}>
              These settings change how tax is computed on every return, so only a Super Admin can
              change them. You can read the current position and its reasoning.
            </p>
          </div>
        )}
      </div>

      {loading && items.length === 0 && (
        <div className="bg-white dark:bg-[#151c30] rounded-xl border border-gray-100 dark:border-[#2a3450] p-10 text-center">
          <RefreshCw size={22} className="animate-spin mx-auto text-gray-400" />
        </div>
      )}

      {items.map((item) => {
        const meta = STATUS_META[item.status] || STATUS_META.unsettled;
        const d = draft[item.key] || {};
        const open = expanded[item.key];
        const dirty =
          d.value !== item.currentValue ||
          (item.fields || []).some(
            (f) => String(d.params?.[f.name] ?? '') !== String(item.currentRows[0]?.[f.name] ?? '')
          );

        return (
          <div
            key={item.key}
            className="bg-white dark:bg-[#151c30] rounded-xl shadow-sm border border-gray-100 dark:border-[#2a3450] overflow-hidden"
          >
            <div className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`srm-badge ${meta.cls}`}>
                  <meta.Icon size={12} /> {meta.label}
                </span>
                <span className="text-xs font-700 text-gray-400 dark:text-[#7e88a6]">
                  {item.citation}
                </span>
              </div>

              <h2
                className="text-gray-900 dark:text-white mt-3"
                style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 17, fontWeight: 800 }}
              >
                {item.title}
              </h2>

              <p className="srm-prose mt-2" style={{ maxWidth: '70ch' }}>{item.question}</p>

              {/* Why it matters is never collapsed — it is the part that decides
                  whether this is worth someone's afternoon. */}
              <div className="mt-4 flex gap-2.5 items-start rounded-lg p-3.5 bg-gray-50 dark:bg-[#111827]">
                <AlertTriangle size={16} className="text-gray-500 dark:text-[#7e88a6] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-800 uppercase tracking-wider text-gray-500 dark:text-[#7e88a6] mb-1">
                    Why it matters
                  </p>
                  <p className="srm-prose" style={{ margin: 0, maxWidth: '70ch' }}>{item.whyItMatters}</p>
                </div>
              </div>

              <button
                className="srm-btn srm-btn-ghost mt-3"
                onClick={() => setExpanded((e) => ({ ...e, [item.key]: !e[item.key] }))}
                aria-expanded={open ? 'true' : 'false'}
              >
                {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <BookOpen size={15} /> Statutory background
              </button>

              {open && (
                <div className="mt-3 space-y-3 pl-3" style={{ borderLeft: '3px solid var(--line)' }}>
                  <p className="srm-prose" style={{ maxWidth: '76ch' }}>{item.background}</p>
                  <div>
                    <p className="text-xs font-800 uppercase tracking-wider text-gray-500 dark:text-[#7e88a6] mb-1">
                      If you change it
                    </p>
                    <p className="srm-prose" style={{ margin: 0, maxWidth: '76ch' }}>{item.ifYouChangeIt}</p>
                  </div>
                  <div>
                    <p className="text-xs font-800 uppercase tracking-wider text-gray-500 dark:text-[#7e88a6] mb-1.5">
                      Rate rows behind this setting
                    </p>
                    <div className="space-y-1.5">
                      {item.currentRows.map((r) => (
                        <div
                          key={r.rate_category}
                          className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-600 text-gray-600 dark:text-[#9aa3bd]"
                        >
                          <code className="font-mono">{r.rate_type}/{r.rate_category}</code>
                          <span>rate {r.tax_rate ?? '—'}</span>
                          <span>fixed {fmt(r.fixed_amount)}</span>
                          <span className={r.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                            {r.exists ? (r.is_active ? 'active' : 'inactive') : 'row missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {item.currentRows[0]?.counselNote && (
                    <div>
                      <p className="text-xs font-800 uppercase tracking-wider text-gray-500 dark:text-[#7e88a6] mb-1">
                        Recorded note
                      </p>
                      <p className="srm-prose" style={{ margin: 0, maxWidth: '76ch' }}>
                        {item.currentRows[0].counselNote}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── The editable part ── */}
            <div
              className="px-6 py-5 bg-gray-50 dark:bg-[#111827]"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              {item.control === 'choice' && (
                <div className="space-y-2.5" role="radiogroup" aria-label={item.title}>
                  {item.options.map((o) => (
                    <label
                      key={o.value}
                      className={`srm-option ${d.value === o.value ? 'srm-option-on' : ''}`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name={`srm-${item.key}`}
                        checked={d.value === o.value}
                        disabled={!isSuperAdmin}
                        onChange={() => setField(item.key, { value: o.value })}
                      />
                      <span>
                        <span className="block text-sm font-800 text-gray-900 dark:text-white">{o.label}</span>
                        <span className="srm-prose">{o.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {item.control === 'toggle' && (
                <div className="space-y-2.5" role="radiogroup" aria-label={item.title}>
                  {[
                    { value: 'disabled', label: 'Not available', detail: 'The app refuses any claim under this head.' },
                    { value: 'enabled', label: 'Available', detail: 'The app grants it, subject to the configured limits.' },
                  ].map((o) => (
                    <label
                      key={o.value}
                      className={`srm-option ${d.value === o.value ? 'srm-option-on' : ''}`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name={`srm-${item.key}`}
                        checked={d.value === o.value}
                        disabled={!isSuperAdmin}
                        onChange={() => setField(item.key, { value: o.value })}
                      />
                      <span>
                        <span className="block text-sm font-800 text-gray-900 dark:text-white">{o.label}</span>
                        <span className="srm-prose">{o.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {item.control === 'params' && item.canDisable && (
                // Without this the only way back from a configured relief was
                // raw SQL, which is the situation this screen exists to remove.
                <label className={`srm-option mb-4 ${d.value === 'not_configured' ? 'srm-option-on' : ''}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={d.value === 'not_configured'}
                    disabled={!isSuperAdmin}
                    onChange={(e) =>
                      setField(item.key, { value: e.target.checked ? 'not_configured' : 'configured' })
                    }
                  />
                  <span>
                    <span className="block text-sm font-800 text-gray-900 dark:text-white">
                      Do not offer this relief
                    </span>
                    <span className="srm-prose">
                      The app will not grant it and its input stays hidden on the Credits form. Your
                      note and any figures below are kept, so switching it back on later is one save.
                    </span>
                  </span>
                </label>
              )}

              {item.control === 'params' && (
                <div
                  className="grid gap-4 sm:grid-cols-2"
                  style={d.value === 'not_configured' ? { opacity: 0.45 } : undefined}
                >
                  {item.fields.map((f) => (
                    <div key={f.name}>
                      <label className="srm-label" htmlFor={`srm-${item.key}-${f.name}`}>
                        {f.label}
                      </label>
                      <input
                        id={`srm-${item.key}-${f.name}`}
                        className="srm-input"
                        inputMode="decimal"
                        disabled={!isSuperAdmin || d.value === 'not_configured'}
                        value={d.params?.[f.name] ?? ''}
                        placeholder="0"
                        onChange={(e) =>
                          setField(item.key, { params: { ...d.params, [f.name]: e.target.value } })
                        }
                      />
                      <p className="srm-prose mt-1" style={{ fontSize: 12 }}>{f.hint}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* The note is required. This is the field that makes the setting
                  defensible in a year's time. */}
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="srm-label" htmlFor={`srm-note-${item.key}`}>
                    Who settled this, and on what authority <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id={`srm-note-${item.key}`}
                    className="srm-input"
                    rows={2}
                    disabled={!isSuperAdmin}
                    placeholder="e.g. Confirmed by [adviser] on [date] against the Ordinance as amended to 30-Jun-2025."
                    value={d.counselNote || ''}
                    onChange={(e) => setField(item.key, { counselNote: e.target.value })}
                  />
                </div>
                <div>
                  <label className="srm-label" htmlFor={`srm-auth-${item.key}`}>
                    Citation to record
                  </label>
                  <input
                    id={`srm-auth-${item.key}`}
                    className="srm-input"
                    disabled={!isSuperAdmin}
                    placeholder={item.citation}
                    value={d.authority || ''}
                    onChange={(e) => setField(item.key, { authority: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  className="srm-btn srm-btn-primary"
                  disabled={!isSuperAdmin || savingKey === item.key}
                  onClick={() => save(item)}
                >
                  {savingKey === item.key
                    ? <RefreshCw size={15} className="animate-spin" />
                    : <Save size={15} />}
                  Save decision
                </button>
                {dirty && (
                  <span className="text-xs font-700 text-amber-600 dark:text-amber-400">
                    Unsaved change to how tax is computed
                  </span>
                )}
                {!dirty && item.currentRows[0]?.updated_at && (
                  <span className="text-xs font-600 text-gray-400 dark:text-[#7e88a6]">
                    <CheckCircle size={12} className="inline mr-1" />
                    Last changed {new Date(item.currentRows[0].updated_at).toLocaleDateString('en-PK')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
