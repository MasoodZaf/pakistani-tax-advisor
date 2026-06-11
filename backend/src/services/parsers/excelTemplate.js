'use strict';

/**
 * excelTemplate.js
 *
 * Generates a blank Excel template a user can download, fill out, then
 * upload via /api/tax-history/upload. Labels match the canonical FBR
 * label strings in fieldMapper.js so anything the user types round-trips
 * cleanly through parseExcelBuffer → mapFields.
 *
 * The output schema mirrors the shape extracted from the FBR 114(1) PDF —
 * Income, Adjustable Tax, Wealth — so the same downstream copy-forward
 * flow works no matter which input format the user picks.
 *
 * Optionally pre-fills values from an existing income_forms row so the
 * download doubles as "export this year's saved data".
 */

const ExcelJS = require('exceljs');

// (FBR label, db column, optional helper) per sheet. Labels must match
// fieldMapper.FIELD_MAP[].src strings exactly so re-upload binds back.
const INCOME_FIELDS = [
  ['Annual Basic Salary', 'annual_basic_salary',
   'Total basic salary received for the year.'],
  ['Allowances (excluding bonus and medical allowance)', 'allowances',
   'Allowances received excluding bonus and medical (FBR exempts up to 10% of basic).'],
  ['Bonus', 'bonus',
   'Annual bonus received.'],
  ['Medical allowance (Where medical facility not provided by employer)', 'medical_allowance',
   'Exempt up to PKR 100,000 typically.'],
  ['Pension received from ex-employer', 'pension_from_ex_employer', ''],
  ['Employment Termination payment (Section 12 (2) e iii)', 'employment_termination_payment', ''],
  ['Amount received on retirement from approved funds (Provident, pension, gratuity)',
   'retirement_from_approved_funds', ''],
  ['Other cash benefits (LFA, Children education, etc.)', 'other_cash_benefits', ''],
  ['Employer Contribution to Approved Provident Funds', 'employer_contribution_provident', ''],
  ['Taxable value of Car provided by employer', 'taxable_car_value', ''],
  ['Other taxable subsidies and non cash benefits', 'other_taxable_subsidies', ''],
  ['Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)', 'profit_on_debt_15_percent', ''],
  ['Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)', 'profit_on_debt_12_5_percent', ''],
  ['Other taxable income - Rent income', 'other_taxable_income_rent', ''],
  ['Other taxable income - Others', 'other_taxable_income_others', ''],
  ['Directorship Fee u/s 149(3)', 'directorship_fee', ''],
];

const ADJUSTABLE_TAX_FIELDS = [
  ['Salary of Employees u/s 149', 'salary_employees_149_gross_receipt',
   'Total tax deducted by employer on salary.'],
  ['Tax deducted on Rent received (Section 155)', 'tax_deducted_rent_section_155_gross_receipt', ''],
  ['Advance tax on cash withdrawal u/s 231AB', 'advance_tax_cash_withdrawal_231ab_gross_receipt', ''],
  ['Motor Vehicle Registration Fee u/s 231B(1)', 'motor_vehicle_registration_fee_231b1_gross_receipt', ''],
  ['Motor Vehicle Transfer Fee u/s 231B(2)', 'motor_vehicle_transfer_fee_231b2_gross_receipt', ''],
  ['Electricity Bill of Domestic Consumer u/s 235', 'electricity_bill_domestic_235_gross_receipt', ''],
  ['Cellphone Bill u/s 236(1)(a)', 'cellphone_bill_236_1f_gross_receipt', ''],
  ['Internet Bill u/s 236(1)(d)', 'internet_bill_236_1d_gross_receipt', ''],
  ['Sale / Transfer of Immovable Property u/s 236C', 'sale_transfer_immoveable_property_236c_gross_receipt', ''],
  ['Purchase / Transfer of Immovable Property u/s 236K', 'purchase_transfer_immoveable_property_236k_gross_receipt', ''],
  ['Functions / Gatherings Charges u/s 236CB (ATL @ 10% / Non-ATL @ 20%)',
   'functions_gatherings_charges_236cb_gross_receipt', ''],
];

// Style helpers
function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  row.alignment = { vertical: 'middle' };
  row.height = 22;
}

function styleSection(row) {
  row.font = { bold: true, color: { argb: 'FF1F2937' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
}

function addFieldSheet(workbook, sheetName, fields, prefill = {}) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: 'Field', key: 'field', width: 72 },
    { header: 'Amount (PKR)', key: 'amount', width: 18 },
    { header: 'Notes / Hints', key: 'notes', width: 52 },
  ];
  styleHeader(sheet.getRow(1));

  for (const [label, dbCol, helper] of fields) {
    const row = sheet.addRow({
      field: label,
      amount: prefill[dbCol] != null ? prefill[dbCol] : null,
      notes: helper,
    });
    row.getCell('amount').numFmt = '#,##0;[Red]-#,##0';
    row.getCell('amount').protection = { locked: false };
    row.getCell('field').alignment = { wrapText: true, vertical: 'top' };
    row.getCell('notes').alignment = { wrapText: true, vertical: 'top' };
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
}

function addInstructionsSheet(workbook, taxYear) {
  const sheet = workbook.addWorksheet('Instructions');
  sheet.columns = [{ width: 110 }];
  const lines = [
    `MeraTax — Return Template for Tax Year ${taxYear}`,
    '',
    'How to use this file:',
    '  1. Enter your amounts in the "Amount (PKR)" column of each sheet.',
    '  2. Leave blank rows that don\'t apply — they\'ll save as zero.',
    '  3. Save the file, then upload it via the app:',
    '       Web:   Tax History → Upload Prior Return',
    '       Mobile: Dashboard → Prior-Year Return tile',
    '',
    'Field labels match Pakistan\'s FBR 114(1) (Salaried) return form. Anything',
    'you fill in here will populate the same columns on the web Income / Adjustable',
    'Tax forms after you click "Copy Forward".',
    '',
    'You can also upload the official IRIS-generated PDF of your prior return —',
    'the same Copy Forward action works against the PDF\'s extracted totals.',
    '',
    'Tip: download a fresh template each year — the field list updates as Pakistan\'s',
    'tax law changes (new sections under Finance Act).',
  ];
  for (const line of lines) {
    const row = sheet.addRow([line]);
    if (line.startsWith('Pakistani Tax')) {
      row.font = { bold: true, size: 14, color: { argb: 'FF4F46E5' } };
    }
  }
}

/**
 * Build a workbook buffer.
 *
 * @param {object} opts
 * @param {string} opts.taxYear  - e.g. "2024-25"
 * @param {object} [opts.incomePrefill]    - { dbColumn: value, ... }
 * @param {object} [opts.adjustablePrefill]
 * @returns {Promise<Buffer>}
 */
async function buildTemplate({ taxYear, incomePrefill = {}, adjustablePrefill = {} } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MeraTax';
  workbook.created = new Date();
  workbook.properties = { ...workbook.properties, title: `Tax Return Template ${taxYear || ''}` };

  addInstructionsSheet(workbook, taxYear || '2024-25');
  addFieldSheet(workbook, 'Income', INCOME_FIELDS, incomePrefill);
  addFieldSheet(workbook, 'Adjustable Tax', ADJUSTABLE_TAX_FIELDS, adjustablePrefill);

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildTemplate, INCOME_FIELDS, ADJUSTABLE_TAX_FIELDS };
