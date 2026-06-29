// Reusable outbound-email service (nodemailer over SMTP).
//
// Configuration is env-driven (SMTP_HOST/PORT/USER/PASS/FROM) and works with any
// SMTP provider. For Resend (https://resend.com):
//   SMTP_HOST=smtp.resend.com  SMTP_PORT=465  SMTP_USER=resend  SMTP_PASS=<api key>
//   SMTP_FROM=noreply@mera-tax.com   (must be on a Resend-verified domain)
//
// When SMTP_HOST/SMTP_PORT are unset, the service is "not configured": callers
// should treat that as a no-op (e.g. the admin reminders stay audit-only).

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let _transporter;
let _resolved = false;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

function defaultFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'support@mera-tax.com';
}

function getTransporter() {
  if (_resolved) return _transporter;
  _resolved = true;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT) {
    _transporter = null;
    return null;
  }

  const port = parseInt(SMTP_PORT, 10);
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // implicit TLS on 465; STARTTLS on 587
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return _transporter;
}

function notConfiguredError() {
  const err = new Error('SMTP not configured (set SMTP_HOST and SMTP_PORT).');
  err.code = 'SMTP_NOT_CONFIGURED';
  return err;
}

// Verify the SMTP connection/credentials without sending anything.
async function verifyConnection() {
  const transporter = getTransporter();
  if (!transporter) throw notConfiguredError();
  return transporter.verify();
}

// Send an email. Throws SMTP_NOT_CONFIGURED if no SMTP is set up.
async function sendMail({ to, subject, text, html, from }) {
  const transporter = getTransporter();
  if (!transporter) throw notConfiguredError();
  const info = await transporter.sendMail({
    from: from || defaultFrom(),
    to,
    subject,
    text,
    html,
  });
  logger.info(`email sent to ${to} (messageId=${info?.messageId || 'n/a'})`);
  return info;
}

// Test-only reset so a changed env can be re-read between runs.
function _resetForTests() {
  _transporter = undefined;
  _resolved = false;
}

module.exports = { isConfigured, defaultFrom, getTransporter, verifyConnection, sendMail, _resetForTests };
