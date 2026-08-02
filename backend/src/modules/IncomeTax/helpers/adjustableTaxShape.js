// Save-vs-read field-name dialect for adjustable_tax_forms.
//
// Postgres identifiers are capped at NAMEDATALEN-1 = 63 bytes. Two of the 236C
// column names the application uses are 65 characters:
//
//   tax_deducted_236c_property_purchased_sold_same_year_gross_receipt  (65)
//   tax_deducted_236c_property_purchased_sold_same_year_tax_collected  (65)
//
// so CREATE TABLE silently truncated them to 63 bytes. The table physically
// CANNOT hold the full-length names — no rename migration can fix this, which
// is why the mapping layer is the fix rather than a schema change.
//
// The controller already bridged the name INBOUND (full name on the write) but
// not OUTBOUND, so a GET returned only the truncated key. The form — and any
// read-modify-write API client — then sent the truncated key back, the write
// path found the full-length key `undefined`, and `|| 0` wrote a zero over the
// stored value. Rs 5,000,000 gross / Rs 225,000 withheld were destroyed on the
// second save in the QA round-trip (PM-PHASE15 §9).
//
// Every response carrying an adjustable_tax_forms row goes through
// toAdjustableTaxFrontendShape, and every read of one of these fields off a
// client payload goes through readEitherName, so the two dialects cannot drift
// apart again. Same construction as helpers/finalMinShape.js.

// full application name → actual (truncated) DB column name
const FULL_TO_DB_COLUMN = {
  tax_deducted_236c_property_purchased_sold_same_year_gross_receipt:
    'tax_deducted_236c_property_purchased_sold_same_year_gross_recei',
  tax_deducted_236c_property_purchased_sold_same_year_tax_collected:
    'tax_deducted_236c_property_purchased_sold_same_year_tax_collect',
};

// truncated DB column name → full application name
const DB_COLUMN_TO_FULL = Object.fromEntries(
  Object.entries(FULL_TO_DB_COLUMN).map(([full, col]) => [col, full])
);

// Resolve the real column name to write to. Identity for every other field.
const toDbColumn = (fieldName) => FULL_TO_DB_COLUMN[fieldName] || fieldName;

// Reshape a raw adjustable_tax_forms row for a response: add the full-length
// alias for every truncated column. The truncated key is KEPT as well —
// Frontend/src/.../formFieldVisibility.js and any already-deployed client read
// it, and dropping it would break them mid-rollout.
const toAdjustableTaxFrontendShape = (row) => {
  if (!row || typeof row !== 'object') return row;
  const shaped = { ...row };
  for (const [col, full] of Object.entries(DB_COLUMN_TO_FULL)) {
    if (Object.prototype.hasOwnProperty.call(row, col)) {
      shaped[full] = row[col];
    }
  }
  return shaped;
};

// Read a field off a client payload under either dialect. A client replaying a
// GET response verbatim carries the truncated key; the form carries the full
// one. Both must resolve, or the round trip zeroes the value.
const readEitherName = (payload, fullName) => {
  if (!payload || typeof payload !== 'object') return undefined;
  if (payload[fullName] !== undefined && payload[fullName] !== null) {
    return payload[fullName];
  }
  const col = FULL_TO_DB_COLUMN[fullName];
  if (col && payload[col] !== undefined && payload[col] !== null) {
    return payload[col];
  }
  return undefined;
};

// ─────────────────── ATL / non-filer coverage (audit F-02) ──────────────────
//
// `adjustable_tax_forms` had no filer concept at all, so a declared non-filer
// was charged filer withholding across every head. `is_atl` now exists, but a
// flag only changes an outcome where the SERVER computes the tax, and only
// where tax_rates_config actually carries a non-filer rate.
//
// All 27 heads are enumerated below with the `tax_rates_config` rate_category
// (rate_type='withholding') they resolve against. `atlKey`/`nonAtlKey` are set
// only where BOTH rows exist. Where they do not, the head is listed with
// `nonAtlKey: null` and the gap is real — it is NOT patched by doubling the
// filer rate in code, exactly as with profit-on-debt on the Final/Min form.
//
// Today: 27 heads, 12 with any rate row, and **1** with an ATL/non-ATL pair.
// F-02 is therefore closed for one head of 27 and remains substantially open.
const ADJUSTABLE_HEAD_RATES = {
  // ✅ The one head with a legislated pair seeded (phase-g:44-45).
  functions_gatherings_charges_236cb: {
    atlKey: 'functions_gatherings_236cb_atl',
    nonAtlKey: 'functions_gatherings_236cb_nonatl',
  },

  // ── Single (filer-only) rate row seeded; non-filer row MISSING ───────────
  profit_debt_151_15:            { atlKey: 'profit_debt_151_20',           nonAtlKey: null },
  profit_debt_sukook_151a:       { atlKey: 'sukook_151a',                  nonAtlKey: null },
  tax_deducted_rent_section_155: { atlKey: 'rent_section_155_individual',  nonAtlKey: null },
  motor_vehicle_transfer_fee_231b2: { atlKey: 'motor_vehicle_transfer_231b2', nonAtlKey: null },
  motor_vehicle_leasing_231b1a:  { atlKey: 'motor_vehicle_leasing_231b1a', nonAtlKey: null },
  electricity_bill_domestic_235: { atlKey: 'electricity_bill_235',         nonAtlKey: null },
  telephone_bill_236_1e:         { atlKey: 'telephone_bill_236_1e',        nonAtlKey: null },
  prepaid_telephone_card_236_1b: { atlKey: 'prepaid_telephone_card_236_1b', nonAtlKey: null },
  phone_unit_236_1c:             { atlKey: 'phone_unit_236_1c',            nonAtlKey: null },
  internet_bill_236_1d:          { atlKey: 'internet_bill_236_1d',         nonAtlKey: null },
  prepaid_internet_card_236_1e:  { atlKey: 'prepaid_internet_card_236_1e', nonAtlKey: null },

  // ── No rate row at all. Pure declaration surface: the taxpayer types the
  //    figure off a withholding certificate, so no server rate is applied and
  //    ATL status cannot change the stored number.
  salary_employees_149:                    { atlKey: null, nonAtlKey: null },
  directorship_fee_149_3:                  { atlKey: null, nonAtlKey: null },
  advance_tax_cash_withdrawal_231ab:       { atlKey: null, nonAtlKey: null },
  motor_vehicle_registration_fee_231b1:    { atlKey: null, nonAtlKey: null },
  motor_vehicle_sale_231b3:                { atlKey: null, nonAtlKey: null },
  advance_tax_motor_vehicle_231b2a:        { atlKey: null, nonAtlKey: null },
  cellphone_bill_236_1f:                   { atlKey: null, nonAtlKey: null },
  sale_transfer_immoveable_property_236c:  { atlKey: null, nonAtlKey: null },
  tax_deducted_236c_property_purchased_sold_same_year: { atlKey: null, nonAtlKey: null },
  tax_deducted_236c_property_purchased_prior_year:     { atlKey: null, nonAtlKey: null },
  purchase_transfer_immoveable_property_236k: { atlKey: null, nonAtlKey: null },
  withholding_tax_sale_considerations_37e: { atlKey: null, nonAtlKey: null },
  advance_fund_23a_part_i_second_schedule: { atlKey: null, nonAtlKey: null },
  persons_remitting_amount_abroad_236v:    { atlKey: null, nonAtlKey: null },
  advance_tax_foreign_domestic_workers_231c: { atlKey: null, nonAtlKey: null },
};

const ATL_PAIRED_HEADS = Object.entries(ADJUSTABLE_HEAD_RATES)
  .filter(([, v]) => v.atlKey && v.nonAtlKey)
  .map(([k]) => k);

// Heads that have a filer rate but no non-filer row — lane E seeds these and
// they light up with no code change.
const NON_ATL_RATE_GAPS = Object.entries(ADJUSTABLE_HEAD_RATES)
  .filter(([, v]) => v.atlKey && !v.nonAtlKey)
  .map(([k]) => k);

/**
 * Resolve the withholding rate for a head, honouring ATL status wherever the
 * table carries a pair. Never fabricates a non-filer rate: when the non-ATL row
 * is missing the filer rate is returned with `nonAtlRateMissing: true` so the
 * caller can flag it.
 * @returns {{rate:number|null, rateKey:string|null, nonAtlRateMissing:boolean}}
 */
function resolveHeadRate(head, isATL, taxRates) {
  const cfg = ADJUSTABLE_HEAD_RATES[head];
  const miss = { rate: null, rateKey: null, nonAtlRateMissing: false };
  if (!cfg || !cfg.atlKey) return miss;

  const key = (!isATL && cfg.nonAtlKey) ? cfg.nonAtlKey : cfg.atlKey;
  const raw = taxRates && taxRates[key];
  const rate = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!Number.isFinite(rate)) return miss;

  return { rate, rateKey: key, nonAtlRateMissing: !isATL && !cfg.nonAtlKey };
}

module.exports = {
  FULL_TO_DB_COLUMN,
  DB_COLUMN_TO_FULL,
  toDbColumn,
  toAdjustableTaxFrontendShape,
  readEitherName,
  ADJUSTABLE_HEAD_RATES,
  ATL_PAIRED_HEADS,
  NON_ATL_RATE_GAPS,
  resolveHeadRate,
};
