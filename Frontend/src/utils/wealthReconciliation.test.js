import {
  exemptIncomeInflow,
  finalMinIncomeInflow,
  normalTaxIncomeInflow,
  computeWealthReconciliation,
} from './wealthReconciliation';

/**
 * Scenario, built from the live generated columns (PM-FINAL-AUDIT §9 / §13.2).
 *
 *   gross cash salary items                       S_cash = 10,000,000
 *     of which exempt (retirement/termination/medical)  E =  1,300,000
 *   non-cash benefits (net)                                 200,000
 *
 *   income_exempt_from_tax    := -(retirement+termination+medical) = -1,300,000
 *   annual_salary_wages_total := S_cash + (-E)                     =  8,700,000
 *   total_employment_income   := annual_salary_wages_total + non-cash = 8,900,000
 *                               ↑ ALREADY net of E
 *
 * Final/Min tax income declared on the modern step:      11,500,000
 * Capital gain auto-linked onto that step:                1,500,000
 */
const INCOME = {
  income_exempt_from_tax: -1300000,
  annual_salary_wages_total: 8700000,
  total_employment_income: 8900000,
  other_income_min_tax_total: 0,
  other_income_no_min_tax_total: 0,
};

const FINAL_MIN = {
  // Auto-linked from the Income form → already inside income_normal_tax.
  // No `_amount` suffix, and must NOT be counted again here.
  salary_u_s_12_7: 8700000,
  salary_u_s_12_7_tax_deducted: 2100000,
  interest_income_profit_debt_7b_up_to_5m_amount: 5000000,
  interest_income_profit_debt_7b_up_to_5m_tax_deducted: 1000000,
  dividend_u_s_150_31pc_atl_amount: 4500000,
  prize_bond_cross_world_puzzle_156_amount: 2000000,
  capital_gain: 1500000,
  grand_total_tax_chargeable: 3100000,
  is_atl: true,
};

describe('exemptIncomeInflow', () => {
  it('returns the POSITIVE magnitude of the negative B15 contra', () => {
    expect(exemptIncomeInflow(INCOME)).toBe(1300000);
  });

  it('handles the legacy positive dialect unchanged', () => {
    expect(exemptIncomeInflow({ total_exempt_income: 1300000 })).toBe(1300000);
  });

  it('is zero when nothing is exempt', () => {
    expect(exemptIncomeInflow({ income_exempt_from_tax: 0 })).toBe(0);
    expect(exemptIncomeInflow({})).toBe(0);
  });
});

describe('finalMinIncomeInflow', () => {
  it('reads the modern Final/Min step, not the structurally-zero legacy table', () => {
    // 5,000,000 + 4,500,000 + 2,000,000 + 1,500,000 (capital gain)
    expect(finalMinIncomeInflow(FINAL_MIN, {})).toBe(13000000);
  });

  it('does not double-count salary auto-linked from the Income form', () => {
    expect(finalMinIncomeInflow(FINAL_MIN, {})).not.toBe(13000000 + FINAL_MIN.salary_u_s_12_7);
    expect(finalMinIncomeInflow({ salary_u_s_12_7: 8700000 }, {})).toBe(0);
  });

  it('ignores tax columns — this row is INCOME, not tax', () => {
    expect(finalMinIncomeInflow({ interest_income_profit_debt_7b_up_to_5m_tax_deducted: 1000000 }, {})).toBe(0);
  });

  it('falls back to the legacy RECEIPT columns, never total_final_tax', () => {
    const legacy = {
      sukuk_amount: 1000000,
      debt_amount: 500000,
      prize_bonds: 200000,
      other_final_tax_amount: 300000,
      total_final_tax: 175000, // a TAX figure — must not be used as income
    };
    expect(finalMinIncomeInflow({}, legacy)).toBe(2000000);
  });
});

describe('normalTaxIncomeInflow', () => {
  it('includes other-income buckets, not employment income alone', () => {
    expect(
      normalTaxIncomeInflow({
        total_employment_income: 8900000,
        other_income_min_tax_total: 300000,
        other_income_no_min_tax_total: 700000,
      })
    ).toBe(9900000);
  });
});

describe('computeWealthReconciliation', () => {
  const base = {
    wealth: { net_worth_current_year: 20000000, net_worth_previous_year: 6600000 },
    income: INCOME,
    expenses: { total_expenses: 1600000 },
    finalMin: FINAL_MIN,
    legacyFinalTax: {},
    inputs: {},
  };

  /**
   * WORKED EXAMPLE — the phantom gap, closed.
   *
   * 45bb80c computed:
   *   income_normal_tax   = total_employment_income        =  8,900,000  (S − E)
   *   income_exempt       = raw contra                     = −1,300,000  (−E again)
   *   income_final_tax    = legacy final_tax.total_final_tax =        0  (wrong table)
   *   total_inflows       =                                    7,600,000
   *   outflows            =                                    1,600,000
   *   net increase        =                                    6,000,000
   *   asset increase      =                                   13,400,000
   *   → unreconciled          7,400,000  ← blocks filing (422), and the form
   *                                        then offered to write all of it into
   *                                        "Foreign Remittance".
   *
   * After the fix:
   *   income_normal_tax   =  8,900,000
   *   income_exempt       = +1,300,000   (magnitude — the two now cancel: S)
   *   income_final_tax    = 13,000,000   (modern step + CGT)
   *   total_inflows       = 23,200,000
   *   outflows            =  1,600,000
   *   net increase        = 21,600,000
   *
   * The omitted income is exactly 2E + 13,000,000 = 15,600,000.
   */
  it('stops subtracting exempt income twice and reads the modern final/min step', () => {
    const r = computeWealthReconciliation(base);

    expect(r.income_normal_tax).toBe(8900000);
    expect(r.income_exempt_from_tax).toBe(1300000); // NOT −1,300,000
    expect(r.income_final_tax).toBe(13000000); // NOT 0
    expect(r.total_inflows).toBe(23200000);
  });

  /**
   * The three wrong answers this pins out.
   *
   *   S (gross of exempt) = total_employment_income + E = 10,200,000
   *
   *   7,600,000  45bb80c: (S − E) + (−E) + 0        → S − 2E, final tax dropped
   *  21,900,000  "just drop the exempt term": (S − E) + 0 + 13M → still short by E
   *  24,500,000  gross-up normal_tax AND add E: S + E + 13M      → E counted twice
   *  23,200,000  correct: (S − E) + E + 13M = S + 13M
   *
   * Exempt income is real cash and does fund asset growth, so it belongs in
   * inflows exactly once. The normal-tax row keeps the NET figure (that is what
   * the FBR line means) and the exempt row carries the positive magnitude, so
   * the two cancel back to S.
   */
  it('lands on S, not on any of the near-miss corrections', () => {
    const r = computeWealthReconciliation(base);
    const S = r.income_normal_tax + exemptIncomeInflow(INCOME);

    expect(S).toBe(10200000);
    expect(r.total_inflows).toBe(S + 13000000);

    expect(r.total_inflows).not.toBe(7600000);
    expect(r.total_inflows).not.toBe(21900000);
    expect(r.total_inflows).not.toBe(24500000);
  });

  it('reconciles to zero once the arithmetic is right', () => {
    // Asset increase set to exactly the corrected net increase.
    const r = computeWealthReconciliation({
      ...base,
      wealth: { net_worth_current_year: 21600000, net_worth_previous_year: 0 },
    });
    expect(r.calculated_net_increase).toBe(21600000);
    expect(r.unreconciled_difference).toBe(0);
  });

  it('still adds user-entered inflows and outflows', () => {
    const r = computeWealthReconciliation({
      ...base,
      inputs: { foreign_remittance: 500000, gift_outflow: 100000 },
    });
    expect(r.total_inflows).toBe(23700000);
    expect(r.total_outflows).toBe(1700000);
  });

  it('derives net assets from totals when the net-worth columns are absent', () => {
    const r = computeWealthReconciliation({
      ...base,
      wealth: {
        total_assets_current_year: 25000000,
        total_liabilities_current_year: 5000000,
        total_assets_previous_year: 10000000,
        total_liabilities_previous_year: 3400000,
      },
    });
    expect(r.net_assets_current_year).toBe(20000000);
    expect(r.net_assets_previous_year).toBe(6600000);
    expect(r.net_assets_increase).toBe(13400000);
  });
});
