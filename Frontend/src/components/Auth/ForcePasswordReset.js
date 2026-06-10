import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { storeToken } from '../../utils/tokenStorage';
import { isStaff } from '../../utils/roles';

// Full-screen forced password reset for bulk-imported users logging in with a
// temporary password. Every route guard redirects here while
// user.must_reset_password is set; this screen is the only way forward.
const ForcePasswordReset = () => {
  const { user, loading, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_reset_password) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.next.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (form.next !== form.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/api/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      });
      // change-password bumps token_version — swap in the fresh token so this
      // session survives while every other temp-password token dies.
      if (res.data?.token) storeToken(res.data.token);
      updateUser({ must_reset_password: false });
      toast.success('Password set — welcome aboard!');
      navigate(isStaff(user) ? '/admin' : '/', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not set the new password');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-[#2a3450] dark:bg-[#0f1426] dark:text-[#e7eaf3] rounded-brand focus:ring-2 focus:ring-navy/30 focus:border-transparent';

  const field = (label, key, autoComplete) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-[#aab2cc] mb-1">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-[#7e88a6]" />
        <input
          type={show ? 'text' : 'password'}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className={inputClass}
          autoComplete={autoComplete}
          required
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--surface)' }}>
      <div className="bg-white dark:bg-[#151c30] rounded-brand shadow-brand p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-grid place-items-center rounded-brand bg-lime/25 p-2 text-navy dark:text-[#e7eaf3]">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <h1 className="text-2xl font-bold text-navy dark:text-[#e7eaf3]">Set your password</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-[#aab2cc] mb-6">
          Your account was created with a temporary password. Choose your own
          password to continue — the temporary one stops working immediately.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {field('Temporary password', 'current', 'current-password')}
          {field('New password (min 8 characters)', 'next', 'new-password')}
          {field('Confirm new password', 'confirm', 'new-password')}

          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-[#aab2cc] hover:text-navy dark:hover:text-[#e7eaf3]"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {show ? 'Hide passwords' : 'Show passwords'}
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-lime text-navy font-semibold px-4 py-2.5 rounded-brand hover:bg-lime/80 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full text-center text-sm text-gray-500 dark:text-[#7e88a6] hover:text-navy dark:hover:text-[#e7eaf3] mt-4"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
};

export default ForcePasswordReset;
