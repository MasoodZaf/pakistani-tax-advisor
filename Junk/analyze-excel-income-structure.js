const ExcelJS = require('exceljs');
const fs = require('fs');

async function analyzeExcelStructure() {
  try {
    console.log('Analyzing Salaried Individuals 2025.xlsx...');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/Salaried Individuals 2025.xlsx');

    console.log('Available worksheets:');
    workbook.eachSheet((worksheet, sheetId) => {
      console.log(`- Sheet ${sheetId}: ${worksheet.name}`);
    });

    // Analyze the Income worksheet specifically
    const worksheet = workbook.getWorksheet('Income') || workbook.getWorksheet(2);
    console.log(`\nAnalyzing Income worksheet: ${worksheet.name}`);

    const incomeStructure = {
      paymentsByEmployer: {},
      nonCashBenefits: {},
      otherIncomeMinimumTax: {},
      otherIncomeNotMinimumTax: {}
    };

    let currentSection = '';
    const fieldsFound = [];

    // Scan through rows to find income structure
    worksheet.eachRow((row, rowNumber) => {
      const description = row.getCell(1).text?.trim();
      const value = row.getCell(2).text?.trim();

      if (description && description.length > 0) {
        // Identify section headers
        if (description.includes('Payments By Employer') || description.includes('Annual Salary and Wages')) {
          currentSection = 'paymentsByEmployer';
        } else if (description.includes('Non cash benefits')) {
          currentSection = 'nonCashBenefits';
        } else if (description.includes('Other Income (Subject to minimum tax)')) {
          currentSection = 'otherIncomeMinimumTax';
        } else if (description.includes('Other Income (Not Subject to minimum tax)')) {
          currentSection = 'otherIncomeNotMinimumTax';
        }

        // Capture field details
        fieldsFound.push({
          rowNumber,
          section: currentSection,
          description,
          value,
          formula: row.getCell(2).formula || ''
        });

        console.log(`Row ${rowNumber}: ${description} | ${value}`);
      }
    });

    // Group fields by section
    const sections = {
      'Payments By Employer': [],
      'Non Cash Benefits': [],
      'Other Income (Subject to minimum tax)': [],
      'Other Income (Not Subject to minimum tax)': []
    };

    fieldsFound.forEach(field => {
      if (field.description.includes('Annual Basic Salary')) {
        sections['Payments By Employer'].push({field: 'annual_basic_salary', label: 'Annual Basic Salary', value: field.value});
      } else if (field.description.includes('Allowances (excluding bonus and medical allowance)')) {
        sections['Payments By Employer'].push({field: 'allowances_excluding_bonus_medical', label: 'Allowances (excluding bonus and medical allowance)', value: field.value});
      } else if (field.description.includes('Bonus')) {
        sections['Payments By Employer'].push({field: 'bonus', label: 'Bonus', value: field.value});
      } else if (field.description.includes('Medical allowance')) {
        sections['Payments By Employer'].push({field: 'medical_allowance', label: 'Medical allowance (Where medical facility not provided by employer)', value: field.value});
      } else if (field.description.includes('Pension received from ex-employer')) {
        sections['Payments By Employer'].push({field: 'pension_from_ex_employer', label: 'Pension received from ex-employer', value: field.value});
      } else if (field.description.includes('Employment Termination payment')) {
        sections['Payments By Employer'].push({field: 'employment_termination_payment', label: 'Employment Termination payment (Section 12 (2) e iii)', value: field.value});
      } else if (field.description.includes('Amount received on retirement from approved funds')) {
        sections['Payments By Employer'].push({field: 'retirement_from_approved_funds', label: 'Amount received on retirement from approved funds (Provident, pension, gratuity)', value: field.value});
      } else if (field.description.includes('Directorship Fee')) {
        sections['Payments By Employer'].push({field: 'directorship_fee', label: 'Directorship Fee u/s 149(3)', value: field.value});
      } else if (field.description.includes('Other cash benefits')) {
        sections['Payments By Employer'].push({field: 'other_cash_benefits', label: 'Other cash benefits (LFA, Children education, etc.)', value: field.value});
      } else if (field.description.includes('Income Exempt from tax')) {
        sections['Payments By Employer'].push({field: 'income_exempt_from_tax', label: 'Income Exempt from tax', value: field.value});
      }

      // Non Cash Benefits
      else if (field.description.includes('Employer Contribution to Approved Provident Funds')) {
        sections['Non Cash Benefits'].push({field: 'employer_contribution_provident', label: 'Employer Contribution to Approved Provident Funds', value: field.value});
      } else if (field.description.includes('Taxable value of Car provided by employer')) {
        sections['Non Cash Benefits'].push({field: 'taxable_car_value', label: 'Taxable value of Car provided by employer', value: field.value});
      } else if (field.description.includes('Other taxable subsidies and non cash benefits')) {
        sections['Non Cash Benefits'].push({field: 'other_taxable_subsidies', label: 'Other taxable subsidies and non cash benefits', value: field.value});
      } else if (field.description.includes('Non cash benefit exempt from tax')) {
        sections['Non Cash Benefits'].push({field: 'non_cash_benefit_exempt', label: 'Non cash benefit exempt from tax', value: field.value});
      }

      // Other Income (Subject to minimum tax)
      else if (field.description.includes('Profit on Debt u/s 151 @ 15%')) {
        sections['Other Income (Subject to minimum tax)'].push({field: 'profit_on_debt_15', label: 'Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)', value: field.value});
      } else if (field.description.includes('Profit on Debt u/s 151A @ 12.5%')) {
        sections['Other Income (Subject to minimum tax)'].push({field: 'profit_on_debt_12_5', label: 'Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)', value: field.value});
      }

      // Other Income (Not Subject to minimum tax)
      else if (field.description.includes('Other taxable income - Rent income')) {
        sections['Other Income (Not Subject to minimum tax)'].push({field: 'rent_income', label: 'Other taxable income - Rent income', value: field.value});
      } else if (field.description.includes('Other taxable income - Others')) {
        sections['Other Income (Not Subject to minimum tax)'].push({field: 'other_taxable_income_others', label: 'Other taxable income - Others', value: field.value});
      }
    });

    // Output the structure
    console.log('\n=== INCOME FORM STRUCTURE ANALYSIS ===');
    Object.keys(sections).forEach(sectionName => {
      if (sections[sectionName].length > 0) {
        console.log(`\n${sectionName}:`);
        sections[sectionName].forEach(field => {
          console.log(`  - ${field.field}: "${field.label}" (${field.value})`);
        });
      }
    });

    // Generate database schema suggestions
    console.log('\n=== DATABASE SCHEMA UPDATES NEEDED ===');
    const allFields = [];
    Object.values(sections).forEach(sectionFields => {
      allFields.push(...sectionFields);
    });

    console.log('-- Add these columns to income_forms table:');
    allFields.forEach(field => {
      console.log(`ALTER TABLE income_forms ADD COLUMN IF NOT EXISTS ${field.field} DECIMAL(15,2) DEFAULT 0;`);
    });

    // Save analysis to file
    const analysisOutput = {
      worksheetName: worksheet.name,
      sections: sections,
      totalFieldsFound: allFields.length,
      schemaUpdates: allFields.map(f => `${f.field} DECIMAL(15,2) DEFAULT 0`)
    };

    fs.writeFileSync('/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/excel-analysis-output.json',
      JSON.stringify(analysisOutput, null, 2));

    console.log('\n✅ Analysis complete! Check excel-analysis-output.json for detailed results.');

  } catch (error) {
    console.error('❌ Error analyzing Excel file:', error);
    throw error;
  }
}

analyzeExcelStructure()
  .then(() => {
    console.log('\n✅ Excel analysis completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Excel analysis failed:', error);
    process.exit(1);
  });