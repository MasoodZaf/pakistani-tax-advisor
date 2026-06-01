import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Activity, RefreshCw, Search, Filter, Clock, User, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const S = () => (
  <style>{`
    /* Brand fonts loaded once in public/index.html (UX-06) */
    .al-root { font-family:'Nunito',sans-serif; }
    .al-input { padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:9px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;outline:none;transition:border-color .18s; }
    .al-input:focus { border-color:#28396C; }
    .al-btn { display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:8px;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;border:none; }
    .al-btn-ghost { background:#f3f4f6;color:#374151; }
    .al-btn-ghost:hover { background:#e5e7eb; }
    .al-badge { display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700; }
  `}</style>
);

const ACTION_COLORS = {
  login:              'bg-blue-50 text-blue-700',
  admin_assisted_login: 'bg-purple-50 text-purple-700',
  create:             'bg-green-50 text-green-700',
  update:             'bg-yellow-50 text-yellow-700',
  delete:             'bg-red-50 text-red-700',
  password_change:    'bg-orange-50 text-orange-700',
  password_reset:     'bg-orange-50 text-orange-700',
  clone:              'bg-teal-50 text-teal-700',
  EXCEL_IMPORT:       'bg-indigo-50 text-indigo-700',
  EXCEL_EXPORT:       'bg-indigo-50 text-indigo-700',
};

const formatTime = d => new Date(d).toLocaleString('en-PK', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

export default function AuditLogs() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [pagination, setPagination] = useState({ page:1, total:0, pages:1, limit:50 });
  const [search, setSearch]       = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter]   = useState('');

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (search)       params.search = search;
      if (actionFilter) params.action = actionFilter;
      if (tableFilter)  params.table_name = tableFilter;
      const r = await axios.get('/api/admin/audit-logs', { params });
      if (r.data.success) {
        setLogs(r.data.data);
        setPagination(r.data.pagination);
      }
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, tableFilter]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  return (
    <div className="al-root space-y-6">
      <S />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-sm text-gray-500">{pagination.total.toLocaleString()} total entries</p>
            </div>
          </div>
          <button onClick={() => fetchLogs(1)} className="al-btn al-btn-ghost" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="al-input !pl-8 w-64"
            placeholder="Search email, action, table..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="al-input" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="">All Actions</option>
          <option value="login">Login</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="password_change">Password Change</option>
          <option value="password_reset">Password Reset</option>
          <option value="EXCEL_IMPORT">Excel Import</option>
          <option value="EXCEL_EXPORT">Excel Export</option>
        </select>
        <select className="al-input" value={tableFilter} onChange={e => setTableFilter(e.target.value)}>
          <option value="">All Tables</option>
          <option value="users">Users</option>
          <option value="tax_slabs">Tax Slabs</option>
          <option value="tax_years">Tax Years</option>
          <option value="income_forms">Income Forms</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Table</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No audit log entries found</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(log.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-700 font-medium text-xs">{log.user_email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`al-badge ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600">{log.table_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {log.change_summary || log.new_value || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total.toLocaleString()} entries)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="al-btn al-btn-ghost !py-1.5 !px-2.5 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages || loading}
                className="al-btn al-btn-ghost !py-1.5 !px-2.5 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
