// Final Tax (final_tax_forms) save-payload contract.
//
// The form posts 10 line-item groups × 3 keys + total_final_tax = 31 keys.
// Only 2 groups had columns, so 24 user-data keys were dropped on every save —
// at `warn` level, with `rejected.slice(0, 5)` in the log, and HTTP 200
// `success: true` returned to the user. Worse than data loss: total_final_tax
// is a GENERATED column derived from the surviving columns only, so the return
// under-stated final tax by Rs 7,330,044 in the QA reproduction
// (PM-PHASE15 §10). Nobody could see it from the logs and nobody did.
//
// Decision on the 24 orphan keys: ADD THE COLUMNS, do not remove the keys.
// All 8 orphan groups are real statutory final-tax heads the return needs
// (s.156A lottery, s.151(1)(a) NSS, s.151(1)(b) DSC, s.150 dividend ×2,
// s.37A capital gain ×2, s.233 commission). The migration that creates them
// already exists in-repo and was simply never applied:
//   backend/database/migrations/phase-t1-add-final-tax-line-items.sql
// and its column names match the payload keys below exactly. Nothing here is
// speculative — the schema work is "apply the migration you already wrote".
//
// total_final_tax is the one key that is correctly ignored: it is a GENERATED
// column, so the client value is not authoritative and must not be echoed into
// the write. It is listed as server-computed rather than treated as unknown so
// it neither warns nor fails.

// Keys the client may legitimately send that the server computes itself.
// Silently ignored — never written, never an error.
const SERVER_COMPUTED = new Set(['total_final_tax']);

// The 8 line-item groups whose columns phase-t1 creates. Used to tell a
// migration gap apart from a genuinely bogus key, so the error message says
// which one it is instead of making an operator guess.
const PHASE_T1_GROUPS = [
  'lottery_crossword_winnings',
  'profit_govt_securities',
  'profit_defence_savings',
  'dividend_listed_companies',
  'dividend_other',
  'capital_gain_securities_short',
  'capital_gain_securities_long',
  'commission_agents',
];

const PHASE_T1_COLUMNS = new Set(
  PHASE_T1_GROUPS.flatMap((g) => [`${g}_yn`, `${g}_amount`, `${g}_tax_rate`, `${g}_tax_amount`])
);

// Form-dialect names → DB column names. The form itself already maps these
// before posting (FinalTaxForm.js buildFinalTaxPayload), so the live browser
// never sends them; this exists so the endpoint has ONE canonical contract and
// an API client (or a future form refactor) that sends the form's own names is
// accepted rather than silently dropped.
const FE_ALIAS_TO_DB = {
  prize_bond_winnings_yn: 'prize_bonds_yn',
  prize_bond_winnings_amount: 'prize_bonds_gross_amount',
  prize_bond_winnings_tax: 'prize_bonds_tax_amount',
  lottery_crossword_winnings_tax: 'lottery_crossword_winnings_tax_amount',
  profit_govt_securities_tax: 'profit_govt_securities_tax_amount',
  profit_defence_savings_tax: 'profit_defence_savings_tax_amount',
  dividend_listed_companies_tax: 'dividend_listed_companies_tax_amount',
  dividend_other_tax: 'dividend_other_tax_amount',
  capital_gain_securities_less_12m_yn: 'capital_gain_securities_short_yn',
  capital_gain_securities_less_12m_amount: 'capital_gain_securities_short_amount',
  capital_gain_securities_less_12m_tax: 'capital_gain_securities_short_tax_amount',
  capital_gain_securities_over_12m_yn: 'capital_gain_securities_long_yn',
  capital_gain_securities_over_12m_amount: 'capital_gain_securities_long_amount',
  capital_gain_securities_over_12m_tax: 'capital_gain_securities_long_tax_amount',
  commission_agents_tax: 'commission_agents_tax_amount',
  other_final_tax_income_amount: 'other_final_tax_gross_amount',
  other_final_tax_income_tax: 'other_final_tax_tax_amount',
};

// Rewrite any form-dialect keys to their DB column names. An explicit DB-name
// key already present in the payload wins — the alias never overwrites it.
const canonicaliseFinalTaxPayload = (payload) => {
  const canonical = {};
  for (const [key, value] of Object.entries(payload || {})) {
    const dbKey = FE_ALIAS_TO_DB[key] || key;
    if (dbKey !== key && Object.prototype.hasOwnProperty.call(payload, dbKey)) continue;
    canonical[dbKey] = value;
  }
  return canonical;
};

// Human-readable cause for a rejected key, so the 422 tells an operator what to
// do rather than just naming the key.
const explainRejectedKey = (key) =>
  PHASE_T1_COLUMNS.has(key)
    ? 'column missing — apply database/migrations/phase-t1-add-final-tax-line-items.sql'
    : 'not a column on final_tax_forms';

module.exports = {
  SERVER_COMPUTED,
  FE_ALIAS_TO_DB,
  PHASE_T1_GROUPS,
  PHASE_T1_COLUMNS,
  canonicaliseFinalTaxPayload,
  explainRejectedKey,
};
