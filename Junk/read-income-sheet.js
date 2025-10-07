const XLSX = require('xlsx');

try {
  const workbook = XLSX.readFile('../Salaried Individuals 2025.xlsx');
  const incomeSheet = workbook.Sheets['Income'];
  const jsonData = XLSX.utils.sheet_to_json(incomeSheet, { header: 1 });

  console.log('=== INCOME SHEET - DETAILED ===\n');

  // Show all rows to see the complete structure
  jsonData.forEach((row, index) => {
    console.log(`Row ${index + 1}:`, row);
  });

} catch (error) {
  console.error('Error reading Excel file:', error.message);
}