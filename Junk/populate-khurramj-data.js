const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tax_advisor',
  user: 'postgres',
  password: 'password'
});

const workbook = XLSX.readFile('Salaried Individuals 2025.xlsx');

function parseNum(val) {
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function getCellValue(sheet, row, col) {
  const cell = sheet[XLSX.utils.encode_cell({r: row, c: col})];
  return cell?.v || 0;
}

async function extractAndPopulate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get KhurramJ's user info
    const userResult = await client.query(
      "SELECT id, email FROM users WHERE email = 'khurramj@taxadvisor.pk'"
    );

    if (userResult.rows.length === 0) {
      throw new Error('KhurramJ user not found');
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    console.log('✓ Found user:', userEmail);

    // Get tax year ID
    const taxYearResult = await client.query(
      "SELECT id FROM tax_years WHERE tax_year = '2025-26'"
    );

    const taxYearId = taxYearResult.rows[0].id;
    console.log('✓ Tax year 2025-26 ID:', taxYearId);

    // Get tax return
    const taxReturnResult = await client.query(
      `SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year_id = $2`,
      [userId, taxYearId]
    );

    const taxReturnId = taxReturnResult.rows[0].id;
    console.log('✓ Tax return ID:', taxReturnId);

    // ===== INCOME MODULE =====
    console.log('\n=== EXTRACTING INCOME DATA FROM EXCEL ===');

    const incomeSheet = workbook.Sheets['Income'];

    // Extract values from Excel - Column B has the values (column index 1)
    const incomeData = {
      annual_basic_salary: parseNum(getCellValue(incomeSheet, 5, 1)), // Row 6, Column B
      allowances: parseNum(getCellValue(incomeSheet, 6, 1)), // Row 7
      bonus: parseNum(getCellValue(incomeSheet, 7, 1)), // Row 8
      medical_allowance: parseNum(getCellValue(incomeSheet, 8, 1)), // Row 9
      pension_from_ex_employer: parseNum(getCellValue(incomeSheet, 9, 1)), // Row 10
      employment_termination_payment: parseNum(getCellValue(incomeSheet, 10, 1)), // Row 11
      retirement_from_approved_funds: parseNum(getCellValue(incomeSheet, 11, 1)), // Row 12
      directorship_fee: parseNum(getCellValue(incomeSheet, 12, 1)), // Row 13
      other_cash_benefits: parseNum(getCellValue(incomeSheet, 13, 1)), // Row 14
      employer_contribution_provident: parseNum(getCellValue(incomeSheet, 18, 1)), // Row 19
      taxable_car_value: parseNum(getCellValue(incomeSheet, 19, 1)), // Row 20
      other_taxable_subsidies: parseNum(getCellValue(incomeSheet, 20, 1)), // Row 21
      profit_on_debt_15_percent: parseNum(getCellValue(incomeSheet, 26, 1)), // Profit on debt
      profit_on_debt_12_5_percent: parseNum(getCellValue(incomeSheet, 27, 1)), // Sukook
      other_taxable_income_rent: parseNum(getCellValue(incomeSheet, 28, 1)), // Rent
      other_taxable_income_others: parseNum(getCellValue(incomeSheet, 29, 1)) // Others
    };

    console.log('Income data extracted from Excel:');
    console.log(JSON.stringify(incomeData, null, 2));

    // Delete existing income form for this user
    await client.query(
      `DELETE FROM income_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert new income data
    const incomeInsertResult = await client.query(`
      INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        annual_basic_salary, allowances, bonus, medical_allowance,
        pension_from_ex_employer, employment_termination_payment,
        retirement_from_approved_funds, directorship_fee,
        other_cash_benefits, employer_contribution_provident,
        taxable_car_value, other_taxable_subsidies,
        profit_on_debt_15_percent, profit_on_debt_12_5_percent,
        other_taxable_income_rent, other_taxable_income_others
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING id, annual_salary_wages_total, total_employment_income
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      incomeData.annual_basic_salary, incomeData.allowances,
      incomeData.bonus, incomeData.medical_allowance,
      incomeData.pension_from_ex_employer, incomeData.employment_termination_payment,
      incomeData.retirement_from_approved_funds, incomeData.directorship_fee,
      incomeData.other_cash_benefits, incomeData.employer_contribution_provident,
      incomeData.taxable_car_value, incomeData.other_taxable_subsidies,
      incomeData.profit_on_debt_15_percent, incomeData.profit_on_debt_12_5_percent,
      incomeData.other_taxable_income_rent, incomeData.other_taxable_income_others
    ]);

    console.log('\n✓ Income form inserted successfully');
    console.log('  Calculated annual_salary_wages_total:', incomeInsertResult.rows[0].annual_salary_wages_total);
    console.log('  Calculated total_employment_income:', incomeInsertResult.rows[0].total_employment_income);

    // ===== WEALTH STATEMENT MODULE =====
    console.log('\n=== EXTRACTING WEALTH STATEMENT DATA FROM EXCEL ===');

    const wealthSheet = workbook.Sheets['Wealth Statement'];

    const wealthData = {
      agricultural_property_curr: parseNum(getCellValue(wealthSheet, 7, 2)), // Row 8, Column C (Current year)
      commercial_property_curr: parseNum(getCellValue(wealthSheet, 8, 2)),
      equipment_curr: parseNum(getCellValue(wealthSheet, 9, 2)),
      animals_curr: parseNum(getCellValue(wealthSheet, 10, 2)),
      investments_curr: parseNum(getCellValue(wealthSheet, 11, 2)),
      debt_receivable_curr: parseNum(getCellValue(wealthSheet, 12, 2)),
      motor_vehicles_curr: parseNum(getCellValue(wealthSheet, 13, 2)),
      precious_possessions_curr: parseNum(getCellValue(wealthSheet, 14, 2)),
      household_effects_curr: parseNum(getCellValue(wealthSheet, 15, 2)),
      personal_items_curr: parseNum(getCellValue(wealthSheet, 16, 2)),
      cash_curr: parseNum(getCellValue(wealthSheet, 17, 2)),
      other_assets_curr: parseNum(getCellValue(wealthSheet, 18, 2)),
      business_liabilities_curr: parseNum(getCellValue(wealthSheet, 21, 2)),
      personal_liabilities_curr: parseNum(getCellValue(wealthSheet, 22, 2))
    };

    console.log('Wealth data extracted from Excel:');
    console.log(JSON.stringify(wealthData, null, 2));

    // Delete existing wealth statement
    await client.query(
      `DELETE FROM wealth_statement_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert wealth statement
    const wealthInsertResult = await client.query(`
      INSERT INTO wealth_statement_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        agricultural_property_curr, commercial_property_curr,
        equipment_curr, animals_curr, investments_curr,
        debt_receivable_curr, motor_vehicles_curr,
        precious_possessions_curr, household_effects_curr,
        personal_items_curr, cash_curr, other_assets_curr,
        business_liabilities_curr, personal_liabilities_curr
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING id, total_assets_curr, total_liabilities_curr
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      wealthData.agricultural_property_curr, wealthData.commercial_property_curr,
      wealthData.equipment_curr, wealthData.animals_curr, wealthData.investments_curr,
      wealthData.debt_receivable_curr, wealthData.motor_vehicles_curr,
      wealthData.precious_possessions_curr, wealthData.household_effects_curr,
      wealthData.personal_items_curr, wealthData.cash_curr, wealthData.other_assets_curr,
      wealthData.business_liabilities_curr, wealthData.personal_liabilities_curr
    ]);

    console.log('\n✓ Wealth statement inserted successfully');
    console.log('  Calculated total_assets_curr:', wealthInsertResult.rows[0].total_assets_curr);
    console.log('  Calculated total_liabilities_curr:', wealthInsertResult.rows[0].total_liabilities_curr);

    // ===== VERIFICATION =====
    console.log('\n=== VERIFYING DATA IN DATABASE ===');

    const verifyIncome = await client.query(`
      SELECT
        annual_basic_salary,
        allowances,
        bonus,
        medical_allowance,
        annual_salary_wages_total,
        total_employment_income
      FROM income_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('\n📊 Income Form Verification:');
    console.log('  Annual Basic Salary:', verifyIncome.rows[0].annual_basic_salary);
    console.log('  Allowances:', verifyIncome.rows[0].allowances);
    console.log('  Bonus:', verifyIncome.rows[0].bonus);
    console.log('  Medical Allowance:', verifyIncome.rows[0].medical_allowance);
    console.log('  ✓ Calculated Total Wages:', verifyIncome.rows[0].annual_salary_wages_total);
    console.log('  ✓ Calculated Total Employment Income:', verifyIncome.rows[0].total_employment_income);

    const verifyWealth = await client.query(`
      SELECT
        cash_curr,
        investments_curr,
        motor_vehicles_curr,
        total_assets_curr,
        total_liabilities_curr
      FROM wealth_statement_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('\n📊 Wealth Statement Verification:');
    console.log('  Cash (Current):', verifyWealth.rows[0].cash_curr);
    console.log('  Investments (Current):', verifyWealth.rows[0].investments_curr);
    console.log('  Motor Vehicles (Current):', verifyWealth.rows[0].motor_vehicles_curr);
    console.log('  ✓ Calculated Total Assets:', verifyWealth.rows[0].total_assets_curr);
    console.log('  ✓ Calculated Total Liabilities:', verifyWealth.rows[0].total_liabilities_curr);

    await client.query('COMMIT');

    console.log('\n✅ ALL DATA POPULATED SUCCESSFULLY FOR KHURRAMJ');
    console.log('✅ Calculated fields are working - verify totals above');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

extractAndPopulate().catch(console.error);