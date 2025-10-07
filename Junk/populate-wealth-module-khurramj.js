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

async function populateWealthModule() {
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

    // Get or create tax return
    let taxReturnResult = await client.query(
      `SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year_id = $2`,
      [userId, taxYearId]
    );

    let taxReturnId;
    if (taxReturnResult.rows.length === 0) {
      const insertReturn = await client.query(
        `INSERT INTO tax_returns (user_id, user_email, tax_year_id, filing_status, return_number)
         VALUES ($1, $2, $3, 'draft', $4) RETURNING id`,
        [userId, userEmail, taxYearId, `TR-${userId.substring(0, 8)}-2025-26`]
      );
      taxReturnId = insertReturn.rows[0].id;
      console.log('✓ Created new tax return:', taxReturnId);
    } else {
      taxReturnId = taxReturnResult.rows[0].id;
      console.log('✓ Using existing tax return:', taxReturnId);
    }

    // ===== WEALTH STATEMENT FORM =====
    console.log('\n=== POPULATING WEALTH STATEMENT FORM ===');
    const wealthSheet = workbook.Sheets['Wealth Statement'];

    // Based on the Excel analysis:
    // Row 7 = Commercial Property
    // Row 11-12 = Investments
    // Row 15 = Motor Vehicles
    // Row 16 = Precious Possessions
    // Row 19 = Cash
    // Row 21 = Other Assets
    // Row 28 = Liabilities

    // Column B = Previous Year (2023-24)
    // Column C = Current Year (2024-25)

    const wealthData = {
      // Previous Year (Column B)
      commercial_property_prev: parseNum(getCellValue(wealthSheet, 6, 1)), // Row 7, Col B
      investments_prev: parseNum(getCellValue(wealthSheet, 10, 1)) + parseNum(getCellValue(wealthSheet, 11, 1)), // Row 11+12
      motor_vehicles_prev: parseNum(getCellValue(wealthSheet, 14, 1)), // Row 15
      precious_possessions_prev: parseNum(getCellValue(wealthSheet, 15, 1)), // Row 16
      cash_prev: parseNum(getCellValue(wealthSheet, 18, 1)), // Row 19
      other_assets_prev: parseNum(getCellValue(wealthSheet, 20, 1)), // Row 21
      personal_liabilities_prev: parseNum(getCellValue(wealthSheet, 27, 1)), // Row 28

      // Current Year (Column C)
      commercial_property_curr: parseNum(getCellValue(wealthSheet, 6, 2)), // Row 7, Col C
      investments_curr: parseNum(getCellValue(wealthSheet, 10, 2)) + parseNum(getCellValue(wealthSheet, 11, 2)), // Row 11+12
      motor_vehicles_curr: parseNum(getCellValue(wealthSheet, 14, 2)), // Row 15
      precious_possessions_curr: parseNum(getCellValue(wealthSheet, 15, 2)), // Row 16
      cash_curr: parseNum(getCellValue(wealthSheet, 18, 2)), // Row 19
      other_assets_curr: parseNum(getCellValue(wealthSheet, 20, 2)), // Row 21
      personal_liabilities_curr: parseNum(getCellValue(wealthSheet, 27, 2)) // Row 28
    };

    console.log('Wealth data extracted:');
    console.log('Previous Year:');
    console.log('  Commercial Property:', wealthData.commercial_property_prev);
    console.log('  Investments:', wealthData.investments_prev);
    console.log('  Motor Vehicles:', wealthData.motor_vehicles_prev);
    console.log('  Precious Possessions:', wealthData.precious_possessions_prev);
    console.log('  Cash:', wealthData.cash_prev);
    console.log('  Other Assets:', wealthData.other_assets_prev);
    console.log('  Personal Liabilities:', wealthData.personal_liabilities_prev);

    console.log('\nCurrent Year:');
    console.log('  Commercial Property:', wealthData.commercial_property_curr);
    console.log('  Investments:', wealthData.investments_curr);
    console.log('  Motor Vehicles:', wealthData.motor_vehicles_curr);
    console.log('  Precious Possessions:', wealthData.precious_possessions_curr);
    console.log('  Cash:', wealthData.cash_curr);
    console.log('  Other Assets:', wealthData.other_assets_curr);
    console.log('  Personal Liabilities:', wealthData.personal_liabilities_curr);

    // Delete existing wealth statement
    await client.query(
      `DELETE FROM wealth_statement_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert wealth statement
    const wealthInsert = await client.query(`
      INSERT INTO wealth_statement_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        commercial_property_prev, investments_prev, motor_vehicles_prev,
        precious_possessions_prev, cash_prev, other_assets_prev,
        personal_liabilities_prev,
        commercial_property_curr, investments_curr, motor_vehicles_curr,
        precious_possessions_curr, cash_curr, other_assets_curr,
        personal_liabilities_curr
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18
      ) RETURNING id, total_assets_prev, total_assets_curr,
                  total_liabilities_prev, total_liabilities_curr
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      wealthData.commercial_property_prev, wealthData.investments_prev,
      wealthData.motor_vehicles_prev, wealthData.precious_possessions_prev,
      wealthData.cash_prev, wealthData.other_assets_prev,
      wealthData.personal_liabilities_prev,
      wealthData.commercial_property_curr, wealthData.investments_curr,
      wealthData.motor_vehicles_curr, wealthData.precious_possessions_curr,
      wealthData.cash_curr, wealthData.other_assets_curr,
      wealthData.personal_liabilities_curr
    ]);

    console.log('\n✓ Wealth statement form populated');
    console.log('  Total Assets (Previous Year):', wealthInsert.rows[0].total_assets_prev);
    console.log('  Total Assets (Current Year):', wealthInsert.rows[0].total_assets_curr);
    console.log('  Total Liabilities (Previous Year):', wealthInsert.rows[0].total_liabilities_prev);
    console.log('  Total Liabilities (Current Year):', wealthInsert.rows[0].total_liabilities_curr);
    console.log('  Net Worth (Previous):', parseFloat(wealthInsert.rows[0].total_assets_prev) - parseFloat(wealthInsert.rows[0].total_liabilities_prev));
    console.log('  Net Worth (Current):', parseFloat(wealthInsert.rows[0].total_assets_curr) - parseFloat(wealthInsert.rows[0].total_liabilities_curr));

    // ===== VERIFICATION =====
    console.log('\n=== VERIFICATION ===');

    const verifyWealth = await client.query(`
      SELECT
        commercial_property_curr,
        investments_curr,
        motor_vehicles_curr,
        precious_possessions_curr,
        cash_curr,
        other_assets_curr,
        total_assets_curr,
        personal_liabilities_curr,
        total_liabilities_curr
      FROM wealth_statement_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('\n📊 Wealth Statement (Current Year):');
    console.log('  Commercial Property:', verifyWealth.rows[0].commercial_property_curr);
    console.log('  Investments:', verifyWealth.rows[0].investments_curr);
    console.log('  Motor Vehicles:', verifyWealth.rows[0].motor_vehicles_curr);
    console.log('  Precious Possessions:', verifyWealth.rows[0].precious_possessions_curr);
    console.log('  Cash:', verifyWealth.rows[0].cash_curr);
    console.log('  Other Assets:', verifyWealth.rows[0].other_assets_curr);
    console.log('  ✓ Total Assets:', verifyWealth.rows[0].total_assets_curr);
    console.log('  Personal Liabilities:', verifyWealth.rows[0].personal_liabilities_curr);
    console.log('  ✓ Total Liabilities:', verifyWealth.rows[0].total_liabilities_curr);
    console.log('  ✓ Net Worth:', parseFloat(verifyWealth.rows[0].total_assets_curr) - parseFloat(verifyWealth.rows[0].total_liabilities_curr));

    await client.query('COMMIT');

    console.log('\n✅ WEALTH MODULE DATA POPULATED SUCCESSFULLY FOR KHURRAMJ');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

populateWealthModule().catch(console.error);
