/**
 * Statutory Reliefs — the open legal questions, as editable settings.
 *
 * WHY THIS EXISTS
 * ---------------
 * The FBR research behind phase-z19 ended with three questions that code cannot
 * honestly answer:
 *
 *   1. Does s.60D(2) read "less than" Rs 1,500,000, or "does not exceed" it?
 *      Published sources disagree. It changes the answer for exactly one
 *      taxpayer — the one at precisely the threshold.
 *   2. Is there ANY basis for the "professional expenses" allowance the app used
 *      to grant? It cited s.60C, which was the profit-on-debt allowance and was
 *      omitted by Finance Act 2022; it never covered professional or
 *      point-of-sale expenses. The research found no other provision.
 *   3. What are the parameters of the FA-2025 housing-loan profit-on-debt TAX
 *      CREDIT? The app does not implement it at all, so entitled taxpayers are
 *      over-paying — but no primary source pinned down the cap.
 *
 * Leaving these as footnotes in a report would mean the app quietly ships one
 * particular answer to each. Instead each is an explicit setting the owner (or
 * their tax counsel) can read, understand and change, with a full statutory
 * account attached and an audit-log entry on every write.
 *
 * DESIGN RULES
 * ------------
 *  - Nothing here invents a rate. Every value read and written is a
 *    `tax_rates_config` row; this module is a curated, documented VIEW over
 *    those rows, not a second source of truth.
 *  - Every default is the CONSERVATIVE reading — deny the relief. A missing or
 *    unanswered question must never widen a taxpayer's claim.
 *  - Each item carries `whyItMatters` and `ifYouChangeIt` in plain language,
 *    because the person answering these is a tax adviser, not an engineer, and
 *    a settings screen that only shows a column name and a number is not a
 *    question anyone can answer responsibly.
 *  - `counselNote` is free text stored on the row's `description`, so whoever
 *    settles a question can record WHO decided and on what authority. That note
 *    is what makes the setting auditable a year later.
 *
 *   GET  /api/admin/statutory-reliefs?taxYear=2025-26
 *   PUT  /api/admin/statutory-reliefs/:key       (super_admin)
 *
 * Mutations are super_admin only and always audited: these settings move real
 * money on real returns.
 */

const express = require('express');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const jwtAuth = require('../../../middleware/auth');
const { insertAudit } = require('../../../helpers/auditLog');
const TaxRateService = require('../../../services/taxRateService');

const router = express.Router();

const {
  RELIEF_QUESTIONS,
  BY_KEY,
  toNum,
} = require('../helpers/reliefQuestions');

function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

/** Load the backing rows for one question, whether active or not. */
async function loadRows(taxYear, question) {
  const out = [];
  for (const spec of question.rows) {
    const r = await pool.query(
      `SELECT * FROM tax_rates_config
        WHERE tax_year = $1 AND rate_type = $2 AND rate_category = $3
        ORDER BY id LIMIT 1`,
      [taxYear, spec.rateType, spec.category]
    );
    out.push(r.rows[0] || null);
  }
  return out;
}

// ── GET /api/admin/statutory-reliefs ─────────────────────────────────────────
router.get('/', jwtAuth, async (req, res) => {
  try {
    const taxYear = req.query.taxYear;
    if (!taxYear) return res.status(400).json({ error: 'taxYear is required' });

    const items = [];
    for (const q of RELIEF_QUESTIONS) {
      const rows = await loadRows(taxYear, q);
      items.push({
        key: q.key,
        title: q.title,
        citation: q.citation,
        status: q.status,
        question: q.question,
        whyItMatters: q.whyItMatters,
        background: q.background,
        ifYouChangeIt: q.ifYouChangeIt,
        control: q.control,
        options: q.options || null,
        fields: q.fields || null,
        currentValue: q.readValue(rows),
        // The live numbers, so the screen shows what is actually in force
        // rather than what the catalogue says should be.
        currentRows: rows.map((r, i) => ({
          exists: Boolean(r),
          rate_category: q.rows[i].category,
          rate_type: q.rows[i].rateType,
          tax_rate: r ? toNum(r.tax_rate) : null,
          fixed_amount: r ? toNum(r.fixed_amount) : null,
          is_active: r ? r.is_active : false,
          fbr_reference: r ? r.fbr_reference : null,
          counselNote: r ? r.description : null,
          updated_at: r ? r.updated_at : null,
        })),
      });
    }

    res.json({ success: true, taxYear, data: items });
  } catch (e) {
    logger.error('GET /statutory-reliefs failed', { message: e?.message });
    res.status(500).json({ error: 'Failed to load statutory relief settings' });
  }
});

// ── PUT /api/admin/statutory-reliefs/:key ────────────────────────────────────
router.put('/:key', jwtAuth, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const q = BY_KEY.get(req.params.key);
    if (!q) return res.status(404).json({ error: 'Unknown statutory relief setting' });

    const { taxYear, value, params, counselNote, authority } = req.body || {};
    if (!taxYear) return res.status(400).json({ error: 'taxYear is required' });

    // An answer to a legal question without a stated authority is not an answer
    // anyone can stand behind later — including the person who gave it. This is
    // the one field the endpoint insists on.
    if (!counselNote || String(counselNote).trim().length < 10) {
      return res.status(400).json({
        error:
          'A note is required: record who settled this and on what authority. It is stored with '
          + 'the setting and is what the app will show as its basis.',
        field: 'counselNote',
      });
    }

    const before = await loadRows(taxYear, q);

    await client.query('BEGIN');

    let applied;
    if (q.control === 'choice') {
      const option = (q.options || []).find((o) => o.value === value);
      if (!option) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `value must be one of: ${(q.options || []).map((o) => o.value).join(', ')}`,
        });
      }
      applied = option.write;
      await upsertRow(client, taxYear, q.rows[0], {
        ...option.write,
        is_active: true,
        description: String(counselNote).trim(),
        fbr_reference: authority || q.citation,
      });
    } else if (q.control === 'toggle') {
      const enable = value === 'enabled' || value === true;
      if (enable && before.some((r) => !r)) {
        await client.query('ROLLBACK');
        // Half a relief is worse than none: the limit helper needs every row and
        // would 503 the whole form. Refuse rather than enable partially.
        return res.status(409).json({
          error:
            'This relief cannot be enabled because some of its rate rows no longer exist. '
            + 'Recreate them under Tax Rates first, then enable it here.',
          missing: q.rows
            .filter((_, i) => !before[i])
            .map((spec) => `${spec.rateType}/${spec.category}`),
        });
      }
      applied = { is_active: enable };
      for (let i = 0; i < q.rows.length; i += 1) {
        await upsertRow(client, taxYear, q.rows[i], {
          is_active: enable,
          description: String(counselNote).trim(),
          fbr_reference: authority || q.citation,
        });
      }
    } else if (q.control === 'params') {
      const write = {};
      for (const f of q.fields) {
        const n = toNum(params?.[f.name]);
        if (n === null || n < 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `${f.label} must be a non-negative number (0 disables that limb).`,
            field: f.name,
          });
        }
        write[f.name] = n;
      }
      // Every limb at zero means "no ceiling at all", which would make the
      // credit the whole profit paid. That is a bigger claim than any of the
      // readings under discussion, so it is refused rather than stored.
      if (q.fields.every((f) => write[f.name] === 0)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error:
            'At least one ceiling must be set. With every limb at zero the credit would be '
            + 'unlimited, which is not a reading of the relief. To switch the relief off entirely, '
            + 'set it to not configured.',
        });
      }
      applied = write;
      await upsertRow(client, taxYear, q.rows[0], {
        ...write,
        is_active: true,
        description: String(counselNote).trim(),
        fbr_reference: authority || q.citation,
      });
    } else {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Setting has no writable control' });
    }

    await client.query('COMMIT');

    // getAllRates caches per tax year with a TTL. Without this the setting would
    // appear saved and change nothing until the cache happened to expire, which
    // is the worst possible behaviour for a control that moves money: the
    // operator sees success, tests it, sees no effect, and changes it again.
    TaxRateService.purgeCache(taxYear);

    await insertAudit(pool, {
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'update',
      tableName: 'tax_rates_config',
      recordId: q.key,
      oldValue: before.map((r) => ({
        rate_category: r?.rate_category ?? null,
        tax_rate: r ? toNum(r.tax_rate) : null,
        fixed_amount: r ? toNum(r.fixed_amount) : null,
        is_active: r?.is_active ?? null,
      })),
      newValue: { key: q.key, taxYear, applied, counselNote, authority: authority || q.citation },
      category: 'statutory_relief_decision',
      severity: 'critical',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    const after = await loadRows(taxYear, q);
    res.json({
      success: true,
      key: q.key,
      taxYear,
      currentValue: q.readValue(after),
      message:
        'Saved. This changes how returns are computed from the next save or recalculation; '
        + 'returns already filed are not revisited.',
    });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* the connection is already gone; nothing to roll back */
    }
    logger.error('PUT /statutory-reliefs failed', { message: e?.message, key: req.params?.key });
    res.status(500).json({ error: 'Failed to save statutory relief setting' });
  } finally {
    client.release();
  }
});

/**
 * Write one backing row, creating it if the year has none.
 *
 * `min_amount`/`max_amount` are left at their defaults on insert: none of these
 * questions is a bracketed rate, and inventing bounds would put numbers in the
 * table that no statute backs.
 */
async function upsertRow(client, taxYear, spec, values) {
  const existing = await client.query(
    `SELECT id FROM tax_rates_config
      WHERE tax_year = $1 AND rate_type = $2 AND rate_category = $3
      ORDER BY id LIMIT 1`,
    [taxYear, spec.rateType, spec.category]
  );

  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(values)) {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  }

  if (existing.rows.length > 0) {
    params.push(existing.rows[0].id);
    await client.query(
      `UPDATE tax_rates_config SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length}`,
      params
    );
    return;
  }

  await client.query(
    `INSERT INTO tax_rates_config
       (tax_year, rate_type, rate_category, tax_rate, fixed_amount, description,
        fbr_reference, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      taxYear,
      spec.rateType,
      spec.category,
      values.tax_rate ?? 0,
      values.fixed_amount ?? 0,
      values.description ?? null,
      values.fbr_reference ?? null,
      values.is_active ?? true,
    ]
  );
}

module.exports = router;
