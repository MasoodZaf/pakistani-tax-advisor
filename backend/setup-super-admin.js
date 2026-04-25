/**
 * Setup script:
 * 1. Creates superadmin@paktax.com as super_admin (or updates if email exists)
 * 2. Demotes ALL other admin/super_admin accounts to 'user' role
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TARGET_EMAIL    = 'superadmin@paktax.com';
const TARGET_PASSWORD = 'SuperAdmin@2025';
const TARGET_NAME     = 'Super Admin';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Show current state
    const current = await client.query(
      "SELECT id, name, email, role FROM users WHERE role IN ('admin','super_admin') ORDER BY role, created_at"
    );
    console.log('\n📋 Current admin/super_admin accounts:');
    current.rows.forEach(u => console.log(`   [${u.role}] ${u.name} <${u.email}>`));

    // 2. Demote ALL existing admin/super_admin to 'user'
    const demoted = await client.query(
      "UPDATE users SET role='user', updated_at=NOW() WHERE role IN ('admin','super_admin') RETURNING email, name"
    );
    console.log(`\n⬇️  Demoted ${demoted.rows.length} account(s) to 'user':`);
    demoted.rows.forEach(u => console.log(`   - ${u.name} <${u.email}>`));

    // 3. Create or restore superadmin@paktax.com as super_admin
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [TARGET_EMAIL]);
    const hash = await bcrypt.hash(TARGET_PASSWORD, 10);

    let superAdmin;
    if (existing.rows.length > 0) {
      // Update existing account
      const r = await client.query(
        "UPDATE users SET role='super_admin', password_hash=$1, name=$2, is_active=true, updated_at=NOW() WHERE email=$3 RETURNING id, email, name, role",
        [hash, TARGET_NAME, TARGET_EMAIL]
      );
      superAdmin = r.rows[0];
      console.log(`\n✅ Updated existing account to super_admin:`);
    } else {
      // Create fresh
      const r = await client.query(
        "INSERT INTO users (email, name, password_hash, user_type, role, is_active) VALUES ($1,$2,$3,'admin','super_admin',true) RETURNING id, email, name, role",
        [TARGET_EMAIL, TARGET_NAME, hash]
      );
      superAdmin = r.rows[0];
      console.log(`\n✅ Created new super_admin account:`);
    }

    await client.query('COMMIT');

    console.log('─────────────────────────────────────────');
    console.log(`   Name:     ${superAdmin.name}`);
    console.log(`   Email:    ${superAdmin.email}`);
    console.log(`   Password: ${TARGET_PASSWORD}`);
    console.log(`   Role:     ${superAdmin.role}`);
    console.log('─────────────────────────────────────────');
    console.log('\n⚠️  Change this password after first login!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
