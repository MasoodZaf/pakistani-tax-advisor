// Client-facing consultant relationship (phase-z9).
//
// The consultant_clients link is the CLIENT's to see and to end: a user can
// check who (if anyone) manages their return and deregister at any time. The
// two-step re-hire flow hangs off this — a new consultant cannot be assigned
// until the client has deregistered from the current one.
//
// Mounted at /api/consultant-link. Regular authenticated users only — there is
// nothing here for staff accounts.

const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { insertAudit } = require('../helpers/auditLog');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/consultant-link — who is my consultant? { consultant: {...} | null }
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.name, u.email, cc.assigned_at
      FROM consultant_clients cc
      JOIN users u ON u.id = cc.consultant_id
      WHERE cc.client_id = $1
    `, [req.user.id]);

    res.json({
      success: true,
      data: { consultant: result.rows[0] || null },
    });
  } catch (error) {
    logger.error('Get consultant link error:', error);
    res.status(500).json({ error: 'Failed to fetch consultant', message: error.message });
  }
});

// DELETE /api/consultant-link — deregister from my consultant.
router.delete('/', auth, async (req, res) => {
  try {
    const existing = await pool.query(`
      SELECT cc.consultant_id, u.email as consultant_email
      FROM consultant_clients cc
      JOIN users u ON u.id = cc.consultant_id
      WHERE cc.client_id = $1
    `, [req.user.id]);

    if (!existing.rows.length) {
      return res.status(404).json({
        error: 'No consultant',
        message: 'You are not registered with a consultant',
      });
    }

    await pool.query('DELETE FROM consultant_clients WHERE client_id = $1', [req.user.id]);

    // Mandatory audit — ending the relationship changes who can see this
    // user's tax data; it must be traceable.
    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'consultant_deregistered',
      tableName: 'consultant_clients',
      recordId: req.user.id,
      oldValue: { consultant_id: existing.rows[0].consultant_id },
      category: 'consultant_isolation',
      severity: 'high',
      changeSummary: `Client ${req.user.email} deregistered from consultant ${existing.rows[0].consultant_email}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    logger.info(`Client ${req.user.email} deregistered from consultant ${existing.rows[0].consultant_email}`);
    res.json({ success: true, message: 'You are no longer registered with a consultant' });
  } catch (error) {
    logger.error('Deregister consultant error:', error);
    res.status(500).json({ error: 'Failed to deregister', message: error.message });
  }
});

module.exports = router;
