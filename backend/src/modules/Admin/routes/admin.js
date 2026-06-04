const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const jwtAuth = require('../../../middleware/auth'); // Standardized JWT middleware
const { insertAudit } = require('../../../helpers/auditLog');
const { BCRYPT_ROUNDS, validatePasswordPolicy } = require('../../../helpers/passwordPolicy');

const router = express.Router();

/**
 * requireAdmin — chains JWT verification then checks admin role.
 * Sets req.user (from jwtAuth) — all routes use req.user instead of req.user.
 */
const requireAdmin = [
  jwtAuth,
  (req, res, next) => {
    if (!['admin', 'super_admin'].includes(req.user?.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }
    next();
  }
];

// Get all users (admin only)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, search = '' } = req.query;
    // Cap the page size to 2000 to prevent accidental OOM, but allow admin
    // dashboards to pull the full list without pagination UI.
    const limit = Math.min(parseInt(req.query.limit) || 50, 2000);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    if (search) {
      whereClause += ` AND (email ILIKE $${queryParams.length + 1} OR name ILIKE $${queryParams.length + 1})`;
      queryParams.push(`%${search}%`);
    }
    
    // PERF-04: aggregate tax_returns in ONE join+group instead of a correlated
    // subquery that re-ran per row (up to `limit` = 2000 times per page load).
    const result = await pool.query(`
      SELECT
        u.id, u.email, u.name, u.user_type, u.role, u.is_active,
        u.created_at, u.last_login_at,
        COUNT(tr.id) as tax_returns_count
      FROM users u
      LEFT JOIN tax_returns tr ON tr.user_id = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
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
    
    // Update the tax year. `tax_years` has no `updated_at` column — older
    // code added it speculatively and 500'd on every toggle.
    const result = await client.query(`
      UPDATE tax_years
      SET is_active = $1, is_current = $2
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
      req.user.id, req.user.email, id,
      'status_update', JSON.stringify({ isActive, isCurrent }),
      'tax_year_status_update'
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`Tax year ${result.rows[0].tax_year} status updated by admin ${req.user.email}`);
    
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

// `POST /tax-years` previously had two definitions — Express matched the
// first, so the older un-restricted handler shadowed the super-admin gate
// added at line ~1802. The richer handler (with `description` + audit) is
// kept; this stub has been removed.

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
      req.user.id, req.user.email, id,
      'user_status_update', JSON.stringify({ isActive }),
      'user_management'
    ]);
    
    logger.info(`User ${result.rows[0].email} status updated by admin ${req.user.email}`);
    
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

// `GET /audit-logs` previously had two definitions — the older handler
// (without the super-admin gate or the richer category/search filters)
// was shadowing the proper one. Removed; the live handler is at line ~1990.

// Create new user (Super Admin only)
router.post('/users', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if requester is super admin
    if (req.user.role !== 'super_admin') {
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
      'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = true',
      [name]
    );

    if (existingName.rows.length > 0) {
      // Generic 409 — do not echo the existing email (PII / enumeration).
      return res.status(409).json({
        error: 'Name already in use',
        message: 'Please choose a different name for this user.',
      });
    }

    const policy = validatePasswordPolicy(password, { email });
    if (!policy.ok) {
      return res.status(400).json({ error: 'Password does not meet policy', message: policy.message });
    }

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
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
          // Full UUID (not 8-char prefix) — unique across all users.
          `TR-${newUser.id}-${currentTaxYear.tax_year}`
        ]);
        
        // Initialize form tables
        const taxReturnId = returnResult.rows[0].id;
        const formTables = [
          'income_forms', 'adjustable_tax_forms', 'reductions_forms',
          'credits_forms', 'deductions_forms', 'final_tax_forms',
          'capital_gain_forms', 'expenses_forms', 'wealth_forms',
          'form_completion_status'
        ];
        
        // Idempotent seed: DO NOTHING on (user_id, tax_year) unique from phase-d.
        for (const tableName of formTables) {
          await client.query(`
            INSERT INTO ${tableName} (
              id, tax_return_id, user_id, user_email,
              tax_year_id, tax_year, created_at
            ) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW())
            ON CONFLICT (user_id, tax_year) DO NOTHING
          `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
        }
      }
    }
    
    // Mandatory audit — inside the same transaction so a failure rolls back the create.
    await insertAudit(client, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'create',
      tableName: 'users',
      recordId: newUser.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

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
    if (req.user.role === 'admin' && ['admin', 'super_admin'].includes(targetUser.role)) {
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
    
    if (role !== undefined && req.user.role === 'super_admin') {
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

    // Mandatory audit — update-user is NOT transactional today, so a failure
    // here surfaces a 500 to the admin after the update already landed. That's
    // still better than silently losing the audit record.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'update',
      tableName: 'users',
      recordId: updatedUser.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

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
    if (req.user.role !== 'super_admin') {
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
    if (targetUser.id === req.user.id) {
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

    // Mandatory audit — inside transaction, rolls back the delete on failure.
    await insertAudit(client, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'delete',
      tableName: 'users',
      recordId: targetUser.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

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
      // Columns updated from the legacy monthly_salary/other_sources/grand_total
      // (which never existed on the live schema — see schema.legacy.sql) to
      // the actual income_forms columns. annual_salary_wages_total rolls up
      // the salary slab; other_income_no_min_tax_total is the non-minimum-tax
      // other-income bucket; total_employment_income is the grand total.
      const incomeData = await pool.query(`
        SELECT
          'income' as form_type,
          COALESCE(annual_salary_wages_total, 0) as salary_income,
          COALESCE(other_income_no_min_tax_total, 0) as other_income,
          COALESCE(total_employment_income, 0) as total_income,
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
          -- phase-u dropped the legacy debt_tax_amount column; its successor in
          -- the *_gross_amount/*_tax_amount family is debt_securities_tax_amount.
          -- Querying the dropped name 500'd this endpoint in prod.
          COALESCE(debt_securities_tax_amount, 0) as advance_tax_paid,
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
        // Stored columns are annual (not monthly/grand_total as legacy code had).
        // income_forms has `annual_basic_salary` and `total_employment_income`
        // as a DB-generated column, so we only write the inputs.
        updateResult = await client.query(`
          UPDATE income_forms
          SET
            annual_basic_salary = $1,
            other_taxable_income_others = $2,
            updated_at = NOW()
          WHERE tax_return_id = $3
          RETURNING *
        `, [
          formData.salary_income || 0,
          formData.other_income || 0,
          taxReturnId
        ]);
        break;
        
      case 'deductions':
        // `total_deductions` is a Postgres GENERATED column — writing to it
        // raises 428C9. Write only the inputs; the DB recomputes the total.
        // The generated formula reads `zakat_paid_amount` (not the legacy
        // `zakat` column), so we mirror the value to both keep older
        // consumers and the live total in sync.
        updateResult = await client.query(`
          UPDATE deductions_forms
          SET
            zakat              = $1,
            zakat_paid_amount  = $1,
            other_deductions   = $2,
            advance_tax        = $3,
            updated_at         = NOW()
          WHERE tax_return_id = $4
          RETURNING *
        `, [
          formData.zakat_paid || 0,
          formData.other_deductions || 0,
          formData.advance_tax || 0,
          taxReturnId
        ]);
        break;

      case 'final_tax':
        // `total_final_tax`, `debt_tax_amount`, and `sukuk_tax_amount` are
        // all GENERATED columns — they are computed from `*_gross_amount` ×
        // `*_tax_rate` inputs. The admin payload here ships pre-computed
        // totals (`total_tax_liability`, `advance_tax_paid`) which don't map
        // cleanly to the input columns. Until the admin UI is updated to
        // send the granular fields, accept the payload as a no-op so the
        // call doesn't 500 — the existing row is returned unchanged.
        updateResult = await client.query(
          'SELECT * FROM final_tax_forms WHERE tax_return_id = $1',
          [taxReturnId]
        );
        if (updateResult.rows.length === 0) {
          return res.status(404).json({
            error: 'final_tax form not found for this user/year',
          });
        }
        logger.warn('Admin final_tax edit accepted as no-op — granular inputs not wired', {
          taxReturnId,
          payloadKeys: Object.keys(formData || {}),
        });
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
      req.user.id,
      req.user.email,
      `${formType}_forms`,
      taxReturnId,
      'admin_tax_form_edit',
      JSON.stringify(formData),
      'tax_consultant_service',
      req.ip,
      req.headers['user-agent']
    ]);
    
    await client.query('COMMIT');
    
    logger.info(`Admin ${req.user.email} updated ${formType} form for user ${userId}`);
    
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
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only super admin can access user credentials' 
      });
    }

    // PERF-07: paginate — this returned EVERY non-super-admin user's row in one
    // unbounded result. Capped page size; defaults to 50.
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 2000);
    const offset = (page - 1) * limit;

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
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Mandatory audit — viewing credentials is privileged; no silent drop.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'view_credentials',
      tableName: 'users',
      changeSummary: 'Super admin accessed user credentials list',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    logger.info(`Super admin ${req.user.email} accessed user credentials list`);

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
    if (req.user.role !== 'super_admin') {
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
        admin_id: req.user.id,
        admin_email: req.user.email,
        // Single-use marker (SEC-02): consumed once at /api/login so the bypass
        // token can't be replayed within its 10-minute window.
        jti: crypto.randomUUID(),
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

    // Mandatory audit — minting a bypass JWT is a privileged action and
    // must be traceable. fail-closed so the credentials don't get returned
    // if the audit insert fails.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'super_admin_credential_bypass',
      tableName: 'users',
      recordId: targetUser.id,
      newValue: { targetEmail: targetUser.email, tokenTtlSeconds: 600 },
      category: 'super_admin_credential_bypass',
      severity: 'high',
      changeSummary: `Super admin ${req.user.email} minted a 10-minute bypass token for ${targetUser.email}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      mandatory: true,
    });

    logger.info(`Super admin ${req.user.email} accessed login credentials for user ${targetUser.email}`);

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
    if (req.user.role !== 'super_admin') {
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

    // Mandatory audit — must succeed BEFORE the impersonation token is handed
    // out. If the audit trail is broken we refuse to issue the token.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'impersonate_start',
      tableName: 'users',
      recordId: targetUser.id,
      newValue: { target_user: targetUser.email, target_user_name: targetUser.name },
      category: 'super_admin_impersonation',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    // Impersonation session token.
    //   - `userId` (camelCase) so middleware/auth.js can validate it like any
    //     other JWT; prior `user_id` claim silently failed lookup.
    //   - 1-hour TTL — impersonation is for focused admin tasks, not day-long
    //     sessions.
    //   - `isImpersonation` + `actingAdminId` carried for downstream audit /
    //     UI (banner, end-impersonation).
    const impersonationToken = jwt.sign(
      {
        userId: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        user_type: targetUser.user_type,
        isImpersonation: true,
        actingAdminId: req.user.id,
        actingAdminEmail: req.user.email,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      },
      process.env.JWT_SECRET
    );

    logger.info(`Super admin ${req.user.email} started impersonating user ${targetUser.email}`);

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
          id: req.user.id,
          name: req.user.name,
          email: req.user.email
        },
        expiresIn: 60 * 60 // 1 hour in seconds
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

// End impersonation (return to admin) — requires valid JWT
// end-impersonation is called WITH the impersonation token — whose role is
// 'user', not 'admin'. `requireAdmin` would reject it. We validate the JWT
// manually and enforce the real gate: isImpersonation=true AND actingAdminId
// resolves to an admin row.
router.post('/end-impersonation', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!decoded.isImpersonation) {
      return res.status(400).json({
        error: 'Not in impersonation mode',
        message: 'Cannot end impersonation - not currently impersonating'
      });
    }

    // Get admin user details from the acting-admin claim.
    const adminResult = await pool.query(`
      SELECT id, name, email, role, user_type, is_active
      FROM users
      WHERE id = $1 AND role IN ('admin', 'super_admin')
    `, [decoded.actingAdminId]);

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const adminUser = adminResult.rows[0];

    // Mandatory audit — ended impersonation is a privileged transition, same
    // level as the start. Must succeed before we issue the new admin token.
    await insertAudit(pool, {
      userId: decoded.actingAdminId,
      userEmail: decoded.actingAdminEmail,
      action: 'impersonate_end',
      tableName: 'users',
      recordId: decoded.userId,
      newValue: { target_user: decoded.email },
      category: 'super_admin_impersonation',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    // Restore the admin token — canonical `userId` claim, 8-hour TTL.
    const adminToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        user_type: adminUser.user_type,
        exp: Math.floor(Date.now() / 1000) + (8 * 60 * 60) // 8 hours
      },
      process.env.JWT_SECRET
    );

    logger.info(`Super admin ${decoded.actingAdminEmail} ended impersonation of user ${decoded.email}`);

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

// ─────────────────────────────────────────────────────────────────
// TAX SLABS MANAGEMENT (Super Admin only)
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/tax-slabs?taxYearId=&slabType=
router.get('/tax-slabs', requireAdmin, async (req, res) => {
  try {
    const { taxYearId, slabType } = req.query;
    let query = `
      SELECT ts.*, ty.tax_year
      FROM tax_slabs ts
      JOIN tax_years ty ON ts.tax_year_id = ty.id
    `;
    const params = [];
    const conds = [];
    if (taxYearId) { params.push(taxYearId); conds.push(`ts.tax_year_id = $${params.length}`); }
    if (slabType)  { params.push(slabType);  conds.push(`ts.slab_type = $${params.length}`); }
    if (conds.length) query += ' WHERE ' + conds.join(' AND ');
    query += ' ORDER BY ts.slab_order ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Get tax slabs error:', error);
    res.status(500).json({ error: 'Failed to fetch tax slabs', message: error.message });
  }
});

// GET /api/admin/tax-slabs/types  — distinct slab_types in use
router.get('/tax-slabs/types', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT slab_type FROM tax_slabs ORDER BY slab_type');
    res.json({ success: true, data: result.rows.map(r => r.slab_type) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slab types', message: error.message });
  }
});

// POST /api/admin/tax-slabs  — create slab (super_admin only)
router.post('/tax-slabs', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from, effective_to } = req.body;
    if (!tax_year_id || slab_order == null || min_income == null || tax_rate == null || !slab_type) {
      return res.status(400).json({ error: 'tax_year_id, slab_order, min_income, tax_rate, slab_type are required' });
    }
    const result = await pool.query(`
      INSERT INTO tax_slabs (tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from, effective_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [tax_year_id, slab_name || `Slab ${slab_order}`, slab_order, min_income, max_income || null, tax_rate, slab_type,
        effective_from || null, effective_to || null]);

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'create','tax_slabs',$3,$4,'tax_management',$5)`,
      [req.user.id, req.user.email, result.rows[0].id,
       JSON.stringify({ slab_name, min_income, max_income, tax_rate, slab_type }),
       `Tax slab created: ${slab_name} (${slab_type}) for year ${tax_year_id}`]);

    res.status(201).json({ success: true, data: result.rows[0], message: 'Tax slab created' });
  } catch (error) {
    logger.error('Create tax slab error:', error);
    res.status(500).json({ error: 'Failed to create tax slab', message: error.message });
  }
});

// PUT /api/admin/tax-slabs/:id  — update slab (super_admin only)
router.put('/tax-slabs/:id', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from, effective_to } = req.body;

    // Fetch old value for audit
    const old = await pool.query('SELECT * FROM tax_slabs WHERE id=$1', [id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Slab not found' });

    const result = await pool.query(`
      UPDATE tax_slabs SET
        slab_name=COALESCE($1,slab_name), slab_order=COALESCE($2,slab_order),
        min_income=COALESCE($3,min_income), max_income=$4,
        tax_rate=COALESCE($5,tax_rate), slab_type=COALESCE($6,slab_type),
        effective_from=$7, effective_to=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [slab_name, slab_order, min_income, max_income ?? null, tax_rate, slab_type,
        effective_from || null, effective_to || null, id]);

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_value, new_value, category, change_summary)
      VALUES ($1,$2,'update','tax_slabs',$3,$4,$5,'tax_management',$6)`,
      [req.user.id, req.user.email, id,
       JSON.stringify({ tax_rate: old.rows[0].tax_rate, min_income: old.rows[0].min_income }),
       JSON.stringify({ tax_rate, min_income, max_income }),
       `Tax slab updated: ${slab_name || old.rows[0].slab_name}`]);

    res.json({ success: true, data: result.rows[0], message: 'Tax slab updated' });
  } catch (error) {
    logger.error('Update tax slab error:', error);
    res.status(500).json({ error: 'Failed to update tax slab', message: error.message });
  }
});

// DELETE /api/admin/tax-slabs/:id  (super_admin only)
router.delete('/tax-slabs/:id', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const old = await pool.query('SELECT * FROM tax_slabs WHERE id=$1', [id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Slab not found' });

    await pool.query('DELETE FROM tax_slabs WHERE id=$1', [id]);
    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_value, category, change_summary)
      VALUES ($1,$2,'delete','tax_slabs',$3,$4,'tax_management',$5)`,
      [req.user.id, req.user.email, id, JSON.stringify(old.rows[0]),
       `Tax slab deleted: ${old.rows[0].slab_name}`]);

    res.json({ success: true, message: 'Tax slab deleted' });
  } catch (error) {
    logger.error('Delete tax slab error:', error);
    res.status(500).json({ error: 'Failed to delete tax slab', message: error.message });
  }
});

// POST /api/admin/tax-slabs/clone  — copy all slabs from one year to another (super_admin only)
router.post('/tax-slabs/clone', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { fromTaxYearId, toTaxYearId, slabType } = req.body;
    if (!fromTaxYearId || !toTaxYearId) return res.status(400).json({ error: 'fromTaxYearId and toTaxYearId required' });

    let q = 'SELECT * FROM tax_slabs WHERE tax_year_id=$1';
    const params = [fromTaxYearId];
    if (slabType) { q += ' AND slab_type=$2'; params.push(slabType); }

    const slabs = await pool.query(q, params);
    if (!slabs.rows.length) return res.status(404).json({ error: 'No slabs found for source year' });

    // Remove existing slabs in target year (for same slab_type if specified)
    if (slabType) {
      await pool.query('DELETE FROM tax_slabs WHERE tax_year_id=$1 AND slab_type=$2', [toTaxYearId, slabType]);
    } else {
      await pool.query('DELETE FROM tax_slabs WHERE tax_year_id=$1', [toTaxYearId]);
    }

    const inserted = [];
    for (const slab of slabs.rows) {
      const r = await pool.query(`
        INSERT INTO tax_slabs (tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *
      `, [toTaxYearId, slab.slab_name, slab.slab_order, slab.min_income, slab.max_income, slab.tax_rate, slab.slab_type]);
      inserted.push(r.rows[0]);
    }

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, category, change_summary)
      VALUES ($1,$2,'clone','tax_slabs','tax_management',$3)`,
      [req.user.id, req.user.email, `Cloned ${inserted.length} slabs from ${fromTaxYearId} to ${toTaxYearId}`]);

    res.json({ success: true, data: inserted, message: `${inserted.length} slabs cloned successfully` });
  } catch (error) {
    logger.error('Clone tax slabs error:', error);
    res.status(500).json({ error: 'Failed to clone tax slabs', message: error.message });
  }
});

// POST /api/admin/tax-slabs/preview  — calculate tax with current slabs for test income
router.post('/tax-slabs/preview', requireAdmin, async (req, res) => {
  try {
    const { taxYearId, income, slabType = 'individual' } = req.body;
    if (!taxYearId || income == null) return res.status(400).json({ error: 'taxYearId and income required' });

    const slabs = await pool.query(
      'SELECT * FROM tax_slabs WHERE tax_year_id=$1 AND slab_type=$2 ORDER BY slab_order',
      [taxYearId, slabType]
    );

    if (!slabs.rows.length) return res.json({ success: true, data: { totalTax: 0, effectiveRate: 0, breakdown: [] } });

    let totalTax = 0;
    const breakdown = [];
    const inc = parseFloat(income);

    for (const slab of slabs.rows) {
      const lo = parseFloat(slab.min_income);
      const hi = slab.max_income ? parseFloat(slab.max_income) : Infinity;
      if (inc < lo) break;
      const taxable = Math.min(inc, hi) - lo + 1;
      const rate = parseFloat(slab.tax_rate);
      const tax = taxable * rate;
      totalTax += tax;
      breakdown.push({
        slab_name: slab.slab_name,
        range: `${lo.toLocaleString()} – ${slab.max_income ? parseFloat(slab.max_income).toLocaleString() : '∞'}`,
        taxable_amount: taxable,
        rate: (rate * 100).toFixed(2) + '%',
        tax_amount: Math.round(tax)
      });
      if (inc <= hi) break;
    }

    res.json({
      success: true,
      data: {
        income: inc,
        totalTax: Math.round(totalTax),
        effectiveRate: ((totalTax / inc) * 100).toFixed(2) + '%',
        marginalRate: breakdown.length ? breakdown[breakdown.length - 1].rate : '0%',
        breakdown
      }
    });
  } catch (error) {
    logger.error('Tax slab preview error:', error);
    res.status(500).json({ error: 'Failed to preview tax', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// USER ROLE MANAGEMENT (Super Admin only)
// ─────────────────────────────────────────────────────────────────

router.put('/users/:id/role', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { role } = req.body;
    const allowed = ['user', 'admin', 'super_admin', 'taxpayer'];
    if (!allowed.includes(role)) return res.status(400).json({ error: `Role must be one of: ${allowed.join(', ')}` });
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });

    const old = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (!old.rows.length) return res.status(404).json({ error: 'User not found' });

    await pool.query('UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2', [role, id]);
    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_value, new_value, category, change_summary)
      VALUES ($1,$2,'update','users',$3,$4,$5,'user_management',$6)`,
      [req.user.id, req.user.email, id,
       JSON.stringify({ role: old.rows[0].role }),
       JSON.stringify({ role }),
       `Role changed: ${old.rows[0].email} from ${old.rows[0].role} to ${role}`]);

    res.json({ success: true, message: `Role updated to ${role}` });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update role', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// TAX YEAR MANAGEMENT (Admin+ can read, super_admin can write)
// ─────────────────────────────────────────────────────────────────

router.post('/tax-years', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { taxYear, startDate, endDate, filingDeadline, isCurrent, description } = req.body;
    if (!taxYear) return res.status(400).json({ error: 'taxYear is required (format: YYYY-YY)' });

    if (isCurrent) await pool.query('UPDATE tax_years SET is_current=false');

    const result = await pool.query(`
      INSERT INTO tax_years (tax_year, start_date, end_date, filing_deadline, is_current, is_active, description)
      VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING *
    `, [taxYear, startDate || null, endDate || null, filingDeadline || null, !!isCurrent, description || null]);

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'create','tax_years',$3,$4,'tax_management',$5)`,
      [req.user.id, req.user.email, result.rows[0].id, JSON.stringify({ taxYear, isCurrent }),
       `Tax year created: ${taxYear}`]);

    res.status(201).json({ success: true, data: result.rows[0], message: `Tax year ${taxYear} created` });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: `Tax year ${req.body.taxYear} already exists` });
    logger.error('Create tax year error:', error);
    res.status(500).json({ error: 'Failed to create tax year', message: error.message });
  }
});

router.put('/tax-years/:id', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { isActive, isCurrent, filingDeadline, description } = req.body;

    // Snapshot pre-state for the audit entry.
    const beforeRow = await pool.query('SELECT * FROM tax_years WHERE id=$1', [id]);
    if (!beforeRow.rows.length) return res.status(404).json({ error: 'Tax year not found' });

    if (isCurrent) await pool.query('UPDATE tax_years SET is_current=false WHERE id!=$1', [id]);

    const result = await pool.query(`
      UPDATE tax_years SET
        is_active=COALESCE($1,is_active), is_current=COALESCE($2,is_current),
        filing_deadline=COALESCE($3,filing_deadline), description=COALESCE($4,description)
      WHERE id=$5 RETURNING *
    `, [isActive, isCurrent, filingDeadline || null, description || null, id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Tax year not found' });

    // Audit — tax-year changes affect every filer's slabs/surcharge/CGT
    // rates and which return is "current". Mandatory so the change isn't
    // silently committed if the audit insert fails.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'tax_year_update',
      tableName: 'tax_years',
      recordId: id,
      oldValue: beforeRow.rows[0],
      newValue: result.rows[0],
      category: 'tax_management',
      severity: 'high',
      changeSummary: `Tax year ${result.rows[0].tax_year} updated by ${req.user.email}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      mandatory: true,
    });

    res.json({ success: true, data: result.rows[0], message: 'Tax year updated' });
  } catch (error) {
    logger.error('Update tax year error:', error);
    res.status(500).json({ error: 'Failed to update tax year', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// ADMIN ACCOUNT MANAGEMENT (Super Admin only)
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/admin-accounts  — list all admin + super_admin users
router.get('/admin-accounts', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const result = await pool.query(`
      SELECT id, email, name, role, user_type, is_active, created_at, last_login_at,
             created_by
      FROM users
      WHERE role IN ('admin','super_admin')
      ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Get admin accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch admin accounts', message: error.message });
  }
});

// POST /api/admin/admin-accounts  — create new admin account (super_admin only)
router.post('/admin-accounts', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { email, name, password, role = 'admin' } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password are required' });
    if (!['admin', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Role must be admin or super_admin' });

    const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'A user with this email already exists' });

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await client.query(`
      INSERT INTO users (email, name, password_hash, user_type, role, is_active, created_by)
      VALUES ($1, $2, $3, 'admin', $4, true, $5)
      RETURNING id, email, name, role, user_type, is_active, created_at
    `, [email, name, passwordHash, role, req.user.id]);

    await client.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'create','users',$3,$4,'admin_management',$5)
    `, [req.user.id, req.user.email, result.rows[0].id,
        JSON.stringify({ email, name, role }),
        `Admin account created: ${name} (${email}) with role ${role}`]);

    await client.query('COMMIT');
    logger.info(`Admin account created by ${req.user.email}: ${email} (${role})`);
    res.status(201).json({ success: true, data: result.rows[0], message: `Admin account created successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create admin account error:', error);
    res.status(500).json({ error: 'Failed to create admin account', message: error.message });
  } finally {
    client.release();
  }
});

// PUT /api/admin/admin-accounts/:id  — update admin account (super_admin only)
router.put('/admin-accounts/:id', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { name, email, role, is_active } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Admin account not found' });
    if (id === req.user.id && is_active === false) return res.status(400).json({ error: 'Cannot deactivate your own account' });
    if (id === req.user.id && role && role !== 'super_admin') return res.status(400).json({ error: 'Cannot change your own role' });

    const updates = [];
    const vals = [];
    let p = 1;
    if (name !== undefined)      { updates.push(`name=$${p++}`);      vals.push(name); }
    if (email !== undefined)     { updates.push(`email=$${p++}`);     vals.push(email); }
    if (role !== undefined)      { updates.push(`role=$${p++}`);      vals.push(role); }
    if (is_active !== undefined) { updates.push(`is_active=$${p++}`); vals.push(is_active); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at=NOW()`);
    vals.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${p} RETURNING id,email,name,role,is_active,updated_at`,
      vals
    );

    await pool.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'update','users',$3,$4,'admin_management',$5)
    `, [req.user.id, req.user.email, id, JSON.stringify({ name, email, role, is_active }),
        `Admin account updated: ${existing.rows[0].email}`]);

    res.json({ success: true, data: result.rows[0], message: 'Admin account updated' });
  } catch (error) {
    logger.error('Update admin account error:', error);
    res.status(500).json({ error: 'Failed to update admin account', message: error.message });
  }
});

// POST /api/admin/admin-accounts/:id/reset-password  — reset admin password (super_admin only)
router.post('/admin-accounts/:id/reset-password', requireAdmin, async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const existing = await pool.query('SELECT * FROM users WHERE id=$1 AND role IN (\'admin\',\'super_admin\')', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Admin account not found' });

    const policy = validatePasswordPolicy(newPassword, { email: existing.rows[0].email });
    if (!policy.ok) return res.status(400).json({ error: policy.message });

    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, id]);

    await pool.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'password_reset','users',$3,$4,'admin_management',$5)
    `, [req.user.id, req.user.email, id, JSON.stringify({ by: req.user.email }),
        `Password reset for admin: ${existing.rows[0].email}`]);

    logger.info(`Password reset for admin ${existing.rows[0].email} by ${req.user.email}`);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset admin password error:', error);
    res.status(500).json({ error: 'Failed to reset password', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// AUDIT LOGS (read-only)
// ─────────────────────────────────────────────────────────────────

router.get('/audit-logs', requireAdmin, async (req, res) => {
  // Audit logs are super-admin only — they reveal privileged operations
  // including impersonation, credential bypass, and role changes.
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  try {
    const { page = 1, table_name, action, user_email, category, search } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500); // PERF-07: cap page size
    const offset = (page - 1) * limit;

    const params = [];
    const conds = [];
    if (table_name) { params.push(table_name); conds.push(`al.table_name=$${params.length}`); }
    if (action)     { params.push(action);     conds.push(`al.action=$${params.length}`); }
    if (user_email) { params.push(`%${user_email}%`); conds.push(`al.user_email ILIKE $${params.length}`); }
    if (category)   { params.push(category);   conds.push(`al.category=$${params.length}`); }
    if (search)     { params.push(`%${search}%`); conds.push(`(al.change_summary ILIKE $${params.length} OR al.user_email ILIKE $${params.length} OR al.table_name ILIKE $${params.length})`); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_log al ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(`
      SELECT al.id, al.user_email, al.action, al.table_name, al.record_id,
             al.field_name, al.old_value, al.new_value, al.change_summary,
             al.ip_address, al.category, al.severity, al.created_at
      FROM audit_log al
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs', message: error.message });
  }
});

module.exports = router;