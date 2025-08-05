// Script to populate the database with comprehensive test scenarios
const fs = require('fs');
const path = require('path');
const { pool } = require('./backend/src/config/database');

async function executeSQL(filename) {
  try {
    console.log(`📁 Reading SQL file: ${filename}`);
    const sqlPath = path.join(__dirname, 'database', filename);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log(`⚡ Executing SQL script: ${filename}`);
    const result = await pool.query(sql);
    
    console.log(`✅ Successfully executed: ${filename}`);
    return result;
  } catch (error) {
    console.error(`❌ Error executing ${filename}:`, error.message);
    throw error;
  }
}

async function populateTestData() {
  console.log('🚀 STARTING DATABASE POPULATION WITH 10 COMPREHENSIVE SCENARIOS');
  console.log('='.repeat(70));
  
  try {
    // First, execute the main comprehensive scenarios script
    console.log('\n📊 Step 1: Creating comprehensive test scenarios...');
    await executeSQL('insert-10-comprehensive-scenarios.sql');
    
    // Then, execute the remaining scenarios script  
    console.log('\n📊 Step 2: Adding remaining scenarios (6-10)...');
    await executeSQL('complete-remaining-scenarios.sql');
    
    // Verify the data was inserted
    console.log('\n🔍 Step 3: Verifying data insertion...');
    
    const userCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE cnic LIKE '%-1111%-%'
    `);
    
    const returnCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM tax_returns 
      WHERE return_number LIKE 'TR-2025-S%'
    `);
    
    const incomeFormsCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM income_forms 
      WHERE tax_year = '2025-26' 
      AND user_email LIKE '%@%'
    `);
    
    console.log('\n📋 VERIFICATION RESULTS:');
    console.log(`👥 Test Users Created: ${userCount.rows[0].count}`);
    console.log(`📄 Tax Returns Created: ${returnCount.rows[0].count}`);
    console.log(`💰 Income Forms Created: ${incomeFormsCount.rows[0].count}`);
    
    // Show a sample of created data
    console.log('\n📝 SAMPLE DATA PREVIEW:');
    const sampleData = await pool.query(`
      SELECT 
        u.name,
        u.cnic,
        u.email,
        tr.return_number,
        COALESCE(inf.monthly_salary * 12, 0) as annual_salary,
        inf.total_taxable_income
      FROM users u
      JOIN tax_returns tr ON u.id = tr.user_id
      LEFT JOIN income_forms inf ON tr.id = inf.tax_return_id
      WHERE u.cnic LIKE '%-1111%-%'
      ORDER BY inf.total_taxable_income
      LIMIT 5
    `);
    
    sampleData.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name} (${row.cnic})`);
      console.log(`   📧 ${row.email}`);
      console.log(`   📋 Return: ${row.return_number}`);
      console.log(`   💰 Annual Salary: PKR ${row.annual_salary?.toLocaleString() || 'N/A'}`);
      console.log(`   💸 Taxable Income: PKR ${row.total_taxable_income?.toLocaleString() || 'N/A'}`);
      console.log('');
    });
    
    console.log('🎉 DATABASE POPULATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('💥 FATAL ERROR during database population:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed.');
  }
}

// Execute if run directly
if (require.main === module) {
  populateTestData()
    .then(() => {
      console.log('✨ All test data has been successfully populated!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Population failed:', error);
      process.exit(1);
    });
}

module.exports = { populateTestData };