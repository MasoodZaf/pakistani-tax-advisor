const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// User Registration
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { email, name, password, user_type = 'individual' } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    
    // Check if user already exists by email
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Check if user with same name already exists
    const existingName = await client.query(
      'SELECT id, email FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = true',
      [name]
    );

    if (existingName.rows.length > 0) {
      return res.status(409).json({
        error: 'A user with this name already exists',
        message: `A user named "${name}" already exists with email: ${existingName.rows[0].email}`,
        suggestion: 'Please use a different name or contact support if this is you'
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const userResult = await client.query(`
      INSERT INTO users (email, name, password_hash, user_type, role, is_active)
      VALUES ($1, $2, $3, $4, 'user', true)
      RETURNING id, email, name, user_type, role
    `, [email, name, passwordHash, user_type]);
    
    const newUser = userResult.rows[0];
    
    // Get current tax year
    const taxYearResult = await client.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true AND is_active = true
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }
    
    const currentTaxYear = taxYearResult.rows[0];
    
    // Create tax return for current year
    const returnResult = await client.query(`
      INSERT INTO tax_returns (
        user_id, user_email, tax_year_id, tax_year,
        return_number, filing_status, filing_type
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', 'normal')
      RETURNING id
    `, [
      newUser.id,
      newUser.email,
      currentTaxYear.id,
      currentTaxYear.tax_year,
      `TR-${newUser.id.slice(0, 8)}-${currentTaxYear.tax_year}`
    ]);
    
    const taxReturnId = returnResult.rows[0].id;
    
    // Initialize form tables for current year
    const formTables = [
      'income_forms',
      'adjustable_tax_forms',
      'reductions_forms',
      'credits_forms',
      'deductions_forms',
      'final_tax_forms',
      'capital_gain_forms',
      'expenses_forms',
      'wealth_forms',
      'form_completion_status'
    ];
    
    for (const tableName of formTables) {
      await client.query(`
        INSERT INTO ${tableName} (
          tax_return_id, user_id, user_email,
          tax_year_id, tax_year
        ) VALUES ($1, $2, $3, $4, $5)
      `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    }
    
    await client.query('COMMIT');
    
    logger.info(`User registered successfully: ${email}`);
    
    res.json({
      success: true,
      message: 'User registered successfully',
      user: newUser,
      currentTaxYear: currentTaxYear.tax_year
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  } finally {
    client.release();
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, adminBypassToken } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check for admin bypass token
    let isAdminAssisted = false;
    let adminInfo = null;
    
    if (adminBypassToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(adminBypassToken, process.env.JWT_SECRET);
        
        if (decoded.admin_assisted && decoded.user_email === email) {
          isAdminAssisted = true;
          adminInfo = {
            admin_id: decoded.admin_id,
            admin_email: decoded.admin_email
          };
          logger.info(`Admin-assisted login for ${email} by admin ${decoded.admin_email}`);
        }
      } catch (jwtError) {
        logger.warn(`Invalid admin bypass token for ${email}`);
        return res.status(401).json({ error: 'Invalid or expired admin bypass token' });
      }
    }

    if (!password && !isAdminAssisted) {
      return res.status(400).json({ error: 'Password or admin bypass token is required' });
    }
    
    logger.info(`Login attempt for: ${email}`);
    
    // Try to authenticate user (both regular and admin users are in users table)
    const user = await pool.query(`
      SELECT id, email, name, password_hash, role, user_type, permissions
      FROM users 
      WHERE email = $1 AND is_active = true
    `, [email]);
    
    logger.info(`User query returned ${user.rows.length} rows for ${email}`);
    
    if (user.rows.length === 0) {
      logger.warn(`No user found for: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const userData = user.rows[0];
    
    // Check password (skip for admin-assisted login)
    if (!isAdminAssisted) {
      logger.info(`User found, checking password for: ${email}`);
      logger.info(`Password provided length: ${password?.length}`);
      logger.info(`Hash from DB: ${userData.password_hash?.substring(0, 20)}...`);
      
      const passwordMatch = await bcrypt.compare(password, userData.password_hash);
      logger.info(`Password match result: ${passwordMatch} for ${email}`);
      
      if (!passwordMatch) {
        logger.warn(`Password mismatch for: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      logger.info(`Skipping password check for admin-assisted login: ${email}`);
    }
    
    const isAdmin = ['admin', 'super_admin'].includes(userData.role);
    logger.info(`Authentication successful for: ${email} (isAdmin: ${isAdmin})`)
    
    // Create session token
    const sessionToken = uuidv4();

    // Create JWT token for API authentication
    const jwt = require('jsonwebtoken');
    const jwtToken = jwt.sign(
      {
        userId: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Store session for ALL users (both admin and regular)
    await pool.query(`
      INSERT INTO user_sessions (
        user_id, user_email, session_token,
        ip_address, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userData.id,
      userData.email,
      sessionToken,
      req.ip,
      new Date(Date.now() + 24*60*60*1000)
    ]);
    
    // Log audit trail for all users
    try {
      const loginAction = isAdminAssisted ? 'admin_assisted_login' : 'login';
      const additionalInfo = isAdminAssisted ? 
        JSON.stringify({ admin_email: adminInfo.admin_email }) : 
        null;
      
      await pool.query(`
        INSERT INTO audit_log (
          user_id, user_email, action,
          table_name, new_value, ip_address, user_agent
        )
        VALUES ($1, $2, $3, 'users', $4, $5, $6)
      `, [
        userData.id,
        userData.email,
        loginAction,
        additionalInfo,
        req.ip,
        req.headers['user-agent']
      ]);
    } catch (auditError) {
      // Don't fail login if audit log fails
      logger.warn('Audit log failed:', auditError.message);
    }
    
    // Get tax years summary for regular users
    let taxYearsSummary = [];
    let currentYearData = null;
    let hasPersonalInfo = false;

    if (!isAdmin) {
      taxYearsSummary = await pool.query(`
        SELECT
          ty.tax_year,
          ty.is_current,
          tr.id as tax_return_id,
          tr.filing_status,
          tr.return_number,
          fcs.completion_percentage,
          tc.total_tax_liability,
          tc.refund_due,
          tc.additional_tax_due
        FROM tax_years ty
        LEFT JOIN tax_returns tr ON ty.id = tr.tax_year_id AND tr.user_id = $1
        LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
        LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true
        WHERE ty.is_active = true
        ORDER BY ty.tax_year DESC
      `, [userData.id]);

      const currentYearResult = await pool.query(`
        SELECT
          tr.id as tax_return_id,
          tr.tax_year,
          tr.filing_status,
          tr.return_number,
          fcs.completion_percentage,
          tc.total_tax_liability,
          tc.refund_due,
          tc.additional_tax_due
        FROM tax_returns tr
        JOIN tax_years ty ON tr.tax_year_id = ty.id
        LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
        LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true
        WHERE tr.user_id = $1 AND ty.is_current = true
      `, [userData.id]);

      currentYearData = currentYearResult.rows[0] || null;

      // Check if user has completed personal information
      const personalInfoCheck = await pool.query(`
        SELECT id FROM personal_information
        WHERE user_id = $1 AND tax_year = (
          SELECT tax_year FROM tax_years WHERE is_current = true LIMIT 1
        )
      `, [userData.id]);

      hasPersonalInfo = personalInfoCheck.rows.length > 0;
    }
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        user_type: userData.user_type,
        permissions: userData.permissions || null
      },
      taxYearsSummary: taxYearsSummary.rows || [],
      currentYearData: currentYearData,
      hasPersonalInfo: hasPersonalInfo,
      sessionToken,
      token: jwtToken,
      isAdmin
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (sessionToken) {
      await pool.query(
        'DELETE FROM user_sessions WHERE session_token = $1',
        [sessionToken]
      );
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Verify session
router.post('/verify-session', async (req, res) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    // Validate session token format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionToken)) {
      return res.status(401).json({ error: 'Invalid session token format' });
    }

    const session = await pool.query(`
      SELECT us.*, u.email, u.name, u.role, u.user_type
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const sessionData = session.rows[0];

    // Update session last_accessed timestamp for security tracking
    await pool.query(`
      UPDATE user_sessions
      SET last_accessed_at = NOW()
      WHERE session_token = $1
    `, [sessionToken]);

    res.json({
      success: true,
      user: {
        id: sessionData.user_id,
        email: sessionData.email,
        name: sessionData.name,
        role: sessionData.role,
        user_type: sessionData.user_type
      }
    });

  } catch (error) {
    logger.error('Session verification error:', error);
    res.status(500).json({ error: 'Session verification failed' });
  }
});

// Debug endpoint to test admin user query
router.get('/debug-admin/:email', async (req, res) => {
  try {
    const { email } = req.params;

    logger.debug('Testing admin query', { email });

    // First check database name and connection info
    const dbInfo = await pool.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()');
    logger.debug('Database info', dbInfo.rows[0]);

    // Check if admin_users table exists and has data
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count FROM admin_users
    `);
    logger.debug('Total admin_users count', { count: tableCheck.rows[0].count });

    // Check specific admin user
    const directCheck = await pool.query(`
      SELECT id, email, username, is_active FROM admin_users WHERE email = $1
    `, [email]);
    logger.debug('Direct admin_users query', { rowCount: directCheck.rows.length });
    if (directCheck.rows.length > 0) {
      logger.debug('Direct admin data', directCheck.rows[0]);
    }

    // Now try the join query
    const adminUser = await pool.query(`
      SELECT
        au.id,
        au.email,
        au.username as name,
        au.password_hash,
        r.name as role,
        r.permissions,
        'admin' as user_type
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.email = $1 AND au.is_active = true
    `, [email]);

    logger.debug('Join query result', { rowCount: adminUser.rows.length });
    
    res.json({
      success: true,
      database: dbInfo.rows[0],
      totalAdminUsers: tableCheck.rows[0].count,
      directQueryRows: directCheck.rows.length,
      joinQueryRows: adminUser.rows.length,
      directData: directCheck.rows[0] || null,
      joinData: adminUser.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        user_type: row.user_type,
        hasPasswordHash: !!row.password_hash
      }))
    });
    
  } catch (error) {
    logger.error('Error in admin query', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message });
  }
});

// Change Password endpoint
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 8 characters long' 
      });
    }
    
    // Get user from session token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required' 
      });
    }
    
    const sessionToken = authHeader.substring(7);
    
    // Verify session and get user
    const sessionResult = await pool.query(`
      SELECT us.user_id, us.user_email, u.password_hash, u.name
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired session' 
      });
    }
    
    const user = sessionResult.rows[0];
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isCurrentPasswordValid) {
      logger.info(`Failed password change attempt for ${user.user_email} - incorrect current password`);
      return res.status(400).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in database
    await pool.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [hashedNewPassword, user.user_id]);
    
    // Log audit trail
    try {
      await pool.query(`
        INSERT INTO audit_log (
          user_id, user_email, action,
          table_name, field_name, new_value,
          ip_address, user_agent
        )
        VALUES ($1, $2, 'password_change', 'users', 'password_hash', 'Password changed', $3, $4)
      `, [
        user.user_id,
        user.user_email,
        req.ip,
        req.headers['user-agent']
      ]);
    } catch (auditError) {
      logger.warn('Audit log failed for password change:', auditError.message);
    }
    
    logger.info(`Password changed successfully for user: ${user.user_email}`);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'An error occurred while changing password'
    });
  }
});

module.exports = router;