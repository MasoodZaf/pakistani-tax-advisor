/**
 * ONE money parser, not two.
 *
 * `ValidationMiddleware.validateNumeric` and `numericGuards.parseMoneyInput`
 * kept separate grammars for what counts as a number. That is the shape of the
 * defect that let F-09 ship: a value passes one gate, is re-read differently by
 * the other, and what lands in the database is not what was validated. Bare
 * `parseFloat('1,200,000')` is 1; `parseFloat('12,00x,000')` is 1200.
 *
 * `validateNumeric` now delegates to the shared parser, and this suite is the
 * thing that stops the two drifting apart again.
 */

jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { parseMoneyInput, normaliseMoneyString } = require('../../src/middleware/numericGuards');
const ValidationMiddleware = require('../../src/middleware/validation');

const CASES = [
  // accepted
  '1,200,000', '1200000.75', '  1200000  ', '1.2e6', '0', '.5', '+1200000',
  'Rs 1,200,000', 'Rs. 1,200,000', 'PKR 1,200,000', '1,200,000/-', '1 200 000',
  '١٢٠٠٠٠٠', '۱۲۰۰۰۰۰',
  // refused
  '12,00x,000', '1,2,3', '1e', '0x10', '12 34', '1.2.3', '--500', 'not-a-number',
  '1200000abc', 'Rs', '1,200,000/x', '<script>alert(1)</script>',
];

describe('the two layers read every value identically', () => {
  test.each(CASES)('%s', (value) => {
    const guard = parseMoneyInput(value);
    // A wide range so only the PARSE decides the outcome, not a bound.
    const legacy = ValidationMiddleware.validateNumeric(value, 'f', {
      min: -1e15,
      max: 1e15,
    });
    expect(legacy.isValid).toBe(guard.valid && guard.value !== null);
    if (legacy.isValid) expect(legacy.value).toBe(guard.value);
  });
});

describe('normaliseMoneyString handles only the unambiguous forms', () => {
  test.each([
    ['Rs 1,200,000', '1,200,000'],
    ['1,200,000/-', '1,200,000'],
    ['1 200 000', '1,200,000'],
    ['١٢٣', '123'],
    ['(1,200)', '-1,200'],
    ['1 200 000', '1,200,000'],
  ])('%s -> %s', (raw, expected) => {
    expect(normaliseMoneyString(raw)).toBe(expected);
  });

  test('mis-grouped spaces are refused, not silently joined', () => {
    // "12 34" becoming 1234 would hide a typo, which is the F-09 failure mode.
    expect(normaliseMoneyString('12 34')).toBeNull();
    expect(normaliseMoneyString('1 2 3')).toBeNull();
  });

  test('an empty or sign-only value is not a number', () => {
    for (const v of ['Rs', 'Rs ', '+', '-', '()']) {
      expect(normaliseMoneyString(v)).toBeNull();
    }
  });
});
