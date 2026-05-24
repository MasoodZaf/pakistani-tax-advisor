import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// FormEmptyState
//
// Shown when a form's addon-filtered visibility leaves it with zero rows.
// Standardised across FinalMinIncomeForm, ReductionsForm, CapitalGainsForm
// (and any future form that goes empty under the visibility manifest).
//
// Pattern:
//   - One-line headline explaining why the form is empty.
//   - Pill-list of the income-stream addon(s) that would unlock content,
//     so the user knows exactly what to toggle.
//   - Optional context note explaining the design intent.
//   - Direct CTA into Settings → Income Streams.
//
// Keeping this component small and quiet — the empty state is a hint, not
// a hero card. Two-color palette (blue family) for visual consistency
// regardless of which form embeds it.
const FormEmptyState = ({ title, addons = [], note }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900">{title}</p>

          {addons.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-blue-700">Unlocked by:</span>
              {addons.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                >
                  {a}
                </span>
              ))}
            </div>
          )}

          {note && (
            <p className="text-xs text-blue-700 mt-2 leading-relaxed">{note}</p>
          )}

          <Link
            to="/settings"
            className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
          >
            Manage income streams in Settings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FormEmptyState;
