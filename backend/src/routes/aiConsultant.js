const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const service = require('../services/aiConsultant/consultantService');
const kb = require('../services/aiConsultant/knowledgeBase');
const { isConfigured } = require('../services/aiConsultant/deepseekClient');
const TaxCalculationService = require('../services/taxCalculationService');
const { pool } = require('../config/database');

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

    const out = await service.taxOptimization({
      userId: req.user.id,
      taxYear,
      includePII: !!includePII,
      taxData: { computation: breakdown, claimedReliefs },
    });

    // The model is asked for pure JSON; be defensive and extract the object.
    let analysis = null;
    try {
      const m = (out.reply || '').match(/\{[\s\S]*\}/);
      if (m) analysis = JSON.parse(m[0]);
    } catch { analysis = null; }

    res.json({
      success: true,
      taxYear,
      analysis,                          // {summary, opportunities[], disclaimer} or null
      raw: analysis ? undefined : out.reply,   // fall back to raw text if parse failed
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
