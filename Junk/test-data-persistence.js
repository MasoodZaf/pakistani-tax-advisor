const { pool } = require('./src/config/database');

console.log('=== Testing Data Persistence and Retrieval ===\n');

async function testDataPersistence() {
  try {
    // Test 1: Check if existing data is properly stored as numeric
    console.log('Test 1: Verify existing data storage format');
    const sampleData = await pool.query(`
      SELECT
        monthly_salary,
        bonus,
        car_allowance,
        pg_typeof(monthly_salary) as salary_type,
        pg_typeof(bonus) as bonus_type
      FROM income_forms
      LIMIT 1
    `);

    if (sampleData.rows.length > 0) {
      const row = sampleData.rows[0];
      console.log('Sample income data from database:');
      console.log(`Monthly Salary: ${row.monthly_salary} (Type: ${row.salary_type})`);
      console.log(`Bonus: ${row.bonus} (Type: ${row.bonus_type})`);
      console.log(`Car Allowance: ${row.car_allowance}`);

      // Test calculation directly from database values
      const totalFromDB = parseFloat(row.monthly_salary || 0) + parseFloat(row.bonus || 0) + parseFloat(row.car_allowance || 0);
      console.log(`Total calculation: ${totalFromDB}`);
      console.log(`Is total a valid number: ${!isNaN(totalFromDB)}`);
    } else {
      console.log('No sample data found in income_forms table');
    }

    console.log();

    // Test 2: Test the fixed SQL calculation from reports
    console.log('Test 2: Verify fixed SQL calculations in reports');
    const sqlCalcTest = await pool.query(`
      SELECT
        monthly_salary,
        bonus,
        car_allowance,
        (COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0)) as calculated_total,
        pg_typeof((COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0))) as total_type
      FROM income_forms
      WHERE monthly_salary IS NOT NULL OR bonus IS NOT NULL
      LIMIT 3
    `);

    console.log('SQL-calculated totals:');
    sqlCalcTest.rows.forEach((row, index) => {
      console.log(`Row ${index + 1}:`);
      console.log(`  Salary: ${row.monthly_salary}, Bonus: ${row.bonus}, Car: ${row.car_allowance}`);
      console.log(`  SQL Total: ${row.calculated_total} (Type: ${row.total_type})`);

      // Verify it's numeric
      const jsTotal = parseFloat(row.monthly_salary || 0) + parseFloat(row.bonus || 0) + parseFloat(row.car_allowance || 0);
      console.log(`  JS Total: ${jsTotal}`);
      console.log(`  Match: ${Math.abs(parseFloat(row.calculated_total) - jsTotal) < 0.01}`);
      console.log();
    });

    // Test 3: Test data insertion with mixed types
    console.log('Test 3: Test data insertion and retrieval');

    const testUserId = '550e8400-e29b-41d4-a716-446655440000'; // Test UUID
    const testTaxReturnId = '550e8400-e29b-41d4-a716-446655440001'; // Test UUID

    // Clean up any existing test data
    await pool.query('DELETE FROM income_forms WHERE user_id = $1', [testUserId]);

    // Insert test data with mixed types (simulating frontend input)
    const insertResult = await pool.query(`
      INSERT INTO income_forms (
        user_id, tax_return_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      testUserId,
      testTaxReturnId,
      'test@example.com',
      '229805e2-9e8c-458e-97d0-b5f92e5693f1',
      '2023',
      '150000.50',  // String with decimal
      75000,        // Number
      '25000',      // String
      null          // Null value
    ]);

    console.log('Inserted test record:');
    const inserted = insertResult.rows[0];
    console.log(`Monthly Salary: ${inserted.monthly_salary} (${typeof inserted.monthly_salary})`);
    console.log(`Bonus: ${inserted.bonus} (${typeof inserted.bonus})`);
    console.log(`Car Allowance: ${inserted.car_allowance} (${typeof inserted.car_allowance})`);
    console.log(`Other Taxable: ${inserted.other_taxable} (${typeof inserted.other_taxable})`);

    // Test retrieval and calculation
    const retrievedData = await pool.query(`
      SELECT
        monthly_salary, bonus, car_allowance, other_taxable,
        (COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) +
         COALESCE(car_allowance::numeric, 0) + COALESCE(other_taxable::numeric, 0)) as total
      FROM income_forms
      WHERE user_id = $1
    `, [testUserId]);

    const retrieved = retrievedData.rows[0];
    console.log();
    console.log('Retrieved and calculated:');
    console.log(`Individual values: ${retrieved.monthly_salary}, ${retrieved.bonus}, ${retrieved.car_allowance}, ${retrieved.other_taxable}`);
    console.log(`SQL-calculated total: ${retrieved.total}`);

    // Verify with JavaScript calculation
    const jsCalculatedTotal = (parseFloat(retrieved.monthly_salary) || 0) +
                            (parseFloat(retrieved.bonus) || 0) +
                            (parseFloat(retrieved.car_allowance) || 0) +
                            (parseFloat(retrieved.other_taxable) || 0);
    console.log(`JS-calculated total: ${jsCalculatedTotal}`);
    console.log(`Calculation matches: ${Math.abs(parseFloat(retrieved.total) - jsCalculatedTotal) < 0.01}`);

    // Clean up test data
    await pool.query('DELETE FROM income_forms WHERE user_id = $1', [testUserId]);
    console.log();
    console.log('Test data cleaned up successfully');

    console.log('\\n=== Data Persistence Tests Completed Successfully ===');

  } catch (error) {
    console.error('Data persistence test error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testDataPersistence();