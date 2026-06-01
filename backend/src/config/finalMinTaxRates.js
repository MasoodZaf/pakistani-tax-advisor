/**
 * Tax Rates for Final/Minimum Tax Income Categories (TY 2025-26, Finance Act 2025)
 *
 * NOTE: These are a short-term hardcoded rate set. Phase B moves all of this into
 * DB-versioned rate tables keyed by tax_year_id so that TY-on-TY changes don't
 * require a code deploy.
 *
 * Format: { fieldName: { atl: rate, nonAtl: rate } } or { fieldName: fixedRate }
 * ATL = Active Taxpayer List filer  |  Non-ATL = non-filer
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
    // For individuals/AOPs — FA 2025 raised the rate from 15% to 20%.
    individual_up_to_5m: {
      rate: 0.20,
      limit: 5000000,
      description: 'Profit on debt up to Rs. 5M - Final Tax (FA 2025: 20%)'
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

  // Bonus Shares — WHT u/s 236Z is 10% (was previously seeded at 0.92 in error).
  bonus_shares: {
    rate: 0.10,
    description: 'Bonus shares issued by companies u/s 236Z (10%)'
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

/**
 * Per-FIELD statutory final-tax rates (TY 2025-26) for the Final/Min Income
 * form's save path. A field appears here ONLY when its rate is unambiguous —
 * the rate encoded in the field name, the inline FBR-section comment in
 * taxForms.js, AND the category rates in FINAL_MIN_TAX_RATES above all agree,
 * and the rate is fixed (NOT ATL-dependent).
 *
 * Used to set tax_chargeable = gross × rate (audit TAX-01). Previously every
 * line set tax_chargeable = tax_deducted, so an under-withheld line cancelled
 * itself out and silently filed an UNDER-STATED return.
 *
 * ⚠️  RATE SIGN-OFF: confirm these 12 rates against the current Income Tax
 *     Ordinance before relying on them. Lines intentionally OMITTED (so the
 *     caller keeps tax_chargeable = tax_deducted) because the rate is
 *     ATL-dependent, variable, or the sources disagree:
 *       • dividend_u_s_150_31pc_atl              — field 31% vs comment+config 15% (CONFLICT)
 *       • profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc — 10% ATL / 20% non-ATL (needs filer ATL)
 *       • interest_income_profit_debt_7b_up_to_5m — comment 15% vs config 20% (FA2025 CONFLICT)
 *       • profit_debt_national_savings_defence_39_14a — variable
 *       • employment_termination_benefits_12_6_avg_rate — average rate (variable)
 *       • salary_arrears_12_7_relevant_rate       — relevant rate (variable)
 *       • salary_u_s_12_7                          — computed from the main tax computation
 *       • capital_gain                             — owned by the Capital Gains form
 */
const FINAL_MIN_FIELD_RATE = {
  dividend_u_s_150_0pc_share_profit_reit_spv:    0.00,
  dividend_u_s_150_35pc_share_profit_other_spv:  0.35,
  dividend_u_s_150_7_5pc_ipp_shares:             0.075,
  dividend_u_s_150_25pc_bf_losses:               0.25,
  return_on_investment_sukuk_u_s_151_1a_10pc:    0.10,
  return_on_investment_sukuk_u_s_151_1a_12_5pc:  0.125,
  return_on_investment_sukuk_u_s_151_1a_25pc:    0.25,
  return_invest_exceed_1m_sukuk_saa_12_5pc:      0.125,
  return_invest_not_exceed_1m_sukuk_saa_10pc:    0.10,
  prize_raffle_lottery_quiz_promotional_156:     0.20,
  prize_bond_cross_world_puzzle_156:             0.15,
  bonus_shares_companies_236f:                   0.10,
};

/**
 * Compute a final/min line's tax_chargeable.
 *   - Signed-off line (in FINAL_MIN_FIELD_RATE): chargeable = gross × rate when
 *     the gross amount is provided; otherwise fall back to the withheld amount
 *     (some users enter only the WHT certificate value — never invent a refund).
 *   - Any other line: keep the withheld amount (its prior behaviour) until the
 *     rate is signed off.
 * @param {string} fieldBase  e.g. 'prize_bond_cross_world_puzzle_156'
 * @param {number} grossAmount
 * @param {number} taxDeducted
 * @returns {number} integer rupees
 */
function lineChargeable(fieldBase, grossAmount, taxDeducted) {
  const rate = FINAL_MIN_FIELD_RATE[fieldBase];
  const deducted = Number(taxDeducted) || 0;
  if (rate == null) return deducted;
  const amount = Number(grossAmount) || 0;
  return amount > 0 ? Math.round(amount * rate) : deducted;
}

module.exports = {
  FINAL_MIN_TAX_RATES,
  calculateTaxChargeable,
  getTaxRate,
  FINAL_MIN_FIELD_RATE,
  lineChargeable,
};
