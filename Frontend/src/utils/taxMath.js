// Shared client-side tax arithmetic.
//
// ⚠️  The SERVER is authoritative for every figure produced here. These helpers
// exist so the UI *previews* the number the server will compute — they are not
// an enforcement point. Client-side-only enforcement is what the 2026-08 audit
// was about; do not add a limit here and call it done.
//
// No rate is hardcoded. Slabs, reduction rates and thresholds all arrive from
// `tax_rates_config` via useTaxRates(); every function below takes them as an
// argument and returns 0 when they are absent (rates still loading).

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Progressive slab walk — the client mirror of
 * backend/src/services/calculationService.js `calculateProgressiveTax`.
 *
 * The DB seeds `min_income` as a "starts-at" value (600,001) while the FBR
 * semantic treats the break-point (600,000) as the exclusive lower bound of the
 * next slab, so the effective lower bound is `min_income - 1` for non-zero mins.
 * Assumes a contiguous slab sequence (the 2025-26 seed is).
 */
export function progressiveTax(taxableIncome, slabs) {
  const income = num(taxableIncome);
  if (!Array.isArray(slabs) || slabs.length === 0 || income <= 0) return 0;

  const sorted = slabs.slice().sort((a, b) => Number(a.min_income) - Number(b.min_income));

  let total = 0;
  for (const slab of sorted) {
    const minIncome = Number(slab.min_income);
    const maxIncome = slab.max_income == null ? Infinity : Number(slab.max_income);
    const rate = Number(slab.tax_rate);
    const lower = minIncome > 0 ? minIncome - 1 : 0;
    if (income <= lower) continue;
    const ceiling = Math.min(income, maxIncome);
    if (ceiling - lower > 0 && rate > 0) total += (ceiling - lower) * rate;
  }
  return total;
}

/** Average (effective) rate of normal tax on a base. 0 when the base is 0. */
export function averageTaxRate(taxableIncome, slabs) {
  const income = num(taxableIncome);
  if (income <= 0) return 0;
  return progressiveTax(income, slabs) / income;
}

/**
 * Total income excluding capital gains, as the tax engine buckets it
 * (`taxCalculationService._computeFromInputs`):
 *
 *   salary + non-cash benefits   → total_employment_income
 *   + other income (min tax)     → other_income_min_tax_total
 *   + other income (no min tax)  → other_income_no_min_tax_total
 *
 * `total_taxable_income` is the legacy single-column dialect (database/schema.sql)
 * and is only used when the Excel-shaped columns are absent.
 */
export function totalIncomeExcludingCG(contextFormData) {
  const income = contextFormData?.income || {};
  const employment =
    num(income.total_employment_income) ||
    num(income.annual_salary_wages_total) ||
    num(income.total_taxable_income);
  return employment + num(income.other_income_min_tax_total) + num(income.other_income_no_min_tax_total);
}

/** Deductible allowances already saved on the Deductions step. */
export function deductibleAllowances(contextFormData) {
  const d = contextFormData?.deductions || {};
  return (
    num(d.total_deduction_from_income) ||
    num(d.total_deductions) ||
    num(d.zakat_paid_amount) +
      num(d.zakat) +
      num(d.ushr) +
      num(d.professional_expenses_amount) +
      num(d.educational_expenses_amount) +
      num(d.other_deductions)
  );
}

/**
 * The normal-tax base — the income the progressive slabs are actually charged
 * on. Mirrors `taxableIncomeExcludingCG` in taxCalculationService, and
 * `loadIncomeBases(...).taxableIncome` in the server-side limit middleware.
 */
export function normalTaxBase(contextFormData) {
  return Math.max(0, totalIncomeExcludingCG(contextFormData) - deductibleAllowances(contextFormData));
}

/**
 * The base the income-gated allowances (s.60C, s.60D) are tested and capped on.
 *
 * Total income less the deductible allowances that are NOT themselves
 * income-gated — Zakat, Ushr, foreign tax paid, other. The two gated allowances
 * are deliberately excluded from the subtraction: a taxpayer must not be able
 * to become eligible for an allowance by claiming it.
 *
 * This mirrors `preAllowanceTaxableIncome` in
 * backend/src/middleware/validation.js `loadIncomeBases`, which is what the
 * server enforces against. Keep the two in step.
 *
 * `overrides` carries the live, not-yet-saved values from the Deductions form
 * so the preview tracks what the user is typing.
 */
export function preAllowanceTaxableIncome(contextFormData, overrides = {}) {
  const d = { ...(contextFormData?.deductions || {}), ...overrides };
  const otherAllowances =
    num(d.zakat_paid_amount) +
    num(d.zakat) +
    num(d.ushr) +
    num(d.tax_paid_foreign_country) +
    num(d.other_deductions);
  return Math.max(0, totalIncomeExcludingCG(contextFormData) - otherAllowances);
}

/**
 * Behbood / Pensioner's Benefit Account relief — 2nd Sched Pt III cl.6.
 *
 * cl.6 caps the **tax** on the profit at `maxRate` (5%). The relief is
 * therefore the tax charged **in excess of** that ceiling — which is exactly
 * what the FBR row label says ("…in excess of applicable rate"), not `maxRate`
 * × profit. The pre-fix code computed the ceiling correctly (the variable was
 * literally named `maxTax`) and then wrote it into the reduction field.
 *
 * The profit is one component of a single progressive base, so the tax charged
 * on it apportions at the **AVERAGE** rate, not the marginal rate — the same
 * method the teacher/researcher row in ReductionsForm already uses
 * (`salaryShare = salary / totalTaxable`). Using the marginal rate overstates
 * the relief at the top of the scale.
 *
 * Both directions of the old bug are closed by this:
 *   • low slab  — 800,000 taxable / 500,000 profit: tax attributable ≈ 1,250,
 *     already under the 25,000 ceiling → relief NIL (old code granted 25,000,
 *     12.5× the taxpayer's entire normal tax, which then spilled over onto CGT).
 *   • top slab  — 11,200,000 taxable / 1,000,000 profit: 276,875 − 50,000 =
 *     226,875 relief (old code granted 50,000).
 *
 * Returns the working, not just the number, so the UI can show it.
 */
export function behboodReliefCl6({ profit, taxableIncome, slabs, maxRate }) {
  const profitAmount = num(profit);
  const base = num(taxableIncome);
  const ceilingRate = Number(maxRate);

  const empty = {
    relief: 0,
    profit: profitAmount,
    base,
    averageRate: 0,
    taxOnProfit: 0,
    ceiling: 0,
    applicable: false,
  };

  if (profitAmount <= 0 || !Number.isFinite(ceilingRate)) return empty;
  if (!Array.isArray(slabs) || slabs.length === 0) return empty;

  const totalTax = progressiveTax(base, slabs);
  const averageRate = base > 0 ? totalTax / base : 0;

  // A profit larger than the whole normal-tax base means the profit has not
  // been declared on the Income form (or only partly). Attribute at most the
  // base — never invent tax that was not charged.
  const attributable = Math.min(profitAmount, base);
  const taxOnProfit = attributable * averageRate;
  const ceiling = profitAmount * ceilingRate;

  // Round to paisa, matching `round2` in backend/src/helpers/statutoryLimits.js
  // — a client value rounded up to the rupee could exceed the server's cap by
  // up to 50 paisa and be silently clamped on save, so the number on screen
  // would change on reload.
  return {
    relief: Math.max(0, Math.round((taxOnProfit - ceiling) * 100) / 100),
    profit: profitAmount,
    base,
    averageRate,
    taxOnProfit,
    ceiling,
    applicable: base > 0,
  };
}
