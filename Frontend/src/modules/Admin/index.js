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

const SuperAdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
};

const AdminModule = () => {
  return (
    <Routes>
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="system-settings" element={<SystemSettings />} />
      <Route path="user-tax-records" element={<UserTaxRecords />} />
      <Route path="audit-logs" element={<AuditLogs />} />

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

      {/* Default route */}
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default AdminModule;
