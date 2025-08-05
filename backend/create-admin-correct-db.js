const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// Create a pool specifically for pakistani_tax_advisor database
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pakistani_tax_advisor',
  user: 'masoodzafar',
  password: 'password',
});

(async () => {
  try {
    console.log('Connecting to pakistani_tax_advisor database...');
    
    const email = 'admin@demo.pk';
    const username = 'testadmin';
    const password = 'admin123';
    
    console.log('Creating admin user with credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM admin_users WHERE email = $1', 
      [email]
    );
    
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
    
    // Verify the admin user was created/updated
    const verifyAdmin = await pool.query(`
      SELECT 
        au.id, au.email, au.username, r.name as role
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.email = $1 AND au.is_active = true
    `, [email]);
    
    if (verifyAdmin.rows.length > 0) {
      console.log('Admin user verified:');
      console.log('- ID:', verifyAdmin.rows[0].id);
      console.log('- Email:', verifyAdmin.rows[0].email);
      console.log('- Username:', verifyAdmin.rows[0].username);
      console.log('- Role:', verifyAdmin.rows[0].role);
    } else {
      console.log('ERROR: Admin user verification failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();