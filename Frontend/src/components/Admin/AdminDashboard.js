import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  FileText, 
  BarChart3, 
  Shield, 
  Settings,
  AlertTriangle,
  Calculator,
  UserCog
} from 'lucide-react';
import TaxCalculator from './TaxCalculator';
import UserImpersonation from './UserImpersonation';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showTaxCalculator, setShowTaxCalculator] = useState(false);
  const [showUserImpersonation, setShowUserImpersonation] = useState(false);

  // Mock admin stats
  const stats = [
    {
      title: 'Total Users',
      value: '150',
      change: '+12%',
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Active Returns',
      value: '89',
      change: '+8%',
      icon: FileText,
      color: 'green'
    },
    {
      title: 'Completed Returns',
      value: '45',
      change: '+25%',
      icon: BarChart3,
      color: 'purple'
    },
    {
      title: 'System Health',
      value: '99.9%',
      change: 'Stable',
      icon: Shield,
      color: 'orange'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200',
      green: 'bg-green-50 text-green-600 border-green-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200',
      orange: 'bg-orange-50 text-orange-600 border-orange-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              System overview and administrative controls
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Logged in as</div>
            <div className="font-medium text-gray-900 capitalize">
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`
                p-6 rounded-lg border-2 transition-all duration-200
                ${getColorClasses(stat.color)}
              `}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="w-8 h-8" />
                <div className="text-right">
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm">{stat.change}</div>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{stat.title}</h3>
            </div>
          );
        })}
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/admin/users')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">User Management</div>
                  <div className="text-sm text-gray-600">Manage user accounts and permissions</div>
                </div>
              </div>
            </button>
            
            <button 
              onClick={() => setShowTaxCalculator(true)}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Calculator className="w-5 h-5 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">Tax Calculator</div>
                  <div className="text-sm text-gray-600">Calculate income tax for Pakistani taxpayers</div>
                </div>
              </div>
            </button>

            {/* User Impersonation - Super Admin Only */}
            {user?.role === 'super_admin' && (
              <button 
                onClick={() => setShowUserImpersonation(true)}
                className="w-full text-left p-3 border border-red-200 rounded-lg hover:bg-red-50 transition-colors bg-red-25"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <UserCog className="w-5 h-5 text-red-600" />
                    <Shield className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 flex items-center">
                      User Impersonation
                      <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                        SUPER ADMIN
                      </span>
                    </div>
                    <div className="text-sm text-red-600">Login as any user for tax consultation</div>
                  </div>
                </div>
              </button>
            )}
            
            <button 
              onClick={() => navigate('/admin/system-settings')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="font-medium text-gray-900">System Settings</div>
                  <div className="text-sm text-gray-600">Configure system parameters</div>
                </div>
              </div>
            </button>
            
            <button 
              onClick={() => navigate('/reports')}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-orange-600" />
                <div>
                  <div className="font-medium text-gray-900">Tax Summary Reports</div>
                  <div className="text-sm text-gray-600">View user tax summaries and analytics</div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <div className="font-medium text-gray-900">New user registered</div>
                <div className="text-sm text-gray-600">Ahmed Khan joined the system</div>
                <div className="text-xs text-gray-500">2 hours ago</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <div className="font-medium text-gray-900">Tax return submitted</div>
                <div className="text-sm text-gray-600">Return #TR-2025-001 completed</div>
                <div className="text-xs text-gray-500">4 hours ago</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
              <div>
                <div className="font-medium text-gray-900">System backup completed</div>
                <div className="text-sm text-gray-600">Daily backup successful</div>
                <div className="text-xs text-gray-500">6 hours ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Alerts */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">System Notifications</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Database backup scheduled for maintenance window</li>
              <li>• Tax year 2025-26 configuration is active</li>
              <li>• All system services are running normally</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Tax Calculator Modal */}
      {showTaxCalculator && (
        <TaxCalculator onClose={() => setShowTaxCalculator(false)} />
      )}

      {/* User Impersonation Modal */}
      {showUserImpersonation && (
        <UserImpersonation onClose={() => setShowUserImpersonation(false)} />
      )}
    </div>
  );
};

export default AdminDashboard;