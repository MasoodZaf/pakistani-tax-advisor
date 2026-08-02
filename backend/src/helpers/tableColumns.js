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

const componentCache = new Map();

/**
 * The set of columns a GENERATED total actually sums, read out of the
 * generation expression itself.
 *
 * WHY THIS EXISTS — it is the fix for the defect that failed the first
 * remediation pass. `validation.js` clamped a HARDCODED list of four credit
 * heads while `credits_forms.total_credits` is a generated column summing
 * eleven. `surrender_tax_credit_reduction` is an ordinary editable input on the
 * shipping Credits form, was not on the list, and QA drove Rs 9,000,000 through
 * it verbatim — turning a Rs 3,101,000 liability into a Rs 250,000 refund
 * claim. Every hand-maintained list of column names in this codebase has gone
 * stale at least once; the generated expression cannot, because it IS the
 * definition of the total the engine reads.
 *
 * The expression Postgres stores looks like:
 *   ((COALESCE(a, (0)::numeric) + COALESCE(b, (0)::numeric)) + COALESCE(c, ...))
 * so the component names are exactly the identifiers wrapped in COALESCE.
 * Anything else in there (casts, literals) is not a column and is ignored.
 *
 * Fails loudly rather than returning a partial set: a silently short list is
 * precisely the failure being fixed, and a caller that clamps only some of the
 * components is worse than one that refuses to run.
 *
 * @param {string} tableName   must be in ALLOWED_TABLES
 * @param {string} totalColumn the GENERATED column whose summands are wanted
 * @returns {Promise<string[]>} component column names, in expression order
 */
async function getGeneratedTotalComponents(tableName, totalColumn) {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(`Table "${tableName}" is not in the save-form allow list`);
  }
  const cacheKey = `${tableName}.${totalColumn}`;
  if (componentCache.has(cacheKey)) return componentCache.get(cacheKey);

  const result = await pool.query(
    `SELECT generation_expression, is_generated
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, totalColumn]
  );
  if (result.rows.length === 0) {
    throw new Error(`Column "${tableName}.${totalColumn}" does not exist`);
  }
  const { generation_expression: expr, is_generated: isGenerated } = result.rows[0];
  if (isGenerated !== 'ALWAYS' || !expr) {
    throw new Error(
      `Column "${tableName}.${totalColumn}" is not a GENERATED column — its components `
        + 'cannot be derived and must not be guessed.'
    );
  }

  // Identifiers inside COALESCE(...) are the summands. Quoted identifiers are
  // matched too; Postgres emits them for anything needing quoting.
  const names = [];
  const seen = new Set();
  const re = /COALESCE\(\s*"?([a-zA-Z_][a-zA-Z0-9_$]*)"?\s*[,)]/gi;
  let m;
  while ((m = re.exec(expr)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  if (names.length === 0) {
    throw new Error(
      `Could not parse any component columns out of "${tableName}.${totalColumn}"'s `
        + `generation expression: ${expr}`
    );
  }

  componentCache.set(cacheKey, names);
  logger.info('Derived generated-total components', {
    table: tableName,
    total: totalColumn,
    count: names.length,
  });
  return names;
}

/** Test seam — the process-lifetime caches are otherwise never invalidated. */
function _resetColumnCaches() {
  cache.clear();
  componentCache.clear();
}

module.exports = {
  ALLOWED_TABLES,
  getAllowedColumns,
  getGeneratedTotalComponents,
  filterToAllowedColumns,
  UnknownColumnsError,
  _resetColumnCaches,
};
