/**
 * Recovery script — DESTRUCTIVE.
 *
 *   1. Demotes ALL existing admin/super_admin accounts to 'user'
 *   2. Creates or restores a single super_admin from env-supplied credentials
 *
 * Use only to recover from a locked-out admin panel. Routine super-admin
 * creation should go through `create-super-admin.js` (idempotent, additive).
 *
 * Run from the backend directory with the required env vars:
 *
 *   SUPER_ADMIN_EMAIL=you@example.com \
 *   SUPER_ADMIN_PASSWORD="$(node -e 'console.log(require("crypto").randomBytes(18).toString("base64"))')" \
 *   CONFIRM_DEMOTE_ALL_ADMINS=YES \
 *   node setup-super-admin.js
 *
 * In production (NODE_ENV=production) the script refuses to run unless
 * CONFIRM_DEMOTE_ALL_ADMINS=YES is also set — the demote-all step is
 * silently destructive and easy to fire by accident.
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { BCRYPT_ROUNDS, validatePasswordPolicy } = require('./src/helpers/passwordPolicy');

if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
  console.error('\n❌ SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required.');
  console.error('\nExample (run from backend/):');
  console.error('  SUPER_ADMIN_EMAIL=you@example.com \\');
  console.error('  SUPER_ADMIN_PASSWORD="$(node -e \"console.log(require(\\\"crypto\\\").randomBytes(18).toString(\\\"base64\\\"))\")" \\');
  console.error('  CONFIRM_DEMOTE_ALL_ADMINS=YES \\');
  console.error('  node setup-super-admin.js\n');
  process.exit(1);
}

if (process.env.CONFIRM_DEMOTE_ALL_ADMINS !== 'YES') {
  console.error('\n❌ This script DEMOTES every existing admin/super_admin to "user" before');
  console.error('   re-creating the super_admin. Re-run with:');
  console.error('     CONFIRM_DEMOTE_ALL_ADMINS=YES node setup-super-admin.js');
  console.error('\n   For routine super-admin creation (no demote), use create-super-admin.js instead.\n');
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

const TARGET_EMAIL    = process.env.SUPER_ADMIN_EMAIL;
const TARGET_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const TARGET_NAME     = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

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

    // 3. Create or restore the configured email as super_admin
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [TARGET_EMAIL]);
    const hash = await bcrypt.hash(TARGET_PASSWORD, BCRYPT_ROUNDS);

    let superAdmin;
    if (existing.rows.length > 0) {
      const r = await client.query(
        "UPDATE users SET role='super_admin', password_hash=$1, name=$2, is_active=true, updated_at=NOW() WHERE email=$3 RETURNING id, email, name, role",
        [hash, TARGET_NAME, TARGET_EMAIL]
      );
      superAdmin = r.rows[0];
      console.log(`\n✅ Updated existing account to super_admin:`);
    } else {
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
    console.log(`   Role:     ${superAdmin.role}`);
    console.log('─────────────────────────────────────────');
    console.log('\n⚠️  Log in with the password you supplied via SUPER_ADMIN_PASSWORD, then rotate it.\n');

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
