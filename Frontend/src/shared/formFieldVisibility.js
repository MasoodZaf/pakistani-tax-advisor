// shared/formFieldVisibility.js
//
// Field-level visibility manifest for the 12 tax-return forms. Declared per
// (table, column) and consumed by both web and (eventually) mobile form
// components. Drives the "Only the relevant fields appear in your filing
// flow" promise that the existing income-streams Settings panel makes —
// see screenshot in 2026-05-24 review.
//
// Today the codebase only prunes 2 of 12 forms at the sidebar level
// (capital_gain, final_tax). NO form component prunes its own fields by
// addon. This manifest changes that.
//
// ─── Three buckets ──────────────────────────────────────────────────────
//
//   ALWAYS_VISIBLE[table] = [columns]
//     Universally relevant for ANY filer (the salaried baseline). Income
//     basics, salary WHT, household WHT lines that almost everyone has
//     (electricity, mobile phone), Zakat, donations, kids' education,
//     wealth statement + reconciliation (FBR-mandatory regardless of
//     income type).
//
//   ADDON_UNLOCKS[addon][table] = [columns]
//     Visible only when the user has selected the given income addon in
//     Settings → Income Streams (income_profile.addons). One addon can
//     unlock fields across multiple form tables — e.g. selecting `rental`
//     reveals other_taxable_income_rent on income_forms AND
//     tax_deducted_rent_section_155_* on adjustable_tax_forms.
//
//   ADVANCED[table] = [columns]
//     Hidden by default; revealed when the user clicks "Show advanced
//     fields" at the bottom of a form. Covers seldom-used WHT lines
//     (vehicle transfer/sale, landline phone, gatherings, foreign-domestic-
//     workers), niche credits (life insurance, investment shares), legacy
//     columns kept for back-compat, and reductions only specific
//     professions need (teacher/researcher, behbood certificates, export
//     income, industrial undertaking).
//
// ─── What's NOT in any bucket ──────────────────────────────────────────
//
// Generated columns (DB GENERATED ALWAYS AS …) and totals computed by the
// app aren't user inputs and don't appear here. The visibility check is
// only for user-editable inputs.
//
// ─── Addon catalog (matches Onboarding INCOME_STREAMS) ─────────────────
//
//   bank_profit, dividends, securities, sukuk, rental, property_gain,
//   directorship, foreign_income, prizes, pension, agriculture
//
// ─── Helpers ───────────────────────────────────────────────────────────
//
//   visibleFieldsFor(table, addons, { advanced })
//     Returns a Set<column> the caller can use to gate form sections:
//       if (visible.has('zakat_paid_amount')) { render(...) }
//
//   computeUserField(table, column)
//     Returns 'always' | 'addon' | 'advanced' | 'unknown' for diagnostics.
//
// CommonJS so backend can require it too. Mobile imports via Metro's
// watchFolders pointing at /shared/.

// ───────────────────────────────────────────────────────────────────────
// ALWAYS_VISIBLE — salaried-baseline columns shown to every filer.
// ───────────────────────────────────────────────────────────────────────
const ALWAYS_VISIBLE = Object.freeze({
  // income_forms — salary basics + employment benefits. Every salaried
  // filer needs at least the salary components; exempt-income amounts
  // are also baseline since they affect the gross.
  income_forms: [
    'annual_basic_salary',
    'allowances',
    'bonus',
    'medical_allowance',
    'employment_termination_payment',
    'retirement_from_approved_funds',
    'other_cash_benefits',
    'employer_contribution_provident',
    'taxable_car_value',
    'other_taxable_subsidies',
  ],

  // adjustable_tax_forms — universal WHT lines. Salary WHT (s.149) is
  // the load-bearing one. Electricity/cellphone WHT is almost universal
  // in Pakistan. Cash-withdrawal WHT applies to anyone whose bank
  // transactions cross the threshold.
  adjustable_tax_forms: [
    'salary_employees_149_gross_receipt',
    'salary_employees_149_tax_collected',
    'electricity_bill_domestic_235_gross_receipt',
    'electricity_bill_domestic_235_tax_collected',
    'cellphone_bill_236_1f_gross_receipt',
    'cellphone_bill_236_1f_tax_collected',
    'advance_tax_cash_withdrawal_231ab_gross_receipt',
    'advance_tax_cash_withdrawal_231ab_tax_collected',
    'motor_vehicle_registration_fee_231b1_gross_receipt',
    'motor_vehicle_registration_fee_231b1_tax_collected',
  ],

  // deductions_forms — universal deductions. Zakat is common enough to
  // be baseline; education-expenses applies to anyone with kids.
  // professional_expenses is the salaried-employee allowance most filers
  // claim.
  deductions_forms: [
    'zakat_paid_amount',
    'zakat_paid_ordinance_yn',
    'professional_expenses_amount',
    'professional_expenses_yn',
    'educational_expenses_amount',
    'educational_expenses_children_count',
    'educational_expenses_yn',
    'advance_tax',         // generic advance-tax-paid line; universal
    'other_deductions',    // catch-all
  ],

  // credits_forms — only the universally-relevant charitable-donations
  // section is baseline. Pension/insurance/investment credits move to
  // ADVANCED unless the user has a relevant income addon (e.g. pension).
  credits_forms: [
    'charitable_donations_yn',
    'charitable_donations_amount',
    'charitable_donations_tax_credit',
  ],

  // expenses_forms — household expenses summary (Annex-D-style). FBR
  // expects a basic breakdown from every filer.
  expenses_forms: [
    'rent',
    'rates_taxes_charges',
    'income_tax',
    'vehicle_running_maintenance',
    'travelling',
    'electricity',
    'water',
    'gas',
    'telephone',
    'medical',
    'educational',
    'donations_zakat_annuity',
    'other_expenses',
    'maintenance',
    'net_expenses_by_taxpayer',
    'family_contribution',
  ],

  // wealth_forms — FBR-mandatory wealth statement. Every column is a
  // user input. Asset prior/current pairs + liabilities.
  wealth_forms: [
    'property_previous_year', 'property_current_year',
    'investment_previous_year', 'investment_current_year',
    'vehicle_previous_year', 'vehicle_current_year',
    'jewelry_previous_year', 'jewelry_current_year',
    'cash_previous_year', 'cash_current_year',
    'pf_previous_year', 'pf_current_year',
    'bank_balance_previous_year', 'bank_balance_current_year',
    'other_assets_previous_year', 'other_assets_current_year',
    'loan_previous_year', 'loan_current_year',
    'other_liabilities_previous_year', 'other_liabilities_current_year',
  ],

  // wealth_reconciliation_forms — also FBR-mandatory. Every column
  // potentially relevant; unreconciled_difference is the load-bearing
  // one (must be near-zero or FBR rejects the return).
  wealth_reconciliation_forms: [
    'net_assets_current_year',
    'net_assets_previous_year',
    'net_assets_increase',
    'income_normal_tax',
    'income_exempt_from_tax',
    'income_final_tax',
    'foreign_remittance',
    'inheritance',
    'gift_value',
    'asset_disposal_gain_loss',
    'other_inflows',
    'personal_expenses',
    'adjustments_outflows',
    'gift_outflow',
    'loss_on_disposal',
    'unreconciled_difference',
  ],

  // tax_computation_forms — mostly computed/derived. Only a handful are
  // ever user-editable; most flow from upstream forms.
  tax_computation_forms: [
    'income_from_salary',
    'other_income_subject_to_min_tax',
    'income_loss_other_sources',
    'deductible_allowances',
    'capital_gains_loss',
    'advance_tax_paid',
  ],

  // final_min_income_forms — the salary lines taxed at the FBR slab / relevant
  // rate are the salaried baseline (auto-populated from the income form), so
  // every filer can see + edit them. Other final-tax buckets (dividends, sukuk,
  // prizes, profit-on-debt) stay addon-gated below. Without these the Salary and
  // Salary-Arrears rows never rendered, so that income was unenterable (UX-04).
  final_min_income_forms: [
    'salary_u_s_12_7',
    'salary_u_s_12_7_tax_deducted',
    'salary_u_s_12_7_tax_chargeable',
    'salary_arrears_12_7_relevant_rate_amount',
    'salary_arrears_12_7_relevant_rate_tax_deducted',
    'salary_arrears_12_7_relevant_rate_tax_chargeable',
  ],
});

// ───────────────────────────────────────────────────────────────────────
// ADDON_UNLOCKS — addon → table → columns.
// ───────────────────────────────────────────────────────────────────────
const ADDON_UNLOCKS = Object.freeze({
  // ─── bank_profit ─────────────────────────────────────────────────
  // Bank/savings profit. Goes to final_min_income_forms as "profit on
  // debt" (s.7B for amounts up to 5M, s.151 for larger; defence-savings
  // and NSS have their own buckets). Adjustable-tax side captures the
  // bank's WHT (s.151).
  bank_profit: {
    adjustable_tax_forms: [
      'profit_debt_151_15_gross_receipt',
      'profit_debt_151_15_tax_collected',
    ],
    final_min_income_forms: [
      'profit_on_debt_u_s_7b',
      'profit_on_debt_u_s_7b_tax_chargeable',
      'profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10p',
      'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc',
      'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted',
      'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable',
      'profit_on_debt_national_savings_certificates_including_defence_',
      'profit_debt_national_savings_defence_39_14a',
      'profit_debt_national_savings_defence_39_14a_tax_deducted',
      'profit_debt_national_savings_defence_39_14a_tax_chargeable',
      'interest_income_profit_debt_7b_up_to_5m',
      'interest_income_profit_debt_7b_up_to_5m_tax_deducted',
      'interest_income_profit_debt_7b_up_to_5m_tax_chargeable',
    ],
  },

  // ─── dividends ───────────────────────────────────────────────────
  // Dividends from listed/unlisted shares. Final tax under s.150 at
  // 15% (ATL) / 30% (non-ATL) for most; REIT/SPV special rates.
  dividends: {
    final_min_income_forms: [
      'dividend_u_s_150_exempt_profit_rate_mlt_30',
      'dividend_u_s_150_31_atl_15pc',
      'dividend_u_s_150_56_10_shares',
      'dividend_u_s_150_0pc_share_profit_reit_spv',
      'dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted',
      'dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable',
      'dividend_u_s_150_35pc_share_profit_other_spv',
      'dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted',
      'dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable',
      'dividend_u_s_150_7_5pc_ipp_shares',
      'dividend_u_s_150_7_5pc_ipp_shares_tax_deducted',
      'dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable',
      'dividend_u_s_150_31pc_atl',
      'dividend_u_s_150_31pc_atl_tax_deducted',
      'dividend_u_s_150_31pc_atl_tax_chargeable',
      'dividend_u_s_150_25pc_bf_losses',
      'dividend_u_s_150_25pc_bf_losses_tax_deducted',
      'dividend_u_s_150_25pc_bf_losses_tax_chargeable',
    ],
  },

  // ─── securities ───────────────────────────────────────────────────
  // Capital gains on listed shares / mutual funds / REIT units. Goes
  // to capital_gain_forms; CGT rates vary by holding period and asset
  // class (7+ buckets in the engine).
  securities: {
    capital_gain_forms: [
      'securities', 'securities_tax_rate', 'securities_tax_deducted',
      'securities_before_july_2013_taxable',
      'securities_before_july_2013_deducted',
      'securities_before_july_2013_carryable',
      'securities_pmex_settled_taxable',
      'securities_pmex_settled_deducted',
      'securities_pmex_settled_carryable',
      'securities_37a_7_5_percent_taxable',
      'securities_37a_7_5_percent_deducted',
      'securities_37a_7_5_percent_carryable',
      'securities_mutual_funds_10_percent_taxable',
      'securities_mutual_funds_10_percent_deducted',
      'securities_mutual_funds_10_percent_carryable',
      'securities_mutual_funds_12_5_percent_taxable',
      'securities_mutual_funds_12_5_percent_deducted',
      'securities_mutual_funds_12_5_percent_carryable',
      'securities_other_25_percent_taxable',
      'securities_other_25_percent_deducted',
      'securities_other_25_percent_carryable',
      'securities_12_5_percent_before_july_2022_taxable',
      'securities_12_5_percent_before_july_2022_deducted',
      'securities_12_5_percent_before_july_2022_carryable',
      'securities_15_percent_taxable',
      'securities_15_percent_deducted',
      'securities_15_percent_carryable',
      'sec_pre_2013', 'sec_pre_2013_deducted',
      'sec_pmex', 'sec_pmex_deducted',
      'sec_7_5_percent', 'sec_7_5_percent_deducted',
      'sec_10_percent', 'sec_10_percent_deducted',
      'sec_12_5_percent', 'sec_12_5_percent_deducted',
      'sec_25_percent', 'sec_25_percent_deducted',
      'sec_pre_2022', 'sec_pre_2022_deducted',
      'sec_15_percent', 'sec_15_percent_deducted',
      'capital_gains_tax_chargeable',
    ],
    final_min_income_forms: [
      'capital_gain', 'capital_gain_tax_deducted', 'capital_gain_tax_chargeable',
    ],
  },

  // ─── sukuk ───────────────────────────────────────────────────────
  // Sukuk / Islamic bond income. Final tax under s.151(1A); rate varies
  // by tenor and investor type.
  sukuk: {
    adjustable_tax_forms: [
      'profit_debt_sukook_151a_gross_receipt',
      'profit_debt_sukook_151a_tax_collected',
    ],
    final_min_income_forms: [
      'return_on_investment_sukuk_u_s_151_1a_10pc',
      'return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted',
      'return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable',
      'return_on_investment_sukuk_u_s_151_1a_12_5pc',
      'return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted',
      'return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable',
      'return_on_investment_sukuk_u_s_151_1a_25pc',
      'return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted',
      'return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable',
      'return_on_investment_sukuk_u_s_151_1b_15pc',
      'return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u',
      'return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc',
      'return_invest_exceed_1m_sukuk_saa_12_5pc',
      'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted',
      'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable',
      'return_invest_not_exceed_1m_sukuk_saa_10pc',
      'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted',
      'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable',
    ],
    final_tax_forms: [
      'sukuk_amount', 'sukuk_tax_rate',
      'sukuk_bonds_yn', 'sukuk_bonds_gross_amount',
      'sukuk_bonds_tax_rate', 'sukuk_bonds_tax_amount',
      'debt_amount', 'debt_tax_rate',
      'debt_securities_yn', 'debt_securities_gross_amount',
      'debt_securities_tax_rate', 'debt_securities_tax_amount',
    ],
  },

  // ─── rental ───────────────────────────────────────────────────────
  // Rental income. Counted as "other taxable income" on income_forms.
  // Tenant withholds tax under s.155. Property maintenance + insurance
  // become expense items.
  rental: {
    income_forms: ['other_taxable_income_rent'],
    adjustable_tax_forms: [
      'tax_deducted_rent_section_155_gross_receipt',
      'tax_deducted_rent_section_155_tax_collected',
    ],
    expenses_forms: ['asset_insurance_security'],
  },

  // ─── property_gain ────────────────────────────────────────────────
  // Capital gain on sale of immovable property. CGT under s.37(1A); rate
  // depends on holding period (Finance Act 2025 schedule). 236C
  // withholding at registry.
  property_gain: {
    capital_gain_forms: [
      'property_1_year', 'property_1_year_tax_rate', 'property_1_year_tax_deducted',
      'property_2_3_years', 'property_2_3_years_tax_rate', 'property_2_3_years_tax_deducted',
      'property_4_plus_years', 'property_4_plus_years_tax_deducted',
      'property_2_year', 'property_2_year_tax_deducted',
      'property_3_year', 'property_3_year_tax_deducted',
      'property_4_year', 'property_4_year_tax_deducted',
      'property_5_year', 'property_5_year_tax_deducted',
      'property_6_year', 'property_6_year_tax_deducted',
      'property_over_6_year', 'property_over_6_year_tax_deducted',
      'property_1_2_years', 'property_1_2_years_tax_rate',
      'property_3_4_years', 'property_3_4_years_tax_rate',
      'property_4_5_years', 'property_4_5_years_tax_rate',
      'property_5_6_years', 'property_5_6_years_tax_rate',
      'property_plot_1_year', 'property_constructed_1_year', 'property_flat_1_year',
      'property_plot_2_3_years', 'property_constructed_2_3_years', 'property_flat_2_3_years',
      'immovable_property_1_year_taxable', 'immovable_property_1_year_deducted', 'immovable_property_1_year_carryable',
      'immovable_property_2_years_taxable', 'immovable_property_2_years_deducted', 'immovable_property_2_years_carryable',
      'immovable_property_3_years_taxable', 'immovable_property_3_years_deducted', 'immovable_property_3_years_carryable',
      'immovable_property_4_years_taxable', 'immovable_property_4_years_deducted', 'immovable_property_4_years_carryable',
      'immovable_property_5_years_taxable', 'immovable_property_5_years_deducted', 'immovable_property_5_years_carryable',
      'immovable_property_6_years_taxable', 'immovable_property_6_years_deducted', 'immovable_property_6_years_carryable',
      'immovable_property_over_6_years_taxable',
      'immovable_property_over_6_years_deducted',
      'immovable_property_over_6_years_carryable',
      'immovable_property_1_year_type', 'immovable_property_2_years_type',
      'immovable_property_3_years_type', 'immovable_property_4_years_type',
      'immovable_property_5_years_type', 'immovable_property_6_years_type',
      'immovable_property_over_6_years_type',
      'other_capital_gains', 'other_capital_gains_tax',
    ],
    adjustable_tax_forms: [
      'sale_transfer_immoveable_property_236c_gross_receipt',
      'sale_transfer_immoveable_property_236c_tax_collected',
      'tax_deducted_236c_property_purchased_sold_same_year_gross_recei',
      'tax_deducted_236c_property_purchased_sold_same_year_tax_collect',
      'tax_deducted_236c_property_purchased_prior_year_gross_receipt',
      'tax_deducted_236c_property_purchased_prior_year_tax_collected',
      'purchase_transfer_immoveable_property_236k_gross_receipt',
      'purchase_transfer_immoveable_property_236k_tax_collected',
      'withholding_tax_sale_considerations_37e_gross_receipt',
      'withholding_tax_sale_considerations_37e_tax_collected',
    ],
    reductions_forms: [
      'capital_gain_immovable_50_reduction',
      'capital_gain_immovable_75_reduction',
    ],
  },

  // ─── directorship ─────────────────────────────────────────────────
  // Director's / board fees. Treated as employment income for tax but
  // withheld under s.149(3) (different line from regular salary WHT).
  directorship: {
    income_forms: ['directorship_fee'],
    adjustable_tax_forms: [
      'directorship_fee_149_3_gross_receipt',
      'directorship_fee_149_3_tax_collected',
    ],
  },

  // ─── foreign_income ───────────────────────────────────────────────
  // Foreign-source income + foreign tax credit. WHT on overseas
  // remittances (s.236V) + foreign-domestic-workers (s.231C) become
  // relevant when the user has cross-border income.
  foreign_income: {
    income_forms: ['other_taxable_income_others'],
    deductions_forms: ['tax_paid_foreign_country'],
    adjustable_tax_forms: [
      'persons_remitting_amount_abroad_236v_gross_receipt',
      'persons_remitting_amount_abroad_236v_tax_collected',
      'advance_tax_foreign_domestic_workers_231c_gross_receipt',
      'advance_tax_foreign_domestic_workers_231c_tax_collected',
    ],
    // foreign_remittance on wealth_reconciliation_forms is already in
    // ALWAYS_VISIBLE — every filer sees it on the reconciliation form
    // regardless of addon.
  },

  // ─── prizes ───────────────────────────────────────────────────────
  // Prize bonds / lottery / quiz / raffle. Final tax under s.156 at
  // 15% / 25% depending on bond class. Bonus shares (s.236F) also live
  // here per the FBR schedule.
  prizes: {
    final_min_income_forms: [
      'prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156',
      'prize_raffle_lottery_quiz_promotional_156',
      'prize_raffle_lottery_quiz_promotional_156_tax_deducted',
      'prize_raffle_lottery_quiz_promotional_156_tax_chargeable',
      'prize_bond_cross_world_puzzle_156',
      'prize_bond_cross_world_puzzle_156_tax_deducted',
      'prize_bond_cross_world_puzzle_156_tax_chargeable',
      'bonus_shares_issued_by_companies_u_s_236f',
      'bonus_shares_companies_236f',
      'bonus_shares_companies_236f_tax_deducted',
      'bonus_shares_companies_236f_tax_chargeable',
    ],
    final_tax_forms: [
      'prize_bonds', 'prize_bonds_tax',
      'prize_bonds_yn', 'prize_bonds_gross_amount',
      'prize_bonds_tax_rate', 'prize_bonds_tax_amount',
    ],
  },

  // ─── pension ──────────────────────────────────────────────────────
  // Pension from former employer (Finance Act 2025: taxable above
  // Rs 10M). Also unlocks pension-contribution + voluntary-pension-
  // scheme tax credits since the user has pension-related activity.
  pension: {
    income_forms: ['pension_from_ex_employer'],
    credits_forms: [
      'pension_contribution_yn',
      'pension_contribution_amount',
      'pension_contribution_tax_credit',
      'pension_fund_u63_yn',
      'pension_fund_amount',
      'pension_fund_tax_credit',
      'voluntary_pension_scheme_yn',
      'voluntary_pension_scheme_amount',
      'voluntary_pension_scheme_tax_credit',
    ],
  },

  // ─── agriculture ──────────────────────────────────────────────────
  // Federally exempt; FBR requires the declaration in income_exempt
  // bucket of the reconciliation form. Ushr (Islamic agricultural tithe)
  // also relevant.
  agriculture: {
    deductions_forms: ['ushr'],
    // income_exempt_from_tax on wealth_reconciliation_forms is already in
    // ALWAYS_VISIBLE — every filer sees the exempt-income inflow line on
    // the reconciliation regardless of addon.
  },
});

// ───────────────────────────────────────────────────────────────────────
// ADVANCED — visible only under "Show advanced fields" expander.
// Seldom-used WHT lines, niche credits, legacy/duplicate columns.
// ───────────────────────────────────────────────────────────────────────
const ADVANCED = Object.freeze({
  income_forms: [
    'profit_on_debt_15_percent',   // legacy; bank_profit addon covers
    'profit_on_debt_12_5_percent', // legacy; sukuk addon covers
  ],

  adjustable_tax_forms: [
    // Vehicle transactions outside the common registration-fee line
    'motor_vehicle_transfer_fee_231b2_gross_receipt',
    'motor_vehicle_transfer_fee_231b2_tax_collected',
    'motor_vehicle_sale_231b3_gross_receipt',
    'motor_vehicle_sale_231b3_tax_collected',
    'motor_vehicle_leasing_231b1a_gross_receipt',
    'motor_vehicle_leasing_231b1a_tax_collected',
    'advance_tax_motor_vehicle_231b2a_gross_receipt',
    'advance_tax_motor_vehicle_231b2a_tax_collected',
    // Landline + niche communication WHT lines
    'telephone_bill_236_1e_gross_receipt',
    'telephone_bill_236_1e_tax_collected',
    'prepaid_telephone_card_236_1b_gross_receipt',
    'prepaid_telephone_card_236_1b_tax_collected',
    'phone_unit_236_1c_gross_receipt',
    'phone_unit_236_1c_tax_collected',
    'internet_bill_236_1d_gross_receipt',
    'internet_bill_236_1d_tax_collected',
    'prepaid_internet_card_236_1e_gross_receipt',
    'prepaid_internet_card_236_1e_tax_collected',
    // Functions / gatherings — luxury event WHT
    'functions_gatherings_charges_236cb_gross_receipt',
    'functions_gatherings_charges_236cb_tax_collected',
    // Provident-fund withholding
    'advance_fund_23a_part_i_second_schedule_gross_receipt',
    'advance_fund_23a_part_i_second_schedule_tax_collected',
  ],

  credits_forms: [
    // Charitable-to-associate has its own line under s.61
    'charitable_donations_associate_yn',
    'charitable_donations_associate_amount',
    'charitable_donations_associate_tax_credit',
    // Investment-shares tax credit (s.62)
    'investment_shares_yn',
    'investment_shares_amount',
    'investment_shares_tax_credit',
    // Life insurance / provident-fund / investment-tax-credit (legacy
    // s.63 / s.64 / s.65). Almost no salaried filer claims these now.
    'life_insurance_premium_yn',
    'life_insurance_premium_amount',
    'life_insurance_premium_tax_credit',
    'provident_fund_yn',
    'provident_fund_amount',
    'provident_fund_tax_credit',
    'investment_tax_credit_yn',
    'investment_tax_credit_amount',
    'investment_tax_credit_tax_credit',
    'surrender_tax_credit_yn',
    'surrender_tax_credit_investments_yn',
    'surrender_tax_credit_amount',
    'surrender_tax_credit_reduction',
    // Legacy plain columns kept for back-compat (zombies that totals
    // formulas still reference)
    'charitable_donation',
    'pension_contribution',
    'life_insurance_premium',
    'investment_tax_credit',
    'other_credits',
  ],

  reductions_forms: [
    // Profession-specific reductions
    'teacher_amount', 'teacher_reduction',
    'teacher_researcher_amount', 'teacher_researcher_tax_reduction',
    'teacher_researcher_reduction_yn',
    'behbood_reduction',
    'behbood_certificates_amount', 'behbood_certificates_tax_reduction',
    'behbood_certificates_reduction_yn',
    // Business reductions — only export-house / industrial-undertaking
    // taxpayers ever touch these
    'export_income_reduction',
    'industrial_undertaking_reduction',
    'other_reductions',
  ],

  expenses_forms: [
    // Luxury / discretionary lines that don't belong in a baseline view
    'entertainment',
    'club',
    'functions_gatherings',
  ],

  deductions_forms: [
    // Old columns superseded by *_amount / *_yn pairs but kept for
    // legacy data
    'zakat',
    'education_expense_amount',
    'education_expense_children',
  ],
});

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

// All columns we know about for a given table (always + every addon + advanced).
function _allKnownColumns(table) {
  const out = new Set();
  for (const c of ALWAYS_VISIBLE[table] || []) out.add(c);
  for (const addon of Object.keys(ADDON_UNLOCKS)) {
    for (const c of ADDON_UNLOCKS[addon][table] || []) out.add(c);
  }
  for (const c of ADVANCED[table] || []) out.add(c);
  return out;
}

// Compute the visible field-set for a given form table given the user's
// selected addons. If `advanced` is true, also include ADVANCED fields.
// Returns a Set<string> the caller can use as a gate:
//   const visible = visibleFieldsFor('adjustable_tax_forms', addons);
//   if (visible.has('salary_employees_149_tax_collected')) { render(...) }
function visibleFieldsFor(table, addons = [], { advanced = false } = {}) {
  const out = new Set(ALWAYS_VISIBLE[table] || []);
  const addonSet = new Set(addons);
  for (const addon of addonSet) {
    const unlocks = ADDON_UNLOCKS[addon];
    if (!unlocks) continue;
    for (const c of unlocks[table] || []) out.add(c);
  }
  if (advanced) {
    for (const c of ADVANCED[table] || []) out.add(c);
  }
  return out;
}

// Diagnostic: which bucket does (table, column) belong to?
// Returns 'always' | 'addon:<id>' | 'advanced' | 'unknown'.
function computeUserField(table, column) {
  if ((ALWAYS_VISIBLE[table] || []).includes(column)) return 'always';
  for (const [addon, byTable] of Object.entries(ADDON_UNLOCKS)) {
    if ((byTable[table] || []).includes(column)) return `addon:${addon}`;
  }
  if ((ADVANCED[table] || []).includes(column)) return 'advanced';
  return 'unknown';
}

// Sanity: report any column that appears in more than one bucket
// (always vs. addon vs. advanced). Used by the test that pins the
// manifest to a single-source-of-truth shape.
function findDuplicates() {
  const dupes = [];
  const tables = new Set([
    ...Object.keys(ALWAYS_VISIBLE),
    ...Object.keys(ADVANCED),
    ...Object.values(ADDON_UNLOCKS).flatMap((m) => Object.keys(m)),
  ]);
  for (const table of tables) {
    const seen = new Map(); // column -> [bucket]
    const note = (col, bucket) => {
      if (!seen.has(col)) seen.set(col, []);
      seen.get(col).push(bucket);
    };
    for (const c of ALWAYS_VISIBLE[table] || []) note(c, 'always');
    for (const [addon, byTable] of Object.entries(ADDON_UNLOCKS)) {
      for (const c of byTable[table] || []) note(c, `addon:${addon}`);
    }
    for (const c of ADVANCED[table] || []) note(c, 'advanced');
    for (const [col, buckets] of seen) {
      if (buckets.length > 1) dupes.push({ table, column: col, buckets });
    }
  }
  return dupes;
}

module.exports = {
  ALWAYS_VISIBLE,
  ADDON_UNLOCKS,
  ADVANCED,
  visibleFieldsFor,
  computeUserField,
  findDuplicates,
  _allKnownColumns,
};
