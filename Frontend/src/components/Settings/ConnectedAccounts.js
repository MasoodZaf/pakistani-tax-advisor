import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { Link2, Unlink, ShieldCheck } from 'lucide-react';
import AppleSignInButton from '../Auth/AppleSignInButton';

// Same per-mount nonce pattern as the Login screen — backend re-checks that
// the SSO ID token's `nonce` claim equals this value, defeating replay.
function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const PROVIDER_LABELS = {
  google: 'Google',
  apple:  'Apple',
};

// Connected Accounts panel.
//
// Shows the user's currently-linked SSO provider (if any) and lets them
// link or unlink. The "link" path is the standard recovery for users who
// hit `sso_email_conflict` during sign-in — log in with password first,
// then link the provider here.
//
// Calls into the same /api/sso/* surface as the login flow but using the
// authenticated /link and /unlink endpoints.
const ConnectedAccounts = () => {
  const [status, setStatus]   = useState({ provider: null, has_password: true, loaded: false });
  const [busy, setBusy]       = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  // One nonce per mount; the link endpoint requires it on both providers.
  const nonce = useMemo(() => generateNonce(), []);

  const refresh = useCallback(async () => {
    try {
      const r = await axios.get('/api/sso/status');
      setStatus({ ...r.data, loaded: true });
    } catch (err) {
      // Non-critical — just leave the panel in a "couldn't load" state.
      console.warn('sso/status fetch failed', err);
      setStatus((p) => ({ ...p, loaded: true }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const link = useCallback(async (provider, idToken) => {
    if (!idToken) {
      toast.error('No ID token returned by the provider');
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(`/api/sso/link/${provider}`, { idToken, nonce });
      if (r.data?.success) {
        toast.success(`Linked ${PROVIDER_LABELS[provider] || provider}`);
        await refresh();
      }
    } catch (err) {
      const code = err.response?.data?.error;
      const message =
        code === 'email_mismatch'      ? 'The Google/Apple account email doesn\'t match this account.' :
        code === 'sso_already_linked'  ? 'Another sign-in method is already linked. Unlink it first.' :
        code === 'sso_identity_taken'  ? 'That Google/Apple account is already linked to a different user.' :
        code === 'invalid_nonce'       ? 'Sign-in attempt expired. Try again.' :
        err.response?.data?.message    || err.message || 'Link failed';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }, [nonce, refresh]);

  const handleGoogleSuccess = (credentialResponse) => link('google', credentialResponse?.credential);
  const handleAppleSuccess  = ({ identityToken }) => link('apple', identityToken);

  const unlink = useCallback(async () => {
    setBusy(true);
    try {
      const r = await axios.post('/api/sso/unlink');
      if (r.data?.success) {
        toast.success(`Unlinked ${PROVIDER_LABELS[r.data.unlinked_provider] || r.data.unlinked_provider}`);
        await refresh();
      }
    } catch (err) {
      const code = err.response?.data?.error;
      const message =
        code === 'no_password_set' ? 'Set a password first — unlinking would leave you with no sign-in method.' :
        code === 'no_sso_linked'   ? 'No sign-in method is currently linked.' :
        err.response?.data?.message || err.message || 'Unlink failed';
      toast.error(message);
    } finally {
      setBusy(false);
      setConfirmUnlink(false);
    }
  }, [refresh]);

  if (!status.loaded) {
    return (
      <div className="text-sm text-gray-500">Loading connected accounts…</div>
    );
  }

  // Currently linked: show the provider + an Unlink button.
  if (status.provider) {
    return (
      <div>
        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <div>
              <div className="font-medium text-gray-900">
                Signed in with {PROVIDER_LABELS[status.provider] || status.provider}
              </div>
              <div className="text-sm text-gray-600">
                You can also sign in with your password
                {!status.has_password ? ' (not set — set one before unlinking)' : ''}.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmUnlink(true)}
            disabled={busy || !status.has_password}
            title={!status.has_password ? 'Set a password first' : 'Unlink this provider'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Unlink className="w-4 h-4" /> Unlink
          </button>
        </div>

        {confirmUnlink && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <p className="text-amber-900 font-medium mb-2">
              Unlink {PROVIDER_LABELS[status.provider] || status.provider}?
            </p>
            <p className="text-amber-800 mb-3">
              You'll only be able to sign in with your email and password after this.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={unlink}
                disabled={busy}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Yes, unlink
              </button>
              <button
                type="button"
                onClick={() => setConfirmUnlink(false)}
                disabled={busy}
                className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not linked: show both Link buttons.
  return (
    <div>
      <p className="text-sm text-gray-600 mb-3 flex items-center gap-1.5">
        <Link2 className="w-4 h-4 text-gray-500" />
        Link a Google or Apple account to sign in faster. The provider's email
        must match this account's email.
      </p>
      <div className="flex flex-col gap-2 items-start">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => toast.error('Google sign-in failed')}
          useOneTap={false}
          theme="outline"
          size="medium"
          text="signin_with"
          width="280"
          nonce={nonce}
        />
        <AppleSignInButton
          onSuccess={handleAppleSuccess}
          onError={(err) => toast.error(err.message || 'Apple sign-in failed')}
          disabled={busy}
          nonce={nonce}
        />
      </div>
    </div>
  );
};

export default ConnectedAccounts;
