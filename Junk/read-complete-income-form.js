const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('../Salaried Individuals 2025.xlsx');
  const incomeSheet = workbook.Sheets['Income'];
  const jsonData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 });

  console.log('=== COMPLETE INCOME FORM DATA FROM EXCEL ===\n');

  // Organize the data by sections
  console.log('PAYMENTS BY EMPLOYER:');
  console.log('Annual Basic Salary:', jsonData[5][1]); // B6
  console.log('Allowances (excluding bonus and medical allowance):', jsonData[6][1]); // B7
  console.log('Bonus:', jsonData[7][1]); // B8
  console.log('Medical allowance:', jsonData[8][1]); // B9
  console.log('Pension received from ex-employer:', jsonData[9][1]); // B10
  console.log('Employment Termination payment:', jsonData[10][1]); // B11
  console.log('Amount received on retirement from approved funds:', jsonData[11][1]); // B12
  console.log('Directorship Fee:', jsonData[12][1]); // B13
  console.log('Other cash benefits:', jsonData[13][1]); // B14
  console.log('Income Exempt from tax:', jsonData[14][1]); // B15
  console.log('Annual Salary and Wages TOTAL:', jsonData[15][1]); // B16

  console.log('\nNON CASH BENEFITS:');
  console.log('Employer Contribution to Approved Provident Funds:', jsonData[18][1]); // B19
  console.log('Taxable value of Car provided by employer:', jsonData[19][1]); // B20
  console.log('Other taxable subsidies and non cash benefits:', jsonData[20][1]); // B21
  console.log('Non cash benefit exempt from tax:', jsonData[21][1]); // B22
  console.log('Total non cash benefits:', jsonData[22][1]); // B23

  console.log('\nOTHER INCOME (Subject to minimum tax):');
  console.log('Profit on Debt u/s 151 @ 15%:', jsonData[25][1]); // B26
  console.log('Profit on Debt u/s 151A @ 12.5%:', jsonData[26][1]); // B27
  console.log('Other Income (Subject to minimum tax) TOTAL:', jsonData[27][1]); // B28

  console.log('\nOTHER INCOME (Not Subject to minimum tax):');
  console.log('Other taxable income - Rent income:', jsonData[30][1]); // B31
  console.log('Other taxable income - Others:', jsonData[31][1]); // B32
  console.log('Other taxable income - Total:', jsonData[32][1]); // B33

  console.log('\n=== CHECKING FOR ANY FORMULAS ===');
  const cellsToCheck = ['B16', 'B23', 'B28', 'B33'];
  cellsToCheck.forEach(cellRef => {
    const cell = incomeSheet[cellRef];
    if (cell) {
      console.log(`${cellRef}: Value=${cell.v}, Formula=${cell.f || 'No formula'}`);
    }
  });

} catch (error) {
  console.error('Error reading Excel file:', error.message);
}