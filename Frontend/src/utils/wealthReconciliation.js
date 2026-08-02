// Wealth-reconciliation arithmetic, extracted from WealthReconciliationForm so
// it can be unit-tested without rendering.
//
// Why this file exists: the reconciliation understated declared inflows badly
// enough to manufacture a *blocking* unreconciled difference (the submit
// endpoint returns 422 WEALTH_RECON_UNBALANCED), and the form then offered a
// one-click "add the whole gap to Foreign Remittance / Inheritance / Gift"
// button. A phantom gap plus a one-click resolution is how an app bug becomes a
// taxpayer's false declaration. Two arithmetic faults produced the gap:
//
//   1. EXEMPT INCOME WAS SUBTRACTED TWICE.  `income_exempt_from_tax` is the
//      Excel-B15 *contra*: the generated column stores
//      `-(retirement + termination + medical)`, i.e. a NEGATIVE number, and
//      `total_employment_income` is ALREADY net of it:
//
//        income_exempt_from_tax    := -E
//        annual_salary_wages_total := (gross incl. those three) + (-E)
//        total_employment_income   := annual_salary_wages_total + non-cash
//
//      The reconciliation fed `total_employment_income` in as the normal-tax
//      inflow and then *added* the raw contra on top:
//
//        inflows = (S - E) + (-E) = S - 2E
//
//      Flipping the sign at the addition site is a HALF-CORRECTION — it yields
//      S - E, still understated by E, and looks fixed. The exempt row has to
//      carry the positive magnitude so the two cancel: (S - E) + E = S.
//      Exempt income is real cash and does fund asset growth.
//
//   2. `income_final_tax` WAS A WRONG-TABLE READ, structurally always zero.
//      It read `formData.final_tax.total_final_tax` — the *legacy* Final Tax
//      step (`final_tax_forms`) — while every filer on the 12-form deck enters
//      that income on the modern Final/Min Tax Income step
//      (`final_min_income_forms`). It could never self-heal by data entry. And
//      `total_final_tax` is a TAX column, not an income column, so even the
//      legacy read was the wrong quantity for an inflow row.

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Exempt income as a POSITIVE inflow magnitude.
 *
 * The Excel-shaped `income_forms.income_exempt_from_tax` is a negative contra;
 * the legacy `income_forms.total_exempt_income` (database/schema.sql) is
 * positive. Normalising to a magnitude makes the reconciliation correct under
 * both dialects and makes the double-subtraction impossible to reintroduce.
 */
export function exemptIncomeInflow(incomeData = {}) {
  const raw = num(incomeData.income_exempt_from_tax) || num(incomeData.total_exempt_income);
  return Math.abs(raw);
}

/**
 * Income attributable to receipts under final / fixed tax and CGT.
 *
 * The modern Final/Min Tax Income step binds every income bucket with an
 * `_amount` suffix (see backend .../helpers/finalMinShape.js — anything that is
 * not metadata, `_tax_deducted`, `_tax_chargeable` or a total gets the suffix),
 * plus the bare `capital_gain` column auto-linked from the Capital Gains step.
 *
 * `salary_u_s_12_7` is deliberately NOT counted: it has no `_amount` suffix
 * because it is auto-linked from the Income form's `annual_salary_wages_total`,
 * so it is already inside the normal-tax inflow. Counting it would double-count
 * salary and manufacture a gap in the opposite direction.
 *
 * Falls back to the legacy `final_tax_forms` RECEIPT columns (never
 * `total_final_tax`, which is tax, not income) for returns filed on the old deck.
 */
export function finalMinIncomeInflow(finalMinData = {}, legacyFinalTaxData = {}) {
  let total = 0;
  let sawModernValue = false;

  for (const [key, value] of Object.entries(finalMinData)) {
    if (!key.endsWith('_amount')) continue;
    const amount = num(value);
    if (amount !== 0) {
      total += amount;
      sawModernValue = true;
    }
  }

  const capitalGain = num(finalMinData.capital_gain);
  if (capitalGain !== 0) {
    total += capitalGain;
    sawModernValue = true;
  }

  if (sawModernValue) return total;

  return (
    num(legacyFinalTaxData.sukuk_amount) +
    num(legacyFinalTaxData.debt_amount) +
    num(legacyFinalTaxData.prize_bonds) +
    num(legacyFinalTaxData.other_final_tax_amount)
  );
}

/**
 * Income declared subject to NORMAL tax.
 *
 * Employment income plus the other-income buckets — the same buckets the tax
 * engine charges the progressive slabs on. The previous read took
 * `total_employment_income` alone, silently dropping rental and other-source
 * income from the reconciliation for anyone who has it.
 */
export function normalTaxIncomeInflow(incomeData = {}) {
  const employment =
    num(incomeData.total_employment_income) ||
    num(incomeData.annual_salary_wages_total) ||
    num(incomeData.total_taxable_income);
  return (
    employment +
    num(incomeData.other_income_min_tax_total) +
    num(incomeData.other_income_no_min_tax_total)
  );
}

/**
 * Full reconciliation. `inputs` holds the user-entered inflow/outflow fields
 * from the form; everything else is pulled from the other steps' saved data.
 *
 * Returns the DB-bound shape (`wealth_reconciliation_forms` column names).
 */
export function computeWealthReconciliation({
  wealth = {},
  income = {},
  expenses = {},
  finalMin = {},
  legacyFinalTax = {},
  inputs = {},
}) {
  const netAssetsCurrent =
    num(wealth.net_worth_current_year) ||
    num(wealth.total_assets_current_year) - num(wealth.total_liabilities_current_year);
  const netAssetsPrevious =
    num(wealth.net_worth_previous_year) ||
    num(wealth.total_assets_previous_year) - num(wealth.total_liabilities_previous_year);
  const netAssetsIncrease = netAssetsCurrent - netAssetsPrevious;

  const incomeNormalTax = normalTaxIncomeInflow(income);
  const incomeExemptFromTax = exemptIncomeInflow(income);
  const incomeFinalTax = finalMinIncomeInflow(finalMin, legacyFinalTax);

  const foreignRemittance = num(inputs.foreign_remittance);
  const inheritance = num(inputs.inheritance);
  const giftInflow = num(inputs.gift_value);
  const assetGainLoss = num(inputs.asset_disposal_gain_loss);
  const otherInflows = num(inputs.other_inflows);

  const totalInflows =
    incomeNormalTax +
    incomeExemptFromTax +
    incomeFinalTax +
    foreignRemittance +
    inheritance +
    giftInflow +
    assetGainLoss +
    otherInflows;

  const personalExpenses = num(expenses.total_expenses) || num(inputs.personal_expenses);
  const adjustmentsOutflows = num(inputs.adjustments_outflows);
  const giftOutflow = num(inputs.gift_outflow);
  const lossOnDisposal = num(inputs.loss_on_disposal);
  const totalOutflows = personalExpenses + adjustmentsOutflows + giftOutflow + lossOnDisposal;

  const calculatedNetIncrease = totalInflows - totalOutflows;

  return {
    net_assets_current_year: netAssetsCurrent,
    net_assets_previous_year: netAssetsPrevious,
    net_assets_increase: netAssetsIncrease,
    income_normal_tax: incomeNormalTax,
    income_exempt_from_tax: incomeExemptFromTax,
    income_final_tax: incomeFinalTax,
    total_inflows: totalInflows,
    personal_expenses: personalExpenses,
    total_outflows: totalOutflows,
    calculated_net_increase: calculatedNetIncrease,
    unreconciled_difference: netAssetsIncrease - calculatedNetIncrease,
  };
}
