const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Function to read Excel file and extract data
function extractExcelData() {
  try {
    const filePath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/Salaried Individuals TY2025 Latest.xlsx';

    console.log('Reading Excel file:', filePath);

    // Read the workbook
    const workbook = XLSX.readFile(filePath);

    console.log('Sheet names:', workbook.SheetNames);

    const extractedData = {};

    // Extract data from each sheet
    workbook.SheetNames.forEach(sheetName => {
      console.log(`\n=== Processing Sheet: ${sheetName} ===`);

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      extractedData[sheetName] = {
        raw: jsonData,
        processed: processSheetData(sheetName, jsonData)
      };

      // Print first few rows for analysis
      console.log('First 10 rows:');
      jsonData.slice(0, 10).forEach((row, index) => {
        console.log(`Row ${index + 1}:`, row);
      });
    });

    // Save extracted data to JSON file
    fs.writeFileSync(
      path.join(__dirname, 'extracted-excel-data.json'),
      JSON.stringify(extractedData, null, 2)
    );

    console.log('\n=== Data extraction complete ===');
    console.log('Data saved to extracted-excel-data.json');

    return extractedData;

  } catch (error) {
    console.error('Error reading Excel file:', error);
    return null;
  }
}

// Function to process sheet data based on sheet type
function processSheetData(sheetName, data) {
  const processed = {};

  try {
    // Look for patterns in the data to extract form values
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];

      if (!row || row.length === 0) continue;

      // Look for cells with numerical values (potential form data)
      row.forEach((cell, colIndex) => {
        if (typeof cell === 'number' && cell > 0) {
          // Try to find the label in adjacent cells
          const labels = [];

          // Check left cell for label
          if (colIndex > 0 && typeof row[colIndex - 1] === 'string') {
            labels.push(row[colIndex - 1]);
          }

          // Check cell above for label
          if (rowIndex > 0 && data[rowIndex - 1] && data[rowIndex - 1][colIndex]) {
            if (typeof data[rowIndex - 1][colIndex] === 'string') {
              labels.push(data[rowIndex - 1][colIndex]);
            }
          }

          // Store the value with its potential labels
          if (labels.length > 0) {
            const key = `${sheetName}_${rowIndex}_${colIndex}`;
            processed[key] = {
              value: cell,
              labels: labels,
              position: `${rowIndex + 1},${colIndex + 1}`,
              context: row.slice(Math.max(0, colIndex - 2), colIndex + 3)
            };
          }
        }
      });
    }

    console.log(`Processed ${Object.keys(processed).length} data points from ${sheetName}`);

  } catch (error) {
    console.error(`Error processing sheet ${sheetName}:`, error);
  }

  return processed;
}

// Run the extraction
if (require.main === module) {
  extractExcelData();
}

module.exports = { extractExcelData };