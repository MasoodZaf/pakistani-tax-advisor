const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const {
  getCurrentTaxYear,
} = require('../helpers/taxFormsShared');

const getExpenseSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();

    const { rows } = await pool.query(
      `SELECT id, tax_treatment, amount_pkr, occurred_on, category, description
       FROM expenses
       WHERE user_id = $1
         AND tax_year = $2
         AND deleted_at IS NULL
         AND included_in_return = FALSE
       ORDER BY occurred_on DESC, id DESC`,
      [userId, taxYear]
    );

    const by_treatment = {};
    const unmapped = { total_pkr: 0, count: 0, expense_ids: [] };
    let total_captured_pkr = 0;

    for (const r of rows) {
      const amt = Number(r.amount_pkr) || 0;
      total_captured_pkr += amt;
      if (!r.tax_treatment) {
        unmapped.total_pkr += amt;
        unmapped.count += 1;
        unmapped.expense_ids.push(r.id);
        continue;
      }
      const bucket = by_treatment[r.tax_treatment] ||
        (by_treatment[r.tax_treatment] = { total_pkr: 0, count: 0, expense_ids: [] });
      bucket.total_pkr += amt;
      bucket.count += 1;
      bucket.expense_ids.push(r.id);
    }

    // Round to 2dp to avoid floating-point drift in the response.
    const round = (n) => Math.round(n * 100) / 100;
    for (const k of Object.keys(by_treatment)) {
      by_treatment[k].total_pkr = round(by_treatment[k].total_pkr);
    }
    unmapped.total_pkr = round(unmapped.total_pkr);
    total_captured_pkr = round(total_captured_pkr);

    res.json({
      tax_year: taxYear,
      by_treatment,
      unmapped,
      total_captured_pkr,
    });
  } catch (error) {
    logger.error('Expense suggestions failed:', error);
    res.status(500).json({ success: false, message: 'Expense suggestions failed', error: error.message });
  }
};

const applyExpenseSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taxYear, expense_ids } = req.body || {};

    if (!taxYear || typeof taxYear !== 'string') {
      return res.status(400).json({ error: 'taxYear_required' });
    }
    if (!Array.isArray(expense_ids) || expense_ids.length === 0) {
      return res.status(400).json({ error: 'expense_ids_required' });
    }
    if (expense_ids.length > 1000) {
      return res.status(400).json({ error: 'too_many_ids', max: 1000 });
    }

    // Single UPDATE; the WHERE clause is the gate that scopes to this user.
    // RETURNING gives us the rows we actually touched so we can aggregate.
    const { rows } = await pool.query(
      `UPDATE expenses
       SET included_in_return = TRUE, updated_at = NOW()
       WHERE user_id = $1
         AND tax_year = $2
         AND deleted_at IS NULL
         AND included_in_return = FALSE
         AND id = ANY($3::uuid[])
       RETURNING id, tax_treatment, amount_pkr`,
      [userId, taxYear, expense_ids]
    );

    const by_treatment = {};
    let total_applied_pkr = 0;
    for (const r of rows) {
      const amt = Number(r.amount_pkr) || 0;
      total_applied_pkr += amt;
      const key = r.tax_treatment || 'unmapped';
      const bucket = by_treatment[key] || (by_treatment[key] = { total_pkr: 0, count: 0 });
      bucket.total_pkr += amt;
      bucket.count += 1;
    }
    for (const k of Object.keys(by_treatment)) {
      by_treatment[k].total_pkr = Math.round(by_treatment[k].total_pkr * 100) / 100;
    }

    res.json({
      tax_year: taxYear,
      applied_count: rows.length,
      total_applied_pkr: Math.round(total_applied_pkr * 100) / 100,
      by_treatment,
    });
  } catch (error) {
    logger.error('Apply expense suggestions failed:', error);
    res.status(500).json({ success: false, message: 'Apply failed', error: error.message });
  }
};

module.exports = { getExpenseSuggestions, applyExpenseSuggestions };
