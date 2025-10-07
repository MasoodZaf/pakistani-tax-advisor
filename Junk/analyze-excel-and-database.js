const XLSX = require('xlsx');
const { Pool } = require('pg');
const path = require('path');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function analyzeExcelAndDatabase() {
  try {
    console.log('📊 Analyzing Excel vs Database Tax Computation...\n');

    // Step 1: Read Excel file
    console.log('1. Reading Excel file...');
    const excelPath = path.join(__dirname, '..', 'Salaried Individuals TY2025 Updated.xlsx');
    const workbook = XLSX.readFile(excelPath);

    console.log('✅ Excel file loaded');
    console.log('📋 Available sheets:', workbook.SheetNames);

    // Step 2: Extract data from Tax Computation sheet
    console.log('\n2. Extracting Tax Computation sheet...');
    const taxComputationSheet = workbook.Sheets['Tax Computation'];

    if (!taxComputationSheet) {
      console.log('❌ Tax Computation sheet not found');
      console.log('Available sheets:', workbook.SheetNames);
      return;
    }

    // Convert sheet to JSON for easier analysis
    const taxComputationData = XLSX.utils.sheet_to_json(taxComputationSheet, { header: 1 });

    console.log('✅ Tax Computation sheet extracted');
    console.log('📊 Sheet data preview:');
    taxComputationData.slice(0, 10).forEach((row, index) => {
      if (row.length > 0) {
        console.log(`Row ${index + 1}:`, row);
      }
    });

    // Step 3: Extract key values from Excel
    console.log('\n3. Extracting key values from Excel...');
    const excelValues = {};

    // Look for specific tax computation values
    taxComputationData.forEach((row, index) => {
      if (row[0]) {
        const description = row[0].toString().toLowerCase();
        const amount = row[1];

        if (description.includes('income from salary')) {
          excelValues.salaryIncome = parseFloat(amount) || 0;
        } else if (description.includes('total income') && !description.includes('taxable')) {
          excelValues.totalIncome = parseFloat(amount) || 0;
        } else if (description.includes('deductible allowances')) {
          excelValues.deductibleAllowances = parseFloat(amount) || 0;
        } else if (description.includes('income exempt from tax')) {
          excelValues.exemptIncome = parseFloat(amount) || 0;
        } else if (description.includes('taxable income excluding capital')) {
          excelValues.taxableIncomeExcludingCapital = parseFloat(amount) || 0;
        } else if (description.includes('gains') && description.includes('loss') && description.includes('capital')) {
          excelValues.capitalGains = parseFloat(amount) || 0;
        } else if (description.includes('taxable income including capital')) {
          excelValues.taxableIncomeIncludingCapital = parseFloat(amount) || 0;
        } else if (description.includes('normal income tax') && !description.includes('including') && !description.includes('after')) {
          excelValues.normalIncomeTax = parseFloat(amount) || 0;
        } else if (description.includes('surcharge')) {
          excelValues.surcharge = parseFloat(amount) || 0;
        } else if (description.includes('capital gain tax')) {
          excelValues.capitalGainTax = parseFloat(amount) || 0;
        } else if (description.includes('tax reductions')) {
          excelValues.taxReductions = parseFloat(amount) || 0;
        } else if (description.includes('tax credits')) {
          excelValues.taxCredits = parseFloat(amount) || 0;
        } else if (description.includes('final') && description.includes('tax')) {
          excelValues.finalTax = parseFloat(amount) || 0;
        } else if (description.includes('total tax chargeable')) {
          excelValues.totalTaxChargeable = parseFloat(amount) || 0;
        } else if (description.includes('withholding income tax')) {
          excelValues.withholdingTax = parseFloat(amount) || 0;
        } else if (description.includes('income tax demanded')) {
          excelValues.taxDemanded = parseFloat(amount) || 0;
        }
      }
    });

    console.log('✅ Excel values extracted:');
    Object.entries(excelValues).forEach(([key, value]) => {
      console.log(`   ${key}: Rs ${value.toLocaleString()}`);
    });

    // Step 4: Get Muhammad Hassan's data from database
    console.log('\n4. Getting Muhammad Hassan\'s data from database...');
    const client = await pool.connect();

    // Get user ID for Muhammad Hassan
    const userQuery = await client.query(
      "SELECT id, email FROM users WHERE email LIKE '%hassan%' OR email = 'superadmin@paktaxadvisor.com'"
    );

    if (userQuery.rows.length === 0) {
      console.log('❌ Muhammad Hassan not found in database');
      client.release();
      return;
    }

    const userId = userQuery.rows[0].id;
    const userEmail = userQuery.rows[0].email;
    console.log('✅ Found user:', userEmail, 'ID:', userId);

    // Get tax return for 2024-25
    const taxReturnQuery = await client.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, '2024-25']
    );

    if (taxReturnQuery.rows.length === 0) {
      console.log('❌ No tax return found for 2024-25');
      client.release();
      return;
    }

    const taxReturnId = taxReturnQuery.rows[0].id;
    console.log('✅ Tax return ID:', taxReturnId);

    // Get all form data
    const [
      incomeResult,
      reductionsResult,
      creditsResult,
      deductionsResult,
      finalTaxResult,
      capitalGainResult,
      expensesResult
    ] = await Promise.all([
      client.query('SELECT * FROM income_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM reductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM credits_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM deductions_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM final_tax_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM capital_gain_forms WHERE tax_return_id = $1', [taxReturnId]),
      client.query('SELECT * FROM expenses_forms WHERE tax_return_id = $1', [taxReturnId])
    ]);

    // Step 5: Extract database values
    console.log('\n5. Extracting database values...');
    const dbValues = {};

    if (incomeResult.rows.length > 0) {
      const income = incomeResult.rows[0];
      dbValues.salaryIncome = parseFloat(income.annual_salary_and_wages) || 0;
      dbValues.totalIncome = parseFloat(income.total_gross_income) || 0;
      dbValues.taxableIncomeExcludingCapital = parseFloat(income.net_taxable_income) || 0;
    }

    if (reductionsResult.rows.length > 0) {
      const reductions = reductionsResult.rows[0];
      dbValues.taxReductions = parseFloat(reductions.total_reductions) || 0;
    }

    if (creditsResult.rows.length > 0) {
      const credits = creditsResult.rows[0];
      dbValues.taxCredits = parseFloat(credits.total_credits) || 0;
    }

    if (deductionsResult.rows.length > 0) {
      const deductions = deductionsResult.rows[0];
      dbValues.deductibleAllowances = parseFloat(deductions.total_deductions) || 0;
    }

    if (finalTaxResult.rows.length > 0) {
      const finalTax = finalTaxResult.rows[0];
      dbValues.finalTax = parseFloat(finalTax.total_final_tax) || 0;
    }

    if (capitalGainResult.rows.length > 0) {
      const capitalGain = capitalGainResult.rows[0];
      dbValues.capitalGains = parseFloat(capitalGain.total_capital_gain) || 0;
      dbValues.capitalGainTax = parseFloat(capitalGain.total_tax_deducted) || 0;
    }

    console.log('✅ Database values extracted:');
    Object.entries(dbValues).forEach(([key, value]) => {
      console.log(`   ${key}: Rs ${value.toLocaleString()}`);
    });

    // Step 6: Compare values
    console.log('\n6. Comparing Excel vs Database values...');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('| Field                           | Excel           | Database        | Match |');
    console.log('═══════════════════════════════════════════════════════════════');

    const comparisons = {};
    Object.keys(excelValues).forEach(key => {
      const excelValue = excelValues[key] || 0;
      const dbValue = dbValues[key] || 0;
      const match = Math.abs(excelValue - dbValue) < 1; // Allow for rounding differences

      comparisons[key] = { excel: excelValue, db: dbValue, match };

      console.log(`| ${key.padEnd(30)} | ${excelValue.toLocaleString().padStart(13)} | ${dbValue.toLocaleString().padStart(13)} | ${match ? '✅' : '❌'} |`);
    });
    console.log('═══════════════════════════════════════════════════════════════');

    // Step 7: Show discrepancies
    console.log('\n7. Summary of discrepancies...');
    const discrepancies = Object.entries(comparisons).filter(([key, comp]) => !comp.match);

    if (discrepancies.length === 0) {
      console.log('🎉 All values match! Tax computation is correct.');
    } else {
      console.log('⚠️  Found discrepancies:');
      discrepancies.forEach(([key, comp]) => {
        const diff = comp.excel - comp.db;
        console.log(`   ${key}: Excel Rs ${comp.excel.toLocaleString()} vs DB Rs ${comp.db.toLocaleString()} (diff: Rs ${diff.toLocaleString()})`);
      });
    }

    client.release();

  } catch (error) {
    console.error('❌ Error analyzing data:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

analyzeExcelAndDatabase();