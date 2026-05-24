// Deterministic finalize writer. Takes a completed wizard session's
// captured_data and writes each captured value to its target form-table
// column. No LLM in this path — every decision comes from the
// shared/wizardFieldMap.js declarations.
//
// All writes go through ON CONFLICT (user_id, tax_year) DO UPDATE so
// re-running the wizard (re-run flow) overlays the new values onto
// existing draft rows rather than creating duplicates. The
// tax_returns_user_year_unique constraint (phase-x) + per-form unique
// constraints from phase-d guarantee this.

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const ensureTaxReturn = require('../../helpers/ensureTaxReturn');
const TaxRateService = require('../taxRateService');
const TaxCalculationService = require('../taxCalculationService');
const {
  STEPS,
  STEPS_BY_ID,
  PROPERTY_BUCKET_TO_COLUMNS,
} = require('../../../../shared/wizardFieldMap');

// Whitelist of (table, column) pairs the finalize step is allowed to write.
// Built from the field map at module load. Defense-in-depth: even if a
// future map edit referenced a typo'd column name, the SQL would still
// only mutate columns the map declared.
const ALLOWED_WRITES = (() => {
  const allowed = new Map(); // table -> Set<column>
  for (const step of STEPS) {
    for (const f of step.fields) {
      if (!f.target) continue;
      if (!allowed.has(f.target.table)) allowed.set(f.target.table, new Set());
      allowed.get(f.target.table).add(f.target.column);
    }
  }
  // Property-gain bucket routes can land in any of the 6 columns the
  // PROPERTY_BUCKET_TO_COLUMNS map declares — pre-authorize them too.
  const cg = 'capital_gain_forms';
  if (!allowed.has(cg)) allowed.set(cg, new Set());
  for (const bucket of Object.values(PROPERTY_BUCKET_TO_COLUMNS)) {
    allowed.get(cg).add(bucket.amount);
    allowed.get(cg).add(bucket.wht);
  }
  return allowed;
})();

function assertWritable(table, column) {
  if (!ALLOWED_WRITES.get(table)?.has(column)) {
    throw new Error(`wizardFinalize: refusing write to non-allowlisted column ${table}.${column}`);
  }
}

// Resolve { table, column, value } pairs from a step's captured values.
// Most steps map 1:1 to field.target. property_gain reroutes based on the
// user-selected holding-period bucket.
function resolveWrites(stepId, capturedValues) {
  const step = STEPS_BY_ID[stepId];
  if (!step) return [];

  if (step.id === 'property_gain') {
    const bucket = capturedValues.holding_bucket;
    const cols = PROPERTY_BUCKET_TO_COLUMNS[bucket];
    if (!cols) return [];
    const out = [];
    if (capturedValues.property_gain_amount != null) {
      out.push({
        table: 'capital_gain_forms',
        column: cols.amount,
        value: capturedValues.property_gain_amount,
      });
    }
    if (capturedValues.property_gain_wht != null && capturedValues.property_gain_wht > 0) {
      out.push({
        table: 'capital_gain_forms',
        column: cols.wht,
        value: capturedValues.property_gain_wht,
      });
    }
    return out;
  }

  return step.fields
    .filter((f) => f.target)
    .map((f) => ({
      table: f.target.table,
      column: f.target.column,
      value: capturedValues[f.key],
    }))
    .filter((w) => w.value != null && w.value !== '');
}

// Group writes by table so each table gets exactly one upsert.
function groupByTable(writes) {
  const out = new Map();
  for (const w of writes) {
    if (!out.has(w.table)) out.set(w.table, {});
    out.get(w.table)[w.column] = w.value;
  }
  return out;
}

// Upsert a single form row's columns. Uses the per-form
// (user_id, tax_year) unique constraint added in phase-d.
async function upsertFormRow(client, table, columns, ctx) {
  // assertWritable() guards `table` and each column key — both safe to
  // inline into SQL after that check.
  for (const col of Object.keys(columns)) assertWritable(table, col);

  const colList = Object.keys(columns);
  const valueParams = colList.map((_, i) => `$${i + 6}`).join(', ');
  const updateClause = colList
    .map((c) => `${c} = EXCLUDED.${c}`)
    .concat(['updated_at = CURRENT_TIMESTAMP'])
    .join(', ');

  const sql = `
    INSERT INTO ${table} (
      tax_return_id, user_id, user_email, tax_year_id, tax_year,
      ${colList.join(', ')}
    )
    VALUES ($1, $2, $3, $4, $5, ${valueParams})
    ON CONFLICT (user_id, tax_year) DO UPDATE SET
      ${updateClause}
  `;
  const params = [
    ctx.taxReturnId,
    ctx.userId,
    ctx.userEmail,
    ctx.taxYearId,
    ctx.taxYear,
    ...colList.map((c) => columns[c]),
  ];
  await client.query(sql, params);
}

// Main entry point. Reads session.captured_data, writes draft form rows,
// runs the rough tax computation, returns the result.
async function finalize(session) {
  const userId = session.user_id;
  const taxYear = session.tax_year;

  // Load minimal user info for the FK columns the form rows require.
  const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
  if (userRow.rows.length === 0) {
    const err = new Error('user_not_found');
    err.status = 404;
    throw err;
  }
  const userEmail = userRow.rows[0].email;

  const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
  const taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);

  const ctx = { userId, userEmail, taxYearId, taxYear, taxReturnId };

  // Collect ALL writes the captured_data implies, then group by table.
  const writes = [];
  for (const [stepId, values] of Object.entries(session.captured_data || {})) {
    writes.push(...resolveWrites(stepId, values));
  }
  const byTable = groupByTable(writes);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [table, columns] of byTable.entries()) {
      await upsertFormRow(client, table, columns, ctx);
    }
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow */ }
    logger.error('wizardFinalize: write failed', {
      userId, taxYear, message: err.message,
    });
    throw err;
  } finally {
    client.release();
  }

  // Rough tax estimate via the existing computation engine, reading the
  // freshly-written draft rows. The frontend renders this as "rough — open
  // the app to verify each form" and routes the user to the dashboard.
  let roughCalc = null;
  try {
    roughCalc = await TaxCalculationService.calculateTaxComputation(userId, taxYear);
  } catch (err) {
    // Non-fatal — the wizard still completes; the UI shows "couldn't
    // compute estimate, please open the app to see the full breakdown".
    logger.warn('wizardFinalize: rough_calc skipped', { message: err.message });
  }

  return {
    taxReturnId,
    tables_written: Array.from(byTable.keys()),
    roughCalc,
  };
}

module.exports = { finalize, _resolveWrites: resolveWrites, _ALLOWED_WRITES: ALLOWED_WRITES };
