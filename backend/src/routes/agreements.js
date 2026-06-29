// User consent / agreement acceptance API (phase-z12).
//
//   GET  /api/agreements/status  → which required agreements this user still
//                                  needs to accept (drives the consent gate).
//   POST /api/agreements/accept  → record acceptance of the current versions,
//                                  with IP + user-agent, and mirror to audit_log.
//
// The acceptance ledger (user_agreement_acceptances) is the legal record; the
// audit_log entry is supplementary and fail-open so a transient audit hiccup
// can never lose a recorded consent.

const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const { insertAudit } = require('../helpers/auditLog');
const { REQUIRED_AGREEMENTS } = require('../config/agreements');

const router = express.Router();

const verKey = (key, version) => `${key}@${version}`;

// GET /api/agreements/status — list what's required and what's still pending.
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT agreement_key, version FROM user_agreement_acceptances WHERE user_id = $1`,
      [userId]
    );
    const accepted = new Set(rows.map((r) => verKey(r.agreement_key, r.version)));
    const pending = REQUIRED_AGREEMENTS.filter(
      (a) => !accepted.has(verKey(a.key, a.version))
    );

    res.json({
      success: true,
      required: REQUIRED_AGREEMENTS,
      pending: pending.map(({ key, version, title, route }) => ({ key, version, title, route })),
    });
  } catch (error) {
    logger.error('agreements status error:', error);
    res.status(500).json({ success: false, message: 'Could not load agreement status' });
  }
});

// POST /api/agreements/accept — body { keys?: [...] }. Omitting keys accepts
// every currently-required agreement at its current version.
router.post('/accept', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const ip = req.ip || null;
    const ua = req.headers['user-agent'] || null;
    const uaTrimmed = typeof ua === 'string' ? ua.slice(0, 512) : null;

    const requested = Array.isArray(req.body?.keys) && req.body.keys.length
      ? new Set(req.body.keys)
      : null; // null = accept all required

    const toAccept = REQUIRED_AGREEMENTS.filter((a) => !requested || requested.has(a.key));
    if (toAccept.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid agreements to accept' });
    }

    // The acceptance rows ARE the legal record — commit them first.
    for (const a of toAccept) {
      await pool.query(
        `INSERT INTO user_agreement_acceptances (user_id, agreement_key, version, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, agreement_key, version) DO NOTHING`,
        [userId, a.key, a.version, ip, uaTrimmed]
      );
    }

    // Supplementary, fail-open: never block/rollback consent on an audit hiccup.
    await insertAudit(pool, {
      userId,
      userEmail,
      action: 'agreements_accepted',
      tableName: 'user_agreement_acceptances',
      recordId: userId,
      newValue: { accepted: toAccept.map((a) => ({ key: a.key, version: a.version })) },
      category: 'consent',
      severity: 'info',
      changeSummary: `Accepted ${toAccept.length} agreement(s)`,
      ipAddress: ip,
      userAgent: ua,
      mandatory: false,
    });

    res.json({ success: true, accepted: toAccept.map((a) => ({ key: a.key, version: a.version })) });
  } catch (error) {
    logger.error('agreements accept error:', error);
    res.status(500).json({ success: false, message: 'Could not record acceptance' });
  }
});

module.exports = router;
