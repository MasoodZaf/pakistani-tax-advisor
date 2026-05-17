// IRIS field-code map.
//
// Sourced from a real IRIS Acknowledgement Slip (Form 114(1), Tax Year 2025)
// at the repo root: Return.pdf. Every line item on that slip carries a
// numeric code that IRIS uses internally to identify the field. This module
// is the single source of truth for those codes — used by the Reports PDF
// export and (later) the IRIS JSON upload feature.
//
// Code-format conventions (observed in Return.pdf):
//   1xxx        — Income (salary buckets)
//   703xxx      — Wealth Reconciliation
//   7xxx        — Personal Assets / Personal Expenses (4-digit)
//   9xxx        — Computation totals (Total Income, Tax Chargeable, etc.)
//   92xxxx      — Tax breakdown (Normal Income Tax, Surcharge, etc.)
//   930xxx      — Tax Reductions
//   64xxxxxx    — Adjustable Tax (parent 640000 + 7-digit sub-codes)
//   64000101+   — Fixed / Final Tax line items
//
// Sections (mirrors the visual layout of the Acknowledgement Slip):
//   - top_summary      ── 5-row headline at the top of page 1
//   - income           ── Income section
//   - tax_reductions   ── Tax Reductions section
//   - capital_assets   ── Section 7E capital assets
//   - adjustable_tax   ── Adjustable Tax (640000 family)
//   - fixed_final_tax  ── Fixed / Final Tax (64000101 family)
//   - computations     ── Computation summary repeated near the end
//   - personal_assets  ── Personal Assets / Liabilities (7000s)
//   - personal_expenses── Personal Expenses (705x-708x)
//   - reconciliation   ── Reconciliation of Net Assets

// ── 1. Per-section IRIS field definitions ───────────────────────────────────
// Each section is a list of { code, description, computeFrom } entries.
// `computeFrom` is a function `(ctx) => { value | { total, normal, exempt | taxable, tax_chargeable, tax_collected } }`
// — the shape depends on the section's column layout. Returning `null`
// drops the row.
//
// `ctx` is the assembled payload: { computation, income, adjustable_tax,
// reductions, credits, deductions, capital_gain, expenses, wealth,
// wealth_reconciliation, profile }.

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Top summary (page 1 headline) ───────────────────────────────────────────
export const TOP_SUMMARY_FIELDS = [
  { code: '703001', label: 'Net Assets Current Year',  computeFrom: (ctx) => num(ctx.wealth_reconciliation?.net_assets_current_year) },
  { code: '9210',   label: 'Refundable Income Tax',    computeFrom: (ctx) => Math.max(0, -num(ctx.computation?.payments?.balancePayableRefundable)) },
  { code: '9200',   label: 'Tax Chargeable',           computeFrom: (ctx) => num(ctx.computation?.tax?.totalTaxChargeable) },
  { code: '9100',   label: 'Taxable Income',           computeFrom: (ctx) => num(ctx.computation?.income?.taxableIncomeIncludingCG) },
  { code: '9000',   label: 'Total Income',             computeFrom: (ctx) => num(ctx.computation?.income?.totalIncome) },
];

// ── Income (Code | Total | Exempt/Final | Description | Normal Tax) ─────────
// Column order verified against the IRIS 2.0 Employment → Salary screen:
//   Description | Code | Total Amount | Amount Exempt from Tax / Subject to
//   Fixed/Final Tax | Amount Subject to Normal Tax
// `total` = sum, `exempt` = subject to fixed/final tax (off-form),
// `normal` = subject to normal-tax slabs.
export const INCOME_FIELDS = [
  {
    code: '1000', label: 'Income from Salary',
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const total = num(inc.total_employment_income) || num(inc.annual_salary_wages_total);
      return { total, normal: total, exempt: 0 };
    },
  },
  {
    code: '1009', label: 'Pay, Wages or Other Remuneration (including Arrears of Salary)',
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const wages = num(inc.annual_basic_salary) + num(inc.bonus);
      return { total: wages, normal: wages, exempt: 0 };
    },
  },
  {
    // Allowances proper — separated from "Pay/Wages" in IRIS.
    code: '1049', label: 'Allowances',
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const allow = num(inc.allowances) + num(inc.medical_allowance) + num(inc.other_cash_benefits);
      if (allow === 0) return null;
      return { total: allow, normal: allow, exempt: 0 };
    },
  },
  {
    code: '1008', label: 'Pension / Annuity u/s 12(2)(f)',
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const pension = num(inc.pension_from_ex_employer);
      if (pension === 0) return null;
      // FA 2025: pension < Rs 10m exempt; we surface the gross here and
      // let normal-tax buckets reflect the taxable portion above.
      const exempt = Math.min(pension, 10000000);
      const normal = Math.max(0, pension - 10000000);
      return { total: pension, normal, exempt };
    },
  },
  {
    code: '1059', label: 'Expenditure Reimbursement',
    // No dedicated DB column today — left for future capture; render only
    // when present so the PDF doesn't print zero rows.
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const v = num(inc.expenditure_reimbursement);
      if (v === 0) return null;
      return { total: v, normal: v, exempt: 0 };
    },
  },
  {
    code: '1089', label: 'Value of Perquisites (including Transport Monetization for Government Servants)',
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const perks = num(inc.taxable_car_value) + num(inc.other_taxable_subsidies) + num(inc.employer_contribution_provident);
      if (perks === 0) return null;
      return { total: perks, normal: perks, exempt: 0 };
    },
  },
  {
    code: '1099', label: 'Profits in Lieu of or in Addition to Pay, Wages or Other Remuneration (including Employment Termination Benefits)',
    computeFrom: (ctx) => {
      const inc = ctx.income || {};
      const profits = num(inc.employment_termination_payment) + num(inc.retirement_from_approved_funds) + num(inc.directorship_fee);
      if (profits === 0) return null;
      return { total: profits, normal: profits, exempt: 0 };
    },
  },
];

// ── Property — Receipts / Deductions (same 4-column shape as Income) ───────
// Sourced from IRIS 2.0 Property → Receipts / Deductions page. The app
// today stores only gross rent on income_forms.other_taxable_income_rent;
// we apply Section 15A's standard 20% repair allowance here so the
// per-row breakdown matches what IRIS would compute.
export const PROPERTY_FIELDS = [
  // ── Top-line ─────────────────────────────────────────────────────────────
  {
    code: '2000', label: 'Income / (Loss) from Property', isTotal: true,
    computeFrom: (ctx) => {
      const rent = num(ctx.income?.other_taxable_income_rent);
      if (rent === 0) return null;
      const repairAllowance = Math.round(rent * 0.20);
      const net = rent - repairAllowance;
      return { total: net, normal: net, exempt: 0 };
    },
  },
  // ── Receipts ─────────────────────────────────────────────────────────────
  {
    code: '2029', label: 'Total Receipts from Property', isTotal: true,
    computeFrom: (ctx) => {
      const rent = num(ctx.income?.other_taxable_income_rent);
      if (rent === 0) return null;
      return { total: rent, normal: rent, exempt: 0 };
    },
  },
  {
    code: '2001', label: 'Rent Received or Receivable',
    computeFrom: (ctx) => {
      const rent = num(ctx.income?.other_taxable_income_rent);
      if (rent === 0) return null;
      return { total: rent, normal: rent, exempt: 0 };
    },
  },
  // 2002-2005 are not separately tracked yet — stubs drop unless populated.
  { code: '2002', label: '1/10th of Amount not Adjustable against Rent',                  computeFrom: () => null },
  { code: '2003', label: 'Forfeited Deposit under a Contract for Sale of Property',       computeFrom: () => null },
  { code: '2004', label: 'Recovery of Unpaid Irrecoverable Rent allowed as deduction',    computeFrom: () => null },
  { code: '2005', label: 'Unpaid Liabilities exceeding three Years',                      computeFrom: () => null },

  // ── Deductions ───────────────────────────────────────────────────────────
  {
    code: '2099', label: 'Total Deductions from Property', isTotal: true,
    computeFrom: (ctx) => {
      const rent = num(ctx.income?.other_taxable_income_rent);
      const allow = Math.round(rent * 0.20);
      if (allow === 0) return null;
      return { total: allow, normal: allow, exempt: 0 };
    },
  },
  {
    code: '2031', label: '1/5th of Rent of Building for Repairs (Section 15A)',
    computeFrom: (ctx) => {
      const rent = num(ctx.income?.other_taxable_income_rent);
      const allow = Math.round(rent * 0.20);
      if (allow === 0) return null;
      return { total: allow, normal: allow, exempt: 0 };
    },
  },
  // 2032-2098 not separately tracked yet — drop unless populated. Future
  // work: dedicated Property form on the app side to capture these inputs.
  { code: '2032', label: 'Insurance Premium',                                              computeFrom: () => null },
  { code: '2033', label: 'Local Rate / Tax / Charge / Cess',                               computeFrom: () => null },
  { code: '2034', label: 'Ground Rent',                                                    computeFrom: () => null },
  { code: '2035', label: 'Profit on Capital borrowed for Investment in Property',          computeFrom: () => null },
  { code: '2036', label: 'Share in Rental Income Paid to HBFC / Banks',                    computeFrom: () => null },
  { code: '2037', label: 'Rent Collection Expenditure',                                    computeFrom: () => null },
  { code: '2038', label: 'Legal Service Charges',                                          computeFrom: () => null },
  { code: '2039', label: 'Amount claimed as Irrecoverable Rent',                           computeFrom: () => null },
  { code: '2097', label: 'Payment of Liabilities treated as Income',                       computeFrom: () => null },
  { code: '2098', label: 'Other Deductions against Rent',                                  computeFrom: () => null },
];

// ── Tax Reductions (Code | Total Amount | Tax Reducted | Description | Tax Chargeable) ─
export const TAX_REDUCTION_FIELDS = [
  {
    code: '930101', label: "Tax Reduction on Tax Charged on Behbood Certificates / Pensioner's Benefit Account in excess of applicable rate",
    computeFrom: (ctx) => {
      const r = ctx.reductions || {};
      const reduction = num(r.behbood_certificates_reduction_tax_reduction);
      return { total: num(r.behbood_certificates_reduction_amount), tax_reducted: reduction, tax_chargeable: 0 };
    },
  },
];

// ── Tax Credits (Code | Eligible Amount | Tax Credit | Description) ─────────
// Statutorily, credits are claimed at the filer's average tax rate. The form
// stores both the eligible amount (e.g. donation paid) and the computed
// credit. Salaried scope: charitable donations (s.61) and approved pension
// fund contributions (s.63) are the common ones.
export const TAX_CREDIT_FIELDS = [
  {
    code: '930201', label: 'Tax Credit for Charitable Donations u/s 61',
    computeFrom: (ctx) => {
      const c = ctx.credits || {};
      // Form has both `charitable_donations_u_s_61_*` and separate associate-
      // recipient variants; sum the credit but keep the headline amount.
      const amount = num(c.charitable_donations_u_s_61_amount)
                   + num(c.charitable_donations_associate_amount);
      const credit = num(c.charitable_donations_u_s_61_tax_credit)
                   + num(c.charitable_donations_associate_tax_credit);
      if (amount === 0 && credit === 0) return null;
      return { total: amount, tax_credit: credit, tax_chargeable: 0 };
    },
  },
  {
    code: '930301', label: 'Tax Credit for Contribution to Approved Pension Fund u/s 63',
    computeFrom: (ctx) => {
      const c = ctx.credits || {};
      const amount = num(c.pension_fund_contribution_u_s_63_amount);
      const credit = num(c.pension_fund_contribution_u_s_63_tax_credit);
      if (amount === 0 && credit === 0) return null;
      return { total: amount, tax_credit: credit, tax_chargeable: 0 };
    },
  },
];

// ── Deductible Allowances u/s 60 / 60C / 60D (Code | Amount | Description) ──
// Salaried scope: Zakat (s.60) is the always-relevant row; POS (s.60C) and
// education (s.60D) only fire when taxable income ≤ Rs 1.5M (uncommon for
// salaried). Each row is dropped when zero so the slip doesn't fill with
// empty allowance lines.
export const DEDUCTIBLE_ALLOWANCE_FIELDS = [
  {
    code: '9009', label: 'Zakat paid u/s 60',
    computeFrom: (ctx) => {
      const d = ctx.deductions || {};
      const amount = num(d.zakat) || num(d.zakat_paid);
      return amount > 0 ? { amount } : null;
    },
  },
  {
    code: '9010', label: 'Professional Expenses for POS u/s 60C',
    computeFrom: (ctx) => {
      const d = ctx.deductions || {};
      const amount = num(d.professional_expenses_pos_amount);
      return amount > 0 ? { amount } : null;
    },
  },
  {
    code: '9012', label: 'Educational Expenses Allowance u/s 60D',
    computeFrom: (ctx) => {
      const d = ctx.deductions || {};
      const amount = num(d.educational_expenses_amount) || num(d.education_expense);
      return amount > 0 ? { amount } : null;
    },
  },
];

// ── Capital Assets u/s 7E (Code | Cost/Declared | Description | Fair Market) ─
export const CAPITAL_ASSETS_FIELDS = [
  {
    code: '7107', label: 'Total value of capital assets taxable under section 7E',
    // We don't separately track 7E declared vs FMV today — emit zeros until the
    // 7E form ships. Keeping the row visible matches IRIS even when blank.
    computeFrom: () => ({ cost_declared: 0, fair_market: 0 }),
  },
];

// ── Adjustable Tax (Code | Taxable Value | Tax Chargeable | Description | Tax Collected/Deducted) ─
// `taxable_value` = the declared gross receipt; `tax_collected` = the WHT
// the user holds the certificate for; `tax_chargeable` = the rate-implied tax
// (often equals `tax_collected` after a clean withholding).
export const ADJUSTABLE_TAX_FIELDS = [
  // Parent total — IRIS convention is to show 640000 as the section total.
  {
    code: '640000', label: 'Adjustable Tax', isTotal: true,
    computeFrom: (ctx) => {
      const at = ctx.adjustable_tax || {};
      const total = num(at.total_tax_collected) || num(at.total_adjustable_tax);
      return { taxable_value: 0, tax_chargeable: 0, tax_collected: total };
    },
  },
  // Per-line items. Map the Adjustable Tax form's gross/tax pairs to codes.
  ...[
    { code: '64020001', dbKey: 'salary_employees_149',                         label: 'Salary of Employees u/s 149' },
    { code: '64020004', dbKey: 'directorship_fee_149_3',                       label: 'Directorship Fee u/s 149(3)' },
    { code: '64030051', dbKey: 'profit_debt_151_15',                           label: 'Profit on Debt u/s 151 @ 15%' },
    { code: '64030054', dbKey: 'profit_debt_sukook_151a',                      label: 'Profit on Debt u/s 151A @ 12.5% (Sukook)' },
    { code: '64100101', dbKey: 'tax_deducted_rent_section_155',                label: 'Tax deducted on Rent received (Section 155)' },
    { code: '64141001', dbKey: 'advance_tax_cash_withdrawal_231ab',            label: 'Advance tax on cash withdrawal u/s 231AB' },
    { code: '64141301', dbKey: 'motor_vehicle_registration_fee_231b1',         label: 'Motor Vehicle Registration Fee u/s 231B(1)' },
    { code: '64141302', dbKey: 'motor_vehicle_transfer_fee_231b2',             label: 'Motor Vehicle Transfer Fee u/s 231B(2)' },
    { code: '64141303', dbKey: 'motor_vehicle_sale_231b3',                     label: 'Motor Vehicle Sale u/s 231B(3)' },
    { code: '64141304', dbKey: 'motor_vehicle_leasing_231b1a',                 label: 'Motor Vehicle Leasing u/s 231B(1A) (Non-ATL) @4%' },
    { code: '64150001', dbKey: 'electricity_bill_domestic_235',                label: 'Electricity Bill of Domestic Consumer u/s 235' },
    { code: '64150002', dbKey: 'cellphone_bill_236_1f',                        label: 'Cellphone Bill u/s 236(1)(a)' },
    { code: '64150003', dbKey: 'prepaid_telephone_card_236_1b',                label: 'Prepaid Telephone Card u/s 236(1)(b)' },
    { code: '64150004', dbKey: 'phone_unit_236_1c',                            label: 'Phone Unit u/s 236(1)(c)' },
    { code: '64150005', dbKey: 'internet_bill_236_1d',                         label: 'Internet Bill u/s 236(1)(d)' },
    { code: '64150006', dbKey: 'prepaid_internet_card_236_1e',                 label: 'Prepaid Internet Card u/s 236(1)(e)' },
    { code: '64151001', dbKey: 'sale_transfer_immoveable_property_236c',       label: 'Sale / Transfer of Immovable Property u/s 236C' },
    { code: '64151101', dbKey: 'purchase_transfer_immoveable_property_236k',   label: 'Purchase / Transfer of Immovable Property u/s 236K' },
    { code: '64151301', dbKey: 'functions_gatherings_charges_236cb',           label: 'Functions / Gatherings Charges u/s 236CB' },
    // s.37 is the capital-gains statute but s.37(6) defines the
    // "consideration" base on which WHT is collected at sale — the WHT
    // itself is adjustable against the filer's normal tax, hence its
    // placement in the Adjustable Tax section. Don't move to Fixed/Final.
    { code: '64151401', dbKey: 'withholding_tax_sale_considerations_37e',      label: 'Withholding tax on Sale Considerations u/s 37(6)' },
    { code: '64151501', dbKey: 'advance_fund_23a_part_i_second_schedule',      label: 'Advance Tax on Withdrawal of Pension Fund u/c 23A' },
    { code: '64151601', dbKey: 'advance_tax_motor_vehicle_231b2a',             label: 'Advance tax on Motor Vehicle u/s 231B(2A)' },
    { code: '64151905', dbKey: 'persons_remitting_amount_abroad_236v',         label: 'Persons remitting amount abroad through credit / debit / prepaid cards u/s 236Y' },
    { code: '64152001', dbKey: 'advance_tax_foreign_domestic_workers_231c',    label: 'Advance tax on foreign domestic workers u/s 231C' },
  ].map(({ code, dbKey, label }) => ({
    code, label,
    computeFrom: (ctx) => {
      const at = ctx.adjustable_tax || {};
      const taxableValue = num(at[`${dbKey}_gross_receipt`]);
      const taxCollected = num(at[`${dbKey}_tax_collected`]);
      // Drop entirely-empty rows so the PDF doesn't fill with zero lines.
      if (taxableValue === 0 && taxCollected === 0) return null;
      return { taxable_value: taxableValue, tax_chargeable: taxCollected, tax_collected: taxCollected };
    },
  })),
];

// ── Fixed / Final Tax (same column shape as Adjustable Tax) ─────────────────
// IRIS uses 64000101 as the parent-total code; sub-codes for dividends 150,
// CGT 37(1A), prizes 156, etc. The form-level totals come from the Final/Min
// Income form's per-row taxable amounts × applicable rate.
export const FIXED_FINAL_TAX_FIELDS = [
  { code: '64000101', label: 'Fixed / Final Tax', isTotal: true,
    computeFrom: (ctx) => {
      const fmi = ctx.final_min_income || {};
      const total = num(fmi.grand_total_tax_chargeable) || num(fmi.total_tax_chargeable) || 0;
      return { taxable_value: 0, tax_chargeable: total, tax_collected: total };
    },
  },
  ...[
    // NOTE — 64030051 was duplicated with the Profit-on-Debt @ 15% row in
    // the Adjustable Tax section (line ~245). The Adjustable Tax usage is
    // the well-established FBR code; this REIT SPV row has been moved to
    // 64030056 to fill the gap in the contiguous dividend 64030051-55
    // range. Cross-check against a current IRIS slip before relying on it.
    { code: '64030056', dbAmount: 'dividend_u_s_150_0pc_share_profit_reit_spv_amount',          dbTax: 'dividend_u_s_150_0pc_share_profit_reit_spv_tax_collected',          label: 'Dividend u/s 150 @ 0% (REIT SPV)' },
    { code: '64030052', dbAmount: 'dividend_u_s_150_35pc_share_profit_other_spv_amount',        dbTax: 'dividend_u_s_150_35pc_share_profit_other_spv_tax_collected',        label: 'Dividend u/s 150 @ 35% (other SPV)' },
    { code: '64030053', dbAmount: 'dividend_u_s_150_7_5pc_ipp_shares_amount',                   dbTax: 'dividend_u_s_150_7_5pc_ipp_shares_tax_collected',                   label: 'Dividend u/s 150 @ 7.5% (IPP)' },
    { code: '64030055', dbAmount: 'dividend_u_s_150_31pc_atl_amount',                           dbTax: 'dividend_u_s_150_31pc_atl_tax_collected',                           label: 'Dividend u/s 150 @ 15% (in kind / mutual fund <50% PoD)' },
    { code: '64330050', dbAmount: 'dividend_u_s_150_25pc_bf_losses_amount',                     dbTax: 'dividend_u_s_150_25pc_bf_losses_tax_collected',                     label: 'Dividend u/s 150 — Mutual Funds 50%+ PoD or BF-loss companies @ 25%' },
    { code: '64030060', dbAmount: 'return_invest_exceed_1m_sukuk_saa_12_5pc_amount',            dbTax: 'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_collected',            label: 'Sukuks 151(1A) @ 12.5%' },
    { code: '64030061', dbAmount: 'return_invest_not_exceed_1m_sukuk_saa_10pc_amount',          dbTax: 'return_invest_not_exceed_1m_sukuk_saa_10pc_tax_collected',          label: 'Sukuks 151(1A) @ 10% (≤ Rs 1m)' },
    { code: '64030062', dbAmount: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_amount',      dbTax: 'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_collected',      label: 'Profit on Debt u/c 5(A)/5AA/5AB Part II Second Schedule' },
    { code: '64030063', dbAmount: 'profit_debt_national_savings_defence_39_14a_amount',         dbTax: 'profit_debt_national_savings_defence_39_14a_tax_collected',         label: 'Profit on Debt — NSC / Defence Savings 39(4A)' },
    { code: '64220050', dbAmount: 'capital_gains_immovable_property_37_1a_amount',              dbTax: 'capital_gains_immovable_property_37_1a_tax_collected',              label: 'Capital Gains on Immovable Property u/s 37(1A)' },
    { code: '64200001', dbAmount: 'prize_bond_cross_world_puzzle_156_amount',                   dbTax: 'prize_bond_cross_world_puzzle_156_tax_collected',                   label: 'Prize on Prize Bond / Cross-Word Puzzle u/s 156' },
    { code: '64200002', dbAmount: 'prize_raffle_lottery_quiz_promotional_156_amount',           dbTax: 'prize_raffle_lottery_quiz_promotional_156_tax_collected',           label: 'Prize on Raffle / Lottery / Quiz / Promotional u/s 156' },
    { code: '64210001', dbAmount: 'bonus_shares_companies_236f_amount',                         dbTax: 'bonus_shares_companies_236f_tax_collected',                         label: 'Bonus shares issued by companies u/s 236Z' },
    { code: '64020010', dbAmount: 'salary_arrears_12_7_relevant_rate_amount',                   dbTax: 'salary_arrears_12_7_relevant_rate_tax_collected',                   label: 'Salary Arrears u/s 12(7) Chargeable at Relevant Rate' },
  ].map(({ code, dbAmount, dbTax, label }) => ({
    code, label,
    computeFrom: (ctx) => {
      const fmi = ctx.final_min_income || {};
      const amount = num(fmi[dbAmount]);
      const tax    = num(fmi[dbTax]);
      if (amount === 0 && tax === 0) return null;
      return { taxable_value: amount, tax_chargeable: tax, tax_collected: tax };
    },
  })),
];

// ── Computations (Code | Total | Normal | Description | Exempt/Final) ───────
// Layout matches the Income section. This is the central tax-computation
// summary the IRIS slip shows on a later page.
export const COMPUTATION_FIELDS = [
  { code: '1000',   label: 'Income from Salary',                                                  computeFrom: (ctx) => ({ total: num(ctx.computation?.income?.incomeFromSalary), normal: num(ctx.computation?.income?.incomeFromSalary), exempt: 0 }) },
  { code: '9000',   label: 'Total Income',                                                        computeFrom: (ctx) => ({ total: num(ctx.computation?.income?.totalIncome), normal: 0, exempt: 0 }) },
  { code: '9100',   label: 'Taxable Income',                                                      computeFrom: (ctx) => ({ total: num(ctx.computation?.income?.taxableIncomeIncludingCG), normal: 0, exempt: 0 }) },
  { code: '9200',   label: 'Tax Chargeable',                                                      computeFrom: (ctx) => ({ total: num(ctx.computation?.tax?.totalTaxChargeable), normal: 0, exempt: 0 }) },
  { code: '920000', label: 'Normal Income Tax',                                                   computeFrom: (ctx) => ({ total: num(ctx.computation?.tax?.normalIncomeTax), normal: 0, exempt: 0 }) },
  // 920100 — Source from the computation breakdown (single source of truth)
  // not the raw form data. If `grand_total_tax_chargeable` is present that
  // beats the breakdown (it's the user-entered total); otherwise compute
  // from the breakdown so the value matches what TaxComputationSummary
  // shows on screen.
  { code: '920100', label: 'Final / Fixed / Minimum / Average / Relevant / Reduced Income Tax',
    computeFrom: (ctx) => {
      const fmiTotal = num(ctx.final_min_income?.grand_total_tax_chargeable);
      const fallback = num(ctx.computation?.tax?.netTaxPayable) - num(ctx.computation?.tax?.normalIncomeTax) - num(ctx.computation?.tax?.surcharge);
      return { total: fmiTotal || Math.max(0, fallback), normal: 0, exempt: 0 };
    },
  },
  // TODO — `923184` is the historical FBR code for "Surcharge u/s 4AB" but
  // current IRIS slips have been seen using `923101`. Verify against a live
  // IRIS export before TY 2026-27 returns are filed; the math is correct
  // either way (surcharge value is the same), only the row code differs.
  { code: '923184', label: 'Surcharge on high earning person u/s 4AB',                            computeFrom: (ctx) => ({ total: num(ctx.computation?.tax?.surcharge), normal: 0, exempt: 0 }) },
  { code: '92101',  label: 'Refund Adjustment of Other Year(s) against Demand of this Year',     computeFrom: (ctx) => ({ total: num(ctx.tax_computation?.refund_adjustment), normal: 0, exempt: 0 }) },
  // 9201 — Match the on-screen "Tax Already Paid" panel: fold both WHT and
  // advance tax u/s 147 into a single line so the PDF balances against the
  // displayed bottom-line.
  { code: '9201',   label: 'Withholding Income Tax',                                              computeFrom: (ctx) => ({ total: num(ctx.computation?.payments?.withholdingTax) + num(ctx.computation?.payments?.advanceTax), normal: 0, exempt: 0 }) },
  // Income Tax Demanded — positive balance after WHT + advance tax. The
  // complementary 9210 (Refundable Income Tax) renders the negative side.
  { code: '9203',   label: 'Income Tax Demanded',                                                 computeFrom: (ctx) => ({ total: Math.max(0,  num(ctx.computation?.payments?.balancePayableRefundable)), normal: 0, exempt: 0 }) },
  { code: '9210',   label: 'Refundable Income Tax',                                               computeFrom: (ctx) => ({ total: Math.max(0, -num(ctx.computation?.payments?.balancePayableRefundable)), normal: 0, exempt: 0 }) },
];

// ── Personal Assets / Liabilities (Code | Amount | Description) ─────────────
export const PERSONAL_ASSETS_FIELDS = [
  { code: '7002', label: 'Commercial, Industrial, Residential Property (Non-Business)',          computeFrom: (ctx) => num(ctx.wealth?.property_current_year) },
  { code: '7006', label: 'Investment (Non-Business) (Account / Annuity / Bond / Certificate / Debenture / Deposit / Fund / Instrument / Policy / Share / Stock / Unit, etc.)',
                  computeFrom: (ctx) => num(ctx.wealth?.investment_current_year) },
  { code: '7008', label: 'Motor Vehicle (Non-Business)',                                         computeFrom: (ctx) => num(ctx.wealth?.vehicle_current_year) },
  { code: '7009', label: 'Precious Possession (Jewelry, etc.)',                                  computeFrom: (ctx) => num(ctx.wealth?.jewelry_current_year) },
  { code: '7011', label: 'Personal Item',                                                        computeFrom: () => 0 },
  { code: '7012', label: 'Cash (Non-Business)',                                                  computeFrom: (ctx) => num(ctx.wealth?.cash_current_year) },
  { code: '7013', label: 'Any Other Asset',                                                      computeFrom: (ctx) => num(ctx.wealth?.other_assets_current_year) + num(ctx.wealth?.pf_current_year) },
  { code: '7015', label: 'Total Assets inside Pakistan',  isTotal: true,                         computeFrom: (ctx) => num(ctx.wealth?.total_assets_current_year) },
  { code: '7019', label: 'Total Assets',                  isTotal: true,                         computeFrom: (ctx) => num(ctx.wealth?.total_assets_current_year) },
];

// ── Personal Expenses (Code | Amount | Description) ─────────────────────────
export const PERSONAL_EXPENSE_FIELDS = [
  { code: '7089', label: 'Personal Expenses', isTotal: true,                                     computeFrom: (ctx) => num(ctx.expenses?.total_expenses) },
  { code: '7051', label: 'Rent',                                                                 computeFrom: (ctx) => num(ctx.expenses?.rent) },
  { code: '7055', label: 'Vehicle Running / Maintenance',                                        computeFrom: (ctx) => num(ctx.expenses?.vehicle_running_maintenance) || num(ctx.expenses?.vehicle) },
  { code: '7056', label: 'Travelling',                                                           computeFrom: (ctx) => num(ctx.expenses?.travelling) },
  { code: '7058', label: 'Electricity',                                                          computeFrom: (ctx) => num(ctx.expenses?.electricity) },
  { code: '7059', label: 'Water',                                                                computeFrom: (ctx) => num(ctx.expenses?.water) },
  { code: '7060', label: 'Gas',                                                                  computeFrom: (ctx) => num(ctx.expenses?.gas) },
  { code: '7070', label: 'Medical',                                                              computeFrom: (ctx) => num(ctx.expenses?.medical) },
  { code: '7071', label: 'Educational',                                                          computeFrom: (ctx) => num(ctx.expenses?.educational) },
  { code: '7072', label: 'Club',                                                                 computeFrom: () => 0 },
  { code: '7073', label: 'Functions / Gatherings',                                               computeFrom: (ctx) => num(ctx.expenses?.entertainment) },
  { code: '7076', label: 'Donation, Zakat, Annuity, Profit on Debt, Life Insurance Premium, etc.', computeFrom: (ctx) => num(ctx.expenses?.donations_zakat_annuity) || num(ctx.expenses?.donations) },
  { code: '7087', label: 'Other Personal / Household Expenses',                                  computeFrom: (ctx) => num(ctx.expenses?.other_expenses) },
];

// ── Reconciliation of Net Assets (Code | Amount | Description) ──────────────
export const RECONCILIATION_FIELDS = [
  { code: '703001', label: 'Net Assets Current Year',                                            computeFrom: (ctx) => num(ctx.wealth_reconciliation?.net_assets_current_year) },
  { code: '703002', label: 'Net Assets Previous Year',                                           computeFrom: (ctx) => num(ctx.wealth_reconciliation?.net_assets_previous_year) },
  { code: '703003', label: 'Increase / Decrease in Assets',                                      computeFrom: (ctx) => num(ctx.wealth_reconciliation?.net_assets_increase) },
  { code: '7099',   label: 'Outflows',                                                           computeFrom: (ctx) => num(ctx.wealth_reconciliation?.total_outflows) },
  { code: '7089',   label: 'Personal Expenses',                                                  computeFrom: (ctx) => num(ctx.wealth_reconciliation?.personal_expenses) },
  { code: '703000', label: 'Unreconciled Amount',                                                computeFrom: (ctx) => num(ctx.wealth_reconciliation?.unreconciled_difference) },
];

// ── Helper: compute every section's rows from a single context payload ──────
export function buildIrisSections(ctx) {
  const renderRow = (def) => {
    const computed = def.computeFrom(ctx);
    if (computed === null || computed === undefined) return null;
    return { code: def.code, label: def.label, isTotal: !!def.isTotal, ...(typeof computed === 'object' ? computed : { amount: computed }) };
  };

  return {
    top_summary:           TOP_SUMMARY_FIELDS.map(renderRow).filter(Boolean),
    income:                INCOME_FIELDS.map(renderRow).filter(Boolean),
    property:              PROPERTY_FIELDS.map(renderRow).filter(Boolean),
    deductible_allowances: DEDUCTIBLE_ALLOWANCE_FIELDS.map(renderRow).filter(Boolean),
    tax_reductions:        TAX_REDUCTION_FIELDS.map(renderRow).filter(Boolean),
    tax_credits:           TAX_CREDIT_FIELDS.map(renderRow).filter(Boolean),
    capital_assets:        CAPITAL_ASSETS_FIELDS.map(renderRow).filter(Boolean),
    adjustable_tax:        ADJUSTABLE_TAX_FIELDS.map(renderRow).filter(Boolean),
    fixed_final_tax:       FIXED_FINAL_TAX_FIELDS.map(renderRow).filter(Boolean),
    computations:          COMPUTATION_FIELDS.map(renderRow).filter(Boolean),
    personal_assets:       PERSONAL_ASSETS_FIELDS.map(renderRow).filter(Boolean),
    personal_expenses:     PERSONAL_EXPENSE_FIELDS.map(renderRow).filter(Boolean),
    reconciliation:    RECONCILIATION_FIELDS.map(renderRow).filter(Boolean),
  };
}
