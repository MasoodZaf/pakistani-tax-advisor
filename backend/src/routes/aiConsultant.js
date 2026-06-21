const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const service = require('../services/aiConsultant/consultantService');
const kb = require('../services/aiConsultant/knowledgeBase');
const { isConfigured } = require('../services/aiConsultant/deepseekClient');
const crypto = require('crypto');
const TaxCalculationService = require('../services/taxCalculationService');
const TaxRateService = require('../services/taxRateService');
const { pool } = require('../config/database');

// v3: compute the EXACT statutory headroom for the capped credits (donations
// s.61 @ 30% of taxable income, pension s.63 @ 20%) from DB-sourced caps + the
// authoritative average tax rate, so the AI quotes precise rupee savings rather
// than estimating. Caps come from tax_rates_config (rate_type='credit_cap').
function computeReliefHeadroom(computation, claimedReliefs, creditCaps) {
  const taxable = Number(computation?.income?.taxableIncomeIncludingCG) || 0;
  const taxBefore = Number(computation?.tax?.totalTaxBeforeAdjustments) || 0;
  if (taxable <= 0 || !creditCaps) return null;
  const avgRate = taxBefore / taxable;   // s.61/63 credit ratio = tax assessed / taxable income
  const credits = claimedReliefs?.credits || {};
  const items = [];
  const add = (relief, section, capCat, claimedFields) => {
    const cap = creditCaps[capCat];
    if (!cap) return;
    const capPct = Number(cap.rate);
    // The candidate fields are ALTERNATE columns for the same relief (new
    // _amount vs legacy flat) — take the max, never sum (would double-count).
    const claimed = Math.max(0, ...claimedFields.map((f) => Number(credits[f]) || 0));
    const eligibleCap = capPct * taxable;
    const additionalEligible = Math.max(0, eligibleCap - claimed);
    items.push({
      relief, section,
      cap: `${(capPct * 100).toFixed(0)}% of taxable income`,
      eligibleCapPKR: Math.round(eligibleCap),
      alreadyClaimedPKR: Math.round(claimed),
      additionalEligiblePKR: Math.round(additionalEligible),
      maxAdditionalCreditPKR: Math.round(additionalEligible * avgRate),
    });
  };
  add('charitable_donations', 's.61', 'donation_u61', ['charitable_donations_amount', 'charitable_donation']);
  add('voluntary_pension', 's.63', 'pension_u63', ['pension_contribution_amount', 'pension_contribution']);
  return { taxableIncomePKR: Math.round(taxable), averageTaxRate: `${(avgRate * 100).toFixed(1)}%`, cappedCredits: items };
}

const router = express.Router();

// 5MB cap per uploaded knowledge-base doc; restricted to text-ish formats.
const upload = multer({
  dest: kb.KB_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(md|txt|pdf|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

// Helpers ────────────────────────────────────────────────────────────────────
function sendErr(res, e) {
  const status = e.status || 500;
  logger.error('AI consultant route error', {
    code: e.code, status, message: e.message,
  });
  res.status(status).json({
    success: false,
    message: e.message || 'Internal server error',
    code: e.code,
  });
}

function ensureConfigured(res) {
  if (!isConfigured()) {
    res.status(503).json({
      success: false,
      code: 'AI_NOT_CONFIGURED',
      message: 'AI consultant is not configured. Server admin must set DEEPSEEK_API_KEY.',
    });
    return false;
  }
  return true;
}

// Routes ─────────────────────────────────────────────────────────────────────

// Quick health/config check the frontend uses to decide whether to render
// the chat widget at all.
router.get('/status', auth, async (req, res) => {
  res.json({
    success: true,
    configured: isConfigured(),
    knowledgeBase: kb.status(),
  });
});

// Main chat endpoint.
router.post('/chat', auth, async (req, res) => {
  if (!ensureConfigured(res)) return;
  try {
    const { message, conversationId, includePII, formContext, taxYear } = req.body || {};
    const out = await service.chat({
      userId: req.user.id,
      conversationId,
      message,
      includePII: !!includePII,
      formContext,
      taxYear,
    });
    res.json({ success: true, ...out });
  } catch (e) { sendErr(res, e); }
});

// Inline form-field helper.
router.post('/field-help', auth, async (req, res) => {
  if (!ensureConfigured(res)) return;
  try {
    const { fieldName, formStep, currentValue, includePII, formContext, taxYear } = req.body || {};
    if (!fieldName) {
      return res.status(400).json({ success: false, message: 'fieldName is required' });
    }
    const out = await service.fieldHelp({
      userId: req.user.id,
      fieldName,
      formStep,
      currentValue,
      includePII: !!includePII,
      formContext,
      taxYear,
    });
    res.json({ success: true, ...out });
  } catch (e) { sendErr(res, e); }
});

// Proactive tax-efficiency analysis of the signed-in user's own return.
// Gathers the AUTHORITATIVE DB-backed computation server-side (never trusts a
// client-supplied figure), hands it to the grounded consultant, and returns a
// structured list of legal reliefs the user hasn't claimed.
router.post('/optimize', auth, async (req, res) => {
  if (!ensureConfigured(res)) return;
  try {
    const { taxYear, includePII } = req.body || {};
    if (!taxYear) {
      return res.status(400).json({ success: false, message: 'taxYear is required' });
    }

    // Authoritative figures — computed from saved form data in the DB.
    let breakdown;
    try {
      breakdown = await TaxCalculationService.calculateTaxComputation(req.user.id, taxYear);
    } catch (e) {
      return res.status(404).json({
        success: false,
        code: 'NO_RETURN',
        message: 'No computable return found for this tax year yet — fill in your income forms first.',
      });
    }

    // v2: also gather the GRANULAR per-relief amounts the user has already
    // claimed (deductions / credits / reductions) so the model can tell
    // "already claimed" from "could top up" — the aggregate breakdown alone
    // can't distinguish them. Only non-zero fields are passed (concise context).
    let claimedReliefs = {};
    try {
      const tr = await pool.query(
        'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
        [req.user.id, taxYear]
      );
      const trId = tr.rows[0]?.id;
      if (trId) {
        const [ded, cred, red] = await Promise.all([
          pool.query('SELECT * FROM deductions_forms WHERE tax_return_id = $1', [trId]),
          pool.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [trId]),
          pool.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [trId]),
        ]);
        const claimedOnly = (row) => row
          ? Object.fromEntries(Object.entries(row).filter(([k, v]) =>
              !/^(id|user_id|user_email|tax_return_id|tax_year|tax_year_id|created_at|updated_at|is_complete|completion|last_updated)/.test(k)
              && Number(v) > 0))
          : {};
        claimedReliefs = {
          deductions: claimedOnly(ded.rows[0]),
          credits: claimedOnly(cred.rows[0]),
          reductions: claimedOnly(red.rows[0]),
        };
      }
    } catch (e) {
      logger.warn('optimize: could not load granular reliefs, using aggregate only', { message: e.message });
    }

    // v3: precise statutory headroom for the capped credits (DB-sourced caps).
    let reliefHeadroom = null;
    try {
      const creditCaps = await TaxRateService.getCreditCaps(taxYear);
      reliefHeadroom = computeReliefHeadroom(breakdown, claimedReliefs, creditCaps);
    } catch (e) {
      logger.warn('optimize: credit caps unavailable, skipping precise headroom', { message: e.message });
    }

    // v3: cache by an input hash of the figures that drive the analysis, so the
    // ~10s AI call only re-runs when the user's relevant numbers actually change.
    const inputHash = crypto.createHash('sha256').update(JSON.stringify({
      tc: breakdown?.tax?.totalTaxChargeable,
      np: breakdown?.tax?.netTaxPayable,
      cr: breakdown?.tax?.totalCredits,
      rd: breakdown?.tax?.totalReductions,
      da: breakdown?.income?.deductibleAllowances,
      ti: breakdown?.income?.taxableIncomeIncludingCG,
      reliefs: claimedReliefs,
    })).digest('hex');

    if (!req.body.refresh) {
      const cached = await pool.query(
        'SELECT analysis, updated_at FROM ai_optimizations WHERE user_id = $1 AND tax_year = $2 AND input_hash = $3',
        [req.user.id, taxYear, inputHash]
      );
      if (cached.rows[0]?.analysis) {
        return res.json({
          success: true, taxYear, cached: true,
          analysedAt: cached.rows[0].updated_at,
          analysis: cached.rows[0].analysis,
          reliefHeadroom,
        });
      }
      // cacheOnly: a cheap "is there a fresh analysis?" probe for tab-open —
      // never triggers the ~10s AI run; the UI shows the CTA instead.
      if (req.body.cacheOnly) {
        return res.json({ success: true, taxYear, cached: false, needsRun: true, analysis: null, reliefHeadroom });
      }
    }

    const out = await service.taxOptimization({
      userId: req.user.id,
      taxYear,
      includePII: !!includePII,
      taxData: { computation: breakdown, claimedReliefs, reliefHeadroom },
    });

    // The model is asked for pure JSON; be defensive and extract the object.
    let analysis = null;
    try {
      const m = (out.reply || '').match(/\{[\s\S]*\}/);
      if (m) analysis = JSON.parse(m[0]);
    } catch { analysis = null; }

    // Persist for next time (only a clean parse is worth caching).
    if (analysis) {
      try {
        await pool.query(
          `INSERT INTO ai_optimizations (user_id, tax_year, input_hash, analysis, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (user_id, tax_year)
           DO UPDATE SET input_hash = EXCLUDED.input_hash, analysis = EXCLUDED.analysis, updated_at = NOW()`,
          [req.user.id, taxYear, inputHash, JSON.stringify(analysis)]
        );
      } catch (e) { logger.warn('optimize: failed to cache analysis', { message: e.message }); }
    }

    // If the safety filter blocked the reply, surface it as a structured error
    // rather than dumping the refusal text into the raw <pre>. The frontend
    // routes `blocked` to its error banner.
    if (out.blocked) {
      return res.json({
        success: true,
        taxYear,
        cached: false,
        blocked: true,
        analysis: null,
        message: 'The AI could not analyse this return (the request was blocked by the safety filter). Please try again or rephrase.',
        reliefHeadroom,
        conversationId: out.conversationId,
      });
    }

    res.json({
      success: true,
      taxYear,
      cached: false,
      analysedAt: new Date().toISOString(),
      analysis,                          // {summary, opportunities[], disclaimer} or null
      raw: analysis ? undefined : out.reply,   // fall back to raw text if parse failed
      reliefHeadroom,
      sources: out.sources,
      conversationId: out.conversationId,
      blocked: out.blocked || undefined,
    });
  } catch (e) { sendErr(res, e); }
});

// List user's conversations.
router.get('/conversations', auth, async (req, res) => {
  try {
    const rows = await service.listConversations(req.user.id);
    res.json({ success: true, conversations: rows });
  } catch (e) { sendErr(res, e); }
});

// Fetch one conversation with its messages.
router.get('/conversations/:id', auth, async (req, res) => {
  try {
    const out = await service.getConversation(req.user.id, req.params.id);
    res.json({ success: true, ...out });
  } catch (e) { sendErr(res, e); }
});

router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    await service.deleteConversation(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (e) { sendErr(res, e); }
});

// Admin: reload knowledge base from disk (after dropping new docs in).
router.post('/knowledge-base/reload', auth, async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const count = await kb.loadAll();
    res.json({ success: true, chunkCount: count, status: kb.status() });
  } catch (e) { sendErr(res, e); }
});

// Admin: upload new documents to the knowledge base.
router.post('/knowledge-base/upload', auth, upload.array('files', 10), async (req, res) => {
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    // Clean up temp uploads if access is denied.
    (req.files || []).forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const saved = [];
    const kbRoot = path.resolve(kb.KB_DIR);
    for (const f of req.files || []) {
      // multer drops files into KB_DIR with random names; rename to original.
      // Harden against path traversal (audit SEC-04): the client-supplied
      // originalname is untrusted, so strip any directory components with
      // path.basename and verify the resolved target stays directly inside
      // KB_DIR before writing. Without this, an originalname such as
      // "../../app/x.md" (which still passes the extension filter) would escape
      // KB_DIR via path.join into an arbitrary-file-write.
      const safeName = path.basename(f.originalname);
      const target = path.resolve(kbRoot, safeName);
      if (path.dirname(target) !== kbRoot || !safeName || safeName === '.' || safeName === '..') {
        try { fs.unlinkSync(f.path); } catch {}
        return res.status(400).json({ success: false, message: `Invalid filename: ${f.originalname}` });
      }
      fs.renameSync(f.path, target);
      saved.push(safeName);
    }
    const count = await kb.loadAll();
    res.json({ success: true, uploaded: saved, chunkCount: count });
  } catch (e) { sendErr(res, e); }
});

module.exports = router;
