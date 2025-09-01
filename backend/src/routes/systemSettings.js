const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify admin authentication
const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      });
    }
    
    const sessionToken = authHeader.substring(7);
    
    if (!sessionToken || sessionToken.length < 10) {
      return res.status(401).json({ 
        error: 'Invalid session token',
        message: 'Session token must be at least 10 characters'
      });
    }
    
    // Verify session token exists and get user info
    const sessionResult = await pool.query(`
      SELECT us.user_id, us.user_email, u.name, u.role, u.permissions
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid or expired session',
        message: 'Please login again'
      });
    }
    
    const user = sessionResult.rows[0];
    
    // Check if user has admin privileges
    if (!['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }
    
    req.admin = user;
    next();
    
  } catch (error) {
    logger.error('Admin authentication error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: error.message
    });
  }
};

// Get all system settings
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, category, setting_key, setting_value, data_type,
        description, is_public, created_at, updated_at,
        created_by_email, updated_by_email
      FROM system_settings 
      ORDER BY category, setting_key
    `);
    
    // Group settings by category
    const settingsByCategory = result.rows.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: settingsByCategory,
      message: 'System settings retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get system settings error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve system settings',
      message: error.message
    });
  }
});

// Get settings by category
router.get('/category/:category', requireAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id, category, setting_key, setting_value, data_type,
        description, is_public, created_at, updated_at,
        created_by_email, updated_by_email
      FROM system_settings 
      WHERE category = $1
      ORDER BY setting_key
    `, [category]);
    
    res.json({
      success: true,
      data: result.rows,
      message: `Settings for category '${category}' retrieved successfully`
    });
    
  } catch (error) {
    logger.error('Get settings by category error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve settings',
      message: error.message
    });
  }
});

// Get specific setting
router.get('/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    const result = await pool.query(`
      SELECT 
        id, category, setting_key, setting_value, data_type,
        description, is_public, created_at, updated_at,
        created_by_email, updated_by_email
      FROM system_settings 
      WHERE setting_key = $1
    `, [key]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Setting not found',
        message: `Setting with key '${key}' does not exist`
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Setting retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get setting error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve setting',
      message: error.message
    });
  }
});

// Update or create setting
router.put('/:key', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { key } = req.params;
    const { 
      category, 
      setting_value, 
      data_type = 'string', 
      description, 
      is_public = false 
    } = req.body;
    
    if (!category || setting_value === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Category and setting_value are required'
      });
    }
    
    // Validate data type and value
    const validDataTypes = ['string', 'number', 'boolean', 'json', 'date'];
    if (!validDataTypes.includes(data_type)) {
      return res.status(400).json({ 
        error: 'Invalid data type',
        message: `Data type must be one of: ${validDataTypes.join(', ')}`
      });
    }
    
    // Validate value based on data type
    let validatedValue = setting_value;
    try {
      switch (data_type) {
        case 'number':
          validatedValue = parseFloat(setting_value);
          if (isNaN(validatedValue)) {
            throw new Error('Invalid number value');
          }
          break;
        case 'boolean':
          validatedValue = Boolean(setting_value);
          break;
        case 'json':
          if (typeof setting_value === 'string') {
            JSON.parse(setting_value); // Validate JSON
          } else {
            validatedValue = JSON.stringify(setting_value);
          }
          break;
        case 'date':
          if (!Date.parse(setting_value)) {
            throw new Error('Invalid date value');
          }
          break;
      }
    } catch (validationError) {
      return res.status(400).json({ 
        error: 'Invalid value for data type',
        message: validationError.message
      });
    }
    
    // Check if setting exists
    const existingResult = await client.query('SELECT id FROM system_settings WHERE setting_key = $1', [key]);
    
    let result;
    if (existingResult.rows.length > 0) {
      // Update existing setting
      result = await client.query(`
        UPDATE system_settings 
        SET 
          category = $1,
          setting_value = $2,
          data_type = $3,
          description = $4,
          is_public = $5,
          updated_at = NOW(),
          updated_by_email = $6
        WHERE setting_key = $7
        RETURNING *
      `, [category, validatedValue, data_type, description, is_public, req.admin.user_email, key]);
    } else {
      // Create new setting
      result = await client.query(`
        INSERT INTO system_settings (
          id, category, setting_key, setting_value, data_type,
          description, is_public, created_at, updated_at,
          created_by_email, updated_by_email
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $7
        )
        RETURNING *
      `, [category, key, validatedValue, data_type, description, is_public, req.admin.user_email]);
    }
    
    // Log the change
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category, ip_address, user_agent
      ) VALUES ($1, $2, $3, 'system_settings', $4, $5, $6, 'system_configuration', $7, $8)
    `, [
      req.admin.user_id,
      req.admin.user_email,
      existingResult.rows.length > 0 ? 'update' : 'create',
      result.rows[0].id,
      'setting_update',
      JSON.stringify({ key, value: validatedValue, data_type }),
      req.ip,
      req.headers['user-agent']
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`System setting '${key}' ${existingResult.rows.length > 0 ? 'updated' : 'created'} by admin ${req.admin.user_email}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `Setting '${key}' ${existingResult.rows.length > 0 ? 'updated' : 'created'} successfully`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Update/create setting error:', error);
    res.status(500).json({ 
      error: 'Failed to save setting',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Delete setting (Super Admin only)
router.delete('/:key', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Super admin privileges required to delete settings'
      });
    }
    
    const { key } = req.params;
    
    const result = await client.query(`
      DELETE FROM system_settings 
      WHERE setting_key = $1
      RETURNING *
    `, [key]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Setting not found',
        message: `Setting with key '${key}' does not exist`
      });
    }
    
    // Log the deletion
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, old_value, category, ip_address, user_agent
      ) VALUES ($1, $2, 'delete', 'system_settings', $3, $4, $5, 'system_configuration', $6, $7)
    `, [
      req.admin.user_id,
      req.admin.user_email,
      result.rows[0].id,
      'setting_deletion',
      JSON.stringify(result.rows[0]),
      req.ip,
      req.headers['user-agent']
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`System setting '${key}' deleted by super admin ${req.admin.user_email}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `Setting '${key}' deleted successfully`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Delete setting error:', error);
    res.status(500).json({ 
      error: 'Failed to delete setting',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Bulk update settings
router.post('/bulk-update', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { settings } = req.body;
    
    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Settings array is required'
      });
    }
    
    const updatedSettings = [];
    
    for (const setting of settings) {
      const { key, category, value, data_type = 'string', description, is_public = false } = setting;
      
      if (!key || !category || value === undefined) {
        return res.status(400).json({ 
          error: 'Invalid setting',
          message: 'Each setting must have key, category, and value'
        });
      }
      
      // Check if setting exists
      const existingResult = await client.query('SELECT id FROM system_settings WHERE setting_key = $1', [key]);
      
      let result;
      if (existingResult.rows.length > 0) {
        // Update existing setting
        result = await client.query(`
          UPDATE system_settings 
          SET 
            category = $1,
            setting_value = $2,
            data_type = $3,
            description = $4,
            is_public = $5,
            updated_at = NOW(),
            updated_by_email = $6
          WHERE setting_key = $7
          RETURNING *
        `, [category, value, data_type, description, is_public, req.admin.user_email, key]);
      } else {
        // Create new setting
        result = await client.query(`
          INSERT INTO system_settings (
            id, category, setting_key, setting_value, data_type,
            description, is_public, created_at, updated_at,
            created_by_email, updated_by_email
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $7
          )
          RETURNING *
        `, [category, key, value, data_type, description, is_public, req.admin.user_email]);
      }
      
      updatedSettings.push(result.rows[0]);
    }
    
    // Log bulk update
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category, ip_address, user_agent
      ) VALUES ($1, $2, 'bulk_update', 'system_settings', $3, $4, $5, 'system_configuration', $6, $7)
    `, [
      req.admin.user_id,
      req.admin.user_email,
      'bulk_update',
      'bulk_settings_update',
      JSON.stringify({ count: updatedSettings.length, keys: settings.map(s => s.key) }),
      req.ip,
      req.headers['user-agent']
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`Bulk update of ${updatedSettings.length} system settings by admin ${req.admin.user_email}`);
    
    res.json({
      success: true,
      data: updatedSettings,
      message: `${updatedSettings.length} settings updated successfully`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Bulk update settings error:', error);
    res.status(500).json({ 
      error: 'Failed to bulk update settings',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Reset to defaults
router.post('/reset-defaults', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Super admin privileges required to reset settings'
      });
    }
    
    const { category } = req.body;
    
    // Default system settings
    const defaultSettings = {
      'tax_calculation': [
        {
          key: 'default_tax_year',
          value: '2025-26',
          data_type: 'string',
          description: 'Default tax year for new tax returns'
        },
        {
          key: 'minimum_taxable_income',
          value: 600000,
          data_type: 'number',
          description: 'Minimum taxable income threshold'
        },
        {
          key: 'enable_advance_tax_calculation',
          value: true,
          data_type: 'boolean',
          description: 'Enable advance tax calculation features'
        }
      ],
      'application': [
        {
          key: 'app_name',
          value: 'Pakistani Tax Advisor',
          data_type: 'string',
          description: 'Application display name'
        },
        {
          key: 'app_version',
          value: '1.0.0',
          data_type: 'string',
          description: 'Application version'
        },
        {
          key: 'maintenance_mode',
          value: false,
          data_type: 'boolean',
          description: 'Enable maintenance mode'
        },
        {
          key: 'max_file_upload_size',
          value: 10485760,
          data_type: 'number',
          description: 'Maximum file upload size in bytes (10MB)'
        }
      ],
      'security': [
        {
          key: 'session_timeout_minutes',
          value: 480,
          data_type: 'number',
          description: 'User session timeout in minutes (8 hours)'
        },
        {
          key: 'max_login_attempts',
          value: 5,
          data_type: 'number',
          description: 'Maximum login attempts before lockout'
        },
        {
          key: 'password_min_length',
          value: 8,
          data_type: 'number',
          description: 'Minimum password length'
        },
        {
          key: 'enable_2fa',
          value: false,
          data_type: 'boolean',
          description: 'Enable two-factor authentication'
        }
      ],
      'notifications': [
        {
          key: 'email_notifications_enabled',
          value: true,
          data_type: 'boolean',
          description: 'Enable email notifications'
        },
        {
          key: 'deadline_reminder_days',
          value: 30,
          data_type: 'number',
          description: 'Days before deadline to send reminder'
        },
        {
          key: 'smtp_host',
          value: 'localhost',
          data_type: 'string',
          description: 'SMTP server host'
        },
        {
          key: 'smtp_port',
          value: 587,
          data_type: 'number',
          description: 'SMTP server port'
        }
      ],
      'backup': [
        {
          key: 'auto_backup_enabled',
          value: true,
          data_type: 'boolean',
          description: 'Enable automatic database backups'
        },
        {
          key: 'backup_frequency_hours',
          value: 24,
          data_type: 'number',
          description: 'Backup frequency in hours'
        },
        {
          key: 'backup_retention_days',
          value: 30,
          data_type: 'number',
          description: 'Number of days to retain backups'
        }
      ]
    };
    
    let settingsToReset;
    if (category && defaultSettings[category]) {
      settingsToReset = { [category]: defaultSettings[category] };
    } else {
      settingsToReset = defaultSettings;
    }
    
    const resetSettings = [];
    
    for (const [cat, settings] of Object.entries(settingsToReset)) {
      for (const setting of settings) {
        const result = await client.query(`
          INSERT INTO system_settings (
            id, category, setting_key, setting_value, data_type,
            description, is_public, created_at, updated_at,
            created_by_email, updated_by_email
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5, false, NOW(), NOW(), $6, $6
          )
          ON CONFLICT (setting_key) 
          DO UPDATE SET
            category = EXCLUDED.category,
            setting_value = EXCLUDED.setting_value,
            data_type = EXCLUDED.data_type,
            description = EXCLUDED.description,
            updated_at = NOW(),
            updated_by_email = EXCLUDED.updated_by_email
          RETURNING *
        `, [cat, setting.key, setting.value, setting.data_type, setting.description, req.admin.user_email]);
        
        resetSettings.push(result.rows[0]);
      }
    }
    
    // Log reset action
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category, ip_address, user_agent
      ) VALUES ($1, $2, 'reset_defaults', 'system_settings', $3, $4, $5, 'system_configuration', $6, $7)
    `, [
      req.admin.user_id,
      req.admin.user_email,
      'reset_action',
      'settings_reset',
      JSON.stringify({ category: category || 'all', count: resetSettings.length }),
      req.ip,
      req.headers['user-agent']
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`System settings reset to defaults (${category || 'all'}) by super admin ${req.admin.user_email}`);
    
    res.json({
      success: true,
      data: resetSettings,
      message: `${resetSettings.length} settings reset to defaults successfully`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Reset settings error:', error);
    res.status(500).json({ 
      error: 'Failed to reset settings',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Get system health status
router.get('/health/status', requireAdmin, async (req, res) => {
  try {
    const health = {
      database: { status: 'unknown', details: null },
      memory: { status: 'unknown', details: null },
      disk: { status: 'unknown', details: null },
      services: { status: 'unknown', details: null }
    };
    
    // Database health
    try {
      const dbResult = await pool.query('SELECT NOW() as current_time, version() as version');
      const connectionResult = await pool.query('SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'');
      
      health.database = {
        status: 'healthy',
        details: {
          connected: true,
          version: dbResult.rows[0].version,
          current_time: dbResult.rows[0].current_time,
          active_connections: parseInt(connectionResult.rows[0].active_connections)
        }
      };
    } catch (dbError) {
      health.database = {
        status: 'error',
        details: { error: dbError.message }
      };
    }
    
    // Memory usage
    const memUsage = process.memoryUsage();
    health.memory = {
      status: 'healthy',
      details: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
        heap_used: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
        heap_total: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
      }
    };
    
    // System uptime
    const uptime = process.uptime();
    health.services = {
      status: 'healthy',
      details: {
        uptime_seconds: Math.floor(uptime),
        uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        node_version: process.version,
        platform: process.platform
      }
    };
    
    res.json({
      success: true,
      data: health,
      message: 'System health status retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get system health error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve system health',
      message: error.message
    });
  }
});

module.exports = router;