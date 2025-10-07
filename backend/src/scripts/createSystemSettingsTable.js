const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function createSystemSettingsTable() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create system_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category VARCHAR(100) NOT NULL,
        setting_key VARCHAR(255) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        data_type VARCHAR(50) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'date')),
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by_email VARCHAR(255),
        updated_by_email VARCHAR(255)
      )
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public)
    `);
    
    // Insert default system settings
    const defaultSettings = [
      ['tax_calculation', 'default_tax_year', '2025-26', 'string', 'Default tax year for new tax returns'],
      ['tax_calculation', 'minimum_taxable_income', '600000', 'number', 'Minimum taxable income threshold'],
      ['tax_calculation', 'enable_advance_tax_calculation', 'true', 'boolean', 'Enable advance tax calculation features'],
      ['application', 'app_name', 'Pakistani Tax Advisor', 'string', 'Application display name'],
      ['application', 'app_version', '1.0.0', 'string', 'Application version'],
      ['application', 'maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'],
      ['application', 'max_file_upload_size', '10485760', 'number', 'Maximum file upload size in bytes (10MB)'],
      ['security', 'session_timeout_minutes', '480', 'number', 'User session timeout in minutes (8 hours)'],
      ['security', 'max_login_attempts', '5', 'number', 'Maximum login attempts before lockout'],
      ['security', 'password_min_length', '8', 'number', 'Minimum password length'],
      ['security', 'enable_2fa', 'false', 'boolean', 'Enable two-factor authentication'],
      ['notifications', 'email_notifications_enabled', 'true', 'boolean', 'Enable email notifications'],
      ['notifications', 'deadline_reminder_days', '30', 'number', 'Days before deadline to send reminder'],
      ['notifications', 'smtp_host', 'localhost', 'string', 'SMTP server host'],
      ['notifications', 'smtp_port', '587', 'number', 'SMTP server port'],
      ['backup', 'auto_backup_enabled', 'true', 'boolean', 'Enable automatic database backups'],
      ['backup', 'backup_frequency_hours', '24', 'number', 'Backup frequency in hours'],
      ['backup', 'backup_retention_days', '30', 'number', 'Number of days to retain backups']
    ];
    
    for (const [category, setting_key, setting_value, data_type, description] of defaultSettings) {
      await client.query(`
        INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, created_by_email, updated_by_email)
        VALUES ($1, $2, $3, $4, $5, 'system@paktaxadvisor.com', 'system@paktaxadvisor.com')
        ON CONFLICT (setting_key) DO NOTHING
      `, [category, setting_key, setting_value, data_type, description]);
    }
    
    await client.query('COMMIT');

    logger.info('System settings table created successfully with default values');

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating system settings table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script if called directly
if (require.main === module) {
  createSystemSettingsTable()
    .then(() => {
      logger.info('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed', { error: error.message, stack: error.stack });
      process.exit(1);
    });
}

module.exports = createSystemSettingsTable;