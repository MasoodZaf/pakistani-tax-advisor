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

// Repo-root MD files to ingest as default knowledge.
//
// DELIBERATELY EMPTY. This list used to carry the repo's own engineering
// documents, and they were also copied into the production KB volume, so the
// tax consultant was grounding answers on them. They are not tax law — they
// are the app's defect log and design spec:
//
//   TAX_APP_CORRECTIONS_AND_ROADMAP.md  headings like "Wrong Tax Slabs
//       Throughout", spelling out SUPERSEDED TY2024-25 rates (5/15/25/30/35%)
//       in prose. Retrieval is keyword-scored, so a question about slab rates
//       could surface obsolete rates described as what the app used to do.
//   AUDIT_REPORT_2026-05-17.md          security findings, e.g. "Hardcoded
//       super-admin credentials in committed setup script".
//   TAX_CONSULTANT_GUIDE.md             despite the name, 3,425 lines of
//       software spec including Python source for encryption.py, auth.py and
//       rate_limiting.py.
//   FBR_COMPLIANCE_*, CROSS_FORM_DATA_FLOW, APP-SNAPSHOT, FINAL_MIN_*
//       internal audits and data-flow notes.
//
// The consultant returns `sources` to the user, so these were also being
// CITED by filename to practising tax consultants. Ground the model on tax
// authority sources (the Ordinance, the Rules, FBR circulars) plus the
// admin-curated playbook — nothing else.
//
// If you want a document in the consultant's knowledge, upload it through the
// admin KB screen so it is a deliberate act with a named owner, rather than
// whatever happens to sit in the repo root.
const DEFAULT_REPO_DOCS = [];

// At most this many chunks from any single source per query. Stops the
// longest document monopolising the answer — see the note in retrieve().
const PER_SOURCE_CAP = 2;

const CHUNK_TARGET = 1500;   // chars — small enough to fit many in context
const CHUNK_OVERLAP = 200;

let chunks = [];             // [{ id, source, title, text, terms, termCount }]
let lastLoadedAt = null;
// term -> number of chunks containing it. Rebuilt by buildIndex() after every
// load; retrieve() needs it for IDF, and a stale map silently skews ranking.
let docFreq = new Map();

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
        termCount: 0,   // filled by buildIndex()
      });
      added++;
    }
    return added;
  } catch (e) {
    logger.warn(`AI KB: failed to ingest ${absPath}: ${e.message}`);
    return 0;
  }
}

// Ingest APPROVED admin-managed playbook strategies as retrievable chunks.
// Source name contains "playbook" so the reserved-slot logic in retrieve()
// surfaces them like the bundled playbook. Non-fatal if the table is absent.
async function ingestApprovedStrategies() {
  try {
    const r = await pool.query(
      `SELECT title, profile, relief, section, cap_note, how_to, caveat, form_step
         FROM playbook_strategies WHERE status = 'approved' ORDER BY updated_at DESC`
    );
    let added = 0;
    for (const s of r.rows) {
      const text = [
        `## Strategy: ${s.title}`,
        s.profile ? `Who / when: ${s.profile}` : '',
        [s.relief && `Relief: ${s.relief}`, s.section && `Section: ${s.section}`, s.cap_note && `Cap: ${s.cap_note}`].filter(Boolean).join(' · '),
        s.how_to ? `How: ${s.how_to}` : '',
        s.caveat ? `Caveat: ${s.caveat}` : '',
        s.form_step ? `App form (formStep): ${s.form_step}` : '',
      ].filter(Boolean).join('\n');
      chunks.push({
        id: `admin-playbook#${added}`,
        source: 'admin-playbook',
        title: s.title,
        text,
        terms: termFreq(text),
        termCount: 0,   // filled by buildIndex()
      });
      added++;
    }
    return added;
  } catch (e) {
    logger.warn(`AI KB: approved-strategy ingest skipped: ${e.message}`);
    return 0;
  }
}

// Builds the IDF index and per-chunk term totals. Must run after every load,
// including the admin-triggered reload — otherwise docFreq describes the
// previous corpus and ranking is quietly wrong rather than obviously broken.
function buildIndex() {
  docFreq = new Map();
  for (const c of chunks) {
    let total = 0;
    for (const [term, f] of c.terms) {
      total += f;
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
    c.termCount = total;
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

  // 3. Admin-managed playbook strategies (APPROVED only). The dynamic half of
  //    the master file — added via the admin Playbook screen, no code deploy.
  total += await ingestApprovedStrategies();

  buildIndex();
  lastLoadedAt = new Date();
  logger.info(`AI KB: loaded ${total} chunks from ${chunks.reduce(
    (s, c) => s.add(c.source) && s, new Set()
  ).size} sources`);
  return total;
}

// Keyword retrieval, scored TF-IDF with length normalisation.
//
// This was raw TF, and that structurally hid every small document. Scoring by
// summed term frequency means a term like "tax" — which appears in essentially
// every chunk of a tax corpus — contributes as much as a rare, discriminating
// term, and the 821-page Ordinance contributes ~2,000 of the ~2,400 chunks. It
// therefore won practically every slot no matter what was asked.
//
// Measured on the live corpus: FBR's own Circular 01 of 2025-26, the official
// explanation of the Finance Act 2025 amendments, is 22 chunks. It did not
// surface for "Finance Act 2025 amendments explained" — the document literally
// written to answer that. Nor did the rate card. The consultant was effectively
// grounded on raw statute alone.
//
// The existing 2-slot playbook reservation below was a workaround for the same
// bug, discovered from the other end. Two corrections:
//
//   IDF   — log(N / df) discounts terms that are everywhere ("tax", "income")
//           and rewards discriminating ones ("surcharge", "e-commerce").
//   /len  — dividing by chunk length stops a long chunk outscoring a precise
//           short one merely by containing more words.
function retrieve(query, k = 5) {
  if (!chunks.length) return [];
  const qTerms = new Set(tokenize(query));
  if (!qTerms.size) return [];
  const N = chunks.length;
  const scored = chunks.map((c) => {
    let score = 0;
    for (const t of qTerms) {
      const f = c.terms.get(t);
      if (!f) continue;
      const df = docFreq.get(t) || 1;
      // +1 inside the log keeps the weight positive for a term present in
      // every chunk, rather than zeroing the chunk out entirely.
      const idf = Math.log(1 + N / df);
      score += (f / (c.termCount || 1)) * idf;
    }
    // Slight boost for short, header-rich chunks (more likely to be definitions).
    if (c.title && c.title.length < 80) score *= 1.1;
    return { c, score };
  });
  const matches = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  // Reserve up to 2 slots for the best-matching CURATED PLAYBOOK chunks so vetted
  // strategies always surface alongside (not instead of) the raw statute — the
  // 2700-chunk Ordinance PDF would otherwise crowd the concise playbook out.
  const isPlaybook = (s) => /playbook/i.test(s.c.source || '');
  const reserved = matches.filter(isPlaybook).slice(0, 2);

  // Cap chunks per source so one document cannot take every remaining slot.
  //
  // Without this, the top slots go to whichever document is longest, because a
  // long statute simply has more chances to contain the query terms. The
  // corpus now holds TWO editions of the Ordinance on purpose — one amended to
  // 30.06.2026 (current law) and one to 31.07.2025 (the Finance Act 2025 state
  // that governs the TY2025-26 returns being filed) — and they are near
  // identical. Uncapped, those two alone would fill every non-playbook slot
  // with the same passage twice and the Rules, the Finance Acts and the FBR
  // circular would never be seen.
  //
  // The consultant is shown the source name for each chunk, so it can tell the
  // two editions apart and say which year a rule applies to; that only works
  // if it is given more than one document to compare.
  const perSource = new Map();
  const rest = [];
  for (const s of matches) {
    if (reserved.includes(s)) continue;
    const src = s.c.source || '';
    const used = perSource.get(src) || 0;
    if (used >= PER_SOURCE_CAP) continue;
    perSource.set(src, used + 1);
    rest.push(s);
    if (rest.length >= k - reserved.length) break;
  }

  return [...reserved, ...rest].slice(0, k).map((s) => ({
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
  BUNDLED_KB_DIR,
  // Exported so a test can assert the app's own engineering documents never
  // reappear as consultant-facing knowledge. See the comment on the constant.
  DEFAULT_REPO_DOCS,
};
