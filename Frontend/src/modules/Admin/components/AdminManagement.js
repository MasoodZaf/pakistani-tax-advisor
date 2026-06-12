import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Shield, Plus, Edit2, Key, Power, PowerOff,
  RefreshCw, X, Save, Eye, EyeOff, User, Mail,
  CheckCircle, AlertTriangle, Clock
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

const S = () => (
  <style>{`
    /* Brand fonts loaded once in public/index.html (UX-06) */
    .am-root { font-family:'Nunito',sans-serif; }
    .am-input { width:100%;padding:9px 13px;border:1.5px solid var(--line);border-radius:9px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:600;color:var(--content);background:var(--surface-raised);outline:none;transition:border-color .18s,box-shadow .18s; }
    .am-input:focus { border-color:#28396C;box-shadow:0 0 0 3px rgba(40,57,108,.1); }
    .am-btn { display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:9px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .18s;border:none; }
    .am-btn-primary { background:#28396C;color:#fff; }
    .am-btn-primary:hover { background:#1e2d5a; }
    .am-btn-danger  { background:#fee2e2;color:#dc2626; }
    .am-btn-danger:hover  { background:#fecaca; }
    [data-theme="dark"] .am-btn-danger { background:#3a1a1a;color:#f87171; }
    [data-theme="dark"] .am-btn-danger:hover { background:#4a2020; }
    .am-btn-ghost   { background:var(--surface-sunken);color:var(--content-muted); }
    .am-btn-ghost:hover   { background:var(--line); }
    .am-btn-green   { background:#ecfdf5;color:#059669; }
    .am-btn-green:hover   { background:#d1fae5; }
    [data-theme="dark"] .am-btn-green { background:#10291f;color:#34d399; }
    [data-theme="dark"] .am-btn-green:hover { background:#163a2c; }
    .am-btn-warning { background:#fffbeb;color:#d97706; }
    .am-btn-warning:hover { background:#fef3c7; }
    [data-theme="dark"] .am-btn-warning { background:#2a230b;color:#fbbf24; }
    [data-theme="dark"] .am-btn-warning:hover { background:#3a3010; }
    .am-card { background:var(--surface-raised);border:1px solid var(--line);border-radius:14px;overflow:hidden; }
    .am-row { display:grid;grid-template-columns:1fr 1fr 120px 120px 160px;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--line);transition:background .15s; }
    .am-row:hover { background:var(--surface-sunken); }
    .am-row-header { background:var(--surface-sunken);font-weight:700;font-size:11px;color:var(--content-muted);text-transform:uppercase;letter-spacing:.05em; }
    .am-modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px; }
    .am-modal { background:var(--surface-raised);border-radius:16px;width:100%;max-width:500px;box-shadow:0 24px 64px rgba(0,0,0,.18);overflow:hidden; }
    .am-badge { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700; }
    .am-badge-sa  { background:#fef2f2;color:#b91c1c; }
    .am-badge-adm { background:#eff6ff;color:#1d4ed8; }
    .am-badge-tc  { background:#F0FFC2;color:#4a7a2a; }
    [data-theme="dark"] .am-badge-tc { background:#1d2a14;color:#B5E18B; }
    .am-badge-active   { background:#ecfdf5;color:#15803d; }
    .am-badge-inactive { background:var(--surface-sunken);color:var(--content-muted); }
    [data-theme="dark"] .am-badge-sa  { background:#3a1a1a;color:#f87171; }
    [data-theme="dark"] .am-badge-adm { background:#16223f;color:#93b4f5; }
    [data-theme="dark"] .am-badge-active { background:#10291f;color:#34d399; }
  `}</style>
);

const formatDate = d => d ? new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const formatLastLogin = d => {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
};

export default function AdminManagement() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  // Focus-trap each modal while it's open (Escape closes; focus restores to trigger).
  const createRef = useFocusTrap(showCreate, { onEscape: () => setShowCreate(false) });
  const editRef = useFocusTrap(!!editTarget, { onEscape: () => setEditTarget(null) });
  const resetRef = useFocusTrap(!!resetTarget, { onEscape: () => { setResetTarget(null); setNewPwd(''); } });

  // Create form
  const [createForm, setCreateForm] = useState({ name:'', email:'', password:'', role:'admin' });
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset password form
  const [newPwd, setNewPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get('/api/admin/admin-accounts');
      if (r.data.success) setAdmins(r.data.data);
    } catch {
      toast.error('Failed to load admin accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // ── Create admin ──────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      return toast.error('Name, email and password are required');
    }
    if (createForm.password.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setCreating(true);
    try {
      const r = await axios.post('/api/admin/admin-accounts', createForm);
      if (r.data.success) {
        toast.success(`Admin account "${createForm.name}" created`);
        setShowCreate(false);
        setCreateForm({ name:'', email:'', password:'', role:'admin' });
        fetchAdmins();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin');
    } finally {
      setCreating(false);
    }
  };

  // ── Edit admin ────────────────────────────────────────────────
  const openEdit = (admin) => {
    setEditTarget(admin);
    setEditForm({ name: admin.name, email: admin.email, role: admin.role, is_active: admin.is_active });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await axios.put(`/api/admin/admin-accounts/${editTarget.id}`, editForm);
      if (r.data.success) {
        toast.success('Admin account updated');
        setEditTarget(null);
        fetchAdmins();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update admin');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────
  const toggleActive = async (admin) => {
    if (admin.id === currentUser?.id) return toast.error('Cannot deactivate your own account');
    try {
      await axios.put(`/api/admin/admin-accounts/${admin.id}`, { is_active: !admin.is_active });
      toast.success(`Account ${admin.is_active ? 'deactivated' : 'activated'}`);
      fetchAdmins();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update account');
    }
  };

  // ── Reset password ────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    if (!newPwd || newPwd.length < 8) return toast.error('Password must be at least 8 characters');
    setResetting(true);
    try {
      const r = await axios.post(`/api/admin/admin-accounts/${resetTarget.id}/reset-password`, { newPassword: newPwd });
      if (r.data.success) {
        toast.success('Password reset successfully');
        setResetTarget(null);
        setNewPwd('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const myCount = admins.filter(a => a.is_active).length;
  const saCount = admins.filter(a => a.role === 'super_admin').length;
  const adCount = admins.filter(a => a.role === 'admin').length;
  const tcCount = admins.filter(a => a.role === 'tax_consultant').length;

  const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', tax_consultant: 'Tax Consultant' };
  const ROLE_BADGE = { super_admin: 'am-badge-sa', admin: 'am-badge-adm', tax_consultant: 'am-badge-tc' };

  return (
    <div className="am-root space-y-6">
      <S />

      {/* Header */}
      <div className="bg-white dark:bg-[#151c30] rounded-xl shadow-sm p-6 border border-gray-100 dark:border-[#2a3450]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-[#e7eaf3]">Admin Account Management</h1>
              <p className="text-sm text-gray-500 dark:text-[#7e88a6]">Create and manage administrator accounts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAdmins} className="am-btn am-btn-ghost" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="am-btn am-btn-primary">
              <Plus className="w-4 h-4" />
              New Admin
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Active Accounts', value: myCount, color:'text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-500/15 border-green-200 dark:border-green-500/30' },
          { label:'Super Admins', value: saCount, color:'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30' },
          { label:'Regular Admins', value: adCount, color:'text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30' },
          { label:'Tax Consultants', value: tcCount, color:'text-lime-700 dark:text-lime-300 bg-lime-50 dark:bg-lime-500/15 border-lime-200 dark:border-lime-500/30' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-sm font-semibold mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Admin List */}
      <div className="am-card">
        {/* Header row */}
        <div className="am-row am-row-header">
          <span>Name / Email</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 dark:text-[#7e88a6]" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-[#7e88a6]">
            <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No admin accounts found</p>
          </div>
        ) : (
          admins.map(admin => (
            <div key={admin.id} className="am-row">
              {/* Name */}
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#1a2238] flex items-center justify-center text-xs font-bold text-gray-600 dark:text-[#aab2cc]">
                    {admin.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-[#e7eaf3] text-sm flex items-center gap-1">
                      {admin.name}
                      {admin.id === currentUser?.id && (
                        <span className="text-xs font-normal text-gray-400 dark:text-[#7e88a6]">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#7e88a6] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last login: {formatLastLogin(admin.last_login_at)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="text-sm text-gray-600 dark:text-[#aab2cc] truncate">{admin.email}</div>

              {/* Role */}
              <div>
                <span className={`am-badge ${ROLE_BADGE[admin.role] || 'am-badge-adm'}`}>
                  {ROLE_LABEL[admin.role] || admin.role}
                </span>
                {admin.role === 'tax_consultant' && (
                  <div className="text-xs text-gray-500 dark:text-[#7e88a6] mt-1">
                    {Number(admin.client_count) || 0} client{Number(admin.client_count) === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <span className={`am-badge ${admin.is_active ? 'am-badge-active' : 'am-badge-inactive'}`}>
                  {admin.is_active ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {admin.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(admin)}
                  className="am-btn am-btn-ghost !py-1.5 !px-2.5"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setResetTarget(admin)}
                  className="am-btn am-btn-warning !py-1.5 !px-2.5"
                  title="Reset password"
                >
                  <Key className="w-3.5 h-3.5" />
                </button>
                {admin.id !== currentUser?.id && (
                  <button
                    onClick={() => toggleActive(admin)}
                    className={`am-btn !py-1.5 !px-2.5 ${admin.is_active ? 'am-btn-danger' : 'am-btn-green'}`}
                    title={admin.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {admin.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Admin Modal ── */}
      {showCreate && (
        <div className="am-modal-overlay" onClick={() => setShowCreate(false)}>
          <div ref={createRef} role="dialog" aria-modal="true" aria-labelledby="am-create-title" className="am-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#2a3450]">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-gray-700 dark:text-[#aab2cc]" />
                <h2 id="am-create-title" className="text-base font-bold text-gray-900 dark:text-[#e7eaf3]">Create Admin Account</h2>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 dark:text-[#7e88a6] hover:text-gray-600 dark:hover:text-[#aab2cc]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#7e88a6]" />
                  <input
                    className="am-input !pl-9"
                    placeholder="e.g. Muhammad Usman"
                    value={createForm.name}
                    onChange={e => setCreateForm(p => ({...p, name: e.target.value}))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#7e88a6]" />
                  <input
                    type="email"
                    className="am-input !pl-9"
                    placeholder="admin@example.com"
                    value={createForm.email}
                    onChange={e => setCreateForm(p => ({...p, email: e.target.value}))}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Password *</label>
                <div className="relative">
                  <input
                    type={showCreatePwd ? 'text' : 'password'}
                    className="am-input !pr-10"
                    placeholder="Minimum 8 characters"
                    value={createForm.password}
                    onChange={e => setCreateForm(p => ({...p, password: e.target.value}))}
                    required
                  />
                  <button type="button" onClick={() => setShowCreatePwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#7e88a6] hover:text-gray-600 dark:hover:text-[#aab2cc]">
                    {showCreatePwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Role *</label>
                <select
                  className="am-input"
                  value={createForm.role}
                  onChange={e => setCreateForm(p => ({...p, role: e.target.value}))}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="tax_consultant">Tax Consultant</option>
                </select>
              </div>
              {createForm.role === 'super_admin' && (
                <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-xs text-red-700 dark:text-red-300 font-semibold">
                  ⚠️ Super Admin has full system access including tax rate changes, admin management, and user impersonation.
                </div>
              )}
              {createForm.role === 'tax_consultant' && (
                <div className="bg-lime-50 dark:bg-lime-500/15 border border-lime-200 dark:border-lime-500/30 rounded-lg p-3 text-xs text-lime-800 dark:text-lime-300 font-semibold">
                  A Tax Consultant manages ONLY clients explicitly assigned to them (or that they
                  create / bulk-import). Independent users stay invisible. They cannot change tax
                  rates, user roles, or admin accounts.
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="am-btn am-btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="am-btn am-btn-primary flex-1">
                  {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Admin Modal ── */}
      {editTarget && (
        <div className="am-modal-overlay" onClick={() => setEditTarget(null)}>
          <div ref={editRef} role="dialog" aria-modal="true" aria-labelledby="am-edit-title" className="am-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#2a3450]">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-gray-700 dark:text-[#aab2cc]" />
                <h2 id="am-edit-title" className="text-base font-bold text-gray-900 dark:text-[#e7eaf3]">Edit Admin — {editTarget.name}</h2>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 dark:text-[#7e88a6] hover:text-gray-600 dark:hover:text-[#aab2cc]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Full Name</label>
                <input
                  className="am-input"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({...p, name: e.target.value}))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Email</label>
                <input
                  type="email"
                  className="am-input"
                  value={editForm.email}
                  onChange={e => setEditForm(p => ({...p, email: e.target.value}))}
                  required
                />
              </div>
              {editTarget.id !== currentUser?.id && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">Role</label>
                  <select
                    className="am-input"
                    value={editForm.role}
                    onChange={e => setEditForm(p => ({...p, role: e.target.value}))}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="tax_consultant">Tax Consultant</option>
                  </select>
                  {editTarget.role === 'tax_consultant' && editForm.role !== 'tax_consultant' && (
                    <p className="text-xs text-amber-600 dark:text-amber-300 mt-1.5 font-semibold">
                      Changing this role releases all {Number(editTarget.client_count) || 0} assigned client(s) —
                      they become independent again.
                    </p>
                  )}
                </div>
              )}
              {editTarget.id !== currentUser?.id && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="editActive"
                    checked={editForm.is_active}
                    onChange={e => setEditForm(p => ({...p, is_active: e.target.checked}))}
                    className="w-4 h-4 accent-green-600"
                  />
                  <label htmlFor="editActive" className="text-sm font-semibold text-gray-700 dark:text-[#aab2cc]">Account Active</label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="am-btn am-btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="am-btn am-btn-primary flex-1">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div className="am-modal-overlay" onClick={() => { setResetTarget(null); setNewPwd(''); }}>
          <div ref={resetRef} role="dialog" aria-modal="true" aria-labelledby="am-reset-title" className="am-modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#2a3450]">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                <h2 id="am-reset-title" className="text-base font-bold text-gray-900 dark:text-[#e7eaf3]">Reset Password — {resetTarget.name}</h2>
              </div>
              <button onClick={() => { setResetTarget(null); setNewPwd(''); }} className="text-gray-400 dark:text-[#7e88a6] hover:text-gray-600 dark:hover:text-[#aab2cc]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReset} className="p-5 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 font-semibold">
                You are resetting the password for <strong>{resetTarget.email}</strong>. They will need the new password to log in.
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-[#aab2cc] mb-1.5">New Password *</label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    className="am-input !pr-10"
                    placeholder="Minimum 8 characters"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowNewPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#7e88a6] hover:text-gray-600 dark:hover:text-[#aab2cc]">
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setResetTarget(null); setNewPwd(''); }} className="am-btn am-btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={resetting} className="am-btn am-btn-warning flex-1">
                  {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
