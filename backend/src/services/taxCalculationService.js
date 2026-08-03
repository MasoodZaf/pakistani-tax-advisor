/**
 * Tax Calculation Service — orchestrates cross-form computation.
 *
 * All rates come from DB via TaxRateService (year-versioned, no hardcoded fallbacks).
 * Pure-math primitives live in CalculationService.
 *
 * Two entry points:
 *   - calculateTaxComputation(userId, taxYear)   — reads saved form data from DB
 *   - previewTaxComputation(userId, taxYear, in) — same math, but input comes from
 *                                                  unsaved form data (for UI preview)
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');
const CalculationService = require('./calculationService');
const TaxRateService = require('./taxRateService');
const { superTaxU4C, surchargeU4AB, reliefCeiling: reliefCeilingFor } = require('../helpers/statutoryLimits');
const { getGeneratedTotalComponents } = require('../helpers/tableColumns');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Clamp to a non-negative finite number. Used on every client-supplied figure. */
const nonNeg = (v) => Math.max(0, toNum(v));

/** Round to whole paisa. Money never carries float dust out of this service. */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Pick between two column names that are two dialects of the SAME field
 * (e.g. `zakat_paid_amount` (modern) vs `zakat` (legacy)). Returns the first
 * non-zero one so a row written in either dialect reads back correctly.
 *
 * This is deliberately NOT used across different heads of relief — doing that
 * is what made the deduction total non-monotonic (see `deductibleAllowances`).
 */
const pickDialect = (...vals) => {
  for (const v of vals) {
    const n = toNum(v);
    if (n !== 0) return n;
  }
  return 0;
};

/**
 * s.7B limit. Profit on debt up to this amount is a separate block charged at a
 * final rate; above it, the profit is chargeable at normal slab rates. Read the
 * bound from the rate row when it carries a real one, otherwise fall back to the
 * statutory Rs 5,000,000 that the column names themselves encode
 * (`interest_income_profit_debt_7b_up_to_5m`). Not a rate — a statutory bound.
 */
const S7B_DEFAULT_LIMIT = 5_000_000;
const SENTINEL_UNBOUNDED = 1e11; // seeds use 999999999999 to mean "no upper bound"

/**
 * The component columns that make up each relief total, read from the GENERATED
 * total's own definition in the live schema.
 *
 * Why the engine needs these, and not just the total.
 *
 * The engine used to subtract a retired relief from the total it was handed:
 * `claimedReductions = declaredTotal − staleTeacherRebate`. That is only sound
 * if the total actually CONTAINS the stale head, and nothing guaranteed it did.
 * A preview posting `{ teacher_researcher_tax_reduction: 671422 }` with no total
 * key produced `claimedReductions = −671,422`, and since the bound on relief is
 * deliberately one-sided (a negative total is an add-back and must raise tax),
 * that landed as a Rs 671,422 OVER-CHARGE with no error and no flag. The stored
 * path escaped only because `total_reductions` is GENERATED over exactly those
 * components — a schema coincidence, not a check.
 *
 * Summing the components and simply omitting the retired heads removes the whole
 * class: there is no subtraction to get wrong. The names come from the database
 * so they cannot drift from it (the same reasoning as
 * `getGeneratedTotalComponents` in the middleware), and the lookup is cached per
 * process, so this costs one query per boot.
 *
 * Resolution failure is not fatal — the engine falls back to the declared total
 * with a bounded removal. A schema surprise must not stop a taxpayer computing
 * their return.
 */
async function resolveReliefComponents() {
  try {
    const [credits, reductions] = await Promise.all([
      getGeneratedTotalComponents('credits_forms', 'total_credits'),
      getGeneratedTotalComponents('reductions_forms', 'total_reductions'),
    ]);
    return { credits, reductions };
  } catch (err) {
    logger.warn('Relief component columns could not be resolved; falling back to declared totals', {
      message: err.message,
    });
    return null;
  }
}

/**
 * The relief total, preferring the sum of components over the declared total.
 *
 * `excluded` heads are dropped rather than subtracted — see
 * resolveReliefComponents() for why that distinction is the entire fix.
 *
 * When components cannot be resolved, or the row carries a total but none of the
 * component keys (a summary-only payload), the declared total is used and the
 * removal is bounded by it, so the result can never be pushed below zero by a
 * head the total never included.
 */
function reliefTotalFromComponents(data, components, declaredTotal, excludedFields) {
  const row = data || {};
  const excluded = new Set(excludedFields);
  let removed = 0;
  for (const field of excluded) {
    const stale = toNum(row[field]);
    if (stale > 0) removed += stale;
  }

  const usable = Array.isArray(components)
    ? components.filter((c) => Object.prototype.hasOwnProperty.call(row, c))
    : [];

  if (usable.length > 0) {
    const sum = usable
      .filter((c) => !excluded.has(c))
      .reduce((s, c) => s + toNum(row[c]), 0);
    return { total: round2(sum), removed: round2(removed), source: 'components' };
  }

  // Total-only payload: a head that is not present cannot be removed from it.
  const bounded = Math.min(removed, Math.max(0, toNum(declaredTotal)));
  return {
    total: round2(toNum(declaredTotal) - bounded),
    removed: round2(bounded),
    source: 'declared_total',
  };
}

/**
 * The configured s.7B / s.151 rate row for profit on debt.
 *
 * IT WAS LOOKED UP UNDER A NAME NOTHING EVER SEEDS. The engine asked for
 * `final_tax/profit_debt_15_final`; the only migration that mentions that
 * category (`phase-b`) UPDATEs it, and no migration anywhere INSERTs it. So the
 * lookup returned undefined on every environment, the "fail loud and leave it in
 * the slab base" fallback fired on every return, and the separate-block treatment
 * this file implements — with its own tests — has never once been active in
 * production.
 *
 * The consequence is a live OVER-CHARGE, and the fallback's own comment says so:
 * a filer on a 35% marginal rate with Rs 2,200,000 of bank profit paid roughly
 * Rs 770,000 of slab tax where the configured 20% final rate charges Rs 440,000.
 * It was invisible because the fallback is by design the safe direction — it
 * never under-states, so nobody complains.
 *
 * `phase-j-final-tax-rate-seeds.sql` seeds the real row as
 * `profit_debt_151_up_to_5m` (0.20, maxAmount 5,000,000, cited to s.151), which
 * is the same charge under its statutory name. Both names are tried, historical
 * first, so an environment that has either one works and the fail-loud path is
 * kept for an environment that genuinely has neither.
 */
const s7bRateRow = (finalTaxRates) =>
  finalTaxRates?.profit_debt_15_final || finalTaxRates?.profit_debt_151_up_to_5m || null;

/** Category names tried, for the error message when none is configured. */
const S7B_RATE_CATEGORIES = 'profit_debt_15_final / profit_debt_151_up_to_5m';

const resolveS7bLimit = (finalTaxRates) => {
  const max = toNum(s7bRateRow(finalTaxRates)?.maxAmount);
  return max > 0 && max < SENTINEL_UNBOUNDED ? max : S7B_DEFAULT_LIMIT;
};

class TaxCalculationService {
  // Kept for backwards-compatibility with routes that call it directly.
  static async resolveTaxYearId(taxYear) {
    return TaxRateService.resolveTaxYearId(taxYear);
  }

  // ──────── DB-backed form reads ────────

  static async getIncomeFormData(userId, taxYear) {
    const result = await pool.query(
      `SELECT
        annual_basic_salary, allowances, bonus, medical_allowance,
        pension_from_ex_employer, employment_termination_payment,
        retirement_from_approved_funds, directorship_fee,
        other_cash_benefits, employer_contribution_provident,
        taxable_car_value, other_taxable_subsidies,
        profit_on_debt_15_percent, profit_on_debt_12_5_percent,
        other_taxable_income_rent, other_taxable_income_others,
        income_exempt_from_tax           AS b15_income_exempt_from_tax,
        annual_salary_wages_total        AS b16_annual_salary_wages_total,
        non_cash_benefit_exempt          AS b22_non_cash_benefit_exempt,
        total_non_cash_benefits          AS b23_total_non_cash_benefits,
        other_income_min_tax_total       AS b28_other_income_min_tax_total,
        other_income_no_min_tax_total    AS b33_other_income_no_min_tax_total,
        total_employment_income,
        updated_at
      FROM income_forms
      WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return result.rows[0] || null;
  }

  static async getAdjustableFormData(userId, taxYear) {
    const incomeData = await this.getIncomeFormData(userId, taxYear);

    const result = await pool.query(
      `SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    const adjustableData = result.rows[0] || {};

    // Inter-form linking from income_forms (Excel cross-sheet references).
    if (incomeData) {
      adjustableData.salary_employees_149_gross_receipt = incomeData.b16_annual_salary_wages_total;
      adjustableData.directorship_fee_149_3_gross_receipt = incomeData.directorship_fee;
      adjustableData.profit_debt_15_percent_gross_receipt = incomeData.profit_on_debt_15_percent;
      adjustableData.sukook_12_5_percent_gross_receipt = incomeData.profit_on_debt_12_5_percent;
      adjustableData.rent_section_155_gross_receipt = incomeData.other_taxable_income_rent;
    }
    return adjustableData;
  }

  static async getCapitalGainsData(userId, taxYear) {
    const result = await pool.query(
      `SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return result.rows[0] || null;
  }

  static async getReductionsData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  static async getCreditsData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  static async getDeductionsData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  static async getFinalMinIncomeData(userId, taxYear) {
    const r = await pool.query(
      `SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2`,
      [userId, taxYear]
    );
    return r.rows[0] || null;
  }

  // ──────── Core compute ────────

  /**
   * Run the full tax computation for a user + tax_year using DB-stored inputs.
   * Returns the structured breakdown the frontend renders.
   */
  static async calculateTaxComputation(userId, taxYear) {
    logger.info(`Tax computation run: user=${userId} year=${taxYear}`);

    const [incomeData, adjustableData, capitalGainsData, reductionsData, creditsData, deductionsData, finalMinData, rates] =
      await Promise.all([
        this.getIncomeFormData(userId, taxYear),
        this.getAdjustableFormData(userId, taxYear),
        this.getCapitalGainsData(userId, taxYear),
        this.getReductionsData(userId, taxYear),
        this.getCreditsData(userId, taxYear),
        this.getDeductionsData(userId, taxYear),
        this.getFinalMinIncomeData(userId, taxYear),
        TaxRateService.getAllRates(taxYear),
      ]);

    if (!incomeData) {
      throw new Error('Income form data not found — required for tax computation');
    }

    return this._computeFromInputs({
      incomeData,
      adjustableData,
      capitalGainsData,
      reductionsData,
      creditsData,
      deductionsData,
      finalMinData,
      rates,
      taxYear,
      reliefComponents: await resolveReliefComponents(),
    });
  }

  /**
   * Preview: same math, but caller provides in-flight (unsaved) form values.
   * The frontend uses this to render the computation summary live as the user types.
   * `inputs` is shaped like { income, adjustable_tax, capital_gain, reductions,
   * credits, deductions, final_min_income, final_tax } — each a plain object of
   * field -> value (the same shape saved to the DB).
   */
  static async previewTaxComputation(taxYear, inputs = {}) {
    const rates = await TaxRateService.getAllRates(taxYear);

    const incomeData = inputs.income || {};
    const adjustableData = inputs.adjustable_tax || {};
    const capitalGainsData = inputs.capital_gain || {};
    const reductionsData = inputs.reductions || {};
    const creditsData = inputs.credits || {};
    const deductionsData = inputs.deductions || {};

    // Normalize: preview inputs use snake_case DB names directly; derive the
    // bN_* aliases the compute function expects, matching getIncomeFormData.
    const incomeWithAliases = {
      ...incomeData,
      b15_income_exempt_from_tax: incomeData.income_exempt_from_tax,
      b16_annual_salary_wages_total: incomeData.annual_salary_wages_total,
      b22_non_cash_benefit_exempt: incomeData.non_cash_benefit_exempt,
      b23_total_non_cash_benefits: incomeData.total_non_cash_benefits,
      b28_other_income_min_tax_total: incomeData.other_income_min_tax_total,
      b33_other_income_no_min_tax_total: incomeData.other_income_no_min_tax_total,
    };

    return this._computeFromInputs({
      incomeData: incomeWithAliases,
      adjustableData,
      capitalGainsData,
      reductionsData,
      creditsData,
      deductionsData,
      finalMinData: inputs.final_min_income || {},
      rates,
      taxYear,
      preview: true,
      reliefComponents: await resolveReliefComponents(),
    });
  }

  /**
   * Pure function: takes all inputs + rates, returns the breakdown.
   * Does NOT touch DB. Callable from both the saved-run and preview paths.
   */
  static _computeFromInputs({
    incomeData,
    adjustableData,
    capitalGainsData,
    reductionsData,
    creditsData,
    deductionsData,
    finalMinData = {},
    rates,
    taxYear,
    preview = false,
    reliefComponents = null,
  }) {
    // ── Income buckets ──
    const incomeFromSalary =
      toNum(incomeData?.b16_annual_salary_wages_total) + toNum(incomeData?.b23_total_non_cash_benefits);

    // Profit on debt (s.7B). `b28_other_income_min_tax_total` is a GENERATED
    // column = profit_on_debt_15_percent + profit_on_debt_12_5_percent
    // (phase-t-realign-form-tables.sql:129). Up to the s.7B limit this is a
    // SEPARATE BLOCK charged at a final rate — it must NOT enter the slab base.
    // It previously did, which slab-taxed an ordinary saver's bank profit:
    // salary 3,000,000 + profit 1,000,000 was charged 586,000 (slab on the full
    // 4,000,000) where the law charges 300,000 on the salary and takes the
    // profit at the final rate. Above the limit the profit IS chargeable at
    // normal rates, so the conversion is bounded, not blanket.
    const profitOnDebtDeclared = pickDialect(
      incomeData?.b28_other_income_min_tax_total,
      toNum(incomeData?.profit_on_debt_15_percent) + toNum(incomeData?.profit_on_debt_12_5_percent)
    );
    const otherIncomeNormal = toNum(incomeData?.b33_other_income_no_min_tax_total);

    const s7bLimit = resolveS7bLimit(rates?.finalTax);
    const s7bRateCfg = s7bRateRow(rates?.finalTax);
    const s7bRate = toNum(s7bRateCfg?.rate);

    // Only treat the block as final-taxed when we actually have a configured
    // rate. Without one we would zero-rate real income — so fail loud and leave
    // it in the slab base (over-charging, but never silently under-stating).
    const s7bRateAvailable = s7bRate > 0;
    if (!s7bRateAvailable && profitOnDebtDeclared > 0) {
      logger.error(
        `final_tax rate (${S7B_RATE_CATEGORIES}) is not configured — profit on debt ` +
        'is being charged at slab rates as a fail-loud fallback, which OVER-charges. ' +
        'Apply phase-j-final-tax-rate-seeds.sql.',
        { taxYear, profitOnDebtDeclared }
      );
    }

    const profitOnDebtIsFinal =
      s7bRateAvailable && profitOnDebtDeclared > 0 && profitOnDebtDeclared <= s7bLimit;

    // De-duplicate against the Final/Min form: if the taxpayer also declared the
    // same 7B receipt there, that stream already charges it (see
    // finalMinTaxChargeable below) and we must not charge it twice.
    const s7bAlsoOnFinalMinForm = nonNeg(finalMinData?.interest_income_profit_debt_7b_up_to_5m);
    const profitOnDebtFinalBase = profitOnDebtIsFinal
      ? Math.max(0, profitOnDebtDeclared - s7bAlsoOnFinalMinForm)
      : 0;
    const profitOnDebtFinalTax = Math.round(profitOnDebtFinalBase * s7bRate);

    // Profit on debt only joins the normal (slab) base when it is NOT final.
    const profitOnDebtInNormalBase = profitOnDebtIsFinal ? 0 : profitOnDebtDeclared;
    const incomeFromOtherSources = profitOnDebtInNormalBase + otherIncomeNormal;
    const incomeFromCapitalGains = toNum(capitalGainsData?.total_capital_gain);

    const totalIncome = incomeFromSalary + incomeFromOtherSources + incomeFromCapitalGains;

    // ── Deductible allowances (s.60 series — these reduce TAXABLE INCOME) ──
    // SCHEMA NOTE, verified against the DDL that created the live table
    // (backend/database/migrations/phase-t-realign-form-tables.sql:431,435).
    // The previous comment here claimed the generated column "already sums
    // zakat + ushr + professional expenses + education + other". That was FALSE
    // — it was written against a schema that does not exist. What is really there:
    //
    //   total_deductions          GENERATED = educational_expenses_amount
    //                                       + zakat_paid_amount + ushr
    //                                       + tax_paid_foreign_country
    //                                       + advance_tax + other_deductions
    //   total_deduction_from_income  PLAIN, client-writable NUMERIC DEFAULT 0
    //
    // Three defects followed from reading those:
    //  1. `total_deductions` EXCLUDES professional_expenses_amount. The old
    //     `||` chain preferred it and only fell through to the component sum
    //     when it was 0 — so professional expenses deducted in full when they
    //     were the only head and were SILENTLY DROPPED as soon as any other
    //     head was non-zero. That made the tax function NON-MONOTONIC IN
    //     DEDUCTIONS: adding Rs 100,000 of legitimate education expense RAISED
    //     tax from Rs 0 to Rs 17,000. Adding a lawful deduction must never
    //     increase tax.
    //  2. `total_deduction_from_income` is not a derived total at all — it is a
    //     plain column any caller can post, and it was read FIRST. Never trust it.
    //  3. `total_deductions` INCLUDES tax_paid_foreign_country and advance_tax,
    //     which are credits/payments against LIABILITY, not deductions from
    //     INCOME. Subtracting them from taxable income is over-relief.
    //
    // So: always sum the components, explicitly, and only the ones that are
    // genuinely deductions from income. Statutory caps on each head are enforced
    // on the write path (lane A); this function must stay monotonic regardless.
    const deductionZakat = pickDialect(deductionsData?.zakat_paid_amount, deductionsData?.zakat);
    const deductionUshr = nonNeg(deductionsData?.ushr);
    // "Professional expenses in respect of a POS" is deducted ONLY while the
    // relief is configured. phase-z19 retired it (cited s.60C, which was the
    // profit-on-debt allowance, omitted by Finance Act 2022, and never covered
    // these expenses). Gating on the rate config rather than deleting the term
    // does two things: rows saved BEFORE the retirement stop being relieved
    // (otherwise every existing taxpayer keeps the unlawful deduction until they
    // happen to re-save), and reactivation stays a config change if the owner's
    // tax counsel identifies a basis we could not find.
    const professionalReliefConfigured = Boolean(
      rates?.deductionThresholds?.prof_expenses_max_taxable_income
    );
    const professionalClaimed = nonNeg(deductionsData?.professional_expenses_amount);
    const deductionProfessional = professionalReliefConfigured ? professionalClaimed : 0;
    const deductionEducational = pickDialect(
      deductionsData?.educational_expenses_amount,
      deductionsData?.education_expense_amount
    );
    const deductionOther = nonNeg(deductionsData?.other_deductions);

    const deductibleAllowances =
      deductionZakat + deductionUshr + deductionProfessional + deductionEducational + deductionOther;

    // These two sit on the deductions form but are NOT deductions from income.
    // The generated column lumped them in, which over-relieved income. Removing
    // them is only half the fix: dropping them entirely would leave a taxpayer
    // who paid foreign tax with no relief ANYWHERE — worse than the original
    // bug, which at least gave them something. So each is re-homed below to
    // where it actually belongs, and surfaced here so the reclassification is
    // explicit rather than implicit:
    //   tax_paid_foreign_country -> a CREDIT against tax payable (relief for
    //                               tax already suffered abroad)
    //   advance_tax              -> a PAYMENT already made, against the final
    //                               balance, NOT a credit
    // The distinction matters: treating a payment as a credit would understate
    // tax chargeable while still crediting the payment — counting it twice.
    const foreignTaxCredit = nonNeg(deductionsData?.tax_paid_foreign_country);
    const advanceTaxOnDeductionsForm = nonNeg(deductionsData?.advance_tax);

    const reclassifiedFromDeductions = {
      taxPaidForeignCountry: foreignTaxCredit,
      advanceTaxOnDeductionsForm,
      // Non-zero only where a legacy row still carries a figure for the retired
      // "professional expenses" relief. Surfaced rather than silently dropped, so
      // the figure the taxpayer entered is visible and explainable instead of
      // quietly vanishing from their computation.
      professionalExpensesUnrelieved: professionalReliefConfigured ? 0 : professionalClaimed,
    };

    const taxableIncomeExcludingCG = Math.max(0, totalIncome - incomeFromCapitalGains - deductibleAllowances);
    const taxableIncomeIncludingCG = taxableIncomeExcludingCG + incomeFromCapitalGains;

    // ── Progressive normal tax ──
    const normalIncomeTax = CalculationService.calculateProgressiveTax(
      taxableIncomeExcludingCG,
      rates.slabs
    );

    // ── Surcharge: DB-driven rate + threshold ──
    // s.4AB. Shared with the save-path gate so the ceiling relief is measured
    // against is computed in exactly one place (statutoryLimits.surchargeU4AB).
    const surcharge = surchargeU4AB(taxableIncomeExcludingCG, normalIncomeTax, rates);

    // ── CGT ──
    // Previously this read three candidate stored fields and got 0 from all
    // three, so capital gains were charged nothing. Why each one is empty:
    //   * `capital_gains_tax_chargeable` — a PLAIN client-writable column
    //     (DEFAULT 0) that the modern form does not populate; and being
    //     client-writable it is not a figure the server may trust anyway.
    //   * `total_capital_gains_tax`  — GENERATED, but only over the LEGACY
    //     columns (property_1_year, property_2_3_years, securities,
    //     other_capital_gains_tax). The modern form writes the
    //     `<class>_taxable` columns instead, which that expression never reads
    //     — while `total_capital_gain` (the income figure, used above) DOES
    //     read them. Hence gains present, tax zero.
    //   * `total_capital_gain_tax` — never existed as a column at all.
    //
    // Compute the charge instead, from the per-class taxable amounts at
    // DB-driven rates. Every `capital_gains` rate_category in tax_rates_config
    // is named to match a `<rate_category>_taxable` column on
    // capital_gain_forms 1:1, so this stays correct as classes are added and
    // never hardcodes a rate.
    const capitalGainsTax = (() => {
      const cg = capitalGainsData || {};
      const cgRates = rates?.capitalGains || {};
      let computed = 0;
      let matchedClasses = 0;

      for (const [category, cfg] of Object.entries(cgRates)) {
        const amount = nonNeg(cg[`${category}_taxable`]);
        if (amount === 0) continue;
        matchedClasses += 1;
        computed += amount * toNum(cfg?.rate);
      }

      if (matchedClasses > 0) return Math.round(computed);

      // Legacy rows that predate the per-class columns. Refusing these outright
      // would silently zero a real CGT charge, so they still fall through —
      // clamped, and only when no per-class data exists to compute from.
      // Trusting a client-written figure is a WRITE-path concern; the engine
      // must not turn it into a silent under-statement here.
      return Math.round(
        nonNeg(cg.capital_gains_tax_chargeable) || nonNeg(cg.total_capital_gains_tax)
      );
    })();

    const totalTaxBeforeAdjustments = normalIncomeTax + surcharge + capitalGainsTax;

    // ── Reductions and credits — BOUNDED BY THE TAX THEY OFFSET ──
    //
    // This is the authoritative bound, and it is here rather than only on the
    // write path for two reasons.
    //
    // 1. The write path can be bypassed, and was. QA posted straight to
    //    /api/tax-forms/credits and to the preview endpoint; whatever the save
    //    middleware does, THIS function produces the number that reaches the
    //    return, so this is where the guarantee has to hold.
    // 2. Save-time clamping cannot be complete on its own. Forms are filled in
    //    any order, so a credit saved before the income form has no measurable
    //    ceiling. The save path deliberately defers in that case (R-01: it used
    //    to write zeros and never restore them) — which is only safe because
    //    the bound below always runs.
    //
    // The rule needs no statute: relief EXTINGUISHES tax. It cannot exceed the
    // tax in charge, and it can never pay money out. A refund arises only from
    // tax actually paid — withholding, advance tax — which is handled much
    // further down and is unaffected by this.
    //
    // `Math.max(0, ...)` below is NOT this bound. It silently truncates the
    // result to zero while leaving the over-claim invisible, so a Rs 9,000,000
    // "surrender tax credit" against a Rs 3,101,000 liability looked identical
    // to a lawful full extinguishment. The excess is now refused explicitly and
    // reported, so it shows up on the return instead of vanishing.
    // ── A RETIRED RELIEF MUST BE REFUSED HERE TOO, NOT ONLY ON SAVE ──
    //
    // Deactivating the teacher/researcher rate row stopped NEW claims, and the
    // save path refuses the field when it is posted. Neither touches a figure
    // ALREADY SITTING IN THE ROW from before the retirement — and the save clamp
    // cannot, because it only ever sees fields the client actually sends.
    //
    // Staging's untouched baseline proved the gap: `teacher_researcher_tax_
    // reduction = 671,422` with the rate inactive for 2025-26, and the engine
    // applied every rupee of an expired rebate with `refusedReductions: 0`.
    // Every existing return carrying the old figure was understated until it
    // happened to be re-saved.
    //
    // So the engine subtracts the heads whose relief no longer exists for the
    // year being computed, from the total it was handed. Derived from
    // `tax_rates_config`, so answering one of the open legal questions in
    // Admin -> Statutory Reliefs takes effect on stored returns immediately.
    const retiredReliefHeads = [];
    if (!(Number(rates?.reductions?.teacher_researcher?.rate) > 0)) {
      retiredReliefHeads.push({
        field: 'teacher_researcher_tax_reduction',
        reason:
          '2nd Sched Pt III cl.(3A) — the 25% teacher/researcher rebate ceased to have effect '
          + 'after 30-Jun-2025',
      });
    }

    for (const head of retiredReliefHeads) {
      const stale = toNum(reductionsData?.[head.field]);
      if (stale > 0) {
        logger.warn('Retired relief removed from a stored return at computation', {
          taxYear,
          field: head.field,
          amount: stale,
          reason: head.reason,
        });
      }
    }

    const reductionsTotal = reliefTotalFromComponents(
      reductionsData,
      reliefComponents?.reductions,
      pickDialect(reductionsData?.total_tax_reductions, reductionsData?.total_reductions),
      retiredReliefHeads.map((h) => h.field)
    );
    const claimedReductions = reductionsTotal.total;
    const retiredReductionsRemoved = reductionsTotal.removed;

    const creditsTotal = reliefTotalFromComponents(
      creditsData,
      reliefComponents?.credits,
      pickDialect(creditsData?.total_tax_credits, creditsData?.total_credits),
      []
    );
    const claimedFormCredits = creditsTotal.total;

    // ── A NEGATIVE CREDIT TOTAL IS AN ADD-BACK AND MUST NOT BE FLOORED ──
    //
    // `nonNeg()` here was a Rs 500,000 UNDERSTATEMENT. Surrendering an
    // investment credit (shares disposed of inside the holding period) means the
    // credit already allowed goes back onto the tax payable, and the app records
    // that as a negative entry which makes the credit total negative. Flooring
    // the total at zero silently threw the add-back away: a stored
    // `total_credits` of −500,000 arrived here as 0, so the reversal did nothing
    // and no refusal was flagged anywhere. The write path was fixed to accept
    // and preserve the negative; this is where it was then discarded.
    //
    // So the bound is one-sided, and deliberately so:
    //   • a POSITIVE total is capped at the tax in charge (relief cannot exceed
    //     the tax, and cannot pay money out);
    //   • a NEGATIVE total passes through untouched and INCREASES the tax, which
    //     is the whole point of a reversal.
    // `Math.min` alone gives exactly that — a negative is already below the cap.
    //
    // ── THE CEILING IS THE NORMAL-INCOME BLOCK, NOT EVERY TAX IN THE RETURN ──
    //
    // It used to be `totalTaxBeforeAdjustments`, which includes capital gains tax.
    // Capital gains on securities and property are a SEPARATE block charged at
    // their own Division VIII/VII rates, and the reliefs this app knows about
    // (s.61/s.63 credits, the Behbood ceiling, the teacher rebate) all attach to
    // the normal-income charge. Letting them spill into the CGT block meant relief
    // the save path had already measured as unlawful was granted anyway, against a
    // charge it has nothing to do with: QA proved it with a Rs 2,000 normal charge
    // and a Rs 1,000,000 CGT charge, where every rupee of a 15,700 credit was
    // allowed. It also made the two gates disagree — the middleware bounds at the
    // normal-income tax, the engine bounded at 500× that.
    //
    // One ceiling, used by both: the tax on the normal-income block. Surcharge is
    // inside it (s.4AB charges 9% of the same Division I tax on the same income);
    // capital gains, super tax and the final-tax streams are outside it and are
    // therefore untouchable by relief.
    const reliefCeiling = reliefCeilingFor(taxableIncomeExcludingCG, normalIncomeTax, rates);

    // ── A NEGATIVE TOTAL RAISES TAX, SO IT NEEDS A CEILING OF ITS OWN ──
    //
    // The one-sided bound above is right, but "unbounded below" is not a bound.
    // A mistyped reversal of −1,000,000,000,000 was added to the tax in full and
    // produced a balance payable of Rs 1,000,007,767,340. The write path refuses
    // figures that large, but the preview endpoint reaches this function directly.
    //
    // A surrender adds back credit previously ALLOWED, and a credit allowed in any
    // year is at most the tax on that year's income — so it cannot credibly exceed
    // the income declared here. Same arithmetic reasoning as "a deduction cannot
    // exceed the income it is deducted from"; no statute needed, no guess.
    const addBackCeiling = Math.max(0, totalIncome);
    const boundAddBack = (claimed, label) => {
      const n = toNum(claimed);
      if (n >= -addBackCeiling) return n;
      logger.error('Relief add-back exceeds declared income and was refused', {
        taxYear,
        label,
        claimed: n,
        allowed: -addBackCeiling,
      });
      return -addBackCeiling;
    };

    const boundedReductions = boundAddBack(claimedReductions, 'reductions');
    const boundedCredits = boundAddBack(claimedFormCredits, 'credits');

    const totalReductions = Math.min(boundedReductions, reliefCeiling);
    const refusedReductions = round2(Math.max(0, toNum(claimedReductions) - totalReductions));

    // Headroom is measured against POSITIVE relief only. A negative reduction
    // total has increased the tax, so it must not also be treated as having
    // consumed the room a lawful credit could use.
    const creditHeadroom = Math.max(0, reliefCeiling - Math.max(0, totalReductions));
    const formCredits = Math.min(boundedCredits, creditHeadroom);
    const refusedCredits = round2(Math.max(0, toNum(claimedFormCredits) - formCredits));

    if (refusedReductions > 0 || refusedCredits > 0) {
      logger.warn('Relief claim exceeded the tax in charge and was refused at computation', {
        totalTaxBeforeAdjustments,
        claimedReductions,
        refusedReductions,
        claimedFormCredits,
        refusedCredits,
      });
    }

    // Foreign tax relief lands here, having been removed from the income-side
    // deduction total above. NOTE: s.103 caps this at the Pakistan tax
    // attributable to the foreign-source income, which cannot be computed —
    // the app captures the foreign tax PAID but never the foreign INCOME it was
    // paid on, so there is no base to apportion against. What CAN be said is
    // that s.103 relief, like every other relief, cannot exceed the Pakistan
    // tax still in charge; that much is applied here, and the missing
    // apportionment is recorded as a known gap rather than left silent.
    const foreignHeadroom = Math.max(0, creditHeadroom - Math.max(0, formCredits));
    const allowedForeignCredit = Math.min(nonNeg(foreignTaxCredit), foreignHeadroom);
    const refusedForeignCredit = round2(nonNeg(foreignTaxCredit) - allowedForeignCredit);

    const totalCredits = formCredits + allowedForeignCredit;

    const netTaxPayable = Math.max(0, totalTaxBeforeAdjustments - totalReductions - totalCredits);

    // ── Super tax u/s 4C ──
    // Delegated to lane A's shared helper rather than reimplemented here, per
    // the remediation contract's agreed signature `superTaxU4C(income, rates)`.
    //
    // The bug it fixes: the old loop matched on the CLOSED interval
    // [minIncome, maxIncome] and returned 0 when nothing matched, which broke
    // twice over — the seeds are 1 rupee apart (tier_1 ends 200,000,000,
    // tier_2 starts 200,000,001), so a non-integer income such as
    // 200,000,000.75 fell between them and was charged NOTHING; and a NULL top
    // bound became NaN, where `income <= NaN` is false, so the very highest
    // incomes fell through as well. The helper instead walks the tiers in
    // ascending order keeping the highest one whose exclusive lower bound the
    // income has cleared, which is continuous over the whole real line.
    const superTax = superTaxU4C(taxableIncomeIncludingCG, rates);

    // ── Final / fixed / min income tax — separate stream (dividends s.150,
    //   sukuk s.151(1A), profit-on-debt s.7B, prize bonds s.156, bonus
    //   shares s.236Z, salary arrears 12(7) at relevant rate, CG s.37A).
    //   For salaried scope these are final tax under their own sections,
    //   not minimum-tax variants of normal income — so they are ADDED to
    //   total tax chargeable, with the matching `*_tax_deducted` rows
    //   netting against the payments side.
    //   The `salary_u_s_12_7_*` row auto-populates from the salary WHT
    //   (s.149) and is already in adjustableData.total_tax_collected — so
    //   it's excluded from the final-min deducted sum to avoid a double-
    //   count of ~the whole salary WHT.
    // Use subtotal_tax_chargeable, which EXCLUDES capital gains. The Capital
    // Gains form's CGT is already added above as `capitalGainsTax`; the
    // Final/Min form auto-mirrors that same CGT into its
    // `capital_gain_tax_chargeable` row (FinalMinIncomeForm auto-populate), so
    // `grand_total_tax_chargeable` (= subtotal + capital_gain_tax_chargeable)
    // would double-count CGT for every capital-gains filer (audit UX-03).
    // Fall back to grand_total − capital_gain for rows predating the subtotal
    // column.
    const finalMinTaxChargeable = Math.max(
      0,
      finalMinData?.subtotal_tax_chargeable != null
        ? toNum(finalMinData.subtotal_tax_chargeable)
        : toNum(finalMinData?.grand_total_tax_chargeable) - toNum(finalMinData?.capital_gain_tax_chargeable)
    );
    // Each row is client-supplied; a negative "deduction" would inflate the
    // balance payable, so clamp per row rather than on the sum.
    //
    // `capital_gain_tax_deducted` is excluded for the same reason
    // `subtotal_tax_chargeable` excludes the CGT charge — and the schema already
    // draws exactly this line (`subtotal_tax_deducted` omits it,
    // `grand_total_tax_deducted` includes it). Leaving it in meant the two sides
    // of the final-tax cap below were measured on different bases: the charge
    // without capital gains, the withholding with. A filer with Rs 300,000 of
    // NCCPL-collected CGT and no other final-tax stream had all Rs 300,000
    // classified as a non-refundable excess and credited NOTHING, while the CGT
    // charge itself was still levied through `capitalGainsTax`. NCCPL collects
    // this on every brokerage account, so it was not an edge case.
    const FINAL_MIN_WITHHELD_EXCLUDED = new Set([
      'salary_u_s_12_7_tax_deducted', // already inside adjustableData.total_tax_collected
      'capital_gain_tax_deducted', // adjustable against the CGT charge, credited below
    ]);
    const finalMinTaxWithheld = Object.entries(finalMinData || {})
      .filter(([k]) => k.endsWith('_tax_deducted') && !FINAL_MIN_WITHHELD_EXCLUDED.has(k))
      .reduce((s, [, v]) => s + nonNeg(v), 0);

    // ── CGT WITHHELD IS ADJUSTABLE, AND WAS NEVER CREDITED AT ALL ──
    //
    // Capital gains tax collected at source (NCCPL on securities, the registrar
    // on property) is adjustable against the CGT charge, not a final tax. The
    // Capital Gains form has a `*_tax_deducted` column per class and the engine
    // read none of them, so the charge was levied and the tax already paid on it
    // was discarded — an over-charge of the whole withheld amount for every
    // filer with securities or property disposals.
    //
    // The Final/Min form mirrors the same figure into `capital_gain_tax_deducted`
    // (it auto-populates from the Gains form), so these are two surfaces asking
    // for the SAME money. Adding them would credit it twice. The Gains form is
    // canonical — it is the per-class declaration surface — with the mirrored row
    // as the fallback, exactly as advance tax u/s 147 is handled below.
    const capitalGainsWithheldOnGainsForm = Object.entries(capitalGainsData || {})
      .filter(([k]) => k.endsWith('_tax_deducted'))
      .reduce((s, [, v]) => s + nonNeg(v), 0);
    const capitalGainsTaxWithheld = pickDialect(
      capitalGainsWithheldOnGainsForm,
      nonNeg(finalMinData?.capital_gain_tax_deducted)
    );

    // ── EXCESS TAX ON A FINAL-TAX STREAM IS NOT REFUNDABLE ──
    //
    // Tax deducted under a FINAL tax regime discharges the liability on that
    // income and nothing more; it is not an advance payment against the rest of
    // the return. Crediting the whole of it produced a refund the taxpayer is
    // not entitled to: a chargeable amount of 700,000 against 1,050,000 withheld
    // gave `balancePayableRefundable: -600,000` where only the 250,000 of
    // ordinary adjustable withholding is refundable — a 350,000 overstatement,
    // and a refund claim to FBR that would not survive scrutiny.
    //
    // Only the portion matching the final-tax charge is credited here. The excess
    // is surfaced rather than dropped, because it is usually a data-entry error
    // worth showing the taxpayer (a figure entered on the wrong row), and
    // occasionally a genuine over-deduction to take up with the withholding agent.
    const finalMinTaxDeducted = Math.min(finalMinTaxWithheld, finalMinTaxChargeable);
    const finalMinTaxWithheldInExcess = round2(finalMinTaxWithheld - finalMinTaxDeducted);
    if (finalMinTaxWithheldInExcess > 0) {
      logger.warn('Final-tax withholding exceeds the final-tax charge; excess is not refundable', {
        taxYear,
        finalMinTaxChargeable,
        finalMinTaxWithheld,
        finalMinTaxWithheldInExcess,
      });
    }

    const totalTaxChargeable =
      netTaxPayable + superTax + finalMinTaxChargeable + profitOnDebtFinalTax;

    // ── Advance / withholding tax paid (pool every stream) ──
    // INTEGRITY BOUND (audit blocker: unbounded refund vector). Every figure
    // below is client-supplied and previously fed straight into an unfloored
    // subtraction, so a posted withholding of ~1e9 produced
    // balancePayableRefundable = -999,699,999: an unbounded refund claim.
    //
    // Note this is a DIFFERENT door from the over-cap-credit one. `netTaxPayable`
    // is already floored at Math.max(0, ...), which stops a credit from creating
    // a refund — and does nothing whatsoever for this path, because the refund is
    // produced downstream of that floor. Closing one leaves the other open.
    //
    // The fix is on the INPUTS, not the output: clamping the output to zero would
    // destroy legitimate refunds, which are ordinary for an over-withheld salaried
    // filer. Two bounds, both derived rather than arbitrary:
    //   1. A negative payment is never valid — clamp each to 0.
    //   2. Tax withheld cannot exceed the receipts it was withheld from. Credit
    //      at most the taxpayer's own declared gross receipts and record the
    //      excess instead of paying it out.
    // A genuine refund still flows through as a negative balance; only the
    // physically impossible portion is refused.
    const adjustableWHT = pickDialect(
      adjustableData?.total_tax_collected,
      adjustableData?.total_adjustable_tax
    );
    // Advance tax. A payment reduces the BALANCE, never the tax chargeable.
    //
    // These two columns are two surfaces asking for the SAME money, not two
    // separate payments. Both forms ask for advance tax, so a taxpayer entering
    // one payment on both is doing the natural thing — and summing them credited
    // it TWICE, inflating the refund with no bad intent required. Never add
    // them: take a canonical source and fall back.
    //
    // s.147 on the adjustable-tax form is canonical (it is the statutory
    // declaration surface for advance tax). The deductions-form column is used
    // only when the canonical one is absent, so a user who filled only that
    // form still gets credit. When both are present and DIFFER we take the
    // canonical figure and surface the discrepancy rather than silently
    // choosing — the same principle as reclassifiedFromDeductions.
    const advanceTaxS147 = nonNeg(adjustableData?.advance_tax_u_s_147);
    const advanceTax = pickDialect(advanceTaxS147, advanceTaxOnDeductionsForm);

    const advanceTaxDuplicateDeclaration =
      advanceTaxS147 > 0 && advanceTaxOnDeductionsForm > 0
        ? {
            canonicalS147: advanceTaxS147,
            deductionsForm: advanceTaxOnDeductionsForm,
            credited: advanceTax,
            differs: advanceTaxS147 !== advanceTaxOnDeductionsForm,
          }
        : null;

    if (advanceTaxDuplicateDeclaration?.differs) {
      logger.warn('Advance tax declared on both forms with different figures — crediting s.147', {
        taxYear,
        ...advanceTaxDuplicateDeclaration,
      });
    }
    const withholdingTax =
      nonNeg(adjustableWHT) + finalMinTaxDeducted + capitalGainsTaxWithheld;

    const declaredGrossReceipts =
      totalIncome + profitOnDebtFinalBase + nonNeg(finalMinData?.subtotal);
    const claimedPayments = withholdingTax + advanceTax;
    const creditablePayments = Math.min(claimedPayments, Math.max(0, declaredGrossReceipts));
    const rejectedPaymentClaim = claimedPayments - creditablePayments;

    if (rejectedPaymentClaim > 0) {
      logger.error('Withholding/advance claim exceeds declared gross receipts — excess refused', {
        taxYear,
        claimedPayments,
        declaredGrossReceipts,
        rejectedPaymentClaim,
      });
    }

    const balancePayableRefundable = totalTaxChargeable - creditablePayments;

    const breakdown = {
      taxYear,
      preview,
      income: {
        incomeFromSalary,
        incomeFromOtherSources,
        incomeFromCapitalGains,
        totalIncome,
        deductibleAllowances,
        reclassifiedFromDeductions,
        profitOnDebtDeclared,
        profitOnDebtFinalBase,
        profitOnDebtIsFinal,
        taxableIncomeExcludingCG,
        taxableIncomeIncludingCG,
      },
      tax: {
        normalIncomeTax,
        surcharge,
        capitalGainsTax,
        totalTaxBeforeAdjustments,
        // The ceiling every reduction and credit is measured against: the tax on
        // the normal-income block only. Reported so the return shows WHY relief
        // was refused, and so the figure can be reconciled against the save-time
        // gate, which uses the same base.
        reliefCeiling,
        totalReductions,
        formCredits,
        foreignTaxCredit,
        totalCredits,
        // What the taxpayer asked for versus what the tax in charge allowed.
        // Surfaced rather than silently truncated so an over-claim is visible
        // on the return instead of looking like a lawful nil liability.
        claimedReductions: round2(toNum(claimedReductions)),
        refusedReductions,
        // Relief the taxpayer's stored return still claims but the law no longer
        // grants for this year. Surfaced separately from `refusedReductions`
        // because the cause is different: not "too much", but "no longer exists".
        retiredReliefRemoved: round2(retiredReductionsRemoved),
        claimedCredits: round2(toNum(claimedFormCredits)),
        refusedCredits,
        // A reversal larger than the year's declared income is not credible and
        // is refused. Reported so it cannot be mistaken for a lawful add-back.
        refusedAddBack: round2(
          Math.max(0, boundedReductions - toNum(claimedReductions))
            + Math.max(0, boundedCredits - toNum(claimedFormCredits))
        ),
        refusedForeignCredit,
        netTaxPayable,
        superTax,
        finalMinTaxChargeable,
        profitOnDebtFinalTax,
        totalTaxChargeable,
      },
      payments: {
        adjustableWHT,
        finalMinTaxWithheld,
        finalMinTaxDeducted,
        finalMinTaxWithheldInExcess,
        capitalGainsTaxWithheld,
        withholdingTax,
        advanceTax,
        advanceTaxDuplicateDeclaration,
        claimedPayments,
        creditablePayments,
        rejectedPaymentClaim,
        balancePayableRefundable,
      },
      rates: {
        surchargeRate: rates.surcharge.rate,
        surchargeThreshold: rates.surcharge.threshold,
        slabCount: rates.slabs.length,
      },
    };

    logger.info('Tax computation produced', {
      taxYear,
      preview,
      totalIncome,
      normalIncomeTax,
      netTaxPayable,
      superTax,
      balancePayableRefundable,
    });

    return breakdown;
  }

  // ──────── Legacy methods kept for old route compatibility ────────

  /**
   * Mirror adjustable_tax_forms with values linked from income_forms.
   * Wraps ensureTaxReturn via the common helper.
   */
  static async updateAdjustableFormWithLinks(userId, taxYear) {
    const incomeData = await this.getIncomeFormData(userId, taxYear);
    if (!incomeData) {
      logger.warn('No income data found for adjustable tax linking', { userId, taxYear });
      return;
    }

    const taxYearId = await TaxRateService.resolveTaxYearId(taxYear);
    const userRow = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    const userEmail = userRow.rows[0]?.email || null;

    // adjustable_tax_forms.tax_return_id is NOT NULL — resolve the active
    // return for this user/year before writing.
    const returnRow = await pool.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2 LIMIT 1',
      [userId, taxYear]
    );
    const taxReturnId = returnRow.rows[0]?.id;
    if (!taxReturnId) {
      logger.warn('No tax_return found for adjustable tax linking', { userId, taxYear });
      return;
    }

    await pool.query(
      `INSERT INTO adjustable_tax_forms (
         tax_return_id, user_id, user_email, tax_year, tax_year_id,
         salary_employees_149_gross_receipt,
         directorship_fee_149_3_gross_receipt,
         profit_debt_151_15_gross_receipt,
         profit_debt_sukook_151a_gross_receipt,
         tax_deducted_rent_section_155_gross_receipt
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, tax_year) DO UPDATE SET
         salary_employees_149_gross_receipt          = EXCLUDED.salary_employees_149_gross_receipt,
         directorship_fee_149_3_gross_receipt        = EXCLUDED.directorship_fee_149_3_gross_receipt,
         profit_debt_151_15_gross_receipt            = EXCLUDED.profit_debt_151_15_gross_receipt,
         profit_debt_sukook_151a_gross_receipt       = EXCLUDED.profit_debt_sukook_151a_gross_receipt,
         tax_deducted_rent_section_155_gross_receipt = EXCLUDED.tax_deducted_rent_section_155_gross_receipt,
         updated_at = CURRENT_TIMESTAMP`,
      [
        taxReturnId,
        userId,
        userEmail,
        taxYear,
        taxYearId,
        incomeData.annual_salary_wages_total || incomeData.b16_annual_salary_wages_total || 0,
        incomeData.directorship_fee || 0,
        incomeData.profit_on_debt_15_percent || 0,
        incomeData.profit_on_debt_12_5_percent || 0,
        incomeData.other_taxable_income_rent || 0,
      ]
    );
  }

  static async getCompleteTaxSummary(userId, taxYear) {
    const [incomeData, adjustableData, capitalGainsData, taxComputation] = await Promise.all([
      this.getIncomeFormData(userId, taxYear),
      this.getAdjustableFormData(userId, taxYear),
      this.getCapitalGainsData(userId, taxYear),
      this.calculateTaxComputation(userId, taxYear),
    ]);

    return {
      userId,
      taxYear,
      incomeData,
      adjustableData,
      capitalGainsData,
      taxComputation,
      summary: {
        totalIncome: taxComputation.income.totalIncome,
        totalTax: taxComputation.tax.totalTaxChargeable,
        withholdingTax: taxComputation.payments.withholdingTax,
        balanceDue: taxComputation.payments.balancePayableRefundable,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

module.exports = TaxCalculationService;
