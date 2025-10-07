import React, { useState, useEffect } from 'react';
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
  HardDrive
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/admin/system-settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setSettings(result.data);
      } else {
        toast.error('Failed to load system settings');
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      toast.error('Error loading system settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemHealth = async () => {
    setLoadingHealth(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/admin/system-settings/health/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSystemHealth(result.data);
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoadingHealth(false);
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

      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/admin/system-settings/${settingKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: category,
          setting_value: setting.setting_value,
          data_type: setting.data_type,
          description: setting.description,
          is_public: setting.is_public || false
        })
      });

      if (response.ok) {
        toast.success('Setting saved successfully');
        await fetchSystemSettings(); // Refresh to get updated timestamps
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save setting');
      }
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Error saving setting');
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
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/admin/system-settings/reset-defaults', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category })
      });

      if (response.ok) {
        toast.success(`Settings reset to defaults successfully`);
        await fetchSystemSettings();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Error resetting settings');
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
      className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <span className="text-sm text-gray-600">Enabled</span>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
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
        case 'healthy': return 'text-green-600';
        case 'warning': return 'text-yellow-600';
        case 'error': return 'text-red-600';
        default: return 'text-gray-600';
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
        <div className="flex items-center space-x-2 text-gray-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading system settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              <p className="text-gray-600">Configure system parameters and operational settings</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchSystemHealth()}
              disabled={loadingHealth}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
              <span>Refresh Health</span>
            </button>
            
            {user?.role === 'super_admin' && (
              <button
                onClick={() => resetToDefaults()}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
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
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Monitor className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Database Health */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Database className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Database</span>
                </div>
                {renderHealthStatus(systemHealth.database.status)}
              </div>
              {systemHealth.database.details && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Connections: {systemHealth.database.details.active_connections}</div>
                  <div>Connected: {systemHealth.database.details.connected ? 'Yes' : 'No'}</div>
                </div>
              )}
            </div>

            {/* Memory Usage */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Memory</span>
                </div>
                {renderHealthStatus(systemHealth.memory.status)}
              </div>
              {systemHealth.memory.details && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Heap: {systemHealth.memory.details.heap_used}</div>
                  <div>RSS: {systemHealth.memory.details.rss}</div>
                </div>
              )}
            </div>

            {/* Services */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Services</span>
                </div>
                {renderHealthStatus(systemHealth.services.status)}
              </div>
              {systemHealth.services.details && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Uptime: {systemHealth.services.details.uptime_human}</div>
                  <div>Node: {systemHealth.services.details.node_version}</div>
                </div>
              )}
            </div>

            {/* Disk Space (placeholder) */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <HardDrive className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Storage</span>
                </div>
                {renderHealthStatus('healthy')}
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Available: Available</div>
                <div>Status: Operational</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white rounded-lg shadow-sm p-4 mr-6">
          <nav className="space-y-2">
            {Object.entries(settingCategories).map(([key, category]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === key
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-100'
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    {React.createElement(settingCategories[activeTab].icon, { className: "w-6 h-6" })}
                    <span>{settingCategories[activeTab].title}</span>
                  </h2>
                  <p className="text-gray-600 mt-1">{settingCategories[activeTab].description}</p>
                </div>
                
                {user?.role === 'super_admin' && (
                  <button
                    onClick={() => resetToDefaults(activeTab)}
                    disabled={saving}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
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
                <div key={setting.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={setting.setting_key} className="block text-sm font-medium text-gray-900 mb-1">
                            {setting.setting_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </label>
                          <p className="text-xs text-gray-600 mb-3">{setting.description}</p>
                        </div>
                        
                        <div>
                          {renderSettingInput(setting, activeTab)}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              Type: {setting.data_type} | Updated: {new Date(setting.updated_at).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => saveSetting(activeTab, setting.setting_key)}
                              disabled={saving}
                              className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
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
                <div className="text-center py-8 text-gray-500">
                  <SettingsIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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