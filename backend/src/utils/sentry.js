/**
 * Sentry initialization — opt-in via SENTRY_DSN env var.
 *
 * If SENTRY_DSN is unset, this module exports a no-op shim so callers can
 * always `captureException(err)` without checking whether Sentry is live.
 *
 * Wire calls:
 *   - expressErrorHandler (utils/sendError.js) forwards unhandled errors
 *   - process-level handlers in app.js (uncaughtException, unhandledRejection)
 *
 * To enable in production:
 *   SENTRY_DSN=https://…@sentry.io/… NODE_ENV=production npm start
 */

const logger = require('./logger');

let Sentry = null;
let enabled = false;

if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
      // Sample rates tuned conservatively — we're a tax app, not a high-volume API.
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
      // Always scrub cookie/auth headers — defence in depth beyond logger redaction.
      beforeSend(event) {
        if (event?.request?.headers) {
          for (const k of Object.keys(event.request.headers)) {
            if (/authorization|cookie|token/i.test(k)) {
              event.request.headers[k] = '[REDACTED]';
            }
          }
        }
        if (event?.request?.data && typeof event.request.data === 'object') {
          for (const k of Object.keys(event.request.data)) {
            if (/password|token|secret/i.test(k)) {
              event.request.data[k] = '[REDACTED]';
            }
          }
        }
        return event;
      },
    });
    enabled = true;
    logger.info('Sentry initialized', { environment: process.env.NODE_ENV });
  } catch (err) {
    logger.error('Sentry init failed — continuing without error tracking', {
      message: err?.message,
    });
    Sentry = null;
  }
}

function captureException(err, context = {}) {
  if (!enabled || !Sentry) return;
  try {
    Sentry.captureException(err, { extra: context });
  } catch {
    // Sentry failures must never crash the process.
  }
}

function captureMessage(msg, level = 'info') {
  if (!enabled || !Sentry) return;
  try {
    Sentry.captureMessage(msg, level);
  } catch {
    /* ignore */
  }
}

/** Flush pending events at shutdown — wait up to 2 seconds. */
async function flush(timeoutMs = 2000) {
  if (!enabled || !Sentry) return;
  try {
    await Sentry.close(timeoutMs);
  } catch {
    /* ignore */
  }
}

module.exports = { enabled, captureException, captureMessage, flush };
