/**
 * Expired-session sweep.
 *
 * Deletes rows from user_sessions where expires_at < NOW() — or where
 * created_at is older than $MAX_SESSION_AGE_DAYS (defaults to 30). Run
 * periodically (cron / scheduled job); idempotent and safe to run on a
 * live DB while requests are in flight.
 *
 *   node backend/src/scripts/cleanupExpiredSessions.js
 *
 * Env:
 *   MAX_SESSION_AGE_DAYS   (default: 30)
 */

require('dotenv').config();
const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function cleanup() {
  const maxAgeDays = parseInt(process.env.MAX_SESSION_AGE_DAYS) || 30;

  // 1. Remove rows that the app already considered expired.
  const expired = await pool.query(
    `DELETE FROM user_sessions
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING id`
  );

  // 2. Catch-all: even if expires_at was never set (old rows), nuke anything
  //    older than MAX_SESSION_AGE_DAYS.
  const stale = await pool.query(
    `DELETE FROM user_sessions
      WHERE created_at < NOW() - ($1 || ' days')::interval
      RETURNING id`,
    [String(maxAgeDays)]
  );

  logger.info('Session cleanup complete', {
    expiredRemoved: expired.rowCount,
    staleRemoved: stale.rowCount,
    maxAgeDays,
  });
}

if (require.main === module) {
  cleanup()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Session cleanup failed', { message: err?.message });
      process.exit(1);
    });
}

module.exports = { cleanup };
