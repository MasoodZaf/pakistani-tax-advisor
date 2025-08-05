const { pool } = require('./src/config/database');

// Simple scenarios with just basic data that works
const scenarios = [
  {
    email: 'test@example.com',
    name: 'Test User',
    scenario: 'Bank Employee',
    monthly_salary: 100000, // 1.2M annually
    bonus: 200000,
    salary_tax_deducted: 95000
  },
  {
    email: 'dr.ahmed.hassan@comsats.edu.pk',
    name: 'Dr. Ahmed Hassan',
    scenario: 'University Professor',
    monthly_salary: 67000, // 800K annually
    other_taxable: 400000, // Consultancy
    salary_tax_deducted: 45000
  },
  {
    email: 'hassan.ali@techsol.com.pk',
    name: 'Hassan Ali Khan',
    scenario: 'IT Professional',
    monthly_salary: 125000, // 1.5M annually
    bonus: 100000,
    other_taxable: 300000, // Freelancing
    salary_tax_deducted: 125000
  },
  {
    email: 'fatima.malik@abl.com.pk',
    name: 'Fatima Malik',
    scenario: 'Bank Manager',
    monthly_salary: 167000, // 2M annually
    bonus: 300000,
    other_sources: 225000, // Investments
    salary_tax_deducted: 180000
  },
  {
    email: 'muhammad.tariq@globaltrading.pk',
    name: 'Muhammad Tariq',
    scenario: 'Business Owner',
    other_taxable: 3000000, // Business income
    other_sources: 480000, // Rental
    additional_tax_deducted: 280000
  },
  {
    email: 'ali.raza@nestle.com.pk',
    name: 'Ali Raza',
    scenario: 'Senior Executive',
    monthly_salary: 208000, // 2.5M annually
    bonus: 500000,
    other_sources: 200000, // Stock options
    salary_tax_deducted: 280000
  }
];

async function populateBasicData() {
  try {
    console.log('🚀 Starting basic tax data population...\n');
    
    // Get current tax year
    const taxYearResult = await pool.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }
    
    const { id: taxYearId, tax_year: taxYear } = taxYearResult.rows[0];
    console.log(`📅 Using tax year: ${taxYear}\n`);
    
    for (const scenario of scenarios) {
      console.log(`👤 Processing: ${scenario.name}`);
      console.log(`   Email: ${scenario.email}`);
      console.log(`   Scenario: ${scenario.scenario}`);
      
      try {
        // Get user ID
        const userResult = await pool.query(`
          SELECT id FROM users WHERE email = $1
        `, [scenario.email]);
        
        if (userResult.rows.length === 0) {
          console.log(`   ⚠️  User not found, skipping...\n`);
          continue;
        }
        
        const userId = userResult.rows[0].id;
        
        // Get or create tax return
        let taxReturnResult = await pool.query(`
          SELECT id FROM tax_returns 
          WHERE user_id = $1 AND tax_year_id = $2
        `, [userId, taxYearId]);
        
        let taxReturnId;
        if (taxReturnResult.rows.length === 0) {
          // Create tax return
          const newReturnResult = await pool.query(`
            INSERT INTO tax_returns (
              user_id, user_email, tax_year_id, tax_year,
              return_number, filing_status, filing_type
            ) VALUES ($1, $2, $3, $4, $5, 'in_progress', 'normal')
            RETURNING id
          `, [
            userId, scenario.email, taxYearId, taxYear,
            `TR-${userId.slice(0, 8)}-${taxYear}`
          ]);
          taxReturnId = newReturnResult.rows[0].id;
        } else {
          taxReturnId = taxReturnResult.rows[0].id;
        }
        
        // 1. POPULATE INCOME FORM (only working fields)
        await pool.query('DELETE FROM income_forms WHERE tax_return_id = $1', [taxReturnId]);
        
        await pool.query(`
          INSERT INTO income_forms (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            monthly_salary, bonus, other_taxable, salary_tax_deducted, 
            additional_tax_deducted, other_sources, is_complete
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          scenario.monthly_salary || 0,
          scenario.bonus || 0,
          scenario.other_taxable || 0,
          scenario.salary_tax_deducted || 0,
          scenario.additional_tax_deducted || 0,
          scenario.other_sources || 0
        ]);
        
        // 2. ADD BASIC DEDUCTIONS (without computed total)
        const zakat = Math.round(((scenario.monthly_salary || 0) * 12 + (scenario.bonus || 0) + (scenario.other_taxable || 0)) * 0.025); // 2.5%
        await pool.query('DELETE FROM deductions_forms WHERE tax_return_id = $1', [taxReturnId]);
        
        await pool.query(`
          INSERT INTO deductions_forms (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            zakat, advance_tax, other_deductions, is_complete
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          zakat,
          scenario.additional_tax_deducted || 0,
          15000 // Other deductions
        ]);
        
        // 3. UPDATE COMPLETION STATUS
        await pool.query('DELETE FROM form_completion_status WHERE tax_return_id = $1', [taxReturnId]);
        
        await pool.query(`
          INSERT INTO form_completion_status (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            completion_percentage
          ) VALUES ($1, $2, $3, $4, $5, 75)
        `, [taxReturnId, userId, scenario.email, taxYearId, taxYear]);
        
        const annualSalary = (scenario.monthly_salary || 0) * 12;
        const totalIncome = annualSalary + (scenario.bonus || 0) + (scenario.other_taxable || 0) + (scenario.other_sources || 0);
        
        console.log(`   ✅ Success! Annual Income: Rs. ${totalIncome.toLocaleString()}`);
        console.log(`   📊 Monthly Salary: Rs. ${(scenario.monthly_salary || 0).toLocaleString()}, Bonus: Rs. ${(scenario.bonus || 0).toLocaleString()}\n`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
    
    // Summary from what we have
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        AVG(completion_percentage) as avg_completion
      FROM form_completion_status fcs
      JOIN tax_returns tr ON fcs.tax_return_id = tr.id
      WHERE tr.tax_year = $1
    `, [taxYear]);
    
    const incomeData = await pool.query(`
      SELECT 
        COUNT(*) as total_income_forms,
        SUM(monthly_salary * 12) as total_annual_salary,
        SUM(bonus) as total_bonus,
        SUM(other_taxable) as total_other_income,
        SUM(salary_tax_deducted + additional_tax_deducted) as total_tax_deducted
      FROM income_forms if
      JOIN tax_returns tr ON if.tax_return_id = tr.id
      WHERE tr.tax_year = $1
    `, [taxYear]);
    
    console.log('🎉 Basic tax data population completed!\n');
    console.log('📊 SUMMARY:');
    console.log(`   Tax Returns: ${summary.rows[0].total_returns}`);
    console.log(`   Average Completion: ${Math.round(summary.rows[0].avg_completion)}%`);
    console.log(`   Income Forms: ${incomeData.rows[0].total_income_forms}`);
    console.log(`   Total Annual Salary: Rs. ${parseInt(incomeData.rows[0].total_annual_salary || 0).toLocaleString()}`);
    console.log(`   Total Bonus: Rs. ${parseInt(incomeData.rows[0].total_bonus || 0).toLocaleString()}`);
    console.log(`   Total Other Income: Rs. ${parseInt(incomeData.rows[0].total_other_income || 0).toLocaleString()}`);
    console.log(`   Total Tax Deducted: Rs. ${parseInt(incomeData.rows[0].total_tax_deducted || 0).toLocaleString()}`);
    
    console.log('\n✨ Users now have meaningful tax data to view when you impersonate them!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the population
populateBasicData().catch(console.error);