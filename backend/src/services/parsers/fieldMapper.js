'use strict';

/**
 * fieldMapper.js
 * Maps FBR-standard field labels (from uploaded returns) to our internal DB
 * field names. Supports multiple source naming conventions:
 *  - FBR Excel column headers (long-form prose, e.g. "Annual Basic Salary")
 *  - FBR JSON keys (snake_case, e.g. "annual_salary")
 *  - Plain-English shorthands (e.g. "salary", "149", "7b")
 *
 * A single source key may map to multiple targets — e.g. "Directorship Fee
 * u/s 149(3)" appears on both the Income sheet (where it's the salary
 * component) and the Adjustable Tax sheet (where it's the WHT gross
 * receipt). The mapper applies *all* matching entries, so one raw value
 * can populate several (step, dbColumn) pairs.
 *
 * Usage:
 *   const { mapFields } = require('./fieldMapper');
 *   const mapped = mapFields(rawData);  // rawData is key-value from parser
 */

// ─── Mapping table ────────────────────────────────────────────────────────────
// Each entry: { src: string|string[]|RegExp, dst: dbColumn, step }
// `src` is matched after normalisation. Strings match exact-equality. Regexes
// match against the normalised key (lowercase, alphanumeric+underscore only).
// Order doesn't matter — every matching entry is applied.
const FIELD_MAP = [

  // ──────────── Income (income_forms) ─────────────────────────────────────────
  // Long-form FBR labels from the "Income" sheet of the canonical Salaried
  // Individuals 2025 template.
  { src: ['Annual Basic Salary', 'annual_basic_salary'],
    dst: 'annual_basic_salary',                      step: 'income' },
  { src: ['Allowances (excluding bonus and medical allowance)',
          'allowances', 'annual_allowances'],
    dst: 'allowances',                               step: 'income' },
  { src: ['Bonus', 'annual_bonus', 'bonus_commission'],
    dst: 'bonus',                                    step: 'income' },
  { src: ['Medical allowance (Where medical facility not provided by employer)',
          'medical_allowance'],
    dst: 'medical_allowance',                        step: 'income' },
  { src: ['Pension received from ex-employer', 'pension_from_ex_employer'],
    dst: 'pension_from_ex_employer',                 step: 'income' },
  { src: ['Employment Termination payment (Section 12 (2) e iii)',
          'employment_termination_payment'],
    dst: 'employment_termination_payment',           step: 'income' },
  { src: ['Amount received on retirement from approved funds (Provident, pension, gratuity)',
          'retirement_from_approved_funds'],
    dst: 'retirement_from_approved_funds',           step: 'income' },
  { src: ['Other cash benefits (LFA, Children education, etc.)',
          'other_cash_benefits'],
    dst: 'other_cash_benefits',                      step: 'income' },
  { src: ['Employer Contribution to Approved Provident Funds',
          'employer_contribution_provident'],
    dst: 'employer_contribution_provident',          step: 'income' },
  { src: ['Taxable value of Car provided by employer', 'taxable_car_value'],
    dst: 'taxable_car_value',                        step: 'income' },
  { src: ['Other taxable subsidies and non cash benefits',
          'other_taxable_subsidies'],
    dst: 'other_taxable_subsidies',                  step: 'income' },
  { src: ['Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)',
          'profit_on_debt_15_percent', 'profit_on_debt_151'],
    dst: 'profit_on_debt_15_percent',                step: 'income' },
  { src: ['Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)',
          'profit_on_debt_12_5_percent', 'profit_on_debt_151a'],
    dst: 'profit_on_debt_12_5_percent',              step: 'income' },
  { src: ['Other taxable income - Rent income', 'rent_income',
          'other_taxable_income_rent'],
    dst: 'other_taxable_income_rent',                step: 'income' },
  { src: ['Other taxable income - Others', 'other_income',
          'other_taxable_income_others'],
    dst: 'other_taxable_income_others',              step: 'income' },
  // Legacy short keys retained for ad-hoc imports
  { src: ['salary', 'annual_salary', 'salary_wages', 'total_salary'],
    dst: 'annual_salary_wages_total',                step: 'income' },
  { src: ['total_income', 'gross_total_income'],
    dst: 'total_income',                             step: 'income' },

  // Directorship Fee — a single label, two destinations (Income column + AT
  // gross receipt). The mapper applies both.
  { src: ['Directorship Fee u/s 149(3)', 'directorship_fee'],
    dst: 'directorship_fee',                         step: 'income' },
  { src: ['Directorship Fee u/s 149(3)', 'directorship_fee'],
    dst: 'directorship_fee_149_3_gross_receipt',     step: 'adjustable_tax' },

  // ──────────── Adjustable Tax (adjustable_tax_forms) ────────────────────────
  // The parser reads the row's first numeric (gross receipt). Tax-collected
  // requires multi-column row support — queued for a follow-up sprint.
  { src: ['Salary of Employees u/s 149'],
    dst: 'salary_employees_149_gross_receipt',       step: 'adjustable_tax' },
  { src: ['Tax deducted on Rent received (Section 155)', 'tax_deducted_rent_section_155'],
    dst: 'tax_deducted_rent_section_155_gross_receipt', step: 'adjustable_tax' },
  { src: ['Advance tax on cash withdrawal u/s 231AB', 'advance_tax_cash_withdrawal'],
    dst: 'advance_tax_cash_withdrawal_231ab_gross_receipt', step: 'adjustable_tax' },
  { src: ['Motor Vehicle Registration Fee u/s 231B(1)'],
    dst: 'motor_vehicle_registration_fee_231b1_gross_receipt', step: 'adjustable_tax' },
  { src: ['Motor Vehicle Transfer Fee u/s 231B(2)'],
    dst: 'motor_vehicle_transfer_fee_231b2_gross_receipt', step: 'adjustable_tax' },
  { src: ['Motor Vehicle Sale u/s 231B(3)'],
    dst: 'motor_vehicle_sale_231b3_gross_receipt',   step: 'adjustable_tax' },
  { src: ['Motor Vehicle Leasing u/s 231B(1A) (Non-ATL) @4%'],
    dst: 'motor_vehicle_leasing_231b1a_gross_receipt', step: 'adjustable_tax' },
  { src: ['Electricity Bill of Domestic Consumer u/s 235'],
    dst: 'electricity_bill_domestic_235_gross_receipt', step: 'adjustable_tax' },
  { src: ['Telephone Bill u/s 236(1)(a)'],
    dst: 'telephone_bill_236_1e_gross_receipt',      step: 'adjustable_tax' },
  { src: ['Cellphone Bill u/s 236(1)(a)'],
    dst: 'cellphone_bill_236_1f_gross_receipt',      step: 'adjustable_tax' },
  { src: ['Prepaid Telephone Card u/s 236(1)(b)'],
    dst: 'prepaid_telephone_card_236_1b_gross_receipt', step: 'adjustable_tax' },
  { src: ['Phone Unit u/s 236(1)(c)'],
    dst: 'phone_unit_236_1c_gross_receipt',          step: 'adjustable_tax' },
  { src: ['Internet Bill u/s 236(1)(d)'],
    dst: 'internet_bill_236_1d_gross_receipt',       step: 'adjustable_tax' },
  { src: ['Prepaid Internet Card u/s 236(1)(e)'],
    dst: 'prepaid_internet_card_236_1e_gross_receipt', step: 'adjustable_tax' },
  { src: ['Sale / Transfer of Immovable Property u/s 236C'],
    dst: 'sale_transfer_immoveable_property_236c_gross_receipt', step: 'adjustable_tax' },
  { src: ['Tax Deducted u/s 236C where Property Purchased & Sold within Tax Year'],
    dst: 'tax_deducted_236c_property_purchased_sold_same_year_gross_receipt', step: 'adjustable_tax' },
  { src: ['Tax Deducted u/s 236C where Property Purchased Prior to current Tax Year'],
    dst: 'tax_deducted_236c_property_purchased_prior_year_gross_receipt', step: 'adjustable_tax' },
  { src: ['Functions / Gatherings Charges u/s 236CB (ATL @ 10% / Non-ATL @ 20%)'],
    dst: 'functions_gatherings_charges_236cb_gross_receipt', step: 'adjustable_tax' },
  { src: ['Withholding tax on Sale Considerations u/s 37(6) @ 10% of the value of shares'],
    dst: 'withholding_tax_sale_considerations_37e_gross_receipt', step: 'adjustable_tax' },
  { src: ['Purchase / Transfer of Immovable Property u/s 236K'],
    dst: 'purchase_transfer_immoveable_property_236k_gross_receipt', step: 'adjustable_tax' },
  { src: ['Advance Tax on Withdrawal of Balance under Pension Fund u/c 23A of Part I of Second Schedule'],
    dst: 'advance_fund_23a_part_i_second_schedule_gross_receipt', step: 'adjustable_tax' },
  { src: ['Advance tax on Motor Vehicle u/s 231B(2A)'],
    dst: 'advance_tax_motor_vehicle_231b2a_gross_receipt', step: 'adjustable_tax' },
  { src: ['Persons remitting amount abroad through credit / debits / prepaid cards u/s 236Y',
          'persons_remitting_amount_abroad_236v'],
    dst: 'persons_remitting_amount_abroad_236v_gross_receipt', step: 'adjustable_tax' },
  { src: ['Advance tax on foreign domestic workers u/s 231C'],
    dst: 'advance_tax_foreign_domestic_workers_231c_gross_receipt', step: 'adjustable_tax' },
  // Profit on Debt u/s 151 — already mapped to Income, but also AT gross.
  { src: ['Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)'],
    dst: 'profit_debt_151_15_gross_receipt',         step: 'adjustable_tax' },
  { src: ['Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)'],
    dst: 'profit_debt_sukook_151a_gross_receipt',    step: 'adjustable_tax' },
  // Legacy / shorthand keys for ad-hoc imports
  { src: ['tax_deducted_salary', 'salary_tax_deducted', 'salary_wht',
          'tax_deducted_on_salary', '149'],
    dst: 'salary_employees_149_tax_collected',       step: 'adjustable_tax' },
  { src: ['profit_on_debt_tax', 'pob_tax', 'bank_profit_tax', '7b'],
    dst: 'profit_on_debt_7b_tax_collected',          step: 'adjustable_tax' },
  { src: ['dividend_tax', 'dividend_wht', '150'],
    dst: 'dividend_150_tax_collected',               step: 'adjustable_tax' },
  { src: ['electricity_tax', 'electricity_wht', '235'],
    dst: 'electricity_bill_domestic_235_tax_collected', step: 'adjustable_tax' },
  { src: ['telephone_tax', 'mobile_tax', '236'],
    dst: 'telephone_internet_236_tax_collected',     step: 'adjustable_tax' },
  { src: ['vehicle_registration_tax', '231b'],
    dst: 'motor_vehicle_transfer_231b2_tax_collected', step: 'adjustable_tax' },
  { src: ['brokerage_commission_tax', '233'],
    dst: 'brokerage_commission_233_tax_collected',   step: 'adjustable_tax' },

  // ──────────── Final / Min Income (final_min_income_forms) ──────────────────
  { src: ['Dividend u/s 150 @0% share of profit from REIT SPV'],
    dst: 'dividend_u_s_150_0pc_share_profit_reit_spv_amount', step: 'final_min_income' },
  { src: ['Dividend u/s 150 @35% share of profit from other SPV'],
    dst: 'dividend_u_s_150_35pc_share_profit_other_spv_amount', step: 'final_min_income' },
  { src: ['Dividend u/s 150 @7.5% IPP Shares'],
    dst: 'dividend_u_s_150_7_5pc_ipp_shares_amount', step: 'final_min_income' },
  { src: ['Dividend u/s 150 @15% (Dividend in kind or Mutual funds with less than 50% profit on debt)'],
    dst: 'dividend_u_s_150_31pc_atl_amount',         step: 'final_min_income' },
  { src: ['Dividend u/s 150 @25% (From Companies not paying tax due to BF losses or Mutual funds with 50% and above profit on debt)'],
    dst: 'dividend_u_s_150_25pc_bf_losses_amount',   step: 'final_min_income' },
  { src: ['Return on Investment in Sukuks u/s 151(1A) @ 25%'],
    dst: 'return_on_investment_sukuk_u_s_151_1a_25pc_amount', step: 'final_min_income' },
  { src: ['Return on Investment in Sukuks u/s 151(1A) @ 12.5% From Rs 1m to Rs 5m'],
    dst: 'return_invest_exceed_1m_sukuk_saa_12_5pc_amount', step: 'final_min_income' },
  { src: ['Return on Investment in Sukuks u/s 151(1A) @ 10% Up to Rs 1m'],
    dst: 'return_invest_not_exceed_1m_sukuk_saa_10pc_amount', step: 'final_min_income' },
  { src: [/^profit_on_debt_u_c_5_a_5aa_5ab/],
    dst: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount', step: 'final_min_income' },
  { src: ['Profit on Debt on National Savings Certificates including Defence Saving pertaining to pervious years u/s 39(4A)'],
    dst: 'profit_debt_national_savings_defence_39_14a_amount', step: 'final_min_income' },
  { src: ['Prize on Prize Bond/Cross workd puzzle u/s 156'],
    dst: 'prize_bond_cross_world_puzzle_156_amount', step: 'final_min_income' },
  { src: ['Prize on Raffle/Lottery/Quiz/Sale promotion u/s 156'],
    dst: 'prize_raffle_lottery_quiz_promotional_156_amount', step: 'final_min_income' },
  { src: ['Bonus shares issued by companies u/s 236Z'],
    dst: 'bonus_shares_companies_236f_amount',       step: 'final_min_income' },
  { src: ['Salary Arrears u/s 12(7) Chargeable to Tax at Relevant Rate'],
    dst: 'salary_arrears_12_7_relevant_rate_amount', step: 'final_min_income' },
  { src: ['Interest Income - Profit on debt u/s 7B (Profit up to 5m taxable at 15%)'],
    dst: 'interest_income_profit_debt_7b_up_to_5m_amount', step: 'final_min_income' },
  // Legacy keys
  { src: ['total_tax_paid', 'net_tax_paid', 'tax_paid'],
    dst: 'total_tax_deducted',                       step: 'final_min_income' },
  { src: ['tax_demanded', 'net_tax_payable', 'income_tax_demanded'],
    dst: 'income_tax_demanded',                      step: 'final_min_income' },

  // ──────────── Capital Gains (capital_gain_forms) ───────────────────────────
  // Reference uses long FBR holding-period descriptors. The DB has buckets;
  // we rely on the per-row payload here being post-aggregated upstream.
  { src: ['Capital Gains on Immovable Property u/s 37(1A) where holding period does not exceed 1 year'],
    dst: 'property_1_year',                          step: 'capital_gain' },
  { src: ['Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 1 year but does not exceed 2 years',
          'Capital Gains on Immovable Property u/s 37(1A) where holding period exceeds 2 years but does not exceed 3 years'],
    dst: 'property_2_3_years',                       step: 'capital_gain' },
  { src: [/^capital_gains_on_immovable_property.*exceeds_3_years/,
          /^capital_gains_on_immovable_property.*exceeds_4_years/,
          /^capital_gains_on_immovable_property.*exceeds_5_years/,
          /^capital_gains_on_immovable_property.*exceeds_6_years/],
    dst: 'property_4_plus_years',                    step: 'capital_gain' },
  { src: [/^capital_gains_on_securities/],
    dst: 'securities',                               step: 'capital_gain' },
  // Legacy keys
  { src: ['property_gain_1_year', 'immovable_1yr', 'cg_property_1yr'],
    dst: 'property_1_year',                          step: 'capital_gain' },
  { src: ['property_gain_2_year', 'immovable_2yr', 'cg_property_2yr'],
    dst: 'property_2_3_years',                       step: 'capital_gain' },
  { src: ['property_gain_3_year', 'immovable_3yr', 'cg_property_3yr'],
    dst: 'property_4_plus_years',                    step: 'capital_gain' },
  { src: ['securities_gain', 'cg_securities', 'capital_gain_securities'],
    dst: 'securities',                               step: 'capital_gain' },
  { src: ['total_capital_gain', 'total_capital_gains', 'cg_total'],
    dst: 'total_capital_gain',                       step: 'capital_gain' },

  // ──────────── Tax Reductions / Credits / Deductions ────────────────────────
  { src: [/^tax_reduction_for_full_time_teacher/],
    dst: 'teacher_researcher_reduction_yn',          step: 'reductions' },
  { src: [/^tax_reduction_on_tax_charged_on_behbood_certificates/],
    dst: 'behbood_certificates_reduction_amount',    step: 'reductions' },
  // The two ex-services capital-gain reduction rows in the reference are
  // "Y/N" gating cells — they don't carry a numeric, but we still want them
  // to map (the form's UI uses *_yn flags).
  { src: [/^tax_reduction_on_capital_gain_on_immovable_property.*ex_servicemen.*50/],
    dst: 'capital_gain_immovable_reduction_yn',      step: 'reductions' },
  { src: [/^tax_reduction_on_capital_gain_on_immovable_property.*ex_servicemen.*75/],
    dst: 'capital_gain_clause9a_reduction_yn',       step: 'reductions' },
  // Children's education expense (U/S 60D) — the deductions form has both
  // a count-of-children input and an expense amount. The reference uses
  // the long descriptive label for both rows; we map to the count column
  // since that's the more reliably-numeric of the two.
  { src: [/^educational_expense_of_children/],
    dst: 'education_expense_children_count',         step: 'deductions' },
  { src: ['Tax Credit for Charitable Donations u/s 61'],
    dst: 'charitable_donations_u61_amount',          step: 'credits' },
  { src: ['Tax Credit for Charitable Donations u/s 61 where donation is made to associate'],
    dst: 'charitable_donations_associate_amount',    step: 'credits' },
  { src: ['Tax Credit for Contribution to Approved Pension Fund u/s 63'],
    dst: 'pension_fund_u63_amount',                  step: 'credits' },
  { src: ['Surrender of Tax Credit on Investments in Shares disposed off before time limit'],
    dst: 'surrender_tax_credit_investments_amount',  step: 'credits' },
  { src: ['Zakat paid under Zakat and Usher Ordinance', 'zakat', 'zakat_paid'],
    dst: 'zakat_paid_amount',                        step: 'deductions' },
  // Legacy
  { src: ['charitable_donation', 'donation_amount', '61'],
    dst: 'charitable_donations_u61_amount',          step: 'credits' },
  { src: ['workers_welfare_fund', 'wwf'],
    dst: 'workers_welfare_fund',                     step: 'deductions' },
  { src: ['charitable_donation_credit', 'donation_tax_credit'],
    dst: 'charitable_donations_amount',              step: 'credits' },
  { src: ['pension_fund_contribution', 'pension_contribution', '63'],
    dst: 'pension_fund_amount',                      step: 'credits' },

  // ──────────── Final Tax (final_tax_forms) ──────────────────────────────────
  { src: ['prize_bond_winnings', 'prize_bond_amount', '156'],
    dst: 'prize_bond_winnings_amount',               step: 'final_tax' },
  { src: ['dividend_final_tax', 'dividend_listed', 'dividend_amount'],
    dst: 'dividend_listed_companies_amount',         step: 'final_tax' },
  { src: ['nss_profit', 'profit_nss', 'govt_securities_profit', '151'],
    dst: 'profit_govt_securities_amount',            step: 'final_tax' },

  // ──────────── Expenses (expenses_forms) ────────────────────────────────────
  { src: ['Rates / Taxes / Charge / Cess', 'rates_taxes_charges'],
    dst: 'rates_taxes_charges',                      step: 'expenses' },
  { src: ['Income Tax Paid', 'income_tax'],
    dst: 'income_tax',                               step: 'expenses' },
  { src: ['Vehicle Running / Maintenence', 'Vehicle Running / Maintenance',
          'vehicle_running_maintenance'],
    dst: 'vehicle_running_maintenance',              step: 'expenses' },
  { src: ['Travelling', 'travelling', 'travel_expense', 'travelling_cost'],
    dst: 'travelling',                               step: 'expenses' },
  { src: ['Electricity', 'electricity_expense', 'electricity_bill', 'electricity_cost'],
    dst: 'electricity',                              step: 'expenses' },
  { src: ['Water', 'water_expense', 'water_bill'],
    dst: 'water',                                    step: 'expenses' },
  { src: ['Gas', 'gas_expense', 'gas_bill', 'gas_cost'],
    dst: 'gas',                                      step: 'expenses' },
  { src: ['Telephone', 'telephone_expense', 'telephone_bill', 'mobile_bill', 'internet'],
    dst: 'telephone',                                step: 'expenses' },
  { src: ['Asset Insurance / Security'],
    dst: 'maintenance',                              step: 'expenses' }, // closest existing column
  { src: ['Medical', 'medical_expense', 'health_expense', 'medical_cost'],
    dst: 'medical',                                  step: 'expenses' },
  { src: ['Educational', 'education_expense', 'school_fee', 'educational_cost'],
    dst: 'educational',                              step: 'expenses' },
  { src: ['Club', 'Functions / Gatherings'],
    dst: 'entertainment',                            step: 'expenses' },
  { src: ['Donation, Zakat, Annuity, Profit on Debt, Life Insurance Premium, etc.',
          'donations_zakat_annuity'],
    dst: 'donations_zakat_annuity',                  step: 'expenses' },
  { src: ['Other Personal / Household Expenses', 'other_expense',
          'miscellaneous_expense', 'other_expenses'],
    dst: 'other_expenses',                           step: 'expenses' },
  // Legacy
  { src: ['rent', 'annual_rent', 'house_rent'],
    dst: 'rent',                                     step: 'expenses' },
  { src: ['vehicle_expense', 'car_expense', 'transport_cost'],
    dst: 'vehicle_running_maintenance',              step: 'expenses' },
  { src: ['donation_expense', 'charity_expense'],
    dst: 'donations_zakat_annuity',                  step: 'expenses' },

  // ──────────── Wealth Statement (wealth_forms) ──────────────────────────────
  // Reference rows have label + previousYear + currentYear; the parser only
  // captures the first numeric (previousYear). currentYear is queued for
  // multi-column row support.
  { src: [/^commercial_industrial_residential_property/],
    dst: 'property_previous_year',                   step: 'wealth' },
  { src: [/^investment_non_business/],
    dst: 'investment_previous_year',                 step: 'wealth' },
  { src: ['Motor Vehicle (Non-Business)'],
    dst: 'vehicle_previous_year',                    step: 'wealth' },
  { src: ['Precious Possession (Jewelry etc.)'],
    dst: 'jewelry_previous_year',                    step: 'wealth' },
  { src: ['Cash (Non-Business)'],
    dst: 'cash_previous_year',                       step: 'wealth' },
  { src: [/^any_other_asset/],
    dst: 'other_assets_previous_year',               step: 'wealth' },
  { src: [/^credit_non_business/],
    dst: 'loan_previous_year',                       step: 'wealth' },

  // ──────────── Wealth Reconciliation (wealth_reconciliation_forms) ──────────
  { src: ['Net Assets Current Year'],
    dst: 'net_assets_current_year',                  step: 'wealth_reconciliation' },
  { src: ['Net Assets Previous Year'],
    dst: 'net_assets_previous_year',                 step: 'wealth_reconciliation' },
  { src: ['Increase / (Decrease) in Assets', 'Net Increase/(Decrease) in in Assets'],
    dst: 'net_assets_increase',                      step: 'wealth_reconciliation' },
  { src: ['Income Declared as per Return for the year subject to Normal Tax'],
    dst: 'taxable_income',                           step: 'wealth_reconciliation' },
  { src: ['Income Declared as per Return for the year Exempt from Tax'],
    dst: 'exempt_income',                            step: 'wealth_reconciliation' },
  { src: ['Other Income'],
    dst: 'other_receipts',                           step: 'wealth_reconciliation' },
  { src: ['Foreign Remittance'],
    dst: 'gift_received',                            step: 'wealth_reconciliation' },
  { src: ['Income Attributable to Receipts, etc. Declared as per Return for the year subject to Final / Fixed Tax and CGT'],
    dst: 'other_receipts',                           step: 'wealth_reconciliation' },
  // The schema has no `non_cash_expenses` column; the reference uses this
  // row as a negative adjustment to inflows. Surface it in `loan_received`
  // (a generic inflow bucket) so it doesn't land in unmatched.
  { src: ['Non cash expenses'],
    dst: 'loan_received',                            step: 'wealth_reconciliation' },
  { src: ['Personal Expenses'],
    dst: 'personal_expenses',                        step: 'wealth_reconciliation' },
  { src: ['Unreconciled difference'],
    dst: 'unreconciled_difference',                  step: 'wealth_reconciliation' },

  // ──────────── Reductions (reductions_forms) ─────────────────────────────────
  { src: ['Teacher / Researcher amount', 'teacher_amount'],
    dst: 'teacher_amount',                           step: 'reductions' },
  { src: ['Tax Reduction - Teacher / Researcher', 'teacher_reduction'],
    dst: 'teacher_reduction',                        step: 'reductions' },
  { src: ['Tax Reduction on Behbood Certificates', 'behbood_reduction',
          'behbood_certificates_tax_reduction'],
    dst: 'behbood_reduction',                        step: 'reductions' },
  { src: ['Behbood Certificates amount', 'behbood_certificates_amount'],
    dst: 'behbood_certificates_amount',              step: 'reductions' },
  { src: ['Export income reduction', 'export_income_reduction'],
    dst: 'export_income_reduction',                  step: 'reductions' },
  { src: ['Industrial undertaking reduction', 'industrial_undertaking_reduction'],
    dst: 'industrial_undertaking_reduction',         step: 'reductions' },
  { src: ['Capital gain on immovable property - 50% reduction',
          'capital_gain_immovable_50_reduction'],
    dst: 'capital_gain_immovable_50_reduction',      step: 'reductions' },
  { src: ['Capital gain on immovable property - 75% reduction',
          'capital_gain_immovable_75_reduction'],
    dst: 'capital_gain_immovable_75_reduction',      step: 'reductions' },
  { src: ['Total reductions', 'total_reductions'],
    dst: 'total_reductions',                         step: 'reductions' },

  // ──────────── Personal Expenses (expenses_forms) ────────────────────────────
  // Mirrors FBR 114(1) Personal Expenses block (codes 7051..7087).
  { src: ['Rent', 'rent', 'house_rent'],
    dst: 'rent',                                     step: 'expenses' },
  { src: ['Rates / Taxes / Charge / Cess', 'rates_taxes_charges'],
    dst: 'rates_taxes_charges',                      step: 'expenses' },
  { src: ['Vehicle Running / Maintenance', 'vehicle_running_maintenance'],
    dst: 'vehicle_running_maintenance',              step: 'expenses' },
  { src: ['Travelling', 'travelling'],
    dst: 'travelling',                               step: 'expenses' },
  { src: ['Electricity', 'electricity'],
    dst: 'electricity',                              step: 'expenses' },
  { src: ['Water', 'water'],
    dst: 'water',                                    step: 'expenses' },
  { src: ['Gas', 'gas'],
    dst: 'gas',                                      step: 'expenses' },
  { src: ['Telephone', 'telephone'],
    dst: 'telephone',                                step: 'expenses' },
  { src: ['Medical', 'medical'],
    dst: 'medical',                                  step: 'expenses' },
  { src: ['Educational', 'educational'],
    dst: 'educational',                              step: 'expenses' },
  { src: ['Donation, Zakat, Annuity, Profit on Debt, Life Insurance Premium, etc.',
          'donations_zakat_annuity'],
    dst: 'donations_zakat_annuity',                  step: 'expenses' },
  { src: ['Other Personal / Household Expenses', 'other_expenses'],
    dst: 'other_expenses',                           step: 'expenses' },
  { src: ['Entertainment', 'entertainment'],
    dst: 'entertainment',                            step: 'expenses' },
  { src: ['Maintenance', 'maintenance'],
    dst: 'maintenance',                              step: 'expenses' },
  { src: ['Asset insurance / Security', 'asset_insurance_security'],
    dst: 'asset_insurance_security',                 step: 'expenses' },
  { src: ['Club', 'club'],
    dst: 'club',                                     step: 'expenses' },
  { src: ['Functions / Gatherings', 'functions_gatherings'],
    dst: 'functions_gatherings',                     step: 'expenses' },
  { src: ['Family Contribution', 'family_contribution'],
    dst: 'family_contribution',                      step: 'expenses' },
  { src: ['Total Personal Expenses', 'total_expenses'],
    dst: 'total_expenses',                           step: 'expenses' },

  // ──────────── Wealth Statement (wealth_forms) ──────────────────────────────
  // FBR 116 Wealth Statement — paired previous-year/current-year columns
  // per asset class. Common short labels included so ad-hoc imports work.
  { src: ['Property (previous year)', 'property_previous_year'],
    dst: 'property_previous_year',                   step: 'wealth' },
  { src: ['Property (current year)', 'property_current_year', 'immovable_property'],
    dst: 'property_current_year',                    step: 'wealth' },
  { src: ['Investment (previous year)', 'investment_previous_year'],
    dst: 'investment_previous_year',                 step: 'wealth' },
  { src: ['Investment (current year)', 'investment_current_year'],
    dst: 'investment_current_year',                  step: 'wealth' },
  { src: ['Vehicle (previous year)', 'vehicle_previous_year'],
    dst: 'vehicle_previous_year',                    step: 'wealth' },
  { src: ['Vehicle (current year)', 'vehicle_current_year', 'motor_vehicle'],
    dst: 'vehicle_current_year',                     step: 'wealth' },
  { src: ['Jewelry (previous year)', 'jewelry_previous_year'],
    dst: 'jewelry_previous_year',                    step: 'wealth' },
  { src: ['Jewelry (current year)', 'jewelry_current_year', 'precious_possession'],
    dst: 'jewelry_current_year',                     step: 'wealth' },
  { src: ['Cash (previous year)', 'cash_previous_year'],
    dst: 'cash_previous_year',                       step: 'wealth' },
  { src: ['Cash (current year)', 'cash_current_year'],
    dst: 'cash_current_year',                        step: 'wealth' },
  { src: ['Provident Fund (previous year)', 'pf_previous_year'],
    dst: 'pf_previous_year',                         step: 'wealth' },
  { src: ['Provident Fund (current year)', 'pf_current_year'],
    dst: 'pf_current_year',                          step: 'wealth' },
  { src: ['Bank Balance (previous year)', 'bank_balance_previous_year'],
    dst: 'bank_balance_previous_year',               step: 'wealth' },
  { src: ['Bank Balance (current year)', 'bank_balance_current_year'],
    dst: 'bank_balance_current_year',                step: 'wealth' },
  { src: ['Other Assets (previous year)', 'other_assets_previous_year'],
    dst: 'other_assets_previous_year',               step: 'wealth' },
  { src: ['Other Assets (current year)', 'other_assets_current_year'],
    dst: 'other_assets_current_year',                step: 'wealth' },
  { src: ['Loan (previous year)', 'loan_previous_year'],
    dst: 'loan_previous_year',                       step: 'wealth' },
  { src: ['Loan (current year)', 'loan_current_year'],
    dst: 'loan_current_year',                        step: 'wealth' },
  { src: ['Other Liabilities (previous year)', 'other_liabilities_previous_year'],
    dst: 'other_liabilities_previous_year',          step: 'wealth' },
  { src: ['Other Liabilities (current year)', 'other_liabilities_current_year'],
    dst: 'other_liabilities_current_year',           step: 'wealth' },

  // ──────────── Final Tax (final_tax_forms) ───────────────────────────────────
  { src: ['Sukuk / Bonds gross amount', 'sukuk_bonds_gross_amount'],
    dst: 'sukuk_bonds_gross_amount',                 step: 'final_tax' },
  { src: ['Sukuk / Bonds tax amount', 'sukuk_bonds_tax_amount'],
    dst: 'sukuk_bonds_tax_amount',                   step: 'final_tax' },
  { src: ['Debt Securities gross amount', 'debt_securities_gross_amount'],
    dst: 'debt_securities_gross_amount',             step: 'final_tax' },
  { src: ['Debt Securities tax amount', 'debt_securities_tax_amount'],
    dst: 'debt_securities_tax_amount',               step: 'final_tax' },
  { src: ['Prize Bonds gross amount', 'prize_bonds_gross_amount'],
    dst: 'prize_bonds_gross_amount',                 step: 'final_tax' },
  { src: ['Prize Bonds tax amount', 'prize_bonds_tax_amount'],
    dst: 'prize_bonds_tax_amount',                   step: 'final_tax' },
  { src: ['Other final tax gross amount', 'other_final_tax_gross_amount'],
    dst: 'other_final_tax_gross_amount',             step: 'final_tax' },
  { src: ['Other final tax amount', 'other_final_tax_tax_amount'],
    dst: 'other_final_tax_tax_amount',               step: 'final_tax' },
  { src: ['Total final tax', 'total_final_tax'],
    dst: 'total_final_tax',                          step: 'final_tax' },
];

/** Normalise a key for fuzzy comparison: lowercase, alphanumeric+_ only. */
function normalise(str) {
  return String(str).toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Test whether a raw key matches an entry's src.
 * `entry.src` may be a string, RegExp, or array of either.
 */
function matchesEntry(normKey, entry) {
  const list = Array.isArray(entry.src) ? entry.src : [entry.src];
  return list.some((s) => {
    if (s instanceof RegExp) return s.test(normKey);
    return normalise(s) === normKey;
  });
}

/**
 * Map a raw key-value object from a parser into our internal field names.
 * Returns { mapped: { step: { field: value } }, unmatched: { key: value } }.
 *
 * A single raw key may produce multiple mapped destinations — e.g. the
 * "Directorship Fee u/s 149(3)" label populates both income.directorship_fee
 * and adjustable_tax.directorship_fee_149_3_gross_receipt. The behaviour is
 * intentional and matches how the FBR template sheet semantics overlap.
 */
function mapFields(rawData) {
  const mapped    = {};
  const unmatched = {};

  for (const [rawKey, rawValue] of Object.entries(rawData || {})) {
    const normKey = normalise(rawKey);
    let matchedAny = false;

    for (const entry of FIELD_MAP) {
      if (!matchesEntry(normKey, entry)) continue;
      matchedAny = true;
      if (!mapped[entry.step]) mapped[entry.step] = {};
      mapped[entry.step][entry.dst] = rawValue;
    }

    if (!matchedAny) unmatched[rawKey] = rawValue;
  }

  return { mapped, unmatched };
}

module.exports = { mapFields, FIELD_MAP };
