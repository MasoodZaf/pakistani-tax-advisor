// Scheduler bootstrap. Imported once from src/app.js at startup. Each
// registered job runs on its own cron expression; failures are logged and
// don't crash the process.
//
// Disable in tests / dev with CRON_ENABLED=false. Default is enabled.

const cron = require('node-cron');
const logger = require('../../utils/logger');
const sentry = require('../../utils/sentry');
const { rolloverOnce } = require('./taxYearRollover');
const { checkAndFireOnce } = require('./taxYearAdminReminder');
const { backupOnce } = require('./postgresBackup');

function safeWrap(name, fn) {
  return async () => {
    try {
      const t0 = Date.now();
      const out = await fn();
      logger.info(`cron:${name} done`, { ms: Date.now() - t0, result: out });
    } catch (err) {
      logger.error(`cron:${name} failed`, { message: err.message, stack: err.stack });
      // Forward to Sentry so silent backup/reminder/rollover failures
      // page the team instead of hiding in winston logs.
      sentry.captureException(err, { cronJob: name });
    }
  };
}

// Job refs kept so gracefulShutdown can stop them — without this a SIGTERM
// during pg_dump leaves a truncated .sql.gz that rotation can't detect.
const _jobs = [];

function startSchedulers() {
  if (process.env.CRON_ENABLED === 'false') {
    logger.info('cron scheduler disabled via CRON_ENABLED=false');
    return;
  }

  // Daily 00:30 server time — tax year is_current rollover.
  // 30 minutes after midnight keeps us clear of any other midnight tasks
  // that may have been scheduled by hosting providers.
  _jobs.push(
    cron.schedule('30 0 * * *', safeWrap('taxYearRollover', () => rolloverOnce()), {
      timezone: 'Asia/Karachi',
    })
  );

  // Daily 09:00 server time — admin Finance-Act reminder. The reminder
  // module is internally a no-op except on its three scheduled dates
  // (04-01, 06-15, 06-30).
  _jobs.push(
    cron.schedule('0 9 * * *', safeWrap('taxYearAdminReminder', () => checkAndFireOnce()), {
      timezone: 'Asia/Karachi',
    })
  );

  // Nightly 02:15 PKT — Postgres dump with rotation (14 daily, 8 weekly).
  // Backup target is the /backups volume mounted in docker-compose.prod.yml.
  // Skipped if BACKUP_DIR unset (e.g. dev / local node) — see postgresBackup.js.
  if (process.env.BACKUP_DIR) {
    _jobs.push(
      cron.schedule('15 2 * * *', safeWrap('postgresBackup', () => backupOnce()), {
        timezone: 'Asia/Karachi',
      })
    );
  } else {
    logger.info('postgres backup cron skipped (BACKUP_DIR not set)');
  }

  logger.info('cron schedulers registered', {
    rollover: '30 0 * * * Asia/Karachi',
    adminReminder: '0 9 * * * Asia/Karachi',
    backup: process.env.BACKUP_DIR ? '15 2 * * * Asia/Karachi' : 'disabled',
  });
}

// Called from app.js gracefulShutdown. Stops the cron timers so no NEW
// jobs fire after SIGTERM. In-flight jobs (e.g. a pg_dump that started
// at 02:15) keep running — Node won't exit until they return because
// the await chain in safeWrap holds the event loop. The server's 10s
// hard-exit will eventually win, but at that point the dump is the
// thing being killed, not a fresh one starting mid-process.
function stopSchedulers() {
  for (const job of _jobs) {
    try { job.stop(); } catch { /* ignore */ }
  }
  _jobs.length = 0;
  logger.info('cron schedulers stopped');
}

module.exports = { startSchedulers, stopSchedulers };
