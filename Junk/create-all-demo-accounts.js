const { pool } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function createAllDemoAccounts() {
  try {
    console.log('Creating all demo accounts in users table...');

    const demoAccounts = [
      {
        email: 'superadmin@paktaxadvisor.com',
        name: 'Super Administrator',
        password: 'Admin@123',
        role: 'super_admin',
        user_type: 'individual'
      },
      {
        email: 'testuser@paktaxadvisor.com',
        name: 'Test User Demo',
        password: 'TestUser123',
        role: 'user',
        user_type: 'individual'
      }
    ];

    for (const account of demoAccounts) {
      // Check if the user already exists
      const existingCheck = await pool.query(
        'SELECT id, role FROM users WHERE email = $1',
        [account.email]
      );

      if (existingCheck.rows.length > 0) {
        console.log(`User ${account.email} already exists. Updating password and role...`);

        // Hash the password
        const hashedPassword = await bcrypt.hash(account.password, 10);

        // Update the existing user
        await pool.query(
          `UPDATE users
           SET password_hash = $1,
               role = $2,
               name = $3,
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
           WHERE email = $4`,
          [hashedPassword, account.role, account.name, account.email]
        );

        console.log(`✅ ${account.email} updated successfully!`);
      } else {
        console.log(`Creating new account: ${account.email}...`);

        // Hash the password
        const hashedPassword = await bcrypt.hash(account.password, 10);

        // Set permissions based on role
        let permissions = {};
        if (account.role === 'super_admin') {
          permissions = {
            "users": {"create": true, "read": true, "update": true, "delete": true},
            "organizations": {"create": true, "read": true, "update": true, "delete": true},
            "tax_years": {"create": true, "read": true, "update": true, "delete": true},
            "tax_returns": {"create": true, "read": true, "update": true, "delete": true},
            "reports": {"create": true, "read": true, "export": true},
            "settings": {"update": true},
            "audit_logs": {"read": true}
          };
        }

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
          account.email,
          account.name,
          hashedPassword,
          account.role,
          account.user_type,
          true,
          JSON.stringify(permissions)
        ]);

        console.log(`✅ ${account.email} created successfully!`);
        console.log(`   User ID: ${result.rows[0].id}`);
      }
    }

    // Verify all accounts
    const verification = await pool.query(`
      SELECT email, name, role, user_type, is_active
      FROM users
      WHERE email IN ('superadmin@paktaxadvisor.com', 'khurramj@taxadvisor.pk', 'testuser@paktaxadvisor.com')
      ORDER BY role DESC, email
    `);

    console.log('\n📋 All Demo Accounts:');
    verification.rows.forEach(user => {
      console.log(`✅ ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.is_active}`);
      console.log('');
    });

    console.log('🔐 Login Credentials Summary:');
    console.log('1. superadmin@paktaxadvisor.com / Admin@123 (Super Admin)');
    console.log('2. khurramj@taxadvisor.pk / 123456 (Super Admin)');
    console.log('3. testuser@paktaxadvisor.com / TestUser123 (User)');

  } catch (error) {
    console.error('❌ Error creating demo accounts:', error);
    throw error;
  }
}

// Run the function
createAllDemoAccounts()
  .then(() => {
    console.log('\n✅ All demo accounts setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Demo accounts setup failed:', error);
    process.exit(1);
  });