import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TaxFormProvider } from './contexts/TaxFormContext';
import { TaxYearProvider } from './contexts/TaxYearContext';
// Eager: the persistent shell + the two first-paint views (login / guest
// landing). Keeping these in the entry bundle avoids a spinner flash on the
// very first screen.
import ErrorBoundary from './components/ErrorBoundary';
import { isStaff } from './utils/roles';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Login from './components/Auth/Login';
import Landing from './components/Landing/Landing';
import ConsentGate from './components/Legal/ConsentGate';

// Route-level code-splitting (PERF-01): everything below the shell loads as its
// own chunk on demand, so the entry bundle no longer carries the whole app
// (xlsx, the AI-consultant markdown stack, all tax modules, etc.).
const PersonalInfoForm = lazy(() => import('./components/PersonalInfo/PersonalInfoForm'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const TaxFormsFlow = lazy(() => import('./components/TaxForms/TaxFormsFlow'));
const IncomeTaxModule = lazy(() => import('./modules/IncomeTax'));
const WealthStatementModule = lazy(() => import('./modules/WealthStatement'));
const AdminModule = lazy(() => import('./modules/Admin'));
const Reports = lazy(() => import('./components/Reports/Reports'));
const ExcelManager = lazy(() => import('./components/Excel/ExcelManager'));
const TaxArchiveView = lazy(() => import('./components/TaxHistory/TaxArchiveView'));
const Settings = lazy(() => import('./components/Settings/Settings'));
const Onboarding = lazy(() => import('./components/Onboarding/Onboarding'));
const ConsultantPage = lazy(() => import('./components/AIConsultant/ConsultantPage'));
const FloatingChatWidget = lazy(() => import('./components/AIConsultant/FloatingChatWidget'));
const Wizard = lazy(() => import('./components/Wizard/Wizard'));
const ForcePasswordReset = lazy(() => import('./components/Auth/ForcePasswordReset'));
const Launcher = lazy(() => import('./components/Launcher/Launcher'));
// Public legal pages (Terms, Privacy, User Agreement, Consultant Agreement).
const PrivacyPolicy = lazy(() => import('./components/Legal/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./components/Legal/TermsAndConditions'));
const UserAgreement = lazy(() => import('./components/Legal/UserAgreement'));
const ConsultantAgreement = lazy(() => import('./components/Legal/ConsultantAgreement'));
// import ImpersonationBanner from './components/Admin/ImpersonationBanner'; // Not needed for manual login flow

// Full-screen fallback shown while a route chunk loads (mirrors the
// ProtectedRoute spinner so it feels continuous).
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="spinner"></div>
  </div>
);

// Branded 404 — the old fallback used the sky-blue legacy `.btn-primary`,
// visually disowning the navy/lime brand (UX-08). Links to "/" so PublicHome
// routes guests to the landing and signed-in users to their dashboard.
const NotFound = () => (
  <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Nunito', sans-serif" }}>
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 88, fontWeight: 800, color: 'var(--brand-on-cream-navy)', lineHeight: 1, margin: 0, letterSpacing: '-0.03em' }}>404</p>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700, color: 'var(--content)', margin: '12px 0 8px' }}>Page not found</h1>
      <p style={{ fontSize: 15, color: 'var(--content-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>The page you're looking for doesn't exist or may have moved.</p>
      <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#28396C', color: '#fff', fontWeight: 700, fontSize: 15, padding: '11px 22px', borderRadius: 10, textDecoration: 'none' }}>
        Back to home
      </a>
    </div>
  </div>
);

// A user is "needs onboarding" when authenticated as a non-staff user and the
// wizard hasn't been marked complete yet. Staff skip onboarding entirely.
const needsOnboarding = (u) =>
  !!u && !isStaff(u) && u.onboarding_completed === false;

// Bulk-imported users land with a temp password — they must set their own
// before touching anything else (checked ahead of every other redirect).
const mustResetPassword = (u) => !!u?.must_reset_password;

// Public home: Landing page for guests, dashboard redirect for authenticated users
const PublicHome = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (mustResetPassword(user)) return <Navigate to="/set-password" replace />;
    // Staff (owner / super_admin / admin / consultant) land on the workspace
    // hub so they can choose between the App, the Admin Console and the
    // Consultant Workspace, instead of being force-routed into /admin.
    if (isStaff(user)) return <Navigate to="/hub" replace />;
    if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <Landing />;
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (mustResetPassword(user)) return <Navigate to="/set-password" replace />;

  if (adminOnly && !isStaff(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;

  return children;
};

// Workspace hub — the intermediate landing for staff. Non-staff users have no
// hub (a single destination), so they're sent to their dashboard.
const StaffHubRoute = ({ children }) => {
  const { user, loading, roleChecked } = useAuth();

  // Wait for the session AND for the role to be server-authoritative. On a cold
  // load the role is first decoded from a (possibly stale) JWT; redirecting a
  // non-staff user before /api/me confirms would bounce a just-promoted staff
  // member off the hub on first paint.
  if (loading || (user && !roleChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (mustResetPassword(user)) return <Navigate to="/set-password" replace />;
  if (!isStaff(user)) return <Navigate to="/dashboard" replace />;

  return children;
};

// Onboarding — keep authenticated mid-flow users INSIDE the wizard until
// they finish. Previously this redirected anyone with a session to dashboard,
// which silently skipped steps 2–4 of the wizard.
const OnboardingRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (mustResetPassword(user)) return <Navigate to="/set-password" replace />;
    if (isStaff(user)) return <Navigate to="/hub" replace />;
    // Already onboarded → home. Mid-flow → keep showing the wizard.
    if (!needsOnboarding(user)) return <Navigate to="/dashboard" replace />;
  }
  return <Onboarding />;
};

// User-only routes — admins are redirected to the admin panel
const UserOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (mustResetPassword(user)) return <Navigate to="/set-password" replace />;

  // Staff are NO LONGER bounced to /admin here — they reach the App via the
  // workspace hub's "MeraTax App" card and use it as a regular filer. Their
  // own return is created lazily on first save (getCurrentReturn tolerates a
  // user with no return). Onboarding is skipped for staff by needsOnboarding().
  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;

  // Consent gate — block entry to the main app until the current legal
  // agreements are accepted (re-prompts when an agreement version is bumped).
  return <ConsentGate>{children}</ConsentGate>;
};

// Layout Component
const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header />
      <div style={{ display: 'flex', paddingTop: 56 }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            padding: '28px 28px',
            marginLeft: collapsed ? 60 : 220,
            transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)',
            minWidth: 0,
            outline: 'none',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <TaxYearProvider>
      <TaxFormProvider>
        <Router>
          <div className="App">
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  style: {
                    background: '#10b981',
                  },
                },
                error: {
                  style: {
                    background: '#ef4444',
                  },
                },
              }}
            />
            
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<PublicHome />} />
              <Route path="/onboarding" element={<OnboardingRoute />} />
              <Route path="/login" element={<Login />} />
              {/* /register redirects to the full onboarding flow */}
              <Route path="/register" element={<Navigate to="/onboarding" replace />} />

              {/* Public legal pages — readable without an account (also opened
                  from the consent gate's "read" links and the footer). */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/user-agreement" element={<UserAgreement />} />
              <Route path="/consultant-agreement" element={<ConsultantAgreement />} />

              {/* Workspace hub — intermediate landing for staff to choose
                  between the App, Admin Console and Consultant Workspace. */}
              <Route
                path="/hub"
                element={
                  <StaffHubRoute>
                    <Launcher />
                  </StaffHubRoute>
                }
              />

              {/* Forced password reset for bulk-imported users on a temp
                  password — guards itself (redirects away unless the flag
                  is set), full-screen with no app chrome. */}
              <Route path="/set-password" element={<ForcePasswordReset />} />

              {/* Personal Info Route (Protected, no Layout) */}
              <Route
                path="/personal-info"
                element={
                  <ProtectedRoute>
                    <PersonalInfoForm />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes — user-only pages redirect admins to /admin */}
              <Route
                path="/dashboard"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              <Route
                path="/tax-forms/*"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <TaxFormsFlow />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              {/* Income Tax Module */}
              <Route
                path="/income-tax/*"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <IncomeTaxModule />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              {/* Wealth Statement Module */}
              <Route
                path="/wealth-statement/*"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <WealthStatementModule />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <Reports />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              <Route
                path="/excel"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <ExcelManager />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              <Route
                path="/tax-history"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <TaxArchiveView />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <Settings />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              {/* AI Tax Consultant — full-page chat with conversation history */}
              <Route
                path="/consultant"
                element={
                  <UserOnlyRoute>
                    <Layout>
                      <ConsultantPage />
                    </Layout>
                  </UserOnlyRoute>
                }
              />

              {/* AI quick-start wizard — full-page chat, no sidebar/header
                  chrome around it because the wizard is a focused
                  task-flow that benefits from a clean view. */}
              <Route
                path="/wizard"
                element={
                  <UserOnlyRoute>
                    <Wizard />
                  </UserOnlyRoute>
                }
              />
              
              {/* Admin Module Routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <Layout>
                      <AdminModule />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* Default fallback */}
              <Route path="/home" element={<Navigate to="/" replace />} />
              
              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>

            {/* Floating tax-consultant bubble — self-renders only for
                authenticated non-admin users when the server is configured. */}
            <Suspense fallback={null}>
              <FloatingChatWidget />
            </Suspense>
          </div>
        </Router>
      </TaxFormProvider>
      </TaxYearProvider>
    </AuthProvider>
  );
}

export default App;