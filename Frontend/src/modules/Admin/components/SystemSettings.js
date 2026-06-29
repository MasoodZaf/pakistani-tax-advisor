import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  Settings as SettingsIcon, 
  Save, 
  RotateCcw, 
  Server, 
  Shield, 
  Bell, 
  Database, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Monitor,
  Cpu,
  HardDrive,
  Mail,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';

const SystemSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('application');
  const [systemHealth, setSystemHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  
  const settingCategories = {
    application: {
      title: 'Application Settings',
      icon: SettingsIcon,
      description: 'Basic application configuration and display settings'
    },
    tax_calculation: {
      title: 'Tax Calculation',
      icon: Database,
      description: 'Tax calculation parameters and default values'
    },
    security: {
      title: 'Security',
      icon: Shield,
      description: 'Security policies and authentication settings'
    },
    notifications: {
      title: 'Notifications',
      icon: Bell,
      description: 'Email and notification system configuration'
    },
    backup: {
      title: 'Backup & Maintenance',
      icon: Server,
      description: 'Backup schedules and system maintenance settings'
    }
  };

  useEffect(() => {
    fetchSystemSettings();
    fetchSystemHealth();
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const response = await axios.get('/api/admin/system-settings');
      setSettings(response.data.data);
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemHealth = async () => {
    setLoadingHealth(true);
    try {
      const response = await axios.get('/api/admin/system-settings/health/status');
      setSystemHealth(response.data.data);
    } catch {
      // Health check failure is non-critical — no toast
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const to = testEmailTo.trim();
      const res = await axios.post('/api/admin/email-test', to ? { to } : {});
      if (res.data?.success) {
        toast.success(res.data.message || 'Test email sent');
      } else {
        toast.error(res.data?.message || 'Could not send test email');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSettingChange = (category, settingKey, newValue, dataType) => {
    const updatedSettings = { ...settings };
    if (!updatedSettings[category]) {
      updatedSettings[category] = [];
    }
    
    const settingIndex = updatedSettings[category].findIndex(s => s.setting_key === settingKey);
    if (settingIndex >= 0) {
      updatedSettings[category][settingIndex] = {
        ...updatedSettings[category][settingIndex],
        setting_value: newValue
      };
    }
    
    setSettings(updatedSettings);
  };

  const saveSetting = async (category, settingKey) => {
    try {
      setSaving(true);
      const setting = settings[category]?.find(s => s.setting_key === settingKey);
      if (!setting) return;

      await axios.put(`/api/admin/system-settings/${settingKey}`, {
        category,
        setting_value: setting.setting_value,
        data_type: setting.data_type,
        description: setting.description,
        is_public: setting.is_public || false,
      });
      toast.success('Setting saved successfully');
      await fetchSystemSettings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async (category = null) => {
    if (!window.confirm(`Are you sure you want to reset ${category ? `${category} settings` : 'all settings'} to defaults?`)) {
      return;
    }

    try {
      setSaving(true);
      await axios.post('/api/admin/system-settings/reset-defaults', { category });
      toast.success('Settings reset to defaults successfully');
      await fetchSystemSettings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  const renderSettingInput = (setting, category) => {
    const { setting_key, setting_value, data_type } = setting;
    
    const commonProps = {
      id: setting_key,
      value: setting_value,
      onChange: (e) => handleSettingChange(category, setting_key, e.target.value, data_type),
      className: "w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    };

    switch (data_type) {
      case 'boolean':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={setting_value === 'true'}
              onChange={(e) => handleSettingChange(category, setting_key, e.target.checked.toString(), data_type)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            <span className="text-sm text-gray-600 dark:text-[#aab2cc]">Enabled</span>
          </label>
        );
      
      case 'number':
        return (
          <input
            type="number"
            {...commonProps}
          />
        );
      
      case 'date':
        return (
          <input
            type="date"
            {...commonProps}
          />
        );
      
      case 'json':
        return (
          <textarea
            rows="3"
            {...commonProps}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2a3450] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
        );
      
      default: // string
        return (
          <input
            type="text"
            {...commonProps}
          />
        );
    }
  };

  const renderHealthStatus = (status, details) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'healthy': return 'text-green-600 dark:text-green-400';
        case 'warning': return 'text-yellow-600 dark:text-yellow-400';
        case 'error': return 'text-red-600 dark:text-red-400';
        default: return 'text-gray-600 dark:text-[#aab2cc]';
      }
    };

    const getStatusIcon = (status) => {
      switch (status) {
        case 'healthy': return <CheckCircle className="w-5 h-5" />;
        case 'warning': return <AlertTriangle className="w-5 h-5" />;
        case 'error': return <XCircle className="w-5 h-5" />;
        default: return <Monitor className="w-5 h-5" />;
      }
    };

    return (
      <div className={`flex items-center space-x-2 ${getStatusColor(status)}`}>
        {getStatusIcon(status)}
        <span className="capitalize font-medium">{status}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center space-x-2 text-gray-600 dark:text-[#aab2cc]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading system settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#151c30] rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e7eaf3]">System Settings</h1>
              <p className="text-gray-600 dark:text-[#aab2cc]">Configure system parameters and operational settings</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchSystemHealth()}
              disabled={loadingHealth}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-[#1a2238] text-gray-700 dark:text-[#aab2cc] rounded-lg hover:bg-gray-200 dark:hover:bg-[#2a3450] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
              <span>Refresh Health</span>
            </button>
            
            {user?.role === 'super_admin' && (
              <button
                onClick={() => resetToDefaults()}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All to Defaults</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Health */}
      {systemHealth && (
        <div className="bg-white dark:bg-[#151c30] rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Monitor className="w-6 h-6 text-gray-600 dark:text-[#aab2cc]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e7eaf3]">System Health</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Database Health */}
            <div className="bg-gray-50 dark:bg-[#0f1426] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-gray-600 dark:text-[#aab2cc]" />
                  <span className="font-medium dark:text-[#e7eaf3]">Database</span>
                </div>
                {renderHealthStatus(systemHealth.database.status)}
              </div>
              {systemHealth.database.details && (
                <div className="text-xs text-gray-600 dark:text-[#aab2cc] space-y-1">
                  <div>Connections: {systemHealth.database.details.active_connections}</div>
                  <div>Connected: {systemHealth.database.details.connected ? 'Yes' : 'No'}</div>
                </div>
              )}
            </div>

            {/* Memory Usage */}
            <div className="bg-gray-50 dark:bg-[#0f1426] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-gray-600 dark:text-[#aab2cc]" />
                  <span className="font-medium dark:text-[#e7eaf3]">Memory</span>
                </div>
                {renderHealthStatus(systemHealth.memory.status)}
              </div>
              {systemHealth.memory.details && (
                <div className="text-xs text-gray-600 dark:text-[#aab2cc] space-y-1">
                  <div>Heap: {systemHealth.memory.details.heap_used}</div>
                  <div>RSS: {systemHealth.memory.details.rss}</div>
                </div>
              )}
            </div>

            {/* Services */}
            <div className="bg-gray-50 dark:bg-[#0f1426] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-gray-600 dark:text-[#aab2cc]" />
                  <span className="font-medium dark:text-[#e7eaf3]">Services</span>
                </div>
                {renderHealthStatus(systemHealth.services.status)}
              </div>
              {systemHealth.services.details && (
                <div className="text-xs text-gray-600 dark:text-[#aab2cc] space-y-1">
                  <div>Uptime: {systemHealth.services.details.uptime_human}</div>
                  <div>Node: {systemHealth.services.details.node_version}</div>
                </div>
              )}
            </div>

            {/* Disk Space (placeholder) */}
            <div className="bg-gray-50 dark:bg-[#0f1426] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-5 h-5 text-gray-600 dark:text-[#aab2cc]" />
                  <span className="font-medium dark:text-[#e7eaf3]">Storage</span>
                </div>
                {renderHealthStatus('healthy')}
              </div>
              <div className="text-xs text-gray-600 dark:text-[#aab2cc] space-y-1">
                <div>Available: Available</div>
                <div>Status: Operational</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email delivery test — super_admin only. Confirms outbound SMTP
          (e.g. Resend) works before relying on it in production. */}
      {user?.role === 'super_admin' && (
        <div className="bg-white dark:bg-[#151c30] rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <Mail className="w-6 h-6 text-gray-600 dark:text-[#aab2cc]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e7eaf3]">Email delivery</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-[#aab2cc] mb-4">
            Send a test email through the configured SMTP provider (e.g. Resend) to confirm outbound
            email is working. Leave the field blank to send to your own address.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="email"
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              placeholder={user?.email || 'you@example.com'}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#2a3450] rounded-lg bg-white dark:bg-[#0f1626] text-gray-900 dark:text-[#e7eaf3] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors disabled:opacity-50"
            >
              {sendingTestEmail ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{sendingTestEmail ? 'Sending…' : 'Send test email'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white dark:bg-[#151c30] rounded-lg shadow-sm p-4 mr-6">
          <nav className="space-y-2">
            {Object.entries(settingCategories).map(([key, category]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === key
                    ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                    : 'text-gray-700 dark:text-[#aab2cc] hover:bg-gray-100 dark:hover:bg-[#1a2238]'
                }`}
              >
                <category.icon className="w-5 h-5" />
                <span className="font-medium">{category.title}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-white dark:bg-[#151c30] rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-[#e7eaf3] flex items-center space-x-2">
                    {React.createElement(settingCategories[activeTab].icon, { className: "w-6 h-6" })}
                    <span>{settingCategories[activeTab].title}</span>
                  </h2>
                  <p className="text-gray-600 dark:text-[#aab2cc] mt-1">{settingCategories[activeTab].description}</p>
                </div>

                {user?.role === 'super_admin' && (
                  <button
                    onClick={() => resetToDefaults(activeTab)}
                    disabled={saving}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-[#1a2238] text-gray-700 dark:text-[#aab2cc] rounded-lg hover:bg-gray-200 dark:hover:bg-[#2a3450] transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Category</span>
                  </button>
                )}
              </div>
            </div>

            {/* Settings Grid */}
            <div className="space-y-6">
              {settings[activeTab]?.map((setting) => (
                <div key={setting.id} className="bg-gray-50 dark:bg-[#0f1426] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={setting.setting_key} className="block text-sm font-medium text-gray-900 dark:text-[#e7eaf3] mb-1">
                            {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </label>
                          <p className="text-xs text-gray-600 dark:text-[#aab2cc] mb-3">{setting.description}</p>
                        </div>

                        <div>
                          {renderSettingInput(setting, activeTab)}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500 dark:text-[#7e88a6]">
                              Type: {setting.data_type} | Updated: {new Date(setting.updated_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => saveSetting(activeTab, setting.setting_key)}
                              disabled={saving}
                              className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500 dark:text-[#7e88a6]">
                  <SettingsIcon className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-[#7e88a6]" />
                  <p>No settings found for this category</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;