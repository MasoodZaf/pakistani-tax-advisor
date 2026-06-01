import React from 'react';
import { ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';

/**
 * Footer navigation for a form step. Stacks full-width on mobile, row at sm+.
 * Navy primary / navy-outline secondary / neutral back — one button hierarchy.
 * Render only the actions you pass handlers for.
 */
export default function FormNav({
  onBack, backLabel = 'Back',
  onSave, saveLabel = 'Save & continue', saving = false,
  onNext, nextLabel = 'Complete & next', submitting = false, nextType = 'button',
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-full items-center justify-center gap-2 rounded-brand border-[1.5px] border-slate-300 px-5 py-2.5 font-body text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/20 sm:w-auto"
          >
            <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-brand border-[1.5px] border-navy px-5 py-2.5 font-body text-sm font-semibold text-navy transition-colors hover:bg-navy/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/20 disabled:opacity-50 sm:w-auto"
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            {saveLabel}
          </button>
        )}
        {onNext && (
          <button
            type={nextType}
            onClick={nextType === 'button' ? onNext : undefined}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-brand bg-navy px-5 py-2.5 font-body text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/30 disabled:opacity-50 sm:w-auto"
          >
            {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {nextLabel} <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
