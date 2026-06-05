const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { insertAudit } = require('../../../helpers/auditLog');
const { BCRYPT_ROUNDS, validatePasswordPolicy } = require('../../../helpers/passwordPolicy');

const getUsers = async (req, res) => {
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
};

const updateUserStatus = async (req, res) => {
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
};

const createUser = async (req, res) => {
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
};

const updateUser = async (req, res) => {
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
};

const deleteUser = async (req, res) => {
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
};

const getUser = async (req, res) => {
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
};

const getUserTaxRecords = async (req, res) => {
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
};

const updateUserTaxForm = async (req, res) => {
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
};

const getUserCredentials = async (req, res) => {
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
};

const getUserLoginCredentials = async (req, res) => {
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
};

const updateUserRole = async (req, res) => {
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
};

module.exports = {
  getUsers,
  updateUserStatus,
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUserTaxRecords,
  updateUserTaxForm,
  getUserCredentials,
  getUserLoginCredentials,
  updateUserRole,
};
