/**
 * Tax rates admin — CRUD on tax_rates_config for all non-slab rate types.
 *
 * Slabs live in a separate table (tax_slabs) with their own routes in admin.js.
 * Everything else (surcharge, super_tax, WHT, CGT, final_tax, credit_cap,
 * deduction_threshold, reduction) lives in tax_rates_config and was only
 * editable via SQL until now. This file adds:
 *
 *   GET    /api/admin/tax-rates?taxYear=2025-26[&rateType=surcharge]
 *   POST   /api/admin/tax-rates
 *   PUT    /api/admin/tax-rates/:id
 *   DELETE /api/admin/tax-rates/:id
 *   GET    /api/admin/tax-rates/types
 *
 * All mutations require super_admin and write to audit_log.
 */

const express = require('express');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const jwtAuth = require('../../../middleware/auth');
const { insertAudit } = require('../../../helpers/auditLog');

const router = express.Router();

// Canonical rate_type values. Anything else is rejected at write time.
const RATE_TYPES = [
  'surcharge',
  'super_tax',
  'withholding',
  'capital_gains',
  'final_tax',
  'credit_cap',
  'deduction_threshold',
  'reduction',
];

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Coerce pg NUMERIC strings to Number on read so the frontend gets typed data. */
function shapeRow(row) {
  return {
    id: row.id,
    tax_year: row.tax_year,
    rate_type: row.rate_type,
    rate_category: row.rate_category,
    tax_rate: toNum(row.tax_rate),
    min_amount: toNum(row.min_amount),
    max_amount: toNum(row.max_amount),
    fixed_amount: toNum(row.fixed_amount),
    description: row.description,
    fbr_reference: row.fbr_reference,
    effective_date: row.effective_date,
    end_date: row.end_date,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── GET /api/admin/tax-rates/types ────────────────────────────────────────
router.get('/types', jwtAuth, async (req, res) => {
  res.json({ success: true, data: RATE_TYPES });
});

// ── GET /api/admin/tax-rates ──────────────────────────────────────────────
router.get('/', jwtAuth, async (req, res) => {
  try {
    const { taxYear, rateType } = req.query;
    if (!taxYear) return res.status(400).json({ error: 'taxYear is required' });

    const params = [taxYear];
    let sql = `SELECT * FROM tax_rates_config WHERE tax_year = $1 AND is_active = true`;
    if (rateType) {
      if (!RATE_TYPES.includes(rateType)) {
        return res.status(400).json({ error: `Unknown rate_type. Allowed: ${RATE_TYPES.join(', ')}` });
      }
      sql += ` AND rate_type = $2`;
      params.push(rateType);
    }
    sql += ` ORDER BY rate_type, COALESCE(min_amount, 0), rate_category`;

    const r = await pool.query(sql, params);
    const shaped = r.rows.map(shapeRow);

    // Group by rate_type for convenience.
    const byType = {};
    for (const row of shaped) {
      (byType[row.rate_type] ||= []).push(row);
    }

    res.json({ success: true, data: shaped, grouped: byType, count: shaped.length });
  } catch (e) {
    logger.error('GET /tax-rates failed', { message: e?.message });
    res.status(500).json({ error: 'Failed to list tax rates' });
  }
});

// ── POST /api/admin/tax-rates ─────────────────────────────────────────────
router.post('/', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const {
      tax_year, rate_type, rate_category,
      tax_rate, min_amount = 0, max_amount = 999999999999,
      fixed_amount = 0, description, fbr_reference,
    } = req.body || {};

    if (!tax_year || !rate_type || !rate_category) {
      return res.status(400).json({ error: 'tax_year, rate_type and rate_category are required' });
    }
    if (!RATE_TYPES.includes(rate_type)) {
      return res.status(400).json({ error: `Unknown rate_type. Allowed: ${RATE_TYPES.join(', ')}` });
    }
    if (toNum(tax_rate) === null) {
      return res.status(400).json({ error: 'tax_rate must be numeric' });
    }

    const r = await pool.query(
      `INSERT INTO tax_rates_config
         (tax_year, rate_type, rate_category, tax_rate, min_amount, max_amount, fixed_amount,
          description, fbr_reference, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
       RETURNING *`,
      [
        tax_year, rate_type, rate_category,
        toNum(tax_rate), toNum(min_amount) ?? 0, toNum(max_amount) ?? 999999999999,
        toNum(fixed_amount) ?? 0, description || null, fbr_reference || null,
      ]
    );

    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'create',
      tableName: 'tax_rates_config',
      recordId: r.rows[0].id,
      newValue: { rate_type, rate_category, tax_rate },
      category: 'tax_rate_admin',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    res.json({ success: true, data: shapeRow(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'A rate with this (tax_year, rate_type, rate_category) already exists' });
    }
    logger.error('POST /tax-rates failed', { message: e?.message });
    res.status(500).json({ error: 'Failed to create tax rate' });
  }
});

// ── PUT /api/admin/tax-rates/:id ──────────────────────────────────────────
router.put('/:id', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const before = await pool.query('SELECT * FROM tax_rates_config WHERE id = $1', [id]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Rate not found' });

    const existing = before.rows[0];
    const {
      tax_rate        = existing.tax_rate,
      min_amount      = existing.min_amount,
      max_amount      = existing.max_amount,
      fixed_amount    = existing.fixed_amount,
      description     = existing.description,
      fbr_reference   = existing.fbr_reference,
      is_active       = existing.is_active,
    } = req.body || {};

    if (toNum(tax_rate) === null) {
      return res.status(400).json({ error: 'tax_rate must be numeric' });
    }

    const r = await pool.query(
      `UPDATE tax_rates_config
          SET tax_rate = $1, min_amount = $2, max_amount = $3, fixed_amount = $4,
              description = $5, fbr_reference = $6, is_active = $7,
              updated_at = NOW()
        WHERE id = $8
      RETURNING *`,
      [
        toNum(tax_rate), toNum(min_amount) ?? 0, toNum(max_amount) ?? 999999999999,
        toNum(fixed_amount) ?? 0, description, fbr_reference, is_active, id,
      ]
    );

    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'update',
      tableName: 'tax_rates_config',
      recordId: id,
      oldValue: {
        tax_rate: existing.tax_rate,
        min_amount: existing.min_amount,
        max_amount: existing.max_amount,
        fixed_amount: existing.fixed_amount,
        is_active: existing.is_active,
      },
      newValue: { tax_rate, min_amount, max_amount, fixed_amount, is_active },
      category: 'tax_rate_admin',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    res.json({ success: true, data: shapeRow(r.rows[0]) });
  } catch (e) {
    logger.error('PUT /tax-rates failed', { message: e?.message });
    res.status(500).json({ error: 'Failed to update tax rate' });
  }
});

// ── DELETE /api/admin/tax-rates/:id ───────────────────────────────────────
router.delete('/:id', jwtAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const before = await pool.query('SELECT * FROM tax_rates_config WHERE id = $1', [id]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Rate not found' });

    await pool.query('DELETE FROM tax_rates_config WHERE id = $1', [id]);

    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'delete',
      tableName: 'tax_rates_config',
      recordId: id,
      oldValue: before.rows[0],
      category: 'tax_rate_admin',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    res.json({ success: true, message: 'Rate deleted' });
  } catch (e) {
    logger.error('DELETE /tax-rates failed', { message: e?.message });
    res.status(500).json({ error: 'Failed to delete tax rate' });
  }
});

module.exports = router;
