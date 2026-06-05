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
  // ─── Income ──────────────────────────────────────────────────────────────
  '1000': 'income_from_salary',
  '1009': 'pay_wages_remuneration',
  '1031': 'employer_contribution_provident',
  '1032': 'taxable_car_value',
  '1033': 'other_taxable_subsidies',
  '1049': 'other_taxable_income_rent',
  '1059': 'other_taxable_income_others',
  // ─── Final / Min Income (dividend, sukuk, prize) ─────────────────────────
  '5004': 'dividend_15_atl',
  '5005': 'dividend_25_bf_losses',
  '5008': 'profit_on_debt_7b',
  '5009': 'sukuk_12_5_percent',
  '5010': 'prize_bond_156',
  // ─── Summary totals (acknowledgement slip page 1) ────────────────────────
  '9000': 'total_income',
  '9100': 'taxable_income',
  '9200': 'tax_chargeable',
  // 9201 (Withholding Income Tax) is intentionally omitted — its row in
  // FBR 114(1) PDFs has an adjacent column digit that often glues onto
  // the amount (e.g. 12,148,3830). Use 6400 (Total Adjustable Tax) instead
  // for the same semantic value with a stable layout.
  '9210': 'refundable_income_tax',
  '9230': 'surcharge',
  // ─── Personal Assets / Wealth ────────────────────────────────────────────
  '7002': 'commercial_residential_property',
  '7006': 'investment_non_business',
  '7008': 'motor_vehicle',
  '7009': 'precious_possession',
  '7011': 'personal_item',
  '7012': 'cash_non_business',
  '7013': 'any_other_asset',
  '7015': 'total_assets_inside_pakistan',
  '7019': 'total_assets',
  '7030': 'net_assets_current_year',
  // ─── Personal Expenses (FBR 114 codes 7051..7087) ────────────────────────
  '7051': 'rent_paid',
  '7055': 'vehicle_running',
  '7056': 'travelling',
  '7058': 'electricity',
  '7059': 'water',
  '7060': 'gas',
  '7070': 'medical',
  '7071': 'educational',
  '7072': 'club',
  '7073': 'functions_gatherings',
  '7076': 'donation_zakat_etc',
  '7087': 'other_personal_household',
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
      employer_contribution_provident: named['1031']?.amount || 0,
      taxable_car_value: named['1032']?.amount || 0,
      other_taxable_subsidies: named['1033']?.amount || 0,
      other_taxable_income_rent: named['1049']?.amount || 0,
      other_taxable_income_others: named['1059']?.amount || 0,
    },
    final_min_income: {
      dividend_u_s_150_31_atl_15pc: named['5004']?.amount || 0,
      dividend_u_s_150_25pc_bf_losses: named['5005']?.amount || 0,
      profit_on_debt_u_s_7b: named['5008']?.amount || 0,
      return_invest_exceed_1m_sukuk_saa_12_5pc: named['5009']?.amount || 0,
      prize_bond_cross_world_puzzle_156: named['5010']?.amount || 0,
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
      property_current_year: named['7002']?.amount || 0,
      investment_current_year: named['7006']?.amount || 0,
      vehicle_current_year: named['7008']?.amount || 0,
      jewelry_current_year: named['7009']?.amount || 0,
      cash_current_year: named['7012']?.amount || 0,
      other_assets_current_year: named['7013']?.amount || 0,
    },
    expenses: {
      rent: named['7051']?.amount || 0,
      vehicle_running_maintenance: named['7055']?.amount || 0,
      travelling: named['7056']?.amount || 0,
      electricity: named['7058']?.amount || 0,
      water: named['7059']?.amount || 0,
      gas: named['7060']?.amount || 0,
      medical: named['7070']?.amount || 0,
      educational: named['7071']?.amount || 0,
      club: named['7072']?.amount || 0,
      functions_gatherings: named['7073']?.amount || 0,
      donations_zakat_annuity: named['7076']?.amount || 0,
      other_expenses: named['7087']?.amount || 0,
      total_expenses: named['7089']?.amount || 0,
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

// Defense-in-depth for this untrusted-input path (DEP-06): pdf-parse wraps an
// unmaintained pdf.js, so bound the work a malicious/oversized PDF can do. The
// 10 MB size cap is enforced upstream (multer in taxHistory.js); here we cap the
// pages parsed (a real FBR 114(1) return is ~5 pages) and time-box the parse so a
// pathological file can't pin CPU or hang the request. Real returns parse
// identically — they're well under both bounds.
const MAX_PDF_PAGES = 50;
const PDF_PARSE_TIMEOUT_MS = 20000;

async function parseFbrPdfBuffer(buffer) {
  const parsed = await Promise.race([
    pdfParse(buffer, { max: MAX_PDF_PAGES }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PDF parsing timed out')), PDF_PARSE_TIMEOUT_MS)
    ),
  ]);
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
