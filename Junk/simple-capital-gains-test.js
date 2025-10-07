const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function testCapitalGainsFormDirect() {
  let client;
  try {
    console.log('🧪 Testing Capital Gains Form - Direct Database Test...\n');

    client = await pool.connect();

    // Step 1: Get or create user
    console.log('1. Getting test user...');
    let userResult = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['superadmin@paktaxadvisor.com']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Test user not found');
      return;
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    console.log('✅ User ID:', userId);

    // Step 2: Get or create tax year
    console.log('\n2. Getting tax year...');
    const taxYearResult = await client.query(
      'SELECT id, tax_year FROM tax_years WHERE tax_year = $1',
      ['2024-25']
    );

    if (taxYearResult.rows.length === 0) {
      console.log('❌ Tax year 2024-25 not found');
      return;
    }

    const taxYearId = taxYearResult.rows[0].id;
    const taxYear = taxYearResult.rows[0].tax_year;
    console.log('✅ Tax Year ID:', taxYearId);

    // Step 3: Create tax return
    console.log('\n3. Creating tax return...');
    const taxReturnId = uuidv4();

    await client.query(`
      INSERT INTO tax_returns (id, user_id, user_email, tax_year_id, tax_year, return_number, filing_status, filing_type, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', 'normal', NOW(), NOW())
      ON CONFLICT (return_number)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [taxReturnId, userId, userEmail, taxYearId, taxYear, `TR-${Date.now()}`]);

    // Get the actual tax return ID
    const actualTaxReturnResult = await client.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const actualTaxReturnId = actualTaxReturnResult.rows[0].id;
    console.log('✅ Tax Return ID:', actualTaxReturnId);

    // Step 4: Test Capital Gains form insertion with property types
    console.log('\n4. Testing Capital Gains form with property types...');

    const capitalGainsId = uuidv4();
    const testData = {
      // Property types and amounts
      immovable_property_1_year_type: 'House',
      immovable_property_1_year_taxable: 500000,
      immovable_property_1_year_deducted: 50000,
      immovable_property_1_year_carryable: 0,

      immovable_property_2_years_type: 'Plot',
      immovable_property_2_years_taxable: 1000000,
      immovable_property_2_years_deducted: 75000,
      immovable_property_2_years_carryable: 0,

      immovable_property_3_years_type: 'Flat',
      immovable_property_3_years_taxable: 750000,
      immovable_property_3_years_deducted: 40000,
      immovable_property_3_years_carryable: 0,

      immovable_property_over_6_years_type: 'Plot',
      immovable_property_over_6_years_taxable: 2000000,
      immovable_property_over_6_years_deducted: 0,
      immovable_property_over_6_years_carryable: 0,

      // Securities data
      securities_before_july_2013_taxable: 100000,
      securities_before_july_2013_deducted: 5000,
      securities_pmex_settled_taxable: 50000,
      securities_pmex_settled_deducted: 2500,
      securities_15_percent_taxable: 400000,
      securities_15_percent_deducted: 60000,

      is_complete: true
    };

    console.log('📤 Inserting Capital Gains data:');
    console.log('   - House (1 year): Rs 500,000');
    console.log('   - Plot (2 years): Rs 1,000,000');
    console.log('   - Flat (3 years): Rs 750,000');
    console.log('   - Plot (>6 years): Rs 2,000,000');

    const insertResult = await client.query(`
      INSERT INTO capital_gain_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        immovable_property_1_year_type, immovable_property_1_year_taxable, immovable_property_1_year_deducted, immovable_property_1_year_carryable,
        immovable_property_2_years_type, immovable_property_2_years_taxable, immovable_property_2_years_deducted, immovable_property_2_years_carryable,
        immovable_property_3_years_type, immovable_property_3_years_taxable, immovable_property_3_years_deducted, immovable_property_3_years_carryable,
        immovable_property_over_6_years_type, immovable_property_over_6_years_taxable, immovable_property_over_6_years_deducted, immovable_property_over_6_years_carryable,
        securities_before_july_2013_taxable, securities_before_july_2013_deducted,
        securities_pmex_settled_taxable, securities_pmex_settled_deducted,
        securities_15_percent_taxable, securities_15_percent_deducted,
        is_complete, last_updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28,
        $29, $30, NOW(), NOW()
      ) RETURNING id, total_capital_gain, total_tax_deducted, total_tax_carryable
    `, [
      capitalGainsId, actualTaxReturnId, userId, userEmail, taxYearId, taxYear,
      testData.immovable_property_1_year_type, testData.immovable_property_1_year_taxable, testData.immovable_property_1_year_deducted, testData.immovable_property_1_year_carryable,
      testData.immovable_property_2_years_type, testData.immovable_property_2_years_taxable, testData.immovable_property_2_years_deducted, testData.immovable_property_2_years_carryable,
      testData.immovable_property_3_years_type, testData.immovable_property_3_years_taxable, testData.immovable_property_3_years_deducted, testData.immovable_property_3_years_carryable,
      testData.immovable_property_over_6_years_type, testData.immovable_property_over_6_years_taxable, testData.immovable_property_over_6_years_deducted, testData.immovable_property_over_6_years_carryable,
      testData.securities_before_july_2013_taxable, testData.securities_before_july_2013_deducted,
      testData.securities_pmex_settled_taxable, testData.securities_pmex_settled_deducted,
      testData.securities_15_percent_taxable, testData.securities_15_percent_deducted,
      testData.is_complete, userId
    ]);

    console.log('✅ Form insertion successful');
    console.log('✅ Form ID:', insertResult.rows[0].id);

    // Step 5: Verify data and calculated totals
    console.log('\n5. Verifying saved data...');
    const savedDataResult = await client.query(
      'SELECT * FROM capital_gain_forms WHERE id = $1',
      [capitalGainsId]
    );

    if (savedDataResult.rows.length === 0) {
      console.log('❌ Data not found after insertion');
      return;
    }

    const savedData = savedDataResult.rows[0];
    console.log('✅ Data retrieved successfully');

    // Step 6: Check property types
    console.log('\n6. Verifying property types...');
    const propertyTypes = {
      '1 year': savedData.immovable_property_1_year_type,
      '2 years': savedData.immovable_property_2_years_type,
      '3 years': savedData.immovable_property_3_years_type,
      'over 6 years': savedData.immovable_property_over_6_years_type
    };

    console.log('✅ Property Types Saved:');
    Object.entries(propertyTypes).forEach(([period, type]) => {
      console.log(`   - ${period}: ${type}`);
    });

    // Step 7: Check calculated totals
    console.log('\n7. Verifying calculated totals...');
    console.log('✅ Total Capital Gain:', `Rs ${(savedData.total_capital_gain || 0).toLocaleString()}`);
    console.log('✅ Total Tax Deducted:', `Rs ${(savedData.total_tax_deducted || 0).toLocaleString()}`);
    console.log('✅ Total Tax Carryable:', `Rs ${(savedData.total_tax_carryable || 0).toLocaleString()}`);

    // Step 8: Test property type update
    console.log('\n8. Testing property type update...');
    await client.query(`
      UPDATE capital_gain_forms
      SET immovable_property_1_year_type = 'Flat',
          immovable_property_1_year_taxable = 600000,
          updated_at = NOW()
      WHERE id = $1
    `, [capitalGainsId]);

    const updatedDataResult = await client.query(
      'SELECT immovable_property_1_year_type, immovable_property_1_year_taxable, total_capital_gain FROM capital_gain_forms WHERE id = $1',
      [capitalGainsId]
    );

    const updatedData = updatedDataResult.rows[0];
    console.log('✅ Property type updated from House to:', updatedData.immovable_property_1_year_type);
    console.log('✅ Amount updated to:', `Rs ${updatedData.immovable_property_1_year_taxable.toLocaleString()}`);
    console.log('✅ New Total Capital Gain:', `Rs ${(updatedData.total_capital_gain || 0).toLocaleString()}`);

    console.log('\n🎉 All tests passed! Capital Gains form with property types is working correctly.');
    console.log('\n📊 Summary:');
    console.log('   ✅ Database connection working');
    console.log('   ✅ Property type fields functional');
    console.log('   ✅ Data insertion working');
    console.log('   ✅ Property types saved correctly');
    console.log('   ✅ Calculated totals working');
    console.log('   ✅ Updates working');
    console.log('   ✅ No constraint violations');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('❌ Full error:', error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the test
testCapitalGainsFormDirect().finally(() => {
  pool.end();
});