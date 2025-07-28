const { Pool } = require('pg');
const winston = require('winston');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'pakistani_tax_advisor',
  user: process.env.DB_USER || 'tax_admin',
  password: process.env.DB_PASSWORD || 'TaxAdv202@pk',
  max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  winston.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  winston.info('Connected to PostgreSQL database');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}; 