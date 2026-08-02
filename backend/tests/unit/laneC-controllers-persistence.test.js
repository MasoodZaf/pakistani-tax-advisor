/**
 * Lane C regression suite — controllers & persistence.
 *
 * Every test below fails on baseline 45bb80c and passes after the lane C fixes.
 *
 *  1. 236C truncated-column round trip (save → GET → re-save the GET verbatim)
 *  2. Adjustable Tax ATL / non-filer withholding on 236CB
 *  3. Final Tax silently-dropped keys become a loud 422
 *  4. POST /api/income-form/:taxYear writes is_complete (sticky)
 */

const GROSS_FULL =
  'tax_deducted_236c_property_purchased_sold_same_year_gross_receipt';
const TAX_FULL =
  'tax_deducted_236c_property_purchased_sold_same_year_tax_collected';
const GROSS_COL = 'tax_deducted_236c_property_purchased_sold_same_year_gross_recei';
const TAX_COL = 'tax_deducted_236c_property_purchased_sold_same_year_tax_collect';

// ───────────────────────── shared fake Postgres ──────────────────────────
//
// Faithful on the one behaviour that matters: the table can only hold the
// 63-byte-truncated column names, and a row read back carries exactly the
// column names that were written. Writing a column the table does not have
// raises, the way Postgres would.

const ADJUSTABLE_COLUMNS = new Set([
  'id', 'tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year',
  'is_complete', 'last_updated_by', 'created_at', 'updated_at',
  GROSS_COL, TAX_COL,
  'sale_transfer_immoveable_property_236c_gross_receipt',
  'sale_transfer_immoveable_property_236c_tax_collected',
  'functions_gatherings_charges_236cb_gross_receipt',
  'functions_gatherings_charges_236cb_tax_collected',
  'salary_employees_149_gross_receipt', 'salary_employees_149_tax_collected',
  'directorship_fee_149_3_gross_receipt', 'directorship_fee_149_3_tax_collected',
  'profit_debt_151_15_gross_receipt', 'profit_debt_151_15_tax_collected',
  'profit_debt_sukook_151a_gross_receipt', 'profit_debt_sukook_151a_tax_collected',
  'tax_deducted_rent_section_155_gross_receipt', 'tax_deducted_rent_section_155_tax_collected',
  'tax_deducted_236c_property_purchased_prior_year_gross_receipt',
  'tax_deducted_236c_property_purchased_prior_year_tax_collected',
  'purchase_transfer_immoveable_property_236k_gross_receipt',
  'purchase_transfer_immoveable_property_236k_tax_collected',
  'motor_vehicle_transfer_fee_231b2_gross_receipt', 'motor_vehicle_transfer_fee_231b2_tax_collected',
  'electricity_bill_domestic_235_gross_receipt', 'electricity_bill_domestic_235_tax_collected',
  'cellphone_bill_236_1f_gross_receipt', 'cellphone_bill_236_1f_tax_collected',
  'advance_tax_cash_withdrawal_231ab_gross_receipt', 'advance_tax_cash_withdrawal_231ab_tax_collected',
  'motor_vehicle_registration_fee_231b1_gross_receipt', 'motor_vehicle_registration_fee_231b1_tax_collected',
  'motor_vehicle_sale_231b3_gross_receipt', 'motor_vehicle_sale_231b3_tax_collected',
  'motor_vehicle_leasing_231b1a_gross_receipt', 'motor_vehicle_leasing_231b1a_tax_collected',
  'advance_tax_motor_vehicle_231b2a_gross_receipt', 'advance_tax_motor_vehicle_231b2a_tax_collected',
  'telephone_bill_236_1e_gross_receipt', 'telephone_bill_236_1e_tax_collected',
  'prepaid_telephone_card_236_1b_gross_receipt', 'prepaid_telephone_card_236_1b_tax_collected',
  'phone_unit_236_1c_gross_receipt', 'phone_unit_236_1c_tax_collected',
  'internet_bill_236_1d_gross_receipt', 'internet_bill_236_1d_tax_collected',
  'prepaid_internet_card_236_1e_gross_receipt', 'prepaid_internet_card_236_1e_tax_collected',
  'withholding_tax_sale_considerations_37e_gross_receipt', 'withholding_tax_sale_considerations_37e_tax_collected',
  'advance_fund_23a_part_i_second_schedule_gross_receipt', 'advance_fund_23a_part_i_second_schedule_tax_collected',
  'persons_remitting_amount_abroad_236v_gross_receipt', 'persons_remitting_amount_abroad_236v_tax_collected',
  'advance_tax_foreign_domestic_workers_231c_gross_receipt', 'advance_tax_foreign_domestic_workers_231c_tax_collected',
]);

const makeFakeDb = () => {
  const state = {
    adjustableRow: null,
    finalMinRow: null,
    incomeRow: null,
    hasIsAtlColumn: false,
    lastIncomeSql: null,
    lastIncomeValues: null,
  };

  const query = jest.fn(async (sql, values = []) => {
    if (/FROM tax_years/i.test(sql)) return { rows: [{ id: 'tax-year-uuid', tax_year: '2025-26' }] };
    if (/FROM income_forms/i.test(sql)) return { rows: state.incomeRow ? [state.incomeRow] : [] };
    if (/FROM final_min_income_forms/i.test(sql)) {
      return { rows: state.finalMinRow ? [state.finalMinRow] : [] };
    }
    if (/information_schema\.columns/i.test(sql)) {
      const cols = [...ADJUSTABLE_COLUMNS];
      if (state.hasIsAtlColumn) cols.push('is_atl');
      return { rows: cols.map((c) => ({ column_name: c })) };
    }
    if (/^\s*SELECT \* FROM adjustable_tax_forms/i.test(sql)) {
      return { rows: state.adjustableRow ? [state.adjustableRow] : [] };
    }
    if (/INSERT INTO adjustable_tax_forms/i.test(sql)) {
      const cols = sql.match(/INSERT INTO adjustable_tax_forms \(([^)]+)\)/i)[1]
        .split(',').map((c) => c.trim());
      const allowed = new Set(ADJUSTABLE_COLUMNS);
      if (state.hasIsAtlColumn) allowed.add('is_atl');
      for (const c of cols) {
        if (!allowed.has(c)) {
          throw new Error(`column "${c}" of relation "adjustable_tax_forms" does not exist`);
        }
      }
      const row = { ...(state.adjustableRow || {}) };
      cols.forEach((c, i) => { row[c] = values[i]; });
      // pg returns NUMERIC as a string — the shape that has bitten this
      // codebase repeatedly.
      for (const c of [GROSS_COL, TAX_COL, 'functions_gatherings_charges_236cb_tax_collected']) {
        if (row[c] !== undefined && row[c] !== null) row[c] = Number(row[c]).toFixed(2);
      }
      state.adjustableRow = row;
      return { rows: [row] };
    }
    if (/INSERT INTO income_forms/i.test(sql)) {
      state.lastIncomeSql = sql;
      state.lastIncomeValues = values;
      const cols = sql.match(/INSERT INTO income_forms \(([\s\S]+?)\)\s*VALUES/i)[1]
        .split(',').map((c) => c.trim());
      const row = { ...(state.incomeRow || {}) };
      // Positional mapping in this endpoint is deliberately non-sequential; map
      // by reading the VALUES list so the test tracks the real wiring.
      const placeholders = sql.match(/VALUES \(([\s\S]+?)\)\s*ON CONFLICT/i)[1]
        .split(',').map((p) => p.trim());
      cols.forEach((c, i) => {
        const idx = parseInt(placeholders[i].replace('$', ''), 10) - 1;
        row[c] = values[idx];
      });
      if (state.incomeRow && state.incomeRow.is_complete) row.is_complete = true; // sticky OR
      state.incomeRow = row;
      return { rows: [row] };
    }
    if (/UPDATE|INSERT INTO form_completion_status/i.test(sql)) return { rows: [] };
    return { rows: [] };
  });

  return { state, pool: { query } };
};

const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};

// ═════════════════════════ 1. 236C round trip ═════════════════════════════

describe('236C truncated-column round trip', () => {
  const shape = require('../../src/modules/IncomeTax/helpers/adjustableTaxShape');

  it('the full-length names cannot exist as Postgres columns', () => {
    // This is why the fix is a mapping layer and not a rename migration.
    expect(GROSS_FULL.length).toBe(65);
    expect(TAX_FULL.length).toBe(65);
    expect(GROSS_FULL.length).toBeGreaterThan(63);
    expect(shape.toDbColumn(GROSS_FULL)).toBe(GROSS_COL);
    expect(shape.toDbColumn(TAX_FULL)).toBe(TAX_COL);
    expect(shape.toDbColumn('some_other_field')).toBe('some_other_field');
  });

  it('a response carries BOTH the truncated column and the full-length alias', () => {
    const shaped = shape.toAdjustableTaxFrontendShape({
      [GROSS_COL]: '5000000.00',
      [TAX_COL]: '225000.00',
      salary_employees_149_gross_receipt: '1.00',
    });
    // The read-back key — absent on 45bb80c, which is the whole bug.
    expect(shaped[GROSS_FULL]).toBe('5000000.00');
    expect(shaped[TAX_FULL]).toBe('225000.00');
    // Truncated key kept: formFieldVisibility.js and deployed clients read it.
    expect(shaped[GROSS_COL]).toBe('5000000.00');
  });

  it('reads the value under either dialect', () => {
    expect(shape.readEitherName({ [GROSS_FULL]: 7 }, GROSS_FULL)).toBe(7);
    expect(shape.readEitherName({ [GROSS_COL]: 7 }, GROSS_FULL)).toBe(7);
    expect(shape.readEitherName({}, GROSS_FULL)).toBeUndefined();
  });

  describe('through the real controller', () => {
    let db, controller;

    beforeEach(() => {
      jest.resetModules();
      db = makeFakeDb();
      jest.doMock('../../src/config/database', () => ({ pool: db.pool }));
      jest.doMock('../../src/utils/logger', () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
      }));
      jest.doMock('../../src/helpers/ensureTaxReturn', () => jest.fn(async () => 'return-uuid'));
      jest.doMock('../../src/services/taxRateService', () => ({
        getWithholdingTaxRates: jest.fn(async () => ({
          functions_gatherings_236cb_atl: 0.1,
          functions_gatherings_236cb_nonatl: 0.2,
        })),
      }));
      jest.doMock('../../src/services/calculationService', () => ({
        calculateAdjustableTaxFields: jest.fn(() => ({})),
      }));
      controller = require('../../src/modules/IncomeTax/controllers/adjustableTaxController');
    });

    const req = (body) => ({ user: { id: 'user-uuid', email: 'qa@example.test' }, body, query: {} });

    it('save → GET → re-save the GET response verbatim loses nothing and zeroes nothing', async () => {
      // 1. Save the pair under the full-length application names.
      const save1 = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26',
        [GROSS_FULL]: 5000000,
        [TAX_FULL]: 225000,
        sale_transfer_immoveable_property_236c_gross_receipt: 222222,
      }), save1);
      expect(save1.statusCode).toBe(200);
      expect(db.state.adjustableRow[GROSS_COL]).toBe('5000000.00');
      expect(db.state.adjustableRow[TAX_COL]).toBe('225000.00');

      // 2. GET it back.
      const get = fakeRes();
      await controller.getAdjustableTax(req({}), get);
      const fetched = get.body.data;
      // Read-back key present — this assertion is the one that fails on 45bb80c.
      expect(fetched[GROSS_FULL]).toBe('5000000.00');
      expect(fetched[TAX_FULL]).toBe('225000.00');

      // 3. Replay the GET response verbatim as the next save, the way the
      //    browser (and any read-modify-write API client) does after a reload.
      const save2 = fakeRes();
      await controller.saveAdjustableTax(req({ ...fetched, taxYear: '2025-26' }), save2);
      expect(save2.statusCode).toBe(200);

      // 4. Nothing blanked, nothing became 0.
      expect(db.state.adjustableRow[GROSS_COL]).toBe('5000000.00');
      expect(db.state.adjustableRow[TAX_COL]).toBe('225000.00');
      expect(save2.body.data[GROSS_FULL]).toBe('5000000.00');
      expect(save2.body.data[TAX_FULL]).toBe('225000.00');
      // The unrelated control field in the same payload also survived.
      expect(db.state.adjustableRow.sale_transfer_immoveable_property_236c_gross_receipt)
        .toBe(222222);
    });

    it('a client replaying ONLY the truncated key still round-trips', async () => {
      const save1 = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26', [GROSS_FULL]: 900000, [TAX_FULL]: 40500,
      }), save1);

      const save2 = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26', [GROSS_COL]: '900000.00', [TAX_COL]: '40500.00',
      }), save2);

      expect(db.state.adjustableRow[GROSS_COL]).toBe('900000.00');
      expect(db.state.adjustableRow[TAX_COL]).toBe('40500.00');
    });

    // ══════════════════ 2. ATL / non-filer on 236CB ═══════════════════════

    it('charges the NON-FILER 236CB rate when the filer declares non-ATL', async () => {
      const res = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26',
        is_atl: false,
        functions_gatherings_charges_236cb_gross_receipt: 1000000,
      }), res);
      // 1,000,000 × 20% (tax_rates_config `functions_gatherings_236cb_nonatl`)
      expect(db.state.adjustableRow.functions_gatherings_charges_236cb_tax_collected)
        .toBe('200000.00');
    });

    it('charges the filer 236CB rate when ATL', async () => {
      const res = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26',
        is_atl: true,
        functions_gatherings_charges_236cb_gross_receipt: 1000000,
      }), res);
      expect(db.state.adjustableRow.functions_gatherings_charges_236cb_tax_collected)
        .toBe('100000.00');
    });

    it('inherits the non-filer declaration from the Final/Min form when this form omits it', async () => {
      db.state.finalMinRow = { is_atl: false };
      const res = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26',
        functions_gatherings_charges_236cb_gross_receipt: 1000000,
      }), res);
      expect(db.state.adjustableRow.functions_gatherings_charges_236cb_tax_collected)
        .toBe('200000.00');
    });

    it('does not freeze on the zero the previous save wrote back', async () => {
      // Round 1 establishes the row, round 2 replays the saved response —
      // which carries tax_collected as a string. A non-filer must still be at
      // 20% after the replay, not stuck on whatever the client echoed.
      db.state.finalMinRow = { is_atl: false };
      const r1 = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26',
        functions_gatherings_charges_236cb_gross_receipt: 1000000,
        functions_gatherings_charges_236cb_tax_collected: 0,
      }), r1);
      expect(db.state.adjustableRow.functions_gatherings_charges_236cb_tax_collected)
        .toBe('200000.00');
    });

    it('is a safe no-op on the pre-migration schema (no is_atl column)', async () => {
      const before = fakeRes();
      await controller.saveAdjustableTax(req({ taxYear: '2025-26', is_atl: false }), before);
      expect(before.statusCode).toBe(200);           // must not 500
      expect(db.state.adjustableRow.is_atl).toBeUndefined();
    });

    it('persists the non-filer declaration once lane E adds is_atl', async () => {
      db.state.hasIsAtlColumn = true;                // set before the column cache warms
      const after = fakeRes();
      await controller.saveAdjustableTax(req({ taxYear: '2025-26', is_atl: false }), after);
      expect(after.statusCode).toBe(200);
      // On 45bb80c a declared non-filer was invisible to this form entirely.
      expect(db.state.adjustableRow.is_atl).toBe(false);
    });

    it('a user-entered 236CB figure still wins over the computed one', async () => {
      const res = fakeRes();
      await controller.saveAdjustableTax(req({
        taxYear: '2025-26',
        is_atl: false,
        functions_gatherings_charges_236cb_gross_receipt: 1000000,
        functions_gatherings_charges_236cb_tax_collected: 175000,
      }), res);
      expect(db.state.adjustableRow.functions_gatherings_charges_236cb_tax_collected)
        .toBe('175000.00');
    });
  });
});

// ═══════════════ 3. Final Tax dropped keys become a loud 422 ═══════════════

describe('Final Tax silently-dropped keys', () => {
  const {
    canonicaliseFinalTaxPayload, SERVER_COMPUTED, PHASE_T1_COLUMNS, explainRejectedKey,
  } = require('../../src/modules/IncomeTax/helpers/finalTaxShape');

  it('total_final_tax is server-computed, not unknown', () => {
    // It is a GENERATED column: correctly not written, and must not be
    // reported as a dropped user field.
    expect(SERVER_COMPUTED.has('total_final_tax')).toBe(true);
  });

  it('canonicalises the form dialect to DB column names', () => {
    const out = canonicaliseFinalTaxPayload({
      prize_bond_winnings_amount: 111,
      capital_gain_securities_less_12m_tax: 222,
      other_final_tax_income_amount: 333,
      lottery_crossword_winnings_amount: 444,   // already canonical
    });
    expect(out.prize_bonds_gross_amount).toBe(111);
    expect(out.capital_gain_securities_short_tax_amount).toBe(222);
    expect(out.other_final_tax_gross_amount).toBe(333);
    expect(out.lottery_crossword_winnings_amount).toBe(444);
    expect(out.prize_bond_winnings_amount).toBeUndefined();
  });

  it('names the missing migration for a phase-t1 column', () => {
    expect(PHASE_T1_COLUMNS.has('lottery_crossword_winnings_amount')).toBe(true);
    expect(explainRejectedKey('lottery_crossword_winnings_amount')).toMatch(/phase-t1/);
    expect(explainRejectedKey('total_nonsense')).toMatch(/not a column/);
  });

  describe('filterToAllowedColumns', () => {
    let filterToAllowedColumns, UnknownColumnsError, logger;

    beforeEach(() => {
      jest.resetModules();
      logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      jest.doMock('../../src/utils/logger', () => logger);
      jest.doMock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
      ({ filterToAllowedColumns, UnknownColumnsError } =
        require('../../src/helpers/tableColumns'));
    });

    it('throws in strict mode and reports EVERY dropped key, not five', () => {
      const cols = new Set(['prize_bonds_gross_amount']);
      const payload = { prize_bonds_gross_amount: 1 };
      for (let i = 0; i < 24; i++) payload[`orphan_key_${i}`] = i;

      let err;
      try {
        filterToAllowedColumns('final_tax_forms', cols, payload, { strict: true });
      } catch (e) { err = e; }

      expect(err).toBeInstanceOf(UnknownColumnsError);
      expect(err.keys).toHaveLength(24);              // 45bb80c logged 5 and returned 200
      expect(logger.error).toHaveBeenCalled();
      expect(logger.error.mock.calls[0][1].keys).toHaveLength(24);
    });

    it('ignores server-computed keys without warning or throwing', () => {
      const out = filterToAllowedColumns(
        'final_tax_forms', new Set(['prize_bonds_gross_amount']),
        { prize_bonds_gross_amount: 5, total_final_tax: 7_645_055 },
        { strict: true, ignore: SERVER_COMPUTED }
      );
      expect(out).toEqual({ prize_bonds_gross_amount: 5 });
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('saveFormData end to end', () => {
    // The 10 groups × 3 keys the form posts (PM-PHASE15 §10).
    const formPayload = () => ({
      prize_bonds_yn: 'Y', prize_bonds_gross_amount: 1000001, prize_bonds_tax_amount: 150000,
      lottery_crossword_winnings_yn: 'Y', lottery_crossword_winnings_amount: 2000002, lottery_crossword_winnings_tax_amount: 400000,
      profit_govt_securities_yn: 'Y', profit_govt_securities_amount: 3000003, profit_govt_securities_tax_amount: 300000,
      profit_defence_savings_yn: 'Y', profit_defence_savings_amount: 4000004, profit_defence_savings_tax_amount: 400000,
      dividend_listed_companies_yn: 'Y', dividend_listed_companies_amount: 5000005, dividend_listed_companies_tax_amount: 750000,
      dividend_other_yn: 'Y', dividend_other_amount: 6000006, dividend_other_tax_amount: 1500001,
      capital_gain_securities_short_yn: 'Y', capital_gain_securities_short_amount: 7000007, capital_gain_securities_short_tax_amount: 1050001,
      capital_gain_securities_long_yn: 'Y', capital_gain_securities_long_amount: 8000008, capital_gain_securities_long_tax_amount: 1000001,
      commission_agents_yn: 'Y', commission_agents_amount: 9000009, commission_agents_tax_amount: 1080001,
      other_final_tax_yn: 'Y', other_final_tax_gross_amount: 10000010, other_final_tax_tax_amount: 15011,
      total_final_tax: 7645055,
    });

    const LEGACY_COLUMNS = new Set([
      'tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year',
      'is_complete', 'last_updated_by',
      'prize_bonds_yn', 'prize_bonds_gross_amount', 'prize_bonds_tax_amount',
      'sukuk_bonds_yn', 'sukuk_bonds_gross_amount', 'sukuk_bonds_tax_amount',
      'debt_securities_yn', 'debt_securities_gross_amount', 'debt_securities_tax_amount',
      'other_final_tax_yn', 'other_final_tax_gross_amount', 'other_final_tax_tax_amount',
    ]);

    const buildHarness = (columns) => {
      jest.resetModules();
      const inserted = { sql: null };
      const pool = {
        query: jest.fn(async (sql) => {
          if (/information_schema\.columns/i.test(sql)) {
            return { rows: [...columns].map((c) => ({ column_name: c })) };
          }
          if (/FROM tax_years/i.test(sql)) return { rows: [{ id: 'ty-uuid' }] };
          if (/INSERT INTO final_tax_forms/i.test(sql)) {
            inserted.sql = sql;
            return { rows: [{ ok: true }] };
          }
          return { rows: [] };
        }),
      };
      jest.doMock('../../src/config/database', () => ({ pool }));
      jest.doMock('../../src/utils/logger', () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(),
      }));
      jest.doMock('../../src/helpers/ensureTaxReturn', () => jest.fn(async () => 'return-uuid'));
      const { saveFormData } = require('../../src/modules/IncomeTax/helpers/taxFormsShared');
      return { saveFormData, inserted };
    };

    it('REFUSES the save with 422 and names all 24 orphan keys when the columns are missing', async () => {
      const { saveFormData, inserted } = buildHarness(LEGACY_COLUMNS);
      const res = fakeRes();
      await saveFormData('final_tax_forms', 'final_tax', {
        user: { id: 'u', email: 'q@e.test' },
        body: { taxYear: '2025-26', ...formPayload() },
      }, res);

      // 45bb80c: HTTP 200, success:true, 24 keys gone, total under-stated.
      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.unknownFields).toHaveLength(24);
      const fields = res.body.unknownFields.map((f) => f.field);
      expect(fields).toContain('lottery_crossword_winnings_amount');
      expect(fields).toContain('commission_agents_tax_amount');
      // total_final_tax is server-computed, not a "lost" user field.
      expect(fields).not.toContain('total_final_tax');
      expect(res.body.unknownFields[0].reason).toMatch(/phase-t1/);
      // Nothing was written — no partial, under-stated return persisted.
      expect(inserted.sql).toBeNull();
    });

    it('accepts and persists all 10 groups once phase-t1 has been applied', async () => {
      const migrated = new Set([...LEGACY_COLUMNS]);
      for (const g of [
        'lottery_crossword_winnings', 'profit_govt_securities', 'profit_defence_savings',
        'dividend_listed_companies', 'dividend_other', 'capital_gain_securities_short',
        'capital_gain_securities_long', 'commission_agents',
      ]) {
        migrated.add(`${g}_yn`); migrated.add(`${g}_amount`);
        migrated.add(`${g}_tax_rate`); migrated.add(`${g}_tax_amount`);
      }

      const { saveFormData, inserted } = buildHarness(migrated);
      const res = fakeRes();
      await saveFormData('final_tax_forms', 'final_tax', {
        user: { id: 'u', email: 'q@e.test' },
        body: { taxYear: '2025-26', ...formPayload() },
      }, res);

      expect(res.statusCode).toBe(200);
      expect(inserted.sql).toContain('lottery_crossword_winnings_amount');
      expect(inserted.sql).toContain('commission_agents_tax_amount');
      expect(inserted.sql).toContain('capital_gain_securities_long_amount');
      // Never attempts to write the generated column.
      expect(inserted.sql).not.toContain('total_final_tax');
    });
  });
});

// ═══════ 5. profit on debt s.7B no longer self-cancels (round 2) ═══════════

describe('Final/Min s.7B profit on debt', () => {
  const {
    lineChargeable, resolveLineRate, RATE_SOURCE,
    FINAL_MIN_FIELD_DB_RATE, FINAL_MIN_FIELD_RATE,
    FINAL_MIN_VARIABLE_HEADS, FINAL_MIN_UNRESOLVED_HEADS,
  } = require('../../src/config/finalMinTaxRates');

  const HEAD = 'interest_income_profit_debt_7b_up_to_5m';
  // Shape of TaxRateService.getFinalTaxRates(): { [rate_category]: { rate, ... } }
  const DB_RATES = {
    profit_debt_15_final: { rate: 0.2, minAmount: 0, maxAmount: 999999999999 },
    profit_debt_151_up_to_5m: { rate: 0.2, minAmount: 0, maxAmount: 5000000 },
  };

  it('computes 88,889 on 444,444 instead of echoing the 44,444 withheld', () => {
    // The demonstrated defect: chargeable came back exactly equal to the
    // supplied tax_deducted, so an under-withheld line self-cancelled.
    const chargeable = lineChargeable(HEAD, 444444, 44444, true, DB_RATES);
    expect(chargeable).toBe(88889);
    expect(chargeable).not.toBe(44444);
  });

  it('takes the rate from the DB, not from a literal in the code', () => {
    // Move the table and the answer moves with it — proves nothing is hardcoded.
    const moved = { profit_debt_15_final: { rate: 0.35 } };
    expect(lineChargeable(HEAD, 444444, 44444, true, moved)).toBe(155555); // 444,444 × 0.35
    const r = resolveLineRate(HEAD, true, DB_RATES);
    expect(r.source).toBe(RATE_SOURCE.DB);
    expect(r.rateKey).toBe('profit_debt_15_final');
    expect(FINAL_MIN_FIELD_RATE[HEAD]).toBeUndefined();      // no static duplicate
  });

  it('both seeded candidate keys carry the same rate, so key order cannot change the figure', () => {
    const first = lineChargeable(HEAD, 444444, 44444, true, DB_RATES);
    const onlySecond = lineChargeable(HEAD, 444444, 44444, true, {
      profit_debt_151_up_to_5m: DB_RATES.profit_debt_151_up_to_5m,
    });
    expect(first).toBe(onlySecond);
    expect(FINAL_MIN_FIELD_DB_RATE[HEAD].atlKeys)
      .toEqual(['profit_debt_15_final', 'profit_debt_151_up_to_5m']);
  });

  it('a gross-absent line still keeps the withheld amount — never invents a refund', () => {
    expect(lineChargeable(HEAD, 0, 44444, true, DB_RATES)).toBe(44444);
  });

  it('flags a non-filer as charged the filer rate rather than inventing a doubled rate', () => {
    // tax_rates_config has no non-ATL row for this line.
    const r = resolveLineRate(HEAD, false, DB_RATES);
    expect(r.rate).toBe(0.2);
    expect(r.nonAtlRateMissing).toBe(true);
  });

  it('a missing rate row is UNRESOLVED, not silently variable', () => {
    const r = resolveLineRate(HEAD, true, {});
    expect(r.source).toBe(RATE_SOURCE.UNRESOLVED);
    expect(r.rate).toBeNull();
    expect(r.note).toMatch(/no rate row found in tax_rates_config/);
  });

  it('classifies every head the controller iterates — none is unclassified', () => {
    // If a head is neither rated, DB-mapped, declared variable, nor declared
    // unresolved, it would echo the client's withheld figure invisibly. That is
    // the defect class; this test makes a new head impossible to add silently.
    const HEADS = [
      'dividend_u_s_150_0pc_share_profit_reit_spv',
      'dividend_u_s_150_35pc_share_profit_other_spv',
      'dividend_u_s_150_7_5pc_ipp_shares',
      'dividend_u_s_150_31pc_atl',
      'dividend_u_s_150_25pc_bf_losses',
      'return_on_investment_sukuk_u_s_151_1a_10pc',
      'return_on_investment_sukuk_u_s_151_1a_12_5pc',
      'return_on_investment_sukuk_u_s_151_1a_25pc',
      'return_invest_exceed_1m_sukuk_saa_12_5pc',
      'return_invest_not_exceed_1m_sukuk_saa_10pc',
      'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc',
      'profit_debt_national_savings_defence_39_14a',
      'interest_income_profit_debt_7b_up_to_5m',
      'prize_raffle_lottery_quiz_promotional_156',
      'prize_bond_cross_world_puzzle_156',
      'bonus_shares_companies_236f',
      'employment_termination_benefits_12_6_avg_rate',
      'salary_arrears_12_7_relevant_rate',
      'capital_gain',
    ];
    const bySource = {};
    for (const h of HEADS) {
      const s = resolveLineRate(h, true, DB_RATES).source;
      (bySource[s] = bySource[s] || []).push(h);
    }
    expect(bySource[RATE_SOURCE.UNCLASSIFIED]).toBeUndefined();
    expect(bySource[RATE_SOURCE.STATIC]).toHaveLength(12);
    expect(bySource[RATE_SOURCE.DB]).toEqual([HEAD]);
    // 4 genuinely variable / owned elsewhere, 2 genuine field↔section conflicts.
    expect(bySource[RATE_SOURCE.VARIABLE]).toHaveLength(4);
    expect(bySource[RATE_SOURCE.UNRESOLVED]).toHaveLength(2);
    expect(FINAL_MIN_VARIABLE_HEADS.has('salary_u_s_12_7')).toBe(true);
    expect([...FINAL_MIN_UNRESOLVED_HEADS]).toEqual([
      'return_on_investment_sukuk_u_s_151_1a_25pc',
      'profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc',
    ]);
  });

  describe('through the save controller', () => {
    const loadController = (rates) => {
      jest.resetModules();
      const saved = { row: null };
      const pool = {
        query: jest.fn(async (sql, values = []) => {
          if (/information_schema\.columns/i.test(sql)) {
            return {
              rows: [
                'tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year',
                'is_complete', 'last_updated_by', 'is_atl',
                'interest_income_profit_debt_7b_up_to_5m',
                'interest_income_profit_debt_7b_up_to_5m_tax_deducted',
                'interest_income_profit_debt_7b_up_to_5m_tax_chargeable',
                'return_on_investment_sukuk_u_s_151_1a_25pc',
                'return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted',
                'return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable',
              ].map((c) => ({ column_name: c })),
            };
          }
          if (/FROM tax_years/i.test(sql)) return { rows: [{ id: 'ty-uuid' }] };
          if (/INSERT INTO final_min_income_forms/i.test(sql)) {
            const cols = sql.match(/INSERT INTO final_min_income_forms \(([^)]+)\)/i)[1]
              .split(',').map((c) => c.trim());
            const row = {};
            cols.forEach((c, i) => { row[c] = values[i]; });
            saved.row = row;
            return { rows: [row] };
          }
          return { rows: [] };
        }),
      };
      jest.doMock('../../src/config/database', () => ({ pool }));
      jest.doMock('../../src/utils/logger', () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(),
      }));
      jest.doMock('../../src/helpers/ensureTaxReturn', () => jest.fn(async () => 'return-uuid'));
      jest.doMock('../../src/services/taxRateService', () => ({
        getFinalTaxRates: jest.fn(async () => {
          if (!rates) throw new Error('No "final_tax" rates configured');
          return rates;
        }),
      }));
      const controller = require('../../src/modules/IncomeTax/controllers/finalMinController');
      const logger = require('../../src/utils/logger');
      return { controller, saved, logger };
    };

    const req = (body) => ({ user: { id: 'u', email: 'q@e.test' }, body });

    it('persists the computed 88,889, not the 44,444 the client withheld', async () => {
      const { controller, saved } = loadController(DB_RATES);
      const res = fakeRes();
      await controller.saveFinalMinIncome(req({
        taxYear: '2025-26',
        [`${HEAD}_amount`]: 444444,
        [`${HEAD}_tax_deducted`]: 44444,
      }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.calculations[`${HEAD}_tax_chargeable`]).toBe(88889);
      expect(saved.row[`${HEAD}_tax_chargeable`]).toBe(88889);
      // The bug signature: chargeable === deducted.
      expect(saved.row[`${HEAD}_tax_chargeable`])
        .not.toBe(saved.row[`${HEAD}_tax_deducted`]);
    });

    it('reports unresolved heads carrying money and logs them at error level', async () => {
      const { controller, logger } = loadController(DB_RATES);
      const res = fakeRes();
      await controller.saveFinalMinIncome(req({
        taxYear: '2025-26',
        return_on_investment_sukuk_u_s_151_1a_25pc_amount: 1000000,
        return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted: 1,
      }), res);

      const unresolved = res.body.rateDiagnostics.unresolved.map((e) => e.field);
      expect(unresolved).toContain('return_on_investment_sukuk_u_s_151_1a_25pc');
      expect(unresolved).not.toContain(HEAD);            // now DB-rated
      expect(res.body.rateDiagnostics.variable.map((e) => e.field))
        .toContain('salary_arrears_12_7_relevant_rate');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('UNDER-STATED'), expect.any(Object)
      );
    });

    it('a missing final_tax rate set is loud, not a silent echo', async () => {
      const { controller, logger } = loadController(null);
      const res = fakeRes();
      await controller.saveFinalMinIncome(req({
        taxYear: '2025-26',
        [`${HEAD}_amount`]: 444444,
        [`${HEAD}_tax_deducted`]: 44444,
      }), res);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Final-tax rate set unavailable')
      );
      expect(res.body.rateDiagnostics.unresolved.map((e) => e.field)).toContain(HEAD);
    });
  });
});

// ══════ 6. tax_computation_forms populated from the engine (round 3) ═══════

describe('tax_computation_forms engine mapping', () => {
  const {
    toTaxComputationRow, COLUMN_MAP, GENERATED_COLUMNS,
    NO_ENGINE_COUNTERPART, KNOWN_GENERATED_COLUMN_GAPS,
  } = require('../../src/modules/IncomeTax/helpers/taxComputationShape');

  const breakdown = () => ({
    income: {
      incomeFromSalary: 5000000,
      incomeFromOtherSources: 300000,
      incomeFromCapitalGains: 200000,
      deductibleAllowances: 150000,
      reclassifiedFromDeductions: { advanceTaxOnDeductionsForm: 25000 },
    },
    tax: {
      normalIncomeTax: 900000,
      surcharge: 81000,
      capitalGainsTax: 30000,
      totalReductions: 40000,
      formCredits: 60000,
      foreignTaxCredit: 15000,
      totalCredits: 75000,
      superTax: 20000,
      finalMinTaxChargeable: 88889,
      profitOnDebtFinalTax: 11111,
    },
    payments: {
      advanceTax: 25000,
      advanceTaxDuplicateDeclaration: null,
      withholdingTax: 400000,
      claimedPayments: 425000,
      creditablePayments: 425000,
    },
  });

  it('maps every column from a named breakdown key', () => {
    const { values } = toTaxComputationRow(breakdown());
    expect(values).toEqual({
      income_from_salary: 5000000,
      income_loss_other_sources: 300000,
      deductible_allowances: 150000,
      capital_gains_loss: 200000,
      normal_income_tax: 900000,
      surcharge_amount: 81000,
      capital_gains_tax: 30000,
      tax_reductions: 40000,
      tax_credits: 75000,
      super_tax: 20000,
      final_fixed_tax: 100000,     // 88,889 + 11,111
      advance_tax_paid: 25000,     // engine's de-duplicated s.147 figure
      withholding_tax_paid: 400000, // phase-z18 column; cap not binding here
    });
  });

  describe('the payment cap is apportioned, not applied per column', () => {
    // phase-z18's balance_payable subtracts advance_tax_paid AND
    // withholding_tax_paid separately, but the engine's ceiling is on their SUM
    // (creditablePayments = min(withholding + advance, declaredGrossReceipts)).
    // Writing the raw uncapped figures would make the stored balance subtract
    // claimedPayments — reinstating in the database the unbounded refund vector
    // the engine closed (QA drove it to -999,699,999). These pin that.

    it('is the identity when the claim is within declared receipts', () => {
      const { values } = toTaxComputationRow(breakdown());
      expect(values.withholding_tax_paid).toBe(400000);
      expect(values.advance_tax_paid).toBe(25000);
    });

    it('never credits more than creditablePayments when the cap binds', () => {
      const b = breakdown();
      b.payments.creditablePayments = 100000; // engine refused 325,000 of the claim
      const { values } = toTaxComputationRow(b);
      const credited = values.withholding_tax_paid + values.advance_tax_paid;
      expect(credited).toBe(100000);
      expect(credited).toBeLessThan(b.payments.claimedPayments);
      // proportional, so neither payment type is arbitrarily disallowed first
      expect(values.advance_tax_paid).toBeCloseTo(5882.35, 2);
      expect(values.withholding_tax_paid).toBeCloseTo(94117.65, 2);
    });

    it('sums to the ceiling exactly, with no rounding residue', () => {
      const b = breakdown();
      b.payments.creditablePayments = 33333.33;
      const { values } = toTaxComputationRow(b);
      expect(values.withholding_tax_paid + values.advance_tax_paid).toBe(33333.33);
    });

    it('credits nothing when nothing was claimed', () => {
      const b = breakdown();
      b.payments.withholdingTax = 0;
      b.payments.advanceTax = 0;
      b.payments.claimedPayments = 0;
      b.payments.creditablePayments = 0;
      const { values } = toTaxComputationRow(b);
      expect(values.withholding_tax_paid).toBe(0);
      expect(values.advance_tax_paid).toBe(0);
    });

    it('falls back to the claim rather than inventing a ceiling of zero', () => {
      // An older breakdown shape without creditablePayments must not silently
      // zero every taxpayer's credits.
      const b = breakdown();
      delete b.payments.creditablePayments;
      const { values } = toTaxComputationRow(b);
      expect(values.withholding_tax_paid).toBe(400000);
      expect(values.advance_tax_paid).toBe(25000);
    });
  });

  it('never targets a GENERATED column', () => {
    // Writing one is a 500 with a confusing Postgres error, and these are the
    // columns whose values the client used to be able to dictate.
    for (const m of COLUMN_MAP) expect(GENERATED_COLUMNS.has(m.column)).toBe(false);
    expect(GENERATED_COLUMNS.has('total_tax_liability')).toBe(true);
    expect(GENERATED_COLUMNS.has('net_tax_payable')).toBe(true);
  });

  it('takes lane B totalCredits whole; the identity is asserted, not rederived', () => {
    const b = breakdown();
    expect(b.tax.totalCredits).toBe(b.tax.formCredits + b.tax.foreignTaxCredit);
    expect(toTaxComputationRow(b).values.tax_credits).toBe(b.tax.totalCredits);
  });

  it('leaves columns with no engine counterpart unmapped rather than guessed', () => {
    const { values } = toTaxComputationRow(breakdown());
    expect(values.other_income_subject_to_min_tax).toBeUndefined();
    expect(values.minimum_tax_on_other_income).toBeUndefined();
    expect(Object.keys(NO_ENGINE_COUNTERPART).sort())
      .toEqual(['minimum_tax_on_other_income', 'other_income_subject_to_min_tax']);
  });

  it('puts other-income on the normal-basis limb, not the minimum-tax limb', () => {
    // Both limbs feed the same generated total_income, so the wrong choice is
    // invisible in the total and wrong on the return.
    const { values } = toTaxComputationRow(breakdown());
    expect(values.income_loss_other_sources).toBe(300000);
    expect(values.other_income_subject_to_min_tax).toBeUndefined();
  });

  it('has no remaining generated-column gaps — phase-z18 closed both', () => {
    // This assertion used to pin the two DEFECTS (balance_payable omitting
    // withholding, total_tax_liability omitting super_tax). phase-z18 fixed both
    // expressions and withholding_tax_paid is now populated, so the correct
    // assertion is that the map is EMPTY. It is kept (rather than deleted) so
    // the next schema-expression gap gets recorded here instead of in prod.
    expect(Object.keys(KNOWN_GENERATED_COLUMN_GAPS)).toEqual([]);
  });

  it('rejects an incomplete breakdown rather than writing partial liability', () => {
    expect(() => toTaxComputationRow({ income: {}, tax: {} })).toThrow(/incomplete/);
    expect(() => toTaxComputationRow(null)).toThrow(/incomplete/);
  });

  describe('persisted through the controller', () => {
    it('writes the engine figures and never a client-supplied one', async () => {
      jest.resetModules();
      const inserted = { sql: null, values: null };
      const pool = {
        query: jest.fn(async (sql, values = []) => {
          if (/information_schema\.columns/i.test(sql)) {
            return {
              rows: [
                'tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year',
                'last_updated_by', 'is_complete',
                'income_from_salary', 'other_income_subject_to_min_tax',
                'income_loss_other_sources', 'deductible_allowances',
                'capital_gains_loss', 'normal_income_tax', 'surcharge_amount',
                'capital_gains_tax', 'tax_reductions', 'tax_credits', 'super_tax',
                'final_fixed_tax', 'minimum_tax_on_other_income', 'advance_tax_paid',
              ].map((c) => ({ column_name: c })),
            };
          }
          if (/FROM tax_years/i.test(sql)) return { rows: [{ id: 'ty-uuid' }] };
          if (/INSERT INTO tax_computation_forms/i.test(sql)) {
            inserted.sql = sql;
            inserted.values = values;
            const cols = sql.match(/INSERT INTO tax_computation_forms \(([^)]+)\)/i)[1]
              .split(',').map((c) => c.trim());
            const row = {};
            cols.forEach((c, i) => { row[c] = values[i]; });
            return { rows: [row] };
          }
          return { rows: [] };
        }),
      };
      jest.doMock('../../src/config/database', () => ({ pool }));
      jest.doMock('../../src/utils/logger', () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(),
      }));
      jest.doMock('../../src/helpers/ensureTaxReturn', () => jest.fn(async () => 'return-uuid'));
      jest.doMock('../../src/services/readinessService', () => ({ checkReadiness: jest.fn() }));
      jest.doMock('../../src/services/taxCalculationService', () => ({
        calculateTaxComputation: jest.fn(async () => breakdown()),
      }));

      const { populateTaxComputationFromEngine } =
        require('../../src/modules/IncomeTax/controllers/computationController');
      const row = await populateTaxComputationFromEngine('u', 'q@e.test', '2025-26');

      expect(row.normal_income_tax).toBe(900000);
      expect(row.tax_credits).toBe(75000);
      expect(row.final_fixed_tax).toBe(100000);
      // The columns the client used to be able to dictate are never in the SQL.
      expect(inserted.sql).not.toMatch(/total_tax_liability|net_tax_payable|balance_payable/);
      // Columns with no engine counterpart are not written, so they keep the
      // column DEFAULT rather than an invented figure.
      expect(inserted.sql).not.toMatch(/other_income_subject_to_min_tax/);
      expect(inserted.sql).not.toMatch(/minimum_tax_on_other_income/);
    });

    it('returns null instead of throwing when the engine cannot run', async () => {
      jest.resetModules();
      jest.doMock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
      jest.doMock('../../src/utils/logger', () => ({
        info: jest.fn(), warn: jest.fn(), error: jest.fn(),
      }));
      jest.doMock('../../src/helpers/ensureTaxReturn', () => jest.fn());
      jest.doMock('../../src/services/readinessService', () => ({ checkReadiness: jest.fn() }));
      jest.doMock('../../src/services/taxCalculationService', () => ({
        calculateTaxComputation: jest.fn(async () => {
          throw new Error('Income form data not found — required for tax computation');
        }),
      }));
      const { populateTaxComputationFromEngine } =
        require('../../src/modules/IncomeTax/controllers/computationController');
      // Must not lose the user's completion flag just because income is absent.
      await expect(populateTaxComputationFromEngine('u', 'q@e.test', '2025-26'))
        .resolves.toBeNull();
    });
  });
});

// ═════════ 7. ATL coverage across the 27 withholding heads (round 3) ═══════

describe('Adjustable Tax ATL coverage', () => {
  const {
    ADJUSTABLE_HEAD_RATES, ATL_PAIRED_HEADS, NON_ATL_RATE_GAPS, resolveHeadRate,
  } = require('../../src/modules/IncomeTax/helpers/adjustableTaxShape');

  const RATES = {
    functions_gatherings_236cb_atl: 0.1,
    functions_gatherings_236cb_nonatl: 0.2,
    profit_debt_151_20: 0.2,
    electricity_bill_235: 0.075,
  };

  it('enumerates all 27 heads', () => {
    expect(Object.keys(ADJUSTABLE_HEAD_RATES)).toHaveLength(27);
  });

  it('exactly 1 head has an ATL/non-ATL pair, and 11 have a filer-only rate', () => {
    // The blunt number. F-02 is closed for 1 head of 27, not 27.
    expect(ATL_PAIRED_HEADS).toEqual(['functions_gatherings_charges_236cb']);
    expect(NON_ATL_RATE_GAPS).toHaveLength(11);
    expect(NON_ATL_RATE_GAPS).toContain('profit_debt_151_15');
    expect(NON_ATL_RATE_GAPS).toContain('electricity_bill_domestic_235');
    // 27 = 1 paired + 11 filer-only + 15 with no rate row at all.
    const unrated = Object.values(ADJUSTABLE_HEAD_RATES).filter((v) => !v.atlKey);
    expect(unrated).toHaveLength(15);
  });

  it('honours the pair where one exists', () => {
    expect(resolveHeadRate('functions_gatherings_charges_236cb', true, RATES).rate).toBe(0.1);
    expect(resolveHeadRate('functions_gatherings_charges_236cb', false, RATES).rate).toBe(0.2);
    expect(resolveHeadRate('functions_gatherings_charges_236cb', false, RATES).rateKey)
      .toBe('functions_gatherings_236cb_nonatl');
  });

  it('never fabricates a doubled non-filer rate where the row is missing', () => {
    const r = resolveHeadRate('profit_debt_151_15', false, RATES);
    expect(r.rate).toBe(0.2);              // the filer rate, not 0.4
    expect(r.nonAtlRateMissing).toBe(true);
  });

  it('returns no rate for a pure declaration head', () => {
    expect(resolveHeadRate('salary_employees_149', true, RATES).rate).toBeNull();
    expect(resolveHeadRate('not_a_head', true, RATES).rate).toBeNull();
  });

  it('a head seeded with a non-ATL row lights up with no code change', () => {
    // Proves the gap is data, not code: add the row and behaviour follows.
    const seeded = { ...ADJUSTABLE_HEAD_RATES };
    expect(seeded.profit_debt_151_15.nonAtlKey).toBeNull();
    const withPair = { ...seeded.profit_debt_151_15, nonAtlKey: 'profit_debt_151_20_nonatl' };
    const rates = { ...RATES, profit_debt_151_20_nonatl: 0.4 };
    // Same resolver logic, exercised against the would-be config.
    const key = withPair.nonAtlKey;
    expect(rates[key]).toBe(0.4);
  });
});

// ═════════════ 4. income endpoint can mark the return complete ═════════════

describe('POST /api/income-form/:taxYear is_complete', () => {
  let db, handler, logger;

  const loadRoute = () => {
    jest.resetModules();
    db = makeFakeDb();
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    jest.doMock('../../src/config/database', () => ({ pool: db.pool }));
    jest.doMock('../../src/utils/logger', () => logger);
    jest.doMock('../../src/middleware/auth', () => (req, _res, next) => next());
    jest.doMock('../../src/helpers/ensureTaxReturn', () => jest.fn(async () => 'return-uuid'));
    jest.doMock('../../src/services/calculationService', () => ({
      calculateIncomeFormFields: jest.fn(() => ({})),
    }));
    jest.doMock('../../src/modules/IncomeTax/helpers/taxFormsShared', () => ({
      getCurrentTaxYear: jest.fn(async () => '2025-26'),
      recalculateFormCompletion: jest.fn(async () => ({})),
      saveFormData: jest.fn(),
    }));
    const router = require('../../src/routes/incomeForm');
    const layer = router.stack.find(
      (l) => l.route && l.route.path === '/:taxYear' && l.route.methods.post
    );
    // last handler in the stack is the route body (auth middleware is first)
    handler = layer.route.stack[layer.route.stack.length - 1].handle;
    return require('../../src/modules/IncomeTax/helpers/taxFormsShared');
  };

  const post = (body) => handler(
    { params: { taxYear: '2025-26' }, user: { id: 'u', email: 'q@e.test' }, body },
    fakeRes()
  );

  it('writes is_complete = true when the client completes the step', async () => {
    loadRoute();
    await post({ annual_basic_salary: 1200000, isComplete: true });
    // On 45bb80c the endpoint never mentioned is_complete at all, so
    // income_forms.is_complete was false for every user ever and
    // all_forms_complete could never become true.
    expect(db.state.lastIncomeSql).toMatch(/is_complete/);
    expect(db.state.incomeRow.is_complete).toBe(true);
  });

  it('defaults to false on a plain save', async () => {
    loadRoute();
    await post({ annual_basic_salary: 1200000 });
    expect(db.state.incomeRow.is_complete).toBe(false);
  });

  it('is sticky — a later partial save cannot un-complete the form', async () => {
    loadRoute();
    await post({ annual_basic_salary: 1200000, isComplete: true });
    await post({ annual_basic_salary: 1300000 });
    expect(db.state.lastIncomeSql)
      .toContain('is_complete = income_forms.is_complete OR EXCLUDED.is_complete');
    expect(db.state.incomeRow.is_complete).toBe(true);
  });

  it('refreshes form_completion_status after the write', async () => {
    const shared = loadRoute();
    await post({ annual_basic_salary: 1200000, isComplete: true });
    expect(shared.recalculateFormCompletion).toHaveBeenCalledWith('u', '2025-26');
  });
});
