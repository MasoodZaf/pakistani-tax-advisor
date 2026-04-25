// Writes the round-trip result XLSX. The file is the test's pass/fail
// receipt — even when assertions pass, the artifact lets a human verify
// what numbers the app actually computed.
//
// Sheet 1 — Status: large PASS / FAIL banner cell + per-step disposition
// Sheet 2 — Tax Computation (FA 2025): the headline numbers from the calc
// Sheet 3 — Reference (FA 2024): the values from the reference workbook
//          (informational — they're for last year's rates, so they will
//          differ from sheet 2 even on a perfect run)
// Sheet 4 — Inputs Submitted: the payloads we POSTed, per form

const fs   = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const ARTIFACT_DIR = path.resolve(__dirname, '..', 'artifacts');

function pkr(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return Number(n);
}

async function writeArtifact({
  passed,
  steps,             // [{ step, endpoint, status: 'saved'|'skipped'|'failed', sentFields: number, error?: string }]
  computation,       // app calc breakdown — { income, tax, payments }
  referenceComputation,
  inputs,            // raw inputs object from fixture
}) {
  if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `round-trip-${passed ? 'PASS' : 'FAIL'}-${ts}.xlsx`;
  const fpath = path.join(ARTIFACT_DIR, fname);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pakistan Tax Advisor — round-trip test';
  wb.created = new Date();

  // ─── Sheet 1: Status ───────────────────────────────────────────────────────
  const status = wb.addWorksheet('Status');
  status.mergeCells('A1:D1');
  status.getCell('A1').value = passed ? 'ROUND-TRIP: PASS' : 'ROUND-TRIP: FAIL';
  status.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  status.getCell('A1').font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FFFFFFFF' } };
  status.getCell('A1').fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: passed ? 'FF166534' : 'FFB91C1C' },
  };
  status.getRow(1).height = 50;

  status.getCell('A3').value = 'Generated';
  status.getCell('B3').value = new Date().toLocaleString('en-PK');
  status.getCell('A4').value = 'Reference workbook';
  status.getCell('B4').value = 'Salaried Individuals 2025.xlsx';
  status.getCell('A5').value = 'Calc rates';
  status.getCell('B5').value = 'TY 2025-26 (Finance Act 2025)';

  // Per-step table
  status.getCell('A7').value = 'Per-step round-trip status';
  status.getCell('A7').font = { bold: true, size: 13 };

  status.getRow(9).values = ['Step', 'Endpoint', 'Status', 'Fields posted', 'Notes'];
  status.getRow(9).font = { bold: true };
  status.getRow(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };

  let row = 10;
  for (const s of steps) {
    const colour =
      s.status === 'saved'   ? 'FFDCFCE7' :
      s.status === 'skipped' ? 'FFFEF3C7' :
                               'FFFEE2E2';
    status.getRow(row).values = [s.step, s.endpoint, s.status, s.sentFields ?? '', s.error || s.note || ''];
    status.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colour } };
    row++;
  }

  status.getColumn('A').width = 24;
  status.getColumn('B').width = 44;
  status.getColumn('C').width = 12;
  status.getColumn('D').width = 14;
  status.getColumn('E').width = 60;

  // ─── Sheet 2: App computation (FA 2025) ────────────────────────────────────
  const calc = wb.addWorksheet('Tax Computation (FA 2025)');
  calc.mergeCells('A1:B1');
  calc.getCell('A1').value = 'Tax Computation under Finance Act 2025';
  calc.getCell('A1').font = { bold: true, size: 14 };
  calc.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF28396C' } };
  calc.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };

  const rows = [
    [],
    ['Description',                                'Amount (PKR)'],
    ['Total income',                                pkr(computation?.income?.totalIncome)],
    ['Deductible allowances',                       pkr(computation?.income?.deductibleAllowances)],
    ['Taxable income (excluding CG)',               pkr(computation?.income?.taxableIncomeExcludingCG)],
    ['Capital gains',                               pkr(computation?.income?.incomeFromCapitalGains)],
    ['Taxable income (including CG)',               pkr(computation?.income?.taxableIncomeIncludingCG)],
    [],
    ['Normal income tax',                           pkr(computation?.tax?.normalIncomeTax)],
    ['Surcharge',                                   pkr(computation?.tax?.surcharge)],
    ['Capital gains tax',                           pkr(computation?.tax?.capitalGainsTax)],
    ['Total tax before adjustments',                pkr(computation?.tax?.totalTaxBeforeAdjustments)],
    ['Tax reductions',                             -pkr(computation?.tax?.totalReductions || 0)],
    ['Tax credits',                                -pkr(computation?.tax?.totalCredits || 0)],
    ['Net tax payable',                             pkr(computation?.tax?.netTaxPayable)],
    ['Super tax u/s 4C',                            pkr(computation?.tax?.superTax)],
    ['Total tax chargeable',                        pkr(computation?.tax?.totalTaxChargeable)],
    [],
    ['Withholding tax paid',                        pkr(computation?.payments?.withholdingTax)],
    ['Advance tax u/s 147',                         pkr(computation?.payments?.advanceTax)],
    ['Balance payable / (refundable)',              pkr(computation?.payments?.balancePayableRefundable)],
  ];
  rows.forEach((r, i) => { calc.getRow(i + 2).values = r; });
  calc.getRow(3).font = { bold: true };
  calc.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  calc.getColumn('A').width = 36;
  calc.getColumn('B').width = 18;
  calc.getColumn('B').numFmt = '#,##0';

  // ─── Sheet 3: Reference (FA 2024) ──────────────────────────────────────────
  const ref = wb.addWorksheet('Reference (FA 2024)');
  ref.getCell('A1').value = referenceComputation?.taxYearNote || 'Reference computation';
  ref.getCell('A1').font = { italic: true, color: { argb: 'FF7A8890' } };
  let r = 3;
  for (const [k, v] of Object.entries(referenceComputation || {})) {
    if (k === 'taxYearNote') continue;
    ref.getRow(r).values = [k, Number.isFinite(v) ? v : v];
    r++;
  }
  ref.getColumn('A').width = 36;
  ref.getColumn('B').width = 18;
  ref.getColumn('B').numFmt = '#,##0.00';

  // ─── Sheet 4: Inputs submitted ─────────────────────────────────────────────
  const ins = wb.addWorksheet('Inputs Submitted');
  ins.getCell('A1').value = 'Per-form payloads POSTed by the test';
  ins.getCell('A1').font = { bold: true };
  let ir = 3;
  for (const [step, def] of Object.entries(inputs)) {
    ins.getRow(ir).values = [`[${step}]`, def.endpoint || '', def.note || ''];
    ins.getRow(ir).font = { bold: true };
    ir++;
    for (const [k, v] of Object.entries(def.payload || {})) {
      ins.getRow(ir).values = ['', k, v];
      ir++;
    }
    ir++;
  }
  ins.getColumn('A').width = 18;
  ins.getColumn('B').width = 56;
  ins.getColumn('C').width = 14;
  ins.getColumn('C').numFmt = '#,##0';

  await wb.xlsx.writeFile(fpath);
  return { path: fpath, fileName: fname };
}

module.exports = { writeArtifact, ARTIFACT_DIR };
