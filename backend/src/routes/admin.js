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

// Get all users (admin only)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (search) {
      whereClause += ` AND (email ILIKE $${queryParams.length + 1} OR name ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }
    
    const result = await pool.query(`
      SELECT 
        id, email, name, user_type, role, is_active,
        created_at, last_login_at,
        (SELECT COUNT(*) FROM tax_returns WHERE user_id = users.id) as tax_returns_count
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);
    
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `, queryParams);
    
    const total = parseInt(countResult.rows[0].total);

    // Set no-cache headers to ensure fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Users retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve users',
      message: error.message
    });
  }
});

// Get system statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {};
    
    // User statistics
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE role = 'admin' OR role = 'super_admin') as admin_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
        COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days') as active_users_7d
      FROM users
    `);
    stats.users = userStats.rows[0];
    
    // Tax returns statistics
    const taxReturnStats = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        COUNT(*) FILTER (WHERE filing_status = 'submitted') as submitted_returns,
        COUNT(*) FILTER (WHERE filing_status = 'draft') as draft_returns,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_returns_30d
      FROM tax_returns
    `);
    stats.taxReturns = taxReturnStats.rows[0];
    
    // Tax years statistics
    const taxYearStats = await pool.query(`
      SELECT 
        COUNT(*) as total_tax_years,
        COUNT(*) FILTER (WHERE is_current = true) as current_tax_years,
        COUNT(*) FILTER (WHERE is_active = true) as active_tax_years
      FROM tax_years
    `);
    stats.taxYears = taxYearStats.rows[0];
    
    // Organizations statistics
    const orgStats = await pool.query(`
      SELECT 
        COUNT(*) as total_organizations,
        COUNT(*) FILTER (WHERE is_active = true) as active_organizations
      FROM organizations
    `);
    stats.organizations = orgStats.rows[0];
    
    // Recent activity
    const recentActivity = await pool.query(`
      SELECT 
        action, table_name, COUNT(*) as count,
        MAX(created_at) as last_action
      FROM audit_log 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY action, table_name
      ORDER BY last_action DESC
      LIMIT 10
    `);
    stats.recentActivity = recentActivity.rows;
    
    res.json({
      success: true,
      data: stats,
      message: 'System statistics retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve system statistics',
      message: error.message
    });
  }
});

// Get all tax years
router.get('/tax-years', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, tax_year, is_current, is_active,
        start_date, end_date, filing_deadline, created_at,
        (SELECT COUNT(*) FROM tax_returns WHERE tax_year_id = tax_years.id) as returns_count,
        (SELECT COUNT(*) FROM tax_slabs WHERE tax_year_id = tax_years.id) as slabs_count
      FROM tax_years 
      ORDER BY tax_year DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      message: 'Tax years retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get tax years error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve tax years',
      message: error.message
    });
  }
});

// Update tax year status
router.put('/tax-years/:id/status', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { isActive, isCurrent } = req.body;
    
    // If setting as current, unset all other current tax years
    if (isCurrent) {
      await client.query(`
        UPDATE tax_years SET is_current = false WHERE id != $1
      `, [id]);
    }
    
    // Update the tax year
    const result = await client.query(`
      UPDATE tax_years 
      SET is_active = $1, is_current = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [isActive, isCurrent, id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Tax year not found',
        message: `Tax year with ID ${id} does not exist`
      });
    }
    
    // Log the change
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category
      ) VALUES ($1, $2, 'update', 'tax_years', $3, $4, $5, $6)
    `, [
      req.admin.user_id, req.admin.user_email, id,
      'status_update', JSON.stringify({ isActive, isCurrent }),
      'tax_year_status_update'
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`Tax year ${result.rows[0].tax_year} status updated by admin ${req.admin.user_email}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Tax year status updated successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Update tax year status error:', error);
    res.status(500).json({ 
      error: 'Failed to update tax year status',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Create new tax year
router.post('/tax-years', requireAdmin, async (req, res) => {
  try {
    const { taxYear, startDate, endDate, filingDeadline, isCurrent } = req.body;
    
    if (!taxYear) {
      return res.status(400).json({ 
        error: 'Tax year is required'
      });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // If setting as current, unset all other current tax years
      if (isCurrent) {
        await client.query('UPDATE tax_years SET is_current = false');
      }
      
      const result = await client.query(`
        INSERT INTO tax_years (
          tax_year, start_date, end_date, 
          filing_deadline, is_current, is_active
        ) VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `, [taxYear, startDate, endDate, filingDeadline, isCurrent || false]);
      
      // Log the creation
      await client.query(`
        INSERT INTO audit_log (
          user_id, user_email, action, table_name, record_id,
          field_name, new_value, category
        ) VALUES ($1, $2, 'create', 'tax_years', $3, $4, $5, $6)
      `, [
        req.admin.user_id, req.admin.user_email, result.rows[0].id,
        'tax_year_creation', JSON.stringify(result.rows[0]),
        'tax_year_management'
      ]);
      
      await client.query('COMMIT');
      
      logger.info(`New tax year ${taxYear} created by admin ${req.admin.user_email}`);
      
      res.json({
        success: true,
        data: result.rows[0],
        message: 'Tax year created successfully'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Create tax year error:', error);
    res.status(500).json({ 
      error: 'Failed to create tax year',
      message: error.message
    });
  }
});

// Update user status (activate/deactivate)
router.put('/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const result = await pool.query(`
      UPDATE users 
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, name, is_active
    `, [isActive, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: `User with ID ${id} does not exist`
      });
    }
    
    // Log the change
    await pool.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category
      ) VALUES ($1, $2, 'update', 'users', $3, $4, $5, $6)
    `, [
      req.admin.user_id, req.admin.user_email, id,
      'user_status_update', JSON.stringify({ isActive }),
      'user_management'
    ]);
    
    logger.info(`User ${result.rows[0].email} status updated by admin ${req.admin.user_email}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
    
  } catch (error) {
    logger.error('Update user status error:', error);
    res.status(500).json({ 
      error: 'Failed to update user status',
      message: error.message
    });
  }
});

// Get audit logs
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, table_name, action, user_email } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (table_name) {
      whereClause += ` AND table_name = $${queryParams.length + 1}`;
      queryParams.push(table_name);
    }
    
    if (action) {
      whereClause += ` AND action = $${queryParams.length + 1}`;
      queryParams.push(action);
    }
    
    if (user_email) {
      whereClause += ` AND user_email ILIKE $${queryParams.length + 1}`;
      queryParams.push(`%${user_email}%`);
    }
    
    const result = await pool.query(`
      SELECT 
        id, user_id, user_email, action, table_name, record_id,
        field_name, old_value, new_value, ip_address, user_agent,
        category, created_at
      FROM audit_log 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `, [...queryParams, limit, offset]);
    
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM audit_log ${whereClause}
    `, queryParams);
    
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      message: 'Audit logs retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve audit logs',
      message: error.message
    });
  }
});

// Create new user (Super Admin only)
router.post('/users', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if requester is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Super admin privileges required'
      });
    }
    
    const { email, name, password, role = 'user', user_type = 'individual' } = req.body;
    
    if (!email || !name || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Email, name, and password are required'
      });
    }
    
    // Check if user already exists by email
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
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
        suggestion: 'Please use a different name or contact support if this is the same person'
      });
    }
    
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const userResult = await client.query(`
      INSERT INTO users (
        id, email, name, password_hash, user_type, role, 
        is_active, created_at, updated_at
      )
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, true, NOW(), NOW())
      RETURNING id, email, name, user_type, role, is_active, created_at
    `, [email, name, passwordHash, user_type, role]);
    
    const newUser = userResult.rows[0];
    
    // Create tax return for current year if it's a regular user
    if (role === 'user') {
      const taxYearResult = await client.query(`
        SELECT id, tax_year FROM tax_years WHERE is_current = true AND is_active = true
      `);
      
      if (taxYearResult.rows.length > 0) {
        const currentTaxYear = taxYearResult.rows[0];
        
        const returnResult = await client.query(`
          INSERT INTO tax_returns (
            id, user_id, user_email, tax_year_id, tax_year,
            return_number, filing_status, filing_type, created_at
          )
          VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5, 'draft', 'normal', NOW()
          )
          RETURNING id
        `, [
          newUser.id,
          newUser.email,
          currentTaxYear.id,
          currentTaxYear.tax_year,
          `TR-${newUser.id.slice(0, 8)}-${currentTaxYear.tax_year}`
        ]);
        
        // Initialize form tables
        const taxReturnId = returnResult.rows[0].id;
        const formTables = [
          'income_forms', 'adjustable_tax_forms', 'reductions_forms',
          'credits_forms', 'deductions_forms', 'final_tax_forms',
          'capital_gain_forms', 'expenses_forms', 'wealth_forms',
          'form_completion_status'
        ];
        
        for (const tableName of formTables) {
          await client.query(`
            INSERT INTO ${tableName} (
              id, tax_return_id, user_id, user_email,
              tax_year_id, tax_year, created_at
            ) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW())
          `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
        }
      }
    }
    
    // Log audit trail
    try {
      await client.query(`
        INSERT INTO audit_log (
          user_id, user_email, action, table_name, record_id,
          ip_address, user_agent, created_at
        )
        VALUES ($1, $2, 'create', 'users', $3, $4, $5, NOW())
      `, [
        req.admin.user_id,
        req.admin.user_email,
        newUser.id,
        req.ip,
        req.headers['user-agent']
      ]);
    } catch (auditError) {
      logger.warn('Audit log failed:', auditError.message);
    }
    
    await client.query('COMMIT');
    
    logger.info(`User created by admin: ${email}`);
    
    res.json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create user error:', error);
    res.status(500).json({ 
      error: 'Failed to create user',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Update user (Admin can edit users, Super Admin can edit everything)
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, user_type, is_active } = req.body;
    
    // Check permissions
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }
    
    const targetUser = userResult.rows[0];
    
    // Regular admin cannot edit other admins
    if (req.admin.role === 'admin' && ['admin', 'super_admin'].includes(targetUser.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Cannot edit admin users'
      });
    }
    
    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    
    if (role !== undefined && req.admin.role === 'super_admin') {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    
    if (user_type !== undefined) {
      updates.push(`user_type = $${paramCount++}`);
      values.push(user_type);
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'No updates provided',
        message: 'At least one field must be updated'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const updateResult = await pool.query(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, user_type, role, is_active, updated_at
    `, values);
    
    const updatedUser = updateResult.rows[0];
    
    // Log audit trail
    try {
      await pool.query(`
        INSERT INTO audit_log (
          user_id, user_email, action, table_name, record_id,
          ip_address, user_agent, created_at
        )
        VALUES ($1, $2, 'update', 'users', $3, $4, $5, NOW())
      `, [
        req.admin.user_id,
        req.admin.user_email,
        updatedUser.id,
        req.ip,
        req.headers['user-agent']
      ]);
    } catch (auditError) {
      logger.warn('Audit log failed:', auditError.message);
    }
    
    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });
    
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ 
      error: 'Failed to update user',
      message: error.message
    });
  }
});

// Delete user (Super Admin only)
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if requester is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Super admin privileges required'
      });
    }

    const { id } = req.params;

    // Check if user exists
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    const targetUser = userResult.rows[0];

    // Cannot delete super admin users
    if (targetUser.role === 'super_admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Cannot delete super admin users'
      });
    }

    // Cannot delete self
    if (targetUser.id === req.admin.user_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Cannot delete your own account'
      });
    }

    // SIMPLE CASCADE DELETE - Database constraints handle all related data
    logger.info(`Deleting user with CASCADE constraints: ${targetUser.email}`);

    // Single DELETE operation - CASCADE constraints handle all related data automatically
    const userDeleteResult = await client.query(`DELETE FROM users WHERE id = $1`, [id]);

    if (userDeleteResult.rowCount === 0) {
      throw new Error('User deletion failed - no rows affected');
    }

    logger.info(`User deleted successfully: ${targetUser.email}`);

    // Log audit trail (this will work since the user is deleted but audit can still log to NULL user_id)
    try {
      await client.query(`
        INSERT INTO audit_log (
          user_id, user_email, action, table_name, record_id,
          ip_address, user_agent, created_at
        )
        VALUES ($1, $2, 'delete', 'users', $3, $4, $5, NOW())
      `, [
        req.admin.user_id,
        req.admin.user_email,
        targetUser.id,
        req.ip,
        req.headers['user-agent']
      ]);
    } catch (auditError) {
      logger.warn('Audit log failed:', auditError.message);
    }

    await client.query('COMMIT');

    logger.info(`User completely deleted by admin: ${targetUser.email} (CASCADE constraints handled all related data)`);

    res.json({
      success: true,
      message: `User "${targetUser.name}" and all related data deleted successfully`,
      deletedUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Get single user details (Admin only)
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const userResult = await pool.query(`
      SELECT 
        id, email, name, user_type, role, is_active,
        created_at, updated_at, last_login_at,
        (SELECT COUNT(*) FROM tax_returns WHERE user_id = users.id) as tax_returns_count,
        (SELECT COUNT(*) FROM user_sessions WHERE user_id = users.id AND expires_at > NOW()) as active_sessions_count
      FROM users 
      WHERE id = $1
    `, [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }
    
    const user = userResult.rows[0];
    
    // Get recent activity
    const activityResult = await pool.query(`
      SELECT action, table_name, created_at
      FROM audit_log 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);
    
    user.recent_activity = activityResult.rows;
    
    res.json({
      success: true,
      data: user,
      message: 'User details retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user',
      message: error.message
    });
  }
});

// Tax Calculator endpoint for admin
router.post('/tax-calculator', requireAdmin, async (req, res) => {
  try {
    const { income, allowances = 0, tax_year = '2025-26' } = req.body;
    
    if (!income || income < 0) {
      return res.status(400).json({ 
        error: 'Valid income amount is required' 
      });
    }
    
    // Get tax slabs for the specified year
    const taxYearResult = await pool.query(
      'SELECT id FROM tax_years WHERE tax_year = $1 AND is_active = true',
      [tax_year]
    );
    
    if (taxYearResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Tax year not found or inactive' 
      });
    }
    
    const taxYearId = taxYearResult.rows[0].id;
    
    // Get tax slabs
    const taxSlabsResult = await pool.query(`
      SELECT min_income, max_income, tax_rate, fixed_amount
      FROM tax_slabs 
      WHERE tax_year_id = $1 
      ORDER BY min_income ASC
    `, [taxYearId]);
    
    const taxSlabs = taxSlabsResult.rows;
    
    if (taxSlabs.length === 0) {
      return res.status(404).json({ 
        error: 'No tax slabs found for this tax year' 
      });
    }
    
    // Calculate tax
    const taxableIncome = Math.max(0, income - allowances);
    let totalTax = 0;
    let taxBreakdown = [];
    
    for (const slab of taxSlabs) {
      const slabMin = parseFloat(slab.min_income);
      const slabMax = slab.max_income ? parseFloat(slab.max_income) : Infinity;
      const taxRate = parseFloat(slab.tax_rate); // Already in decimal form (0.05 for 5%)
      const fixedAmount = parseFloat(slab.fixed_amount || 0);
      
      if (taxableIncome > slabMin) {
        const taxableAtThisSlab = Math.min(taxableIncome, slabMax) - slabMin;
        const taxAtThisSlab = (taxableAtThisSlab * taxRate) + fixedAmount; // No need to divide by 100
        
        if (taxableAtThisSlab > 0) {
          totalTax += taxAtThisSlab;
          taxBreakdown.push({
            range: `${slabMin.toLocaleString()} - ${slabMax === Infinity ? 'Above' : slabMax.toLocaleString()}`,
            rate: `${(taxRate * 100).toFixed(1)}%`, // Convert back to percentage for display
            taxable_amount: taxableAtThisSlab,
            tax_amount: taxAtThisSlab,
            fixed_amount: fixedAmount
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        gross_income: income,
        allowances: allowances,
        taxable_income: taxableIncome,
        total_tax: Math.round(totalTax),
        net_income: Math.round(taxableIncome - totalTax),
        effective_tax_rate: taxableIncome > 0 ? ((totalTax / taxableIncome) * 100).toFixed(2) : 0,
        tax_year: tax_year,
        breakdown: taxBreakdown
      },
      message: 'Tax calculation completed successfully'
    });
    
  } catch (error) {
    logger.error('Tax calculator error:', error);
    res.status(500).json({ 
      error: 'Failed to calculate tax',
      message: error.message
    });
  }
});

// Get user tax records for admin
router.get('/users/:id/tax-records', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user details
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }
    
    const user = userResult.rows[0];
    
    // Get all tax returns for this user
    const taxReturnsResult = await pool.query(`
      SELECT 
        tr.id, tr.tax_year, tr.return_number, tr.filing_status,
        tr.created_at, tr.updated_at, tr.submission_date,
        ty.is_current,
        fcs.completion_percentage, fcs.all_forms_complete,
        COALESCE(ftf.total_final_tax, 0) as total_tax_liability, 
        0 as refund_due, 0 as additional_tax_due
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
      LEFT JOIN final_tax_forms ftf ON tr.id = ftf.tax_return_id
      WHERE tr.user_id = $1
      ORDER BY tr.tax_year DESC
    `, [id]);
    
    const taxReturns = taxReturnsResult.rows;
    
    // Get current year detailed forms data
    let currentYearForms = null;
    const currentReturn = taxReturns.find(tr => tr.is_current);
    
    if (currentReturn) {
      // Get all form data for current year separately
      const incomeData = await pool.query(`
        SELECT 
          'income' as form_type,
          COALESCE(monthly_salary, 0) as salary_income,
          COALESCE(other_sources, 0) as other_income,
          COALESCE(grand_total, 0) as total_income,
          'N/A' as employer_name
        FROM income_forms inf
        WHERE tax_return_id = $1
      `, [currentReturn.id]);

      const deductionsData = await pool.query(`
        SELECT 
          'deductions' as form_type,
          COALESCE(zakat, 0) as zakat_paid,
          COALESCE(other_deductions, 0) as other_deductions,
          COALESCE(advance_tax, 0) as advance_tax,
          COALESCE(total_deductions, 0) as total_deductions
        FROM deductions_forms 
        WHERE tax_return_id = $1
      `, [currentReturn.id]);

      const finalTaxData = await pool.query(`
        SELECT 
          'final_tax' as form_type,
          COALESCE(total_final_tax, 0) as total_tax_liability,
          COALESCE(debt_tax_amount, 0) as advance_tax_paid,
          0 as withholding_tax,
          0 as refund_due,
          0 as additional_tax_due
        FROM final_tax_forms 
        WHERE tax_return_id = $1
      `, [currentReturn.id]);

      const formsData = {
        rows: [
          ...incomeData.rows,
          ...deductionsData.rows,
          ...finalTaxData.rows
        ]
      };
      
      currentYearForms = formsData.rows;
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          user_type: user.user_type,
          created_at: user.created_at
        },
        tax_returns: taxReturns,
        current_year_forms: currentYearForms,
        summary: {
          total_returns: taxReturns.length,
          completed_returns: taxReturns.filter(tr => tr.filing_status === 'submitted').length,
          draft_returns: taxReturns.filter(tr => tr.filing_status === 'draft').length,
          current_year_completion: currentReturn?.completion_percentage || 0
        }
      },
      message: 'User tax records retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Get user tax records error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user tax records',
      message: error.message
    });
  }
});

// Update user tax form data (admin as tax consultant)
router.put('/users/:userId/tax-forms/:formType', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId, formType } = req.params;
    const formData = req.body;
    
    // Validate user exists
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get current tax return
    const taxReturnResult = await client.query(`
      SELECT tr.id FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      WHERE tr.user_id = $1 AND ty.is_current = true
    `, [userId]);
    
    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({ error: 'No current tax return found for user' });
    }
    
    const taxReturnId = taxReturnResult.rows[0].id;
    
    // Update appropriate form table based on formType
    let updateResult;
    
    switch (formType) {
      case 'income':
        updateResult = await client.query(`
          UPDATE income_forms 
          SET 
            monthly_salary = $1,
            other_sources = $2,
            total_gross_income = $3,
            updated_at = NOW()
          WHERE tax_return_id = $4
          RETURNING *
        `, [
          (formData.salary_income || 0) / 12, // Convert annual to monthly
          formData.other_income || 0,
          formData.total_income || 0,
          taxReturnId
        ]);
        break;
        
      case 'deductions':
        updateResult = await client.query(`
          UPDATE deductions_forms 
          SET 
            zakat = $1,
            other_deductions = $2,
            advance_tax = $3,
            total_deductions = $4,
            updated_at = NOW()
          WHERE tax_return_id = $5
          RETURNING *
        `, [
          formData.zakat_paid || 0,
          formData.other_deductions || 0,
          formData.advance_tax || 0,
          formData.total_deductions || 0,
          taxReturnId
        ]);
        break;
        
      case 'final_tax':
        updateResult = await client.query(`
          UPDATE final_tax_forms 
          SET 
            total_final_tax = $1,
            debt_tax_amount = $2,
            updated_at = NOW()
          WHERE tax_return_id = $3
          RETURNING *
        `, [
          formData.total_tax_liability || 0,
          formData.advance_tax_paid || 0,
          taxReturnId
        ]);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid form type' });
    }
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    // Log admin action
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category, ip_address, user_agent
      ) VALUES ($1, $2, 'update', $3, $4, $5, $6, $7, $8, $9)
    `, [
      req.admin.user_id,
      req.admin.user_email,
      `${formType}_forms`,
      taxReturnId,
      'admin_tax_form_edit',
      JSON.stringify(formData),
      'tax_consultant_service',
      req.ip,
      req.headers['user-agent']
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`Admin ${req.admin.user_email} updated ${formType} form for user ${userId}`);
    
    res.json({
      success: true,
      data: updateResult.rows[0],
      message: `${formType} form updated successfully by tax consultant`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Update user tax form error:', error);
    res.status(500).json({ 
      error: 'Failed to update tax form',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// Get all users with login credentials (Super Admin only)
router.get('/user-credentials', requireAdmin, async (req, res) => {
  try {
    // Check if user is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only super admin can access user credentials' 
      });
    }

    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.user_type,
        u.is_active,
        u.created_at,
        u.last_login_at,
        COUNT(tr.id) as total_tax_returns,
        COALESCE(fcs.completion_percentage, 0) as completion_percentage
      FROM users u
      LEFT JOIN tax_returns tr ON u.id = tr.user_id
      LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
      WHERE u.role != 'super_admin'
      GROUP BY u.id, u.name, u.email, u.role, u.user_type, u.is_active, u.created_at, u.last_login_at, fcs.completion_percentage
      ORDER BY u.created_at DESC
    `);

    // Log super admin access (temporarily disabled for testing)
    // TODO: Fix audit logging - req.admin object structure issue

    logger.info(`Super admin ${req.admin.user_email || req.admin.name} accessed user credentials list`);

    res.json({
      success: true,
      data: result.rows,
      message: 'User credentials retrieved successfully'
    });

  } catch (error) {
    logger.error('Get user credentials error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user credentials',
      message: error.message
    });
  }
});

// Get user login credentials for manual login (Super Admin only)
router.get('/user-login-credentials/:userId', requireAdmin, async (req, res) => {
  try {
    // Check if user is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only super admin can access user login credentials' 
      });
    }

    const { userId } = req.params;

    // Get target user details
    const userResult = await pool.query(`
      SELECT id, name, email, role, user_type, is_active, created_at
      FROM users 
      WHERE id = $1 AND role != 'super_admin'
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Target user does not exist'
      });
    }

    const targetUser = userResult.rows[0];

    if (!targetUser.is_active) {
      return res.status(400).json({ 
        error: 'User inactive',
        message: 'Cannot get credentials for inactive user'
      });
    }

    // Create a temporary admin bypass token for this user
    const tempToken = jwt.sign(
      {
        user_id: targetUser.id,
        user_email: targetUser.email,
        admin_assisted: true,
        admin_id: req.admin.user_id,
        admin_email: req.admin.user_email,
        exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes only
      },
      process.env.JWT_SECRET
    );

    const loginCredentials = {
      email: targetUser.email,
      tempBypassToken: tempToken, // This will allow admin-assisted login
      name: targetUser.name,
      role: targetUser.role,
      user_type: targetUser.user_type,
      message: 'Email pre-filled. Use admin bypass or reset password if needed.',
      expiresIn: 600 // 10 minutes
    };

    logger.info(`Super admin ${req.admin.user_email} accessed login credentials for user ${targetUser.email}`);

    // Optional: Invalidate admin session to force clean logout
    // This ensures the admin is automatically logged out when impersonating
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        await pool.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
        logger.info(`Admin session invalidated for user impersonation: ${req.admin.user_email}`);
      }
    } catch (sessionError) {
      logger.warn('Failed to invalidate admin session:', sessionError.message);
      // Don't fail the request if session cleanup fails
    }

    res.json({
      success: true,
      data: loginCredentials,
      message: 'User login credentials retrieved successfully'
    });

  } catch (error) {
    logger.error('Get user login credentials error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user login credentials',
      message: error.message
    });
  }
});

// Impersonate user (Super Admin only)
router.post('/impersonate/:userId', requireAdmin, async (req, res) => {
  try {
    // Check if user is super admin
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only super admin can impersonate users' 
      });
    }

    const { userId } = req.params;
    const { returnUrl } = req.body;

    // Get target user details
    const userResult = await pool.query(`
      SELECT id, name, email, role, user_type, is_active
      FROM users 
      WHERE id = $1 AND role != 'super_admin'
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'Target user does not exist or cannot be impersonated'
      });
    }

    const targetUser = userResult.rows[0];

    if (!targetUser.is_active) {
      return res.status(400).json({ 
        error: 'User inactive',
        message: 'Cannot impersonate inactive user'
      });
    }

    // Create impersonation session token
    const impersonationToken = jwt.sign(
      {
        user_id: targetUser.id,
        user_email: targetUser.email,
        user_name: targetUser.name,
        user_role: targetUser.role,
        user_type: targetUser.user_type,
        impersonated_by: req.admin.user_id,
        impersonated_by_email: req.admin.user_email,
        is_impersonation: true,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      process.env.JWT_SECRET
    );

    // Log impersonation start (temporarily disabled)
    // TODO: Fix audit logging - req.admin object structure issue
    /*
    await pool.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category, ip_address, user_agent
      ) VALUES ($1, $2, 'impersonate_start', 'users', $3, $4, $5, $6, $7, $8)
    `, [
      req.admin.user_id,
      req.admin.user_email,
      targetUser.id,
      'user_impersonation',
      JSON.stringify({
        target_user: targetUser.email,
        target_user_name: targetUser.name,
        return_url: returnUrl
      }),
      'super_admin_impersonation',
      req.ip,
      req.headers['user-agent']
    ]);
    */

    logger.info(`Super admin ${req.admin.user_email} started impersonating user ${targetUser.email}`);

    res.json({
      success: true,
      data: {
        impersonationToken,
        targetUser: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          user_type: targetUser.user_type
        },
        impersonatedBy: {
          id: req.admin.user_id,
          name: req.admin.name,
          email: req.admin.user_email
        },
        expiresIn: 24 * 60 * 60 // 24 hours in seconds
      },
      message: `Successfully impersonating ${targetUser.name}`
    });

  } catch (error) {
    logger.error('Impersonate user error:', error);
    res.status(500).json({ 
      error: 'Failed to impersonate user',
      message: error.message
    });
  }
});

// Test route to verify no middleware interference
router.post('/test-end-impersonation', async (req, res) => {
  res.json({ success: true, message: 'Route works without middleware' });
});

// End impersonation (return to admin)
router.post('/end-impersonation', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    console.log('Received token for end-impersonation:', token.substring(0, 50) + '...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    if (!decoded.is_impersonation) {
      return res.status(400).json({ 
        error: 'Not in impersonation mode',
        message: 'Cannot end impersonation - not currently impersonating'
      });
    }

    // Get admin user details
    const adminResult = await pool.query(`
      SELECT id, name, email, role, user_type, is_active
      FROM users 
      WHERE id = $1 AND role IN ('admin', 'super_admin')
    `, [decoded.impersonated_by]);

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const adminUser = adminResult.rows[0];

    // Create new admin session token
    const adminToken = jwt.sign(
      {
        user_id: adminUser.id,
        user_email: adminUser.email,
        user_name: adminUser.name,
        user_role: adminUser.role,
        user_type: adminUser.user_type,
        is_admin: true,
        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours
      },
      process.env.JWT_SECRET
    );

    // Log impersonation end (temporarily disabled)
    // TODO: Fix audit logging - req.admin object structure issue
    /*
    await pool.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category, ip_address, user_agent
      ) VALUES ($1, $2, 'impersonate_end', 'users', $3, $4, $5, $6, $7, $8)
    `, [
      decoded.impersonated_by,
      decoded.impersonated_by_email,
      decoded.user_id,
      'user_impersonation',
      JSON.stringify({
        target_user: decoded.user_email,
        session_duration: Math.floor(Date.now() / 1000) - (decoded.exp - (24 * 60 * 60))
      }),
      'super_admin_impersonation',
      req.ip,
      req.headers['user-agent']
    ]);
    */

    logger.info(`Super admin ${decoded.impersonated_by_email} ended impersonation of user ${decoded.user_email}`);

    res.json({
      success: true,
      data: {
        sessionToken: adminToken,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          user_type: adminUser.user_type
        },
        isAdmin: true
      },
      message: 'Impersonation ended successfully'
    });

  } catch (error) {
    logger.error('End impersonation error:', error);
    res.status(500).json({ 
      error: 'Failed to end impersonation',
      message: error.message
    });
  }
});

module.exports = router;