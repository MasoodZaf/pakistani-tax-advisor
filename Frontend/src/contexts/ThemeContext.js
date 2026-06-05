import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Theme system (UX-07 dark mode).
 *
 * Three user-selectable preferences — 'light', 'dark', 'system' — persisted to
 * localStorage under THEME_KEY. 'system' (the default) follows the OS via
 * prefers-color-scheme and live-updates when the OS flips. The *resolved* theme
 * ('light' | 'dark') is applied to <html> as the `dark` class (Tailwind
 * darkMode:'class') AND a `data-theme` attribute (for CSS-variable overrides in
 * index.css and component <style> blocks).
 *
 * A no-flash inline script in public/index.html applies the same class BEFORE
 * first paint, so this provider's initial effect only needs to keep it in sync.
 */

export const THEME_KEY = 'theme';

const ThemeContext = createContext(undefined);

const getStoredPreference = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* localStorage unavailable (private mode / SSR) — fall through to default */
  }
  return 'system';
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolve = (preference) =>
  preference === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : preference;

const applyResolved = (resolved) => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-theme', resolved);
};

export const ThemeProvider = ({ children }) => {
  const [preference, setPreferenceState] = useState(getStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolve(getStoredPreference()));

  // Apply the resolved theme to <html> whenever the preference changes, and
  // persist the preference.
  useEffect(() => {
    const resolved = resolve(preference);
    setResolvedTheme(resolved);
    applyResolved(resolved);
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch {
      /* ignore persistence failures */
    }
  }, [preference]);

  // When following the system, react to live OS theme changes.
  useEffect(() => {
    if (preference !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const resolved = systemPrefersDark() ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyResolved(resolved);
    };
    // addEventListener is the modern API; addListener is the Safari<14 fallback.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [preference]);

  const setPreference = useCallback((next) => setPreferenceState(next), []);

  // Convenience: cycle Light → Dark → System (used by the compact header toggle).
  const cyclePreference = useCallback(() => {
    setPreferenceState((p) => (p === 'light' ? 'dark' : p === 'dark' ? 'system' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{ preference, resolvedTheme, setPreference, cyclePreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};

export default ThemeContext;
