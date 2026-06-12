import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, BookOpen, Lightbulb, ExternalLink } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * Inline ⓘ icon that opens a side drawer with FBR-cited plain-language help.
 *
 * Usage:
 *   import incomeFormHelp from '../../help/incomeFormHelp';
 *   <label>Bonus <HelpHint fieldId="bonus" source={incomeFormHelp} /></label>
 *
 * The drawer stays mounted at root with `position: fixed` so it can overlap
 * any form, and it closes on Escape, on backdrop click, or on its X button.
 *
 * Stage 2: an "Ask the assistant" button that opens a Claude-powered chat
 * grounded on this same JSON content + the user's already-entered numbers.
 */
const HelpHint = ({ fieldId, source, label, size = 14, className = '' }) => {
  const [open, setOpen] = useState(false);
  const entry = source?.[fieldId];

  // Trap focus inside the drawer while it's open, close on Escape, and return
  // focus to the ⓘ trigger on close. Ref attaches to the <aside> below.
  const drawerRef = useFocusTrap(open, { onEscape: () => setOpen(false) });

  // No content authored for this field yet → render nothing rather than a
  // broken icon. Keeps the UI clean while we roll content out form by form.
  if (!entry) return null;

  const drawer = (
    <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15, 23, 42, 0.35)',
              backdropFilter: 'blur(2px)',
              zIndex: 200,
            }}
            className="hh-backdrop"
          />

          {/* Drawer */}
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={entry.title}
            style={{
              position: 'fixed',
              top: 0, right: 0, bottom: 0,
              width: 'min(440px, 92vw)',
              background: 'var(--surface-raised)',
              boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.18)',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Nunito, system-ui, sans-serif',
            }}
            className="hh-drawer"
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px',
              borderBottom: '1px solid var(--line)',
              background: 'linear-gradient(135deg, var(--surface-sunken) 0%, rgba(40,57,108,0.06) 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: '#28396C', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <BookOpen size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--content-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0,
                  }}>
                    FBR-cited guidance
                  </p>
                  <h3 style={{
                    fontFamily: 'Bricolage Grotesque, sans-serif',
                    fontSize: 17, fontWeight: 800, color: 'var(--content)',
                    margin: 0, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: 'none', background: 'transparent',
                  color: 'var(--content-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--content-muted)'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px' }}>
              <section style={{ marginBottom: 22 }}>
                <h4 style={{
                  fontSize: 12, fontWeight: 700, color: '#28396C',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  margin: '0 0 8px',
                }}>
                  In plain language
                </h4>
                <p style={{
                  fontSize: 15, color: 'var(--content)',
                  lineHeight: 1.6, fontWeight: 500, margin: 0,
                }}>
                  {entry.plainLanguage}
                </p>
              </section>

              {entry.example && (
                <section className="hh-example" style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 22,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Lightbulb size={14} style={{ color: '#d97706' }} />
                    <h4 style={{
                      fontSize: 12, fontWeight: 700, color: '#92400e',
                      textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                    }}>
                      Pakistani example
                    </h4>
                  </div>
                  <p style={{
                    fontSize: 14, color: '#78350f',
                    lineHeight: 1.6, fontWeight: 500, margin: 0,
                  }}>
                    {entry.example}
                  </p>
                </section>
              )}

              {(entry.fbrSection || entry.fbrUrl) && (
                <section style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: 16,
                }}>
                  <h4 style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--content-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    margin: '0 0 8px',
                  }}>
                    Source
                  </h4>
                  {entry.fbrSection && (
                    <p style={{
                      fontSize: 13, color: 'var(--content-muted)',
                      fontWeight: 600, margin: '0 0 6px',
                    }}>
                      {entry.fbrSection}
                    </p>
                  )}
                  {entry.fbrUrl && (
                    <a
                      href={entry.fbrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: 13, fontWeight: 700, color: '#28396C',
                        textDecoration: 'none',
                      }}
                    >
                      Verify on FBR.gov.pk <ExternalLink size={12} />
                    </a>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 22px',
              borderTop: '1px solid var(--line)',
              background: 'var(--surface-sunken)',
              fontSize: 11, color: 'var(--content-muted)', fontWeight: 500,
              lineHeight: 1.5,
            }}>
              This is general guidance based on FBR's published rules. For complex cases or recent rulings, consult a registered tax practitioner.
            </div>
          </aside>

          <style>{`
            @keyframes hh-fade-in { from { opacity: 0 } to { opacity: 1 } }
            @keyframes hh-slide-in { from { transform: translateX(100%) } to { transform: translateX(0) } }
            .hh-backdrop { animation: hh-fade-in 0.15s ease; }
            .hh-drawer { animation: hh-slide-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
            @media (prefers-reduced-motion: reduce) {
              .hh-backdrop, .hh-drawer { animation: none; }
            }
            [data-theme="dark"] .hh-example { background: #2a230b; border-color: #b45309; }
          `}</style>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title={`Help: ${entry.title || label || fieldId}`}
        aria-label={`Show help for ${entry.title || label || fieldId}`}
        className={`hh-icon ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          marginLeft: 6,
          padding: 0,
          border: '1.5px solid var(--line)',
          background: 'rgba(40,57,108,0.07)',
          color: '#28396C',
          cursor: 'pointer',
          borderRadius: 999,
          verticalAlign: 'middle',
          transition: 'background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#28396C';
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.borderColor = '#28396C';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#eef2ff';
          e.currentTarget.style.color = '#28396C';
          e.currentTarget.style.borderColor = 'var(--line)';
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Info size={size} strokeWidth={2.5} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(drawer, document.body)}
    </>
  );
};

export default HelpHint;
