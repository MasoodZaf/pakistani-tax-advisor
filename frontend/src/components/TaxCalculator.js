import React, { useState } from "react";
import LoginRegister from './auth/LoginRegister';
import AdminPanel from './admin/AdminPanel';
import TaxCalculatorMain from './dashboard/TaxCalculatorMain';
import { getDefaultTaxData } from '../utils/taxUtils';

export default function TaxCalculatorApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('calculator');
  const [users, setUsers] = useState([
    {
      id: 1,
      email: "admin@tax.pk",
      name: "Tax Admin",
      password: "admin123",
      role: "admin",
      createdAt: "2024-01-01T00:00:00Z",
      taxData: getDefaultTaxData()
    },
    {
      id: 2,
      email: "user@demo.pk",
      name: "Demo User",
      password: "user123",
      role: "user",
      createdAt: "2024-01-15T00:00:00Z",
      taxData: getDefaultTaxData()
    }
  ]);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('calculator');
  };

  const handleSwitchToAdmin = () => {
    setCurrentView('admin');
  };

  const handleBackToCalculator = () => {
    setCurrentView('calculator');
  };

  if (!currentUser) {
    return <LoginRegister onLogin={handleLogin} users={users} setUsers={setUsers} />;
  }

  if (currentView === 'admin' && currentUser.role === 'admin') {
    return <AdminPanel users={users} setUsers={setUsers} onBackToCalculator={handleBackToCalculator} />;
  }

  return (
    <TaxCalculatorMain
      currentUser={currentUser}
      users={users}
      setUsers={setUsers}
      onLogout={handleLogout}
      onSwitchToAdmin={handleSwitchToAdmin}
    />
  );
} 