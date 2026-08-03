const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const TaxCalculationService = require('../services/taxCalculationService');
const auth = require('../middleware/auth'); // Use standard auth middleware

const router = express.Router();

// Validate any :taxYear segment up front (SEC-09).
router.param('taxYear', require('../middleware/validation').validateTaxYearParam);

// ---------------------------------------------------------------------------
// FBR acknowledgement-slip header derivation (R-03).
//
// The three header fields on the printed return — Tax Year, Period and Due
// Date — used to be hardcoded to the 2023-24 return. A PDF generated for
// 2025-26 therefore carried TY2024 headers wrapped around TY2025-26 figures:
// a document that contradicts itself is worse than no document, because a
// filer may hand it to FBR believing it describes the year on the cover.
//
// The one thing to get right here: Pakistan names a tax year after the
// calendar year in which it ENDS, not the one in which it starts. The app's
// internal string '2025-26' means the fiscal year 1-Jul-2025 → 30-Jun-2026,
// and FBR calls that "Tax Year 2026". Getting this backwards (stamping 2025)
// mislabels the return by a whole year and is the single most repeated
// mistake in this codebase — hence the explicit end-year arithmetic below
// instead of anything that reads the leading four digits and calls it done.
//
// Due date: for an individual filing a salary return under s.114(1), the
// statutory due date is 30 September following the close of the tax year,
// i.e. 30-Sep of the tax-year-end calendar year. (Extensions granted by FBR
// circular in a given year are not modelled — the slip shows the statutory
// date, which is what IRIS itself prints.)
//
// No fallback year. If the tax-year string cannot be parsed we throw, because
// the failure mode we are fixing IS a silent default: a wrong-but-plausible
// year on a statutory document is undetectable to the person holding it,
// whereas a failed download is obvious and gets reported.
const TAX_YEAR_STRING = /^(\d{4})-(\d{2}|\d{4})$/;

function deriveTaxYearHeader(taxYearString) {
  const raw = typeof taxYearString === 'string' ? taxYearString.trim() : '';
  const match = TAX_YEAR_STRING.exec(raw);
  if (!match) {
    throw new Error(
      `Cannot derive FBR return header: malformed tax year ${JSON.stringify(taxYearString)}. ` +
      'Expected "YYYY-YY" (e.g. "2025-26").'
    );
  }

  const startYear = Number(match[1]);
  // Two-digit suffixes inherit the start year's century, then roll forward if
  // that lands us before the start year ('1999-00' → 2000, not 1900).
  let endYear = match[2].length === 4
    ? Number(match[2])
    : Number(`${String(startYear).slice(0, 2)}${match[2]}`);
  if (match[2].length === 2 && endYear < startYear) endYear += 100;

  if (endYear !== startYear + 1) {
    throw new Error(
      `Cannot derive FBR return header: tax year ${JSON.stringify(taxYearString)} does not span ` +
      'exactly one fiscal year (1-Jul → 30-Jun of the following calendar year).'
    );
  }

  return {
    // What FBR calls the year — the LATER calendar year.
    taxYearLabel: String(endYear),
    period: `01-Jul-${startYear} - 30-Jun-${endYear}`,
    dueDate: `30-Sep-${endYear}`,
  };
}

// Get comprehensive tax calculation summary with proper calculations
// Build the canonical tax-calculation summary IN-PROCESS. Used by the route
// below AND the FBR PDF endpoint — the PDF used to HTTP self-call this route
// (PERF-02/BE-07), which added latency and risked a deadlock when the single
// event loop was saturated under deadline-season load.
async function buildTaxCalculationSummary(userId, taxYear) {
  try {
    logger.info(`Generating tax calculation summary for user ${userId}, tax year ${taxYear}`);

    // Get form data for this user and tax year (simplified approach)
    const incomeResult = await pool.query(
      'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    ).catch(err => {
      logger.warn('Error fetching income forms:', err.message);
      return { rows: [] };
    });

    const adjustableTaxResult = await pool.query(
      'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    ).catch(err => {
      logger.warn('Error fetching adjustable tax forms:', err.message);
      return { rows: [] };
    });

    const incomeData = incomeResult.rows[0] || null;
    const adjustableTaxData = adjustableTaxResult.rows[0] || null;

    // Calculate summary information
    const summary = {
      taxYear: taxYear,
      userId: userId,
      hasIncomeData: !!incomeData,
      hasAdjustableTaxData: !!adjustableTaxData,

      totalIncome: 0,
      totalWithholdingTax: 0,
      totalEmploymentIncome: 0,

      // Income breakdown
      incomeBreakdown: {},

      // Tax breakdown
      taxBreakdown: {}
    };

    // Add income data if available
    if (incomeData) {
      summary.totalEmploymentIncome = parseFloat(incomeData.total_employment_income || 0);
      summary.totalIncome += summary.totalEmploymentIncome;

      summary.incomeBreakdown = {
        annualBasicSalary: parseFloat(incomeData.annual_basic_salary || 0),
        allowances: parseFloat(incomeData.allowances || 0),
        directorshipFee: parseFloat(incomeData.directorship_fee || 0),
        bonus: parseFloat(incomeData.bonus || 0),
        totalEmploymentIncome: summary.totalEmploymentIncome
      };
    }

    // Add adjustable tax data if available
    if (adjustableTaxData) {
      summary.totalWithholdingTax = parseFloat(adjustableTaxData.directorship_fee_149_3_tax_collected || 0) +
                                   parseFloat(adjustableTaxData.profit_debt_151_15_tax_collected || 0);

      summary.taxBreakdown = {
        directorshipFeeTax: parseFloat(adjustableTaxData.directorship_fee_149_3_tax_collected || 0),
        profitDebtTax: parseFloat(adjustableTaxData.profit_debt_151_15_tax_collected || 0),
        totalWithholdingTax: summary.totalWithholdingTax
      };
    }

    // Canonical breakdown — reuses the same code path the Tax Computation
    // page and PDF builders depend on, so totals match across surfaces.
    //
    // Previously this catch fell back to an all-zeros shape so the report
    // tab still rendered. That made the PDF look "complete" while every
    // tax row showed Rs 0 — a critical correctness bug, since the user
    // would download what looks like a finished return and try to file it.
    //
    // Now we surface the failure in `computationError` so the PDF builder
    // can stamp an explicit warning instead of silently lying.
    let breakdown = null;
    let computationError = null;
    try {
      breakdown = await TaxCalculationService.calculateTaxComputation(userId, taxYear);
    } catch (err) {
      logger.error('Tax computation failed for summary endpoint', {
        error: err.message, stack: err.stack, userId, taxYear,
      });
      computationError = err.message || 'tax_computation_failed';
    }

    const grossIncome    = breakdown ? breakdown.income.totalIncome           : summary.totalIncome;
    const exemptIncome   = parseFloat(incomeData?.income_exempt_from_tax || 0) +
                           parseFloat(incomeData?.non_cash_benefit_exempt || 0);
    const balance        = breakdown ? breakdown.payments.balancePayableRefundable : 0;
    // `breakdown.finalTax` HAS NEVER EXISTED — the engine returns the final-tax
    // charge as `tax.finalMinTaxChargeable` plus the separate s.7B
    // `tax.profitOnDebtFinalTax`. So this read was `undefined || 0` on every
    // return ever generated, and the final-tax line reported nil while the same
    // amount was inside Tax Chargeable. It went unnoticed because the PDF had no
    // final-tax row to print it on until the Computations table was completed.
    const finalTax = breakdown
      ? parseFloat(breakdown.tax?.finalMinTaxChargeable || 0)
        + parseFloat(breakdown.tax?.profitOnDebtFinalTax || 0)
      : 0;

    const calculations = breakdown
      ? {
          // Canonical keys (used by the on-screen Reports panel + new code).
          grossIncome,
          exemptIncome,
          taxableIncome:        breakdown.income.taxableIncomeIncludingCG,
          capitalGain:          breakdown.income.incomeFromCapitalGains,
          // The income SPLIT, not just the total. The PDF used to label the whole
          // of gross income as "Income from Salary" (code 1000/1009) — so a filer
          // with rental or profit-on-debt income filed a return stating it was all
          // salary. That is a misdeclaration on the face of the document.
          incomeFromSalary:     breakdown.income.incomeFromSalary,
          incomeFromOtherSources: breakdown.income.incomeFromOtherSources,
          normalIncomeTax:      breakdown.tax.normalIncomeTax,
          surcharge:            breakdown.tax.surcharge,
          capitalGainsTax:      breakdown.tax.capitalGainsTax,
          totalReductions:      breakdown.tax.totalReductions,
          totalCredits:         breakdown.tax.totalCredits,
          netTaxPayable:        breakdown.tax.netTaxPayable,
          superTax:             breakdown.tax.superTax,
          taxChargeable:        breakdown.tax.totalTaxChargeable,
          withholdingTax:       breakdown.payments.withholdingTax,
          advanceTax:           breakdown.payments.advanceTax,
          totalTaxPaid:         breakdown.payments.withholdingTax + breakdown.payments.advanceTax,
          balancePayable:       Math.max(0,  balance),
          refundDue:            Math.max(0, -balance),
          taxDemanded:          Math.max(0,  balance),
          additionalTaxDue:     Math.max(0,  balance),
          // Aliases for legacy callers (generateFBRHTML lines 501-517 read
          // `taxReductions`, `taxCredits`, `capitalGainTax`, etc).
          taxReductions:        breakdown.tax.totalReductions,
          taxCredits:           breakdown.tax.totalCredits,
          capitalGainTax:       breakdown.tax.capitalGainsTax,
          adjustableTax:        breakdown.payments.withholdingTax,
          finalTax,
          totalIncome:          summary.totalIncome,
          totalWithholdingTax:  breakdown.payments.withholdingTax,
          netTaxPosition:       balance,
        }
      : {
          // Fallback — same shape, zeros throughout.
          grossIncome, exemptIncome, taxableIncome: 0, capitalGain: 0,
          incomeFromSalary: 0, incomeFromOtherSources: 0,
          normalIncomeTax: 0, surcharge: 0, capitalGainsTax: 0,
          totalReductions: 0, totalCredits: 0, netTaxPayable: 0, superTax: 0,
          taxChargeable: 0, withholdingTax: summary.totalWithholdingTax,
          advanceTax: 0, totalTaxPaid: summary.totalWithholdingTax,
          balancePayable: 0, refundDue: 0, taxDemanded: 0, additionalTaxDue: 0,
          taxReductions: 0, taxCredits: 0, capitalGainTax: 0,
          adjustableTax: summary.totalWithholdingTax, finalTax: 0,
          totalIncome: summary.totalIncome,
          totalWithholdingTax: summary.totalWithholdingTax,
          netTaxPosition: summary.totalWithholdingTax,
        };

    const reportData = {
      summary,
      rawData: {
        income: incomeData,
        adjustableTax: adjustableTaxData,
      },
      calculations,
      // Surface the full breakdown so the on-screen panel can show the same
      // numbers without re-fetching /api/tax-computation/:taxYear.
      breakdown,
      // Non-null when calculateTaxComputation threw — clients should warn the
      // user rather than treat the zero-fallback `calculations` as authoritative.
      computationError,
    };

    logger.info(`Tax calculation summary completed for user ${userId}, tax year ${taxYear}`, {
      hasIncomeData: summary.hasIncomeData,
      hasAdjustableTaxData: summary.hasAdjustableTaxData,
      totalIncome: summary.totalIncome,
      totalWithholdingTax: summary.totalWithholdingTax
    });

    return reportData;
  } catch (error) {
    logger.error('Comprehensive tax calculation summary error:', error);
    throw error;
  }
}

// Thin route wrapper around the in-process helper — same response shape callers expect.
router.get('/tax-calculation-summary/:taxYear', auth, async (req, res) => {
  try {
    const reportData = await buildTaxCalculationSummary(req.user.id, req.params.taxYear);
    res.json({
      success: true,
      data: reportData,
      message: 'Tax calculation summary retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate comprehensive tax calculation summary',
      message: 'Internal server error: ' + error.message
    });
  }
});

// Get comprehensive income analysis
router.get('/income-analysis/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get detailed income data (canonical post-refactor column names — the
    // old `monthly_salary` / `car_allowance` / etc. were replaced by annual-
    // basis columns and several generated totals).
    const incomeData = await pool.query(`
      SELECT
        annual_basic_salary,
        allowances,
        bonus,
        medical_allowance,
        taxable_car_value           AS car_allowance,
        other_taxable_subsidies     AS other_taxable,
        employer_contribution_provident AS employer_contribution,
        income_exempt_from_tax      AS other_exempt,
        other_income_min_tax_total + other_income_no_min_tax_total AS other_sources,
        annual_salary_wages_total   AS subtotal_calculated,
        (COALESCE(annual_salary_wages_total::numeric, 0)
          + COALESCE(other_income_min_tax_total::numeric, 0)
          + COALESCE(other_income_no_min_tax_total::numeric, 0)
          + COALESCE(income_exempt_from_tax::numeric, 0)
          + COALESCE(total_non_cash_benefits::numeric, 0))   AS total_gross_income,
        (COALESCE(income_exempt_from_tax::numeric, 0)
          + COALESCE(non_cash_benefit_exempt::numeric, 0))   AS total_exempt_income,
        COALESCE(total_employment_income::numeric, 0)        AS total_taxable_income
      FROM income_forms
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get capital gains data.
    // NOTE: migration phase-u restructured capital_gain_forms — the legacy
    // per-holding-period columns (property_1_year, property_2_3_years,
    // property_4_plus_years, securities, other_capital_gains) and the
    // never-real `total_capital_gain_tax` were dropped and replaced by the
    // immovable_property_*_taxable / securities_*_taxable families plus the
    // canonical total_capital_gain / total_tax_deducted columns. Selecting the
    // old names by hand made this endpoint 500 for every user. SELECT * keeps
    // the report resilient to that drift; the response consumer reads the
    // canonical totals it needs and ignores the rest.
    const capitalGainsData = await pool.query(`
      SELECT * FROM capital_gain_forms
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get final tax income (if exists). phase-u likewise dropped the legacy
    // per-instrument columns (sukuk_amount, debt_amount, prize_bonds,
    // other_final_tax_amount) in favour of canonical total_final_tax, so
    // SELECT * to avoid the same column-does-not-exist 500.
    const finalTaxData = await pool.query(`
      SELECT * FROM final_tax_forms
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const analysisData = {
      regularIncome: incomeData.rows[0] || null,
      capitalGains: capitalGainsData.rows[0] || null,
      finalTaxIncome: finalTaxData.rows[0] || null,
      taxYear,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: analysisData,
      message: 'Income analysis retrieved successfully'
    });

  } catch (error) {
    logger.error('Income analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate income analysis',
      message: 'Internal server error'
    });
  }
});

// Get adjustable tax payments report
router.get('/adjustable-tax-report/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get adjustable tax data
    const adjustableTaxResult = await pool.query(`
      SELECT * FROM adjustable_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    if (adjustableTaxResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { message: 'No adjustable tax data found for this year' },
        message: 'Adjustable tax report retrieved successfully'
      });
    }

    const adjustableTaxData = adjustableTaxResult.rows[0];

    // Structure the data for reporting
    const reportData = {
      taxYear,
      totalAdjustableTax: adjustableTaxData.total_adjustable_tax,
      categories: {
        employment: {
          salaryTax: adjustableTaxData.salary_employees_149_tax_collected || 0,
          directorshipFee: adjustableTaxData.directorship_fee_149_3_tax_collected || 0
        },
        utilities: {
          electricity: adjustableTaxData.electricity_bill_domestic_235_tax_collected || 0,
          telephone: adjustableTaxData.telephone_bill_236_1e_tax_collected || 0,
          cellphone: adjustableTaxData.cellphone_bill_236_1f_tax_collected || 0
        },
        motorVehicle: {
          registration: adjustableTaxData.motor_vehicle_registration_fee_231b1_tax_collected || 0,
          transfer: adjustableTaxData.motor_vehicle_transfer_fee_231b2_tax_collected || 0,
          sale: adjustableTaxData.motor_vehicle_sale_231b3_tax_collected || 0
        },
        property: {
          saleTransfer: adjustableTaxData.sale_transfer_immoveable_property_236c_tax_collected || 0,
          purchase: adjustableTaxData.purchase_transfer_immoveable_property_236k_tax_collected || 0
        },
        financial: {
          profitOnDebt: adjustableTaxData.profit_debt_151_15_tax_collected || 0,
          cashWithdrawal: adjustableTaxData.advance_tax_cash_withdrawal_231ab_tax_collected || 0
        }
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Adjustable tax report retrieved successfully'
    });

  } catch (error) {
    logger.error('Adjustable tax report error:', error);
    res.status(500).json({
      error: 'Failed to generate adjustable tax report',
      message: 'Internal server error'
    });
  }
});

// Get wealth reconciliation report
router.get('/wealth-reconciliation/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get wealth data
    const wealthResult = await pool.query(`
      SELECT * FROM wealth_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get wealth reconciliation data if it exists
    const wealthReconciliationResult = await pool.query(`
      SELECT * FROM wealth_reconciliation_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get income data for reconciliation (post-refactor column names — old
    // `monthly_salary` / `car_allowance` / `other_taxable` / `other_sources`
    // were renamed during the salary-form rewrite).
    const incomeResult = await pool.query(`
      SELECT
        COALESCE(total_employment_income::numeric, 0) AS total_taxable_income
      FROM income_forms
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get expenses data for reconciliation
    const expensesResult = await pool.query(`
      SELECT total_expenses FROM expenses_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const reportData = {
      taxYear,
      wealthStatement: wealthResult.rows[0] || null,
      wealthReconciliation: wealthReconciliationResult.rows[0] || null,
      totalTaxableIncome: incomeResult.rows[0]?.total_taxable_income || 0,
      totalExpenses: expensesResult.rows[0]?.total_expenses || 0,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Wealth reconciliation report retrieved successfully'
    });

  } catch (error) {
    logger.error('Wealth reconciliation report error:', error);
    res.status(500).json({
      error: 'Failed to generate wealth reconciliation report',
      message: 'Internal server error'
    });
  }
});

// Get available tax years for reports
router.get('/available-years', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT DISTINCT tr.id as tax_return_id, tr.tax_year, ty.start_date, ty.end_date, ty.filing_deadline
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year = ty.tax_year
      WHERE tr.user_id = $1
      ORDER BY tr.tax_year DESC
    `, [userId]);

    res.json({
      success: true,
      data: result.rows,
      message: 'Available tax years retrieved successfully'
    });

  } catch (error) {
    logger.error('Available years error:', error);
    res.status(500).json({
      error: 'Failed to retrieve available years',
      message: 'Internal server error'
    });
  }
});

// Generate Tax Return PDF in FBR format
router.post('/tax-return-pdf/:taxReturnId', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const { taxReturnId } = req.params;

    logger.debug('FBR PDF generation', { taxReturnId, userId, userEmail });

    const { renderPdf } = require('../services/pdf/browserPool');

    // Accept either the UUID `id` or the human-readable `return_number` so
    // callers from different surfaces (dashboard vs. tax-computation page)
    // both work.
    const taxReturnResult = await pool.query(`
      SELECT tr.*, ty.tax_year FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      WHERE (tr.return_number = $1 OR tr.id::text = $1) AND tr.user_id = $2
    `, [taxReturnId, userId]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'Tax return not found for this user'
      });
    }

    const taxYear = taxReturnResult.rows[0].tax_year;

    // Build the canonical calculations IN-PROCESS (PERF-02/BE-07) — no HTTP
    // self-call to our own server. Delegates to TaxCalculationService inside the
    // shared helper, same data the summary route returns.
    const apiResponse = await buildTaxCalculationSummary(userId, taxYear);

    // Refuse to stamp a PDF with all-zero tax rows. Previously the calc
    // service's error was swallowed and the PDF showed Rs 0 for every
    // chargeable line — a filer could mistake that for a real return.
    if (apiResponse.computationError) {
      logger.error('Refusing PDF generation: tax computation failed', {
        taxReturnId, userId, taxYear, computationError: apiResponse.computationError,
      });
      return res.status(409).json({
        success: false,
        error: 'tax_computation_incomplete',
        message: 'Tax computation could not be completed. Finish all required forms before downloading the return.',
        detail: apiResponse.computationError,
      });
    }

    // Debug logging to trace the data flow
    logger.debug('FBR PDF data flow', {
      taxYear,
      calculations: apiResponse.calculations,
      expectedValues: { taxableIncome: 21595004, taxChargeable: 7135349 }
    });

    // Taxpayer identity for the acknowledgement slip (R-03).
    //
    // Why this query exists at all: the block below used to read `apiResponse.user`,
    // `apiResponse.returnNumber`, `apiResponse.taxYear` and `apiResponse.filingStatus`,
    // but buildTaxCalculationSummary returns only { summary, rawData, calculations,
    // breakdown, computationError } — it has never had a `user` key. Every one of
    // those reads was undefined, which is why Name / Address / Registration No
    // printed as "N/A" on every PDF ever generated, and why Tax Year fell through
    // to the hardcoded literal. The data was always available; nobody was fetching it.
    //
    // personal_information is the IRIS pre-fill snapshot, keyed per (user, tax year) —
    // it is the right source because a return must show the taxpayer's details AS
    // FILED for that year (address and employer change between years; the archived
    // TY2024 PDF must not silently acquire a 2026 address). `users` is the fallback
    // for filers who have not completed the personal-information form yet.
    //
    // Registration No: for an individual, FBR's registration number IS the NTN,
    // which for a Pakistani national is the CNIC. Preference order follows how
    // explicit the datum is — an entered FBR number beats a derived one.
    const taxpayerResult = await pool.query(`
      SELECT u.name        AS account_name,
             u.phone       AS account_phone,
             u.cnic        AS account_cnic,
             pi.full_name, pi.ntn, pi.fbr_registration_number, pi.cnic AS pi_cnic,
             pi.residential_address, pi.city, pi.province, pi.mobile_number
      FROM users u
      LEFT JOIN personal_information pi
        ON pi.user_id = u.id AND pi.tax_year = $2
      WHERE u.id = $1
    `, [userId, taxYear]).catch(err => {
      // A missing profile must not block the download — the template already
      // renders 'N/A' for anything absent.
      logger.warn('Could not load taxpayer details for PDF header:', err.message);
      return { rows: [] };
    });

    const t = taxpayerResult.rows[0] || {};
    const taxpayer = {
      name: t.full_name || t.account_name || null,
      address: [t.residential_address, t.city, t.province].filter(Boolean).join(', ') || null,
      phone: t.mobile_number || t.account_phone || null,
      registrationNo: t.fbr_registration_number || t.ntn || t.pi_cnic || t.account_cnic || null,
    };

    // Per-head reduction and credit detail for the two relief tables. Read
    // straight off the form rows: the engine reports the totals it ALLOWED, and
    // the FBR form wants the claim line by line beside it.
    const reliefRows = await Promise.all([
      pool.query('SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]),
      pool.query('SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2', [userId, taxYear]),
    ]).catch((err) => {
      logger.warn('Could not load relief detail for PDF:', err.message);
      return [{ rows: [] }, { rows: [] }];
    });
    const reductionsRow = reliefRows[0].rows[0] || {};
    const creditsRow = reliefRows[1].rows[0] || {};
    const amt = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const reliefHeads = {
      behboodAmount: amt(reductionsRow.behbood_certificates_amount),
      behboodReduction: amt(reductionsRow.behbood_certificates_tax_reduction),
      teacherReduction: amt(reductionsRow.teacher_researcher_tax_reduction),
      otherReductions:
        amt(reductionsRow.capital_gain_immovable_50_reduction)
        + amt(reductionsRow.capital_gain_immovable_75_reduction)
        + amt(reductionsRow.export_income_reduction)
        + amt(reductionsRow.industrial_undertaking_reduction)
        + amt(reductionsRow.other_reductions),
      donationAmount:
        amt(creditsRow.charitable_donations_amount)
        + amt(creditsRow.charitable_donations_associate_amount),
      donationCredit:
        amt(creditsRow.charitable_donations_tax_credit)
        + amt(creditsRow.charitable_donations_associate_tax_credit),
      pensionAmount:
        amt(creditsRow.pension_fund_amount) + amt(creditsRow.pension_contribution_amount),
      pensionCredit:
        amt(creditsRow.pension_fund_tax_credit) + amt(creditsRow.pension_contribution_tax_credit),
      surrenderReversal: amt(creditsRow.surrender_tax_credit_reduction),
      otherCredits: amt(creditsRow.other_credits) + amt(creditsRow.investment_tax_credit),
    };

    const taxReturnRow = taxReturnResult.rows[0];

    // Map the corrected API response to the format expected by the FBR HTML template
    const taxData = {
      // User information
      user: taxpayer,
      returnNumber: taxReturnRow.return_number || '',
      // Authoritative: read off the tax_returns/tax_years join above, not off the
      // calculation payload. generateFBRHTML derives Period / Tax Year / Due Date
      // from this and throws if it is unusable.
      taxYear,
      filingStatus: taxReturnRow.filing_status || '',

      // Tax calculations from TaxCalculationService (via tax-calculation-summary).
      grossIncome: apiResponse.calculations?.grossIncome || 0,
      exemptIncome: apiResponse.calculations?.exemptIncome || 0,
      taxableIncome: apiResponse.calculations?.taxableIncome || 0,
      capitalGain: apiResponse.calculations?.capitalGain || 0,
      normalIncomeTax: apiResponse.calculations?.normalIncomeTax || 0,
      surcharge: apiResponse.calculations?.surcharge || 0,
      taxReductions: apiResponse.calculations?.taxReductions || 0,
      taxCredits: apiResponse.calculations?.taxCredits || 0,
      adjustableTax: apiResponse.calculations?.adjustableTax || 0,
      finalTax: apiResponse.calculations?.finalTax || 0,
      capitalGainTax: apiResponse.calculations?.capitalGainTax || 0,
      taxChargeable: apiResponse.calculations?.taxChargeable || 0,
      withholdingTax: apiResponse.calculations?.withholdingTax || 0,
      taxDemanded: apiResponse.calculations?.taxDemanded || 0,
      totalTaxPaid: apiResponse.calculations?.totalTaxPaid || 0,
      refundDue: apiResponse.calculations?.refundDue || 0,
      additionalTaxDue: apiResponse.calculations?.additionalTaxDue || 0,

      superTax: apiResponse.calculations?.superTax || 0,

      // Map to template field names
      totalIncome: apiResponse.calculations?.grossIncome || 0,
      // SALARY IS NOT THE WHOLE OF INCOME. This was `grossIncome`, so every
      // rupee of rent, profit on debt and other income was printed against FBR
      // code 1000 / 1009 ("Pay, Wages or Other Remuneration") — a misdeclaration
      // of the composition of income on the filed document, even where the tax
      // total happened to be right.
      incomeFromSalary: apiResponse.calculations?.incomeFromSalary || 0,
      incomeFromOtherSources: apiResponse.calculations?.incomeFromOtherSources || 0,
      withholdingIncomeTax: apiResponse.calculations?.withholdingTax || 0,
      refundableIncomeTax: apiResponse.calculations?.refundDue || 0,
      // Per-head relief detail. The Tax Reductions table was HARDCODED to zeros
      // — a taxpayer claiming Rs 25,000 of Behbood relief filed a return showing
      // nil — and there was no Tax Credits table at all.
      reliefHeads,

      // Structured data
      adjustableTax: {
        receipts: apiResponse.calculations?.grossIncome || 0,
        taxCollected: apiResponse.calculations?.withholdingTax || 0,
        taxChargeable: apiResponse.calculations?.adjustableTax || 0
      },
      salaryTax: {
        receipts: apiResponse.calculations?.grossIncome || 0,
        taxCollected: apiResponse.calculations?.withholdingTax || 0
      },
      personalExpenses: apiResponse.personalExpenses || {
        total: 0,
        ratesTaxes: 0,
        vehicle: 0,
        travelling: 0,
        electricity: 0,
        water: 0,
        gas: 0,
        telephone: 0,
        medical: 0,
        educational: 0,
        other: 0
      },
      personalAssets: apiResponse.personalAssets || [],
      totalAssets: apiResponse.totalAssets || 0,
      netAssets: apiResponse.netAssets || 0,
      netAssetsPrevious: apiResponse.netAssetsPrevious || 0,
      assetsChange: apiResponse.assetsChange || 0,
      inflows: apiResponse.inflows || 0,
      declaredIncome: apiResponse.declaredIncome || 0,
      outflows: apiResponse.outflows || 0,
      unreconciledAmount: apiResponse.unreconciledAmount || 0
    };

    // Generate HTML for PDF
    const htmlContent = generateFBRHTML(taxData);

    // Render the PDF via the shared browser pool (PERF-01) — one long-lived
    // Chromium, a fresh page per request, capped concurrency. The container
    // uses the distro Chromium at PUPPETEER_EXECUTABLE_PATH (set in the
    // Dockerfile); locally Puppeteer's bundled Chromium is used. renderPdf
    // always returns a real Buffer (Express serializes a Uint8Array as JSON).
    const pdfBytes = await renderPdf(htmlContent, {
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      displayHeaderFooter: false,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Tax_Return_${taxData.returnNumber || taxReturnId}_FBR.pdf`);
    res.setHeader('Content-Length', pdfBytes.length);

    res.end(pdfBytes);

  } catch (error) {
    logger.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

// Function to generate FBR-formatted HTML for PDF
function generateFBRHTML(taxData) {
  // Derived once and reused by all three page headers, so the acknowledgement
  // slip, the return and the wealth statement can never disagree about which
  // year the document covers. Throws on a malformed tax year — see
  // deriveTaxYearHeader for why there is deliberately no fallback.
  const header = deriveTaxYearHeader(taxData.taxYear);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FBR Tax Return - ${taxData.user?.name || 'Unknown'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.2;
      color: #000;
    }

    .page {
      min-height: 100vh;
      padding: 15px;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .fbr-header {
      background-color: #1e40af;
      color: white;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .fbr-logo {
      width: 60px;
      height: 60px;
      background-color: white;
      color: #1e40af;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
    }

    .irs-logo {
      width: 60px;
      height: 60px;
      background-color: white;
      color: #1e40af;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
    }

    .fbr-title h1 {
      font-size: 18px;
      margin-bottom: 4px;
    }

    .fbr-title p {
      font-size: 12px;
    }

    .acknowledgement {
      text-align: center;
      margin-bottom: 20px;
    }

    .acknowledgement h2 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .acknowledgement p {
      font-size: 10px;
      text-decoration: underline;
      margin-bottom: 16px;
    }

    .personal-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 20px;
      font-size: 10px;
    }

    .personal-details p {
      margin-bottom: 3px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 10px;
    }

    table, th, td {
      border: 1px solid black;
    }

    th, td {
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .section-header {
      background-color: #e5e7eb;
      font-weight: bold;
      padding: 6px;
      margin: 10px 0 4px 0;
      font-size: 11px;
    }

    /* Total lines on the relief tables. The figure shown is what the engine
       ALLOWED, which can be less than the sum of the claims above it — the
       statutory caps bite there and the reader must be able to see both. */
    .total-row {
      background-color: #f3f4f6;
    }

    .disclaimer {
      font-style: italic;
      font-size: 9px;
      margin-top: 10px;
    }

    .fbr-footer {
      margin-top: auto;
      font-size: 10px;
    }

    .fbr-footer-content {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .fbr-copyright {
      background-color: #1e40af;
      color: white;
      text-align: center;
      padding: 8px;
      font-size: 9px;
    }

    .barcode-area {
      height: 25px;
      border: 1px solid black;
      margin: 10px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      font-size: 8px;
    }

    .indent {
      padding-left: 15px;
    }

    @page {
      margin: 0.5in;
      size: A4;
    }
  </style>
</head>
<body>

<!-- Page 1 - Acknowledgement Slip -->
<div class="page">
  <div class="fbr-header">
    <div class="fbr-logo">FBR</div>
    <div class="fbr-title">
      <h1>Federal Board of Revenue</h1>
      <p>Revenue Division - Government of Pakistan</p>
    </div>
    <div class="irs-logo">IRS</div>
  </div>

  <div class="acknowledgement">
    <h2>ACKNOWLEDGEMENT SLIP</h2>
    <p>114(1) (Return of Income for a person deriving income only from salary and other sources eligible to file salary return)</p>
  </div>

  <div class="personal-details">
    <div>
      <p><strong>Name:</strong> ${taxData.user?.name || 'N/A'}</p>
      <p><strong>Address:</strong> ${taxData.user?.address || 'N/A'}</p>
      <p><strong>Contact No:</strong> ${taxData.user?.phone || 'N/A'}</p>
    </div>
    <div>
      <p><strong>Registration No:</strong> ${taxData.user?.registrationNo || 'N/A'}</p>
      <p><strong>Tax Year:</strong> ${header.taxYearLabel}</p>
      <p><strong>Period:</strong> ${header.period}</p>
      <p><strong>Medium:</strong></p>
      <p><strong>Due Date:</strong> ${header.dueDate}</p>
      <p><strong>Document Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>

  <div class="barcode-area">
    |||||||| ${taxData.user?.registrationNo || 'N/A'} ||||||||
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Net Assets Current Year</td>
        <td class="text-center">703001</td>
        <td class="text-right">${formatAmount(taxData.netAssets)}</td>
      </tr>
      <tr>
        <td>Refundable Income Tax</td>
        <td class="text-center">9210</td>
        <td class="text-right">${formatAmount(taxData.refundableIncomeTax)}</td>
      </tr>
      <tr>
        <td>Tax Chargeable</td>
        <td class="text-center">9200</td>
        <td class="text-right">${formatAmount(taxData.taxChargeable)}</td>
      </tr>
      <tr>
        <td>Taxable Income</td>
        <td class="text-center">9100</td>
        <td class="text-right">${formatAmount(taxData.taxableIncome)}</td>
      </tr>
      <tr>
        <td>Total Income</td>
        <td class="text-center">9000</td>
        <td class="text-right">${formatAmount(taxData.totalIncome)}</td>
      </tr>
    </tbody>
  </table>

  <p class="disclaimer">
    This is not a valid evidence of being a "filer" for the purposes of clauses (23A) and (35C) of sections 2 and 181A.
  </p>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 1 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

<!-- Page 2 - Salary and Tax Details -->
<div class="page">
  <div class="fbr-header">
    <div class="fbr-logo">FBR</div>
    <div class="fbr-title">
      <h1>Federal Board of Revenue</h1>
      <p>Revenue Division - Government of Pakistan</p>
    </div>
    <div class="irs-logo">IRS</div>
  </div>

  <div class="acknowledgement">
    <p style="text-decoration: underline;">114(1) (Return of Income for a person deriving income only from salary and other sources eligible to file salary return)</p>
  </div>

  <div class="personal-details">
    <div>
      <p><strong>Name:</strong> ${taxData.user?.name || 'N/A'}</p>
      <p><strong>Address:</strong> ${taxData.user?.address || 'N/A'}</p>
      <p><strong>Contact No:</strong> ${taxData.user?.phone || 'N/A'}</p>
    </div>
    <div>
      <p><strong>Registration No:</strong> ${taxData.user?.registrationNo || 'N/A'}</p>
      <p><strong>Tax Year:</strong> ${header.taxYearLabel}</p>
      <p><strong>Period:</strong> ${header.period}</p>
      <p><strong>Medium:</strong></p>
      <p><strong>Due Date:</strong> ${header.dueDate}</p>
      <p><strong>Document Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>

  <div class="barcode-area">
    |||||||| ${taxData.user?.registrationNo || 'N/A'} ||||||||
  </div>

  <h3 class="section-header">Salary</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Total Amount</th>
        <th class="text-right">Amount Exempt from Tax / Subject to Fixed / Final Tax</th>
        <th class="text-right">Amount Subject to Normal Tax</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Income from Salary</td>
        <td class="text-center">1000</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
      </tr>
      <tr>
        <td>Pay, Wages or Other Remuneration (including Arrears of Salary)</td>
        <td class="text-center">1009</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
      </tr>
      <tr>
        <td>Income from Other Sources</td>
        <td class="text-center">5000</td>
        <td class="text-right">${formatAmount(taxData.incomeFromOtherSources)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromOtherSources)}</td>
      </tr>
      <tr>
        <td>Capital Gains</td>
        <td class="text-center">4000</td>
        <td class="text-right">${formatAmount(taxData.capitalGain)}</td>
        <td class="text-right">${formatAmount(taxData.capitalGain)}</td>
        <td class="text-right">0</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Tax Reductions</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Total Amount</th>
        <th class="text-right">Tax Chargeable</th>
        <th class="text-right">Tax Reducted</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Tax Reduction on Tax Charged on Behbood Certificates / Pensioner's Benefit Account in excess of applicable rate</td>
        <td class="text-center">930101</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.behboodAmount)}</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.behboodReduction)}</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.behboodReduction)}</td>
      </tr>
      <tr>
        <td>Tax Reduction for Full Time Teacher / Researcher</td>
        <td class="text-center">930102</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.teacherReduction)}</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.teacherReduction)}</td>
      </tr>
      <tr>
        <td>Other Tax Reductions</td>
        <td class="text-center">930000</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.otherReductions)}</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.otherReductions)}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Total Tax Reductions ALLOWED</strong></td>
        <td class="text-center">9309</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right"><strong>${formatAmount(taxData.taxReductions)}</strong></td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Tax Credits</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount Given / Contributed</th>
        <th class="text-right">Tax Credit</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Charitable Donations u/s 61</td>
        <td class="text-center">923101</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.donationAmount)}</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.donationCredit)}</td>
      </tr>
      <tr>
        <td>Contribution to an Approved Pension Fund u/s 63</td>
        <td class="text-center">923301</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.pensionAmount)}</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.pensionCredit)}</td>
      </tr>
      <tr>
        <td>Surrender of Tax Credit (added back to tax payable)</td>
        <td class="text-center">923999</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.surrenderReversal)}</td>
      </tr>
      <tr>
        <td>Other Tax Credits</td>
        <td class="text-center">923000</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.reliefHeads?.otherCredits)}</td>
      </tr>
      <tr class="total-row">
        <td><strong>Total Tax Credits ALLOWED</strong></td>
        <td class="text-center">9329</td>
        <td class="text-right">0</td>
        <td class="text-right"><strong>${formatAmount(taxData.taxCredits)}</strong></td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Adjustable Tax</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Receipts / Value</th>
        <th class="text-right">Tax Collected/ Deducted</th>
        <th class="text-right">Tax Chargeable</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Adjustable Tax</td>
        <td class="text-center">640000</td>
        <td class="text-right">${formatAmount(taxData.adjustableTax?.receipts)}</td>
        <td class="text-right">${formatAmount(taxData.adjustableTax?.taxCollected)}</td>
        <td class="text-right">${formatAmount(taxData.adjustableTax?.taxChargeable)}</td>
      </tr>
      <tr>
        <td>Salary of Employees u/s 149</td>
        <td class="text-center">64020004</td>
        <td class="text-right">${formatAmount(taxData.salaryTax?.receipts)}</td>
        <td class="text-right">${formatAmount(taxData.salaryTax?.taxCollected)}</td>
        <td class="text-right">0</td>
      </tr>
    </tbody>
  </table>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 2 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

<!-- Page 3 - Computations and Personal Expenses -->
<div class="page">
  <div class="fbr-header">
    <div class="fbr-logo">FBR</div>
    <div class="fbr-title">
      <h1>Federal Board of Revenue</h1>
      <p>Revenue Division - Government of Pakistan</p>
    </div>
    <div class="irs-logo">IRS</div>
  </div>

  <div class="acknowledgement">
    <p style="text-decoration: underline;">114(1) (Return of Income for a person deriving income only from salary and other sources eligible to file salary return)</p>
  </div>

  <div class="personal-details">
    <div>
      <p><strong>Name:</strong> ${taxData.user?.name || 'N/A'}</p>
      <p><strong>Address:</strong> ${taxData.user?.address || 'N/A'}</p>
      <p><strong>Contact No:</strong> ${taxData.user?.phone || 'N/A'}</p>
    </div>
    <div>
      <p><strong>Registration No:</strong> ${taxData.user?.registrationNo || 'N/A'}</p>
      <p><strong>Tax Year:</strong> ${header.taxYearLabel}</p>
      <p><strong>Period:</strong> ${header.period}</p>
      <p><strong>Medium:</strong></p>
      <p><strong>Due Date:</strong> ${header.dueDate}</p>
      <p><strong>Document Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>

  <div class="barcode-area">
    |||||||| ${taxData.user?.registrationNo || 'N/A'} ||||||||
  </div>

  <h3 class="section-header">Computations</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Total Amount</th>
        <th class="text-right">Amount Exempt from Tax / Subject to Fixed / Final Tax</th>
        <th class="text-right">Amount Subject to Normal Tax</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Income from Salary</td>
        <td class="text-center">1000</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
      </tr>
      <tr>
        <td>Income from Other Sources</td>
        <td class="text-center">5000</td>
        <td class="text-right">${formatAmount(taxData.incomeFromOtherSources)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromOtherSources)}</td>
      </tr>
      <tr>
        <td>Total Income</td>
        <td class="text-center">9000</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.totalIncome)}</td>
      </tr>
      <tr>
        <td>Taxable Income</td>
        <td class="text-center">9100</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.taxableIncome)}</td>
      </tr>
      <tr>
        <td>Tax Chargeable</td>
        <td class="text-center">9200</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.taxChargeable)}</td>
      </tr>
      <tr>
        <td>Normal Income Tax</td>
        <td class="text-center">920000</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.normalIncomeTax)}</td>
      </tr>
      <!-- Every line below was MISSING. The Computations table showed the normal
           tax and jumped straight to withholding, so a return carrying a 9%
           surcharge, a capital-gains charge, super tax or any relief at all did
           not show them anywhere — the reader could not reconcile Tax Chargeable
           against the figures printed above it. -->
      <tr>
        <td>Surcharge u/s 4AB</td>
        <td class="text-center">920800</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.surcharge)}</td>
      </tr>
      <tr>
        <td>Capital Gains Tax</td>
        <td class="text-center">920100</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.capitalGainTax)}</td>
      </tr>
      <tr>
        <td>Tax Reductions</td>
        <td class="text-center">9309</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">(${formatAmount(taxData.taxReductions)})</td>
      </tr>
      <tr>
        <td>Tax Credits</td>
        <td class="text-center">9329</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">(${formatAmount(taxData.taxCredits)})</td>
      </tr>
      <tr>
        <td>Super Tax u/s 4C</td>
        <td class="text-center">920900</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.superTax)}</td>
      </tr>
      <tr>
        <td>Final / Fixed / Minimum Tax</td>
        <td class="text-center">920200</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.finalTax)}</td>
      </tr>
      <tr>
        <td>Withholding Income Tax</td>
        <td class="text-center">9201</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.withholdingIncomeTax)}</td>
        <td class="text-right"></td>
      </tr>
      <tr>
        <td>Refundable Income Tax</td>
        <td class="text-center">9210</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.refundableIncomeTax)}</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Personal Expenses</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Personal Expenses</td>
        <td class="text-center">7089</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.total)}</td>
      </tr>
      <tr>
        <td class="indent">Rates / Taxes / Charge / Cess</td>
        <td class="text-center">7052</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.ratesTaxes)}</td>
      </tr>
      <tr>
        <td class="indent">Vehicle Running / Maintenance</td>
        <td class="text-center">7055</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.vehicle)}</td>
      </tr>
      <tr>
        <td class="indent">Travelling</td>
        <td class="text-center">7056</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.travelling)}</td>
      </tr>
      <tr>
        <td class="indent">Electricity</td>
        <td class="text-center">7058</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.electricity)}</td>
      </tr>
      <tr>
        <td class="indent">Water</td>
        <td class="text-center">7059</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.water)}</td>
      </tr>
      <tr>
        <td class="indent">Gas</td>
        <td class="text-center">7060</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.gas)}</td>
      </tr>
      <tr>
        <td class="indent">Telephone</td>
        <td class="text-center">7061</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.telephone)}</td>
      </tr>
      <tr>
        <td class="indent">Medical</td>
        <td class="text-center">7070</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.medical)}</td>
      </tr>
      <tr>
        <td class="indent">Educational</td>
        <td class="text-center">7071</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.educational)}</td>
      </tr>
      <tr>
        <td class="indent">Other Personal / Household Expenses</td>
        <td class="text-center">7087</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.other)}</td>
      </tr>
    </tbody>
  </table>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 3 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

<!-- Page 4 - Personal Assets and Reconciliation -->
<div class="page">
  <h3 class="section-header">Personal Assets / Liabilities</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${taxData.personalAssets?.map(asset => `
        <tr>
          <td>${asset.description}</td>
          <td class="text-center">${asset.code}</td>
          <td class="text-right">${formatAmount(asset.amount)}</td>
        </tr>
      `).join('') || ''}
      <tr style="background-color: #f0f0f0; font-weight: bold;">
        <td>Total Assets</td>
        <td class="text-center">7019</td>
        <td class="text-right">${formatAmount(taxData.totalAssets)}</td>
      </tr>
      <tr style="background-color: #f0f0f0; font-weight: bold;">
        <td>Net Assets Current Year</td>
        <td class="text-center">703001</td>
        <td class="text-right">${formatAmount(taxData.netAssets)}</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Reconciliation of Net Assets</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Net Assets Current Year</td>
        <td class="text-center">703001</td>
        <td class="text-right">${formatAmount(taxData.netAssets)}</td>
      </tr>
      <tr>
        <td>Net Assets Previous Year</td>
        <td class="text-center">703002</td>
        <td class="text-right">${formatAmount(taxData.netAssetsPrevious)}</td>
      </tr>
      <tr>
        <td>Increase / Decrease in Assets</td>
        <td class="text-center">703003</td>
        <td class="text-right">${formatAmount(taxData.assetsChange)}</td>
      </tr>
      <tr>
        <td>Inflows</td>
        <td class="text-center">7049</td>
        <td class="text-right">${formatAmount(taxData.inflows)}</td>
      </tr>
      <tr>
        <td class="indent">Income Declared as per Return for the year subject to Normal Tax</td>
        <td class="text-center">7031</td>
        <td class="text-right">${formatAmount(taxData.declaredIncome)}</td>
      </tr>
      <tr>
        <td>Outflows</td>
        <td class="text-center">7099</td>
        <td class="text-right">${formatAmount(taxData.outflows)}</td>
      </tr>
      <tr>
        <td class="indent">Personal Expenses</td>
        <td class="text-center">7089</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.total)}</td>
      </tr>
      <tr style="background-color: #fef3c7; font-weight: bold;">
        <td>Unreconciled Amount</td>
        <td class="text-center">703000</td>
        <td class="text-right">${formatAmount(taxData.unreconciledAmount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 4 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

</body>
</html>
  `;

  function formatAmount(amount) {
    if (!amount || amount === 0) return '0';
    return new Intl.NumberFormat('en-US').format(Math.round(amount));
  }
}

module.exports = router;
// Exported for unit tests only — the router remains the module's default export
// so `app.use('/api/reports', require('./routes/reports'))` is unchanged.
module.exports.deriveTaxYearHeader = deriveTaxYearHeader;