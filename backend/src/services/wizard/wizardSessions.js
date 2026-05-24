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

module.exports = {
  getStatus,
  create,
  getById,
  recordTurn,
  markCompleted,
  reset,
};
