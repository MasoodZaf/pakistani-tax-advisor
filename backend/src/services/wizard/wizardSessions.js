// CRUD on the wizard_sessions table. Pure DB access — no flow logic, no
// LLM calls. The routes/wizard.js handlers orchestrate engine + sessions
// + extractor + finalize together.

const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const TaxRateService = require('../taxRateService');

// Status returned by GET /api/wizard/status — drives the dashboard CTA.
async function getStatus(userId, taxYear) {
  const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
  const { rows } = await pool.query(
    `SELECT id, status, current_step, completed_at, started_at
       FROM wizard_sessions
      WHERE user_id = $1 AND tax_year_id = $2
        AND status IN ('in_progress', 'completed')
      ORDER BY started_at DESC`,
    [userId, taxYearId]
  );
  const completed = rows.find((r) => r.status === 'completed') || null;
  const inProgress = rows.find((r) => r.status === 'in_progress') || null;
  return {
    completed: !!completed,
    in_progress: !!inProgress,
    can_resume: !!inProgress,
    last_completed_at: completed?.completed_at || null,
    in_progress_session_id: inProgress?.id || null,
    in_progress_current_step: inProgress?.current_step || null,
  };
}

// Create a new in-progress session. Caller must have already checked via
// getStatus() that no completed session exists (or that this is a forced
// re-run). Race protection: the partial unique index
// wizard_sessions_one_in_progress_per_user_year will raise 23505 if a
// concurrent request beat us — we surface that as 'already_in_progress'.
async function create({ userId, taxYear, currentStep, seedCapturedData = {} }) {
  const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
  try {
    const { rows } = await pool.query(
      `INSERT INTO wizard_sessions
         (user_id, tax_year_id, tax_year, status, current_step, captured_data)
       VALUES ($1, $2, $3, 'in_progress', $4, $5::jsonb)
       RETURNING id, status, current_step, captured_data, started_at`,
      [userId, taxYearId, taxYear, currentStep, JSON.stringify(seedCapturedData)]
    );
    return rows[0];
  } catch (err) {
    // 23505 = unique violation. Two callers raced; the loser bails.
    if (err.code === '23505') {
      const conflict = new Error('already_in_progress');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

// Most recent archived (abandoned/completed) session's captured_data for this
// user-year, or {} if none. Used by /start to seed a fresh session from the
// prior run so a re-run pre-fills the user's prior answers — the "should
// have the data which user can modify on rerun" requirement. Returns the
// most recent abandoned first (post-reset path), then completed (defensive
// — completed shouldn't coexist with a missing in_progress in normal flow).
async function lastArchivedSeed(userId, taxYear) {
  const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
  const { rows } = await pool.query(
    `SELECT captured_data
       FROM wizard_sessions
      WHERE user_id = $1 AND tax_year_id = $2
        AND status IN ('abandoned', 'completed')
      ORDER BY
        CASE status WHEN 'abandoned' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
        COALESCE(completed_at, started_at) DESC
      LIMIT 1`,
    [userId, taxYearId]
  );
  return rows[0]?.captured_data || {};
}

async function getById(sessionId, userId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, tax_year_id, tax_year, status, current_step,
            captured_data, rough_calc, started_at, completed_at
       FROM wizard_sessions
      WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

// Merge new values into captured_data (object-spread per step_id) and
// optionally advance current_step. Single UPDATE — no read-modify-write
// race because the jsonb concatenation is server-side.
async function recordTurn(sessionId, stepId, normalizedValues, nextStepId) {
  const stepPatch = JSON.stringify({ [stepId]: normalizedValues });
  const { rows } = await pool.query(
    `UPDATE wizard_sessions
        SET captured_data = captured_data || $1::jsonb,
            current_step  = $2
      WHERE id = $3 AND status = 'in_progress'
      RETURNING id, captured_data, current_step`,
    [stepPatch, nextStepId, sessionId]
  );
  return rows[0] || null;
}

// Mark complete + persist rough_calc snapshot.
async function markCompleted(sessionId, roughCalc) {
  const { rows } = await pool.query(
    `UPDATE wizard_sessions
        SET status = 'completed',
            completed_at = NOW(),
            rough_calc = $1::jsonb
      WHERE id = $2 AND status = 'in_progress'
      RETURNING id, status, completed_at, rough_calc`,
    [roughCalc ? JSON.stringify(roughCalc) : null, sessionId]
  );
  return rows[0] || null;
}

// Reset: archive every completed + in_progress session for this user-year
// as 'abandoned'. Returns the prior completed session's captured_data so
// the caller can seed the new session from it (per the user's "should
// have the data which user can modify on rerun" requirement).
async function reset(userId, taxYear) {
  const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prior = await client.query(
      `SELECT id, status, captured_data
         FROM wizard_sessions
        WHERE user_id = $1 AND tax_year_id = $2
          AND status IN ('in_progress', 'completed')`,
      [userId, taxYearId]
    );
    if (prior.rows.length === 0) {
      await client.query('ROLLBACK');
      return { seedCapturedData: {}, archived: 0 };
    }
    await client.query(
      `UPDATE wizard_sessions
          SET status = 'abandoned'
        WHERE user_id = $1 AND tax_year_id = $2
          AND status IN ('in_progress', 'completed')`,
      [userId, taxYearId]
    );
    await client.query('COMMIT');
    // Prefer the prior completed payload as the seed for the re-run.
    const lastCompleted = prior.rows.find((r) => r.status === 'completed');
    const seed = lastCompleted?.captured_data || {};
    return { seedCapturedData: seed, archived: prior.rows.length };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow */ }
    logger.error('wizard reset failed', { userId, taxYear, err: err.message });
    throw err;
  } finally {
    client.release();
  }
}

// Seed wizard captured_data from existing tax form tables. Lets the wizard
// pre-fill steps with values the user already entered via the web/mobile
// forms — so the wizard doesn't ask for salary again when income_forms
// already has it. Returns the same `{ step_id: { field_key: value } }`
// shape as captured_data.
//
// Only fields with a direct equivalent in the source form table are seeded.
// Anything not found stays absent so the wizard prompts for it normally.
// Helper: only set a key if the value is a positive number. Avoids polluting
// the seed with 0s that the wizard would render as pre-filled defaults the
// user has to manually clear.
function _maybeSet(target, key, value) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) target[key] = n;
}

async function seedFromExistingForms(userId, taxYear) {
  const seed = {};

  // Pull every relevant row in parallel — each is best-effort.
  const tryQuery = async (sql) => {
    try {
      const r = await pool.query(sql, [userId, taxYear]);
      return r.rows[0] || null;
    } catch { return null; }
  };

  const [income, adjustable, deductions, credits, capitalGain, finalMin] = await Promise.all([
    tryQuery(`SELECT annual_basic_salary, allowances, bonus, other_taxable_income_rent
                FROM income_forms WHERE user_id = $1 AND tax_year = $2`),
    tryQuery(`SELECT salary_employees_149_tax_collected,
                     profit_debt_151_15_tax_collected,
                     tax_deducted_rent_section_155_tax_collected
                FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2`),
    tryQuery(`SELECT zakat_paid_amount FROM deductions_forms
               WHERE user_id = $1 AND tax_year = $2`),
    tryQuery(`SELECT charitable_donations_amount FROM credits_forms
               WHERE user_id = $1 AND tax_year = $2`),
    tryQuery(`SELECT securities, securities_tax_deducted FROM capital_gain_forms
               WHERE user_id = $1 AND tax_year = $2`),
    tryQuery(`SELECT profit_on_debt_u_s_7b,
                     dividend_u_s_150_31_atl_15pc,
                     dividend_u_s_150_31pc_atl_tax_deducted,
                     return_invest_exceed_1m_sukuk_saa_12_5pc,
                     return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted
                FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2`),
  ]);

  // salary_basics ← income_forms
  if (income) {
    const step = {};
    _maybeSet(step, 'annual_basic_salary', income.annual_basic_salary);
    _maybeSet(step, 'allowances', income.allowances);
    _maybeSet(step, 'bonus', income.bonus);
    if (Object.keys(step).length > 0) seed.salary_basics = step;
  }

  // salary_wht ← adjustable_tax_forms.salary_employees_149_tax_collected
  if (adjustable) {
    const step = {};
    _maybeSet(step, 'salary_tax_deducted', adjustable.salary_employees_149_tax_collected);
    if (Object.keys(step).length > 0) seed.salary_wht = step;
  }

  // common_deductions ← deductions_forms.zakat_paid_amount + credits_forms.charitable_donations_amount
  {
    const step = {};
    if (deductions) _maybeSet(step, 'zakat_paid_amount', deductions.zakat_paid_amount);
    if (credits) _maybeSet(step, 'charitable_donations_amount', credits.charitable_donations_amount);
    if (Object.keys(step).length > 0) seed.common_deductions = step;
  }

  // bank_profit ← final_min_income.profit_on_debt_u_s_7b + adjustable_tax.profit_debt_151_15
  if (finalMin || adjustable) {
    const step = {};
    if (finalMin) _maybeSet(step, 'profit_amount', finalMin.profit_on_debt_u_s_7b);
    if (adjustable) _maybeSet(step, 'profit_wht', adjustable.profit_debt_151_15_tax_collected);
    if (Object.keys(step).length > 0) seed.bank_profit = step;
  }

  // dividends ← final_min_income (atl_15pc + atl_tax_deducted)
  if (finalMin) {
    const step = {};
    _maybeSet(step, 'dividend_amount', finalMin.dividend_u_s_150_31_atl_15pc);
    _maybeSet(step, 'dividend_wht', finalMin.dividend_u_s_150_31pc_atl_tax_deducted);
    if (Object.keys(step).length > 0) seed.dividends = step;
  }

  // securities ← capital_gain_forms
  if (capitalGain) {
    const step = {};
    _maybeSet(step, 'securities_gain', capitalGain.securities);
    _maybeSet(step, 'securities_wht', capitalGain.securities_tax_deducted);
    if (Object.keys(step).length > 0) seed.securities = step;
  }

  // sukuk ← final_min_income (12.5% bucket)
  if (finalMin) {
    const step = {};
    _maybeSet(step, 'sukuk_amount', finalMin.return_invest_exceed_1m_sukuk_saa_12_5pc);
    _maybeSet(step, 'sukuk_wht', finalMin.return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted);
    if (Object.keys(step).length > 0) seed.sukuk = step;
  }

  // rental ← income_forms.other_taxable_income_rent + adjustable_tax.tax_deducted_rent_section_155
  if (income || adjustable) {
    const step = {};
    if (income) _maybeSet(step, 'rental_gross', income.other_taxable_income_rent);
    if (adjustable) _maybeSet(step, 'rental_wht', adjustable.tax_deducted_rent_section_155_tax_collected);
    if (Object.keys(step).length > 0) seed.rental = step;
  }

  return seed;
}

// Merge two captured_data objects shallowly per step. `b` wins on conflict
// — used to layer in-progress wizard captures over the form-data seed.
function mergeCapturedData(a = {}, b = {}) {
  const out = { ...a };
  for (const [stepId, vals] of Object.entries(b)) {
    out[stepId] = { ...(a[stepId] || {}), ...(vals || {}) };
  }
  return out;
}

module.exports = {
  getStatus,
  create,
  getById,
  recordTurn,
  markCompleted,
  reset,
  lastArchivedSeed,
  seedFromExistingForms,
  mergeCapturedData,
};
