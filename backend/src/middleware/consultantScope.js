// Consultant client-scoping (phase-z9).
//
// A tax_consultant may only operate on clients explicitly assigned to them in
// consultant_clients. Independent users (no assignment row — the predominant
// population) and other consultants' clients are equally out of reach: every
// check asks "is this client assigned to ME?", never "is it someone else's?".
//
// Admins and super_admins pass through unscoped, as before.

const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { insertAudit } = require('../helpers/auditLog');

const isConsultant = (role) => role === 'tax_consultant';

/** True iff `clientId` is assigned to `consultantId`. */
async function isAssignedClient(consultantId, clientId) {
  const r = await pool.query(
    'SELECT 1 FROM consultant_clients WHERE consultant_id = $1 AND client_id = $2',
    [consultantId, clientId]
  );
  return r.rows.length > 0;
}

/**
 * Route middleware factory: blocks a tax_consultant from reaching a client
 * route unless the `:paramName` user is assigned to them. Responds 404 (not
 * 403) so an unassigned consultant cannot probe which user IDs exist. The
 * denied attempt is audit-logged (best-effort — a logging failure must not
 * turn a denial into an outage).
 */
const requireAssignedClient = (paramName) => async (req, res, next) => {
  if (!isConsultant(req.user?.role)) return next();

  const clientId = req.params[paramName];
  try {
    if (await isAssignedClient(req.user.id, clientId)) return next();
  } catch (error) {
    logger.error('Consultant scope check failed:', error);
    return res.status(500).json({ error: 'Scope check failed' });
  }

  try {
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'consultant_scope_denied',
      tableName: 'users',
      recordId: clientId,
      category: 'consultant_isolation',
      severity: 'high',
      changeSummary: `Consultant ${req.user.email} denied access to unassigned user ${clientId} (${req.method} ${req.originalUrl})`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (auditError) {
    logger.error('Failed to audit consultant scope denial:', auditError);
  }

  logger.warn(`Consultant ${req.user.email} denied access to unassigned user ${clientId}`);
  return res.status(404).json({
    error: 'User not found',
    message: 'The specified user does not exist',
  });
};

module.exports = { isConsultant, isAssignedClient, requireAssignedClient };
