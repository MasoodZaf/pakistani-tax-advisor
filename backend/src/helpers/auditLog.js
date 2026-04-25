const logger = require('../utils/logger');

/**
 * Audit-log insert helper.
 *
 * Policy:
 *   - For privileged admin actions (user_create, user_delete, impersonate_*,
 *     view_credentials, role_change, rate_change) — audit MUST succeed.
 *     Pass a client with an open transaction so a failed audit rolls the
 *     action back. This is fail-closed.
 *
 *   - For auth flows (login, register, password_change) — audit is logged at
 *     ERROR level on failure but does NOT block the user-facing action. The
 *     auth flow can't wait on a broken audit table.
 *
 * Pass `audit.mandatory = true` for fail-closed semantics; anything else is
 * fail-open with error-level logging on failure.
 *
 * `audit` shape:
 *   { userId, userEmail, action, tableName, recordId, oldValue, newValue,
 *     category, severity, changeSummary, ipAddress, userAgent, mandatory }
 */
async function insertAudit(clientOrPool, audit = {}) {
  const {
    userId = null,
    userEmail = null,
    action,
    tableName = null,
    recordId = null,
    oldValue = null,
    newValue = null,
    category = null,
    severity = null,
    changeSummary = null,
    ipAddress = null,
    userAgent = null,
    mandatory = false,
  } = audit;

  if (!action) {
    const err = new Error('audit insert requires action');
    if (mandatory) throw err;
    logger.error('Audit insert missing action — dropping', audit);
    return;
  }

  try {
    // Cap user-agent length defensively — attackers can pad this to DoS the DB.
    const uaTrimmed = typeof userAgent === 'string' ? userAgent.slice(0, 512) : userAgent;
    await clientOrPool.query(
      `INSERT INTO audit_log
         (user_id, user_email, action, table_name, record_id,
          old_value, new_value, category, severity, change_summary,
          ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId,
        userEmail,
        action,
        tableName,
        recordId,
        oldValue != null && typeof oldValue !== 'string' ? JSON.stringify(oldValue) : oldValue,
        newValue != null && typeof newValue !== 'string' ? JSON.stringify(newValue) : newValue,
        category,
        severity,
        changeSummary,
        ipAddress,
        uaTrimmed,
      ]
    );
  } catch (err) {
    if (mandatory) {
      logger.error(
        `[audit FAIL-CLOSED] mandatory audit insert failed for action="${action}" — rolling back`,
        { message: err?.message, userId, action }
      );
      throw err;
    }
    logger.error(`[audit FAIL-OPEN] audit insert failed for action="${action}"`, {
      message: err?.message,
      userId,
      action,
    });
  }
}

module.exports = { insertAudit };
