import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TaxFormProvider } from './contexts/TaxFormContext';
import { TaxYearProvider } from './contexts/TaxYearContext';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Login from './components/Auth/Login';
import PersonalInfoForm from './components/PersonalInfo/PersonalInfoForm';
import Dashboard from './components/Dashboard/Dashboard';
import TaxFormsFlow from './components/TaxForms/TaxFormsFlow';
import IncomeTaxModule from './modules/IncomeTax';
import WealthStatementModule from './modules/WealthStatement';
import AdminModule from './modules/Admin';
import Reports from './components/Reports/Reports';
import ExcelManager from './components/Excel/ExcelManager';
import TaxArchiveView from './components/TaxHistory/TaxArchiveView';
import Settings from './components/Settings/Settings';
import Landing from './components/Landing/Landing';
import Onboarding from './components/Onboarding/Onboarding';
// import ImpersonationBanner from './components/Admin/ImpersonationBanner'; // Not needed for manual login flow

// A user is "needs onboarding" when authenticated as a non-admin and the
// wizard hasn't been marked complete yet. Admins skip onboarding entirely.
const needsOnboarding = (u) =>
  !!u && !['admin', 'super_admin'].includes(u.role) && u.onboarding_completed === false;

// Public home: Landing page for guests, dashboard redirect for authenticated users
const PublicHome = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (['admin', 'super_admin'].includes(user.role)) return <Navigate to="/admin" replace />;
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

  if (adminOnly && !['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;

  return children;
};

// Onboarding — keep authenticated mid-flow users INSIDE the wizard until
// they finish. Previously this redirected anyone with a session to dashboard,
// which silently skipped steps 2–4 of the wizard.
const OnboardingRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (['admin', 'super_admin'].includes(user.role)) return <Navigate to="/admin" replace />;
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

  if (['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;

  return children;
};

// Layout Component
const Layout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0' }}>
      <Header />
      <div style={{ display: 'flex', paddingTop: 56 }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <main
          style={{
            flex: 1,
            padding: '28px 28px',
            marginLeft: collapsed ? 60 : 220,
            transition: 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)',
            minWidth: 0,
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
            
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<PublicHome />} />
              <Route path="/onboarding" element={<OnboardingRoute />} />
              <Route path="/login" element={<Login />} />
              {/* /register redirects to the full onboarding flow */}
              <Route path="/register" element={<Navigate to="/onboarding" replace />} />

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
              <Route 
                path="*" 
                element={
                  <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                      <p className="text-gray-600 mb-8">Page not found</p>
                      <a href="/dashboard" className="btn-primary">
                        Go to Dashboard
                      </a>
                    </div>
                  </div>
                } 
              />
            </Routes>
          </div>
        </Router>
      </TaxFormProvider>
      </TaxYearProvider>
    </AuthProvider>
  );
}

export default App;