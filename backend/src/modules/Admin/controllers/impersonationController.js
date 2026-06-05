const jwt = require('jsonwebtoken');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { insertAudit } = require('../../../helpers/auditLog');

const impersonateUser = async (req, res) => {
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
};

const endImpersonation = async (req, res) => {
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
};

module.exports = {
  impersonateUser,
  endImpersonation,
};
