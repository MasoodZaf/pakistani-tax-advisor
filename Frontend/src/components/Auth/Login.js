import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isStaff } from '../../utils/roles';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Shield, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import AppleSignInButton from './AppleSignInButton';
import BrandMark from '../common/BrandMark';

// A 22-char URL-safe random nonce. Generated once per Login mount; both
// providers receive the same value so the backend can re-check the JWT's
// `nonce` claim against what the client claims to have sent. This binds the
// ID token to this specific sign-in attempt — a token captured elsewhere
// can't be replayed without also matching this nonce.
function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ─── Styles ─────────────────────────────────────────────────────────────────── */
const Styles = () => (
  <style>{`
    /* Brand fonts loaded once in public/index.html (UX-06) */

    .login-root {
      font-family: 'Nunito', sans-serif;
      min-height: 100vh;
      display: flex;
      background: var(--surface);
      -webkit-font-smoothing: antialiased;
    }
    .login-display { font-family: 'Bricolage Grotesque', sans-serif; }

    /* ── Left panel ── */
    .login-brand {
      width: 45%;
      background: #28396C;
      background-image:
        radial-gradient(ellipse at 10% 80%, rgba(245,158,11,0.15) 0%, transparent 55%),
        radial-gradient(ellipse at 90% 10%, rgba(255,255,255,0.06) 0%, transparent 50%);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 44px 40px;
    }

    /* Geometric grid overlay */
    .login-brand::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none;
    }

    /* Decorative circle */
    .login-brand::after {
      content: '';
      position: absolute;
      right: -120px;
      top: 50%;
      transform: translateY(-50%);
      width: 360px;
      height: 360px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.07);
      pointer-events: none;
    }

    .brand-inner { position: relative; z-index: 1; }

    /* ── Right panel ── */
    .login-form-panel {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 32px;
      overflow-y: auto;
    }

    /* ── Inputs ── */
    .ln-input {
      width: 100%;
      padding: 12px 14px 12px 42px;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: var(--content);
      background: var(--surface-raised);
      border: 1.5px solid var(--line);
      border-radius: 12px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ln-input:focus {
      border-color: #28396C;
      box-shadow: 0 0 0 3px rgba(40,57,108,0.1);
    }
    .ln-input.error { border-color: #f87171; background: #fff5f5; }
    [data-theme="dark"] .ln-input.error { background: #2a1414; }
    .ln-input:disabled { background: var(--brand-hover-bg); color: var(--content-subtle); cursor: not-allowed; }

    /* ── Buttons ── */
    .ln-btn {
      width: 100%;
      padding: 13px 20px;
      background: #28396C;
      color: #fff;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 700;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
    }
    .ln-btn:hover:not(:disabled) {
      background: #1e2d5a;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(40,57,108,0.22);
    }
    .ln-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }


    /* ── Spinner ── */
    @keyframes spin { to { transform: rotate(360deg); } }
    .ln-spinner {
      width: 18px; height: 18px;
      border: 2.5px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* ── Staggered brand animation ── */
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .brand-anim-1 { animation: fadeSlideUp 0.5s ease 0.1s both; }
    .brand-anim-2 { animation: fadeSlideUp 0.5s ease 0.2s both; }
    .brand-anim-3 { animation: fadeSlideUp 0.5s ease 0.35s both; }
    .brand-anim-4 { animation: fadeSlideUp 0.5s ease 0.5s both; }

    /* ── Form entrance ── */
    @keyframes formSlide {
      from { opacity: 0; transform: translateX(20px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .form-anim { animation: formSlide 0.45s ease 0.15s both; }
    @media (prefers-reduced-motion: reduce) {
      .brand-anim-1, .brand-anim-2, .brand-anim-3, .brand-anim-4,
      .form-anim { animation: none; }
    }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .login-brand { display: none; }
      .login-form-panel { padding: 32px 20px; }
    }
  `}</style>
);

/* ─── Geometric SVG pattern ─────────────────────────────────────────────────── */
const BrandPanel = () => (
  <div className="login-brand">
    {/* Top: logo */}
    <div className="brand-inner brand-anim-1">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <BrandMark size={20} glyphOnly />
        </div>
        <span className="login-display" style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>MeraTax</span>
      </div>
    </div>

    {/* Middle: headline */}
    <div className="brand-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 0' }}>
      <div className="brand-anim-2">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 100, padding: '4px 12px', marginBottom: 24 }}>
          <div style={{ width: 6, height: 6, background: '#B5E18B', borderRadius: '50%' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600, letterSpacing: '0.04em' }}>TAX YEAR 2025-26</span>
        </div>
        <h1 className="login-display" style={{ fontSize: 'clamp(30px, 3vw, 42px)', fontWeight: 800, color: '#fff', lineHeight: 1.12, letterSpacing: '-0.03em', marginBottom: 16 }}>
          Your tax return,<br />handled properly.
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, fontWeight: 500, maxWidth: 300 }}>
          FBR-compliant preparation for every income type. Finance Act 2025 rates. Auto-calculated.
        </p>
      </div>

      {/* Mini feature pills */}
      <div className="brand-anim-3" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 36 }}>
        {[
          '12 FBR return forms in one place',
          'Auto-calculated tax liability',
          'Wealth statement & reconciliation',
        ].map(text => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 20, height: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Check size={11} color="#B5E18B" strokeWidth={3} />
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom: tagline */}
    <div className="brand-inner brand-anim-4">
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
        Independent tool — not affiliated with FBR
      </p>
    </div>

    {/* Decorative diamond shapes */}
    <svg style={{ position: 'absolute', bottom: 60, right: 40, opacity: 0.06, pointerEvents: 'none' }} width="160" height="160" viewBox="0 0 160 160" fill="none">
      <rect x="80" y="4" width="108" height="108" rx="4" transform="rotate(45 80 80)" stroke="white" strokeWidth="1.5"/>
      <rect x="80" y="22" width="74" height="74" rx="4" transform="rotate(45 80 80)" stroke="white" strokeWidth="1.5"/>
      <rect x="80" y="40" width="40" height="40" rx="4" transform="rotate(45 80 80)" stroke="white" strokeWidth="1.5"/>
    </svg>
  </div>
);

/* ─── Field wrapper ─────────────────────────────────────────────────────────── */
function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--content)', marginBottom: 6, letterSpacing: '0.01em' }}>{label}</label>
      {children}
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</p>}
    </div>
  );
}

/* ─── Main Login ─────────────────────────────────────────────────────────────── */
const Login = () => {
  const navigate = useNavigate();
  const { user, login, ssoLogin } = useAuth();

  const [formData, setFormData]             = useState({ email: '', password: '' });
  const [showPassword, setShowPassword]     = useState(false);
  const [loading, setLoading]               = useState(false);
  const [errors, setErrors]                 = useState({});
  const [rememberMe, setRememberMe]         = useState(true);
  const [adminAssistedLogin, setAdminAssistedLogin] = useState(null);
  // One nonce per Login mount — both Google and Apple receive it; backend
  // verifies the ID token's nonce claim equals this value.
  const ssoNonce = useMemo(() => generateNonce(), []);

  useEffect(() => {
    const data = localStorage.getItem('adminAssistedLogin');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (Date.now() - parsed.timestamp < 300000) { // 5 min — matches backend JWT expiry
        setAdminAssistedLogin(parsed);
        setFormData(p => ({ ...p, email: parsed.email }));
        toast.success(`Ready to login as ${parsed.userName}`, { duration: 5000, icon: '🔑' });
      } else {
        localStorage.removeItem('adminAssistedLogin');
        toast.error('Admin bypass token has expired');
      }
    } catch { localStorage.removeItem('adminAssistedLogin'); }
  }, []);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!formData.email)                            e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Enter a valid email';
    // Skip password validation for admin-assisted login (bypass token is used instead)
    if (!adminAssistedLogin) {
      if (!formData.password)                       e.password = 'Password is required';
      else if (formData.password.length < 6)        e.password = 'Password is too short';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const loginPayload = {
        email: formData.email,
        password: formData.password || 'admin-bypass',
      };
      if (adminAssistedLogin) loginPayload.adminBypassToken = adminAssistedLogin.tempBypassToken;

      // Admin-assisted (bypass) logins always persist; otherwise honour the
      // "Remember me" checkbox.
      const result = await login(loginPayload.email, loginPayload.password, loginPayload.adminBypassToken, adminAssistedLogin ? true : rememberMe);
      if (result.success) {
        if (adminAssistedLogin) {
          localStorage.removeItem('adminAssistedLogin');
          toast.success(`Logged in as ${adminAssistedLogin.userName}`, { duration: 4000 });
        }
        // Routing: temp-password users → forced reset, staff → /hub (the
        // workspace chooser), everyone else → /dashboard. The previous
        // `needsPersonalInfo` branch routed users to /personal-info but
        // UserOnlyRoute then bounces unboarded users to /onboarding, so that
        // branch was effectively dead. Onboarding redirect is now handled
        // exclusively by the route guards.
        if (result.userData?.must_reset_password) {
          navigate('/set-password');
        } else if (isStaff(result.userData)) {
          navigate('/hub');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  // Generic post-SSO routing — used by both providers.
  // New SSO users land in onboarding so they fill personal info before the
  // dashboard tries to render their tax data; returning users go straight to
  // their dashboard (or admin console).
  const afterSsoSuccess = (result) => {
    if (!result?.success) return;
    if (isStaff(result.userData)) {
      navigate('/hub');
    } else if (result.needsPersonalInfo) {
      navigate('/onboarding');
    } else {
      navigate('/dashboard');
    }
  };

  // Google Sign-In success: the credential is the ID token (a JWT). Hand it
  // to the backend bridge along with the nonce we generated for this attempt.
  const handleGoogleSuccess = async (credentialResponse) => {
    const idToken = credentialResponse?.credential;
    if (!idToken) {
      toast.error('Google sign-in: missing credential');
      return;
    }
    setLoading(true);
    try {
      afterSsoSuccess(await ssoLogin('google', idToken, ssoNonce));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSuccess = async ({ identityToken }) => {
    setLoading(true);
    try {
      afterSsoSuccess(await ssoLogin('apple', identityToken, ssoNonce));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-root">
      <Styles />

      {/* Brand panel — hidden on mobile */}
      <BrandPanel />

      {/* Form panel */}
      <div className="login-form-panel">
        <div className="form-anim" style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo (only visible when brand panel is hidden) */}
          <div style={{ display: 'none', alignItems: 'center', gap: 9, marginBottom: 28 }} className="mobile-logo">
            <BrandMark size={32} />
            <span className="login-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--content)' }}>MeraTax</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 className="login-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.025em', marginBottom: 6 }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 15, color: 'var(--content-muted)', fontWeight: 500 }}>
              Sign in to continue to your return.{' '}
              <Link to="/onboarding" style={{ color: 'var(--content)', fontWeight: 700, textDecoration: 'none' }}>New here?</Link>
            </p>
          </div>

          {/* Admin-assisted banner */}
          {adminAssistedLogin && (
            <div style={{ background: 'var(--brand-cream)', border: '1.5px solid var(--brand-cream-track)', borderRadius: 12, padding: '12px 14px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Shield size={18} color="var(--brand-on-cream-navy)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-on-cream-navy)', marginBottom: 2 }}>Admin-assisted login</p>
                <p style={{ fontSize: 13, color: 'var(--content-muted)', fontWeight: 500 }}>
                  Email pre-filled for <strong>{adminAssistedLogin.userName}</strong>. Just click Sign in.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Email address" error={errors.email}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <Mail size={16} color="var(--content-subtle)" />
                </div>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!!adminAssistedLogin}
                  className={`ln-input${errors.email ? ' error' : ''}`}
                />
              </div>
            </Field>

            <Field label="Password" error={errors.password}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <Lock size={16} color="var(--content-subtle)" />
                </div>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`ln-input${errors.password ? ' error' : ''}`}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--content-subtle)', display: 'flex', padding: 2 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: -4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#28396C', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--content-muted)' }}>Remember me</span>
              </label>
              <button type="button" onClick={() => toast('Contact your administrator to reset your password.', { icon: 'ℹ️' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--content)', fontFamily: "'Nunito', sans-serif" }}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="ln-btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? <><div className="ln-spinner" /> Signing in…</> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          {/* SSO providers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 12, color: 'var(--content-subtle)', fontWeight: 500 }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Google sign-in failed')}
              useOneTap={false}
              theme="outline"
              size="large"
              width="320"
              nonce={ssoNonce}
            />
            <AppleSignInButton
              onSuccess={handleAppleSuccess}
              onError={(err) => toast.error(err.message || 'Apple sign-in failed')}
              disabled={loading}
              nonce={ssoNonce}
            />
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--content-subtle)', fontWeight: 500, marginTop: 24 }}>
            Don't have an account?{' '}
            <Link to="/onboarding" style={{ color: 'var(--content)', fontWeight: 700, textDecoration: 'none' }}>Create one free</Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
