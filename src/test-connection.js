require('dotenv').config();
const { pool } = require('./config/database');

async function testConnection() {
  let client;
  try {
    // Test database connection
    client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database');

    // Test a simple query
    const result = await client.query('SELECT NOW()');
    console.log('Database query successful:', result.rows[0]);

    // Test users table
    const usersResult = await client.query('SELECT COUNT(*) FROM users');
    console.log('Users table count:', usersResult.rows[0].count);

  } catch (error) {
    console.error('Database connection/query error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('Database connection closed');
    }
  }
}

// Run the test
testConnection()
  .then(() => {
    console.log('All database tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 