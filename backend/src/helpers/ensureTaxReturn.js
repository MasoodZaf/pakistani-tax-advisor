const { pool } = require('../config/database');

/**
 * Returns the tax_return id for (userId, taxYear), creating one if needed.
 *
 * Atomic upsert via INSERT ... ON CONFLICT DO NOTHING RETURNING id, relying on
 * the unique_user_tax_year constraint. Fallback SELECT handles the case where
 * the INSERT hit a conflict and returned nothing. This eliminates the prior
 * findFirst+create race.
 */
async function ensureTaxReturn(userId, userEmail, taxYear) {
  const yrRow = await pool.query(
    'SELECT id FROM tax_years WHERE tax_year = $1',
    [taxYear]
  );
  if (yrRow.rows.length === 0) {
    throw new Error(`Invalid tax year: ${taxYear}`);
  }
  const taxYearId = yrRow.rows[0].id;

  // Use the full user UUID (36 chars) so return_number is globally unique —
  // the old 8-char prefix had a birthday bound at ~77k users.
  const returnNumber = `TR-${userId}-${taxYear}`;

  const ins = await pool.query(
    `INSERT INTO tax_returns
       (user_id, user_email, tax_year_id, tax_year, return_number, filing_status, filing_type)
     VALUES ($1, $2, $3, $4, $5, 'draft', 'normal')
     ON CONFLICT (user_id, tax_year_id) DO NOTHING
     RETURNING id`,
    [userId, userEmail, taxYearId, taxYear, returnNumber]
  );

  if (ins.rows.length > 0) return ins.rows[0].id;

  // Row already existed — fetch its id.
  const existing = await pool.query(
    'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year_id = $2',
    [userId, taxYearId]
  );
  return existing.rows[0].id;
}

module.exports = ensureTaxReturn;
