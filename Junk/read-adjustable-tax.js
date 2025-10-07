const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/Salaried Individuals 2025.xlsx');
const worksheet = workbook.Sheets['Adjustable Tax'];

if (!worksheet) {
  console.log('Available sheets:', workbook.SheetNames.join(', '));
  process.exit(1);
}

console.log('=== ADJUSTABLE TAX TAB ===\n');
const range = XLSX.utils.decode_range(worksheet['!ref']);
console.log('Range:', XLSX.utils.encode_range(range), '\n');

// Read first 60 rows, columns A-E
for (let row = 0; row <= Math.min(60, range.e.r); row++) {
  const rowData = {
    row: row + 1,
    A: '',
    B: '',
    C: '',
    D: '',
    E: ''
  };
  
  ['A', 'B', 'C', 'D', 'E'].forEach(col => {
    const cellAddress = col + (row + 1);
    const cell = worksheet[cellAddress];
    if (cell) {
      if (cell.f) {
        rowData[col] = `${cell.v} [=${cell.f}]`;
      } else {
        rowData[col] = cell.v;
      }
    }
  });
  
  if (rowData.A || rowData.B || rowData.C || rowData.D) {
    console.log(`${String(rowData.row).padStart(3)}| A: ${String(rowData.A).substring(0, 50).padEnd(50)} | B: ${String(rowData.B).substring(0, 20).padEnd(20)} | C: ${String(rowData.C).substring(0, 25).padEnd(25)} | D: ${String(rowData.D).substring(0, 40)}`);
  }
}
