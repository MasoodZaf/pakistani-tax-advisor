// Generic OIDC ID-token verifier. Used by /api/auth/sso/{google,apple}.
//
// Verifies:
//   - Signature against the provider's JWKS (cached by jose)
//   - iss claim matches the provider's issuer
//   - aud claim is in the list of allowed audiences (web/iOS/android client IDs)
//   - exp claim is in the future (jose enforces by default)
//   - email is present and email_verified === true (Google) or email is verified
//     by virtue of being in the token (Apple — see comment below)
//
// Returns the verified claims on success; throws on any failure.

// jose v5+ is ESM-only, so we import it dynamically the first time we
// actually need to verify a token. Keeps unit tests that stub the verifier
// (via _setVerifierForTests) from having to deal with the ESM transform.
let _jose = null;
async function loadJose() {
  if (!_jose) _jose = await import('jose');
  return _jose;
}
const logger = require('../utils/logger');

// Provider config. Add new providers here.
//
// For Google, the aud list is built from up to three env vars (web, iOS,
// Android). For Apple, aud is the Services ID (web) or bundle ID (native iOS).
// Each provider can declare multiple audiences because the same backend
// receives tokens issued for different client IDs.
const PROVIDERS = {
  google: {
    issuer: 'https://accounts.google.com',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    audsFromEnv: () => [
      process.env.GOOGLE_OAUTH_CLIENT_ID_WEB,
      process.env.GOOGLE_OAUTH_CLIENT_ID_MOBILE_IOS,
      process.env.GOOGLE_OAUTH_CLIENT_ID_MOBILE_ANDROID,
    ].filter(Boolean),
    requireEmailVerified: true,
  },
  apple: {
    issuer: 'https://appleid.apple.com',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    audsFromEnv: () => [
      process.env.APPLE_OAUTH_SERVICE_ID,    // web
      process.env.APPLE_OAUTH_BUNDLE_ID,     // iOS native
    ].filter(Boolean),
    // Apple's tokens carry email_verified for *real* emails. For private
    // relay emails Apple sets email_verified=true server-side; we trust it.
    requireEmailVerified: true,
  },
};

// One JWKSet per provider, cached across requests. jose handles refresh
// automatically (when an unknown `kid` is seen, the JWKS is re-fetched).
const _jwksCache = new Map();
async function jwksFor(providerKey) {
  if (!_jwksCache.has(providerKey)) {
    const p = PROVIDERS[providerKey];
    if (!p) throw new Error(`unknown_sso_provider:${providerKey}`);
    const { createRemoteJWKSet } = await loadJose();
    _jwksCache.set(providerKey, createRemoteJWKSet(new URL(p.jwksUrl)));
  }
  return _jwksCache.get(providerKey);
}

// Verify a provider's ID token. Returns:
//   { sub, email, name, picture, emailVerified, provider, raw }
//
// Throws on signature/claim failure. Errors are intentionally generic
// (no stack-trace leaking back to the client).
async function verifyIdToken(providerKey, idToken) {
  const p = PROVIDERS[providerKey];
  if (!p) throw new Error('unsupported_provider');

  const auds = p.audsFromEnv();
  if (auds.length === 0) {
    // Misconfigured backend. Refuse rather than silently let any aud pass.
    logger.error(`[oidcVerifier] no audiences configured for ${providerKey}`);
    throw new Error('provider_not_configured');
  }

  let payload;
  try {
    const { jwtVerify } = await loadJose();
    const jwks = await jwksFor(providerKey);
    const result = await jwtVerify(idToken, jwks, {
      issuer: p.issuer,
      audience: auds,
      // jose enforces exp/nbf by default.
    });
    payload = result.payload;
  } catch (err) {
    logger.warn(`[oidcVerifier] verification failed (${providerKey})`, {
      code: err.code,
      message: err.message,
    });
    // Map a few common jose error codes to stable strings; everything else
    // collapses to a generic invalid_token.
    if (err.code === 'ERR_JWT_EXPIRED') throw new Error('token_expired');
    if (err.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') throw new Error('invalid_claims');
    throw new Error('invalid_token');
  }

  if (!payload.sub) throw new Error('missing_sub');
  if (!payload.email) throw new Error('missing_email');

  // email_verified shape:
  //   Google sets a boolean.
  //   Apple's docs say string 'true' / 'false' historically; recent ID tokens
  //   send a boolean. Accept either.
  if (p.requireEmailVerified) {
    const ev = payload.email_verified;
    const verified = ev === true || ev === 'true';
    if (!verified) throw new Error('email_not_verified');
  }

  return {
    sub: payload.sub,
    email: String(payload.email).toLowerCase().trim(),
    name: payload.name || null,
    picture: payload.picture || null,
    emailVerified: true,
    provider: providerKey,
    raw: payload,
  };
}

// Exposed for tests so we can plug in a fake verifier without hitting the
// network. Caller passes a synchronous function returning the same shape
// `verifyIdToken` resolves with (or throwing the same error strings).
let _testVerifier = null;
function _setVerifierForTests(fn) {
  _testVerifier = fn;
}

async function verify(providerKey, idToken) {
  if (_testVerifier) return _testVerifier(providerKey, idToken);
  return verifyIdToken(providerKey, idToken);
}

module.exports = {
  verify,
  _setVerifierForTests,
  // Exposed only for the test that asserts misconfiguration handling.
  _PROVIDERS: PROVIDERS,
};
