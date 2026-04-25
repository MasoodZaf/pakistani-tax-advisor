// Round-trip fixture sourced from `Salaried Individuals 2025.xlsx` at the
// repo root. The reference workbook computes its tax numbers using TY 2024-25
// (Finance Act 2024) rates, so we treat the *input cells only* as the source
// of truth. The "expected" outputs we test against come from running the
// app's own calc service against TY 2025-26 (Finance Act 2025) — this fixture
// is the user-side input, the app is the calculator.
//
// Each `inputs` block uses the DB column names the corresponding form's
// save endpoint accepts. Steps marked `endpoint: 'none'` are recorded for
// auditing in the result artifact but not POSTed (no save endpoint, or
// schema-divergent — addressed in a later sprint).

const path = require('path');

// Canonical reference file lives at the repo root, one level above e2e/.
const REFERENCE_PATH = path.resolve(__dirname, '..', '..', 'Salaried Individuals 2025.xlsx');

// ── Inputs sourced from the reference file's "input cells" ──
// Numbers are copied verbatim from the workbook's Income / Adjustable Tax /
// Capital Gain / Final Min / Tax Reduction Credit / Expenses sheets.
const inputs = {
  // POST /api/income-form/2025-26
  income: {
    endpoint: 'POST /api/income-form/:taxYear',
    payload: {
      annual_basic_salary:               7200000,
      allowances:                        6000000,
      bonus:                             1500000,
      medical_allowance:                  720000,
      pension_from_ex_employer:           400000,
      employment_termination_payment:    2000000,
      retirement_from_approved_funds:    5000000,
      directorship_fee:                    40000,
      other_cash_benefits:               1200000,
      employer_contribution_provident:    720000,
      taxable_car_value:                 1500000,
      other_taxable_subsidies:            200000,
      profit_on_debt_15_percent:          700000,
      profit_on_debt_12_5_percent:       1500000,
      other_taxable_income_rent:          700000,
      other_taxable_income_others:         50000,
    },
  },

  // POST /api/tax-forms/adjustable-tax — gross_receipt and tax_collected
  // pairs per WHT line item.
  adjustable_tax: {
    endpoint: 'POST /api/tax-forms/adjustable-tax',
    payload: {
      // R5: Salary u/s 149 — gross is auto-linked from income but we send
      // both for safety
      salary_employees_149_gross_receipt:                              16340000,
      salary_employees_149_tax_collected:                               3365000,
      // R6: Directorship u/s 149(3)
      directorship_fee_149_3_gross_receipt:                                40000,
      directorship_fee_149_3_tax_collected:                                 8000,
      // R7: Profit on debt u/s 151 @ 15%
      profit_debt_151_15_gross_receipt:                                  700000,
      profit_debt_151_15_tax_collected:                                  105000,
      // R8: Sukook u/s 151A @ 12.5%
      profit_debt_sukook_151a_gross_receipt:                            1500000,
      profit_debt_sukook_151a_tax_collected:                             187500,
      // R9: Rent u/s 155
      tax_deducted_rent_section_155_gross_receipt:                       700000,
      tax_deducted_rent_section_155_tax_collected:                            0,
      // R11: Vehicle Registration 231B(1)
      motor_vehicle_registration_fee_231b1_tax_collected:                 10000,
      // R12: Vehicle Transfer 231B(2)
      motor_vehicle_transfer_fee_231b2_gross_receipt:                   6000000,
      motor_vehicle_transfer_fee_231b2_tax_collected:                    180000,
      // R15: Electricity domestic 235
      electricity_bill_domestic_235_gross_receipt:                      1800000,
      electricity_bill_domestic_235_tax_collected:                       135000,
      // R17: Cellphone 236(1)(f)
      cellphone_bill_236_1f_gross_receipt:                               200000,
      cellphone_bill_236_1f_tax_collected:                                30000,
      // R18: Prepaid telephone card 236(1)(b)
      prepaid_telephone_card_236_1b_gross_receipt:                        25000,
      prepaid_telephone_card_236_1b_tax_collected:                         3750,
      // R29: Advance tax on motor vehicle 231B(2A)
      advance_tax_motor_vehicle_231b2a_tax_collected:                      1750,
    },
  },

  // The capital_gain_forms DB schema uses aggregated buckets
  // (property_2_3_years, property_4_plus_years, securities) while the form's
  // UI uses per-row holding-period keys with their own client-side
  // aggregation before save. Mapping the reference workbook's per-row CGT
  // values into the right buckets requires schema-aware logic that's not
  // trivial enough to belong in a fixture. Skipped in v1; the calc still
  // runs without a capital-gain row (taxableIncomeIncludingCG just equals
  // taxableIncomeExcludingCG).
  capital_gain: {
    endpoint: 'none',
    note: 'Skipped in v1 — DB schema uses aggregated buckets; UI does its own pre-save aggregation. Per-row → bucket mapping is the subject of a later sprint.',
    payload: {},
  },

  // POST /api/tax-forms/final-min-income — dividend, sukuk, prize amounts
  final_min_income: {
    endpoint: 'POST /api/tax-forms/final-min-income',
    payload: {
      dividend_u_s_150_0pc_share_profit_reit_spv_amount:                1000000,
      dividend_u_s_150_35pc_share_profit_other_spv_amount:               800000,
      dividend_u_s_150_7_5pc_ipp_shares_amount:                           50000,
      dividend_u_s_150_31pc_atl_amount:                                 1000000, // R6 in workbook (15%)
      dividend_u_s_150_25pc_bf_losses_amount:                            500000,
      return_invest_exceed_1m_sukuk_saa_12_5pc_amount:                  4000000,
      return_invest_not_exceed_1m_sukuk_saa_10pc_amount:                1000000,
      profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount:            1000000,
      profit_debt_national_savings_defence_39_14a_amount:                500000,
      prize_bond_cross_world_puzzle_156_amount:                          550000,
      prize_raffle_lottery_quiz_promotional_156_amount:                  500000,
      bonus_shares_companies_236f_amount:                                500000,
      salary_arrears_12_7_relevant_rate_amount:                         1000000,
    },
  },

  // POST /api/tax-forms/reductions
  reductions: {
    endpoint: 'POST /api/tax-forms/reductions',
    payload: {
      teacher_researcher_reduction_yn:                                       'Y',
      behbood_certificates_reduction_yn:                                     'Y',
      behbood_certificates_reduction_amount:                              400000,
      behbood_certificates_reduction_tax_reduction:                        40000,
    },
  },

  // POST /api/tax-forms/credits
  credits: {
    endpoint: 'POST /api/tax-forms/credits',
    payload: {
      charitable_donations_u61_yn:                                           'Y',
      charitable_donations_u61_amount:                                    700000,
      pension_fund_u63_yn:                                                   'Y',
      pension_fund_u63_amount:                                           5000000,
      surrender_tax_credit_investments_amount:                            100000,
    },
  },

  // POST /api/tax-forms/deductions — Zakat 75k flows here per the reference
  deductions: {
    endpoint: 'POST /api/tax-forms/deductions',
    payload: {
      zakat_paid_ordinance:                                                  'Y',
      zakat_paid_amount:                                                   75000,
      education_expense_children_count:                                        1,
    },
  },

  // POST /api/tax-forms/expenses — household expenses (no calc impact)
  expenses: {
    endpoint: 'POST /api/tax-forms/expenses',
    payload: {
      rent:                                                                   0,
      rates_taxes_charges:                                                20000,
      income_tax:                                                       6772250,
      vehicle_running_maintenance:                                       600000,
      travelling:                                                       2500000,
      electricity:                                                       750000,
      water:                                                             220000,
      gas:                                                                80000,
      telephone:                                                         250000,
      medical:                                                          2000000,
      educational:                                                      3000000,
      entertainment:                                                     800000, // Club + Functions in reference
      donations_zakat_annuity:                                          2000000,
      maintenance:                                                            0,
      other_expenses:                                                  20552750,
    },
  },

  // POST /api/tax-forms/wealth_forms — TODO: schema validation needed
  wealth: {
    endpoint: 'none',
    note: 'Skipped in v1 — schema mapping for the rich asset/liability rows in the reference file is the subject of a later sprint.',
    payload: {},
  },

  // POST /api/tax-forms/wealth_reconciliation_forms — TODO
  wealth_reconciliation: {
    endpoint: 'none',
    note: 'Skipped in v1 alongside wealth_statement.',
    payload: {},
  },
};

// Reference computation values — these were calculated against last year's
// rates (TY 2024-25), so we don't assert against them. The result artifact
// shows them side-by-side with the app's TY 2025-26 calculation as
// informational context.
const referenceComputation = {
  taxYearNote:                          'Reference figures computed under FA 2024 / TY 2024-25',
  income_from_salary:                   18610000,
  other_income_min_tax:                  2200000,
  other_income_no_min_tax:                750000,
  total_income:                         21560000,
  deductible_allowances:                   75000,
  taxable_income_excluding_cg:          21485000,
  capital_gain:                          1500000,
  taxable_income_including_cg:          22985000,
  normal_income_tax:                     6784750,
  surcharge:                              678475,
  capital_gains_tax:                      175000,
  total_before_adjustments:              7638225,
  reductions:                            1650512.72,
  credits:                               1727033.08,
  net_tax_payable:                       4260679.20,
  min_tax:                               2746250,
  total_tax_chargeable:                  7006929.20,
  withholding_tax:                       6772250,
  refund_adjustment_other_years:           75000,
  total_taxes_paid:                      6847250,
  income_tax_demanded_or_refundable:      159679.20,
};

module.exports = {
  REFERENCE_PATH,
  inputs,
  referenceComputation,
};
