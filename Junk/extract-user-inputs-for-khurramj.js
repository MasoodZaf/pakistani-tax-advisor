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

// Helper to parse numeric values
function parseNum(val) {
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

async function extractAndPopulate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get KhurramJ's user_id
    const userResult = await client.query(
      "SELECT id, email FROM users WHERE email = 'khurramj@taxadvisor.pk'"
    );

    if (userResult.rows.length === 0) {
      throw new Error('KhurramJ user not found');
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    console.log('✓ Found user:', userEmail, 'ID:', userId);

    // Get tax year ID for 2025-26
    const taxYearResult = await client.query(
      "SELECT id FROM tax_years WHERE tax_year = '2025-26'"
    );

    if (taxYearResult.rows.length === 0) {
      throw new Error('Tax year 2025-26 not found');
    }

    const taxYearId = taxYearResult.rows[0].id;
    console.log('✓ Found tax year ID:', taxYearId);

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

    // ===== INCOME MODULE =====
    console.log('\n=== PROCESSING INCOME MODULE ===');

    const incomeSheet = workbook.Sheets['Income'];
    const incomeRange = XLSX.utils.decode_range(incomeSheet['!ref']);

    // Map Excel cells to database fields (based on "User Input" remarks)
    const incomeData = {
      // Monthly Salary (Row with "User Input")
      monthly_salary: parseNum(incomeSheet['C11']?.v),  // Monthly Basic Salary
      monthly_salary_tax_deducted: parseNum(incomeSheet['D11']?.v),

      // Bonus
      bonus: parseNum(incomeSheet['C12']?.v),
      bonus_tax_deducted: parseNum(incomeSheet['D12']?.v),

      // House Rent Allowance
      house_rent_allowance: parseNum(incomeSheet['C13']?.v),
      house_rent_allowance_tax_deducted: parseNum(incomeSheet['D13']?.v),

      // Medical Allowance
      medical_allowance: parseNum(incomeSheet['C14']?.v),
      medical_allowance_tax_deducted: parseNum(incomeSheet['D14']?.v),

      // Conveyance Allowance
      conveyance_allowance: parseNum(incomeSheet['C15']?.v),
      conveyance_allowance_tax_deducted: parseNum(incomeSheet['D15']?.v),

      // Utilities Allowance
      utilities_allowance: parseNum(incomeSheet['C16']?.v),
      utilities_allowance_tax_deducted: parseNum(incomeSheet['D16']?.v),

      // Other Allowances
      other_allowances: parseNum(incomeSheet['C17']?.v),
      other_allowances_tax_deducted: parseNum(incomeSheet['D17']?.v)
    };

    console.log('Income data extracted:', JSON.stringify(incomeData, null, 2));

    // Insert/Update Income Form
    await client.query(`
      INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, monthly_salary_tax_deducted,
        bonus, bonus_tax_deducted,
        house_rent_allowance, house_rent_allowance_tax_deducted,
        medical_allowance, medical_allowance_tax_deducted,
        conveyance_allowance, conveyance_allowance_tax_deducted,
        utilities_allowance, utilities_allowance_tax_deducted,
        other_allowances, other_allowances_tax_deducted
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (tax_return_id)
      DO UPDATE SET
        monthly_salary = EXCLUDED.monthly_salary,
        monthly_salary_tax_deducted = EXCLUDED.monthly_salary_tax_deducted,
        bonus = EXCLUDED.bonus,
        bonus_tax_deducted = EXCLUDED.bonus_tax_deducted,
        house_rent_allowance = EXCLUDED.house_rent_allowance,
        house_rent_allowance_tax_deducted = EXCLUDED.house_rent_allowance_tax_deducted,
        medical_allowance = EXCLUDED.medical_allowance,
        medical_allowance_tax_deducted = EXCLUDED.medical_allowance_tax_deducted,
        conveyance_allowance = EXCLUDED.conveyance_allowance,
        conveyance_allowance_tax_deducted = EXCLUDED.conveyance_allowance_tax_deducted,
        utilities_allowance = EXCLUDED.utilities_allowance,
        utilities_allowance_tax_deducted = EXCLUDED.utilities_allowance_tax_deducted,
        other_allowances = EXCLUDED.other_allowances,
        other_allowances_tax_deducted = EXCLUDED.other_allowances_tax_deducted,
        updated_at = CURRENT_TIMESTAMP
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      incomeData.monthly_salary, incomeData.monthly_salary_tax_deducted,
      incomeData.bonus, incomeData.bonus_tax_deducted,
      incomeData.house_rent_allowance, incomeData.house_rent_allowance_tax_deducted,
      incomeData.medical_allowance, incomeData.medical_allowance_tax_deducted,
      incomeData.conveyance_allowance, incomeData.conveyance_allowance_tax_deducted,
      incomeData.utilities_allowance, incomeData.utilities_allowance_tax_deducted,
      incomeData.other_allowances, incomeData.other_allowances_tax_deducted
    ]);

    console.log('✓ Income form populated successfully');

    // ===== WEALTH MODULE =====
    console.log('\n=== PROCESSING WEALTH MODULE ===');

    const wealthSheet = workbook.Sheets['Wealth Statement'];

    // Extract Wealth Statement data (looking for User Input fields)
    const wealthData = {
      // Cash in hand and at bank
      cash_in_hand: parseNum(wealthSheet['D8']?.v),
      cash_at_bank: parseNum(wealthSheet['D9']?.v),

      // Investments
      stock_shares: parseNum(wealthSheet['D12']?.v),
      insurance_policies: parseNum(wealthSheet['D13']?.v),

      // Property
      immovable_property: parseNum(wealthSheet['D16']?.v),
      movable_property: parseNum(wealthSheet['D17']?.v),

      // Loans and Liabilities
      loans_advances_given: parseNum(wealthSheet['D20']?.v),
      loans_liabilities: parseNum(wealthSheet['D24']?.v)
    };

    console.log('Wealth data extracted:', JSON.stringify(wealthData, null, 2));

    // Insert/Update Wealth Statement
    await client.query(`
      INSERT INTO wealth_statement_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        cash_in_hand, cash_at_bank,
        stock_shares, insurance_policies,
        immovable_property, movable_property,
        loans_advances_given, loans_liabilities
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12
      )
      ON CONFLICT (tax_return_id)
      DO UPDATE SET
        cash_in_hand = EXCLUDED.cash_in_hand,
        cash_at_bank = EXCLUDED.cash_at_bank,
        stock_shares = EXCLUDED.stock_shares,
        insurance_policies = EXCLUDED.insurance_policies,
        immovable_property = EXCLUDED.immovable_property,
        movable_property = EXCLUDED.movable_property,
        loans_advances_given = EXCLUDED.loans_advances_given,
        loans_liabilities = EXCLUDED.loans_liabilities,
        updated_at = CURRENT_TIMESTAMP
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      wealthData.cash_in_hand, wealthData.cash_at_bank,
      wealthData.stock_shares, wealthData.insurance_policies,
      wealthData.immovable_property, wealthData.movable_property,
      wealthData.loans_advances_given, wealthData.loans_liabilities
    ]);

    console.log('✓ Wealth statement populated successfully');

    // Verify the data
    console.log('\n=== VERIFICATION ===');

    const incomeVerify = await client.query(
      `SELECT monthly_salary, bonus, medical_allowance, total_employment_income
       FROM income_forms WHERE tax_return_id = $1`,
      [taxReturnId]
    );

    console.log('Income form data:', incomeVerify.rows[0]);

    const wealthVerify = await client.query(
      `SELECT cash_in_hand, cash_at_bank, immovable_property, total_assets
       FROM wealth_statement_forms WHERE tax_return_id = $1`,
      [taxReturnId]
    );

    console.log('Wealth statement data:', wealthVerify.rows[0]);

    await client.query('COMMIT');
    console.log('\n✅ ALL DATA POPULATED SUCCESSFULLY FOR KHURRAMJ');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

extractAndPopulate().catch(console.error);