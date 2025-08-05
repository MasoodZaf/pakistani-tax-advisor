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
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
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
      sessionToken,
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
    
    const session = await pool.query(`
      SELECT us.*, u.email, u.name, u.role, u.user_type
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW()
    `, [sessionToken]);
    
    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const sessionData = session.rows[0];
    
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
    
    console.log(`DEBUG: Testing admin query for ${email}`);
    
    // First check database name and connection info
    const dbInfo = await pool.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()');
    console.log('DEBUG: Database info:', dbInfo.rows[0]);
    
    // Check if admin_users table exists and has data
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count FROM admin_users
    `);
    console.log(`DEBUG: Total admin_users count: ${tableCheck.rows[0].count}`);
    
    // Check specific admin user
    const directCheck = await pool.query(`
      SELECT id, email, username, is_active FROM admin_users WHERE email = $1
    `, [email]);
    console.log(`DEBUG: Direct admin_users query returned ${directCheck.rows.length} rows`);
    if (directCheck.rows.length > 0) {
      console.log('DEBUG: Direct admin data:', directCheck.rows[0]);
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
    
    console.log(`DEBUG: Join query returned ${adminUser.rows.length} rows`);
    
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
    console.error('DEBUG: Error in admin query:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;