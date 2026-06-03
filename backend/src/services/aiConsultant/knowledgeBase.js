// Knowledge base for the AI tax consultant.
//
// Loads tax-related documents (Markdown from repo root, plus any PDF / XLSX /
// TXT / MD dropped into backend/data/knowledge-base/) into in-memory chunks
// once at startup. Provides a simple keyword-score retrieval so the consultant
// can ground answers in actual FBR documents instead of hallucinating.
//
// Live data — current tax slabs and rates — is pulled fresh from the DB on
// each retrieval rather than cached, so the model always quotes today's rates.

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

// Paths are computed relative to the backend module so they resolve
// correctly both locally (./backend/...) and inside the Docker image
// (WORKDIR=/app; this file lives at /app/src/services/aiConsultant/).
const BACKEND_DIR = path.resolve(__dirname, '../../../');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');   // only valid in dev checkout

// Where uploaded knowledge-base files live. In production this is a mounted
// volume (AI_KB_DIR) so admin-uploaded docs survive container rebuilds.
const KB_DIR = process.env.AI_KB_DIR
  ? path.resolve(process.env.AI_KB_DIR)
  : path.join(BACKEND_DIR, 'data', 'knowledge-base');

// Curated docs committed to the repo (e.g. the tax-efficiency playbook) ship
// inside the image here. In prod a volume overrides AI_KB_DIR, which would
// otherwise SHADOW these bundled docs — so we always scan this dir too.
const BUNDLED_KB_DIR = path.join(BACKEND_DIR, 'data', 'knowledge-base');

// MD files at repo root that ship as default knowledge — these are the
// FBR / compliance / roadmap docs already in the repo. Only loaded when
// running from a dev checkout (the Docker image doesn't include them).
const DEFAULT_REPO_DOCS = [
  'TAX_CONSULTANT_GUIDE.md',
  'TAX_APP_CORRECTIONS_AND_ROADMAP.md',
  'FBR_COMPLIANCE_AUDIT_REPORT.md',
  'FBR_COMPLIANCE_VERIFICATION_REPORT.md',
  'FBR_EXCEL_RECONCILIATION_REPORT.md',
  'FINAL_MIN_INCOME_IMPLEMENTATION_PROGRESS.md',
  'CROSS_FORM_DATA_FLOW.md',
  'AUDIT_REPORT_2026-05-17.md',
  'APP-SNAPSHOT.md',
];

const CHUNK_TARGET = 1500;   // chars — small enough to fit many in context
const CHUNK_OVERLAP = 200;

let chunks = [];             // [{ id, source, title, text, terms }]
let lastLoadedAt = null;

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s%/-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function termFreq(text) {
  const m = new Map();
  for (const t of tokenize(text)) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

function splitByHeadingsOrSize(source, fullText) {
  const out = [];
  // Markdown: split on H1/H2/H3 boundaries first.
  const headerRe = /^#{1,3}\s+.+$/gm;
  const positions = [];
  let m;
  while ((m = headerRe.exec(fullText)) !== null) positions.push(m.index);
  if (positions.length >= 2) {
    positions.push(fullText.length);
    for (let i = 0; i < positions.length - 1; i++) {
      const section = fullText.slice(positions[i], positions[i + 1]).trim();
      if (!section) continue;
      const titleLine = section.split('\n', 1)[0].replace(/^#+\s*/, '');
      // If the section is huge, fall through to size splitting below.
      if (section.length <= CHUNK_TARGET * 1.5) {
        out.push({ source, title: titleLine, text: section });
      } else {
        for (let pos = 0; pos < section.length; pos += CHUNK_TARGET - CHUNK_OVERLAP) {
          out.push({
            source,
            title: titleLine,
            text: section.slice(pos, pos + CHUNK_TARGET),
          });
        }
      }
    }
    return out;
  }
  // No headers — just slice on size.
  for (let pos = 0; pos < fullText.length; pos += CHUNK_TARGET - CHUNK_OVERLAP) {
    out.push({
      source,
      title: path.basename(source),
      text: fullText.slice(pos, pos + CHUNK_TARGET),
    });
  }
  return out;
}

async function readPdf(absPath) {
  const data = await pdfParse(fs.readFileSync(absPath));
  return data.text || '';
}

async function readXlsx(absPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(absPath);
  const lines = [];
  wb.eachSheet((sheet) => {
    lines.push(`# Sheet: ${sheet.name}`);
    sheet.eachRow((row) => {
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (v == null) return;
        if (typeof v === 'object' && 'text' in v) cells.push(String(v.text));
        else if (typeof v === 'object' && 'result' in v) cells.push(String(v.result));
        else cells.push(String(v));
      });
      if (cells.length) lines.push(cells.join(' | '));
    });
  });
  return lines.join('\n');
}

async function ingestFile(absPath, label) {
  try {
    const ext = path.extname(absPath).toLowerCase();
    let text;
    if (ext === '.md' || ext === '.txt') {
      text = fs.readFileSync(absPath, 'utf8');
    } else if (ext === '.pdf') {
      text = await readPdf(absPath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      text = await readXlsx(absPath);
    } else {
      return 0;
    }
    const pieces = splitByHeadingsOrSize(label || path.basename(absPath), text);
    let added = 0;
    for (const p of pieces) {
      chunks.push({
        id: `${label || path.basename(absPath)}#${added}`,
        source: p.source,
        title: p.title,
        text: p.text,
        terms: termFreq(p.text),
      });
      added++;
    }
    return added;
  } catch (e) {
    logger.warn(`AI KB: failed to ingest ${absPath}: ${e.message}`);
    return 0;
  }
}

async function loadAll() {
  chunks = [];
  let total = 0;

  // 1. Default repo MD docs — dev convenience. Only present when running
  //    from a local checkout; absent inside the Docker image.
  if (fs.existsSync(REPO_ROOT)) {
    for (const name of DEFAULT_REPO_DOCS) {
      const full = path.join(REPO_ROOT, name);
      if (fs.existsSync(full)) total += await ingestFile(full, name);
    }
  }

  // 2. Anything dropped into the configured KB directory. In production this
  //    should be a mounted volume so admin-uploaded docs persist across
  //    container rebuilds.
  // Scan the bundled (image) dir AND the volume dir — deduped so dev (where
  // they're the same path) doesn't double-load. Bundled = curated repo docs;
  // KB_DIR = admin uploads persisted on a volume.
  for (const dir of [...new Set([BUNDLED_KB_DIR, KB_DIR])]) {
    try {
      if (!fs.existsSync(dir)) {
        if (dir === KB_DIR) fs.mkdirSync(dir, { recursive: true });
        continue;
      }
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isFile()) total += await ingestFile(full, entry);
      }
    } catch (e) {
      logger.warn(`AI KB: dir access failed (${dir}): ${e.message}`);
    }
  }

  lastLoadedAt = new Date();
  logger.info(`AI KB: loaded ${total} chunks from ${chunks.reduce(
    (s, c) => s.add(c.source) && s, new Set()
  ).size} sources`);
  return total;
}

// Cheap keyword retrieval: rank chunks by overlap with query terms (TF, no IDF).
// Good enough for the document volume we're dealing with — replace with
// embeddings later if recall becomes a problem.
function retrieve(query, k = 5) {
  if (!chunks.length) return [];
  const qTerms = new Set(tokenize(query));
  if (!qTerms.size) return [];
  const scored = chunks.map((c) => {
    let score = 0;
    for (const t of qTerms) {
      const f = c.terms.get(t);
      if (f) score += f;
    }
    // Slight boost for short, header-rich chunks (more likely to be definitions).
    if (c.title && c.title.length < 80) score *= 1.1;
    // Curated playbook chunks are concise, vetted strategy summaries — surface
    // them above raw statute when they match (the Ordinance PDF's sheer chunk
    // volume would otherwise always crowd them out). Only matching chunks (score>0)
    // are boosted, so this never injects irrelevant playbook entries.
    if (score > 0 && /playbook/i.test(c.source || '')) score *= 3;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, k).map((s) => ({
    source: s.c.source,
    title: s.c.title,
    text: s.c.text,
  }));
}

// Fetches *live* tax slabs for the given or current tax year.
// The model gets fresh numbers on every call so it never quotes stale slabs.
// Returns rates as percentages (the DB stores them as decimal — 0.35 → 35).
async function getLiveTaxRates(taxYear) {
  try {
    const tyRow = taxYear
      ? await pool.query(
          `SELECT id, tax_year FROM tax_years WHERE tax_year = $1 LIMIT 1`,
          [String(taxYear)]
        )
      : await pool.query(
          `SELECT id, tax_year FROM tax_years
            WHERE is_current = true
            ORDER BY tax_year DESC LIMIT 1`
        );
    const ty = tyRow.rows?.[0];
    if (!ty) return null;

    const slabs = await pool.query(
      `SELECT slab_name, slab_type, slab_order,
              min_income, max_income,
              tax_rate, fixed_amount
         FROM tax_slabs
        WHERE tax_year_id = $1
        ORDER BY slab_type ASC, slab_order ASC`,
      [ty.id]
    ).catch(() => ({ rows: [] }));

    const formatted = slabs.rows.map((s) => ({
      name: s.slab_name,
      type: s.slab_type,
      order: s.slab_order,
      minIncome: Number(s.min_income),
      maxIncome: s.max_income == null ? null : Number(s.max_income),
      ratePercent: Number(s.tax_rate) * 100,
      fixedAmount: Number(s.fixed_amount || 0),
    }));

    return { taxYear: ty.tax_year, slabs: formatted };
  } catch (e) {
    logger.warn(`AI KB: getLiveTaxRates failed: ${e.message}`);
    return null;
  }
}

function status() {
  return {
    loadedAt: lastLoadedAt,
    chunkCount: chunks.length,
    sources: [...new Set(chunks.map((c) => c.source))],
  };
}

module.exports = {
  loadAll,
  retrieve,
  getLiveTaxRates,
  status,
  KB_DIR,
};
