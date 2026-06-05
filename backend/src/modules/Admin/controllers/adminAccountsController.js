const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { BCRYPT_ROUNDS, validatePasswordPolicy } = require('../../../helpers/passwordPolicy');

const listAdminAccounts = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const result = await pool.query(`
      SELECT id, email, name, role, user_type, is_active, created_at, last_login_at,
             created_by
      FROM users
      WHERE role IN ('admin','super_admin')
      ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, created_at DESC
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
    if (!['admin', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Role must be admin or super_admin' });

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

    const existing = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Admin account not found' });
    if (id === req.user.id && is_active === false) return res.status(400).json({ error: 'Cannot deactivate your own account' });
    if (id === req.user.id && role && role !== 'super_admin') return res.status(400).json({ error: 'Cannot change your own role' });

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

    const existing = await pool.query('SELECT * FROM users WHERE id=$1 AND role IN (\'admin\',\'super_admin\')', [id]);
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
