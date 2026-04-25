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

  // POST /api/tax-forms/capital-gains
  // The DB uses aggregated buckets (property_1_year, property_2_3_years,
  // property_4_plus_years, securities, other_capital_gains) and computes
  // total_capital_gains / total_capital_gains_tax as GENERATED columns.
  // The reference workbook's per-row figures are aggregated into those
  // buckets here. Reference values:
  //   R6 — holding 2-3 yrs, Constructed property, Taxable=500k, WHT=50k
  //   R17 — Securities u/s 37A @12.5% pre-July 2022, Taxable=1m, WHT=125k
  capital_gain: {
    endpoint: 'POST /api/tax-forms/capital-gains',
    payload: {
      property_2_3_years:                500000,
      property_2_3_years_tax_rate:         0.10,
      property_2_3_years_tax_deducted:    50000,
      securities:                       1000000,
      securities_tax_rate:                0.125,
      securities_tax_deducted:           125000,
    },
  },

  // POST /api/tax-forms/wealth_forms — note underscore, not dash, and the
  // _forms suffix in the URL. Asset/liability rows from the reference
  // Wealth Statement sheet are aggregated into the eight per-bucket
  // columns (totals are generated).
  // Reference (Prev/Curr in PKR):
  //   Property (DHA / Bahria):                       5,000,000 / 5,000,000
  //   Investment Habib Metro:                        1,000,000 /   500,000
  //   Investment Behbood:                           12,500,000 / 20,000,000
  //   Vehicle:                                       2,500,000 / 6,000,000
  //   Jewelry:                                       1,200,000 / 1,400,000
  //   Cash:                                            500,000 /   240,000
  //   Accumulated PF:                                2,500,000 / 3,940,000
  //   Bank Loan (liability):                           500,000 /   300,000
  wealth: {
    endpoint: 'POST /api/tax-forms/wealth_forms',
    payload: {
      property_previous_year:                                          5000000,
      property_current_year:                                           5000000,
      // 1m HBL + 12.5m Behbood = 13.5m prev; 0.5m HBL + 20m Behbood = 20.5m curr
      investment_previous_year:                                       13500000,
      investment_current_year:                                        20500000,
      vehicle_previous_year:                                           2500000,
      vehicle_current_year:                                            6000000,
      jewelry_previous_year:                                           1200000,
      jewelry_current_year:                                            1400000,
      cash_previous_year:                                               500000,
      cash_current_year:                                                240000,
      pf_previous_year:                                                2500000,
      pf_current_year:                                                 3940000,
      loan_previous_year:                                               500000,
      loan_current_year:                                                300000,
    },
  },

  // POST /api/tax-forms/wealth_reconciliation_forms
  // The reference's reconciliation:
  //   Inflows: normal-tax income 24.06m + exempt 2.42m + other 2.95m +
  //            final/fixed 18.90m + non-cash adj −1.70m + remittance 5.00m
  //          = 51.63m
  //   Outflows: personal expenses 39.55m
  //   Net asset increase = 51.63m − 39.55m = 12.08m  (matches asset delta)
  //   → unreconciled_difference = 0 (the form's pass condition).
  // The DB has no `non_cash_expenses` column, so the −1.70m adjustment is
  // folded into other_receipts (18.90m + 2.95m − 1.70m = 20.15m).
  wealth_reconciliation: {
    endpoint: 'POST /api/tax-forms/wealth_reconciliation_forms',
    payload: {
      net_assets_previous_year:                                       24700000,
      net_assets_current_year:                                        36780000,
      net_assets_increase:                                            12080000,
      taxable_income:                                                 24060000,
      exempt_income:                                                   2420000,
      gift_received:                                                   5000000,
      other_receipts:                                                 20150000,
      total_inflows:                                                  51630000,
      personal_expenses:                                              39550000,
      total_outflows:                                                 39550000,
      unreconciled_difference:                                               0,
    },
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
