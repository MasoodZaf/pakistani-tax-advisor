/**
 * One-time script to create the Super Admin account.
 * Run from the backend directory:
 *   node create-super-admin.js
 *
 * Or with custom credentials:
 *   SUPER_ADMIN_EMAIL=admin@example.com SUPER_ADMIN_PASSWORD=SecurePass123 node create-super-admin.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { BCRYPT_ROUNDS, validatePasswordPolicy } = require('./src/helpers/passwordPolicy');

if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
  console.error('\n❌ SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required.');
  console.error('\nExample:');
  console.error('  SUPER_ADMIN_EMAIL=you@example.com \\');
  console.error('  SUPER_ADMIN_PASSWORD="$(node -e \"console.log(require(\\\"crypto\\\").randomBytes(18).toString(\\\"base64\\\"))\")" \\');
  console.error('  node create-super-admin.js\n');
  process.exit(1);
}

const policyCheck = validatePasswordPolicy(process.env.SUPER_ADMIN_PASSWORD, {
  email: process.env.SUPER_ADMIN_EMAIL,
});
if (!policyCheck.ok) {
  console.error(`\n❌ ${policyCheck.message}\n`);
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMAIL    = process.env.SUPER_ADMIN_EMAIL;
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const NAME     = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking for existing super_admin accounts...');
    const existing = await client.query(
      "SELECT id, email, name FROM users WHERE role='super_admin'"
    );

    if (existing.rows.length > 0) {
      console.log('\n⚠️  Super Admin already exists:');
      existing.rows.forEach(u => console.log(`   - ${u.name} <${u.email}>`));
      console.log('\nTo create an additional super_admin, use the Admin Panel → Admin Accounts section.');
      return;
    }

    const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
    const result = await client.query(`
      INSERT INTO users (email, name, password_hash, user_type, role, is_active)
      VALUES ($1, $2, $3, 'admin', 'super_admin', true)
      RETURNING id, email, name, role
    `, [EMAIL, NAME, hash]);

    const created = result.rows[0];
    console.log('\n✅ Super Admin created successfully!');
    console.log('─────────────────────────────────────');
    console.log(`   Name:     ${created.name}`);
    console.log(`   Email:    ${created.email}`);
    console.log(`   Role:     ${created.role}`);
    console.log(`   ID:       ${created.id}`);
    console.log('─────────────────────────────────────');
    console.log('\n⚠️  Log in with the password you supplied via SUPER_ADMIN_PASSWORD, then change it.');

  } catch (error) {
    if (error.code === '23505') {
      console.error(`\n❌ A user with email "${EMAIL}" already exists.`);
      console.error('   Set a different email using SUPER_ADMIN_EMAIL env variable.');
    } else {
      console.error('\n❌ Error creating super admin:', error.message);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
