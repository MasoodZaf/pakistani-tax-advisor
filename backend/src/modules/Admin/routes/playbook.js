/**
 * Tax-Efficiency Playbook admin — manage the strategies the AI consultant uses.
 *
 *   GET    /api/admin/playbook            — list all strategies
 *   POST   /api/admin/playbook            — create (status=draft)
 *   PUT    /api/admin/playbook/:id        — edit
 *   POST   /api/admin/playbook/:id/approve   — approve (ingested into the AI KB)
 *   POST   /api/admin/playbook/:id/archive   — archive (removed from the AI KB)
 *   DELETE /api/admin/playbook/:id        — delete
 *
 * APPROVED strategies are ingested into the AI knowledge base; any status change
 * triggers a KB reload so it takes effect immediately. Super-admin only; all
 * mutations are audited. General tax knowledge only — never any user's data.
 */

const express = require('express');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const jwtAuth = require('../../../middleware/auth');
const { insertAudit } = require('../../../helpers/auditLog');
const kb = require('../../../services/aiConsultant/knowledgeBase');

const router = express.Router();

const FORM_STEPS = ['', 'deductions', 'credits', 'reductions', 'income', 'adjustable-tax', 'final-min-income', 'capital-gains'];

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

const clean = (v, max) => (v == null ? null : String(v).trim().slice(0, max) || null);

async function reloadKb(reason) {
  try { await kb.loadAll(); } catch (e) { logger.warn(`playbook: KB reload failed (${reason}): ${e.message}`); }
}

// List all strategies (admin view — drafts + approved + archived).
router.get('/', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, profile, relief, section, cap_note, how_to, caveat,
              form_step, status, created_at, updated_at, approved_at
         FROM playbook_strategies ORDER BY
         CASE status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, updated_at DESC`
    );
    res.json({ success: true, strategies: r.rows });
  } catch (e) {
    logger.error('playbook list failed', { message: e.message });
    res.status(500).json({ error: 'Failed to load playbook' });
  }
});

// Create a draft strategy.
router.post('/', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const formStep = FORM_STEPS.includes(b.form_step) ? (b.form_step || null) : null;
    const r = await pool.query(
      `INSERT INTO playbook_strategies (title, profile, relief, section, cap_note, how_to, caveat, form_step, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9) RETURNING *`,
      [clean(b.title, 200), clean(b.profile, 2000), clean(b.relief, 200), clean(b.section, 120),
       clean(b.cap_note, 200), clean(b.how_to, 2000), clean(b.caveat, 2000), formStep, req.user.id]
    );
    await insertAudit(pool, { userId: req.user.id, userEmail: req.user.email, action: 'create',
      tableName: 'playbook_strategies', recordId: r.rows[0].id, category: 'tax_rate_admin', severity: 'medium',
      ipAddress: req.ip, userAgent: req.headers['user-agent'] }).catch(() => {});
    res.json({ success: true, strategy: r.rows[0] });
  } catch (e) {
    logger.error('playbook create failed', { message: e.message });
    res.status(500).json({ error: 'Failed to create strategy' });
  }
});

// Edit a strategy (does not change status; re-ingest if it was approved).
router.put('/:id', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const formStep = FORM_STEPS.includes(b.form_step) ? (b.form_step || null) : null;
    const r = await pool.query(
      `UPDATE playbook_strategies SET title=$1, profile=$2, relief=$3, section=$4, cap_note=$5,
              how_to=$6, caveat=$7, form_step=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [clean(b.title, 200), clean(b.profile, 2000), clean(b.relief, 200), clean(b.section, 120),
       clean(b.cap_note, 200), clean(b.how_to, 2000), clean(b.caveat, 2000), formStep, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Strategy not found' });
    if (r.rows[0].status === 'approved') await reloadKb('edit');
    res.json({ success: true, strategy: r.rows[0] });
  } catch (e) {
    logger.error('playbook update failed', { message: e.message });
    res.status(500).json({ error: 'Failed to update strategy' });
  }
});

// Approve / archive — both change status then reload the AI KB.
for (const [path, status, sev] of [['approve', 'approved', 'high'], ['archive', 'archived', 'medium']]) {
  router.post(`/:id/${path}`, jwtAuth, requireSuperAdmin, async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE playbook_strategies
            SET status=$1, approved_by=$2, approved_at=$3, updated_at=NOW()
          WHERE id=$4 RETURNING *`,
        [status, status === 'approved' ? req.user.id : null, status === 'approved' ? new Date() : null, req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Strategy not found' });
      await insertAudit(pool, { userId: req.user.id, userEmail: req.user.email, action: status,
        tableName: 'playbook_strategies', recordId: req.params.id, category: 'tax_rate_admin', severity: sev,
        ipAddress: req.ip, userAgent: req.headers['user-agent'] }).catch(() => {});
      await reloadKb(path);
      res.json({ success: true, strategy: r.rows[0], kb: kb.status() });
    } catch (e) {
      logger.error(`playbook ${path} failed`, { message: e.message });
      res.status(500).json({ error: `Failed to ${path} strategy` });
    }
  });
}

router.delete('/:id', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM playbook_strategies WHERE id=$1 RETURNING status', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Strategy not found' });
    await insertAudit(pool, { userId: req.user.id, userEmail: req.user.email, action: 'delete',
      tableName: 'playbook_strategies', recordId: req.params.id, category: 'tax_rate_admin', severity: 'medium',
      ipAddress: req.ip, userAgent: req.headers['user-agent'] }).catch(() => {});
    if (r.rows[0].status === 'approved') await reloadKb('delete');
    res.json({ success: true });
  } catch (e) {
    logger.error('playbook delete failed', { message: e.message });
    res.status(500).json({ error: 'Failed to delete strategy' });
  }
});

module.exports = router;
