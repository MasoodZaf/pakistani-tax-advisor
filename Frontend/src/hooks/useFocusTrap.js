import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * useFocusTrap(active, { onEscape, restoreFocus })
 *
 * Attach the returned ref to a modal/dialog container. While `active` is true:
 *  - focus is moved into the dialog (its first focusable control, or the
 *    container itself if it has none),
 *  - Tab / Shift+Tab cycle within the dialog instead of escaping to the page
 *    behind it,
 *  - Escape calls `onEscape` (optional),
 *  - on deactivation it returns focus to whatever was focused before.
 *
 * In short: it keeps keyboard users inside the dialog the same way the visual
 * backdrop keeps mouse users inside it. There was no shared trap before, so
 * every modal re-implemented (or skipped) this — see HelpHint, NumberTrace,
 * PriorYearUploadModal.
 *
 * `onEscape` is read through a ref so passing an inline closure does NOT
 * re-arm the trap (and re-steal focus) on every render.
 */
export function useFocusTrap(active, options = {}) {
  const { onEscape, restoreFocus = true } = options;
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    // Remember what had focus so we can restore it when the dialog closes.
    previousFocusRef.current = document.activeElement;

    const getFocusable = () =>
      Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Move focus inside. A dialog with no focusable controls (e.g. a read-only
    // breakdown popover) still needs focus pulled off the page behind it, so we
    // make the container itself programmatically focusable.
    const focusable = getFocusable();
    if (focusable.length) {
      focusable[0].focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onEscapeRef.current) onEscapeRef.current(e);
        return;
      }
      if (e.key !== 'Tab') return;

      const items = getFocusable();
      if (!items.length) {
        // Nothing to tab to — keep focus pinned inside the dialog.
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const previous = previousFocusRef.current;
      if (restoreFocus && previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [active, restoreFocus]);

  return containerRef;
}

export default useFocusTrap;
