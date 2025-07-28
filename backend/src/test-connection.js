require('dotenv').config();
const { pool } = require('./config/database');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

async function testConnection() {
  let client;
  try {
    // Test database connection
    client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL database');

    // Test a simple query
    const result = await client.query('SELECT NOW()');
    logger.info('Database query successful:', result.rows[0]);

    // Test users table
    const usersResult = await client.query('SELECT COUNT(*) FROM users');
    logger.info('Users table count:', usersResult.rows[0].count);

    // Test tax_years table
    const taxYearsResult = await client.query('SELECT COUNT(*) FROM tax_years');
    logger.info('Tax years table count:', taxYearsResult.rows[0].count);

    // Test income_forms table
    const incomeFormsResult = await client.query('SELECT COUNT(*) FROM income_forms');
    logger.info('Income forms table count:', incomeFormsResult.rows[0].count);

  } catch (error) {
    logger.error('Database connection/query error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      logger.info('Database connection closed');
    }
  }
}

// Run the test
testConnection()
  .then(() => {
    logger.info('All database tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test failed:', error);
    process.exit(1);
  }); 