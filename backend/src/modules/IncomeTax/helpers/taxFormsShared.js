// Shared helpers for the income-tax form routes (extracted from the taxForms
// route file during the CQ-05 god-file split). Bodies are byte-identical to the
// originals — moved verbatim so behaviour is unchanged.
const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const ensureTaxReturn = require('../../../helpers/ensureTaxReturn');
const {
  getAllowedColumns,
  filterToAllowedColumns,
} = require('../../../helpers/tableColumns');

// Helper: fetch the current tax year from the DB at runtime (not hardcoded)
async function getCurrentTaxYear() {
  const result = await pool.query(
    `SELECT tax_year FROM tax_years WHERE is_current = true AND is_active = true LIMIT 1`
  );
  if (result.rows.length === 0) throw new Error('No current tax year configured in the database.');
  return result.rows[0].tax_year;
}

// Helper function to recalculate form completion from database
async function recalculateFormCompletion(userId, taxYear) {
  try {
    // `addons` (when present) lists the conditional forms a form is gated behind,
    // mirroring deriveActiveSteps in Frontend/src/contexts/TaxFormContext.js. A
    // form with no `addons` is always active. capital_gain and final_tax are only
    // shown — and so only counted toward the completion percentage — when the
    // user's income profile selects a matching addon.
    const formsToCheck = [
      { table: 'income_forms', column: 'income_form_complete' },
      { table: 'adjustable_tax_forms', column: 'adjustable_tax_form_complete' },
      { table: 'reductions_forms', column: 'reductions_form_complete' },
      { table: 'credits_forms', column: 'credits_form_complete' },
      { table: 'deductions_forms', column: 'deductions_form_complete' },
      {
        table: 'final_tax_forms',
        column: 'final_tax_form_complete',
        addons: ['bank_profit', 'dividends', 'securities', 'prizes'],
      },
      {
        table: 'capital_gain_forms',
        column: 'capital_gain_form_complete',
        addons: ['property_gain', 'securities'],
      },
      { table: 'expenses_forms', column: 'expenses_form_complete' },
      { table: 'wealth_forms', column: 'wealth_form_complete' },
      { table: 'final_min_income_forms', column: 'final_min_income_form_complete' },
      { table: 'wealth_reconciliation_forms', column: 'wealth_reconciliation_form_complete' },
      { table: 'tax_computation_forms', column: 'tax_computation_form_complete' },
    ];

    const completionStatus = {};

    for (const form of formsToCheck) {
      try {
        const result = await pool.query(
          `SELECT * FROM ${form.table} WHERE user_id = $1 AND tax_year = $2`,
          [userId, taxYear]
        );

        if (result.rows.length > 0) {
          // Use the explicit is_complete flag set when the user clicks "Complete & Next".
          // Do NOT use hasData (any numeric > 0) — that fires as soon as any data is entered
          // and would falsely mark forms complete before the user intentionally finishes them.
          completionStatus[form.column] = Boolean(result.rows[0].is_complete);
        } else {
          completionStatus[form.column] = false;
        }
      } catch (err) {
        logger.warn(`Error checking ${form.table}:`, err.message);
        completionStatus[form.column] = false;
      }
    }

    // Resolve the user's income profile so the completion percentage counts only
    // the forms actually shown to them (the conditional capital_gain / final_tax
    // forms are excluded unless a matching addon is selected). This keeps the
    // stored percentage in agreement with the web form's activeSteps progress —
    // otherwise a salaried filer with no capital gains / final-tax income tops out
    // at 10/12 = 83% and all_forms_complete never becomes true.
    let addons = [];
    try {
      const prof = await pool.query(
        `SELECT income_profile FROM tax_returns WHERE user_id = $1 AND tax_year = $2 LIMIT 1`,
        [userId, taxYear]
      );
      const p = prof.rows[0]?.income_profile;
      if (p && Array.isArray(p.addons)) {
        addons = p.addons.filter((a) => typeof a === 'string');
      }
    } catch (err) {
      logger.warn('recalc: could not load income_profile, assuming salaried-only:', err.message);
    }
    const addonSet = new Set(addons);
    const isActive = (form) => !form.addons || form.addons.some((a) => addonSet.has(a));

    const activeForms = formsToCheck.filter(isActive);
    const completedActive = activeForms.filter((f) => completionStatus[f.column]).length;
    const denom = activeForms.length; // always >= 10 (the always-active forms)
    const completionPercentage = denom > 0 ? Math.round((completedActive * 100) / denom) : 0;
    const allFormsComplete = denom > 0 && completedActive === denom;

    await pool.query(
      `UPDATE form_completion_status
       SET income_form_complete = $1, adjustable_tax_form_complete = $2,
           reductions_form_complete = $3, credits_form_complete = $4,
           deductions_form_complete = $5, final_tax_form_complete = $6,
           capital_gain_form_complete = $7, expenses_form_complete = $8,
           wealth_form_complete = $9,
           final_min_income_form_complete = $10,
           wealth_reconciliation_form_complete = $11,
           tax_computation_form_complete = $12,
           completion_percentage = $13,
           all_forms_complete = $14,
           last_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $15 AND tax_year = $16`,
      [
        completionStatus['income_form_complete'],
        completionStatus['adjustable_tax_form_complete'],
        completionStatus['reductions_form_complete'],
        completionStatus['credits_form_complete'],
        completionStatus['deductions_form_complete'],
        completionStatus['final_tax_form_complete'],
        completionStatus['capital_gain_form_complete'],
        completionStatus['expenses_form_complete'],
        completionStatus['wealth_form_complete'],
        completionStatus['final_min_income_form_complete'],
        completionStatus['wealth_reconciliation_form_complete'],
        completionStatus['tax_computation_form_complete'],
        completionPercentage,
        allFormsComplete,
        userId,
        taxYear,
      ]
    );

    logger.info(
      `Form completion recalculated for ${userId}: ${completedActive}/${denom} active forms complete (${completionPercentage}%)`
    );
  } catch (error) {
    logger.error('Error recalculating completion:', error);
  }
}

const saveFormData = async (tableName, formKey, req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || req.query.taxYear || await getCurrentTaxYear();
    const formData = req.body;

    logger.info(`Saving ${formKey} data for user ${userId}, tax year ${taxYear}`);

    let allowedColumns;
    try {
      allowedColumns = await getAllowedColumns(tableName);
    } catch (e) {
      logger.error(`saveFormData rejected: ${e.message}`);
      return res.status(500).json({ success: false, message: 'Save target not permitted' });
    }

    let taxReturnId;
    try {
      taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const taxYearRow = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    if (taxYearRow.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid tax year' });
    }
    const taxYearId = taxYearRow.rows[0].id;

    // Strip request-envelope fields (not DB columns) and any auto-managed
    // columns the client might echo back (`updated_at` would otherwise collide
    // with the server-managed `updated_at = CURRENT_TIMESTAMP` in the UPDATE
    // set, producing a "multiple assignments to same column" error).
    const {
      taxYear: _,
      taxReturnId: _taxReturnId,
      isComplete,
      id: _id,
      created_at: _createdAt,
      updated_at: _updatedAt,
      ...cleanFormData
    } = formData;

    // Server-controlled fields: overwrite any matching request-body keys.
    const serverFields = {
      tax_return_id: taxReturnId,
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearId,
      tax_year: taxYear,
      is_complete: isComplete || false,
      last_updated_by: userId,
    };

    const clientFields = filterToAllowedColumns(tableName, allowedColumns, cleanFormData);
    const dataToSave = { ...clientFields, ...serverFields };

    // Identity fields never get overwritten on ON CONFLICT UPDATE.
    const identityKeys = new Set(['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year']);

    const columns = Object.keys(dataToSave);
    // Empty-string inputs (e.g. a blank "Rs" amount the user never touched)
    // must become NULL — Postgres rejects '' for numeric columns (22P02:
    // "invalid input syntax for type numeric"). The form numeric columns are
    // nullable with DEFAULT 0, so NULL is safe and reads back as 0. Without
    // this, saving a form with any blank amount 500s (e.g. expenses form).
    const values = columns.map((c) => {
      const v = dataToSave[c];
      return v === '' ? null : v;
    });
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const updateAssignments = columns
      .filter((c) => !identityKeys.has(c))
      // is_complete is sticky (BE-06): a partial "Save data" (is_complete=false)
      // must not silently un-complete a form the user already finished. Only an
      // explicit completion flips it true; OR keeps an existing true.
      .map((c) => c === 'is_complete'
        ? `is_complete = ${tableName}.is_complete OR EXCLUDED.is_complete`
        : `${c} = EXCLUDED.${c}`)
      .concat(['updated_at = CURRENT_TIMESTAMP'])
      .join(', ');

    const sql =
      `INSERT INTO ${tableName} (${columns.join(', ')}) ` +
      `VALUES (${placeholders}) ` +
      `ON CONFLICT (user_id, tax_year) DO UPDATE SET ${updateAssignments} ` +
      `RETURNING *`;

    const result = await pool.query(sql, values);

    logger.info(`${formKey} data saved for user ${userId}`);
    res.json({
      success: true,
      data: result.rows[0],
      message: `${formKey} data saved successfully`,
    });
  } catch (error) {
    logger.error(`Error saving ${formKey} data:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to save ${formKey} data`,
    });
  }
};

module.exports = { getCurrentTaxYear, recalculateFormCompletion, saveFormData };
