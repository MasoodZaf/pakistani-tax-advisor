const logger = require('../utils/logger');

/**
 * Comprehensive input validation middleware for tax forms
 */
class ValidationMiddleware {

  /**
   * Validate and sanitize numeric input
   * @param {*} value - Value to validate
   * @param {string} fieldName - Name of the field for error reporting
   * @param {object} options - Validation options
   * @returns {object} Validation result
   */
  static validateNumeric(value, fieldName, options = {}) {
    const { min = 0, max = 999999999, allowNull = true } = options;

    // Handle null/undefined
    if (value === null || value === undefined || value === '') {
      if (allowNull) {
        return { isValid: true, value: null, sanitized: 0 };
      } else {
        return { isValid: false, error: `${fieldName} is required` };
      }
    }

    // Convert to number
    const numericValue = parseFloat(value);

    // Check if conversion was successful
    if (isNaN(numericValue)) {
      return { isValid: false, error: `${fieldName} must be a valid number` };
    }

    // Check range
    if (numericValue < min) {
      return { isValid: false, error: `${fieldName} cannot be less than ${min}` };
    }

    if (numericValue > max) {
      return { isValid: false, error: `${fieldName} cannot be greater than ${max}` };
    }

    // Return sanitized value
    return {
      isValid: true,
      value: numericValue,
      sanitized: Math.round(numericValue * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Validate income form data
   */
  static validateIncomeForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    // Define income fields to validate
    const incomeFields = [
      'monthly_salary',
      'bonus',
      'car_allowance',
      'other_taxable',
      'medical_allowance',
      'employer_contribution',
      'other_exempt',
      'other_sources',
      'salary_tax_deducted',
      'additional_tax_deducted'
    ];

    // Validate each field
    incomeFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: 120000000, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Income form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your input and try again'
      });
    }

    // Add sanitized data to request
    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate adjustable tax form data
   */
  static validateAdjustableTaxForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    // Define adjustable tax fields to validate
    const taxFields = [
      'salary_employees_149_tax_collected',
      'directorship_fee_149_3_tax_collected',
      'electricity_bill_domestic_235_tax_collected',
      'telephone_bill_236_1e_tax_collected',
      'cellphone_bill_236_1f_tax_collected',
      'motor_vehicle_registration_fee_231b1_tax_collected',
      'motor_vehicle_transfer_fee_231b2_tax_collected',
      'motor_vehicle_sale_231b3_tax_collected',
      'sale_transfer_immoveable_property_236c_tax_collected',
      'purchase_transfer_immoveable_property_236k_tax_collected',
      'profit_debt_151_15_tax_collected',
      'advance_tax_cash_withdrawal_231ab_tax_collected',
      'total_adjustable_tax'
    ];

    // Validate each field
    taxFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: 10000000, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Adjustable tax form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your tax input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate credits form data
   */
  static validateCreditsForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    const creditFields = [
      'charitable_donation',
      'pension_contribution',
      'life_insurance_premium',
      'investment_tax_credit',
      'other_credits',
      'total_credits',
      'total_tax_credits'
    ];

    creditFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: 5000000, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Credits form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your credits input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate deductions form data
   */
  static validateDeductionsForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    const deductionFields = [
      'professional_expenses_amount',
      'zakat_paid_amount',
      'zakat',
      'advance_tax',
      'total_deductions',
      'total_deduction_from_income'
    ];

    deductionFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: 5000000, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Deductions form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your deductions input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * Validate capital gains form data
   */
  static validateCapitalGainsForm(req, res, next) {
    const errors = [];
    const sanitized = {};

    const capitalGainsFields = [
      'property_1_year',
      'property_2_3_years',
      'property_4_plus_years',
      'securities',
      'other_capital_gains',
      'total_capital_gain',
      'property_1_year_tax_due',
      'property_2_3_years_tax_due',
      'securities_tax_due',
      'other_capital_gains_tax',
      'property_1_year_tax_deducted',
      'property_2_3_years_tax_deducted',
      'securities_tax_deducted',
      'total_capital_gain_tax'
    ];

    capitalGainsFields.forEach(field => {
      const validation = ValidationMiddleware.validateNumeric(
        req.body[field],
        field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        { min: 0, max: 50000000, allowNull: true }
      );

      if (!validation.isValid) {
        errors.push(validation.error);
      } else {
        sanitized[field] = validation.sanitized;
      }
    });

    if (errors.length > 0) {
      logger.warn('Capital gains form validation errors:', { errors, userId: req.user?.id });
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        message: 'Please check your capital gains input and try again'
      });
    }

    req.sanitizedData = sanitized;
    next();
  }

  /**
   * General sanitization helper for all numeric fields
   */
  static sanitizeAllNumericFields(data) {
    const sanitized = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && /^\d*\.?\d*$/.test(value.trim())) {
        // It's a numeric string
        const numValue = parseFloat(value);
        sanitized[key] = isNaN(numValue) ? 0 : Math.round(numValue * 100) / 100;
      } else if (typeof value === 'number') {
        sanitized[key] = Math.round(value * 100) / 100;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

}

// Canonical FBR tax-year format used throughout the app/DB: "YYYY-YY"
// (e.g. "2025-26"). The previous validateTaxYear required a bare 4-digit year,
// which never matched the real format — so it was both dead AND wrong (SEC-09).
const TAX_YEAR_RE = /^\d{4}-\d{2}$/;

/**
 * Express router.param handler for ":taxYear". Register once per router with
 *   router.param('taxYear', validateTaxYearParam)
 * and every route in that router carrying a :taxYear segment is validated before
 * its handler runs — returning a clean 400 for malformed input instead of
 * silently querying with a bogus value. (taxYear is always passed to pg as a
 * bound parameter, so this is input hygiene / defense-in-depth, not an injection
 * fix.) The end year must be (start % 100) + 1, rejecting nonsense like 2025-99.
 */
function validateTaxYearParam(req, res, next, value) {
  if (!TAX_YEAR_RE.test(value)) {
    return res.status(400).json({
      error: 'Invalid tax year',
      message: 'Tax year must be in YYYY-YY format (e.g., 2025-26).',
    });
  }
  const start = parseInt(value.slice(0, 4), 10);
  const end = parseInt(value.slice(5), 10);
  if (start < 2015 || start > new Date().getFullYear() + 1 || end !== (start + 1) % 100) {
    return res.status(400).json({
      error: 'Invalid tax year',
      message: 'Tax year is out of range or its two halves are inconsistent (e.g., 2025-26).',
    });
  }
  next();
}

module.exports = ValidationMiddleware;
module.exports.validateTaxYearParam = validateTaxYearParam;
module.exports.TAX_YEAR_RE = TAX_YEAR_RE;