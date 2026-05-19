import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Users,
  FileText,
  BarChart3,
  Shield,
  Settings,
  AlertTriangle,
  Calculator,
  UserCog,
  RefreshCw,
  Activity,
  CheckCircle,
  Clock,
  Percent,
  Key
} from 'lucide-react';
import axios from 'axios';
import TaxCalculator from './TaxCalculator';
import UserImpersonation from './UserImpersonation';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';
  const [showTaxCalculator, setShowTaxCalculator] = useState(false);
  const [showUserImpersonation, setShowUserImpersonation] = useState(false);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const response = await axios.get('/api/admin/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch {
      // stats are non-critical — show zeros on failure
    } finally {
      setLoadingStats(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.users?.total_users ?? '—',
      sub: `${stats?.users?.active_users ?? 0} active`,
      icon: Users,
      color: 'blue'
    },
    {
      title: 'Total Returns',
      value: stats?.taxReturns?.total_returns ?? '—',
      sub: `${stats?.taxReturns?.draft_returns ?? 0} draft`,
      icon: FileText,
      color: 'green'
    },
    {
      title: 'Submitted Returns',
      value: stats?.taxReturns?.submitted_returns ?? '—',
      sub: `${stats?.taxReturns?.new_returns_30d ?? 0} this month`,
      icon: CheckCircle,
      color: 'purple'
    },
    {
      title: 'Active Tax Years',
      value: stats?.taxYears?.active_tax_years ?? '—',
      sub: `${stats?.taxYears?.current_tax_years ?? 0} current`,
      icon: BarChart3,
      color: 'orange'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue:   'bg-blue-50 text-blue-600 border-blue-200',
      green:  'bg-green-50 text-green-600 border-green-200',
      purple: 'bg-purple-50 text-purple-600 border-purple-200',
      orange: 'bg-orange-50 text-orange-600 border-orange-200'
    };
    return colors[color] || colors.blue;
  };

  const formatActivityLabel = (action) => {
    const labels = {
      login: 'User login',
      admin_assisted_login: 'Admin-assisted login',
      password_change: 'Password changed',
      EXCEL_IMPORT: 'Excel import',
      EXCEL_EXPORT: 'Excel export',
      update: 'Record updated',
      create: 'Record created',
      delete: 'Record deleted',
      bulk_update: 'Bulk settings update',
      reset_defaults: 'Settings reset'
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}
              </h1>
              {isSuperAdmin && (
                <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200">
                  SUPER ADMIN
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">System overview and administrative controls</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchStats}
              disabled={loadingStats}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="text-right">
              <div className="text-sm text-gray-500">Logged in as</div>
              <div className="font-medium text-gray-900 capitalize">
                {user?.role?.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`p-6 rounded-lg border-2 transition-all duration-200 ${getColorClasses(stat.color)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-7 h-7" />
                {loadingStats && (
                  <RefreshCw className="w-4 h-4 animate-spin opacity-40" />
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm font-semibold text-gray-700 mt-0.5">{stat.title}</div>
              <div className="text-xs mt-1 opacity-70">{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions + Recent Activity */}
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

            {/* Super Admin only actions */}
            {user?.role === 'super_admin' && (
              <>
                <button
                  onClick={() => navigate('/admin/tax-rates')}
                  className="w-full text-left p-3 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Percent className="w-5 h-5 text-amber-600" />
                    <div>
                      <div className="font-medium text-gray-900 flex items-center">
                        Tax Rates Manager
                        <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                          SUPER ADMIN
                        </span>
                      </div>
                      <div className="text-sm text-amber-700">Update FBR income tax slabs &amp; rates</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate('/admin/admin-accounts')}
                  className="w-full text-left p-3 border border-purple-200 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Key className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium text-gray-900 flex items-center">
                        Admin Accounts
                        <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                          SUPER ADMIN
                        </span>
                      </div>
                      <div className="text-sm text-purple-700">Manage admin users &amp; permissions</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowUserImpersonation(true)}
                  className="w-full text-left p-3 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <UserCog className="w-5 h-5 text-red-600" />
                      <Shield className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 flex items-center">
                        User Impersonation
                        <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full border border-red-200">
                          SUPER ADMIN
                        </span>
                      </div>
                      <div className="text-sm text-red-600">Login as any user for tax consultation</div>
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Recent Activity — real audit log */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>

          {loadingStats ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : stats?.recentActivity?.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 7).map((item, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {formatActivityLabel(item.action)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {item.table_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(item.last_action)}
                      </span>
                      <span className="text-gray-400">×{item.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* System Status — real data */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm font-semibold text-green-800">Users (7-day active)</span>
            </div>
            <div className="text-2xl font-bold text-green-900">{stats?.users?.active_users_7d ?? '—'}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm font-semibold text-blue-800">New Users (30 days)</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{stats?.users?.new_users_30d ?? '—'}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm font-semibold text-purple-800">Admin Users</span>
            </div>
            <div className="text-2xl font-bold text-purple-900">{stats?.users?.admin_users ?? '—'}</div>
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
