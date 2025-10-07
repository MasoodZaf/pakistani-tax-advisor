import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import UserManagement from './components/UserManagement';
import SystemSettings from './components/SystemSettings';
import UserTaxRecords from './components/UserTaxRecords';

const AdminModule = () => {
  return (
    <Routes>
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<UserManagement />} />
      <Route path="system-settings" element={<SystemSettings />} />
      <Route path="user-tax-records" element={<UserTaxRecords />} />

      {/* Default route */}
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
};

export default AdminModule;