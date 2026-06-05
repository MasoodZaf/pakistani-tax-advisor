const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');

const getTaxSlabs = async (req, res) => {
  try {
    const { taxYearId, slabType } = req.query;
    let query = `
      SELECT ts.*, ty.tax_year
      FROM tax_slabs ts
      JOIN tax_years ty ON ts.tax_year_id = ty.id
    `;
    const params = [];
    const conds = [];
    if (taxYearId) { params.push(taxYearId); conds.push(`ts.tax_year_id = $${params.length}`); }
    if (slabType)  { params.push(slabType);  conds.push(`ts.slab_type = $${params.length}`); }
    if (conds.length) query += ' WHERE ' + conds.join(' AND ');
    query += ' ORDER BY ts.slab_order ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Get tax slabs error:', error);
    res.status(500).json({ error: 'Failed to fetch tax slabs', message: error.message });
  }
};

const getTaxSlabTypes = async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT slab_type FROM tax_slabs ORDER BY slab_type');
    res.json({ success: true, data: result.rows.map(r => r.slab_type) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slab types', message: error.message });
  }
};

const createTaxSlab = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from, effective_to } = req.body;
    if (!tax_year_id || slab_order == null || min_income == null || tax_rate == null || !slab_type) {
      return res.status(400).json({ error: 'tax_year_id, slab_order, min_income, tax_rate, slab_type are required' });
    }
    const result = await pool.query(`
      INSERT INTO tax_slabs (tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from, effective_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [tax_year_id, slab_name || `Slab ${slab_order}`, slab_order, min_income, max_income || null, tax_rate, slab_type,
        effective_from || null, effective_to || null]);

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, new_value, category, change_summary)
      VALUES ($1,$2,'create','tax_slabs',$3,$4,'tax_management',$5)`,
      [req.user.id, req.user.email, result.rows[0].id,
       JSON.stringify({ slab_name, min_income, max_income, tax_rate, slab_type }),
       `Tax slab created: ${slab_name} (${slab_type}) for year ${tax_year_id}`]);

    res.status(201).json({ success: true, data: result.rows[0], message: 'Tax slab created' });
  } catch (error) {
    logger.error('Create tax slab error:', error);
    res.status(500).json({ error: 'Failed to create tax slab', message: error.message });
  }
};

const updateTaxSlab = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const { slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from, effective_to } = req.body;

    // Fetch old value for audit
    const old = await pool.query('SELECT * FROM tax_slabs WHERE id=$1', [id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Slab not found' });

    const result = await pool.query(`
      UPDATE tax_slabs SET
        slab_name=COALESCE($1,slab_name), slab_order=COALESCE($2,slab_order),
        min_income=COALESCE($3,min_income), max_income=$4,
        tax_rate=COALESCE($5,tax_rate), slab_type=COALESCE($6,slab_type),
        effective_from=$7, effective_to=$8, updated_at=NOW()
      WHERE id=$9 RETURNING *
    `, [slab_name, slab_order, min_income, max_income ?? null, tax_rate, slab_type,
        effective_from || null, effective_to || null, id]);

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_value, new_value, category, change_summary)
      VALUES ($1,$2,'update','tax_slabs',$3,$4,$5,'tax_management',$6)`,
      [req.user.id, req.user.email, id,
       JSON.stringify({ tax_rate: old.rows[0].tax_rate, min_income: old.rows[0].min_income }),
       JSON.stringify({ tax_rate, min_income, max_income }),
       `Tax slab updated: ${slab_name || old.rows[0].slab_name}`]);

    res.json({ success: true, data: result.rows[0], message: 'Tax slab updated' });
  } catch (error) {
    logger.error('Update tax slab error:', error);
    res.status(500).json({ error: 'Failed to update tax slab', message: error.message });
  }
};

const deleteTaxSlab = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { id } = req.params;
    const old = await pool.query('SELECT * FROM tax_slabs WHERE id=$1', [id]);
    if (!old.rows.length) return res.status(404).json({ error: 'Slab not found' });

    await pool.query('DELETE FROM tax_slabs WHERE id=$1', [id]);
    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, record_id, old_value, category, change_summary)
      VALUES ($1,$2,'delete','tax_slabs',$3,$4,'tax_management',$5)`,
      [req.user.id, req.user.email, id, JSON.stringify(old.rows[0]),
       `Tax slab deleted: ${old.rows[0].slab_name}`]);

    res.json({ success: true, message: 'Tax slab deleted' });
  } catch (error) {
    logger.error('Delete tax slab error:', error);
    res.status(500).json({ error: 'Failed to delete tax slab', message: error.message });
  }
};

const cloneTaxSlabs = async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { fromTaxYearId, toTaxYearId, slabType } = req.body;
    if (!fromTaxYearId || !toTaxYearId) return res.status(400).json({ error: 'fromTaxYearId and toTaxYearId required' });

    let q = 'SELECT * FROM tax_slabs WHERE tax_year_id=$1';
    const params = [fromTaxYearId];
    if (slabType) { q += ' AND slab_type=$2'; params.push(slabType); }

    const slabs = await pool.query(q, params);
    if (!slabs.rows.length) return res.status(404).json({ error: 'No slabs found for source year' });

    // Remove existing slabs in target year (for same slab_type if specified)
    if (slabType) {
      await pool.query('DELETE FROM tax_slabs WHERE tax_year_id=$1 AND slab_type=$2', [toTaxYearId, slabType]);
    } else {
      await pool.query('DELETE FROM tax_slabs WHERE tax_year_id=$1', [toTaxYearId]);
    }

    const inserted = [];
    for (const slab of slabs.rows) {
      const r = await pool.query(`
        INSERT INTO tax_slabs (tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate, slab_type, effective_from)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *
      `, [toTaxYearId, slab.slab_name, slab.slab_order, slab.min_income, slab.max_income, slab.tax_rate, slab.slab_type]);
      inserted.push(r.rows[0]);
    }

    await pool.query(`INSERT INTO audit_log (user_id, user_email, action, table_name, category, change_summary)
      VALUES ($1,$2,'clone','tax_slabs','tax_management',$3)`,
      [req.user.id, req.user.email, `Cloned ${inserted.length} slabs from ${fromTaxYearId} to ${toTaxYearId}`]);

    res.json({ success: true, data: inserted, message: `${inserted.length} slabs cloned successfully` });
  } catch (error) {
    logger.error('Clone tax slabs error:', error);
    res.status(500).json({ error: 'Failed to clone tax slabs', message: error.message });
  }
};

const previewTaxSlabs = async (req, res) => {
  try {
    const { taxYearId, income, slabType = 'individual' } = req.body;
    if (!taxYearId || income == null) return res.status(400).json({ error: 'taxYearId and income required' });

    const slabs = await pool.query(
      'SELECT * FROM tax_slabs WHERE tax_year_id=$1 AND slab_type=$2 ORDER BY slab_order',
      [taxYearId, slabType]
    );

    if (!slabs.rows.length) return res.json({ success: true, data: { totalTax: 0, effectiveRate: 0, breakdown: [] } });

    let totalTax = 0;
    const breakdown = [];
    const inc = parseFloat(income);

    for (const slab of slabs.rows) {
      const lo = parseFloat(slab.min_income);
      const hi = slab.max_income ? parseFloat(slab.max_income) : Infinity;
      if (inc < lo) break;
      const taxable = Math.min(inc, hi) - lo + 1;
      const rate = parseFloat(slab.tax_rate);
      const tax = taxable * rate;
      totalTax += tax;
      breakdown.push({
        slab_name: slab.slab_name,
        range: `${lo.toLocaleString()} – ${slab.max_income ? parseFloat(slab.max_income).toLocaleString() : '∞'}`,
        taxable_amount: taxable,
        rate: (rate * 100).toFixed(2) + '%',
        tax_amount: Math.round(tax)
      });
      if (inc <= hi) break;
    }

    res.json({
      success: true,
      data: {
        income: inc,
        totalTax: Math.round(totalTax),
        effectiveRate: ((totalTax / inc) * 100).toFixed(2) + '%',
        marginalRate: breakdown.length ? breakdown[breakdown.length - 1].rate : '0%',
        breakdown
      }
    });
  } catch (error) {
    logger.error('Tax slab preview error:', error);
    res.status(500).json({ error: 'Failed to preview tax', message: error.message });
  }
};

module.exports = {
  getTaxSlabs,
  getTaxSlabTypes,
  createTaxSlab,
  updateTaxSlab,
  deleteTaxSlab,
  cloneTaxSlabs,
  previewTaxSlabs,
};
