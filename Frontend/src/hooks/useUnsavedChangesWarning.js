import { useEffect } from 'react';

/**
 * useUnsavedChangesWarning(when)
 *
 * Warns the user before they LEAVE the page (browser refresh, tab close, or
 * navigation to an external URL) while `when` is true — typically wired to a
 * form's React Hook Form `formState.isDirty`.
 *
 * Scope / limitations:
 *  - Covers `beforeunload`: refresh, tab/window close, hard navigation away.
 *  - Does NOT intercept in-app (SPA) route changes or the browser Back button —
 *    the app uses <BrowserRouter>, where react-router's `useBlocker` is
 *    unavailable. Full Back-button interception needs the data router
 *    (createBrowserRouter + RouterProvider); tracked as a follow-up.
 *  - Keyed on `isDirty`, which only flips on genuine user edits (auto-calc
 *    `setValue` calls don't pass shouldDirty), so it never warns spuriously.
 */
export function useUnsavedChangesWarning(when) {
  useEffect(() => {
    if (!when) return undefined;
    const handler = (e) => {
      e.preventDefault();
      // Required for the native prompt in some browsers; the text is ignored.
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);
}

export default useUnsavedChangesWarning;
