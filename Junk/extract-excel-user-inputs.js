/**
 * Extract Excel User Input Fields for Test Data Generation
 * Processes "Salaried Individuals 2025.xlsx" to identify input fields and expected calculations
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

console.log('🔍 EXTRACTING EXCEL USER INPUT FIELDS FOR TEST DATA');
console.log('====================================================');

function extractUserInputFields() {
  try {
    const filePath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/Salaried Individuals 2025.xlsx';

    if (!fs.existsSync(filePath)) {
      console.log('❌ Excel file not found:', filePath);
      return;
    }

    console.log('📊 Reading Excel file:', filePath);
    const workbook = XLSX.readFile(filePath);

    console.log('📋 Available sheets:', workbook.SheetNames);

    const extractedData = {
      metadata: {
        fileName: 'Salaried Individuals 2025.xlsx',
        extractedAt: new Date().toISOString(),
        sheets: workbook.SheetNames
      },
      userInputFields: {},
      calculatedFields: {},
      crossReferences: {},
      testScenarios: {}
    };

    // Process each sheet to find user input fields
    workbook.SheetNames.forEach(sheetName => {
      console.log(`\n🔍 Processing Sheet: ${sheetName}`);

      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref']);

      const sheetData = {
        userInputs: [],
        calculations: [],
        formulas: [],
        structure: []
      };

      // Scan each cell for user input indicators and formulas
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];

          if (cell) {
            const cellValue = cell.v;
            const cellType = cell.t;
            const cellFormula = cell.f;

            // Look for user input indicators
            if (typeof cellValue === 'string') {
              const lowerValue = cellValue.toLowerCase();

              // Check for input field indicators
              if (lowerValue.includes('user input') ||
                  lowerValue.includes('enter') ||
                  lowerValue.includes('input') ||
                  lowerValue.includes('amount') ||
                  lowerValue.includes('salary') ||
                  lowerValue.includes('bonus') ||
                  lowerValue.includes('allowance')) {

                sheetData.userInputs.push({
                  cell: cellAddress,
                  row: row + 1,
                  col: col + 1,
                  description: cellValue,
                  type: 'input_description'
                });
              }
            }

            // Capture formulas for calculation verification
            if (cellFormula) {
              sheetData.formulas.push({
                cell: cellAddress,
                row: row + 1,
                col: col + 1,
                formula: cellFormula,
                value: cellValue
              });
            }

            // Capture numeric values that might be input fields
            if (typeof cellValue === 'number' && cellValue > 0) {
              // Check adjacent cells for descriptions
              const leftCell = worksheet[XLSX.utils.encode_cell({ r: row, c: col - 1 })];
              const topCell = worksheet[XLSX.utils.encode_cell({ r: row - 1, c: col })];

              let description = '';
              if (leftCell && typeof leftCell.v === 'string') {
                description = leftCell.v;
              } else if (topCell && typeof topCell.v === 'string') {
                description = topCell.v;
              }

              if (description && isLikelyInputField(description)) {
                sheetData.userInputs.push({
                  cell: cellAddress,
                  row: row + 1,
                  col: col + 1,
                  value: cellValue,
                  description: description,
                  type: 'numeric_input'
                });
              }
            }
          }
        }
      }

      extractedData.userInputFields[sheetName] = sheetData;
    });

    // Generate test scenarios based on extracted data
    generateTestScenarios(extractedData);

    // Save extracted data
    const outputPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/excel-user-input-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify(extractedData, null, 2));

    console.log('\n✅ Excel analysis completed successfully');
    console.log(`📝 Results saved to: ${outputPath}`);

    // Print summary
    printExtractionSummary(extractedData);

    return extractedData;

  } catch (error) {
    console.error('❌ Error extracting Excel data:', error);
    throw error;
  }
}

function isLikelyInputField(description) {
  const inputKeywords = [
    'monthly salary', 'bonus', 'allowance', 'income', 'payment',
    'fee', 'amount', 'receipt', 'tax', 'deduction', 'contribution',
    'benefit', 'expense', 'asset', 'liability', 'profit', 'gain'
  ];

  const lowerDesc = description.toLowerCase();
  return inputKeywords.some(keyword => lowerDesc.includes(keyword));
}

function generateTestScenarios(extractedData) {
  console.log('\n🧪 Generating Test Scenarios');

  // Extract key income fields for scenario generation
  const incomeSheet = extractedData.userInputFields['Income'] || extractedData.userInputFields['Sheet1'];
  if (!incomeSheet) {
    console.log('⚠️ Income sheet not found, using default scenarios');
    return;
  }

  const scenarios = {
    'low_income_salaried': {
      description: 'Basic salaried individual with minimal income',
      data: {
        monthly_basic_salary: 50000,
        allowances: 10000,
        bonus: 25000,
        medical_allowance: 5000,
        expected_annual_salary: 600000,
        expected_total_income: 635000
      }
    },
    'medium_income_professional': {
      description: 'Mid-level professional with multiple income sources',
      data: {
        monthly_basic_salary: 150000,
        allowances: 30000,
        bonus: 200000,
        medical_allowance: 10000,
        directorship_fee: 500000,
        expected_annual_salary: 1800000,
        expected_total_income: 2620000
      }
    },
    'high_income_executive': {
      description: 'High-income executive with comprehensive benefits',
      data: {
        monthly_basic_salary: 500000,
        allowances: 100000,
        bonus: 1000000,
        medical_allowance: 10000,
        directorship_fee: 2000000,
        other_cash_benefits: 500000,
        expected_annual_salary: 6000000,
        expected_total_income: 9620000
      }
    }
  };

  extractedData.testScenarios = scenarios;
}

function printExtractionSummary(extractedData) {
  console.log('\n📊 EXTRACTION SUMMARY');
  console.log('=====================');

  Object.keys(extractedData.userInputFields).forEach(sheetName => {
    const sheet = extractedData.userInputFields[sheetName];
    console.log(`\n📋 ${sheetName}:`);
    console.log(`   User Inputs: ${sheet.userInputs.length}`);
    console.log(`   Formulas: ${sheet.formulas.length}`);

    if (sheet.userInputs.length > 0) {
      console.log('   Input Fields:');
      sheet.userInputs.slice(0, 5).forEach(input => {
        console.log(`   - ${input.description} (${input.cell}): ${input.value || 'N/A'}`);
      });
      if (sheet.userInputs.length > 5) {
        console.log(`   ... and ${sheet.userInputs.length - 5} more`);
      }
    }
  });

  console.log(`\n🧪 Test Scenarios Generated: ${Object.keys(extractedData.testScenarios).length}`);
  Object.keys(extractedData.testScenarios).forEach(scenario => {
    console.log(`   - ${scenario}: ${extractedData.testScenarios[scenario].description}`);
  });
}

// Run extraction
if (require.main === module) {
  extractUserInputFields();
}

module.exports = {
  extractUserInputFields,
  generateTestScenarios
};