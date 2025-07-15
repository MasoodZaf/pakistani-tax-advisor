import React, { useState } from "react";
import { DollarSign, FileText, Receipt, TrendingUp, Building, PieChart, Wallet, LogOut, Shield } from "lucide-react";
import GridSheet from "../common/GridSheet";
import FloatingSummary from "../common/FloatingSummary";
import { configs } from "../../utils/taxConfigs";

const TaxCalculatorMain = ({ currentUser, users, setUsers, onLogout, onSwitchToAdmin }) => {
  const [activeTab, setActiveTab] = useState("income");
  const [summaryVisible, setSummaryVisible] = useState(true);

  const updateField = (section, key, value) => {
    const updatedUsers = users.map(user => 
      user.id === currentUser.id 
        ? { ...user, taxData: { ...user.taxData, [section]: { ...user.taxData[section], [key]: value } } }
        : user
    );
    setUsers(updatedUsers);
  };

  const currentUserData = users.find(u => u.id === currentUser.id)?.taxData || currentUser.taxData;

  const tabs = [
    { id: "income", name: "Income", icon: DollarSign },
    { id: "adjustableTax", name: "Adjustable Tax", icon: FileText },
    { id: "finalTax", name: "Final Tax", icon: Receipt },
    { id: "capitalGain", name: "Capital Gain", icon: TrendingUp },
    { id: "reductions", name: "Reductions", icon: Building },
    { id: "credits", name: "Credits", icon: Building },
    { id: "deductions", name: "Deductions", icon: Building },
    { id: "expenses", name: "Expenses", icon: PieChart },
    { id: "wealth", name: "Wealth", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pakistani Tax Advisor</h1>
            <p className="text-sm text-gray-600 mt-1">Professional Tax Return Calculation - Tax Year 2024-25</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{currentUser.name}</div>
              <div className="text-xs text-gray-500">{currentUser.email}</div>
            </div>
            {currentUser.role === 'admin' && (
              <button
                onClick={onSwitchToAdmin}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
              >
                <Shield className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white border-b">
        <div className="px-6 flex space-x-1">
          {tabs.map(({ id, name, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-blue-500 text-blue-600 bg-blue-50" : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"}`}>
              <Icon className="w-4 h-4" /><span>{name}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <GridSheet section={activeTab} config={configs[activeTab]} data={currentUserData[activeTab]} onChange={updateField} />
      </div>
      
      <FloatingSummary data={currentUserData} isVisible={summaryVisible} setIsVisible={setSummaryVisible} />
    </div>
  );
};

export default TaxCalculatorMain; 