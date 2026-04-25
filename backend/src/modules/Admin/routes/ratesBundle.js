/**
 * Rates-bundle admin endpoints.
 *
 *   GET  /api/admin/rates-bundle/preview          — diff the bundle against DB
 *   POST /api/admin/rates-bundle/apply            — apply the diff atomically
 *   GET  /api/admin/rates-bundle/info             — metadata for the UI
 *
 * The bundle file lives at backend/data/rates-bundle.json (committed to the
 * repo, maintained annually when FBR publishes Finance Act updates). The UI
 * shows the diff and asks for confirmation before applying — no silent
 * overwrites, every change audit-logged, full rollback on any sub-failure.
 *
 * Remote fetch: if RATES_BUNDLE_URL is set, preview/apply fetch from that URL
 * instead of the local file. Lets ops push an updated bundle without a code
 * deploy.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const jwtAuth = require('../../../middleware/auth');
const { insertAudit } = require('../../../helpers/auditLog');

const router = express.Router();

const DEFAULT_BUNDLE_PATH = path.join(__dirname, '..', '..', '..', '..', 'data', 'rates-bundle.json');

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

async function loadBundle() {
  const url = process.env.RATES_BUNDLE_URL;
  if (url) {
    // Remote fetch — node 18+ has global fetch.
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`bundle fetch failed: HTTP ${res.status}`);
    return { source: url, bundle: await res.json() };
  }
  if (!fs.existsSync(DEFAULT_BUNDLE_PATH)) {
    throw new Error(`bundle file missing at ${DEFAULT_BUNDLE_PATH}`);
  }
  return { source: DEFAULT_BUNDLE_PATH, bundle: JSON.parse(fs.readFileSync(DEFAULT_BUNDLE_PATH, 'utf8')) };
}

function verifyChecksum(bundle) {
  if (!bundle.checksum) return { ok: true, note: 'no checksum field' };
  const expected = crypto.createHash('sha256')
    .update(JSON.stringify(bundle.tax_years))
    .digest('hex');
  return expected === bundle.checksum
    ? { ok: true }
    : { ok: false, note: `checksum mismatch: bundle says ${bundle.checksum}, computed ${expected}` };
}

async function readDbState(taxYear) {
  const yr = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
  if (yr.rows.length === 0) return { slabs: [], rates: [] };
  const taxYearId = yr.rows[0].id;
  const slabs = await pool.query(
    `SELECT slab_type, slab_order, slab_name, min_income, max_income, tax_rate, fixed_amount
       FROM tax_slabs WHERE tax_year_id = $1 ORDER BY slab_type, slab_order`,
    [taxYearId]
  );
  const rates = await pool.query(
    `SELECT rate_type, rate_category, tax_rate, min_amount, max_amount,
            fixed_amount, description, fbr_reference
       FROM tax_rates_config WHERE tax_year = $1 AND is_active = true
       ORDER BY rate_type, rate_category`,
    [taxYear]
  );
  return {
    slabs: slabs.rows.map((r) => ({
      slab_type: r.slab_type,
      slab_order: r.slab_order,
      slab_name: r.slab_name,
      min_income: Number(r.min_income),
      max_income: r.max_income === null ? null : Number(r.max_income),
      tax_rate: Number(r.tax_rate),
      fixed_amount: Number(r.fixed_amount),
    })),
    rates: rates.rows.map((r) => ({
      rate_type: r.rate_type,
      rate_category: r.rate_category,
      tax_rate: Number(r.tax_rate),
      min_amount: Number(r.min_amount),
      max_amount: Number(r.max_amount),
      fixed_amount: Number(r.fixed_amount),
      description: r.description,
      fbr_reference: r.fbr_reference,
    })),
  };
}

/** Identity key for diff. */
const slabKey = (s) => `${s.slab_type}|${s.slab_order}`;
const rateKey = (r) => `${r.rate_type}|${r.rate_category}`;

function diffLists(bundleItems, dbItems, keyFn, compareFields) {
  const dbMap = new Map(dbItems.map((x) => [keyFn(x), x]));
  const bMap = new Map(bundleItems.map((x) => [keyFn(x), x]));
  const toAdd = [];
  const toUpdate = [];
  const toRemove = [];
  for (const [k, b] of bMap) {
    const d = dbMap.get(k);
    if (!d) { toAdd.push(b); continue; }
    const changed = compareFields.filter((f) => {
      const bv = b[f] === null || b[f] === undefined ? null : b[f];
      const dv = d[f] === null || d[f] === undefined ? null : d[f];
      return String(bv) !== String(dv);
    });
    if (changed.length > 0) toUpdate.push({ key: k, before: d, after: b, changed });
  }
  for (const [k, d] of dbMap) {
    if (!bMap.has(k)) toRemove.push(d);
  }
  return { toAdd, toUpdate, toRemove };
}

/** Shape the diff for API response. */
function computeDiff(bundleYear, dbState) {
  const slabDiff = diffLists(
    bundleYear.slabs, dbState.slabs, slabKey,
    ['min_income', 'max_income', 'tax_rate', 'fixed_amount', 'slab_name'],
  );
  const rateDiff = diffLists(
    bundleYear.rates, dbState.rates, rateKey,
    ['tax_rate', 'min_amount', 'max_amount', 'fixed_amount', 'description', 'fbr_reference'],
  );
  return { slabs: slabDiff, rates: rateDiff };
}

// ── GET /api/admin/rates-bundle/info ─────────────────────────────────────
router.get('/info', jwtAuth, async (req, res) => {
  try {
    const { source, bundle } = await loadBundle();
    const verify = verifyChecksum(bundle);
    res.json({
      success: true,
      data: {
        source,
        version: bundle.version,
        generated_at: bundle.generated_at,
        checksum: bundle.checksum,
        checksum_ok: verify.ok,
        checksum_note: verify.note || null,
        years: bundle.tax_years?.map((y) => y.tax_year) || [],
        total_slabs: bundle.tax_years?.reduce((a, y) => a + (y.slabs?.length || 0), 0) || 0,
        total_rates: bundle.tax_years?.reduce((a, y) => a + (y.rates?.length || 0), 0) || 0,
      },
    });
  } catch (e) {
    logger.error('bundle info failed', { message: e?.message });
    res.status(500).json({ error: e?.message || 'Failed to load bundle' });
  }
});

// ── GET /api/admin/rates-bundle/preview ──────────────────────────────────
router.get('/preview', jwtAuth, async (req, res) => {
  try {
    const { source, bundle } = await loadBundle();
    const verify = verifyChecksum(bundle);

    const perYear = [];
    for (const y of bundle.tax_years || []) {
      const dbState = await readDbState(y.tax_year);
      const diff = computeDiff(y, dbState);
      perYear.push({
        tax_year: y.tax_year,
        summary: {
          slabs_add: diff.slabs.toAdd.length,
          slabs_update: diff.slabs.toUpdate.length,
          slabs_remove: diff.slabs.toRemove.length,
          rates_add: diff.rates.toAdd.length,
          rates_update: diff.rates.toUpdate.length,
          rates_remove: diff.rates.toRemove.length,
        },
        diff,
      });
    }

    const totalChanges = perYear.reduce((a, y) => {
      const s = y.summary;
      return a + s.slabs_add + s.slabs_update + s.slabs_remove + s.rates_add + s.rates_update + s.rates_remove;
    }, 0);

    res.json({
      success: true,
      data: {
        source,
        bundle_version: bundle.version,
        checksum_ok: verify.ok,
        checksum_note: verify.note || null,
        total_changes: totalChanges,
        years: perYear,
      },
    });
  } catch (e) {
    logger.error('bundle preview failed', { message: e?.message });
    res.status(500).json({ error: e?.message || 'Preview failed' });
  }
});

// ── POST /api/admin/rates-bundle/apply ───────────────────────────────────
router.post('/apply', jwtAuth, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { source, bundle } = await loadBundle();
    const verify = verifyChecksum(bundle);
    if (!verify.ok) {
      return res.status(400).json({ error: `Bundle checksum mismatch: ${verify.note}` });
    }

    const applied = [];
    await client.query('BEGIN');

    for (const y of bundle.tax_years || []) {
      // Ensure the tax_year row exists.
      let yrRow = await client.query('SELECT id FROM tax_years WHERE tax_year = $1', [y.tax_year]);
      if (yrRow.rows.length === 0) {
        yrRow = await client.query(
          `INSERT INTO tax_years (tax_year, is_active, is_current, start_date, end_date, description)
           VALUES ($1, true, false,
             (SUBSTR($1, 1, 4)::int || '-07-01')::date,
             ((SUBSTR($1, 1, 4)::int + 1) || '-06-30')::date,
             'Seeded via rates bundle')
           RETURNING id`,
          [y.tax_year]
        );
      }
      const taxYearId = yrRow.rows[0].id;

      // Upsert slabs. effective_from is NOT NULL on tax_slabs, so default new
      // inserts to the tax year's start_date (falls back to today if missing).
      for (const s of y.slabs || []) {
        await client.query(
          `INSERT INTO tax_slabs (tax_year_id, slab_type, slab_order, slab_name,
             min_income, max_income, tax_rate, fixed_amount, effective_from)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                   COALESCE((SELECT start_date FROM tax_years WHERE id = $1), CURRENT_DATE))
           ON CONFLICT (tax_year_id, slab_type, slab_order)
           DO UPDATE SET slab_name = EXCLUDED.slab_name,
                         min_income = EXCLUDED.min_income,
                         max_income = EXCLUDED.max_income,
                         tax_rate = EXCLUDED.tax_rate,
                         fixed_amount = EXCLUDED.fixed_amount,
                         updated_at = NOW()`,
          [taxYearId, s.slab_type, s.slab_order, s.slab_name,
           s.min_income, s.max_income, s.tax_rate, s.fixed_amount]
        );
      }

      // Upsert rates.
      for (const r of y.rates || []) {
        await client.query(
          `INSERT INTO tax_rates_config (tax_year, rate_type, rate_category,
             tax_rate, min_amount, max_amount, fixed_amount,
             description, fbr_reference, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
           ON CONFLICT (tax_year, rate_type, rate_category)
           DO UPDATE SET tax_rate = EXCLUDED.tax_rate,
                         min_amount = EXCLUDED.min_amount,
                         max_amount = EXCLUDED.max_amount,
                         fixed_amount = EXCLUDED.fixed_amount,
                         description = EXCLUDED.description,
                         fbr_reference = EXCLUDED.fbr_reference,
                         is_active = true,
                         updated_at = NOW()`,
          [y.tax_year, r.rate_type, r.rate_category, r.tax_rate,
           r.min_amount, r.max_amount, r.fixed_amount,
           r.description, r.fbr_reference]
        );
      }
      applied.push({
        tax_year: y.tax_year,
        slabs: (y.slabs || []).length,
        rates: (y.rates || []).length,
      });
    }

    await insertAudit(client, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'apply_rates_bundle',
      tableName: 'tax_rates_config',
      newValue: { source, version: bundle.version, checksum: bundle.checksum, applied },
      category: 'tax_rate_admin',
      severity: 'high',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    await client.query('COMMIT');
    res.json({
      success: true,
      data: { source, version: bundle.version, applied },
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('bundle apply failed', { message: e?.message });
    res.status(500).json({ error: e?.message || 'Bundle apply failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
