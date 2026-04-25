const { pool } = require('../config/database');
const logger = require('../utils/logger');

const cache = new Map();

const ALLOWED_TABLES = new Set([
  'income_forms',
  'adjustable_tax_forms',
  'reductions_forms',
  'credits_forms',
  'deductions_forms',
  'final_tax_forms',
  'final_min_income_forms',
  'capital_gain_forms',
  'expenses_forms',
  'tax_computation_forms',
  'wealth_forms',
  'wealth_reconciliation_forms',
  'form_completion_status',
]);

async function getAllowedColumns(tableName) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Table "${tableName}" is not in the save-form allow list`);
  }
  if (cache.has(tableName)) return cache.get(tableName);

  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const cols = new Set(result.rows.map((r) => r.column_name));
  if (cols.size === 0) {
    throw new Error(`No columns found for table "${tableName}"`);
  }
  cache.set(tableName, cols);
  return cols;
}

function filterToAllowedColumns(tableName, columnsSet, payload) {
  const allowed = {};
  const rejected = [];
  for (const [key, value] of Object.entries(payload)) {
    if (columnsSet.has(key)) {
      allowed[key] = value;
    } else {
      rejected.push(key);
    }
  }
  if (rejected.length > 0) {
    logger.warn('Dropped unknown keys in save payload', {
      table: tableName,
      count: rejected.length,
      sample: rejected.slice(0, 5),
    });
  }
  return allowed;
}

module.exports = {
  ALLOWED_TABLES,
  getAllowedColumns,
  filterToAllowedColumns,
};
