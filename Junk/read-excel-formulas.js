const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('../Salaried Individuals 2025.xlsx');
  const incomeSheet = workbook.Sheets['Income'];

  console.log('=== CHECKING EXCEL FORMULAS ===\n');

  // Check specific cells and their formulas
  const cellsToCheck = ['B16', 'B11', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15'];

  cellsToCheck.forEach(cellRef => {
    const cell = incomeSheet[cellRef];
    if (cell) {
      console.log(`Cell ${cellRef}:`);
      console.log(`  Value: ${cell.v}`);
      console.log(`  Formula: ${cell.f || 'No formula (direct value)'}`);
      console.log(`  Type: ${cell.t}`);
      console.log('');
    }
  });

  // Also check the range B6:B15 to see what's included
  console.log('=== VALUES IN RANGE B6:B15 ===');
  for (let row = 6; row <= 15; row++) {
    const cellRef = `B${row}`;
    const cell = incomeSheet[cellRef];
    const descCell = incomeSheet[`A${row}`];
    if (cell) {
      console.log(`${cellRef} (${descCell?.v || 'No description'}): ${cell.v}`);
    }
  }

} catch (error) {
  console.error('Error reading Excel file:', error.message);
}