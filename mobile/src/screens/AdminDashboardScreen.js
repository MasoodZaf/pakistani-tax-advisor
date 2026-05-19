import React from 'react';
import ComingSoonScreen from './ComingSoonScreen';

const AdminDashboardScreen = (props) => (
  <ComingSoonScreen
    {...props}
    route={{
      params: {
        title: 'Admin Panel',
        icon: 'admin-panel-settings',
        description: 'User management, tax calculator, and consultant tools are not yet available on mobile.',
      },
    }}
  />
);

export default AdminDashboardScreen;
