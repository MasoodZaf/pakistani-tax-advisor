const { pool } = require('./src/config/database');

// Simple realistic scenarios with just basic data
const scenarios = [
  {
    email: 'test@example.com',
    name: 'Test User',
    scenario: 'Bank Employee',
    monthly_salary: 100000, // 1.2M annually
    bonus: 200000,
    tax_deducted: 95000
  },
  {
    email: 'dr.ahmed.hassan@comsats.edu.pk',
    name: 'Dr. Ahmed Hassan',
    scenario: 'University Professor',
    monthly_salary: 67000, // 800K annually
    bonus: 0,
    other_taxable: 400000, // Consultancy
    tax_deducted: 45000
  },
  {
    email: 'hassan.ali@techsol.com.pk',
    name: 'Hassan Ali Khan',
    scenario: 'IT Professional',
    monthly_salary: 125000, // 1.5M annually
    bonus: 100000,
    other_taxable: 300000, // Freelancing
    tax_deducted: 125000
  },
  {
    email: 'fatima.malik@abl.com.pk',
    name: 'Fatima Malik',
    scenario: 'Bank Manager',
    monthly_salary: 167000, // 2M annually
    bonus: 300000,
    other_sources: 225000, // Investments
    tax_deducted: 180000
  },
  {
    email: 'muhammad.tariq@globaltrading.pk',
    name: 'Muhammad Tariq',
    scenario: 'Business Owner',
    monthly_salary: 0,
    other_taxable: 3000000, // Business income
    other_sources: 480000, // Rental
    advance_tax: 280000
  },
  {
    email: 'ali.raza@nestle.com.pk',
    name: 'Ali Raza',
    scenario: 'Senior Executive',
    monthly_salary: 208000, // 2.5M annually
    bonus: 500000,
    other_sources: 200000, // Stock options
    tax_deducted: 280000
  }
];

async function populateSimpleData() {
  try {
    console.log('🚀 Starting simple tax data population...\n');
    
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
        
        // 1. POPULATE INCOME FORM (only basic fields) - Delete existing first
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
          scenario.tax_deducted || 0,
          scenario.advance_tax || 0,
          scenario.other_sources || 0
        ]);
        
        // 2. ADD SOME DEDUCTIONS - Delete existing first
        const zakat = Math.round(((scenario.monthly_salary * 12) + (scenario.bonus || 0)) * 0.025); // 2.5%
        await pool.query('DELETE FROM deductions_forms WHERE tax_return_id = $1', [taxReturnId]);
        
        await pool.query(`
          INSERT INTO deductions_forms (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            zakat, advance_tax, other_deductions, total_deductions, is_complete
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          zakat,
          scenario.advance_tax || 0,
          15000, // Other deductions
          zakat + (scenario.advance_tax || 0) + 15000
        ]);
        
        // 3. UPDATE COMPLETION STATUS - Delete existing first
        await pool.query('DELETE FROM form_completion_status WHERE tax_return_id = $1', [taxReturnId]);
        
        await pool.query(`
          INSERT INTO form_completion_status (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            completion_percentage
          ) VALUES ($1, $2, $3, $4, $5, 75)
        `, [taxReturnId, userId, scenario.email, taxYearId, taxYear]);
        
        // 4. CREATE TAX CALCULATION
        const grossIncome = (scenario.monthly_salary * 12) + (scenario.bonus || 0) + (scenario.other_taxable || 0) + (scenario.other_sources || 0);
        const totalDeductions = zakat + (scenario.advance_tax || 0) + 15000;
        const taxableIncome = Math.max(0, grossIncome - totalDeductions);
        
        // Simple progressive tax calculation for Pakistan
        let incomeTax = 0;
        if (taxableIncome > 600000) {
          if (taxableIncome <= 1200000) {
            incomeTax = (taxableIncome - 600000) * 0.025; // 2.5%
          } else if (taxableIncome <= 2400000) {
            incomeTax = 600000 * 0.025 + (taxableIncome - 1200000) * 0.125; // 12.5%
          } else if (taxableIncome <= 3600000) {
            incomeTax = 600000 * 0.025 + 1200000 * 0.125 + (taxableIncome - 2400000) * 0.20; // 20%
          } else if (taxableIncome <= 6000000) {
            incomeTax = 600000 * 0.025 + 1200000 * 0.125 + 1200000 * 0.20 + (taxableIncome - 3600000) * 0.25; // 25%
          } else {
            incomeTax = 600000 * 0.025 + 1200000 * 0.125 + 1200000 * 0.20 + 2400000 * 0.25 + (taxableIncome - 6000000) * 0.35; // 35%
          }
        }
        
        const taxPaid = (scenario.tax_deducted || 0) + (scenario.advance_tax || 0);
        const totalTaxLiability = Math.round(incomeTax);
        
        // Delete existing tax calculations first
        await pool.query('DELETE FROM tax_calculations WHERE tax_return_id = $1 AND is_final = false', [taxReturnId]);
        
        await pool.query(`
          INSERT INTO tax_calculations (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            gross_income, total_deductions, taxable_income,
            total_tax_liability, tax_already_paid, refund_due, additional_tax_due,
            is_final, calculation_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW())
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          grossIncome,
          totalDeductions,
          taxableIncome,
          totalTaxLiability,
          taxPaid,
          Math.max(0, taxPaid - totalTaxLiability), // Refund due
          Math.max(0, totalTaxLiability - taxPaid)  // Additional tax due
        ]);
        
        console.log(`   ✅ Success! Income: Rs. ${grossIncome.toLocaleString()}, Tax: Rs. ${totalTaxLiability.toLocaleString()}`);
        console.log(`   📊 Status: ${taxPaid >= totalTaxLiability ? 'Refund Due' : 'Additional Tax Due'}: Rs. ${Math.abs(totalTaxLiability - taxPaid).toLocaleString()}\n`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
    
    // Summary
    const summary = await pool.query(`
      SELECT 
        COUNT(*) as total_returns,
        AVG(completion_percentage) as avg_completion
      FROM form_completion_status fcs
      JOIN tax_returns tr ON fcs.tax_return_id = tr.id
      WHERE tr.tax_year = $1
    `, [taxYear]);
    
    const taxSummary = await pool.query(`
      SELECT 
        COUNT(*) as total_calculations,
        SUM(total_tax_liability) as total_tax_liability,
        SUM(refund_due) as total_refunds,
        SUM(additional_tax_due) as total_additional_tax
      FROM tax_calculations tc
      JOIN tax_returns tr ON tc.tax_return_id = tr.id
      WHERE tr.tax_year = $1 AND tc.is_final = false
    `, [taxYear]);
    
    console.log('🎉 Tax data population completed!\n');
    console.log('📊 SUMMARY:');
    console.log(`   Tax Returns: ${summary.rows[0].total_returns}`);
    console.log(`   Average Completion: ${Math.round(summary.rows[0].avg_completion)}%`);
    console.log(`   Tax Calculations: ${taxSummary.rows[0].total_calculations}`);
    console.log(`   Total Tax Liability: Rs. ${parseInt(taxSummary.rows[0].total_tax_liability || 0).toLocaleString()}`);
    console.log(`   Total Refunds Due: Rs. ${parseInt(taxSummary.rows[0].total_refunds || 0).toLocaleString()}`);
    console.log(`   Total Additional Tax: Rs. ${parseInt(taxSummary.rows[0].total_additional_tax || 0).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the population
populateSimpleData().catch(console.error);