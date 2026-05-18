import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Loader2, X } from 'lucide-react';
import aiConsultant from '../../services/aiConsultant';

// Tiny "?" button to drop next to a form field. Clicking pops a small panel
// with a plain-language explanation of the field, grounded in FBR docs and
// current slab data. Lazy — only calls the API the first time it's opened.
//
// Usage:
//   <InlineFormHelper
//     fieldName="annual_basic_salary"
//     formStep="Income"
//     currentValue={watch('annual_basic_salary')}
//   />
function InlineFormHelper({ fieldName, formStep, currentValue, taxYear, formContext }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState(null);
  const [error, setError] = useState(null);
  const panelRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const fetchHelp = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await aiConsultant.fieldHelp({
        fieldName,
        formStep,
        currentValue,
        taxYear,
        formContext,
      });
      setReply(r.reply);
    } catch (e) {
      const code = e.response?.data?.code;
      setError(code === 'AI_NOT_CONFIGURED'
        ? 'AI consultant not configured.'
        : (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    if (!open && !reply && !loading) fetchHelp();
    setOpen((v) => !v);
  };

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className="text-gray-400 hover:text-primary-600 transition align-middle ml-1"
        title="Ask the AI consultant about this field"
        aria-label="Field help"
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="absolute z-40 left-0 mt-1 w-80 bg-white border border-gray-200
                     rounded-lg shadow-xl p-3 text-sm text-gray-700"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="font-medium text-gray-800 text-xs uppercase tracking-wide">
              {fieldName}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          {loading && (
            <div className="flex items-center text-gray-500 py-2">
              <Loader2 className="animate-spin mr-2" size={14} /> Asking the consultant…
            </div>
          )}
          {error && <div className="text-red-600 text-xs">{error}</div>}
          {!loading && !error && reply && (
            <div className="whitespace-pre-wrap text-xs leading-relaxed">{reply}</div>
          )}
          {!loading && !error && reply && (
            <button
              type="button"
              onClick={fetchHelp}
              className="mt-2 text-xs text-primary-600 hover:underline"
            >
              Re-ask
            </button>
          )}
        </div>
      )}
    </span>
  );
}

export default InlineFormHelper;
