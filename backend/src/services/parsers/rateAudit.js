'use strict';

/**
 * rateAudit.js
 * Identifies fields in prior-year data that are rate-sensitive —
 * i.e., the underlying tax rate changed in Finance Act 2025, so the
 * carried-forward tax deducted amount may be wrong for TY 2025-26.
 *
 * These fields are flagged with a warning so the user knows to
 * verify rather than blindly accept the pre-populated value.
 */

// ─── Rate changes: TY 2024-25 → TY 2025-26 (Finance Act 2025) ───────────────
const RATE_CHANGES = {
  // Salary slab tax — drastically reduced (e.g., 5%→1%, 15%→11%, 25%→23%)
  salary_employees_149_tax_collected: {
    message: 'Salary tax slabs changed significantly in Finance Act 2025 (e.g. 5%→1%, 15%→11%). Do not carry forward — recalculate.',
    severity: 'high'
  },

  // Profit on Debt u/s 7B: 15% → 20%
  profit_on_debt_7b_tax_collected: {
    message: 'Profit on Debt rate increased from 15% to 20% under Finance Act 2025 u/s 7B.',
    severity: 'high'
  },

  // Surcharge: 10% → 9%
  surcharge: {
    message: 'Surcharge reduced from 10% to 9% in Finance Act 2025.',
    severity: 'medium'
  },

  // Dividend from unlisted companies: may change
  dividend_150_tax_collected: {
    message: 'Dividend WHT rates may differ in TY 2025-26. Verify against tax certificates.',
    severity: 'medium'
  },

  // Capital gains — rates restructured for immovable property
  immovable_property_1_year_taxable: {
    message: 'CGT rates for immovable property were restructured in Finance Act 2025. Auto-recalculated.',
    severity: 'high'
  },
  immovable_property_2_years_taxable: {
    message: 'CGT rates for immovable property were restructured in Finance Act 2025. Auto-recalculated.',
    severity: 'high'
  },
  immovable_property_3_years_taxable: {
    message: 'CGT rates for immovable property were restructured in Finance Act 2025. Auto-recalculated.',
    severity: 'high'
  },

  // Bonus shares
  bonus_shares_tax: {
    message: 'Bonus shares now taxed u/s 236Z @10% in Finance Act 2025 (previously different rate).',
    severity: 'high'
  },

  // NSS profit (previously 10%, verify if changed)
  profit_govt_securities_amount: {
    message: 'NSS profit tax rate — verify rate per Finance Act 2025 (u/s 151). Rate may differ from prior year.',
    severity: 'low'
  },
};

/**
 * Audit a mapped data object and return a flags object.
 * @param {Object} mappedData — { step: { field: value } }
 * @returns {Object} flags — { field: { message, severity, priorValue } }
 */
function auditRates(mappedData) {
  const flags = {};

  for (const [step, fields] of Object.entries(mappedData || {})) {
    for (const [field, value] of Object.entries(fields || {})) {
      if (RATE_CHANGES[field] && value !== null && value !== undefined && parseFloat(value) !== 0) {
        flags[field] = {
          ...RATE_CHANGES[field],
          step,
          priorValue: value
        };
      }
    }
  }

  return flags;
}

/**
 * Returns an array of high-severity flag messages for display in the UI.
 */
function getHighSeverityWarnings(flags) {
  return Object.entries(flags || {})
    .filter(([, f]) => f.severity === 'high')
    .map(([field, f]) => ({ field, ...f }));
}

module.exports = { auditRates, getHighSeverityWarnings, RATE_CHANGES };
