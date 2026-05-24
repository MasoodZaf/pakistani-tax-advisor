// Mobile-specific API surface (`/api/mobile/v1/*`).
//
// Designed for offline-first sync, bandwidth-aware payloads, and resumable
// receipt uploads. The web app does NOT use these endpoints.
//
// See docs/mobile-expenses-design.md for the full design.

const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { pool } = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const {
  validateChange,
  encodeCursor,
  decodeCursor,
} = require('../services/mobileExpenseHelpers');
const objectStorage = require('../services/objectStorage');

const router = express.Router();

// ── Version gate ────────────────────────────────────────────────────────────
// Every mobile request must send `X-App-Version`. Builds older than
// MOBILE_MIN_SUPPORTED_VERSION are forced to upgrade.
const MIN_VERSION = process.env.MOBILE_MIN_SUPPORTED_VERSION || '1.0.0';
const UPGRADE_URL = process.env.MOBILE_UPGRADE_URL || 'https://tax.aurmak.com/mobile';

function semverGte(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

router.use((req, res, next) => {
  const v = req.headers['x-app-version'];
  if (!v) {
    return res.status(400).json({ error: 'missing_app_version' });
  }
  if (!semverGte(v, MIN_VERSION)) {
    return res.status(426).json({
      error: 'app_too_old',
      minimum_version: MIN_VERSION,
      upgrade_url: UPGRADE_URL,
    });
  }
  next();
});

router.use(auth);

const nowIso = () => new Date().toISOString();

// Columns we expose to the client. `user_id` is omitted (implicit).
const RETURN_COLS = `
  id, client_id, amount, currency, fx_rate_to_pkr, amount_pkr,
  occurred_on, category, description, payee, payment_method,
  tax_year, tax_treatment, tax_section, included_in_return,
  created_at, updated_at, deleted_at, receipt_id
`.trim();

function rowToServerRecord(row) {
  if (!row) return null;
  // Normalise pg's numeric strings → numbers, and dates → ISO strings.
  return {
    id: row.id,
    client_id: row.client_id,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    fx_rate_to_pkr: row.fx_rate_to_pkr === null ? null : Number(row.fx_rate_to_pkr),
    amount_pkr: row.amount_pkr === null ? null : Number(row.amount_pkr),
    occurred_on:
      row.occurred_on instanceof Date
        ? row.occurred_on.toISOString().slice(0, 10)
        : row.occurred_on,
    category: row.category,
    description: row.description,
    payee: row.payee,
    payment_method: row.payment_method,
    tax_year: row.tax_year,
    tax_treatment: row.tax_treatment,
    tax_section: row.tax_section,
    included_in_return: row.included_in_return,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    deleted_at:
      row.deleted_at instanceof Date
        ? row.deleted_at.toISOString()
        : row.deleted_at,
    receipt_id: row.receipt_id,
  };
}

// Process one validated change. Returns a result object suitable for the
// /sync response (status: 'ok' | 'conflict' | 'error').
//
// Conflict detection uses `base_updated_at`: the value of `updated_at` the
// client last knew the server had for this row (or null if the client thinks
// this is a brand-new row). The server flags a conflict whenever its current
// `prior.updated_at` doesn't match the client's claimed base — that's the
// signal that another device (or the web app) wrote to the row in between.
//
// This is the textbook optimistic-concurrency check: comparing server-known
// values, not clock timestamps from two different devices. Two devices with
// skewed clocks can no longer create false positives or silently overwrite
// each other.
//
// `client_updated_at` is still required (for ordering pending pushes and as
// the new `updated_at` value the client will record back) but is no longer
// load-bearing for conflict detection.
async function applyChange(userId, change) {
  const { op, client_id, client_updated_at, base_updated_at } = change;

  // Find existing row (any state — including soft-deleted) to decide between
  // insert / update / conflict.
  const existing = await pool.query(
    `SELECT ${RETURN_COLS}
     FROM expenses
     WHERE user_id = $1 AND client_id = $2`,
    [userId, client_id]
  );
  const prior = existing.rows[0];

  // Legacy clients that don't send base_updated_at (undefined in the
  // normalized payload) fall back to the old clock-based comparison so a
  // partially-rolled-out app keeps working. New clients always set the field
  // (null for new rows, ISO for known rows).
  const legacyMode = base_updated_at === undefined;

  if (legacyMode) {
    if (prior && new Date(prior.updated_at) > new Date(client_updated_at)) {
      return {
        client_id,
        status: 'conflict',
        reason: 'newer_on_server',
        server_record: rowToServerRecord(prior),
      };
    }
  } else {
    // Strict mode: base must match prior exactly (both null for new rows, or
    // both equal to the same ISO timestamp for known rows).
    const priorTs = prior ? new Date(prior.updated_at).toISOString() : null;
    const baseTs = base_updated_at ? new Date(base_updated_at).toISOString() : null;
    if (priorTs !== baseTs) {
      return {
        client_id,
        status: 'conflict',
        reason: priorTs === null ? 'deleted_on_server' : 'newer_on_server',
        server_record: rowToServerRecord(prior), // null when server has no row
      };
    }
  }

  if (op === 'delete') {
    if (!prior) {
      // Idempotent: nothing to delete on this side.
      return { client_id, status: 'ok', server_record: null };
    }
    if (prior.deleted_at) {
      return { client_id, status: 'ok', server_record: rowToServerRecord(prior) };
    }
    const del = await pool.query(
      `UPDATE expenses
       SET deleted_at = NOW()
       WHERE user_id = $1 AND client_id = $2
       RETURNING ${RETURN_COLS}`,
      [userId, client_id]
    );
    return {
      client_id,
      server_id: del.rows[0].id,
      status: 'ok',
      server_record: rowToServerRecord(del.rows[0]),
    };
  }

  // op === 'upsert'
  const c = change;
  const upsert = await pool.query(
    `INSERT INTO expenses (
       user_id, client_id,
       amount, currency, fx_rate_to_pkr, amount_pkr,
       occurred_on, category, description, payee, payment_method,
       tax_year, tax_treatment, tax_section, receipt_id
     ) VALUES (
       $1, $2,
       $3, $4, $5, $6,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15
     )
     ON CONFLICT (user_id, client_id) DO UPDATE SET
       amount          = EXCLUDED.amount,
       currency        = EXCLUDED.currency,
       fx_rate_to_pkr  = EXCLUDED.fx_rate_to_pkr,
       amount_pkr      = EXCLUDED.amount_pkr,
       occurred_on     = EXCLUDED.occurred_on,
       category        = EXCLUDED.category,
       description     = EXCLUDED.description,
       payee           = EXCLUDED.payee,
       payment_method  = EXCLUDED.payment_method,
       tax_year        = EXCLUDED.tax_year,
       tax_treatment   = EXCLUDED.tax_treatment,
       tax_section     = EXCLUDED.tax_section,
       receipt_id      = EXCLUDED.receipt_id,
       deleted_at      = NULL
     RETURNING ${RETURN_COLS}`,
    [
      userId, c.client_id,
      c.amount, c.currency, c.fx_rate_to_pkr, c.amount_pkr,
      c.occurred_on, c.category, c.description, c.payee, c.payment_method,
      c.tax_year, c.tax_treatment, c.tax_section, c.receipt_id,
    ]
  );
  return {
    client_id,
    server_id: upsert.rows[0].id,
    status: 'ok',
    server_record: rowToServerRecord(upsert.rows[0]),
  };
}

// ── POST /api/mobile/v1/expenses/sync ───────────────────────────────────────
router.post('/expenses/sync', async (req, res) => {
  const userId = req.user.id;
  const { changes } = req.body || {};

  if (!Array.isArray(changes)) {
    return res.status(400).json({ error: 'changes_must_be_array' });
  }
  if (changes.length === 0) {
    return res.json({ results: [], server_now: nowIso() });
  }
  if (changes.length > 100) {
    return res.status(400).json({ error: 'batch_too_large', max: 100 });
  }

  const results = [];
  for (const raw of changes) {
    const v = validateChange(raw);
    if (!v.ok) {
      results.push({
        client_id: raw?.client_id || null,
        status: 'error',
        reason: v.error,
      });
      continue;
    }
    try {
      results.push(await applyChange(userId, v.normalized));
    } catch (err) {
      logger.error('[mobileApi] sync change failed', {
        userId,
        client_id: v.normalized.client_id,
        message: err.message,
      });
      results.push({
        client_id: v.normalized.client_id,
        status: 'error',
        reason: 'server_error',
      });
    }
  }

  res.json({ results, server_now: nowIso() });
});

// ── GET /api/mobile/v1/expenses ─────────────────────────────────────────────
// Delta sync. Returns rows with updated_at > `since`, cursor-paginated by
// (updated_at, id) ascending. Includes soft-deleted rows.
router.get('/expenses', async (req, res) => {
  const userId = req.user.id;
  const since = req.query.since ? new Date(req.query.since) : new Date(0);
  if (Number.isNaN(since.getTime())) {
    return res.status(400).json({ error: 'invalid_since' });
  }

  const requested = parseInt(req.query.limit, 10);
  const limit = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : 200,
    500
  );

  const cursor = decodeCursor(req.query.cursor);
  if (req.query.cursor && !cursor) {
    return res.status(400).json({ error: 'invalid_cursor' });
  }

  const params = [userId, since.toISOString()];
  let sql = `
    SELECT ${RETURN_COLS}
    FROM expenses
    WHERE user_id = $1
      AND updated_at > $2
  `;
  if (cursor) {
    sql += ` AND (updated_at, id) > ($3::timestamptz, $4::uuid) `;
    params.push(cursor.updatedAt, cursor.id);
  }
  sql += ` ORDER BY updated_at ASC, id ASC LIMIT $${params.length + 1}`;
  params.push(limit);

  try {
    const { rows } = await pool.query(sql, params);
    const expenses = rows.map(rowToServerRecord);
    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last ? encodeCursor(last.updated_at, last.id) : null;

    res.json({ expenses, next_cursor: nextCursor, server_now: nowIso() });
  } catch (err) {
    logger.error('[mobileApi] pull failed', { userId, message: err.message });
    res.status(500).json({ error: 'server_error' });
  }
});

// ── POST /api/mobile/v1/receipts ────────────────────────────────────────────
// Multipart upload for a single receipt (image or PDF). Bytes go to S3-
// compatible object storage; only metadata + storage_key live in Postgres.
// Dedup by sha256 — re-uploading the same photo returns the existing id.

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(Object.assign(new Error('invalid_mime_type'), { code: 'INVALID_MIME' }));
      return;
    }
    cb(null, true);
  },
});

function extForMime(mime) {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'application/pdf': return 'pdf';
    default: return 'bin';
  }
}

router.post('/receipts', receiptUpload.single('file'), async (req, res, next) => {
  // Multer errors come through here — surface them as 400 with a stable code.
  if (!req.file) {
    return res.status(400).json({ error: 'missing_file' });
  }
  if (!objectStorage.isConfigured()) {
    logger.error('[mobileApi] receipt upload rejected: object storage not configured');
    return res.status(503).json({ error: 'object_storage_unavailable' });
  }

  const userId = req.user.id;
  const { buffer, mimetype, size } = req.file;
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  try {
    // Dedup check: if we've already stored this exact bytes for this user,
    // return the existing receipt_id rather than re-uploading.
    const existing = await pool.query(
      `SELECT id, storage_key, mime_type, size_bytes
       FROM receipt_files
       WHERE user_id = $1 AND sha256 = $2`,
      [userId, sha256]
    );
    if (existing.rows.length > 0) {
      const r = existing.rows[0];
      return res.json({
        receipt_id: r.id,
        sha256,
        size_bytes: r.size_bytes,
        mime_type: r.mime_type,
        already_existed: true,
      });
    }

    const storageKey = `receipts/${userId}/${sha256}.${extForMime(mimetype)}`;
    await objectStorage.putObject({
      key: storageKey,
      body: buffer,
      contentType: mimetype,
      metadata: { 'user-id': userId, 'sha256': sha256 },
    });

    const inserted = await pool.query(
      `INSERT INTO receipt_files (user_id, storage_key, mime_type, size_bytes, sha256)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, storageKey, mimetype, size, sha256]
    );

    return res.json({
      receipt_id: inserted.rows[0].id,
      sha256,
      size_bytes: size,
      mime_type: mimetype,
      already_existed: false,
    });
  } catch (err) {
    logger.error('[mobileApi] receipt upload failed', { userId, message: err.message });
    return next(err);
  }
});

// Multer error handler local to /receipts so we don't pollute the global
// error handler. Express picks the handler with arity=4.
router.use('/receipts', (err, _req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large', max_bytes: MAX_RECEIPT_BYTES });
  }
  if (err.code === 'INVALID_MIME' || err.message === 'invalid_mime_type') {
    return res.status(415).json({
      error: 'unsupported_media_type',
      allowed: Array.from(ALLOWED_MIME),
    });
  }
  return res.status(500).json({ error: 'server_error' });
});

// ── GET /api/mobile/v1/receipts/:id ─────────────────────────────────────────
// Returns a short-lived signed URL the client can download the bytes from.
// Bucket is private; URLs expire in 15 min by default. The caller must own
// the receipt — anonymous IDs from another user 404.
router.get('/receipts/:id', async (req, res) => {
  const userId = req.user.id;
  const receiptId = req.params.id;

  // Cheap UUID guard before hitting the DB. Accepts any RFC 4122 version
  // (1–8) — the previous [1-5] restriction would reject v7 IDs the moment
  // anything starts emitting them, and the DB's uuid type will catch bad
  // formats regardless.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiptId)) {
    return res.status(400).json({ error: 'invalid_receipt_id' });
  }

  if (!objectStorage.isConfigured()) {
    return res.status(503).json({ error: 'object_storage_unavailable' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT storage_key, mime_type, size_bytes
       FROM receipt_files
       WHERE id = $1 AND user_id = $2`,
      [receiptId, userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }
    const r = rows[0];
    const url = await objectStorage.getSignedDownloadUrl(r.storage_key, 900);
    res.json({
      receipt_id: receiptId,
      url,
      expires_in: 900,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
    });
  } catch (err) {
    logger.error('[mobileApi] signed URL fetch failed', {
      userId, receiptId, message: err.message,
    });
    res.status(500).json({ error: 'server_error' });
  }
});

// ── GET /api/mobile/v1/health ───────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ ok: true, server_now: nowIso() });
});

module.exports = router;
