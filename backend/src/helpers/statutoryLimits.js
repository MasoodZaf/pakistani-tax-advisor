/**
 * statutoryLimits — the single server-side authority for every statutory
 * quantum/threshold rule the filing forms are allowed to claim.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before this, every limit in the application lived in the browser only
 * (`DeductionsForm.js`, `CreditsForm.js`, `ReductionsForm.js`). A single
 * authenticated POST that skipped the UI reduced a lawful Rs 21,400 liability
 * to Rs 0 (QA 2026-08-02, PM-FINAL-AUDIT §5). The rule is now:
 *
 *   **The server never trusts a client-supplied tax figure.**
 *
 * DESIGN
 * ------
 *  - Every function here is PURE and SYNCHRONOUS. No DB, no I/O, no clock.
 *  - **No rate is ever hardcoded.** Every percentage, ceiling and threshold is
 *    read out of `tax_rates_config` (via `TaxRateService.getAllRates`), which
 *    is the authority and is already correct. A missing rate throws — it is a
 *    configuration bug, never something to paper over with a default.
 *
 * TWO CALLING SHAPES (both exported, same names, same maths)
 * ----------------------------------------------------------
 *  1. Bound — this is the shape the remediation contract names, and what other
 *     lanes should use:
 *
 *         const L = await forTaxYear('2025-26');
 *         L.capDonationU61(taxableIncome, isAssociate);
 *         L.capPensionU63(taxableIncome);
 *         L.capEducationU60D(taxableIncome, children);
 *         L.capProfessionalU60C(taxableIncome, posAmount);
 *         L.behboodReliefCl6(profit, taxOnProfitAtAvgRate);
 *         L.superTaxU4C(income);
 *
 *  2. Free — the same six functions with the rate bundle as a trailing
 *     argument. Used by tests (pass a fixture, no DB) and by callers that
 *     already hold a bundle from `getAllRates`:
 *
 *         capDonationU61(taxableIncome, isAssociate, rates);
 *
 * THRESHOLD SEMANTICS — two details the statute decides, both previously wrong
 * ---------------------------------------------------------------------------
 *  - Thresholds compare **taxable** income, not gross. (The browser summed
 *    gross: `DeductionsForm.js:124-126`.)
 *  - s.60D reads "**less than**" Rs 1,500,000 — strict `<`, not `<=`, so a
 *    taxpayer at exactly 1,500,000 is not eligible. Sources disagree on this
 *    wording, so it is an ADMIN SETTING with the strict reading as the default;
 *    see `capEducationU60D`.
 *
 * OPEN LEGAL QUESTIONS ARE ADMIN SETTINGS, NOT CODE CONSTANTS
 * ----------------------------------------------------------
 * Where the law is genuinely unsettled, or where the app's own citation turned
 * out to be wrong, the *mechanism* lives here and the *decision* lives in
 * `tax_rates_config`, editable at Admin -> Statutory Reliefs with an audit
 * trail. The owner's tax counsel can then settle a question without a deploy,
 * and nothing here silently assumes an answer.
 *
 * Three such questions are live (see `modules/Admin/routes/statutoryReliefs.js`
 * for the full statutory background on each):
 *
 *  - the s.60D threshold operator, above;
 *  - "professional expenses u/s 60C", which was cited to a section that was
 *    omitted by Finance Act 2022 and never covered these expenses. Retired by
 *    phase-z19; re-enableable if counsel finds a basis this research could not;
 *  - the FA-2025 housing-loan profit-on-debt TAX CREDIT, which the app does not
 *    implement. The mechanism now exists and stays inert until the owner
 *    supplies its statutory parameters, because guessing a cap would be worse
 *    than not offering the relief.
 *
 * Defaults are always the CONSERVATIVE reading — deny the relief — because a
 * missing configuration row must never widen a claim.
 */

const TaxRateService = require('../services/taxRateService');

// ── small pure numeric helpers ───────────────────────────────────────────────

/** Coerce anything the wire can carry into a finite non-negative number. */
function toAmount(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Round to whole paisa. Money never carries float dust into the DB. */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Pull one rate row out of a `getAllRates` bundle, failing loudly.
 * `field` is 'rate' (a percentage) or 'fixedAmount' (a rupee ceiling / count).
 */
function rateOf(rates, group, category, field) {
  const set = rates && rates[group];
  if (!set || typeof set !== 'object') {
    throw new Error(`statutoryLimits: rate group "${group}" missing from the rate bundle.`);
  }
  const row = set[category];
  if (!row) {
    throw new Error(
      `statutoryLimits: "${group}/${category}" is not configured in tax_rates_config.`
    );
  }
  const value = row[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `statutoryLimits: "${group}/${category}.${field}" is not a usable number (got ${value}).`
    );
  }
  return value;
}

// ── s.61 — charitable donations ──────────────────────────────────────────────

/**
 * Maximum donation amount that may attract the s.61 tax credit.
 *
 *   30% of taxable income, or 15% where the donee is an associate.
 *
 * NOTE this caps the ELIGIBLE AMOUNT (the `C` of the statutory `(A/B) × C`),
 * not the donation itself — a taxpayer may lawfully donate more than the cap,
 * they simply get no credit on the excess. The credit that finally lands is
 * `eligible × average rate`, so this value is also a hard upper bound on the
 * credit and is what the write path enforces.
 *
 * @param {number} taxableIncome
 * @param {boolean} isAssociate  donee is an associate → the 15% proviso
 * @param {object} rates         bundle from TaxRateService.getAllRates
 * @returns {number} rupees
 */
function capDonationU61(taxableIncome, isAssociate, rates) {
  const ti = toAmount(taxableIncome);
  if (ti <= 0) return 0;
  const pct = rateOf(
    rates,
    'creditCaps',
    isAssociate ? 'donation_u61_associate' : 'donation_u61',
    'rate'
  );
  return round2(ti * pct);
}

// ── s.63 — approved pension fund contributions ───────────────────────────────

/**
 * Maximum pension contribution attracting the s.63 credit: 20% of taxable
 * income. Same "caps the eligible amount, not the contribution" note as s.61.
 *
 * @param {number} taxableIncome
 * @param {object} rates
 * @returns {number} rupees
 */
function capPensionU63(taxableIncome, rates) {
  const ti = toAmount(taxableIncome);
  if (ti <= 0) return 0;
  return round2(ti * rateOf(rates, 'creditCaps', 'pension_u63', 'rate'));
}

// ── s.60D — education expenses ───────────────────────────────────────────────

/**
 * Maximum s.60D deductible allowance.
 *
 *   Eligible only where taxable income is LESS THAN Rs 1,500,000 (strict `<`).
 *   Quantum: Rs 60,000 per child, for at most 2 children.
 *
 * Every number above comes from `tax_rates_config`
 * (`deduction_threshold/education_*`).
 *
 * A negative or fractional child count is floored at 0 and truncated — you
 * cannot claim for 1.9 children.
 *
 * KNOWN GAP (data model, not this file): s.60D has three limbs. Only the one
 * the schema can represent is enforced here. Limb (a) (tuition fee) needs
 * `deductions_forms.tuition_fee_amount`, which lane E's phase-z13 migration
 * adds; until a value is captured there is nothing to cap.
 *
 * @param {number} taxableIncome
 * @param {number} children
 * @param {object} rates
 * @returns {number} rupees — 0 when the taxpayer is over the income threshold
 */
function capEducationU60D(taxableIncome, children, tuitionFeePaid, rates) {
  // Back-compat with the contract's two-argument signature: callers that pass
  // (taxableIncome, children, rates) still work.
  if (rates === undefined && tuitionFeePaid && typeof tuitionFeePaid === 'object') {
    rates = tuitionFeePaid;
    tuitionFeePaid = undefined;
  }

  const ti = toAmount(taxableIncome);
  const threshold = rateOf(
    rates,
    'deductionThresholds',
    'education_max_taxable_income',
    'fixedAmount'
  );

  // ── THE COMPARISON OPERATOR IS AN ADMIN SETTING, NOT A CODE CONSTANT ──
  //
  // Published sources disagree on whether s.60D(2) reads "less than"
  // Rs 1,500,000 or "does not exceed" it. The difference changes the answer for
  // exactly one taxpayer — the one whose taxable income is precisely the
  // threshold — so it is not worth guessing, and it is not something this file
  // should decide on the owner's behalf either way.
  //
  // The app therefore ships the strict reading (`<`, the conservative one: it
  // denies the allowance at the boundary rather than granting something that
  // may not exist) and exposes the choice as an editable setting in
  // Admin -> Statutory Reliefs, backed by
  // `deduction_threshold/education_threshold_inclusive`. When the owner's tax
  // counsel settles the wording, flipping it is a rate-row change with an audit
  // entry — not a deploy.
  //
  // Absent row => strict, i.e. the behaviour that shipped. Never widen a relief
  // by default on account of a missing configuration row.
  const inclusive = rates?.deductionThresholds?.education_threshold_inclusive?.rate === 1;
  const eligibleOnIncome = inclusive ? ti <= threshold : ti < threshold;
  if (!eligibleOnIncome) return 0;

  const maxChildren = rateOf(rates, 'deductionThresholds', 'education_max_children', 'fixedAmount');
  const perChild = rateOf(rates, 'deductionThresholds', 'education_per_child_cap', 'fixedAmount');

  const n = Math.min(Math.max(Math.trunc(toAmount(children)), 0), maxChildren);

  // Limb (c) — Rs 60,000 × eligible children. The only limb the app could
  // express before phase-z14.
  const limbChildren = n * perChild;

  const limbs = [limbChildren];

  // Limb (a) — a PERCENTAGE of the tuition fee actually paid, not the whole fee.
  //
  // This pushed the raw fee, which is not the limb: s.60D allows the least of
  // 5% of the fee, 25% of taxable income, and the per-child cap. Pushing 100% of
  // the fee makes limb (a) twenty times too generous and, on any realistic fee,
  // so large that it never binds at all — so the limb was effectively absent
  // while appearing to be implemented. Measured: taxable 1,400,000, fee 200,000,
  // 2 children, claim 115,000 → stored 115,000 against a true entitlement of
  // 10,000, with no adjustment recorded.
  //
  // Worse than the number: the rule text shown to the taxpayer described the
  // 5% calculation, so the message and the arithmetic disagreed — the same class
  // of defect as the false s.60D threshold reason (R-02).
  //
  // phase-z19 seeded `education_tuition_fee_pct` for exactly this and nothing
  // read it. No rate is invented here: with no row the limb is SKIPPED rather
  // than defaulted, because a guessed percentage is how "professional expenses
  // u/s 60C" came to exist.
  if (tuitionFeePaid !== undefined && tuitionFeePaid !== null && tuitionFeePaid !== '') {
    const feePct = rates?.deductionThresholds?.education_tuition_fee_pct?.rate;
    if (typeof feePct === 'number' && Number.isFinite(feePct) && feePct > 0) {
      limbs.push(toAmount(tuitionFeePaid) * feePct);
    }
  }

  // Limb (b) — a percentage of taxable income. NO RATE IS INVENTED HERE. There
  // is no `education_taxable_income_pct` row in tax_rates_config today, so this
  // limb is skipped rather than guessed; seed the row and it starts binding
  // with no code change. See the report's "still unenforced" list.
  const incomePct = rates?.deductionThresholds?.education_taxable_income_pct?.rate;
  if (typeof incomePct === 'number' && Number.isFinite(incomePct) && incomePct > 0) {
    limbs.push(ti * incomePct);
  }

  // s.60D grants the LEAST of the limbs.
  return round2(Math.max(0, Math.min(...limbs)));
}

// ── s.60C — professional expenses in respect of a POS ────────────────────────

/**
 * Maximum s.60C deductible allowance.
 *
 *   Eligible only where taxable income is LESS THAN Rs 1,500,000 (strict `<`).
 *   Quantum: the LOWER of 5% of the POS amount and 25% of taxable income.
 *
 * Both percentages and the threshold are DB-driven — see the open legal
 * question in the file header. Do not replace them with literals.
 *
 * @param {number} taxableIncome
 * @param {number} posAmount     the point-of-sale amount the claim rests on
 * @param {object} rates
 * @returns {number} rupees — 0 when over the income threshold or POS is 0
 */
function capProfessionalU60C(taxableIncome, posAmount, rates) {
  const ti = toAmount(taxableIncome);
  const threshold = rateOf(
    rates,
    'deductionThresholds',
    'prof_expenses_max_taxable_income',
    'fixedAmount'
  );

  if (!(ti < threshold)) return 0;

  const posPct = rateOf(rates, 'deductionThresholds', 'prof_expenses_pos_amount_pct', 'rate');
  const incomePct = rateOf(
    rates,
    'deductionThresholds',
    'prof_expenses_taxable_income_pct',
    'rate'
  );

  const pos = toAmount(posAmount);
  if (pos <= 0) return 0;

  return round2(Math.min(pos * posPct, ti * incomePct));
}

// ── FA-2025 housing-loan profit-on-debt TAX CREDIT ───────────────────────────

/**
 * The Finance Act 2025 relief for profit on debt on a taxpayer's own house.
 *
 * WHAT THIS IS AND WHY IT IS OFF BY DEFAULT
 * -----------------------------------------
 * The old s.60C deductible allowance for profit on debt was omitted by Finance
 * Act 2022. FA-2025 brought back a housing relief but as a **tax credit**, not a
 * deductible allowance — profit on debt on a house up to 2,500 sq ft or a flat
 * up to 2,000 sq ft, not claimable again for 15 years.
 *
 * The app does not implement it, which means every taxpayer entitled to it is
 * currently OVER-paying. That is a real gap and it is the reason this function
 * exists. What this function deliberately does NOT do is invent the quantum:
 * the research behind phase-z19 could not establish the cap from a primary
 * source, and a guessed ceiling on a credit is exactly the class of error that
 * produced the "professional expenses u/s 60C" defect in the first place.
 *
 * So the mechanism is here and INERT until the owner supplies the parameters at
 * Admin -> Statutory Reliefs. No configuration row => returns 0 => the credit is
 * simply not offered, and the form field for it is not shown. That is the
 * conservative failure mode: the taxpayer is no worse off than before this
 * function existed, and nobody gets a relief the app cannot cite.
 *
 * Shape, once configured — the standard credit form `(A/B) × C`:
 *   C = the LEAST of
 *         the profit on debt actually paid,
 *         `rate` × taxable income        (skipped when rate is 0)
 *         `fixedAmount` rupees           (skipped when fixedAmount is 0)
 *   credit = C × the average rate, applied by the caller.
 *
 * @param {number} taxableIncome
 * @param {number} profitPaid   profit on debt paid on the qualifying property
 * @param {object} rates
 * @returns {number} the ELIGIBLE AMOUNT (`C`), or 0 when the relief is not
 *                   configured for this tax year
 */
function capHousingLoanProfitCredit(taxableIncome, profitPaid, rates) {
  const cfg = rates?.creditCaps?.housing_loan_profit_on_debt;
  if (!cfg) return 0; // relief not configured — see above, this is intentional

  const paid = toAmount(profitPaid);
  if (paid <= 0) return 0;

  const ti = toAmount(taxableIncome);
  const limbs = [paid];

  const pct = Number(cfg.rate);
  if (Number.isFinite(pct) && pct > 0) limbs.push(ti * pct);

  const absolute = Number(cfg.fixedAmount);
  if (Number.isFinite(absolute) && absolute > 0) limbs.push(absolute);

  return round2(Math.max(0, Math.min(...limbs)));
}

/** Whether the housing-loan credit is configured for this tax year at all. */
function housingLoanCreditConfigured(rates) {
  return Boolean(rates?.creditCaps?.housing_loan_profit_on_debt);
}

// ── 2nd Sched Pt III cl.6 — Behbood / Pensioners' Benefit certificates ───────

/**
 * Relief under clause 6: tax on the profit is not to exceed 5% of that profit,
 * so the relief is the tax charged **in excess of** the ceiling — NOT 5% of
 * the profit.
 *
 * The app shipped `profit × 5%` straight into the reduction field (the local
 * variable was even named `maxTax`), which is the ceiling written into the
 * relief slot. On a low-slab filer that over-relieved by 20× and spilled over
 * to erase unrelated capital-gains tax.
 *
 * `taxOnProfitAtAvgRate` must be apportioned at the **average** rate, not the
 * marginal one: tax on a component of a single progressive base apportions at
 * the average rate. (Same method the teacher reduction already uses.)
 *
 * Reference case: profit 1,000,000 within a 11,200,000 base taxed at an average
 * 27.6875% → tax on profit 276,875, ceiling 50,000, **relief 226,875**.
 * Low-slab case: profit 500,000, tax on profit 1,250 → ceiling 25,000 is not
 * breached → **relief 0** (the app granted 25,000).
 *
 * @param {number} profit                 Behbood certificate profit
 * @param {number} taxOnProfitAtAvgRate   profit × (normal tax / taxable income)
 * @param {object} rates
 * @returns {number} rupees, never negative
 */
function behboodReliefCl6(profit, taxOnProfitAtAvgRate, rates) {
  const p = toAmount(profit);
  if (p <= 0) return 0;
  const ceilingRate = rateOf(rates, 'reductions', 'behbood_certificate_max_rate', 'rate');
  const ceiling = p * ceilingRate;
  const charged = toAmount(taxOnProfitAtAvgRate);
  return round2(Math.max(0, charged - ceiling));
}

// ── s.4C — super tax on high earning persons ─────────────────────────────────

/**
 * Super tax u/s 4C: a flat rate on the whole of the income, by tier.
 *
 * THE BUG THIS REPLACES: the previous implementation tested
 * `income >= b.minIncome && income <= b.maxIncome` against tiers seeded as
 * `[150,000,001 … 200,000,000]`, `[200,000,001 … 250,000,000]`, … Any income
 * landing in the one-rupee gap between a tier's max and the next tier's min
 * matched no bracket and fell through to `return 0`. **Rs 200,000,000.75
 * produced Rs 0 super tax where Rs 200,000,000.00 produced Rs 2,000,000** — 75
 * paisa erased Rs 32,000,000 across the whole schedule.
 *
 * THE FIX: the seeded `min_amount` is the integer-rupee spelling of the
 * statutory "where income **exceeds** X". So the real lower bound of a tier is
 * `min_amount − 1`, **exclusive**. Walking the tiers in ascending order and
 * keeping the highest one whose lower bound has been cleared is continuous over
 * the entire real line and monotonic in income, with no gaps to fall into.
 *
 * Boundary behaviour, all deliberate:
 *   150,000,000.00 → no tier (does not exceed 150M) → 0
 *   150,000,000.75 → tier_1 @ 1%
 *   200,000,000.00 → tier_1 @ 1%   (does not yet exceed 200M)
 *   200,000,000.50 → tier_2 @ 2%
 *
 * @param {number} income  taxable income including capital gains
 * @param {object} rates
 * @returns {number} rupees, rounded
 */
function superTaxU4C(income, rates) {
  const amount = toAmount(income);
  if (amount <= 0) return 0;

  const brackets = rates && rates.superTax;
  if (!Array.isArray(brackets) || brackets.length === 0) {
    throw new Error('statutoryLimits: no super_tax brackets configured in tax_rates_config.');
  }

  const ascending = [...brackets].sort((a, b) => Number(a.minIncome) - Number(b.minIncome));

  let selected = null;
  for (const b of ascending) {
    const lowerExclusive = Number(b.minIncome) - 1; // "where income exceeds X"
    if (amount > lowerExclusive) selected = b;
    else break; // ascending — nothing further can qualify
  }

  if (!selected) return 0;
  return Math.round(amount * Number(selected.rate));
}

// ── bound-per-tax-year factory ───────────────────────────────────────────────

/**
 * Load the rate bundle for a tax year once and return the six limit functions
 * bound to it, each with exactly the signature named in the remediation
 * contract. The returned functions are pure and synchronous.
 *
 * @param {string} taxYear e.g. '2025-26'
 * @returns {Promise<object>}
 */
async function forTaxYear(taxYear) {
  const rates = await TaxRateService.getAllRates(taxYear);
  return bindRates(rates);
}

/** Same as `forTaxYear` but for a bundle you already hold. Pure. */
function bindRates(rates) {
  return {
    rates,
    capDonationU61: (taxableIncome, isAssociate) =>
      capDonationU61(taxableIncome, isAssociate, rates),
    capPensionU63: (taxableIncome) => capPensionU63(taxableIncome, rates),
    capEducationU60D: (taxableIncome, children, tuitionFeePaid) =>
      capEducationU60D(taxableIncome, children, tuitionFeePaid, rates),
    capProfessionalU60C: (taxableIncome, posAmount) =>
      capProfessionalU60C(taxableIncome, posAmount, rates),
    capHousingLoanProfitCredit: (taxableIncome, profitPaid) =>
      capHousingLoanProfitCredit(taxableIncome, profitPaid, rates),
    housingLoanCreditConfigured: () => housingLoanCreditConfigured(rates),
    behboodReliefCl6: (profit, taxOnProfitAtAvgRate) =>
      behboodReliefCl6(profit, taxOnProfitAtAvgRate, rates),
    superTaxU4C: (income) => superTaxU4C(income, rates),
  };
}

module.exports = {
  forTaxYear,
  bindRates,
  capDonationU61,
  capPensionU63,
  capEducationU60D,
  capProfessionalU60C,
  capHousingLoanProfitCredit,
  housingLoanCreditConfigured,
  behboodReliefCl6,
  superTaxU4C,
  // exported for the write-path middleware and its tests
  toAmount,
  round2,
};
