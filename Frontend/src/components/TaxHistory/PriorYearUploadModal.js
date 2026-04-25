import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  AlertTriangle,
  CheckCircle,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * PriorYearUploadModal
 *
 * Uploads a prior-year FBR tax return (JSON or Excel). Backend persists it as
 * a READ-ONLY archive (tax_return_history table) — it is NOT silently merged
 * into the current-year form. To pull specific values forward, the user opens
 * the archive detail view and uses the "Copy Forward" action.
 *
 * Props:
 *  onClose()              — dismissed
 *  onArchived(archiveRec) — optional callback after successful upload
 */
const PriorYearUploadModal = ({ onClose, onArchived }) => {
  const [dragOver,     setDragOver]     = useState(false);
  const [file,         setFile]         = useState(null);
  const [taxYear,      setTaxYear]      = useState('2024-25');
  const [uploading,    setUploading]    = useState(false);
  const [result,       setResult]       = useState(null);   // upload response
  const [showWarnings, setShowWarnings] = useState(true);
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tax_year', taxYear);

      // Axios' request interceptor (AuthContext) supplies the Authorization
      // header from the canonical 'token' key. Do NOT set Content-Type here —
      // that strips the multipart boundary.
      const res = await axios.post(`${API_BASE}/api/tax-history/upload`, formData);

      setResult(res.data);
      if (res.data.success) {
        toast.success(
          `Archived ${res.data.summary.mappedFields} fields — available as read-only reference in Tax History`
        );
        if (onArchived) onArchived(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDone = () => {
    onClose();
  };

  const severityColor = (severity) => {
    if (severity === 'high')   return 'text-red-700 bg-red-50 border-red-200';
    if (severity === 'medium') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Import Prior Year Return</h2>
              <p className="text-sm text-gray-500">Upload TY 2024-25 JSON or Excel export from FBR Iris</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Info banner */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Your prior year return is stored as a <strong>read-only archive</strong> for reference.
              It is <strong>not</strong> merged into the current year automatically. To pull specific
              values forward (e.g. opening asset balances), open the archive from the Tax History view.
            </span>
          </div>

          {/* Tax year selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prior Tax Year</label>
            <select
              value={taxYear}
              onChange={e => setTaxYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="2024-25">TY 2024-25</option>
              <option value="2023-24">TY 2023-24</option>
              <option value="2022-23">TY 2022-23</option>
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'}
              ${file ? 'border-green-400 bg-green-50' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 text-green-500" />
                <p className="font-medium text-green-700">{file.name}</p>
                <p className="text-sm text-green-600">{(file.size / 1024).toFixed(1)} KB — click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Upload className="w-10 h-10" />
                <p className="font-medium">Drag & drop file here, or click to select</p>
                <p className="text-sm">Supports JSON and Excel (.xlsx) — max 10 MB</p>
              </div>
            )}
          </div>

          {/* Upload button */}
          {file && !result && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Parsing file...' : 'Upload & Parse'}
            </button>
          )}

          {/* Result panel */}
          {result && result.success && (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Fields Mapped',   value: result.summary.mappedFields,   color: 'text-green-700 bg-green-50' },
                  { label: 'Unmatched',        value: result.summary.unmatchedFields, color: 'text-gray-700 bg-gray-50' },
                  { label: 'Rate Flags',       value: result.summary.rateFlagCount,  color: result.summary.rateFlagCount > 0 ? 'text-red-700 bg-red-50' : 'text-gray-700 bg-gray-50' },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-lg p-3 text-center border ${stat.color}`}>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Rate-change warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowWarnings(w => !w)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-amber-800 text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {result.warnings.length} rate-change warning{result.warnings.length > 1 ? 's' : ''} — Finance Act 2025
                    </span>
                    {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showWarnings && (
                    <div className="divide-y divide-amber-100">
                      {result.warnings.map((w, i) => (
                        <div key={i} className={`px-4 py-3 text-sm border-l-4 ${severityColor(w.severity)}`}>
                          <p className="font-mono text-xs mb-1">{w.field}</p>
                          <p>{w.message}</p>
                          {w.priorValue !== undefined && (
                            <p className="mt-1 text-xs opacity-75">Prior year value: <strong>{w.priorValue?.toLocaleString?.() ?? w.priorValue}</strong></p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* No warnings case */}
              {(!result.warnings || result.warnings.length === 0) && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  No rate-change warnings — all mapped fields are safe to carry forward.
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setResult(null); setFile(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Upload Different File
                </button>
                <button
                  onClick={handleDone}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  <CheckCircle className="w-4 h-4" />
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PriorYearUploadModal;
