import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Archive,
  Upload,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  FileText,
  Lock,
} from 'lucide-react';
import PriorYearUploadModal from './PriorYearUploadModal';

const formatPKR = (n) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/**
 * TaxArchiveView
 *
 * Read-only list of the user's prior-year tax return archives. Each row expands
 * to show the archived mapped_data plus a "Copy Forward" action that pulls
 * selected step values into the CURRENT year's in-progress return.
 *
 * Archives themselves are never edited — if the user needs to replace a year
 * they upload again (the backend upserts on user_id+tax_year).
 */
const TaxArchiveView = () => {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState(null);
  const [detail, setDetail] = useState({}); // tax_year -> archive detail
  const [copyingStep, setCopyingStep] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const loadArchives = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tax-history/archive');
      setArchives(res.data?.archives || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load archives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchives();
  }, []);

  const toggleExpand = async (taxYear) => {
    if (expandedYear === taxYear) {
      setExpandedYear(null);
      return;
    }
    setExpandedYear(taxYear);
    if (!detail[taxYear]) {
      try {
        const res = await axios.get(`/api/tax-history/archive/${encodeURIComponent(taxYear)}`);
        setDetail((d) => ({ ...d, [taxYear]: res.data?.archive }));
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Failed to load archive detail');
        setExpandedYear(null);
      }
    }
  };

  const deleteArchive = async (id, taxYear) => {
    if (!window.confirm(`Delete archive for TY ${taxYear}? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/tax-history/${encodeURIComponent(id)}`);
      toast.success(`TY ${taxYear} archive deleted`);
      setArchives((list) => list.filter((a) => a.id !== id));
      if (expandedYear === taxYear) setExpandedYear(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const copyForwardStep = async (taxYear, step) => {
    if (!window.confirm(`Copy all "${step}" values from TY ${taxYear} into your current return? Existing values will be overwritten.`))
      return;
    setCopyingStep(`${taxYear}:${step}`);
    try {
      const res = await axios.post(
        `/api/tax-history/archive/${encodeURIComponent(taxYear)}/copy-forward`,
        { step }
      );
      const values = res.data?.values || {};
      const count = Object.keys(values).length;
      if (count === 0) {
        toast(`No ${step} data in the archive to copy`);
      } else {
        // Hand off to the rest of the app — TaxFormContext listens on this custom
        // event and applies the values to the matching step's formData.
        window.dispatchEvent(
          new CustomEvent('copyForwardFromArchive', {
            detail: { step, values, sourceTaxYear: taxYear },
          })
        );
        toast.success(
          `${count} ${step} values queued. Open the ${step} form to review before saving.`
        );
      }
      const warnings = res.data?.warnings || [];
      if (warnings.length > 0) {
        toast(`${warnings.length} field(s) have rate changes since ${taxYear} — please verify`, {
          icon: '⚠️',
          duration: 6000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Copy-forward failed');
    } finally {
      setCopyingStep(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navy/10 rounded-brand flex items-center justify-center">
            <Archive className="w-5 h-5 text-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-navy">Tax History</h1>
            <p className="text-sm text-gray-500">Read-only archives of returns from previous years</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-brand hover:bg-navy-dark text-sm font-medium"
        >
          <Upload className="w-4 h-4" />
          Upload Prior Year
        </button>
      </div>

      <div className="mb-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-brand text-sm text-amber-900">
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Archives are <strong>read-only reference records</strong>. Filing is available for the current
          tax year only. To reuse a value from a past return, use <strong>Copy Forward</strong> on a
          specific section below — then review in the form before saving.
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : archives.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-brand">
          <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-3">No prior year returns archived yet.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-brand hover:bg-navy-dark text-sm"
          >
            <Upload className="w-4 h-4" />
            Upload a prior year return
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map((a) => {
            const isOpen = expandedYear === a.tax_year;
            const d = detail[a.tax_year];
            const stepKeys = d?.mapped_data ? Object.keys(d.mapped_data) : [];
            return (
              <div key={a.id} className="border border-gray-200 rounded-brand overflow-hidden bg-white">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <button onClick={() => toggleExpand(a.tax_year)} className="flex-1 flex items-center gap-4 text-left">
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      TY {a.tax_year}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      {a.source_format?.toUpperCase()}
                      {a.source_filename ? ` — ${a.source_filename}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 ml-auto">
                      Uploaded {formatDate(a.upload_date)}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
                      <Lock className="w-3 h-3" />
                      Archive
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  <button
                    onClick={() => deleteArchive(a.id, a.tax_year)}
                    className="ml-3 p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                    title="Delete archive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-4">
                    {/* Top-line totals */}
                    {a.totals && Object.keys(a.totals).length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                          Snapshot
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {Object.entries(a.totals).map(([k, v]) => (
                            <div key={k} className="bg-white px-3 py-2 rounded border border-gray-200">
                              <div className="text-xs text-gray-500">
                                {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                              </div>
                              <div className="font-medium text-navy">{formatPKR(v)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rate-change warnings */}
                    {d?.warnings?.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                        <div className="flex items-center gap-2 font-medium mb-1">
                          <AlertTriangle className="w-4 h-4" />
                          {d.warnings.length} rate-change warning(s)
                        </div>
                        <ul className="text-xs ml-6 list-disc space-y-0.5">
                          {d.warnings.slice(0, 5).map((w, i) => (
                            <li key={i}>
                              <span className="font-mono">{w.field}</span>: {w.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Copy-forward per step */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                        Copy Forward (per section)
                      </h3>
                      {!d ? (
                        <div className="text-xs text-gray-500">Loading detail…</div>
                      ) : stepKeys.length === 0 ? (
                        <div className="text-xs text-gray-500">No mapped sections in this archive.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {stepKeys.map((step) => {
                            const fieldCount = Object.keys(d.mapped_data[step] || {}).length;
                            const busy = copyingStep === `${a.tax_year}:${step}`;
                            return (
                              <button
                                key={step}
                                onClick={() => copyForwardStep(a.tax_year, step)}
                                disabled={busy || fieldCount === 0}
                                className="px-3 py-1.5 text-xs border border-navy/15 text-navy rounded-md hover:bg-navy/5 disabled:opacity-50"
                              >
                                {busy ? 'Copying…' : step} {fieldCount > 0 && <span className="text-gray-400">({fieldCount})</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        Copy Forward stages values into the matching form. You still need to open the
                        form, review, and save — nothing is written to the current return until you do.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showUpload && (
        <PriorYearUploadModal
          onClose={() => setShowUpload(false)}
          onArchived={() => {
            loadArchives();
          }}
        />
      )}
    </div>
  );
};

export default TaxArchiveView;
