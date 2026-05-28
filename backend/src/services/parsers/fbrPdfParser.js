// FBR 114(1) PDF parser.
//
// Extracts identity + summary totals + salary WHT from an FBR "Return of
// Income filed voluntarily for complete year" PDF (form 114(1)) downloaded
// from IRIS. The output `mapped_data` shape matches what the existing
// taxHistory copy-forward route consumes — same flow as the Excel/JSON
// uploaders.
//
// Scope is deliberately narrow: only fields that are high-signal for
// pre-filling the current return (salary, salary WHT, last year's tax
// chargeable, net assets). Other rows are preserved in `raw_codes` for
// future mapping without re-parsing.

const pdfParse = require('pdf-parse');

// Codes we surface as named, structured fields. Anything else lands in
// raw_codes for inspection / future mapping. Single-amount rows only — the
// multi-amount "Adjustable Tax" rows need column-aware parsing below.
const NAMED_CODES = {
  '1000': 'income_from_salary',
  '1009': 'pay_wages_remuneration',
  '9000': 'total_income',
  '9100': 'taxable_income',
  '9200': 'tax_chargeable',
  // 9201 (Withholding Income Tax) is intentionally omitted — its row in
  // FBR 114(1) PDFs has an adjacent column digit that often glues onto
  // the amount (e.g. 12,148,3830). Use 6400 (Total Adjustable Tax) instead
  // for the same semantic value with a stable layout.
  '9210': 'refundable_income_tax',
  '9230': 'surcharge',
  '7019': 'total_assets',
  '7030': 'net_assets_current_year',
  '7089': 'personal_expenses_total',
  '7099': 'outflows',
  '7107': 'capital_assets_section_7e',
};

// "Adjustable Tax" rows have shape: <code> <col1> <col2> <tax_collected> <taxable_value> <desc>
// — the column layout varies enough between rows (FBR mixes "subject to
// normal tax" / "tax chargeable" / "tax reduced") that picking tax_collected
// by position is fragile. For v1 we anchor on KNOWN taxable values pulled
// from other codes (e.g. salary u/s 149 has taxable_value = code 1000) and
// extract the number immediately preceding it.
//
// 6400 (total adjustable tax) is the most reliable: it's the bottom-line
// summary row at the top of the section and its position is stable.
const ADJUSTABLE_CODES = {
  '6400': 'total_adjustable_tax',  // total WHT collected across all sources
};

function toNumber(str) {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Pull a single field after a label. Returns the trimmed value or null.
function fieldAfter(text, label) {
  const re = new RegExp(`${label}\\s*[:\\n]?\\s*([^\\n]+)`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function extractIdentity(text) {
  // The acknowledgement slip has the user's identity. Lines come out
  // interleaved with field labels in different orders depending on the
  // PDF generator, so we anchor on the labels.
  const period = (text.match(/(\d{2}-[A-Z][a-z]{2}-\d{4})\s*-\s*(\d{2}-[A-Z][a-z]{2}-\d{4})/));
  const taxYear = (text.match(/Tax Year\s*:?\s*(\d{4})/) || [])[1] || null;
  const ntn = (text.match(/Registration No(?:\s|\n)*?(\d{11,13})/) || [])[1] || null;

  // Name is on its own line, ALL CAPS, between "Address" and the actual
  // address. The address itself is multi-line free text — capture loosely.
  const nameMatch = text.match(/\n([A-Z][A-Z ,\.'-]{2,50})\nRegistration No/);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    ntn,
    tax_year: taxYear,        // e.g. "2025"
    period_start: period ? period[1] : null,
    period_end: period ? period[2] : null,
  };
}

// Parse the lines containing single-amount rows: <code><amount-with-commas><description>
// Returns { '<code>': { amount, description, label } }
//
// We anchor on the known code list (literal alternation) instead of \d{4,7}
// — a greedy digit class would steal leading digits from the amount because
// pdf-parse concatenates code and amount with no separator.
function extractSingleAmountCodes(text) {
  const out = {};
  const lines = text.split(/\n/);
  const codes = Object.keys(NAMED_CODES).sort((a, b) => b.length - a.length); // long codes first
  const codeAlt = codes.join('|');
  const re = new RegExp(`^(${codeAlt})(-?[\\d,]+)([A-Za-z].+)$`);
  for (const line of lines) {
    const m = line.trim().match(re);
    if (!m) continue;
    const code = m[1];
    // FIRST occurrence wins. The acknowledgement slip on page 1 carries the
    // canonical totals; later drill-down rows (e.g. previous-year net assets
    // in the reconciliation block, or per-employer detail rows) are noisy.
    if (out[code]) continue;
    out[code] = {
      code,
      amount: toNumber(m[2]),
      description: m[3].trim(),
      label: NAMED_CODES[code],
    };
  }
  return out;
}

// Parse Adjustable Tax (withholding) rows. Each line is
// <code>0<tax_collected><taxable_value><description> where the leading "0"
// is the "Amount Subject to Normal Tax" column. We sum tax_collected
// across all instances of the same code (e.g. 4 cellphone lines).
function extractAdjustableCodes(text, salaryAmount) {
  const out = {};
  const lines = text.split(/\n/);

  // For 6400 (total adjustable tax): row layout is stable —
  //   <code>0<tax_collected_with_commas><taxable_value_with_commas><desc>
  // Anchor by requiring tax_collected to have at least one comma (FBR
  // returns are always >1000 PKR) which rules out the leading "0" column.
  const re6400 = /^6400(\d?)([\d,]+,\d{3})([\d,]+,\d{3})([A-Za-z].+)$/;

  for (const line of lines) {
    const m = line.trim().match(re6400);
    if (!m) continue;
    if (out['6400']) break; // first occurrence wins
    out['6400'] = {
      code: '6400',
      amount: toNumber(m[2]),         // tax_collected total
      taxable_value: toNumber(m[3]),
      label: ADJUSTABLE_CODES['6400'],
    };
  }

  // 6402 (salary WHT) intentionally not extracted in v1: the row has 3
  // unlabeled numeric columns before the salary anchor and FBR mixes their
  // order across taxpayer profiles, making position-based extraction
  // unreliable. Use 6400 (total adjustable tax) as the WHT proxy — it
  // captures the same tax-paid figure for the typical salaried filer.

  return out;
}

// Build the `mapped_data` payload the existing taxHistory.copy-forward
// route expects. Mirrors what parseExcelBuffer → mapFields produces.
function toMappedData({ identity, named, adjustable }) {
  // Use tax_year + 1 for the "tax_year" label since FBR PDFs label the
  // calendar year of filing (e.g. 2025) but our system uses the fiscal
  // span (2024-25 for period 01-Jul-2024 to 30-Jun-2025).
  let taxYearLabel = null;
  if (identity.period_start) {
    const m = identity.period_start.match(/(\d{4})/);
    if (m) {
      const startYear = parseInt(m[1], 10);
      const endShort = String(startYear + 1).slice(-2);
      taxYearLabel = `${startYear}-${endShort}`;
    }
  }

  // Shape mirrors what mapFields() produces for Excel/JSON uploads so the
  // existing taxHistory.copy-forward + extractTotals helpers consume it
  // without changes.
  const salary = named['1000']?.amount || 0;
  const totalAdjTax = adjustable['6400']?.amount || 0;
  const taxChargeable = named['9200']?.amount || 0;

  return {
    tax_year: taxYearLabel,
    taxpayer: {
      name: identity.name,
      ntn: identity.ntn,
      period_start: identity.period_start,
      period_end: identity.period_end,
    },
    // FBR 114(1) reports total taxable salary as one figure (code 1000).
    // Can't split into basic / allowances / bonus from the PDF alone —
    // surface it as annual_basic_salary so the current-year form has
    // SOMETHING to pre-fill. User edits to split.
    income: {
      annual_basic_salary: salary,
      total_employment_income: salary,
    },
    adjustable_tax: {
      total_tax_collected: totalAdjTax,
      total_adjustable_tax: totalAdjTax,
    },
    tax_computation: {
      total_tax_chargeable: taxChargeable,
      tax_payable_refundable: (named['9210']?.amount || 0) - totalAdjTax,
    },
    wealth: {
      total_assets: named['7019']?.amount || 0,
      net_assets_current_year: named['7030']?.amount || 0,
      personal_expenses: named['7089']?.amount || 0,
    },
    summary: {
      total_income: named['9000']?.amount || 0,
      taxable_income: named['9100']?.amount || 0,
      tax_chargeable: taxChargeable,
      withholding_tax: totalAdjTax,
      refundable_tax: named['9210']?.amount || 0,
      surcharge: named['9230']?.amount || 0,
      total_assets: named['7019']?.amount || 0,
      net_assets: named['7030']?.amount || 0,
      personal_expenses: named['7089']?.amount || 0,
    },
    // Preserved so the operator (or a future migration) can map more
    // fields without re-uploading the PDF.
    raw_codes: { ...named, ...adjustable },
  };
}

// Some rows have the code AFTER the amount (e.g. Salary block) rather than
// before. Anchor on a unique description label and pull the amount from
// either side of the code. Returns the parsed amount or 0.
function extractByLabel(text, code, labelRe) {
  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!labelRe.test(trimmed)) continue;
    // Two common patterns for a single-amount row:
    //   <amount><code><other_cols><amount_repeat><desc>
    //   <code><amount><desc>
    // After stripping the code and description, the remaining numeric
    // tokens always include the target amount as their max non-zero. PDF
    // text strips negatives rarely, so this is safe in practice.
    const stripped = trimmed.replace(labelRe, '').replace(new RegExp(code, 'g'), ' ');
    const tokens = stripped.split(/[^\d,.\-]+/).filter(Boolean);
    let max = 0;
    for (const t of tokens) {
      const n = toNumber(t);
      if (Math.abs(n) > Math.abs(max)) max = n;
    }
    if (max !== 0) return max;
  }
  return 0;
}

async function parseFbrPdfBuffer(buffer) {
  const parsed = await pdfParse(buffer);
  const text = parsed.text || '';

  const identity = extractIdentity(text);
  const named = extractSingleAmountCodes(text);

  // Code 1000 (Income from Salary) has the layout
  //   <NormalTaxAmt><Code><ExemptAmt><Description><Total>
  // — the leading-code regex misses it. Anchor on the description instead.
  if (!named['1000']) {
    const amount = extractByLabel(text, '1000', /Income from Salary/);
    if (amount) {
      named['1000'] = { code: '1000', amount, description: 'Income from Salary', label: NAMED_CODES['1000'] };
    }
  }

  // 6402 anchors on the salary amount from code 1000, so order matters.
  const adjustable = extractAdjustableCodes(text, named['1000']?.amount || 0);

  return {
    source_format: 'fbr_pdf_114_1',
    pages: parsed.numpages,
    mapped_data: toMappedData({ identity, named, adjustable }),
  };
}

module.exports = { parseFbrPdfBuffer };
