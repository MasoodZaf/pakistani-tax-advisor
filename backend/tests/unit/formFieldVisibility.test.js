const {
  ALWAYS_VISIBLE,
  ADDON_UNLOCKS,
  ADVANCED,
  visibleFieldsFor,
  computeUserField,
  findDuplicates,
} = require('../../../shared/formFieldVisibility');

// The 11 addons declared in the Onboarding INCOME_STREAMS catalog. The
// manifest's ADDON_UNLOCKS keys must be a subset (some addons may be
// declaration-only with no field unlocks).
const KNOWN_ADDONS = [
  'bank_profit', 'dividends', 'securities', 'sukuk', 'rental',
  'property_gain', 'directorship', 'foreign_income', 'prizes',
  'pension', 'agriculture',
];

describe('formFieldVisibility manifest', () => {
  test('every declared addon key matches the Onboarding catalog', () => {
    for (const addon of Object.keys(ADDON_UNLOCKS)) {
      expect(KNOWN_ADDONS).toContain(addon);
    }
  });

  test('no column is double-bucketed (always + addon + advanced)', () => {
    expect(findDuplicates()).toEqual([]);
  });

  test('every form table has at least one ALWAYS_VISIBLE column', () => {
    const expectedTables = [
      'income_forms',
      'adjustable_tax_forms',
      'deductions_forms',
      'credits_forms',
      'expenses_forms',
      'wealth_forms',
      'wealth_reconciliation_forms',
      'tax_computation_forms',
    ];
    for (const table of expectedTables) {
      const cols = ALWAYS_VISIBLE[table] || [];
      expect(cols.length).toBeGreaterThan(0);
    }
  });
});

describe('visibleFieldsFor()', () => {
  test('pure salaried (no addons): returns only ALWAYS_VISIBLE', () => {
    const v = visibleFieldsFor('adjustable_tax_forms', []);
    // Salary WHT must be visible — the load-bearing field for any filer.
    expect(v.has('salary_employees_149_tax_collected')).toBe(true);
    // Rental WHT must NOT be visible without the rental addon.
    expect(v.has('tax_deducted_rent_section_155_tax_collected')).toBe(false);
    // Vehicle transfer (advanced) must NOT be visible.
    expect(v.has('motor_vehicle_transfer_fee_231b2_tax_collected')).toBe(false);
  });

  test('selecting rental addon unlocks rental-WHT + income_forms rent', () => {
    const adj = visibleFieldsFor('adjustable_tax_forms', ['rental']);
    expect(adj.has('tax_deducted_rent_section_155_tax_collected')).toBe(true);
    expect(adj.has('tax_deducted_rent_section_155_gross_receipt')).toBe(true);

    const inc = visibleFieldsFor('income_forms', ['rental']);
    expect(inc.has('other_taxable_income_rent')).toBe(true);
  });

  test('selecting bank_profit unlocks profit-on-debt fields', () => {
    const fmi = visibleFieldsFor('final_min_income_forms', ['bank_profit']);
    expect(fmi.has('profit_on_debt_u_s_7b')).toBe(true);
    expect(fmi.has('interest_income_profit_debt_7b_up_to_5m')).toBe(true);
    // Dividends should NOT leak in.
    expect(fmi.has('dividend_u_s_150_31_atl_15pc')).toBe(false);
  });

  test('selecting multiple addons unions their field sets', () => {
    const v = visibleFieldsFor('final_min_income_forms', ['bank_profit', 'dividends', 'prizes']);
    expect(v.has('profit_on_debt_u_s_7b')).toBe(true);          // bank_profit
    expect(v.has('dividend_u_s_150_31_atl_15pc')).toBe(true);   // dividends
    expect(v.has('prize_bond_cross_world_puzzle_156')).toBe(true); // prizes
  });

  test('{ advanced: true } reveals ADVANCED fields', () => {
    const without = visibleFieldsFor('adjustable_tax_forms', []);
    const withAdv = visibleFieldsFor('adjustable_tax_forms', [], { advanced: true });
    expect(without.has('motor_vehicle_transfer_fee_231b2_tax_collected')).toBe(false);
    expect(withAdv.has('motor_vehicle_transfer_fee_231b2_tax_collected')).toBe(true);
  });

  test('wealth_forms is fully visible to every filer (FBR-mandatory)', () => {
    const v = visibleFieldsFor('wealth_forms', []);
    expect(v.has('property_current_year')).toBe(true);
    expect(v.has('bank_balance_current_year')).toBe(true);
    expect(v.has('loan_current_year')).toBe(true);
  });

  test('unknown table returns empty set', () => {
    const v = visibleFieldsFor('nonexistent_forms', ['bank_profit']);
    expect(v.size).toBe(0);
  });
});

describe('computeUserField()', () => {
  test('classifies always-visible fields', () => {
    expect(computeUserField('income_forms', 'annual_basic_salary')).toBe('always');
    expect(computeUserField('deductions_forms', 'zakat_paid_amount')).toBe('always');
  });

  test('classifies addon-unlocked fields with the right addon id', () => {
    expect(computeUserField('income_forms', 'other_taxable_income_rent')).toBe('addon:rental');
    expect(computeUserField('income_forms', 'directorship_fee')).toBe('addon:directorship');
    expect(computeUserField('income_forms', 'pension_from_ex_employer')).toBe('addon:pension');
  });

  test('classifies advanced fields', () => {
    expect(computeUserField('adjustable_tax_forms', 'telephone_bill_236_1e_tax_collected')).toBe('advanced');
    expect(computeUserField('credits_forms', 'life_insurance_premium_amount')).toBe('advanced');
  });

  test('unknown columns return "unknown"', () => {
    expect(computeUserField('income_forms', 'fake_column_xyz')).toBe('unknown');
  });
});

// ───────────────────────────────────────────────────────────────────────
// Drift guard: the canonical manifest at /shared/formFieldVisibility.js
// is also mirrored at /Frontend/src/shared/ because CRA's
// ModuleScopePlugin blocks imports outside src/. The two files MUST stay
// identical — this test fails fast if they drift. To resync, run:
//   cp shared/formFieldVisibility.js Frontend/src/shared/
// ───────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

describe('formFieldVisibility — sync between repo /shared/ and Frontend/src/shared/', () => {
  test('canonical and Frontend mirror are byte-identical', () => {
    const canonical = fs.readFileSync(
      path.resolve(__dirname, '../../../shared/formFieldVisibility.js'),
      'utf8'
    );
    const mirror = fs.readFileSync(
      path.resolve(__dirname, '../../../Frontend/src/shared/formFieldVisibility.js'),
      'utf8'
    );
    expect(mirror).toBe(canonical);
  });
});
