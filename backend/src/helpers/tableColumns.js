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
     WHERE table_schema = 'public' AND table_name = $1
       AND is_generated = 'NEVER'`,
    [tableName]
  );
  const cols = new Set(result.rows.map((r) => r.column_name));
  if (cols.size === 0) {
    throw new Error(`No columns found for table "${tableName}"`);
  }
  cache.set(tableName, cols);
  return cols;
}

// Thrown when a save payload carries keys that are not columns on the target
// table and the caller asked for strict handling. Carries every offending key —
// the old behaviour logged `sample: rejected.slice(0, 5)` at warn level and
// returned HTTP 200, so 24 dropped Final Tax keys were undiagnosable from the
// logs and invisible to the user (PM-PHASE15 §10).
class UnknownColumnsError extends Error {
  constructor(tableName, keys) {
    super(`Save payload for ${tableName} contains ${keys.length} unknown field(s)`);
    this.name = 'UnknownColumnsError';
    this.table = tableName;
    this.keys = keys;
  }
}

/**
 * @param {object} [options]
 * @param {boolean} [options.strict]  throw UnknownColumnsError instead of dropping
 * @param {Set<string>} [options.ignore] keys the server computes itself: dropped
 *                                       silently, never an error
 */
function filterToAllowedColumns(tableName, columnsSet, payload, options = {}) {
  const { strict = false, ignore } = options;
  const allowed = {};
  const rejected = [];
  for (const [key, value] of Object.entries(payload)) {
    if (columnsSet.has(key)) {
      allowed[key] = value;
    } else if (ignore && ignore.has(key)) {
      // Server-computed / generated column echoed back by the client.
    } else {
      rejected.push(key);
    }
  }
  if (rejected.length > 0) {
    // Log EVERY rejected key. Truncating to five is what made the Final Tax
    // loss undiagnosable in production logs.
    logger[strict ? 'error' : 'warn']('Dropped unknown keys in save payload', {
      table: tableName,
      count: rejected.length,
      keys: rejected,
    });
    if (strict) throw new UnknownColumnsError(tableName, rejected);
  }
  return allowed;
}

module.exports = {
  ALLOWED_TABLES,
  getAllowedColumns,
  filterToAllowedColumns,
  UnknownColumnsError,
};
