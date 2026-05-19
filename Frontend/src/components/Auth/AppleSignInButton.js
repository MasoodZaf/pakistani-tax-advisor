import React, { useEffect, useState, useCallback } from 'react';

// Apple Sign-In button. Loads Apple's JS SDK on demand, initialises it with
// the configured Services ID, and reports the `identityToken` back via
// onSuccess. Kept dependency-free (no extra npm package needed) — the SDK
// itself is hosted on Apple's CDN.
//
// Required env: REACT_APP_APPLE_SERVICES_ID (the Services ID from the
// Apple Developer portal, e.g. `com.paktaxadvisor.web`).
// The redirect URI must be registered in the Apple Developer portal under
// the same Services ID. For pop-up flow it can be the current origin.

const SCRIPT_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

function loadAppleScript() {
  return new Promise((resolve, reject) => {
    if (window.AppleID?.auth) {
      resolve(window.AppleID);
      return;
    }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.AppleID));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.AppleID);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const AppleSignInButton = ({ onSuccess, onError, disabled }) => {
  const [ready, setReady] = useState(false);
  const servicesId = process.env.REACT_APP_APPLE_SERVICES_ID || '';
  const redirectUri = process.env.REACT_APP_APPLE_REDIRECT_URI || window.location.origin;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const AppleID = await loadAppleScript();
        if (cancelled) return;
        if (!servicesId) {
          // Render the button but report a clear error on click.
          setReady(true);
          return;
        }
        AppleID.auth.init({
          clientId: servicesId,
          scope: 'name email',
          redirectURI: redirectUri,
          usePopup: true,
        });
        setReady(true);
      } catch (err) {
        if (!cancelled && onError) onError(new Error('Apple SDK failed to load'));
      }
    })();
    return () => { cancelled = true; };
  }, [servicesId, redirectUri, onError]);

  const handleClick = useCallback(async () => {
    if (!servicesId) {
      if (onError) onError(new Error('Apple Sign-In is not configured'));
      return;
    }
    try {
      const result = await window.AppleID.auth.signIn();
      const identityToken = result?.authorization?.id_token;
      if (!identityToken) {
        if (onError) onError(new Error('Apple did not return an identity token'));
        return;
      }
      // Apple only returns the `user` block on the FIRST sign-in. After that
      // we rely on the backend to remember the name (or fall back to email).
      const name = result?.user
        ? `${result.user.name?.firstName || ''} ${result.user.name?.lastName || ''}`.trim() || null
        : null;
      onSuccess({ identityToken, name });
    } catch (err) {
      // User-cancel comes through as { error: 'popup_closed_by_user' } — silent.
      if (err?.error === 'popup_closed_by_user') return;
      if (onError) onError(err instanceof Error ? err : new Error(err?.error || 'Apple sign-in failed'));
    }
  }, [servicesId, onSuccess, onError]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ready || disabled}
      style={{
        width: 320,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: '#000',
        color: '#fff',
        border: '1px solid #000',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: 14,
        cursor: ready && !disabled ? 'pointer' : 'not-allowed',
        opacity: ready && !disabled ? 1 : 0.6,
      }}
    >
      {/* Apple logo (SVG, no extra deps) */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.05 12.04c-.03-3.07 2.5-4.55 2.62-4.62-1.43-2.09-3.66-2.37-4.45-2.4-1.88-.19-3.69 1.11-4.65 1.11-.98 0-2.45-1.09-4.04-1.06-2.07.03-3.99 1.21-5.06 3.08-2.16 3.74-.55 9.27 1.55 12.31 1.03 1.49 2.24 3.16 3.83 3.1 1.55-.06 2.13-1 4-1 1.86 0 2.39 1 4.02.97 1.66-.03 2.71-1.51 3.72-3.01 1.17-1.73 1.65-3.41 1.68-3.5-.04-.02-3.22-1.24-3.22-4.98zM14.05 3.3C14.86 2.31 15.41 1.01 15.27 0c-1.04.04-2.31.69-3.14 1.66C11.4 2.53 10.74 3.86 10.91 4.84c1.16.09 2.34-.59 3.14-1.54z" />
      </svg>
      Continue with Apple
    </button>
  );
};

export default AppleSignInButton;
