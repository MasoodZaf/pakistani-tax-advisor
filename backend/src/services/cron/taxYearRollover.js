// Daily idempotent rollover of `tax_years.is_current`.
//
// Pakistan fiscal year is 1 July – 30 June. On 1 July each year we flip
// is_current to the new year (creating the row if it doesn't yet exist),
// and turn off is_current on the old year. The job is safe to run any day
// — on the 364 non-cutover days it's a no-op.
//
// Rollover policy (intentionally not handling Finance Act changes):
//   - We only touch is_current. Tax slabs, rates, and rules are admin-only
//     and surface via a separate reminder cron (see taxYearAdminReminder.js).
//   - If the new year's row is missing we create it with start_date,
//     end_date, filing_deadline computed by convention but is_active=false
//     until an admin reviews the slabs. The app's existing
//     "is_current AND is_active" guards mean nobody starts filing under
//     the new year until rules are confirmed.

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const { insertAudit } = require('../../helpers/auditLog');

// "2025" -> "2025-26"  (start year -> Pakistan tax-year label)
function fiscalLabel(startYear) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

// Determine the fiscal year that contains the given date. Pakistan
// fiscal years run 1 July YYYY through 30 June YYYY+1.
function fiscalYearForDate(date) {
  const m = date.getUTCMonth(); // 0=Jan, 6=Jul
  const y = date.getUTCFullYear();
  const startYear = m >= 6 ? y : y - 1;
  return {
    startYear,
    label: fiscalLabel(startYear),
    start_date: `${startYear}-07-01`,
    end_date: `${startYear + 1}-06-30`,
    filing_deadline: `${startYear + 1}-09-30`,
  };
}

// Find or create the tax_years row for the given fiscal year. Returns the
// row. `is_active=false` for newly-created rows — admin reviews slabs
// before opening it to filers.
async function ensureTaxYearRow(client, fy) {
  const found = await client.query(
    'SELECT id, tax_year, is_current, is_active FROM tax_years WHERE tax_year = $1',
    [fy.label]
  );
  if (found.rows[0]) return found.rows[0];

  const created = await client.query(
    `INSERT INTO tax_years (tax_year, start_date, end_date, filing_deadline, is_active, description)
     VALUES ($1, $2, $3, $4, false, 'Auto-created by rollover cron — review slabs before activating.')
     RETURNING id, tax_year, is_current, is_active`,
    [fy.label, fy.start_date, fy.end_date, fy.filing_deadline]
  );
  logger.info('taxYearRollover: auto-created year', { taxYear: fy.label });
  return created.rows[0];
}

// One-shot rollover check. Returns { changed, currentYear } so the caller
// can log + audit appropriately.
async function rolloverOnce(now = new Date()) {
  const fy = fiscalYearForDate(now);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const target = await ensureTaxYearRow(client, fy);

    // Already current? Nothing to do (with idx_tax_years_current that
    // selectively indexes is_current=true, this is the cheap-path lookup).
    if (target.is_current) {
      await client.query('COMMIT');
      return { changed: false, currentYear: target.tax_year };
    }

    // Do NOT move is_current onto a year that isn't open to filers yet.
    //
    // The app resolves the filing year with `is_current AND is_active`
    // (getCurrentTaxYear, login, user provisioning, wizard). A new fiscal year
    // is auto-created here with is_active=false until an admin reviews the
    // Finance Act and updates the slabs. If we flipped is_current onto that
    // inactive year, NO row would satisfy `is_current AND is_active` and the
    // current-year lookup would throw — and it would do so during the prior
    // year's filing season (e.g. 2025-26 returns are filed Jul–Sep, AFTER the
    // 2026-27 fiscal year has already started). So is_current only advances
    // once the new year is activated; until then it stays on the prior year.
    if (!target.is_active) {
      await client.query('COMMIT'); // keep the freshly-created row; leave is_current as-is
      logger.info('taxYearRollover: new year not active yet — deferring is_current flip', {
        taxYear: target.tax_year,
      });
      return { changed: false, deferred: true, currentYear: target.tax_year };
    }

    // Flip: clear is_current everywhere, set on the (now-active) target.
    await client.query('UPDATE tax_years SET is_current = false WHERE is_current = true');
    await client.query('UPDATE tax_years SET is_current = true WHERE id = $1', [target.id]);

    await client.query('COMMIT');

    await insertAudit(pool, {
      userId: null,
      userEmail: null,
      action: 'tax_year_rollover',
      tableName: 'tax_years',
      newValue: { tax_year: target.tax_year, is_active: target.is_active },
      mandatory: true,
    }).catch((e) => logger.warn('rollover audit insert failed', { message: e.message }));

    logger.info('taxYearRollover: flipped is_current', {
      newCurrent: target.tax_year,
      newActive: target.is_active,
    });
    return { changed: true, currentYear: target.tax_year };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('taxYearRollover failed', { message: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { rolloverOnce, fiscalYearForDate, fiscalLabel };
