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
const multer = require('multer');
const ExcelJS = require('exceljs');
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const jwtAuth = require('../../../middleware/auth');
const { insertAudit } = require('../../../helpers/auditLog');
const kb = require('../../../services/aiConsultant/knowledgeBase');

const router = express.Router();

const FORM_STEPS = ['', 'deductions', 'credits', 'reductions', 'income', 'adjustable-tax', 'final-min-income', 'capital-gains'];

// The consultant template: column header (human label) → strategy field + a
// match regex used to map a filled file's headers back to fields (order-tolerant).
const TEMPLATE_COLUMNS = [
  { header: 'Title (required)',            field: 'title',     match: /title/i,           example: 'Voluntary pension (VPS) contribution tax credit' },
  { header: 'Who / when it applies',       field: 'profile',   match: /who|when|profile/i, example: 'Salaried individuals who can contribute to an approved pension fund' },
  { header: 'Relief',                      field: 'relief',    match: /relief/i,          example: 'Tax credit for pension contribution' },
  { header: 'Section',                     field: 'section',   match: /section/i,         example: 's.63' },
  { header: 'Statutory cap',               field: 'cap_note',  match: /cap/i,             example: '20% of taxable income' },
  { header: 'How to claim',                field: 'how_to',    match: /how/i,             example: 'Contribute to an SECP-approved pension fund and enter it in the Credits form.' },
  { header: 'Caveat / eligibility',        field: 'caveat',    match: /caveat|eligib/i,   example: 'Must be an SECP-approved VPS fund; confirm eligibility.' },
  { header: 'App form (one of: deductions/credits/reductions/income/adjustable-tax/final-min-income/capital-gains)', field: 'form_step', match: /form|step|app/i, example: 'credits' },
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new Error('Please upload a .csv or .xlsx file'), ok);
  },
});

// Minimal RFC-4180-ish CSV parser (handles quoted fields with commas/newlines).
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x && String(x).trim()));
}

async function parseXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  const rows = [];
  sheet.eachRow((r) => {
    const cells = [];
    r.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      cells.push(v == null ? '' : (typeof v === 'object' ? (v.text || v.result || '') : String(v)));
    });
    rows.push(cells);
  });
  return rows.filter((r) => r.some((x) => x && String(x).trim()));
}

// The SIMPLE path consultants use: a markdown file of "## Strategy: <title>"
// blocks with `Field: value` lines. Easiest to copy-paste and fill. All regexes
// are line-anchored (m flag, horizontal whitespace only) so the instructions'
// inline `## Strategy:` and the blank template block are ignored — only real
// line-start headings with a non-empty title become strategies.
function parseMarkdownStrategies(text) {
  const line = (b, label) => {
    const m = b.match(new RegExp(`^[ \\t]*${label}[^:\\n]*:[ \\t]*(.+?)[ \\t]*$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const titleOf = (b) => {
    const m = b.match(/^##[ \t]+Strategy[ \t]*:[ \t]*(.+?)[ \t]*$/im);
    return m ? m[1].trim() : '';
  };
  return text
    .split(/\n(?=##[ \t]+Strategy[ \t]*:)/i)
    .filter((b) => /^##[ \t]+Strategy[ \t]*:/im.test(b))
    .map((b) => ({
      title:     titleOf(b),
      profile:   line(b, '(?:Who|When|Who[ \\t]*/[ \\t]*when)'),
      relief:    line(b, 'Relief'),
      section:   line(b, 'Section'),
      cap_note:  line(b, '(?:Cap|Statutory cap)'),
      how_to:    line(b, 'How'),
      caveat:    line(b, '(?:Caveat|Eligibility)'),
      form_step: (line(b, '(?:App[ \\t]*form|Form)').match(/[a-z-]+/) || [''])[0],
    }))
    .filter((s) => s.title);
}

// The CURATED seeded playbook (backend/data/knowledge-base/tax-efficiency-playbook.md)
// uses a `**Label:**` bold format with wrapped multi-line values, and packs
// `**formStep:** x · **Caveat:** y` onto one line. This parser reads those blocks
// for a READ-ONLY "seeded library" view so admins can see the baseline the AI
// already uses. (The editable DB list is separate; this file is image-baked.)
function parseSeededPlaybook(text) {
  return text
    .split(/\n(?=##[ \t]+Strategy[ \t]*:)/i)
    .filter((b) => /^##[ \t]+Strategy[ \t]*:/im.test(b))
    .map((b) => {
      const title = (b.match(/^##[ \t]+Strategy[ \t]*:[ \t]*(.+?)[ \t]*$/im) || [])[1]?.trim() || '';
      const f = {};
      const re = /\*\*([^:*]+):\*\*\s*([\s\S]*?)(?=\*\*[^:*]+:\*\*|$)/g;
      let m;
      while ((m = re.exec(b)) !== null) {
        f[m[1].trim().toLowerCase()] = m[2].replace(/\s*·\s*$/, '').replace(/\s+/g, ' ').trim();
      }
      return {
        title,
        profile: f.who || '',
        why: f['why it saves'] || f['why it matters'] || '',
        how_to: f.how || '',
        section: f.section || '',
        form_step: ((f.formstep || '').match(/[a-z-]+/) || [''])[0],
        caveat: f.caveat || '',
      };
    })
    .filter((s) => s.title);
}

// CSV/Excel rows → strategy objects (header-mapped, order-tolerant).
function rowsToStrategies(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim());
  const idx = {};
  TEMPLATE_COLUMNS.forEach((col) => { idx[col.field] = headers.findIndex((h) => col.match.test(h)); });
  return rows.slice(1).map((r) => {
    const o = {};
    TEMPLATE_COLUMNS.forEach((col) => { o[col.field] = idx[col.field] >= 0 ? String(r[idx[col.field]] || '').trim() : ''; });
    return o;
  });
}

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

// The curated, image-baked seeded playbook the AI already uses (read-only).
// Lets admins see the built-in baseline alongside the editable DB list.
router.get('/seeded', jwtAuth, requireSuperAdmin, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(kb.BUNDLED_KB_DIR, 'tax-efficiency-playbook.md');
  try {
    if (!fs.existsSync(file)) return res.json({ success: true, strategies: [] });
    const strategies = parseSeededPlaybook(fs.readFileSync(file, 'utf8'));
    res.json({ success: true, strategies });
  } catch (e) {
    logger.error('playbook seeded read failed', { message: e.message });
    res.status(500).json({ error: 'Failed to read the seeded playbook' });
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

// Download the consultant template (the file admins pass to tax consultants).
router.get('/template', jwtAuth, requireSuperAdmin, (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '../../../../data/playbook-templates/consultant-strategy-template.md');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Template not found' });
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tax-efficiency-strategy-template.md"');
  fs.createReadStream(file).on('error', () => res.status(500).end()).pipe(res);
});

// Import a filled file (.md copy-paste blocks, or .csv/.xlsx). Every parsed
// strategy lands as a DRAFT so the admin reviews + approves before it goes live.
router.post('/import', jwtAuth, requireSuperAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const name = req.file.originalname.toLowerCase();
    let parsed = [];
    if (name.endsWith('.md') || name.endsWith('.txt')) {
      parsed = parseMarkdownStrategies(req.file.buffer.toString('utf8'));
    } else if (name.endsWith('.csv')) {
      parsed = rowsToStrategies(parseCsv(req.file.buffer.toString('utf8')));
    } else {
      parsed = rowsToStrategies(await parseXlsx(req.file.buffer));
    }
    let imported = 0;
    let skipped = 0;
    for (const s of parsed) {
      if (!s.title || !String(s.title).trim()) { skipped++; continue; }
      const formStep = FORM_STEPS.includes(s.form_step) ? (s.form_step || null) : null;
      await pool.query(
        `INSERT INTO playbook_strategies (title, profile, relief, section, cap_note, how_to, caveat, form_step, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9)`,
        [clean(s.title, 200), clean(s.profile, 2000), clean(s.relief, 200), clean(s.section, 120),
         clean(s.cap_note, 200), clean(s.how_to, 2000), clean(s.caveat, 2000), formStep, req.user.id]
      );
      imported++;
    }
    await insertAudit(pool, { userId: req.user.id, userEmail: req.user.email, action: 'import',
      tableName: 'playbook_strategies', category: 'tax_rate_admin', severity: 'medium',
      ipAddress: req.ip, userAgent: req.headers['user-agent'] }).catch(() => {});
    res.json({ success: true, imported, skipped,
      note: 'Imported as DRAFTS — review and Approve each one to make it live in the AI.' });
  } catch (e) {
    logger.error('playbook import failed', { message: e.message });
    res.status(400).json({ error: 'Could not parse the file — please use the provided template.' });
  }
});

module.exports = router;
