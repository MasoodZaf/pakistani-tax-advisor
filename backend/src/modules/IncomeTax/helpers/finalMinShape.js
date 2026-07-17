// The final/min income form binds its amount inputs to `<column>_amount` names
// that the schema doesn't have, so every response carrying a
// final_min_income_forms row has to be reshaped identically. The GET paths each
// did this inline while the save response returned the raw row; the form resets
// its whole state from whichever payload lands last, so a save wiped every
// amount field off the screen while the data sat correctly in the DB. All call
// sites go through this one function so the shapes can't drift apart again.

// Columns the form binds by their exact DB name. Everything else that isn't a
// tax or total column is an amount bucket and takes the `_amount` suffix.
const PASSTHROUGH_COLUMNS = new Set([
  // Row identity / metadata.
  'id',
  'user_id',
  'user_email',
  'tax_return_id',
  'tax_year_id',
  'tax_year',
  'is_complete',
  'created_at',
  'updated_at',
  'last_updated_by',
  // Amount buckets the form binds bare — see `amountField` in
  // Frontend/src/modules/IncomeTax/components/FinalMinIncomeForm.js.
  'salary_u_s_12_7',
  'capital_gain',
  // The ATL/filer toggle — not an amount at all. Suffixing it drops `is_atl`
  // from the payload, and the form reads a missing flag as filer
  // (`vals.is_atl !== false`), silently putting a non-filer back onto filer
  // rates — roughly half the correct final-tax rate.
  'is_atl',
]);

const keepsDbName = (key) =>
  PASSTHROUGH_COLUMNS.has(key) ||
  key.endsWith('_tax_deducted') ||
  key.endsWith('_tax_chargeable') ||
  key.includes('total');

// Reshape a raw final_min_income_forms row into the field names the form binds.
const toFinalMinFrontendShape = (row) => {
  const shaped = {};
  for (const [key, value] of Object.entries(row)) {
    shaped[keepsDbName(key) ? key : `${key}_amount`] = value;
  }
  return shaped;
};

module.exports = { toFinalMinFrontendShape, PASSTHROUGH_COLUMNS };
