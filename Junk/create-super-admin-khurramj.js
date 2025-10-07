const { pool } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function createSuperAdmin() {
  try {
    console.log('Creating super admin account for KhurramJ...');

    // Check if the username already exists
    const existingCheck = await pool.query(
      'SELECT id FROM admin_users WHERE username = $1 OR email = $2',
      ['KhurramJ', 'khurramj@taxadvisor.pk']
    );

    if (existingCheck.rows.length > 0) {
      console.log('User KhurramJ already exists. Updating password...');

      // Hash the new password
      const hashedPassword = await bcrypt.hash('123456', 10);

      // Update the existing user
      await pool.query(
        `UPDATE admin_users
         SET password_hash = $1,
             is_active = true,
             account_locked = false,
             login_attempts = 0,
             updated_at = CURRENT_TIMESTAMP,
             password_changed_at = CURRENT_TIMESTAMP
         WHERE username = $2`,
        [hashedPassword, 'KhurramJ']
      );

      console.log('✅ Super admin account KhurramJ password updated successfully!');
    } else {
      console.log('Creating new super admin account...');

      // Get super_admin role ID
      const roleResult = await pool.query(
        'SELECT id FROM roles WHERE name = $1',
        ['super_admin']
      );

      if (roleResult.rows.length === 0) {
        throw new Error('Super admin role not found in database');
      }

      const superAdminRoleId = roleResult.rows[0].id;

      // Hash the password
      const hashedPassword = await bcrypt.hash('123456', 10);

      // Insert new super admin user
      const result = await pool.query(`
        INSERT INTO admin_users (
          username,
          email,
          password_hash,
          role_id,
          is_active,
          password_changed_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING id, username, email
      `, [
        'KhurramJ',
        'khurramj@taxadvisor.pk',
        hashedPassword,
        superAdminRoleId,
        true
      ]);

      console.log('✅ Super admin account created successfully!');
      console.log('User ID:', result.rows[0].id);
    }

    // Verify the account was created/updated
    const verification = await pool.query(`
      SELECT au.id, au.username, au.email, au.is_active, r.name as role_name, r.permissions
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.username = $1
    `, ['KhurramJ']);

    if (verification.rows.length > 0) {
      const user = verification.rows[0];
      console.log('\n📋 Account Details:');
      console.log('Username:', user.username);
      console.log('Email:', user.email);
      console.log('Role:', user.role_name);
      console.log('Active:', user.is_active);
      console.log('Permissions:', JSON.stringify(user.permissions, null, 2));

      console.log('\n🔐 Login Credentials:');
      console.log('Username: KhurramJ');
      console.log('Password: 123456');
      console.log('Email: khurramj@taxadvisor.pk');
    }

  } catch (error) {
    console.error('❌ Error creating super admin account:', error);
    throw error;
  }
}

// Run the function
createSuperAdmin()
  .then(() => {
    console.log('\n✅ Super admin creation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Super admin creation failed:', error);
    process.exit(1);
  });