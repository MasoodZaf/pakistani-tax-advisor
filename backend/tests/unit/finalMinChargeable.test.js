/**
 * Unit tests for the Final/Min-tax line chargeable helper (audit TAX-01).
 *
 * tax_chargeable must be the STATUTORY liability (gross × section rate), not the
 * amount withheld — otherwise an under-withheld line cancels itself out in the
 * computation and the taxpayer files an under-stated return. Each line has a
 * filer (ATL) and a non-filer rate; the non-filer rate (~double) applies when
 * the taxpayer is NOT on the Active Taxpayer List. Rates verified against the
 * FBR Tax Card 2025-2026 (TY 2025-26, Finance Act 2025).
 *
 * lineChargeable(fieldBase, gross, deducted, isATL):
 *   - verified line → round(gross × (isATL ? atl : nonAtl)), or `deducted` when
 *     gross is absent
 *   - any other line → `deducted` (kept until its rate is reconciled)
 */
const {
  lineChargeable,
  FINAL_MIN_FIELD_RATE,
} = require('../../src/config/finalMinTaxRates');

describe('lineChargeable — Final/Min statutory chargeable (TAX-01, FBR Tax Card 2025-26)', () => {
  // ── Filer (ATL) rates ───────────────────────────────────────────────────────
  test('prize bond §156 @ 15% filer: 100,000 → 15,000', () => {
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', 100000, 0, true)).toBe(15000);
  });
  test('sukuk 1M–5M @ 12.5% filer: 80,000 → 10,000', () => {
    expect(lineChargeable('return_on_investment_sukuk_u_s_151_1a_12_5pc', 80000, 0, true)).toBe(10000);
  });
  test('IPP dividend @ 7.5% filer: 200,000 → 15,000', () => {
    expect(lineChargeable('dividend_u_s_150_7_5pc_ipp_shares', 200000, 0, true)).toBe(15000);
  });
  test('regular dividend (the 31pc line) @ 15% filer: 100,000 → 15,000', () => {
    expect(lineChargeable('dividend_u_s_150_31pc_atl', 100000, 0, true)).toBe(15000);
  });

  // ── Non-filer rates (~double) ────────────────────────────────────────────────
  test('prize bond non-filer @ 30%: 100,000 → 30,000', () => {
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', 100000, 0, false)).toBe(30000);
  });
  test('raffle: filer 20% → 10,000 vs non-filer 40% → 20,000', () => {
    expect(lineChargeable('prize_raffle_lottery_quiz_promotional_156', 50000, 0, true)).toBe(10000);
    expect(lineChargeable('prize_raffle_lottery_quiz_promotional_156', 50000, 0, false)).toBe(20000);
  });
  test('bonus shares §236Z: filer 10% → 50,000 vs non-filer 20% → 100,000', () => {
    expect(lineChargeable('bonus_shares_companies_236f', 500000, 0, true)).toBe(50000);
    expect(lineChargeable('bonus_shares_companies_236f', 500000, 0, false)).toBe(100000);
  });
  test('SPV-others dividend: filer 35% → 350,000 vs non-filer 70% → 700,000', () => {
    expect(lineChargeable('dividend_u_s_150_35pc_share_profit_other_spv', 1000000, 0, true)).toBe(350000);
    expect(lineChargeable('dividend_u_s_150_35pc_share_profit_other_spv', 1000000, 0, false)).toBe(700000);
  });

  // ── THE FIX: under-withholding is charged at the statutory rate ───────────────
  test('under-withheld line charges the statutory amount, not the withheld amount', () => {
    const c = lineChargeable('prize_bond_cross_world_puzzle_156', 100000, 9000, true);
    expect(c).toBe(15000);
    expect(c).not.toBe(9000);
  });

  // ── Gross-absent fallback: never invent a refund ─────────────────────────────
  test('gross-absent falls back to the withheld amount', () => {
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', 0, 5000, true)).toBe(5000);
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', undefined, 5000, false)).toBe(5000);
  });

  // ── 0% REIT line computes to 0 either way ────────────────────────────────────
  test('REIT/SPV @ 0% computes to 0 for filer and non-filer', () => {
    expect(lineChargeable('dividend_u_s_150_0pc_share_profit_reit_spv', 500000, 0, true)).toBe(0);
    expect(lineChargeable('dividend_u_s_150_0pc_share_profit_reit_spv', 500000, 0, false)).toBe(0);
  });

  // ── Default = filer when isATL omitted ───────────────────────────────────────
  test('defaults to the filer (ATL) rate when isATL is not passed', () => {
    expect(lineChargeable('prize_bond_cross_world_puzzle_156', 100000)).toBe(15000);
  });

  // ── Un-verified / ambiguous lines keep the withheld amount (no guessing) ─────
  test.each([
    'return_on_investment_sukuk_u_s_151_1a_25pc',     // >5M sukuk = Minimum Tax, no fixed final rate
    'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc', // field 10/20 vs Tax Card §151A 15/30
    'interest_income_profit_debt_7b_up_to_5m',        // s.7B vs s.151 mapping unclear
    'profit_debt_national_savings_defence_39_14a',    // variable
    'employment_termination_benefits_12_6_avg_rate',  // average rate
    'salary_arrears_12_7_relevant_rate',              // relevant rate
    'capital_gain',                                   // owned by the Capital Gains form
  ])('un-verified line %s keeps the withheld amount (filer or not)', (base) => {
    expect(lineChargeable(base, 1000000, 12345, true)).toBe(12345);
    expect(lineChargeable(base, 1000000, 12345, false)).toBe(12345);
    expect(FINAL_MIN_FIELD_RATE[base]).toBeUndefined();
  });

  // ── The verified filer/non-filer pair table (FBR Tax Card 2025-26) ───────────
  test('FINAL_MIN_FIELD_RATE matches the FBR Tax Card 2025-26 pairs', () => {
    expect(FINAL_MIN_FIELD_RATE).toEqual({
      dividend_u_s_150_0pc_share_profit_reit_spv:    { atl: 0.00,  nonAtl: 0.00 },
      dividend_u_s_150_35pc_share_profit_other_spv:  { atl: 0.35,  nonAtl: 0.70 },
      dividend_u_s_150_7_5pc_ipp_shares:             { atl: 0.075, nonAtl: 0.15 },
      dividend_u_s_150_31pc_atl:                     { atl: 0.15,  nonAtl: 0.30 },
      dividend_u_s_150_25pc_bf_losses:               { atl: 0.25,  nonAtl: 0.50 },
      return_on_investment_sukuk_u_s_151_1a_10pc:    { atl: 0.10,  nonAtl: 0.20 },
      return_on_investment_sukuk_u_s_151_1a_12_5pc:  { atl: 0.125, nonAtl: 0.25 },
      return_invest_not_exceed_1m_sukuk_saa_10pc:    { atl: 0.10,  nonAtl: 0.20 },
      return_invest_exceed_1m_sukuk_saa_12_5pc:      { atl: 0.125, nonAtl: 0.25 },
      prize_raffle_lottery_quiz_promotional_156:     { atl: 0.20,  nonAtl: 0.40 },
      prize_bond_cross_world_puzzle_156:             { atl: 0.15,  nonAtl: 0.30 },
      bonus_shares_companies_236f:                   { atl: 0.10,  nonAtl: 0.20 },
    });
  });
});
