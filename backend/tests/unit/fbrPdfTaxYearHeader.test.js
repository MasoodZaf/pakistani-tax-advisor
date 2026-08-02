/**
 * FBR acknowledgement-slip header derivation (R-03).
 *
 * The printed return used to carry a hardcoded 2023-24 header regardless of the
 * year being rendered, so a TY2025-26 PDF showed TY2024 dates over TY2025-26
 * figures. These tests pin the one rule that makes that impossible to get wrong
 * again: Pakistan names a tax year after the calendar year in which it ENDS.
 * '2025-26' runs 1-Jul-2025 → 30-Jun-2026 and FBR calls it Tax Year 2026.
 *
 * Pure function, no DB — but it lives in the routes module, which pulls in the
 * pg pool at import time and refuses to load without DB_PASSWORD. Stub the pool
 * so this stays a genuine unit test with no environment prerequisites.
 */
jest.mock('../../src/config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

// The auth middleware refuses to load without a secret (by design — no
// defaults for credentials, anywhere). Give it a throwaway one; nothing in
// this file signs or verifies a token.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-only-not-a-real-secret';

const { deriveTaxYearHeader } = require('../../src/routes/reports');

describe('deriveTaxYearHeader', () => {
  test("'2025-26' → period 01-Jul-2025 - 30-Jun-2026, tax year 2026, due 30-Sep-2026", () => {
    expect(deriveTaxYearHeader('2025-26')).toEqual({
      taxYearLabel: '2026',
      period: '01-Jul-2025 - 30-Jun-2026',
      dueDate: '30-Sep-2026',
    });
  });

  test("'2024-25' → period 01-Jul-2024 - 30-Jun-2025, tax year 2025, due 30-Sep-2025", () => {
    expect(deriveTaxYearHeader('2024-25')).toEqual({
      taxYearLabel: '2025',
      period: '01-Jul-2024 - 30-Jun-2025',
      dueDate: '30-Sep-2025',
    });
  });

  test('the tax year label is the LATER calendar year, never the earlier one', () => {
    // The regression that shipped: reading the leading four digits and calling
    // it the tax year. That would print 2025 for '2025-26'.
    expect(deriveTaxYearHeader('2025-26').taxYearLabel).not.toBe('2025');
    expect(deriveTaxYearHeader('2023-24').taxYearLabel).toBe('2024');
  });

  test('the due date always tracks the year the tax year ends', () => {
    for (const [input, due] of [
      ['2022-23', '30-Sep-2023'],
      ['2023-24', '30-Sep-2024'],
      ['2026-27', '30-Sep-2027'],
    ]) {
      expect(deriveTaxYearHeader(input).dueDate).toBe(due);
    }
  });

  test('a four-digit end year is accepted and resolves identically', () => {
    expect(deriveTaxYearHeader('2025-2026')).toEqual(deriveTaxYearHeader('2025-26'));
  });

  test('surrounding whitespace is tolerated', () => {
    expect(deriveTaxYearHeader('  2025-26 ').taxYearLabel).toBe('2026');
  });

  test('a century rollover still moves forward, not back', () => {
    expect(deriveTaxYearHeader('2099-00')).toEqual({
      taxYearLabel: '2100',
      period: '01-Jul-2099 - 30-Jun-2100',
      dueDate: '30-Sep-2100',
    });
  });

  describe('fails loudly rather than defaulting to a year', () => {
    // A wrong-but-plausible year on a statutory document is invisible to the
    // person holding it. A thrown error is not.
    test.each([
      ['', 'empty string'],
      ['2025', 'no end year'],
      ['25-26', 'two-digit start'],
      ['2025/26', 'wrong separator'],
      ['2025-27', 'spans two years'],
      ['2025-24', 'runs backwards'],
      ['not-a-year', 'nonsense'],
      [null, 'null'],
      [undefined, 'undefined'],
      [2025, 'a number'],
      [{}, 'an object'],
    ])('%s (%s) throws', (input) => {
      expect(() => deriveTaxYearHeader(input)).toThrow(/tax year/i);
    });

    test('the thrown message never contains a fallback year the caller could mistake for output', () => {
      expect(() => deriveTaxYearHeader('garbage')).toThrow(/Cannot derive FBR return header/);
    });
  });
});
