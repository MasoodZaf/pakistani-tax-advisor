/**
 * Unit tests for the pure helpers backing /api/mobile/v1/expenses.
 * These are side-effect-free: no DB, no network.
 */

const {
  deriveTaxYear,
  validateChange,
  encodeCursor,
  decodeCursor,
} = require('../../src/services/mobileExpenseHelpers');

describe('deriveTaxYear', () => {
  test.each([
    ['2025-07-01', '2025-26'], // first day of TY 2025-26
    ['2026-06-30', '2025-26'], // last day of TY 2025-26
    ['2026-07-01', '2026-27'], // boundary: first day of TY 2026-27
    ['2025-06-30', '2024-25'], // last day of TY 2024-25
    ['2025-12-31', '2025-26'],
    ['2026-01-01', '2025-26'],
    ['2099-08-15', '2099-00'], // century wrap: 2099 → '00'
  ])('%s → %s', (date, expected) => {
    expect(deriveTaxYear(date)).toBe(expected);
  });

  test.each(['', 'not-a-date', '2026-13-01', '2026/05/18', null, undefined, 12345])(
    'rejects %p',
    (bad) => {
      expect(() => deriveTaxYear(bad)).toThrow();
    }
  );
});

describe('validateChange', () => {
  const baseUpsert = {
    op: 'upsert',
    client_id: '9b1d2c0a-8e30-4e51-a1ab-9b1d2c0a8e30',
    amount: 1500,
    currency: 'PKR',
    occurred_on: '2026-05-18',
    category: 'medical',
    client_updated_at: '2026-05-18T14:32:09Z',
  };

  test('valid PKR upsert is accepted and tax_year is derived', () => {
    const v = validateChange(baseUpsert);
    expect(v.ok).toBe(true);
    expect(v.normalized.tax_year).toBe('2025-26');
    expect(v.normalized.amount_pkr).toBe(1500); // PKR row mirrors amount
    expect(v.normalized.fx_rate_to_pkr).toBeNull();
  });

  test('valid USD upsert preserves fx + amount_pkr', () => {
    const v = validateChange({
      ...baseUpsert,
      currency: 'USD',
      amount: 30,
      fx_rate_to_pkr: 278.5,
      amount_pkr: 8355,
    });
    expect(v.ok).toBe(true);
    expect(v.normalized.amount_pkr).toBe(8355);
    expect(v.normalized.fx_rate_to_pkr).toBe(278.5);
  });

  test('USD without fx_rate_to_pkr is rejected', () => {
    expect(
      validateChange({ ...baseUpsert, currency: 'USD', amount: 30, amount_pkr: 8355 }).error
    ).toBe('fx_rate_to_pkr_required_for_non_pkr');
  });

  test('PKR with fx_rate_to_pkr is rejected (cannot have one for native currency)', () => {
    expect(
      validateChange({ ...baseUpsert, fx_rate_to_pkr: 1 }).error
    ).toBe('fx_rate_not_allowed_for_pkr');
  });

  test('PKR with mismatched amount_pkr is rejected', () => {
    expect(
      validateChange({ ...baseUpsert, amount_pkr: 1499 }).error
    ).toBe('amount_pkr_must_equal_amount_for_pkr');
  });

  test('unknown category is rejected', () => {
    expect(validateChange({ ...baseUpsert, category: 'crypto_yolo' }).error).toBe('invalid_category');
  });

  test('negative amount is rejected', () => {
    expect(validateChange({ ...baseUpsert, amount: -1 }).error).toBe('invalid_amount');
  });

  test('non-UUID client_id is rejected', () => {
    expect(validateChange({ ...baseUpsert, client_id: 'not-a-uuid' }).error).toBe('invalid_client_id');
  });

  test('delete change requires only client_id and client_updated_at', () => {
    const v = validateChange({
      op: 'delete',
      client_id: baseUpsert.client_id,
      client_updated_at: '2026-05-18T14:35:00Z',
    });
    expect(v.ok).toBe(true);
    expect(v.normalized.op).toBe('delete');
  });

  test('invalid op is rejected', () => {
    expect(validateChange({ ...baseUpsert, op: 'patch' }).error).toBe('invalid_op');
  });

  test('non-object change is rejected', () => {
    expect(validateChange(null).error).toBe('change_not_an_object');
    expect(validateChange('foo').error).toBe('change_not_an_object');
  });

  test('description and payee default to null when omitted', () => {
    const v = validateChange(baseUpsert);
    expect(v.normalized.description).toBeNull();
    expect(v.normalized.payee).toBeNull();
  });
});

describe('cursor codec', () => {
  test('encode then decode round-trips', () => {
    const ts = '2026-05-18T14:32:11.000Z';
    const id = '9b1d2c0a-8e30-4e51-a1ab-9b1d2c0a8e30';
    const cur = encodeCursor(ts, id);
    expect(typeof cur).toBe('string');
    expect(decodeCursor(cur)).toEqual({ updatedAt: ts, id });
  });

  test('decode of garbage returns null (caller treats as no-cursor)', () => {
    expect(decodeCursor('not-base64')).toBeNull();
    expect(decodeCursor('Zm9v')).toBeNull(); // valid base64 but not our JSON
  });

  test('decode of null/undefined returns null', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  test('decode rejects cursor whose id is not a UUID', () => {
    const bad = Buffer.from(
      JSON.stringify({ u: '2026-05-18T14:32:11Z', i: 'not-uuid' }),
      'utf8'
    ).toString('base64url');
    expect(decodeCursor(bad)).toBeNull();
  });
});
