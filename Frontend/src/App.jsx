import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './styles/theme';
import './styles/index.css';
import TaxFormsContainer from './components/tax-forms/TaxFormsContainer';
import TaxSummaryChart from './components/common/TaxSummaryChart';
import LoginRegister from './components/auth/LoginRegister';
import { TaxFormProvider } from './context/TaxFormContext';
import { NotificationProvider } from './context/NotificationContext';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (user.role === 'admin' && window.location.pathname !== '/admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user.role !== 'admin' && window.location.pathname === '/admin') {
    return <Navigate to="/calculator" replace />;
  }

  return children;
};

const TaxCalculator = () => (
  <div className="min-h-screen bg-gray-100 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <TaxFormsContainer />
      <TaxSummaryChart />
    </div>
  </div>
);

const AdminPanel = () => (
  <div className="min-h-screen bg-gray-100 p-6">
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Panel</h2>
      <p className="text-gray-600">Admin controls will be implemented here</p>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <TaxFormProvider>
          <Router>
            <div className="min-h-screen bg-gray-100">
              <Routes>
                <Route path="/" element={<LoginRegister />} />
                <Route
                  path="/calculator"
                  element={
                    <ProtectedRoute>
                      <TaxCalculator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminPanel />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </Router>
        </TaxFormProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App; 