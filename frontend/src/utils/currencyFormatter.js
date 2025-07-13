/**
 * Pakistani Currency Formatter Utility
 * Handles PKR formatting with proper comma placement and display
 */

/**
 * Format number as Pakistani currency (PKR)
 * @param {number|string} amount - The amount to format
 * @param {object} options - Formatting options
 * @returns {string} - Formatted currency string
 */
export const formatPKR = (amount, options = {}) => {
  const {
    showCurrency = true,
    showDecimals = false,
    currencySymbol = 'Rs.',
    locale = 'en-PK'
  } = options;

  // Handle null, undefined, or empty values
  if (amount === null || amount === undefined || amount === '') {
    return showCurrency ? `${currencySymbol} 0` : '0';
  }

  // Convert to number if it's a string
  const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  
  // Handle invalid numbers
  if (isNaN(numAmount)) {
    return showCurrency ? `${currencySymbol} 0` : '0';
  }

  // Format number with Pakistani locale (commas)
  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(numAmount);

  return showCurrency ? `${currencySymbol} ${formattedNumber}` : formattedNumber;
};

/**
 * Parse PKR formatted string back to number
 * @param {string} formattedAmount - The formatted currency string
 * @returns {number} - Parsed number value
 */
export const parsePKR = (formattedAmount) => {
  if (!formattedAmount || typeof formattedAmount !== 'string') {
    return 0;
  }

  // Remove currency symbols and commas, keep only numbers and decimal point
  const cleanAmount = formattedAmount.replace(/[^0-9.-]/g, '');
  const parsedAmount = parseFloat(cleanAmount);
  
  return isNaN(parsedAmount) ? 0 : parsedAmount;
};

/**
 * Format input value in real-time as user types
 * @param {string} value - Current input value
 * @returns {string} - Formatted value for display
 */
export const formatInputPKR = (value) => {
  // Remove all non-numeric characters except decimal point
  const cleanValue = value.replace(/[^0-9.]/g, '');
  
  // Handle multiple decimal points
  const parts = cleanValue.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';
  
  // Format integer part with commas
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return formattedInteger + decimalPart;
};

/**
 * Validate PKR amount
 * @param {number|string} amount - Amount to validate
 * @param {object} options - Validation options
 * @returns {object} - Validation result
 */
export const validatePKRAmount = (amount, options = {}) => {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    required = false
  } = options;

  const numAmount = typeof amount === 'string' ? parsePKR(amount) : amount;

  // Check if required
  if (required && (numAmount === null || numAmount === undefined || numAmount === 0)) {
    return {
      isValid: false,
      error: 'Amount is required'
    };
  }

  // Check if valid number
  if (isNaN(numAmount)) {
    return {
      isValid: false,
      error: 'Invalid amount format'
    };
  }

  // Check minimum value
  if (numAmount < min) {
    return {
      isValid: false,
      error: `Amount must be at least ${formatPKR(min)}`
    };
  }

  // Check maximum value
  if (numAmount > max) {
    return {
      isValid: false,
      error: `Amount cannot exceed ${formatPKR(max)}`
    };
  }

  return {
    isValid: true,
    value: numAmount,
    error: null
  };
};

/**
 * Tax calculation helper - format tax breakdown
 * @param {object} taxBreakdown - Tax calculation result
 * @returns {object} - Formatted tax breakdown
 */
export const formatTaxBreakdown = (taxBreakdown) => {
  if (!taxBreakdown) return null;

  return {
    ...taxBreakdown,
    income: formatPKR(taxBreakdown.income),
    taxableIncome: formatPKR(taxBreakdown.taxableIncome),
    totalTax: formatPKR(taxBreakdown.totalTax),
    netIncome: formatPKR(taxBreakdown.netIncome),
    slabs: taxBreakdown.slabs?.map(slab => ({
      ...slab,
      min: formatPKR(slab.min),
      max: slab.max ? formatPKR(slab.max) : 'Above',
      taxableAmount: formatPKR(slab.taxableAmount),
      tax: formatPKR(slab.tax)
    }))
  };
}; 