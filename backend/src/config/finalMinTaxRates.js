/**
 * Tax Rates for Final/Minimum Tax Income Categories (TY2025)
 * Based on FBR tax tables for dividends, profit on debt, and other final tax income
 *
 * Format: { fieldName: { atl: rate, nonAtl: rate } } or { fieldName: fixedRate }
 * ATL = Active Tax List (company paying tax)
 * Non-ATL = Not on Active Tax List (company not paying tax or individual)
 */

const FINAL_MIN_TAX_RATES = {
  // Dividend Income - Section 150
  dividend: {
    // REIT/SPV - 0% for companies on ATL
    reit_spv_0pc: {
      atl: 0.00,
      nonAtl: 0.00,
      description: 'Dividend from REIT/SPV when pass-through to CPPAG'
    },
    // Other SPV - 35%/70%
    other_spv_35pc: {
      atl: 0.35,
      nonAtl: 0.70,
      description: 'Dividend from other SPV (biomass/baggas based power projects)'
    },
    // IPP Shares - 7.5%/15%
    ipp_7_5pc: {
      atl: 0.075,
      nonAtl: 0.15,
      description: 'Dividend from IPP shares'
    },
    // Regular Dividend - Based on profit source
    regular_15pc_30pc: {
      atl: 0.15,
      nonAtl: 0.30,
      description: 'Dividend where company availing exemption or benefiting from c/f business losses & tax credits (< 50% income from profit on debt)'
    },
    regular_25pc_50pc: {
      atl: 0.25,
      nonAtl: 0.50,
      description: 'Mutual funds, REITs with 50% or more income from profit on debt'
    },
    // Dividend in specie
    specie_15pc_30pc: {
      atl: 0.15,
      nonAtl: 0.30,
      description: 'Dividend in specie'
    }
  },

  // Profit on Debt - Section 151
  profitOnDebt: {
    // For individuals/AOPs
    individual_up_to_5m: {
      rate: 0.15,
      limit: 5000000,
      description: 'Profit on debt up to Rs. 5M - Final Tax'
    },
    individual_above_5m: {
      rate: null, // Subject to minimum tax
      description: 'Profit on debt above Rs. 5M - Minimum Tax'
    },
    // Government securities via FCVA
    govt_securities_fcva: {
      rate: 0.10,
      description: 'Received by Resident Pakistanis on Government securities, purchased via FCVA under SBP Scheme - Final Tax'
    },
    // For companies
    company_received: {
      rate: 0.15,
      advanceTax: true,
      description: 'Received by Company - Advance Tax'
    }
  },

  // Investment in Sukuks - Section 151, Div. IB Pt. III 1st Schedule
  sukuks: {
    // For companies
    company: {
      atl: 0.25,
      nonAtl: 0.50,
      advanceTax: true,
      description: 'Returns received by Companies - Advance Tax'
    },
    // For individuals/AOPs
    individual_up_to_1m: {
      rate: 0.10,
      limit: 1000000,
      finalTax: true,
      description: 'Up to Rs. 1M - Final Tax'
    },
    individual_1m_to_5m: {
      rate: 0.125,
      lowerLimit: 1000001,
      upperLimit: 5000000,
      finalTax: true,
      description: 'Above Rs. 1M upto Rs. 5M - Final Tax'
    },
    individual_above_5m: {
      rate: 0.25,
      lowerLimit: 5000001,
      minimumTax: true,
      description: 'Above Rs. 5M - Minimum Tax'
    }
  },

  // Prize/Winnings
  prize: {
    // Prize bonds/crossword puzzle
    prize_bond: {
      rate: 0.15,
      description: 'Prize on Prize Bond/crossword puzzle u/s 156 - Final Tax'
    },
    // Raffle/Lottery/Quiz
    raffle_lottery: {
      rate: 0.20,
      description: 'Prize on Raffle/Lottery/Quiz/Sale promotion u/s 156 - Final Tax'
    }
  },

  // Bonus Shares
  bonus_shares: {
    rate: 0.92, // This seems like an error in the original doc, typically would be much lower
    description: 'Bonus shares issued by companies u/s 236Z'
  },

  // Employment Related
  employment: {
    // Termination benefits
    termination: {
      variableRate: true,
      description: 'Employment termination benefits u/s 12(6) - Average Rate of Tax for Calculation of salary arrears (0% To 100%)'
    },
    // Salary arrears
    arrears: {
      relevantRate: true,
      description: 'Salary Arrears u/s 12(7) - Chargeable to Tax at Relevant Rate'
    }
  }
};

/**
 * Calculate tax chargeable for a given income type and amount
 * @param {string} incomeType - Type of income (dividend, profitOnDebt, etc.)
 * @param {string} subType - Subtype within the income category
 * @param {number} amount - Amount of income
 * @param {object} options - Additional options (isATL, customRate, etc.)
 * @returns {number} - Calculated tax chargeable
 */
function calculateTaxChargeable(incomeType, subType, amount, options = {}) {
  if (!amount || amount <= 0) return 0;

  const config = FINAL_MIN_TAX_RATES[incomeType]?.[subType];
  if (!config) return 0;

  // Handle variable/relevant rate cases
  if (config.variableRate || config.relevantRate) {
    // These require custom rate from user or from tax computation
    return options.customRate ? Math.round(amount * options.customRate) : 0;
  }

  // Handle ATL/Non-ATL cases
  if (config.atl !== undefined && config.nonAtl !== undefined) {
    const rate = options.isATL ? config.atl : config.nonAtl;
    return Math.round(amount * rate);
  }

  // Handle fixed rate cases
  if (config.rate !== undefined) {
    return Math.round(amount * config.rate);
  }

  return 0;
}

/**
 * Get tax rate for display purposes
 * @param {string} incomeType - Type of income
 * @param {string} subType - Subtype within the income category
 * @param {boolean} isATL - Whether on Active Tax List
 * @returns {number|string} - Tax rate or description
 */
function getTaxRate(incomeType, subType, isATL = false) {
  const config = FINAL_MIN_TAX_RATES[incomeType]?.[subType];
  if (!config) return null;

  if (config.variableRate) return 'Variable';
  if (config.relevantRate) return 'Relevant Rate';
  if (config.atl !== undefined && config.nonAtl !== undefined) {
    return isATL ? config.atl : config.nonAtl;
  }
  return config.rate || null;
}

module.exports = {
  FINAL_MIN_TAX_RATES,
  calculateTaxChargeable,
  getTaxRate
};
