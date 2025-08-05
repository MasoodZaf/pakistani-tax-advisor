const bcrypt = require('bcrypt');
const { pool } = require('./src/config/database');

(async () => {
  try {
    const email = 'admin@demo.pk';
    const username = 'admin';
    const password = 'admin123';
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if admin already exists
    const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    
    if (existingAdmin.rows.length > 0) {
      // Update existing admin
      await pool.query(
        'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
        [passwordHash, email]
      );
      console.log('Updated existing admin user:', email);
    } else {
      // Create new admin
      await pool.query(`
        INSERT INTO admin_users (email, username, password_hash, role_id, is_active)
        VALUES ($1, $2, $3, 
          (SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1), 
          true)
      `, [email, username, passwordHash]);
      console.log('Created new admin user:', email);
    }
    
    console.log('Admin credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();