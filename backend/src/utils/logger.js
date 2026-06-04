const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Mask PII that leaks into log VALUES, not just keys (OBS-06). Many call sites
// interpolate identifiers straight into the message string
// (e.g. `Login attempt for: ${email}`), which a key-based redactor can't catch.
// We mask email addresses and CNIC numbers in every string value, including the
// `message` field. Email keeps the first char + domain so logs stay correlatable
// (a***@example.com); CNICs (13 digits, optionally 5-7-1 dashed) are fully masked.
const EMAIL_RE = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const CNIC_RE = /\b\d{5}-?\d{7}-?\d\b/g;
const maskPII = (s) =>
  s.replace(EMAIL_RE, '$1***$2').replace(CNIC_RE, '[REDACTED_CNIC]');

// Redact keys that sometimes leak into error objects / request bodies, and mask
// PII inside string values. Defensive — code shouldn't be logging these, but
// belt-and-suspenders.
const redactSensitive = winston.format((info) => {
  const SENSITIVE_KEYS = new Set([
    'password', 'password_hash', 'newPassword', 'currentPassword',
    'token', 'jwt', 'authorization', 'Authorization', 'cookie', 'Cookie',
  ]);
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (SENSITIVE_KEYS.has(k)) {
        obj[k] = '[REDACTED]';
      } else if (typeof obj[k] === 'string') {
        obj[k] = maskPII(obj[k]);
      } else if (typeof obj[k] === 'object') {
        walk(obj[k]);
      }
    }
  };
  walk(info);
  return info;
})();

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    redactSensitive,
    isProd ? winston.format.json() : winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  ),
});

// Rotating file transports — keep disk from growing unbounded.
//   combined.log — all levels; 20 MB/file, 14 days retention, gzip on rotation
//   error.log    — errors only; 20 MB/file, 30 days retention, gzip on rotation
const logDir = path.join(__dirname, '../../logs');

const combinedRotate = new DailyRotateFile({
  dirname: logDir,
  filename: 'combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',
  format: winston.format.combine(redactSensitive, logFormat),
});

const errorRotate = new DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(redactSensitive, logFormat),
});

const logger = winston.createLogger({
  level: isProd ? 'info' : 'debug',
  format: logFormat,
  transports: [consoleTransport, combinedRotate, errorRotate],
});

module.exports = logger;
