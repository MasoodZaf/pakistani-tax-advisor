/**
 * Unit tests for the FBR 114(1) PDF parser's extraction logic.
 *
 * Real 114(1) PDFs are personal tax returns and stay out of git (FBR Docs/ is
 * ignored), so these tests drive the line-extraction functions with synthetic
 * text that reproduces the exact layout quirks pdf-parse emits:
 *   - code and amount concatenated with no separator ("701966,999,939Total Assets")
 *   - 6-digit net-assets codes ("70300166,999,939Net Assets Current Year")
 *   - indented expense descriptions ("7051600,000    Rent")
 *   - asset rows with NO description on the line ("700235,000,000")
 *   - per-asset detail rows + a category-total row under the same code
 */

const {
  extractSingleAmountCodes,
  extractAdjustableCodes,
  toMappedData,
} = require('../../src/services/parsers/fbrPdfParser');

// Mirrors the row layout of a real salaried 114(1) return (figures reconcile:
// assets sum to 7019, expenses sum to 7089).
const SAMPLE = [
  '900032,727,110Total Income',
  '910032,727,110Taxable Income',
  '920011,791,577Tax Chargeable',
  '9210356,667Refundable Income Tax',
  '700235,000,000',
  '70061,059,314',
  '700612,063,972',
  '70062,000,000',
  '70086,500,000Motor Vehicle (Non-Business) - ACM 975 - Honda',
  '70087,500,000Motor Vehicle (Non-Business)',
  '70081,000,000',
  '70099,710,000Precious Possession - Gold - 24C',
  '70099,710,000Precious Possession',
  '7011225,967Personal Item',
  '70122,000,000Cash (Non-Business)',
  '7013500,000Any Other Asset - Household Solar System',
  '701566,999,939Total Assets inside Pakistan',
  '701966,999,939Total Assets',
  '7030000Unreconciled Amount',
  '70300166,999,939Net Assets Current Year',
  '70300272,354,939Net Assets Previous Year',
  '7051600,000    Rent',
  '7055150,000    Vehicle Running / Maintenence',
  '70561,200,000    Travelling',
  '7058180,000    Electricity',
  '705960,000    Water',
  '706065,000    Gas',
  '7070100,000    Medical',
  '70712,200,000    Educational',
  '70720    Club',
  '7073250,000    Functions / Gatherings',
  '70760',
  '7087550,000    Other Personal / Household Expenses',
  '70895,355,000    Personal Expenses',
  '6400012,148,24432,727,110Total Adjustable Tax',
].join('\n');

describe('fbrPdfParser — extractSingleAmountCodes', () => {
  const named = extractSingleAmountCodes(SAMPLE);

  test('6-digit net-assets codes do not bleed digits into the amount', () => {
    // The historical bug: keying on "7030" parsed 66,999,939 as 166,999,939.
    expect(named['703001'].amount).toBe(66999939);
    expect(named['703002'].amount).toBe(72354939);
  });

  test('indented expense descriptions parse (rent, travelling, total)', () => {
    expect(named['7051'].amount).toBe(600000);
    expect(named['7056'].amount).toBe(1200000);
    expect(named['7089'].amount).toBe(5355000);
  });

  test('asset rows without a description on the line still parse', () => {
    expect(named['7002'].amount).toBe(35000000); // property — bare "700235,000,000"
  });

  test('multi-row asset categories resolve to the category total (max wins)', () => {
    expect(named['7006'].amount).toBe(12063972); // detail rows 1,059,314 / 2,000,000 present
    expect(named['7008'].amount).toBe(7500000); // details 6,500,000 + 1,000,000
  });

  test('zero-amount rows parse as zero, not noise', () => {
    expect(named['7072'].amount).toBe(0); // club
    expect(named['7076'].amount).toBe(0); // donations — bare "70760"
  });

  test('summary totals (9000/9100/9200) extract', () => {
    expect(named['9000'].amount).toBe(32727110);
    expect(named['9200'].amount).toBe(11791577);
  });

  test('extracted assets reconcile to Total Assets to the rupee', () => {
    const sum =
      named['7002'].amount + // property
      named['7006'].amount + // investment
      named['7008'].amount + // vehicles
      named['7009'].amount + // precious possession
      named['7011'].amount + // personal item
      named['7012'].amount + // cash
      named['7013'].amount; // other
    expect(sum).toBe(named['7019'].amount);
  });

  test('extracted expenses reconcile to Personal Expenses total', () => {
    const lines = [
      '7051',
      '7055',
      '7056',
      '7058',
      '7059',
      '7060',
      '7070',
      '7071',
      '7072',
      '7073',
      '7076',
      '7087',
    ];
    const sum = lines.reduce((s, c) => s + (named[c]?.amount || 0), 0);
    expect(sum).toBe(named['7089'].amount);
  });
});

describe('fbrPdfParser — toMappedData wiring', () => {
  const named = extractSingleAmountCodes(SAMPLE);
  const adjustable = extractAdjustableCodes(SAMPLE, 32727110);
  const mapped = toMappedData({
    identity: {
      name: 'TEST USER',
      ntn: null,
      period_start: '01-Jul-2024',
      period_end: '30-Jun-2025',
    },
    named,
    adjustable,
  });

  test('fiscal-year label derives from the period start', () => {
    expect(mapped.tax_year).toBe('2024-25');
  });

  test('wealth step carries corrected net assets (current + previous year)', () => {
    expect(mapped.wealth.net_assets_current_year).toBe(66999939);
    expect(mapped.wealth.net_assets_previous_year).toBe(72354939);
    expect(mapped.summary.net_assets).toBe(66999939);
  });

  test('expense step fields populate for copy-forward', () => {
    expect(mapped.expenses.rent).toBe(600000);
    expect(mapped.expenses.educational).toBe(2200000);
    expect(mapped.expenses.total_expenses).toBe(5355000);
  });

  test('total adjustable tax extracts from the 6400 summary row', () => {
    expect(mapped.adjustable_tax.total_adjustable_tax).toBe(12148244);
  });

  test('9210 (Refundable Income Tax) is the net balance — negate, never re-subtract WHT', () => {
    // Slip reports a 356,667 refund. The historical bug subtracted 6400
    // (12,148,244) from it AGAIN, surfacing "-11,791,577 payable".
    expect(mapped.tax_computation.tax_payable_refundable).toBe(-356667);
    expect(mapped.summary.refundable_tax).toBe(356667);
  });

  test('without a 9210 row, payable falls back to chargeable minus WHT', () => {
    const noRefundRow = SAMPLE.split('\n')
      .filter((l) => !l.startsWith('9210'))
      .join('\n');
    const named2 = extractSingleAmountCodes(noRefundRow);
    const adjustable2 = extractAdjustableCodes(noRefundRow, 32727110);
    const mapped2 = toMappedData({
      identity: { name: 'TEST USER', ntn: null, period_start: '01-Jul-2024', period_end: '30-Jun-2025' },
      named: named2,
      adjustable: adjustable2,
    });
    // 11,791,577 chargeable - 12,148,244 paid = -356,667 (same refund)
    expect(mapped2.tax_computation.tax_payable_refundable).toBe(-356667);
  });
});
