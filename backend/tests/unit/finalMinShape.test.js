const { toFinalMinFrontendShape } = require('../../src/modules/IncomeTax/helpers/finalMinShape');

// A trimmed final_min_income_forms row — one bucket of each kind the reshape
// has to treat differently.
const row = () => ({
  id: 'row-uuid',
  user_id: 'user-uuid',
  tax_year: '2025-26',
  is_complete: false,
  salary_u_s_12_7: '16340000.00',
  salary_u_s_12_7_tax_deducted: '3365000.00',
  salary_u_s_12_7_tax_chargeable: '0.00',
  dividend_u_s_150_0pc_share_profit_reit_spv: '1000000.00',
  dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted: '0.00',
  dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable: '0.00',
  capital_gain: '250000.00',
  subtotal: '18140000.00',
  grand_total_tax_deducted: '3645000.00',
  is_atl: true,
});

describe('toFinalMinFrontendShape', () => {
  it('suffixes amount buckets with _amount', () => {
    const shaped = toFinalMinFrontendShape(row());
    expect(shaped.dividend_u_s_150_0pc_share_profit_reit_spv_amount).toBe('1000000.00');
    expect(shaped).not.toHaveProperty('dividend_u_s_150_0pc_share_profit_reit_spv');
  });

  it('leaves tax and total columns under their DB names', () => {
    const shaped = toFinalMinFrontendShape(row());
    expect(shaped.salary_u_s_12_7_tax_deducted).toBe('3365000.00');
    expect(shaped.dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable).toBe('0.00');
    expect(shaped.subtotal).toBe('18140000.00');
    expect(shaped.grand_total_tax_deducted).toBe('3645000.00');
  });

  it('leaves the bare-bound buckets unsuffixed', () => {
    const shaped = toFinalMinFrontendShape(row());
    expect(shaped.salary_u_s_12_7).toBe('16340000.00');
    expect(shaped.capital_gain).toBe('250000.00');
    expect(shaped).not.toHaveProperty('salary_u_s_12_7_amount');
    expect(shaped).not.toHaveProperty('capital_gain_amount');
  });

  it('passes metadata straight through', () => {
    const shaped = toFinalMinFrontendShape(row());
    expect(shaped.id).toBe('row-uuid');
    expect(shaped.tax_year).toBe('2025-26');
    expect(shaped.is_complete).toBe(false);
  });

  // The form reads a missing flag as filer (`vals.is_atl !== false`), so
  // suffixing is_atl would put a non-filer back on filer rates — about half the
  // correct final-tax rate.
  it('keeps is_atl bound so a non-filer is not silently made a filer', () => {
    const shaped = toFinalMinFrontendShape({ ...row(), is_atl: false });
    expect(shaped.is_atl).toBe(false);
    expect(shaped).not.toHaveProperty('is_atl_amount');
  });

  // The save response and the read paths both go through this function; if they
  // ever emit different keys, the client's post-save reset() blanks the form.
  it('is stable, so save and read payloads cannot drift apart', () => {
    expect(Object.keys(toFinalMinFrontendShape(row())).sort()).toEqual(
      Object.keys(toFinalMinFrontendShape(row())).sort()
    );
  });
});
