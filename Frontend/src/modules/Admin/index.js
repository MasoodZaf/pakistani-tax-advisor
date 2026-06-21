import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import SystemSettings from './components/SystemSettings';
import UserTaxRecords from './components/UserTaxRecords';
import TaxRatesManager from './components/TaxRatesManager';
import AdminManagement from './components/AdminManagement';
import AuditLogs from './components/AuditLogs';
import PlaybookManager from './components/PlaybookManager';
import { isElevated } from '../../utils/roles';

const SuperAdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

// super_admin + tax_consultant — mirrors backend requireElevated.
const ElevatedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!isElevated(user)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

// admin + super_admin — mirrors backend requireAdmin (systemSettings.js). NOT tax_consultant.
const AdminOnlyRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

const AdminModule = () => {
  return (
    <Routes>
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<UserManagement />} />
      <Route
        path="system-settings"
        element={
          <AdminOnlyRoute>
            <SystemSettings />
          </AdminOnlyRoute>
        }
      />
      <Route path="user-tax-records" element={<UserTaxRecords />} />

      {/* Elevated routes (super_admin + tax_consultant) */}
      <Route
        path="audit-logs"
        element={
          <ElevatedRoute>
            <AuditLogs />
          </ElevatedRoute>
        }
      />

      {/* Super Admin only routes */}
      <Route
        path="tax-rates"
        element={
          <SuperAdminRoute>
            <TaxRatesManager />
          </SuperAdminRoute>
        }
      />
      <Route
        path="admin-accounts"
        element={
          <SuperAdminRoute>
            <AdminManagement />
          </SuperAdminRoute>
        }
      />
      <Route
        path="playbook"
        element={
          <ElevatedRoute>
            <PlaybookManager />
          </ElevatedRoute>
        }
      />

      {/* Default route */}
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default AdminModule;
