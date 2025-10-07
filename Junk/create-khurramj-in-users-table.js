const { pool } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function createKhurramJUser() {
  try {
    console.log('Creating KhurramJ account in users table...');

    // Check if the user already exists
    const existingCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['khurramj@taxadvisor.pk']
    );

    if (existingCheck.rows.length > 0) {
      console.log('User KhurramJ already exists in users table. Updating password...');

      // Hash the new password
      const hashedPassword = await bcrypt.hash('123456', 10);

      // Update the existing user
      await pool.query(
        `UPDATE users
         SET password_hash = $1,
             role = 'super_admin',
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $2`,
        [hashedPassword, 'khurramj@taxadvisor.pk']
      );

      console.log('✅ KhurramJ account password updated successfully!');
    } else {
      console.log('Creating new KhurramJ account in users table...');

      // Hash the password
      const hashedPassword = await bcrypt.hash('123456', 10);

      // Insert new user
      const result = await pool.query(`
        INSERT INTO users (
          email,
          name,
          password_hash,
          role,
          user_type,
          is_active,
          permissions,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, email, name, role
      `, [
        'khurramj@taxadvisor.pk',
        'Khurram Javed',
        hashedPassword,
        'super_admin',
        'individual',
        true,
        JSON.stringify({
          "users": {"create": true, "read": true, "update": true, "delete": true},
          "organizations": {"create": true, "read": true, "update": true, "delete": true},
          "tax_years": {"create": true, "read": true, "update": true, "delete": true},
          "tax_returns": {"create": true, "read": true, "update": true, "delete": true},
          "reports": {"create": true, "read": true, "export": true},
          "settings": {"update": true},
          "audit_logs": {"read": true}
        })
      ]);

      console.log('✅ KhurramJ account created successfully in users table!');
      console.log('User ID:', result.rows[0].id);
    }

    // Verify the account was created/updated
    const verification = await pool.query(`
      SELECT id, email, name, role, user_type, is_active, permissions
      FROM users
      WHERE email = $1
    `, ['khurramj@taxadvisor.pk']);

    if (verification.rows.length > 0) {
      const user = verification.rows[0];
      console.log('\n📋 Account Details:');
      console.log('Email:', user.email);
      console.log('Name:', user.name);
      console.log('Role:', user.role);
      console.log('User Type:', user.user_type);
      console.log('Active:', user.is_active);
      console.log('Permissions:', JSON.stringify(user.permissions, null, 2));

      console.log('\n🔐 Login Credentials:');
      console.log('Email: khurramj@taxadvisor.pk');
      console.log('Password: 123456');
    }

  } catch (error) {
    console.error('❌ Error creating KhurramJ account:', error);
    throw error;
  }
}

// Run the function
createKhurramJUser()
  .then(() => {
    console.log('\n✅ KhurramJ account creation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ KhurramJ account creation failed:', error);
    process.exit(1);
  });