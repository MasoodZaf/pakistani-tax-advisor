import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit, Trash2, FileText, Upload, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { isElevated, isSuperAdmin } from '../../../utils/roles';
import UserTaxRecords from './UserTaxRecords';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { Skeleton } from '../../../components/common/Skeleton';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUserTax, setViewingUserTax] = useState(null);
  const [stats, setStats] = useState({});
  
  // Filter states
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [consultants, setConsultants] = useState([]);

  // Fetch users from API. Request a large page so the UI renders the full
  // dataset — the default backend page is 50, which caused "deleted users
  // seem to still be there" because positions 51+ shifted in after each
  // delete. Client-side search/filter handles narrowing.
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users', { params: { limit: 1000 } });
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
    }
  };

  // Consultant assignment (phase-z9) — super_admin only. Consultants never see
  // this UI; their user list is already scoped server-side to assigned clients.
  const fetchConsultants = async () => {
    try {
      const response = await axios.get('/api/admin/consultants');
      if (response.data.success) setConsultants(response.data.data);
    } catch (error) {
    }
  };

  const handleAssignConsultant = async (userId, consultantId) => {
    if (!consultantId) return;
    try {
      const res = await axios.put(`/api/admin/users/${userId}/consultant`, { consultantId });
      toast.success(res.data.message || 'Consultant assigned');
      fetchUsers();
      fetchConsultants();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign consultant');
    }
  };

  const handleUnassignConsultant = async (userId, consultantName) => {
    if (!window.confirm(`Remove consultant ${consultantName}? The user becomes independent again.`)) return;
    try {
      await axios.put(`/api/admin/users/${userId}/consultant`, { consultantId: null });
      toast.success('Consultant removed');
      fetchUsers();
      fetchConsultants();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove consultant');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
    if (isSuperAdmin(currentUser)) fetchConsultants();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getRoleColor = (role) => {
    const colors = {
      user: 'bg-navy/10 text-navy',
      admin: 'bg-navy/10 text-navy',
      tax_consultant: 'bg-lime/25 text-navy',
      super_admin: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300'
    };
    return colors[role] || colors.user;
  };

  const getStatusColor = (isActive) => {
    return isActive
      ? 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300'
      : 'bg-gray-100 dark:bg-[#1a2238] text-gray-800 dark:text-[#e7eaf3]';
  };

  // Handle user selection
  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsers(
      selectedUsers.length === filteredUsers.length
        ? []
        : filteredUsers.map(user => user.id)
    );
  };

  // Delete user — optimistic: remove from local state immediately so the row
  // disappears even before the server round-trip finishes. Reconcile with
  // fetchUsers at the end.
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    const previous = users;
    setUsers(prev => prev.filter(u => u.id !== userId));

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      toast.success('User deleted successfully');
      fetchStats();
      // Re-fetch to reconcile with server (in case of cascade side-effects).
      fetchUsers();
    } catch (error) {
      // Roll back the optimistic removal on failure.
      setUsers(previous);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  // Toggle user status
  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await axios.put(`/api/admin/users/${userId}/status`, {
        isActive: !currentStatus
      });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user status');
    }
  };

  // Bulk delete — SOFT delete via the dedicated endpoint (is_active=false,
  // recoverable). Staff accounts and self are skipped server-side; hard
  // CASCADE delete stays per-row and super_admin-only.
  const handleBulkDelete = async () => {
    const n = selectedUsers.length;
    if (!window.confirm(`Deactivate ${n} selected user${n === 1 ? '' : 's'}? Their accounts are disabled (recoverable), not permanently deleted.`)) return;

    try {
      const res = await axios.post('/api/admin/users/bulk-delete', { userIds: selectedUsers });
      const { deactivated = 0, skipped = 0 } = res.data?.summary || {};
      setSelectedUsers([]);
      if (skipped > 0) {
        toast(`${deactivated} deactivated, ${skipped} skipped (staff accounts and your own can't be bulk-deactivated)`, { icon: '⚠️' });
      } else {
        toast.success(`${deactivated} user${deactivated === 1 ? '' : 's'} deactivated`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bulk deactivate failed');
    }

    fetchUsers();
    fetchStats();
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">User Management</h1>
            <p className="text-gray-600 dark:text-[#aab2cc] mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {isElevated(currentUser) && (
              <button
                onClick={() => setShowBulkImport(true)}
                className="border border-navy/20 dark:border-[#2a3450] text-navy dark:text-[#e7eaf3] px-4 py-2 rounded-brand hover:bg-navy/5 dark:hover:bg-[#1a2238] transition-colors flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Import</span>
              </button>
            )}
            <button
              onClick={() => setShowAddUser(true)}
              className="bg-lime text-navy px-4 py-2 rounded-brand hover:bg-lime/80 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[#7e88a6] w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] dark:placeholder-[#7e88a6] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="user">Users</option>
              <option value="admin">Admins</option>
              <option value="tax_consultant">Tax Consultants</option>
              <option value="super_admin">Super Admins</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center space-x-4">
            {isElevated(currentUser) && selectedUsers.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-brand hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Deactivate Selected ({selectedUsers.length})</span>
              </button>
            )}
            <div className="text-sm text-gray-600 dark:text-[#aab2cc]">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2a3450]">
            <thead className="bg-gray-50 dark:bg-[#0f1426]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-[#2a3450] text-navy focus:ring-navy/30"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  User Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  Status
                </th>
                {isSuperAdmin(currentUser) && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                    Consultant
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#151c30] divide-y divide-gray-200 dark:divide-[#2a3450]">
              {loading ? (
                Array.from({ length: 6 }).map((_, r) => (
                  <tr key={`sk-${r}`}>
                    {Array.from({ length: isSuperAdmin(currentUser) ? 8 : 7 }).map((_, c) => (
                      <td key={c} className="px-6 py-4"><Skeleton className="h-3.5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin(currentUser) ? 8 : 7} className="px-6 py-4 text-center text-gray-500 dark:text-[#7e88a6]">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-[#1a2238]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="rounded border-gray-300 dark:border-[#2a3450] text-navy focus:ring-navy/30"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-navy dark:text-[#e7eaf3]">{user.name}</div>
                        <div className="text-sm text-gray-600 dark:text-[#aab2cc]">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy dark:text-[#e7eaf3]">
                      {user.user_type || 'individual'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {user.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(user.id, user.is_active)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(user.is_active)}`}
                      >
                        {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                    </td>
                    {isSuperAdmin(currentUser) && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {user.role !== 'user' ? (
                          <span className="text-gray-400 dark:text-[#7e88a6]">—</span>
                        ) : user.consultant_name ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-navy dark:text-[#e7eaf3]">{user.consultant_name}</span>
                            <button
                              onClick={() => handleUnassignConsultant(user.id, user.consultant_name)}
                              className="text-red-500 dark:text-red-300 hover:text-red-700 text-xs font-semibold"
                              title="Remove consultant (user becomes independent)"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <select
                            defaultValue=""
                            onChange={(e) => handleAssignConsultant(user.id, e.target.value)}
                            className="text-xs border border-gray-300 dark:border-[#2a3450] rounded-md px-2 py-1 bg-white dark:bg-[#0f1426] text-gray-600 dark:text-[#aab2cc]"
                          >
                            <option value="">Independent</option>
                            {consultants.filter(c => c.is_active).map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.client_count})</option>
                            ))}
                          </select>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-navy dark:text-[#e7eaf3]">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setViewingUserTax({ id: user.id, name: user.name })}
                          className="text-navy hover:text-navy flex items-center space-x-1"
                          title="View Tax Records"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Tax Records</span>
                        </button>
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="text-navy hover:text-navy flex items-center space-x-1"
                        >
                          <Edit className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        {currentUser.role === 'super_admin' && user.role !== 'super_admin' && (
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 dark:text-red-300 hover:text-red-900 flex items-center space-x-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 text-center">
          <div className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">{stats.users?.total_users || 0}</div>
          <div className="text-sm text-gray-600 dark:text-[#aab2cc]">Total Users</div>
        </div>
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-300">{stats.users?.active_users || 0}</div>
          <div className="text-sm text-gray-600 dark:text-[#aab2cc]">Active Users</div>
        </div>
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 text-center">
          <div className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">{stats.users?.admin_users || 0}</div>
          <div className="text-sm text-gray-600 dark:text-[#aab2cc]">Admins</div>
        </div>
        <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-6 text-center">
          <div className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">{stats.users?.new_users_30d || 0}</div>
          <div className="text-sm text-gray-600 dark:text-[#aab2cc]">New This Month</div>
        </div>
      </div>
      
      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImportModal
          onClose={(didImport) => {
            setShowBulkImport(false);
            if (didImport) {
              fetchUsers();
              fetchStats();
            }
          }}
        />
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <AddUserModal 
          onClose={() => setShowAddUser(false)} 
          onSuccess={() => {
            setShowAddUser(false);
            fetchUsers();
            fetchStats();
          }}
        />
      )}
      
      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal 
          user={editingUser}
          onClose={() => setEditingUser(null)} 
          onSuccess={() => {
            setEditingUser(null);
            fetchUsers();
            fetchStats();
          }}
        />
      )}
      
      {/* User Tax Records Modal */}
      {viewingUserTax && (
        <UserTaxRecords
          userId={viewingUserTax.id}
          userName={viewingUserTax.name}
          onClose={() => setViewingUserTax(null)}
        />
      )}
    </div>
  );
};

// Bulk Import Modal — download the xlsx template, upload a filled one, then
// show the per-row result report (created rows carry a one-time temp password
// that the consultant hands to the user; first login forces a reset).
const BulkImportModal = ({ onClose }) => {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null); // { summary, results }
  const fileInputRef = useRef(null);
  const dialogRef = useFocusTrap(true, { onEscape: () => onClose(!!report) });

  const downloadTemplate = async () => {
    try {
      const res = await axios.get('/api/admin/users/bulk-template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'bulk-user-import-template.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the template');
    }
  };

  const acceptFile = (f) => {
    if (!f) return;
    if (!/\.(xlsx|xls)$/i.test(f.name)) {
      toast.error('Please choose an Excel file (.xlsx)');
      return;
    }
    setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post('/api/admin/users/bulk-import', fd);
      setReport({ summary: res.data?.summary || {}, results: res.data?.results || [] });
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const copyCredentials = () => {
    const created = (report?.results || []).filter(r => r.status === 'created');
    const text = created.map(r => `${r.email}\t${r.tempPassword}`).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`Copied ${created.length} credential${created.length === 1 ? '' : 's'}`))
      .catch(() => toast.error('Copy failed'));
  };

  const statusBadge = (status) => {
    if (status === 'created') return 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300';
    if (status === 'skipped') return 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300';
    return 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="bulk-import-title" className="bg-white dark:bg-[#151c30] rounded-brand p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto outline-none">
        <h2 id="bulk-import-title" className="text-xl font-bold mb-1 dark:text-[#e7eaf3]">Bulk Import Users</h2>
        <p className="text-sm text-gray-600 dark:text-[#aab2cc] mb-4">
          Upload a filled template — each created user gets a temporary password and must set their own on first login.
        </p>

        {!report ? (
          <>
            <button
              onClick={downloadTemplate}
              className="flex items-center space-x-2 text-navy dark:text-[#e7eaf3] border border-navy/20 dark:border-[#2a3450] px-3 py-2 rounded-brand hover:bg-navy/5 dark:hover:bg-[#1a2238] transition-colors text-sm mb-4"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel template</span>
            </button>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              className={`border-2 border-dashed rounded-brand p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-lime bg-lime/10'
                  : 'border-gray-300 dark:border-[#2a3450] hover:border-navy/40 dark:hover:border-[#3a4670]'
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-gray-400 dark:text-[#7e88a6] mb-2" />
              {file ? (
                <p className="font-medium text-navy dark:text-[#e7eaf3]">{file.name}</p>
              ) : (
                <p className="text-gray-600 dark:text-[#aab2cc]">Drag &amp; drop the filled .xlsx here, or click to browse</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => { acceptFile(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>

            <div className="flex space-x-3 pt-5">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#2a3450] dark:text-[#aab2cc] rounded-brand hover:bg-gray-50 dark:hover:bg-[#1a2238] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing}
                className="flex-1 bg-lime text-navy px-4 py-2 rounded-brand hover:bg-lime/80 transition-colors disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Import Users'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-300">
                <CheckCircle className="w-4 h-4" /> {report.summary.created || 0} created
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" /> {report.summary.skipped || 0} skipped
              </span>
              <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                {report.summary.failed || 0} failed
              </span>
            </div>

            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-brand p-3 mb-4">
              Temporary passwords are shown ONCE, below. Share them securely with each user — they are forced to set a new password on first login.
            </p>

            <div className="overflow-x-auto border border-gray-200 dark:border-[#2a3450] rounded-brand mb-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2a3450] text-sm">
                <thead className="bg-gray-50 dark:bg-[#0f1426]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase">Row</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#7e88a6] uppercase">Temp Password / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#2a3450]">
                  {report.results.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-gray-600 dark:text-[#aab2cc]">{r.row ?? i + 1}</td>
                      <td className="px-3 py-2 text-navy dark:text-[#e7eaf3]">{r.name}</td>
                      <td className="px-3 py-2 text-navy dark:text-[#e7eaf3]">{r.email}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${statusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.status === 'created'
                          ? <code className="font-mono text-navy dark:text-[#e7eaf3] bg-gray-100 dark:bg-[#0f1426] px-1.5 py-0.5 rounded">{r.tempPassword}</code>
                          : <span className="text-gray-600 dark:text-[#aab2cc]">{r.message}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex space-x-3">
              {(report.summary.created || 0) > 0 && (
                <button
                  onClick={copyCredentials}
                  className="flex-1 px-4 py-2 border border-navy/20 dark:border-[#2a3450] text-navy dark:text-[#e7eaf3] rounded-brand hover:bg-navy/5 dark:hover:bg-[#1a2238] transition-colors"
                >
                  Copy email + password list
                </button>
              )}
              <button
                onClick={() => onClose(true)}
                className="flex-1 bg-lime text-navy px-4 py-2 rounded-brand hover:bg-lime/80 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Add User Modal Component
const AddUserModal = ({ onClose, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const dialogRef = useFocusTrap(true, { onEscape: onClose });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    user_type: 'individual'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post('/api/admin/users', formData);
      if (response.data.success) {
        toast.success('User created successfully');
        onSuccess();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="admin-add-user-title" className="bg-white dark:bg-[#151c30] rounded-brand p-6 w-full max-w-md outline-none">
        <h2 id="admin-add-user-title" className="text-xl font-bold mb-4 dark:text-[#e7eaf3]">Add New User</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
            >
              <option value="user">User</option>
              {/* Consultants manage regular users only — the backend rejects
                  staff-role creation by them, so don't offer it. */}
              {currentUser.role !== 'tax_consultant' && <option value="admin">Admin</option>}
              {isSuperAdmin(currentUser) && <option value="tax_consultant">Tax Consultant</option>}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">User Type</label>
            <select
              value={formData.user_type}
              onChange={(e) => setFormData({...formData, user_type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#2a3450] dark:text-[#aab2cc] rounded-brand hover:bg-gray-50 dark:hover:bg-[#1a2238] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-lime text-navy px-4 py-2 rounded-brand hover:bg-lime/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onClose, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const dialogRef = useFocusTrap(true, { onEscape: onClose });
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    user_type: user.user_type || 'individual',
    is_active: user.is_active
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.put(`/api/admin/users/${user.id}`, formData);
      if (response.data.success) {
        toast.success('User updated successfully');
        onSuccess();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="admin-edit-user-title" className="bg-white dark:bg-[#151c30] rounded-brand p-6 w-full max-w-md outline-none">
        <h2 id="admin-edit-user-title" className="text-xl font-bold mb-4 dark:text-[#e7eaf3]">Edit User</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              required
            />
          </div>
          
          {currentUser.role === 'super_admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="tax_consultant">Tax Consultant</option>
                {user.role !== 'super_admin' && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">User Type</label>
            <select
              value={formData.user_type}
              onChange={(e) => setFormData({...formData, user_type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent"
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
            </select>
          </div>
          
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="rounded border-gray-300 dark:border-[#2a3450] text-navy focus:ring-navy/30"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-[#aab2cc]">Active</span>
            </label>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#2a3450] dark:text-[#aab2cc] rounded-brand hover:bg-gray-50 dark:hover:bg-[#1a2238] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-lime text-navy px-4 py-2 rounded-brand hover:bg-lime/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;