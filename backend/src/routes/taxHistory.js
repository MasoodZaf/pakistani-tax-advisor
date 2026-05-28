'use strict';

/**
 * taxHistory.js — prior-year archive routes.
 *
 * Phase C model: prior years are READ-ONLY archives. Uploaded here once, stored
 * in tax_return_history with totals computed at import time, then surfaced
 * in the /tax-history UI for reference. Copy-forward is an explicit user action.
 *
 *   POST   /api/tax-history/upload                      — upload + archive
 *   GET    /api/tax-history/archive                     — list archives (summary)
 *   GET    /api/tax-history/archive/:taxYear            — full archive detail
 *   GET    /api/tax-history/latest                      — most recent archive (legacy)
 *   GET    /api/tax-history/list                        — list (legacy alias)
 *   POST   /api/tax-history/pre-populate                — mapped_data payload (legacy)
 *   POST   /api/tax-history/archive/:taxYear/copy-forward — pull archive values into current return
 *   DELETE /api/tax-history/:id                         — remove an archive record
 */

const express = require('express');
const multer  = require('multer');
const { pool } = require('../config/database');
const authenticateToken = require('../middleware/auth');
const logger = require('../utils/logger');
const { parseExcelBuffer, parseJsonBuffer } = require('../services/parsers/excelParser');
const { mapFields } = require('../services/parsers/fieldMapper');
const { auditRates, getHighSeverityWarnings } = require('../services/parsers/rateAudit');
const { parseFbrPdfBuffer } = require('../services/parsers/fbrPdfParser');
const { buildTemplate } = require('../services/parsers/excelTemplate');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // exceljs reads the modern Office Open XML format (.xlsx) only.
    // Legacy .xls (OLE2 / BIFF) is no longer accepted — it would have been
    // buffered into memory and then failed parsing.
    const allowedMime = new Set([
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
      'text/plain',
    ]);
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (allowedMime.has(file.mimetype) || ['json', 'xlsx', 'pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JSON and .xlsx files are supported'));
    }
  },
});

/**
 * Pull top-line totals from mapped form data for the summary card.
 * Best-effort — not authoritative compute, just what's already been typed.
 */
function extractTotals(mapped) {
  const pick = (obj, ...keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== '') return Number(v) || 0;
    }
    return 0;
  };

  const income = mapped?.income || {};
  const capital = mapped?.capital_gain || {};
  const adj = mapped?.adjustable_tax || {};
  const reductions = mapped?.reductions || {};
  const credits = mapped?.credits || {};
  const tc = mapped?.tax_computation || {};

  return {
    totalEmploymentIncome: pick(income, 'total_employment_income', 'annual_salary_wages_total', 'total_gross_income'),
    totalCapitalGain: pick(capital, 'total_capital_gain', 'total_capital_gains'),
    totalAdjustableTax: pick(adj, 'total_tax_collected', 'total_adjustable_tax'),
    totalReductions: pick(reductions, 'total_tax_reductions', 'total_reductions'),
    totalCredits: pick(credits, 'total_credits', 'total_tax_credits'),
    taxPayable: pick(tc, 'tax_payable_refundable', 'total_tax_chargeable'),
  };
}

/**
 * Resolve a tax_year string ('2024-25') to its UUID. Returns null if the year
 * has never been seeded — archive upload still accepts this (user may be
 * uploading a very old year we don't actively support) but the FK stays NULL.
 */
async function tryResolveTaxYearId(taxYear) {
  try {
    const r = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    return r.rows[0]?.id || null;
  } catch {
    return null;
  }
}

// ── GET /template — download a blank or pre-filled .xlsx template ───────────
// Optional ?taxYear=2024-25 sets the filename + instructions sheet header.
// Optional ?prefill=true pre-fills with the caller's existing income_forms
// + adjustable_tax_forms row for the requested year (or current if absent),
// turning the download into "export my saved data".
router.get('/template', authenticateToken, async (req, res) => {
  try {
    const taxYear = req.query.taxYear || '2024-25';
    const prefillFlag = req.query.prefill === 'true' || req.query.prefill === '1';

    let incomePrefill = {};
    let adjustablePrefill = {};

    if (prefillFlag) {
      try {
        const incomeRow = await pool.query(
          `SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2`,
          [req.user.id, taxYear]
        );
        if (incomeRow.rows[0]) incomePrefill = incomeRow.rows[0];

        const adjRow = await pool.query(
          `SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2`,
          [req.user.id, taxYear]
        );
        if (adjRow.rows[0]) adjustablePrefill = adjRow.rows[0];
      } catch (e) {
        // Prefill is best-effort — fall through to blank template.
        logger.warn('template prefill lookup failed', { message: e.message });
      }
    }

    const buffer = await buildTemplate({ taxYear, incomePrefill, adjustablePrefill });
    const fileName = `tax-return-template-${taxYear}${prefillFlag ? '-prefilled' : ''}.xlsx`;
    res.setHeader('Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    logger.error('template generation failed', { message: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
});

// ── POST /upload — create or replace the archive for a user+tax_year ────────
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { tax_year = '2024-25', notes = '' } = req.body;
    const userId = req.user.id;
    const ext = (req.file.originalname || '').split('.').pop().toLowerCase();

    let rawData = {};
    let sourceFormat = 'json';
    let mapped = null;
    let unmatched = null;

    if (ext === 'pdf') {
      // FBR 114(1) PDF — parser returns mapped_data directly in the same
      // shape mapFields() would produce, so we skip the field-mapper.
      const parsed = await parseFbrPdfBuffer(req.file.buffer);
      rawData = parsed.mapped_data; // raw_data column carries the structured extract
      mapped = parsed.mapped_data;
      sourceFormat = parsed.source_format;
      unmatched = {};
    } else if (ext === 'json') {
      rawData = parseJsonBuffer(req.file.buffer);
      sourceFormat = 'json';
    } else if (ext === 'xlsx') {
      rawData = await parseExcelBuffer(req.file.buffer);
      sourceFormat = 'excel';
    } else {
      // No extension (or unusual MIME bypass) — try JSON first, then .xlsx.
      try {
        rawData = parseJsonBuffer(req.file.buffer);
        sourceFormat = 'json';
      } catch {
        rawData = await parseExcelBuffer(req.file.buffer);
        sourceFormat = 'excel';
      }
    }

    if (!mapped) ({ mapped, unmatched } = mapFields(rawData));
    const rateFlags = auditRates(mapped);
    const warnings = getHighSeverityWarnings(rateFlags);
    const totals = extractTotals(mapped);
    const taxYearId = await tryResolveTaxYearId(tax_year);

    // Upsert on (user_id, tax_year) — unique constraint from phase-c migration.
    const result = await pool.query(
      `INSERT INTO tax_return_history
         (user_id, tax_year, tax_year_id, source_format, source_filename,
          raw_data, mapped_data, rate_flags, totals, notes, imported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1)
       ON CONFLICT (user_id, tax_year) DO UPDATE SET
         tax_year_id     = EXCLUDED.tax_year_id,
         source_format   = EXCLUDED.source_format,
         source_filename = EXCLUDED.source_filename,
         raw_data        = EXCLUDED.raw_data,
         mapped_data     = EXCLUDED.mapped_data,
         rate_flags      = EXCLUDED.rate_flags,
         totals          = EXCLUDED.totals,
         notes           = EXCLUDED.notes,
         updated_at      = NOW()
       RETURNING id, upload_date, tax_year, totals`,
      [
        userId,
        tax_year,
        taxYearId,
        sourceFormat,
        req.file.originalname || null,
        JSON.stringify(rawData),
        JSON.stringify(mapped),
        JSON.stringify(rateFlags),
        JSON.stringify(totals),
        notes,
      ]
    );

    const record = result.rows[0];
    const fieldCount = Object.values(mapped).reduce((s, v) => s + Object.keys(v || {}).length, 0);

    logger.info(`Tax history archived: user=${userId}, year=${tax_year}, fields=${fieldCount}`);

    res.json({
      success: true,
      id: record.id,
      uploadDate: record.upload_date,
      tax_year: record.tax_year,
      sourceFormat,
      totals: record.totals,
      summary: {
        totalRawFields: Object.keys(rawData).length,
        mappedFields: fieldCount,
        unmatchedFields: Object.keys(unmatched).length,
        rateFlagCount: Object.keys(rateFlags).length,
        highSeverityWarnings: warnings.length,
      },
      warnings,
    });
  } catch (err) {
    logger.error('Tax history upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ── GET /archive — list archive records (summary only) ──────────────────────
router.get('/archive', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, tax_year, source_format, source_filename, totals,
              upload_date, updated_at, is_verified, notes
         FROM tax_return_history
        WHERE user_id = $1
        ORDER BY tax_year DESC`,
      [userId]
    );
    res.json({ success: true, archives: result.rows });
  } catch (err) {
    logger.error('Archive list error:', err);
    res.status(500).json({ success: false, message: 'Failed to list archives' });
  }
});

// ── GET /archive/:taxYear — full archive detail ─────────────────────────────
router.get('/archive/:taxYear', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, tax_year, source_format, source_filename,
              raw_data, mapped_data, rate_flags, totals,
              upload_date, updated_at, is_verified, notes
         FROM tax_return_history
        WHERE user_id = $1 AND tax_year = $2`,
      [userId, req.params.taxYear]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No archive for that tax year' });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      archive: {
        ...row,
        warnings: getHighSeverityWarnings(row.rate_flags || {}),
      },
    });
  } catch (err) {
    logger.error('Archive detail error:', err);
    res.status(500).json({ success: false, message: 'Failed to load archive' });
  }
});

// ── POST /archive/:taxYear/copy-forward ─────────────────────────────────────
// Return mapped values for a specific step, filtered to the fields the user
// selected. Frontend uses the returned map to setValue() — nothing on the
// server side automatically applies these to the current return.
router.post('/archive/:taxYear/copy-forward', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { step, fields } = req.body || {};
    if (!step) {
      return res.status(400).json({ success: false, message: 'step is required' });
    }

    const result = await pool.query(
      `SELECT mapped_data, rate_flags FROM tax_return_history
        WHERE user_id = $1 AND tax_year = $2`,
      [userId, req.params.taxYear]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No archive for that tax year' });
    }

    const mapped = result.rows[0].mapped_data || {};
    const stepData = mapped[step] || {};
    const rateFlags = result.rows[0].rate_flags || {};
    const stepFlags = {};
    for (const [field, flag] of Object.entries(rateFlags)) {
      if (flag?.step === step) stepFlags[field] = flag;
    }

    // If `fields` is provided, return only those; otherwise return the whole step.
    let payload;
    if (Array.isArray(fields) && fields.length > 0) {
      payload = {};
      for (const f of fields) {
        if (f in stepData) payload[f] = stepData[f];
      }
    } else {
      payload = stepData;
    }

    res.json({
      success: true,
      step,
      values: payload,
      rateFlags: stepFlags,
      warnings: Object.values(stepFlags).filter((w) => w.severity === 'high'),
    });
  } catch (err) {
    logger.error('Copy-forward error:', err);
    res.status(500).json({ success: false, message: 'Copy-forward failed' });
  }
});

// ── GET /latest — most recent archive (legacy) ──────────────────────────────
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, tax_year, source_format, mapped_data, rate_flags, totals,
              upload_date, is_verified, notes
         FROM tax_return_history
        WHERE user_id = $1
        ORDER BY upload_date DESC
        LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) return res.json({ success: true, record: null });

    const row = result.rows[0];
    res.json({
      success: true,
      record: {
        id: row.id,
        tax_year: row.tax_year,
        sourceFormat: row.source_format,
        mappedData: row.mapped_data,
        rateFlags: row.rate_flags,
        totals: row.totals,
        uploadDate: row.upload_date,
        isVerified: row.is_verified,
        notes: row.notes,
        warnings: getHighSeverityWarnings(row.rate_flags || {}),
      },
    });
  } catch (err) {
    logger.error('Tax history latest error:', err);
    res.status(500).json({ success: false, message: 'Failed to load latest' });
  }
});

// ── GET /list — legacy alias of /archive ────────────────────────────────────
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, tax_year, source_format, upload_date, is_verified, notes
         FROM tax_return_history
        WHERE user_id = $1
        ORDER BY upload_date DESC`,
      [userId]
    );
    res.json({ success: true, records: result.rows });
  } catch (err) {
    logger.error('Tax history list error:', err);
    res.status(500).json({ success: false, message: 'Failed to list' });
  }
});

// ── POST /pre-populate (legacy) ─────────────────────────────────────────────
router.post('/pre-populate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.body;
    const query = id
      ? `SELECT mapped_data, rate_flags FROM tax_return_history WHERE id=$1 AND user_id=$2`
      : `SELECT mapped_data, rate_flags FROM tax_return_history WHERE user_id=$1 ORDER BY upload_date DESC LIMIT 1`;
    const params = id ? [id, userId] : [userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No prior year data found' });
    }
    const row = result.rows[0];
    const warnings = getHighSeverityWarnings(row.rate_flags || {});
    res.json({
      success: true,
      mappedData: row.mapped_data,
      rateFlags: row.rate_flags,
      warnings,
      message:
        warnings.length > 0
          ? `${warnings.length} field(s) have rate changes in Finance Act 2025 — please review before copy-forward`
          : 'Prior year data available for reference',
    });
  } catch (err) {
    logger.error('Tax history pre-populate error:', err);
    res.status(500).json({ success: false, message: 'Failed' });
  }
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `DELETE FROM tax_return_history WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    res.json({ success: true, message: 'Archive deleted' });
  } catch (err) {
    logger.error('Tax history delete error:', err);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

module.exports = router;
