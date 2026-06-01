import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Full-card loading / error / empty state. Replaces the 3–4 copy-pasted guard
 * branches at the top of each form (ratesError / loading / no-data).
 *
 * Props: icon (lucide), title, message, action (node), spinning, tone.
 */
export default function FormStateScreen({
  icon: Icon = Loader2, title, message, action, spinning = false, tone = 'neutral',
}) {
  const toneText =
    tone === 'error' ? 'text-red-500' : tone === 'success' ? 'text-green-600' : 'text-navy';
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-brand-lg border border-slate-200 bg-white px-6 py-16 text-center shadow-brand"
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'error' ? 'assertive' : 'polite'}
      >
        <Icon size={32} className={`${toneText} ${spinning ? 'animate-spin' : ''}`} aria-hidden="true" />
        {title && <h2 className="font-display text-lg font-bold text-navy">{title}</h2>}
        {message && <p className="max-w-md font-body text-sm text-slate-500">{message}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
