// /api/wizard/* — AI quick-start wizard endpoints.
//
// Auth: every route requires a valid JWT (mounted with jwtAuth at the
// app.js layer). Rate-limited via the standard apiWriteLimiter.
//
// See docs/wizard-design.md for the design.

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const jwtAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { insertAudit } = require('../helpers/auditLog');

// Wizard input schemas. `values` and `raw_reply` are both optional but at
// least one must be present (enforced in the handler since zod refine inside
// optional fields gets noisy). Top-level shape is strict — extra keys reject.
const turnSchema = z.object({
  session_id: z.string().uuid(),
  step_id:    z.string().min(1).max(64),
  values:     z.record(z.any()).optional(),
  raw_reply:  z.string().max(4000).optional(),
}).strip();

const startSchema = z.object({
  taxYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  force:   z.boolean().optional(),
}).strip();

const finalizeSchema = z.object({
  session_id: z.string().uuid(),
}).strip();

const resetSchema = z.object({
  taxYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
}).strip();

const engine = require('../services/wizard/wizardEngine');
const sessions = require('../services/wizard/wizardSessions');
const extractor = require('../services/wizard/wizardExtractor');
const { finalize } = require('../services/wizard/wizardFinalize');

router.use(jwtAuth);

// Resolve the user's addon profile from tax_returns.income_profile. The
// onboarding flow + the Settings income-streams editor both write here.
// Returns [] if the user has no profile yet (the wizard will then ask the
// salaried baseline only and finish in 4 turns).
async function loadAddons(userId, taxYear) {
  const { rows } = await pool.query(
    `SELECT income_profile
       FROM tax_returns
      WHERE user_id = $1 AND tax_year = $2`,
    [userId, taxYear]
  );
  const profile = rows[0]?.income_profile;
  if (!profile || typeof profile !== 'object') return [];
  const addons = Array.isArray(profile.addons) ? profile.addons : [];
  return addons.filter((a) => typeof a === 'string');
}

// Current tax year — fall back to a sensible default if no row is marked
// is_current=true (matches the rest of the app's behaviour).
async function currentTaxYear() {
  const { rows } = await pool.query(
    `SELECT tax_year FROM tax_years
      WHERE is_current = true AND is_active = true
      LIMIT 1`
  );
  return rows[0]?.tax_year || '2025-26';
}

// ── GET /api/wizard/status ────────────────────────────────────────────────
// Drives the dashboard CTA banner (web + mobile) and the Settings re-trigger.
router.get('/status', async (req, res) => {
  try {
    const taxYear = req.query.taxYear || (await currentTaxYear());
    const status = await sessions.getStatus(req.user.id, taxYear);
    res.json({ taxYear, ...status });
  } catch (err) {
    logger.error('wizard/status failed', { message: err.message });
    res.status(500).json({ error: 'wizard_status_failed' });
  }
});

// ── POST /api/wizard/start ────────────────────────────────────────────────
// Idempotent. If a completed session exists, returns 409 with
// { error: 'wizard_already_completed' } unless `force=true` (and even then
// the caller should go through /reset first for the audit trail; force is
// retained for first-launch races where two devices both think they're
// starting).
router.post('/start', validate(startSchema), async (req, res) => {
  try {
    const taxYear = req.body?.taxYear || (await currentTaxYear());
    const force = req.body?.force === true || req.query?.force === 'true';

    const status = await sessions.getStatus(req.user.id, taxYear);

    if (status.completed && !force) {
      return res.status(409).json({
        error: 'wizard_already_completed',
        message: 'A completed wizard already exists for this year. Use /reset to re-run.',
      });
    }
    if (status.in_progress) {
      // Resume the existing in-progress session instead of creating a new one.
      const existing = await pool.query(
        `SELECT id, current_step, captured_data
           FROM wizard_sessions WHERE id = $1`,
        [status.in_progress_session_id]
      );
      const row = existing.rows[0];
      return res.json({
        session_id: row.id,
        current_step: row.current_step,
        prompt: engine.promptSchema(row.current_step),
        progress: engine.progress(row.current_step, await loadAddons(req.user.id, taxYear)),
        captured_data: row.captured_data,
        resumed: true,
      });
    }

    const addons = await loadAddons(req.user.id, taxYear);
    const firstStep = engine.firstStepForAddons(addons);
    if (!firstStep) {
      return res.status(500).json({ error: 'no_steps_for_profile' });
    }
    // Pre-fill from two sources, merged:
    //   1. existing tax form rows the user already entered on web/mobile
    //      (e.g. income_forms) — so the wizard doesn't ask for salary that
    //      another flow already captured
    //   2. the most recent abandoned/completed wizard session — for a
    //      "re-run with my prior answers" UX
    // The prior wizard session wins on overlap because it represents the
    // user's most recent intent inside the wizard's own context.
    const [formSeed, archivedSeed] = await Promise.all([
      sessions.seedFromExistingForms(req.user.id, taxYear),
      sessions.lastArchivedSeed(req.user.id, taxYear),
    ]);
    const seedCapturedData = sessions.mergeCapturedData(formSeed, archivedSeed);

    const created = await sessions.create({
      userId: req.user.id,
      taxYear,
      currentStep: firstStep,
      seedCapturedData,
    });

    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'wizard_start',
      tableName: 'wizard_sessions',
      newValue: { session_id: created.id, tax_year: taxYear, addons },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: false,
    });

    res.json({
      session_id: created.id,
      current_step: firstStep,
      prompt: engine.promptSchema(firstStep),
      progress: engine.progress(firstStep, addons),
      // Surface the seed so the client can pre-fill each step's widgets
      // from the prior run. Empty {} on first-time users.
      captured_data: created.captured_data || seedCapturedData,
      resumed: false,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error('wizard/start failed', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'wizard_start_failed' });
  }
});

// ── POST /api/wizard/turn ─────────────────────────────────────────────────
// Body shape (either or both):
//   { session_id, step_id, values: {...} }    — structured input only
//   { session_id, step_id, raw_reply: "..." } — free text only
//   { session_id, step_id, values, raw_reply } — both; structured wins on conflicts
//
// Server: validates the step belongs to this session, runs the extractor on
// raw_reply (if any), merges with explicit values (structured wins),
// validates against the field types, records the turn, returns the next
// step's prompt (or { done: true } if we've hit the end).
router.post('/turn', validate(turnSchema), async (req, res) => {
  try {
    const { session_id, step_id, values: rawValues, raw_reply } = req.body || {};
    if (!session_id || !step_id) {
      return res.status(400).json({ error: 'session_id_and_step_id_required' });
    }
    const session = await sessions.getById(session_id, req.user.id);
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.status !== 'in_progress') {
      return res.status(409).json({ error: 'session_not_in_progress', status: session.status });
    }
    if (session.current_step !== step_id) {
      return res.status(409).json({
        error: 'step_out_of_sequence',
        expected: session.current_step,
        got: step_id,
      });
    }

    const promptSchema = engine.promptSchema(step_id);
    if (!promptSchema) return res.status(400).json({ error: 'unknown_step' });

    // If the user typed free text, run the LLM extractor. Structured values
    // take precedence on key conflicts — the structured inputs are
    // deterministic and the user clearly meant them.
    let extracted = { values: {}, echo: null, low_confidence: [] };
    if (typeof raw_reply === 'string' && raw_reply.trim().length > 0) {
      extracted = await extractor.extract({ promptSchema, userReply: raw_reply });
    }
    const merged = { ...extracted.values, ...(rawValues && typeof rawValues === 'object' ? rawValues : {}) };

    const v = engine.validateStep(step_id, merged);
    if (!v.ok) {
      // Re-ask: include which fields failed so the client can show inline
      // errors on the structured widgets.
      return res.status(422).json({
        error: 'validation_failed',
        field_errors: v.errors,
        prompt: promptSchema,
        echo: extracted.echo,
        low_confidence: extracted.low_confidence,
      });
    }

    const addons = await loadAddons(req.user.id, session.tax_year);
    const nextId = engine.nextStep(step_id, addons);

    await sessions.recordTurn(session_id, step_id, v.normalized, nextId);

    if (nextId === null) {
      // Last step — signal the client to call /finalize.
      return res.json({
        done: true,
        echo: extracted.echo,
        captured_data: { ...session.captured_data, [step_id]: v.normalized },
      });
    }

    res.json({
      done: false,
      echo: extracted.echo,
      next_step: nextId,
      prompt: engine.promptSchema(nextId),
      progress: engine.progress(nextId, addons),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error('wizard/turn failed', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'wizard_turn_failed' });
  }
});

// ── POST /api/wizard/finalize ────────────────────────────────────────────
// Writes captured_data to draft form rows, runs rough calc, marks complete.
router.post('/finalize', validate(finalizeSchema), async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id_required' });
    const session = await sessions.getById(session_id, req.user.id);
    if (!session) return res.status(404).json({ error: 'session_not_found' });
    if (session.status !== 'in_progress') {
      return res.status(409).json({ error: 'session_not_in_progress', status: session.status });
    }

    const result = await finalize(session);
    const completed = await sessions.markCompleted(session.id, result.roughCalc);

    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'wizard_finalize',
      tableName: 'wizard_sessions',
      newValue: {
        session_id: session.id,
        tax_year: session.tax_year,
        tables_written: result.tables_written,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: false,
    });

    res.json({
      session_id: session.id,
      status: completed?.status || 'completed',
      tables_written: result.tables_written,
      rough_calc: result.roughCalc,
      message: 'These are rough estimates. Please open the app and verify each form before submitting your return.',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    logger.error('wizard/finalize failed', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'wizard_finalize_failed' });
  }
});

// ── POST /api/wizard/reset ───────────────────────────────────────────────
// Archives any completed/in-progress session for this year. Returns the
// prior captured_data so the caller can immediately start a new session
// pre-filled with the prior answers (the "re-run with my old answers as
// defaults" UX).
router.post('/reset', validate(resetSchema), async (req, res) => {
  try {
    const taxYear = req.body?.taxYear || (await currentTaxYear());
    const { seedCapturedData, archived } = await sessions.reset(req.user.id, taxYear);

    if (archived > 0) {
      await insertAudit(pool, {
        userId: req.user.id,
        userEmail: req.user.email,
        action: 'wizard_reset',
        tableName: 'wizard_sessions',
        newValue: { tax_year: taxYear, archived_count: archived },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        mandatory: false,
      });
    }

    res.json({
      ok: true,
      archived,
      // The client typically POSTs /start right after to launch a fresh
      // session pre-filled from this seed.
      seed_captured_data: seedCapturedData,
    });
  } catch (err) {
    logger.error('wizard/reset failed', { message: err.message });
    res.status(500).json({ error: 'wizard_reset_failed' });
  }
});

module.exports = router;
