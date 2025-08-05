const bcrypt = require('bcrypt');
const { pool } = require('./src/config/database');

(async () => {
  try {
    const result = await pool.query('SELECT email, password_hash FROM admin_users WHERE email = $1', ['superadmin@taxadvisor.pk']);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User found:', user.email);
      
      // Test the original password
      const match = await bcrypt.compare('SecureAdmin2025!', user.password_hash);
      console.log('Password "SecureAdmin2025!" match:', match);
      
      if (!match) {
        console.log('Testing alternative passwords...');
        const altPasswords = ['admin123', 'password', 'admin', 'superadmin'];
        for (const pwd of altPasswords) {
          const altMatch = await bcrypt.compare(pwd, user.password_hash);
          console.log(`Password "${pwd}" match:`, altMatch);
        }
      }
    } else {
      console.log('No admin user found with that email');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();