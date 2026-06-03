/**
 * Unit tests for the Final/Min-tax line chargeable helper (audit TAX-01).
 *
 * tax_chargeable must be the STATUTORY liability (gross × section rate), not the
 * amount withheld — otherwise an under-withheld line cancels itself out in the
 * computation and the taxpayer files an under-stated return.
 *
 * `lineChargeable(fieldBase, gross, deducted)`:
 *   - signed-off line  → round(gross × rate), or `deducted` when gross is absent
 *   - any other line   → `deducted` (kept flagged until the rate is signed off)
 */
const {
  lineChargeable,
  FINAL_MIN_FIELD_RATE,
} = require('../../src/config/finalMinTaxRates');

describe('lineChargeable — Final/Min statutory chargeable (TAX-01)', () => {
  // ── Signed-off lines compute gross × rate ───────────────────────────────────
  test('prize bond u/s 156 @ 15%: 100,000 → 15,000', () => {
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', 100000, 0)).toBe(15000);
  });

  test('sukuk u/s 151(1A) @ 12.5%: 80,000 → 10,000', () => {
    expect(lineChargeable('return_on_investment_sukuk_u_s_151_1a_12_5pc', 80000, 0)).toBe(10000);
  });

  test('IPP dividend @ 7.5%: 200,000 → 15,000', () => {
    expect(lineChargeable('dividend_u_s_150_7_5pc_ipp_shares', 200000, 0)).toBe(15000);
  });

  test('bonus shares u/s 236 @ 10%: 50,000 → 5,000', () => {
    expect(lineChargeable('bonus_shares_companies_236f', 50000, 0)).toBe(5000);
  });

  // ── THE FIX: under-withholding is now charged, not cancelled ─────────────────
  // Gross 100,000 prize bond → 15,000 due. Payer withheld only 9,000.
  // chargeable must be 15,000 (statutory), NOT 9,000 (withheld). The 6,000
  // shortfall then shows as payable in the computation.
  test('under-withheld line charges the statutory amount, not the withheld amount', () => {
    const chargeable = lineChargeable('prize_bond_cross_world_puzzle_156', 100000, 9000);
    expect(chargeable).toBe(15000);
    expect(chargeable).not.toBe(9000);
  });

  // ── Gross-absent fallback: never invent a refund ────────────────────────────
  // User entered only the WHT certificate value (no gross). Fall back to withheld.
  test('gross-absent falls back to the withheld amount', () => {
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', 0, 5000)).toBe(5000);
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', undefined, 5000)).toBe(5000);
  });

  // ── Deferred lines keep the withheld amount (pending rate sign-off) ──────────
  test.each([
    'dividend_u_s_150_31pc_atl',                       // field 31% vs comment/config 15%
    'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc',  // ATL-dependent 10/20%
    'interest_income_profit_debt_7b_up_to_5m',         // comment 15% vs config 20%
    'profit_debt_national_savings_defence_39_14a',     // variable
    'employment_termination_benefits_12_6_avg_rate',   // average rate
    'salary_arrears_12_7_relevant_rate',               // relevant rate
    'capital_gain',                                    // owned by Capital Gains form
  ])('deferred line %s keeps the withheld amount (not computed)', (base) => {
    // Even with a gross present, a deferred line returns the withheld amount.
    expect(lineChargeable(base, 1000000, 12345)).toBe(12345);
    expect(FINAL_MIN_FIELD_RATE[base]).toBeUndefined();
  });

  // ── The signed-off rate table is exactly the 12 agreed lines ────────────────
  test('FINAL_MIN_FIELD_RATE holds exactly the 12 signed-off rates', () => {
    expect(FINAL_MIN_FIELD_RATE).toEqual({
      dividend_u_s_150_0pc_share_profit_reit_spv:   0.00,
      dividend_u_s_150_35pc_share_profit_other_spv: 0.35,
      dividend_u_s_150_7_5pc_ipp_shares:            0.075,
      dividend_u_s_150_25pc_bf_losses:              0.25,
      return_on_investment_sukuk_u_s_151_1a_10pc:   0.10,
      return_on_investment_sukuk_u_s_151_1a_12_5pc: 0.125,
      return_on_investment_sukuk_u_s_151_1a_25pc:   0.25,
      return_invest_exceed_1m_sukuk_saa_12_5pc:     0.125,
      return_invest_not_exceed_1m_sukuk_saa_10pc:   0.10,
      prize_raffle_lottery_quiz_promotional_156:    0.20,
      prize_bond_cross_world_puzzle_156:            0.15,
      bonus_shares_companies_236f:                  0.10,
    });
  });

  // ── REIT/SPV @ 0% computes to 0 (not the withheld amount) ────────────────────
  test('0% line computes to 0 when gross is present', () => {
    expect(lineChargeable('dividend_u_s_150_0pc_share_profit_reit_spv', 500000, 0)).toBe(0);
  });

  // ── Comma-free numeric inputs are handled (route pre-parses with commas) ─────
  test('rounds to whole rupees', () => {
    // 12.5% of 12,345 = 1,543.125 → 1,543
    expect(lineChargeable('return_on_investment_sukuk_u_s_151_1a_12_5pc', 12345, 0)).toBe(1543);
  });
});
