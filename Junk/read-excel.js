const XLSX = require('xlsx');

try {
  const sheetArg = process.argv[2];
  const workbook = XLSX.readFile('/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/Salaried Individuals 2025.xlsx');

  if (sheetArg) {
    // Read specific sheet
    const worksheet = workbook.Sheets[sheetArg];
    if (!worksheet) {
      console.log('Available sheets:', workbook.SheetNames.join(', '));
      process.exit(1);
    }

    console.log(`\n=== ${sheetArg} ===`);
    const range = XLSX.utils.decode_range(worksheet['!ref']);

    // Read row by row with formulas
    for (let row = range.s.r; row <= Math.min(range.e.r, 50); row++) {
      const rowData = [];
      for (let col = range.s.c; col <= Math.min(range.e.c, 5); col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        if (cell) {
          if (cell.f) {
            rowData.push(`${cell.v} (=${cell.f})`);
          } else {
            rowData.push(cell.v);
          }
        } else {
          rowData.push('');
        }
      }
      if (rowData.some(c => c !== '')) {
        console.log(`Row ${row + 1}:`, rowData);
      }
    }
  } else {
    console.log('Sheet Names:', workbook.SheetNames);
  }
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}