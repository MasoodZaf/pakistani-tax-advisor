const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const {
  getCurrentTaxYear,
} = require('../helpers/taxFormsShared');

const getCapitalGains = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();
    const result = await pool.query(
      'SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching capital gains:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch capital gains', error: error.message });
  }
};

const getReductions = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();
    const result = await pool.query(
      'SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching reductions:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch reductions', error: error.message });
  }
};

const getCredits = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();
    const result = await pool.query(
      'SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching credits:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch credits', error: error.message });
  }
};

const getDeductions = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();
    const result = await pool.query(
      'SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching deductions:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch deductions', error: error.message });
  }
};

const getFinalTax = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();
    const result = await pool.query(
      'SELECT * FROM final_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching final tax:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch final tax', error: error.message });
  }
};

const getExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();
    const result = await pool.query(
      'SELECT * FROM expenses_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (error) {
    logger.error('Error fetching expenses:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to fetch expenses', error: error.message });
  }
};

module.exports = {
  getCapitalGains,
  getReductions,
  getCredits,
  getDeductions,
  getFinalTax,
  getExpenses,
};
