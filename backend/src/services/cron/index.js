// Scheduler bootstrap. Imported once from src/app.js at startup. Each
// registered job runs on its own cron expression; failures are logged and
// don't crash the process.
//
// Disable in tests / dev with CRON_ENABLED=false. Default is enabled.

const cron = require('node-cron');
const logger = require('../../utils/logger');
const { rolloverOnce } = require('./taxYearRollover');
const { checkAndFireOnce } = require('./taxYearAdminReminder');

function safeWrap(name, fn) {
  return async () => {
    try {
      const t0 = Date.now();
      const out = await fn();
      logger.info(`cron:${name} done`, { ms: Date.now() - t0, result: out });
    } catch (err) {
      logger.error(`cron:${name} failed`, { message: err.message, stack: err.stack });
    }
  };
}

function startSchedulers() {
  if (process.env.CRON_ENABLED === 'false') {
    logger.info('cron scheduler disabled via CRON_ENABLED=false');
    return;
  }

  // Daily 00:30 server time — tax year is_current rollover.
  // 30 minutes after midnight keeps us clear of any other midnight tasks
  // that may have been scheduled by hosting providers.
  cron.schedule('30 0 * * *', safeWrap('taxYearRollover', () => rolloverOnce()), {
    timezone: 'Asia/Karachi',
  });

  // Daily 09:00 server time — admin Finance-Act reminder. The reminder
  // module is internally a no-op except on its three scheduled dates
  // (04-01, 06-15, 06-30).
  cron.schedule('0 9 * * *', safeWrap('taxYearAdminReminder', () => checkAndFireOnce()), {
    timezone: 'Asia/Karachi',
  });

  logger.info('cron schedulers registered', {
    rollover: '30 0 * * * Asia/Karachi',
    adminReminder: '0 9 * * * Asia/Karachi',
  });
}

module.exports = { startSchedulers };
