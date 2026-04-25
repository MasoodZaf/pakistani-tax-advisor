'use strict';

/**
 * fieldMapper.js
 * Maps FBR-standard field labels (from uploaded returns) to our internal DB field names.
 * Supports multiple source naming conventions: FBR Excel column headers, FBR JSON keys,
 * and plain-English descriptions.
 *
 * Usage:
 *   const { mapFields } = require('./fieldMapper');
 *   const mapped = mapFields(rawData);  // rawData is key-value from parser
 */

// ─── Mapping table ────────────────────────────────────────────────────────────
// Each entry: [sourceKey(s), targetField, targetStep, notes]
// sourceKey may be a string or regex (matched case-insensitively against raw keys)
const FIELD_MAP = [

  // ── Income ──────────────────────────────────────────────────────────────────
  { src: ['salary', 'annual_salary', 'salary_wages', 'total_salary'],          dst: 'annual_salary_wages_total',              step: 'income' },
  { src: ['other_income', 'income_from_other_sources'],                         dst: 'other_income_no_min_tax_total',          step: 'income' },
  { src: ['total_income', 'gross_total_income'],                                dst: 'total_income',                           step: 'income' },

  // ── Adjustable Tax (WHT) ─────────────────────────────────────────────────
  { src: ['tax_deducted_salary', 'salary_tax_deducted', 'salary_wht',
          'tax_deducted_on_salary', '149'],                                     dst: 'salary_employees_149_tax_collected',     step: 'adjustable_tax' },
  { src: ['profit_on_debt_tax', 'pob_tax', 'bank_profit_tax', '7b'],           dst: 'profit_on_debt_7b_tax_collected',        step: 'adjustable_tax' },
  { src: ['dividend_tax', 'dividend_wht', '150'],                              dst: 'dividend_150_tax_collected',             step: 'adjustable_tax' },
  { src: ['electricity_tax', 'electricity_wht', '235'],                        dst: 'electricity_bill_domestic_235_tax_collected', step: 'adjustable_tax' },
  { src: ['telephone_tax', 'mobile_tax', '236'],                               dst: 'telephone_internet_236_tax_collected',   step: 'adjustable_tax' },
  { src: ['vehicle_registration_tax', '231b'],                                  dst: 'motor_vehicle_transfer_231b2_tax_collected', step: 'adjustable_tax' },
  { src: ['brokerage_commission_tax', '233'],                                   dst: 'brokerage_commission_233_tax_collected', step: 'adjustable_tax' },

  // ── Capital Gains ──────────────────────────────────────────────────────────
  { src: ['property_gain_1_year', 'immovable_1yr', 'cg_property_1yr'],         dst: 'immovable_property_1_year_taxable',      step: 'capital_gain' },
  { src: ['property_gain_2_year', 'immovable_2yr', 'cg_property_2yr'],         dst: 'immovable_property_2_years_taxable',     step: 'capital_gain' },
  { src: ['property_gain_3_year', 'immovable_3yr', 'cg_property_3yr'],         dst: 'immovable_property_3_years_taxable',     step: 'capital_gain' },
  { src: ['securities_gain', 'cg_securities', 'capital_gain_securities'],       dst: 'securities_15_percent_taxable',         step: 'capital_gain' },
  { src: ['total_capital_gain', 'total_capital_gains', 'cg_total'],            dst: 'total_capital_gain',                    step: 'capital_gain' },

  // ── Final Tax ──────────────────────────────────────────────────────────────
  { src: ['prize_bond_winnings', 'prize_bond_amount', '156'],                  dst: 'prize_bond_winnings_amount',             step: 'final_tax' },
  { src: ['dividend_final_tax', 'dividend_listed', 'dividend_amount'],         dst: 'dividend_listed_companies_amount',       step: 'final_tax' },
  { src: ['nss_profit', 'profit_nss', 'govt_securities_profit', '151'],        dst: 'profit_govt_securities_amount',          step: 'final_tax' },

  // ── Deductions ─────────────────────────────────────────────────────────────
  { src: ['charitable_donation', 'donation_amount', '61'],                     dst: 'charitable_donation_amount',             step: 'deductions' },
  { src: ['zakat', 'zakat_paid'],                                              dst: 'zakat_deduction',                       step: 'deductions' },
  { src: ['workers_welfare_fund', 'wwf'],                                       dst: 'workers_welfare_fund',                  step: 'deductions' },

  // ── Tax Credits ────────────────────────────────────────────────────────────
  { src: ['charitable_donation_credit', 'donation_tax_credit'],                dst: 'charitable_donations_amount',            step: 'credits' },
  { src: ['pension_fund_contribution', 'pension_contribution', '63'],          dst: 'pension_fund_amount',                   step: 'credits' },

  // ── Final Min Income ────────────────────────────────────────────────────────
  { src: ['total_tax_paid', 'net_tax_paid', 'tax_paid'],                       dst: 'total_tax_deducted',                    step: 'final_min_income' },
  { src: ['tax_demanded', 'net_tax_payable', 'income_tax_demanded'],           dst: 'income_tax_demanded',                   step: 'final_min_income' },

  // ── Expenses (lifestyle — good for year-over-year carry-forward) ────────────
  { src: ['rent', 'annual_rent', 'house_rent'],                                dst: 'rent',                                  step: 'expenses' },
  { src: ['electricity_expense', 'electricity_bill', 'electricity_cost'],      dst: 'electricity',                           step: 'expenses' },
  { src: ['gas_expense', 'gas_bill', 'gas_cost'],                              dst: 'gas',                                   step: 'expenses' },
  { src: ['water_expense', 'water_bill'],                                       dst: 'water',                                 step: 'expenses' },
  { src: ['telephone_expense', 'telephone_bill', 'mobile_bill', 'internet'],   dst: 'telephone',                             step: 'expenses' },
  { src: ['medical_expense', 'health_expense', 'medical_cost'],                dst: 'medical',                               step: 'expenses' },
  { src: ['education_expense', 'school_fee', 'educational_cost'],              dst: 'educational',                           step: 'expenses' },
  { src: ['vehicle_expense', 'car_expense', 'transport_cost'],                 dst: 'vehicle',                               step: 'expenses' },
  { src: ['travel_expense', 'travelling_cost', 'travelling'],                  dst: 'travelling',                            step: 'expenses' },
  { src: ['donation_expense', 'charity_expense'],                              dst: 'donations',                             step: 'expenses' },
  { src: ['other_expense', 'miscellaneous_expense', 'other_expenses'],         dst: 'other_expenses',                        step: 'expenses' },
];

/**
 * Normalise a key for fuzzy comparison:
 * lowercase, strip special chars, collapse spaces/underscores.
 */
function normalise(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Map a raw key-value object from a parser into our internal field names.
 * Returns { mapped: { step: { field: value } }, unmatched: { key: value } }
 */
function mapFields(rawData) {
  const mapped   = {};  // { step: { field: value } }
  const unmatched= {};  // raw keys that couldn't be mapped

  for (const [rawKey, rawValue] of Object.entries(rawData || {})) {
    const normKey = normalise(rawKey);
    let foundMapping = null;

    for (const mapping of FIELD_MAP) {
      const srcKeys = Array.isArray(mapping.src) ? mapping.src : [mapping.src];
      if (srcKeys.some(s => normalise(s) === normKey)) {
        foundMapping = mapping;
        break;
      }
    }

    if (foundMapping) {
      const step = foundMapping.step;
      if (!mapped[step]) mapped[step] = {};
      mapped[step][foundMapping.dst] = rawValue;
    } else {
      unmatched[rawKey] = rawValue;
    }
  }

  return { mapped, unmatched };
}

module.exports = { mapFields, FIELD_MAP };
