import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Users, 
  LogIn, 
  Eye, 
  AlertTriangle, 
  Search,
  Filter,
  RefreshCw,
  Clock,
  Shield,
  User,
  Activity
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const UserImpersonation = ({ onClose }) => {
  const { user, login, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadUserCredentials();
    }
  }, [user]);

  const loadUserCredentials = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/user-credentials');
      
      if (response.data.success) {
        setUsers(response.data.data);
      } else {
        toast.error(response.data.message || 'Failed to load user credentials');
      }
    } catch (error) {
      console.error('Load user credentials error:', error);
      toast.error(error.response?.data?.message || 'Failed to load user credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonateUser = async (targetUser) => {
    if (impersonating) return;
    
    const confirmMessage = `This will redirect you to the login page with ${targetUser.name}'s email pre-filled.\n\nYou can then manually click the login button to access their account.\n\nThis action will be logged for security purposes.\n\nProceed?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setImpersonating(true);
      
      // Get login credentials with temporary bypass token
      const response = await axios.get(`/api/admin/user-login-credentials/${targetUser.id}`);
      
      if (response.data.success) {
        const { email, tempBypassToken, name } = response.data.data;
        
        toast.success(`Logging out admin and redirecting to ${name}`, {
          duration: 3000,
          icon: '🔄',
        });
        
        // Store the user info and bypass token for the login page
        localStorage.setItem('adminAssistedLogin', JSON.stringify({
          email: email,
          tempBypassToken: tempBypassToken,
          userName: name,
          timestamp: Date.now()
        }));
        
        // Close the modal first
        onClose();
        
        // Auto-logout admin and redirect to login page
        logout(); // This clears the admin session
        
        // Small delay to ensure logout completes, then redirect
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
        
      } else {
        toast.error(response.data.message || 'Failed to get user credentials');
      }
    } catch (error) {
      console.error('Get credentials error:', error);
      toast.error(error.response?.data?.message || 'Failed to get user credentials');
    } finally {
      setImpersonating(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleColor = (role) => {
    const colors = {
      'user': 'bg-blue-100 text-blue-800',
      'admin': 'bg-purple-100 text-purple-800',
      'super_admin': 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (isActive) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              Only Super Admin can access user impersonation features.
            </p>
            <button
              onClick={onClose}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-xl font-bold text-white">User Impersonation Panel</h2>
                <p className="text-red-100 text-sm">Super Admin Only - All actions are logged</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mr-3" />
            <div>
              <p className="text-sm text-yellow-800">
                <strong>Security Notice:</strong> All impersonation activities are logged and monitored. 
                Use this feature responsibly for legitimate tax consultation purposes only.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              
              <button
                onClick={loadUserCredentials}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mr-3" />
              <span className="text-gray-500">Loading user credentials...</span>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((targetUser) => (
                  <tr key={targetUser.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {targetUser.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {targetUser.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(targetUser.role)}`}>
                        {targetUser.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(targetUser.is_active)}`}>
                        {targetUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">
                            {targetUser.total_tax_returns} returns
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${targetUser.completion_percentage}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {targetUser.completion_percentage}% complete
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDate(targetUser.last_login_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleImpersonateUser(targetUser)}
                        disabled={!targetUser.is_active || impersonating}
                        className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        {impersonating ? 'Switching...' : 'Login As User'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-6">
              <span>Total Users: <strong>{filteredUsers.length}</strong></span>
              <span>Active: <strong>{filteredUsers.filter(u => u.is_active).length}</strong></span>
              <span>Inactive: <strong>{filteredUsers.filter(u => !u.is_active).length}</strong></span>
            </div>
            <div className="flex items-center">
              <Activity className="w-4 h-4 mr-2 text-red-600" />
              <span className="text-red-600 font-medium">Super Admin Session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserImpersonation;