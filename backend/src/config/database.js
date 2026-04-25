const { Pool } = require('pg');
const logger = require('../utils/logger');

if (!process.env.DB_PASSWORD) {
  throw new Error(
    'DB_PASSWORD environment variable is required. Set it in your .env or deploy config — no default will be used.'
  );
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  // Fail a connection attempt fast rather than hanging a request.
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT) || 5000,
  // Server-side statement timeout — a runaway query won't hold a client forever.
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
  // Enable SSL in production (Render / Railway / most managed providers).
  // Local / containerized Postgres usually doesn't have a cert we can verify,
  // so keep rejectUnauthorized:false here. Prefer a real CA in hardened envs.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

// Log idle-client errors but DO NOT exit — transient network blips shouldn't
// take down the whole API. The pool will reconnect on demand.
pool.on('error', (err) => {
  logger.error('Unexpected error on idle pg client', { message: err?.message });
});

module.exports = { pool };
