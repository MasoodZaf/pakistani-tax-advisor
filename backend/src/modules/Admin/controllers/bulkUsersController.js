// bulkUsersController — tax-consultant (and super_admin) bulk user operations:
//   * GET    /api/admin/users/bulk-template  → download the blank .xlsx
//   * POST   /api/admin/users/bulk-import     → create many users from an .xlsx
//   * POST   /api/admin/users/bulk-delete     → SOFT-delete (deactivate) many users
//
// Design decisions (locked 2026-06-10):
//   * Bulk-imported users get a RANDOM temporary password and must_reset_password=true,
//     so they're forced to set a new one on first login. Temp passwords are returned
//     in the per-row report for the consultant to distribute.
//   * Bulk delete is SOFT (is_active=false, sessions revoked) — recoverable. Hard
//     CASCADE delete stays a single-user, super-admin-guarded action.
//   * Only regular users may be bulk-created or bulk-deleted. Staff rows
//     (admin/super_admin/tax_consultant) are never touched — no escalation path.

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { insertAudit } = require('../../../helpers/auditLog');
const { BCRYPT_ROUNDS } = require('../../../helpers/passwordPolicy');
const { provisionUser } = require('../helpers/provisionUser');

const MAX_IMPORT_ROWS = 1000;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/; // mirrors the users.valid_email CHECK

// The columns the import sheet expects. Header matching is case-insensitive and
// whitespace-tolerant. Name + Email are required; the rest are optional.
const TEMPLATE_COLUMNS = ['Name', 'Email', 'Phone', 'CNIC', 'User Type'];

// A strong random temp password: 16 url-safe chars, guaranteed to contain an
// upper, lower, digit and symbol so it satisfies any password policy on reset.
function generateTempPassword() {
  const base = crypto
    .randomBytes(12)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 12);
  return `${base}A9!z`;
}

// ---- GET /users/bulk-template ------------------------------------------------
const bulkImportTemplate = async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Users');
    ws.addRow(TEMPLATE_COLUMNS);
    ws.getRow(1).font = { bold: true };
    // One example row to show the expected shape (consultant deletes it).
    ws.addRow(['Ali Khan', 'ali.khan@example.com', '03001234567', '3520112345671', 'individual']);
    ws.columns.forEach((c) => {
      c.width = 24;
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="bulk-users-template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('bulk-template error:', error);
    res.status(500).json({ error: 'Failed to generate template', message: error.message });
  }
};

// Map the header row to column indices, tolerant of order/case/spacing.
function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.eachCell((cell, col) => {
    const key = String(cell.value || '')
      .trim()
      .toLowerCase();
    if (key) map[key] = col;
  });
  return {
    name: map['name'],
    email: map['email'],
    phone: map['phone'],
    cnic: map['cnic'],
    userType: map['user type'] || map['user_type'] || map['type'],
  };
}

const cellStr = (row, col) => (col ? String(row.getCell(col).value ?? '').trim() : '');

// ---- POST /users/bulk-import -------------------------------------------------
const bulkImportUsers = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: 'No file', message: 'Upload an .xlsx file in the `file` field' });
  }

  // Parse the workbook.
  let ws;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    ws = wb.worksheets[0];
  } catch (e) {
    return res.status(400).json({
      error: 'Unreadable file',
      message: 'Could not parse the spreadsheet — is it a valid .xlsx?',
    });
  }
  if (!ws || ws.rowCount < 2) {
    return res.status(400).json({ error: 'Empty file', message: 'The sheet has no data rows' });
  }

  const cols = buildHeaderMap(ws.getRow(1));
  if (!cols.name || !cols.email) {
    return res.status(400).json({
      error: 'Missing columns',
      message: 'The sheet must have at least "Name" and "Email" header columns',
    });
  }

  const dataRowCount = ws.rowCount - 1;
  if (dataRowCount > MAX_IMPORT_ROWS) {
    return res.status(400).json({
      error: 'Too many rows',
      message: `Limit is ${MAX_IMPORT_ROWS} users per import; the file has ${dataRowCount}`,
    });
  }

  const results = [];
  const seenEmails = new Set();
  const seenNames = new Set();
  let created = 0;
  let skipped = 0;
  let failed = 0;

  const client = await pool.connect();
  try {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const name = cellStr(row, cols.name);
      const email = cellStr(row, cols.email).toLowerCase();
      const phone = cellStr(row, cols.phone);
      const cnic = cellStr(row, cols.cnic);
      const userType = cellStr(row, cols.userType) || 'individual';

      // Blank rows (trailing) — skip silently.
      if (!name && !email) continue;

      const record = { row: r, name, email };

      // --- JS-side validation (cheap, before touching the DB) -----------------
      if (!name || !email) {
        failed++;
        results.push({ ...record, status: 'error', message: 'Name and Email are required' });
        continue;
      }
      if (!EMAIL_RE.test(email)) {
        failed++;
        results.push({ ...record, status: 'error', message: 'Invalid email format' });
        continue;
      }
      if (seenEmails.has(email)) {
        skipped++;
        results.push({ ...record, status: 'skipped', message: 'Duplicate email within the file' });
        continue;
      }
      if (seenNames.has(name.toLowerCase())) {
        skipped++;
        results.push({ ...record, status: 'skipped', message: 'Duplicate name within the file' });
        continue;
      }
      seenEmails.add(email);
      seenNames.add(name.toLowerCase());

      // --- DB work, isolated per-row via a SAVEPOINT so one bad row can't abort
      //     the whole batch -----------------------------------------------------
      try {
        await client.query('SAVEPOINT bulk_row');

        const dupEmail = await client.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
        if (dupEmail.rows.length > 0) {
          await client.query('RELEASE SAVEPOINT bulk_row');
          skipped++;
          results.push({ ...record, status: 'skipped', message: 'Email already exists' });
          continue;
        }
        const dupName = await client.query(
          'SELECT 1 FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = true',
          [name]
        );
        if (dupName.rows.length > 0) {
          await client.query('RELEASE SAVEPOINT bulk_row');
          skipped++;
          results.push({ ...record, status: 'skipped', message: 'Name already in use' });
          continue;
        }

        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
        const newUser = await provisionUser(client, {
          email,
          name,
          passwordHash,
          userType,
          role: 'user',
          mustResetPassword: true,
        });

        // Optional contact fields aren't part of provisionUser's core insert.
        if (phone || cnic) {
          await client.query(
            "UPDATE users SET phone = COALESCE(NULLIF($1, ''), phone), cnic = COALESCE(NULLIF($2, ''), cnic) WHERE id = $3",
            [phone, cnic, newUser.id]
          );
        }

        await client.query('RELEASE SAVEPOINT bulk_row');
        created++;
        results.push({ ...record, status: 'created', userId: newUser.id, tempPassword });
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT bulk_row');
        failed++;
        logger.warn(`bulk-import row ${r} failed: ${e.message}`);
        results.push({ ...record, status: 'error', message: 'Could not create user' });
      }
    }

    // Summary audit (mandatory — outside any per-row savepoint).
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'bulk_import',
      tableName: 'users',
      newValue: { created, skipped, failed, total: created + skipped + failed },
      category: 'bulk_user_import',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    logger.info(
      `Bulk import by ${req.user.email}: ${created} created, ${skipped} skipped, ${failed} failed`
    );
    res.json({ success: true, summary: { created, skipped, failed }, results });
  } catch (error) {
    logger.error('bulk-import error:', error);
    res.status(500).json({ error: 'Bulk import failed', message: error.message });
  } finally {
    client.release();
  }
};

// ---- POST /users/bulk-delete (soft) ------------------------------------------
const bulkDeleteUsers = async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res
      .status(400)
      .json({ error: 'No users', message: 'Provide a non-empty `userIds` array' });
  }
  if (userIds.length > MAX_IMPORT_ROWS) {
    return res
      .status(400)
      .json({ error: 'Too many', message: `Limit is ${MAX_IMPORT_ROWS} per call` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Soft-delete only regular, currently-active users that aren't the caller.
    // Staff rows are excluded by the role filter — they can't be bulk-deactivated.
    // Bumping token_version revokes any live sessions for the deactivated users.
    const result = await client.query(
      `
      UPDATE users
         SET is_active = false,
             token_version = COALESCE(token_version, 0) + 1,
             updated_at = NOW()
       WHERE id = ANY($1::uuid[])
         AND id <> $2
         AND role NOT IN ('admin', 'super_admin', 'tax_consultant')
         AND is_active = true
      RETURNING id, email
    `,
      [userIds, req.user.id]
    );

    const deactivated = result.rows.map((r) => r.id);
    const skipped = userIds.filter((id) => !deactivated.includes(id));

    await insertAudit(client, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'bulk_soft_delete',
      tableName: 'users',
      newValue: {
        deactivated_count: deactivated.length,
        deactivated_ids: deactivated,
        skipped_count: skipped.length,
      },
      category: 'bulk_user_delete',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    await client.query('COMMIT');
    logger.info(
      `Bulk soft-delete by ${req.user.email}: ${deactivated.length} deactivated, ${skipped.length} skipped`
    );
    res.json({
      success: true,
      summary: { deactivated: deactivated.length, skipped: skipped.length },
      deactivated,
      skipped,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('bulk-delete error:', error);
    res.status(500).json({ error: 'Bulk delete failed', message: error.message });
  } finally {
    client.release();
  }
};

module.exports = { bulkImportTemplate, bulkImportUsers, bulkDeleteUsers };
