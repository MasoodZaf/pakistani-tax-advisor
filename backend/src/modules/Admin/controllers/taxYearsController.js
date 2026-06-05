const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const { insertAudit } = require('../../../helpers/auditLog');

const getTaxYears = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, tax_year, is_current, is_active,
        start_date, end_date, filing_deadline, created_at,
        (SELECT COUNT(*) FROM tax_returns WHERE tax_year_id = tax_years.id) as returns_count,
        (SELECT COUNT(*) FROM tax_slabs WHERE tax_year_id = tax_years.id) as slabs_count
      FROM tax_years
      ORDER BY tax_year DESC
    `);

    res.json({
      success: true,
      data: result.rows,
      message: 'Tax years retrieved successfully'
    });

  } catch (error) {
    logger.error('Get tax years error:', error);
    res.status(500).json({
      error: 'Failed to retrieve tax years',
      message: error.message
    });
  }
};

const updateTaxYearStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { isActive, isCurrent } = req.body;

    // If setting as current, unset all other current tax years
    if (isCurrent) {
      await client.query(`
        UPDATE tax_years SET is_current = false WHERE id != $1
      `, [id]);
    }

    // Update the tax year. `tax_years` has no `updated_at` column — older
    // code added it speculatively and 500'd on every toggle.
    const result = await client.query(`
      UPDATE tax_years
      SET is_active = $1, is_current = $2
      WHERE id = $3
      RETURNING *
    `, [isActive, isCurrent, id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Tax year not found',
        message: `Tax year with ID ${id} does not exist`
      });
    }

    // Log the change
    await client.query(`
      INSERT INTO audit_log (
        user_id, user_email, action, table_name, record_id,
        field_name, new_value, category
      ) VALUES ($1, $2, 'update', 'tax_years', $3, $4, $5, $6)
    `, [
      req.user.id, req.user.email, id,
      'status_update', JSON.stringify({ isActive, isCurrent }),
      'tax_year_status_update'
    ]);

    await client.query('COMMIT');

    logger.info(`Tax year ${result.rows[0].tax_year} status updated by admin ${req.user.email}`);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Tax year status updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Update tax year status error:', error);
    res.status(500).json({
      error: 'Failed to update tax year status',
      message: error.message
    });
  } finally {
    client.release();
  }
};

const createTaxYear = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { taxYear, startDate, endDate, filingDeadline, isCurrent, description } = req.body;
    if (!taxYear) return res.status(400).json({ error: 'taxYear is required (format: YYYY-YY)' });

    if (isCurrent) await pool.query('UPDATE tax_years SET is_current=false');

    const result = await pool.query(`
      INSERT INTO tax_years (tax_year, start_date, end_date, filing_deadline, is_current, is_active, description)
      VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING *
    `, [taxYear, startDate || null, endDate || null, filingDeadline || null, !!isCurrent, description || null]);

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'create','tax_years',$3,$4,'tax_management',$5)`,
      [req.user.id, req.user.email, result.rows[0].id, JSON.stringify({ taxYear, isCurrent }),
       `Tax year created: ${taxYear}`]);

    res.status(201).json({ success: true, data: result.rows[0], message: `Tax year ${taxYear} created` });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: `Tax year ${req.body.taxYear} already exists` });
    logger.error('Create tax year error:', error);
    res.status(500).json({ error: 'Failed to create tax year', message: error.message });
  }
};

const updateTaxYear = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { isActive, isCurrent, filingDeadline, description } = req.body;

    // Snapshot pre-state for the audit entry.
    const beforeRow = await pool.query('SELECT * FROM tax_years WHERE id=$1', [id]);
    if (!beforeRow.rows.length) return res.status(404).json({ error: 'Tax year not found' });

    if (isCurrent) await pool.query('UPDATE tax_years SET is_current=false WHERE id!=$1', [id]);

    const result = await pool.query(`
      UPDATE tax_years SET
        is_active=COALESCE($1,is_active), is_current=COALESCE($2,is_current),
        filing_deadline=COALESCE($3,filing_deadline), description=COALESCE($4,description)
      WHERE id=$5 RETURNING *
    `, [isActive, isCurrent, filingDeadline || null, description || null, id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Tax year not found' });

    // Audit — tax-year changes affect every filer's slabs/surcharge/CGT
    // rates and which return is "current". Mandatory so the change isn't
    // silently committed if the audit insert fails.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'tax_year_update',
      tableName: 'tax_years',
      recordId: id,
      oldValue: beforeRow.rows[0],
      newValue: result.rows[0],
      category: 'tax_management',
      severity: 'high',
      changeSummary: `Tax year ${result.rows[0].tax_year} updated by ${req.user.email}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      mandatory: true,
    });

    res.json({ success: true, data: result.rows[0], message: 'Tax year updated' });
  } catch (error) {
    logger.error('Update tax year error:', error);
    res.status(500).json({ error: 'Failed to update tax year', message: error.message });
  }
};

module.exports = {
  getTaxYears,
  updateTaxYearStatus,
  createTaxYear,
  updateTaxYear,
};
