const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { BCRYPT_ROUNDS, validatePasswordPolicy } = require('../../../helpers/passwordPolicy');

// The three staff roles a super_admin manages here. tax_consultant joined in
// phase-z6 but this controller's whitelists predated it — consultants could
// only be seeded by SQL until now.
const MANAGED_ROLES = ['admin', 'super_admin', 'tax_consultant'];

const listAdminAccounts = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    // client_count surfaces how many clients each consultant currently holds
    // (always 0 for admin/super_admin) — useful before deactivating one.
    const result = await pool.query(`
      SELECT u.id, u.email, u.name, u.role, u.user_type, u.is_active, u.created_at,
             u.last_login_at, u.created_by,
             COUNT(cc.client_id) as client_count
      FROM users u
      LEFT JOIN consultant_clients cc ON cc.consultant_id = u.id
      WHERE u.role IN ('admin','super_admin','tax_consultant')
      GROUP BY u.id
      ORDER BY CASE u.role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Get admin accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch admin accounts', message: error.message });
  }
};

const createAdminAccount = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { email, name, password, role = 'admin' } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'email, name and password are required' });
    if (!MANAGED_ROLES.includes(role)) return res.status(400).json({ error: 'Role must be admin, super_admin or tax_consultant' });

    const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'A user with this email already exists' });

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await client.query(`
      INSERT INTO users (email, name, password_hash, user_type, role, is_active, created_by)
      VALUES ($1, $2, $3, 'admin', $4, true, $5)
      RETURNING id, email, name, role, user_type, is_active, created_at
    `, [email, name, passwordHash, role, req.user.id]);

    await client.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'create','users',$3,$4,'admin_management',$5)
    `, [req.user.id, req.user.email, result.rows[0].id,
        JSON.stringify({ email, name, role }),
        `Admin account created: ${name} (${email}) with role ${role}`]);

    await client.query('COMMIT');
    logger.info(`Admin account created by ${req.user.email}: ${email} (${role})`);
    res.status(201).json({ success: true, data: result.rows[0], message: `Admin account created successfully` });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create admin account error:', error);
    res.status(500).json({ error: 'Failed to create admin account', message: error.message });
  } finally {
    client.release();
  }
};

const updateAdminAccount = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { name, email, role, is_active } = req.body;

    // Target must be a staff account — this endpoint must not become a back
    // door for editing regular users (those go through /users/:id with its
    // consultant scoping).
    const existing = await pool.query(
      `SELECT * FROM users WHERE id=$1 AND role IN ('admin','super_admin','tax_consultant')`, [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Admin account not found' });
    if (id === req.user.id && is_active === false) return res.status(400).json({ error: 'Cannot deactivate your own account' });
    if (id === req.user.id && role && role !== 'super_admin') return res.status(400).json({ error: 'Cannot change your own role' });
    // Previously unvalidated — any string could be written into users.role.
    if (role !== undefined && !MANAGED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Role must be admin, super_admin or tax_consultant' });
    }

    const updates = [];
    const vals = [];
    let p = 1;
    if (name !== undefined)      { updates.push(`name=$${p++}`);      vals.push(name); }
    if (email !== undefined)     { updates.push(`email=$${p++}`);     vals.push(email); }
    if (role !== undefined)      { updates.push(`role=$${p++}`);      vals.push(role); }
    if (is_active !== undefined) { updates.push(`is_active=$${p++}`); vals.push(is_active); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at=NOW()`);
    vals.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(',')} WHERE id=$${p} RETURNING id,email,name,role,is_active,updated_at`,
      vals
    );

    // A consultant leaving the role releases their clients back to independent
    // status — stale assignment rows would keep showing "your consultant" to
    // clients while the scoping no longer applies to the demoted account.
    if (existing.rows[0].role === 'tax_consultant' && role !== undefined && role !== 'tax_consultant') {
      const released = await pool.query(
        'DELETE FROM consultant_clients WHERE consultant_id = $1 RETURNING client_id', [id]
      );
      if (released.rows.length) {
        logger.info(`Released ${released.rows.length} client(s) from demoted consultant ${existing.rows[0].email}`);
      }
    }

    await pool.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'update','users',$3,$4,'admin_management',$5)
    `, [req.user.id, req.user.email, id, JSON.stringify({ name, email, role, is_active }),
        `Admin account updated: ${existing.rows[0].email}`]);

    res.json({ success: true, data: result.rows[0], message: 'Admin account updated' });
  } catch (error) {
    logger.error('Update admin account error:', error);
    res.status(500).json({ error: 'Failed to update admin account', message: error.message });
  }
};

const resetAdminPassword = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const existing = await pool.query(
      `SELECT * FROM users WHERE id=$1 AND role IN ('admin','super_admin','tax_consultant')`, [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Admin account not found' });

    const policy = validatePasswordPolicy(newPassword, { email: existing.rows[0].email });
    if (!policy.ok) return res.status(400).json({ error: policy.message });

    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, id]);

    await pool.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'password_reset','users',$3,$4,'admin_management',$5)
    `, [req.user.id, req.user.email, id, JSON.stringify({ by: req.user.email }),
        `Password reset for admin: ${existing.rows[0].email}`]);

    logger.info(`Password reset for admin ${existing.rows[0].email} by ${req.user.email}`);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset admin password error:', error);
    res.status(500).json({ error: 'Failed to reset password', message: error.message });
  }
};

module.exports = {
  listAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  resetAdminPassword,
};
