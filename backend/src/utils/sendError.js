const logger = require('./logger');
const crypto = require('crypto');
const sentry = require('./sentry');

const isProd = () => process.env.NODE_ENV === 'production';

function sendError(res, status, publicMessage, err) {
  const requestId = crypto.randomBytes(6).toString('hex');
  logger.error(`[${requestId}] ${publicMessage}`, {
    errMessage: err?.message,
    errCode: err?.code,
    stack: err?.stack,
  });
  // Ship 5xx errors to Sentry (if enabled). 4xx errors are client-side noise
  // and not useful as alerts.
  if (status >= 500 && err) {
    sentry.captureException(err, { requestId, publicMessage });
  }
  const body = { success: false, message: publicMessage, requestId };
  if (!isProd() && err) {
    body.error = err.message;
  }
  res.status(status).json(body);
}

function expressErrorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const publicMessage = status >= 500 ? 'Internal server error' : (err.publicMessage || 'Request failed');
  sendError(res, status, publicMessage, err);
}

module.exports = { sendError, expressErrorHandler };
