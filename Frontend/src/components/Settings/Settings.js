import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import { User, Bell, Shield, HelpCircle, X, Eye, EyeOff, SlidersHorizontal, Check, AlertTriangle, Activity, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConnectedAccounts from './ConnectedAccounts';
import { wizardAPI } from '../../services/wizardAPI';

/* ─── Income stream definitions (mirrors Onboarding) ─────────────────────── */
const INCOME_STREAMS = [
  { id: 'bank_profit',    icon: '🏦', title: 'Bank / Savings Profit',         desc: 'Savings accounts, NSS, term deposits, defence savings' },
  { id: 'dividends',      icon: '📈', title: 'Dividends from Shares',          desc: 'Dividends from listed or unlisted companies' },
  { id: 'securities',     icon: '📊', title: 'Listed Shares / Mutual Funds',   desc: 'Capital gains on PSX shares, mutual funds, REIT units' },
  { id: 'sukuk',          icon: '🕌', title: 'Sukuk / Bond Income',            desc: 'Profit from sukuk and Islamic investment instruments' },
  { id: 'rental',         icon: '🏠', title: 'Rental Income',                  desc: 'Rent received from residential or commercial property' },
  { id: 'property_gain',  icon: '🏘️', title: 'Property Sale (Capital Gain)',   desc: 'Gain on sale of immovable property (house, plot, shop)' },
  { id: 'directorship',   icon: '🧑‍💼', title: 'Directorship / Board Fees',     desc: 'Fees from company board membership or directorship' },
  { id: 'foreign_income', icon: '🌐', title: 'Foreign Income / Remittances',   desc: 'Income earned abroad or foreign remittances received' },
  { id: 'prizes',         icon: '🎟️', title: 'Prize Bonds / Winnings',         desc: 'Winnings from prize bonds, lottery, or raffle' },
  { id: 'pension',        icon: '🏛️', title: 'Pension from Former Employer',   desc: 'Pension from a previous employer (taxable above Rs. 10M — Finance Act 2025)' },
  { id: 'agriculture',    icon: '🌾', title: 'Agriculture Income',             desc: 'Income from agricultural land (federally exempt; declaration required by FBR)' },
];

// ─── RecentActivity ─────────────────────────────────────────────────────────
// Renders the current user's audit-log entries. Calls /api/my-activity which
// is filtered server-side to user_id = req.user.id, so a user can only ever
// see their own history.
function formatRelative(iso) {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  if (ms < 60_000)        return 'Just now';
  if (ms < 3_600_000)     return Math.floor(ms / 60_000) + ' min ago';
  if (ms < 86_400_000)    return Math.floor(ms / 3_600_000) + ' hr ago';
  if (ms < 86_400_000 * 7) return Math.floor(ms / 86_400_000) + ' day' + (Math.floor(ms / 86_400_000) === 1 ? '' : 's') + ' ago';
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ACTIVITY_LABELS = {
  login:                 'Signed in',
  logout:                'Signed out',
  register:              'Account created',
  password_change:       'Password changed',
  onboarding_complete:   'Completed onboarding',
  impersonate_start:     'Admin started impersonating',
  impersonate_end:       'Admin ended impersonation',
  form_save:             'Saved a form',
  form_submit:           'Submitted tax return',
  rate_change:           'Tax rate changed',
};

const RecentActivity = () => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/my-activity?limit=50');
      setItems(res?.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = showAll ? items : items.slice(0, 10);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Activity className="w-6 h-6 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
          title="Reload"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Reload
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-2">Couldn&apos;t load activity: {error}</p>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-gray-500">No activity recorded yet.</p>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {visible.map((it) => (
            <li key={it.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {ACTIVITY_LABELS[it.action] || it.action}
                </p>
                {(it.change_summary || it.field_name) && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    {it.change_summary || `Updated ${it.field_name}`}
                  </p>
                )}
                {it.ip_address && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    From {it.ip_address}
                  </p>
                )}
              </div>
              <time
                className="text-xs text-gray-500 whitespace-nowrap"
                title={new Date(it.created_at).toLocaleString('en-PK')}
              >
                {formatRelative(it.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}

      {items.length > 10 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          {showAll ? 'Show less' : `Show all ${items.length} entries`}
        </button>
      )}
    </div>
  );
};

// ── WizardRerunControl ───────────────────────────────────────────────────
// Shows the quick-start wizard's current state (completed/in-progress/none)
// and a button to re-run. Re-run calls /api/wizard/reset (which archives
// the prior session and returns the prior captured_data as a seed) and
// then routes to /wizard — where /start picks it up and renders the first
// step pre-filled from the saved answers.
const WizardRerunControl = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await wizardAPI.status();
      setStatus(s);
    } catch (err) {
      console.warn('wizard/status fetch failed', err);
      setStatus(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const rerun = async () => {
    setLoading(true);
    try {
      await wizardAPI.reset();
      navigate('/wizard');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not reset wizard.');
    } finally {
      setLoading(false);
    }
  };

  if (!status) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (status.in_progress) {
    return (
      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <div>
            <div className="font-medium text-gray-900">Wizard is in progress</div>
            <div className="text-sm text-gray-600">Resume where you left off.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/wizard')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Resume
        </button>
      </div>
    );
  }

  if (!status.completed) {
    return (
      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-gray-500" />
          <div>
            <div className="font-medium text-gray-900">You haven't run the wizard yet</div>
            <div className="text-sm text-gray-600">
              Get a rough tax estimate in about 90 seconds.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/wizard')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Start
        </button>
      </div>
    );
  }

  // status.completed === true
  return (
    <div>
      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <div>
            <div className="font-medium text-gray-900">Wizard completed for this year</div>
            <div className="text-sm text-gray-600">
              {status.last_completed_at
                ? `Finished ${new Date(status.last_completed_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}.`
                : ''}{' '}
              You can re-run to update your answers.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" /> Run again
        </button>
      </div>

      {confirming && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p className="text-amber-900 font-medium mb-2">Run the wizard again?</p>
          <p className="text-amber-800 mb-3">
            Your previous answers will be pre-filled — you'll edit them in place. The new run will replace
            the prior estimate when you finish.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={rerun}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Yes, run again
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Settings = () => {
  const { user } = useAuth();
  const { incomeProfile, updateIncomeProfile } = useTaxForm();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Income streams state — initialised from context; re-syncs when context loads from API
  const [localAddons, setLocalAddons]   = useState(() => incomeProfile?.addons || []);
  const [streamsDirty, setStreamsDirty] = useState(false);

  // Keep local state in sync when context finishes loading (avoids empty initial render)
  React.useEffect(() => {
    if (!streamsDirty) {
      setLocalAddons(incomeProfile?.addons || []);
    }
  }, [incomeProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  const [streamsSaving, setStreamsSaving] = useState(false);
  const [removingStream, setRemovingStream] = useState(null); // id of stream pending removal confirmation

  const toggleAddon = (id) => {
    const isActive = localAddons.includes(id);
    if (isActive) {
      // Ask for confirmation before removing — user may have entered data for this stream
      setRemovingStream(id);
    } else {
      setLocalAddons(prev => [...prev, id]);
      setStreamsDirty(true);
    }
  };

  const confirmRemove = () => {
    setLocalAddons(prev => prev.filter(x => x !== removingStream));
    setStreamsDirty(true);
    setRemovingStream(null);
  };

  const saveStreams = async () => {
    setStreamsSaving(true);
    const ok = await updateIncomeProfile(localAddons);
    setStreamsSaving(false);
    if (ok) {
      toast.success('Income streams updated');
      setStreamsDirty(false);
    } else {
      toast.error('Failed to save — please try again');
    }
  };

  const cancelStreams = () => {
    setLocalAddons(incomeProfile?.addons || []);
    setStreamsDirty(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    
    setIsChangingPassword(true);

    try {
      await axios.post('/api/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h1>
        <p className="text-gray-600">
          Manage your account preferences and personal information
        </p>
      </div>

      {/* User Profile */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-3 mb-6">
          <User className="w-6 h-6 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input 
              type="text" 
              value={user?.name || ''} 
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input 
              type="email" 
              value={user?.email || ''} 
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CNIC</label>
            <input 
              type="text" 
              value={user?.cnic || ''} 
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <input 
              type="text" 
              value={user?.role?.replace('_', ' ') || ''} 
              disabled
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 capitalize"
            />
          </div>
        </div>
      </div>

      {/* Income Streams */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <SlidersHorizontal className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Income Streams</h2>
          </div>
          {streamsDirty && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelStreams}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveStreams}
                disabled={streamsSaving}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {streamsSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        {/* Primary type — always locked */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
          <span className="text-lg">💼</span>
          <div className="flex-1">
            <p className="text-sm font-700 font-semibold text-green-900">Salaried Employee</p>
            <p className="text-xs text-green-700">Primary income type — always included</p>
          </div>
          <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-3">
          Toggle additional income streams. Only the relevant forms will appear in your filing flow.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {INCOME_STREAMS.map(stream => {
            const active = localAddons.includes(stream.id);
            return (
              <button
                key={stream.id}
                onClick={() => toggleAddon(stream.id)}
                className="flex items-center gap-3 text-left px-3 py-2.5 rounded-lg border transition-all"
                style={{
                  borderColor: active ? '#2563eb' : '#e5e7eb',
                  background: active ? '#eff6ff' : '#fff',
                }}
              >
                <span className="text-lg flex-shrink-0 leading-none">{stream.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{stream.title}</p>
                  <p className="text-xs text-gray-500 leading-tight line-clamp-1">{stream.desc}</p>
                </div>
                <div
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors"
                  style={{
                    border: `2px solid ${active ? '#2563eb' : '#d1d5db'}`,
                    background: active ? '#2563eb' : '#fff',
                  }}
                >
                  {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Changes take effect immediately in the sidebar navigation and form progress.
        </p>
      </div>

      {/* Remove stream confirmation dialog */}
      {removingStream && (() => {
        const stream = INCOME_STREAMS.find(s => s.id === removingStream);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Remove income stream?</h3>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                <strong>{stream?.icon} {stream?.title}</strong> will be removed from your filing flow.
              </p>
              <p className="text-sm text-gray-500 mb-5">
                Any data already entered in the related forms will be preserved — it just won't show in your navigation until you add this stream back.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRemovingStream(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Keep it
                </button>
                <button
                  onClick={confirmRemove}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Notifications */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Email Notifications</div>
                <div className="text-sm text-gray-600">Receive updates via email</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Deadline Reminders</div>
                <div className="text-sm text-gray-600">Get reminders for tax deadlines</div>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          </div>

          <div className="space-y-6">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-900">Change Password</div>
              <div className="text-sm text-gray-600">Update your account password</div>
            </button>

            {/* Connected accounts — Google / Apple SSO. Lets users who hit
                sso_email_conflict at sign-in time link the provider here
                after authenticating with their password. */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Connected accounts</h3>
              <ConnectedAccounts />
            </div>

            {/* Re-run the quick-start wizard. Archives the prior session
                and pre-fills the new one from the saved answers — see
                project-design wizard memory. */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Quick-start wizard</h3>
              <WizardRerunControl />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity — surfaces the user's audit trail (logins, form
          saves, password changes, impersonation events). Especially useful
          when a tax consultant has been operating on the user's behalf. */}
      <RecentActivity />

      {/* Help & Support */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <HelpCircle className="w-6 h-6 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Need Help?</h3>
        </div>
        <p className="text-blue-800 mb-4">
          Contact our support team for assistance with your tax return or account settings.
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Contact Support
        </button>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      currentPassword: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      newPassword: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    required
                    minLength="8"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      confirmPassword: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={isChangingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChangingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;