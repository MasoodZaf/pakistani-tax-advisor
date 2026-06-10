const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { isElevated } = require('../../../middleware/roleGuard');

const getStats = async (req, res) => {
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
};

const getAuditLogs = async (req, res) => {
  // Audit logs are elevated-only (super_admin + tax_consultant) — they reveal
  // privileged operations including impersonation, credential bypass, and
  // role changes. Plain admins stay blocked.
  if (!isElevated(req.user.role)) {
    return res.status(403).json({ error: 'Elevated access only' });
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
};

module.exports = {
  getStats,
  getAuditLogs,
};
