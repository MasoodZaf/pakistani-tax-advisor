const { pool } = require('./src/config/database');

// Realistic Pakistani Tax Scenarios for 2025-26
const taxScenarios = [
  {
    email: 'test@example.com',
    name: 'Test User',
    scenario: 'Salaried Employee - Banking Sector',
    income: {
      salary_income: 1200000, // 1.2M annually
      bonus: 200000,
      overtime: 50000,
      employer: 'Allied Bank Limited',
      tax_deducted: 95000
    },
    deductions: {
      zakat_paid: 30000,
      life_insurance: 25000,
      medical_expenses: 15000
    },
    expectedTax: 125000
  },
  
  {
    email: 'dr.ahmed.hassan@comsats.edu.pk',
    name: 'Dr. Ahmed Hassan',
    scenario: 'University Professor with Consultancy',
    income: {
      salary_income: 800000,
      professional_income: 400000, // Consultancy
      employer: 'COMSATS University',
      tax_deducted: 45000
    },
    deductions: {
      zakat_paid: 30000,
      research_expenses: 20000,
      professional_development: 15000
    },
    expenses: {
      office_rent: 60000,
      utilities: 24000,
      professional_fees: 10000
    },
    expectedTax: 180000
  },
  
  {
    email: 'hassan.ali@techsol.com.pk',
    name: 'Hassan Ali Khan',
    scenario: 'IT Professional with Freelancing',
    income: {
      salary_income: 1500000,
      freelance_income: 300000,
      employer: 'TechSol Pakistan',
      tax_deducted: 125000
    },
    deductions: {
      zakat_paid: 45000,
      life_insurance: 30000,
      health_insurance: 20000
    },
    expenses: {
      home_office: 36000,
      internet_utilities: 18000,
      equipment: 25000
    },
    expectedTax: 220000
  },
  
  {
    email: 'fatima.malik@abl.com.pk',
    name: 'Fatima Malik',
    scenario: 'Bank Manager with Investment Income',
    income: {
      salary_income: 2000000,
      dividend_income: 150000,
      bank_profit: 75000,
      employer: 'Allied Bank Limited',
      tax_deducted: 180000
    },
    deductions: {
      zakat_paid: 55000,
      life_insurance: 50000,
      children_education: 100000
    },
    wealth: {
      bank_balance: 500000,
      investments: 1200000,
      property_value: 8000000
    },
    expectedTax: 350000
  },
  
  {
    email: 'muhammad.tariq@globaltrading.pk',
    name: 'Muhammad Tariq',
    scenario: 'Business Owner - Trading Company',
    income: {
      business_income: 3000000,
      rental_income: 480000,
      company: 'Global Trading (Pvt) Ltd',
      advance_tax_paid: 280000
    },
    expenses: {
      office_rent: 240000,
      staff_salaries: 600000,
      utilities: 120000,
      fuel_transport: 180000,
      marketing: 80000
    },
    deductions: {
      zakat_paid: 85000,
      charity: 50000,
      business_insurance: 40000
    },
    wealth: {
      business_assets: 5000000,
      property_value: 12000000,
      vehicles: 2500000
    },
    expectedTax: 650000
  },
  
  {
    email: 'ali.raza@nestle.com.pk',
    name: 'Ali Raza',
    scenario: 'Senior Executive - Multinational Company',
    income: {
      salary_income: 2500000,
      bonus: 500000,
      stock_options: 200000,
      employer: 'Nestlé Pakistan',
      tax_deducted: 280000
    },
    deductions: {
      zakat_paid: 80000,
      life_insurance: 75000,
      health_insurance: 40000,
      provident_fund: 300000
    },
    wealth: {
      bank_balance: 800000,
      investments: 2000000,
      property_value: 15000000
    },
    expectedTax: 480000
  },
  
  {
    email: 'sara.khan@consultants.pk',
    name: 'Sara Khan',
    scenario: 'Independent Consultant - Professional Services',
    income: {
      professional_income: 1800000,
      training_income: 300000,
      advance_tax_paid: 180000
    },
    expenses: {
      office_rent: 180000,
      travel_expenses: 120000,
      professional_development: 60000,
      marketing: 45000,
      utilities: 36000
    },
    deductions: {
      zakat_paid: 52000,
      life_insurance: 35000,
      medical_expenses: 25000
    },
    expectedTax: 320000
  },
  
  {
    email: 'imran.shah@ktrade.com.pk',
    name: 'Imran Shah',
    scenario: 'Commodity Trader with Capital Gains',
    income: {
      business_income: 2200000,
      capital_gains: 800000, // From securities
      dividend_income: 120000,
      advance_tax_paid: 250000
    },
    capitalGains: {
      securities_gain: 800000,
      property_gain: 0,
      holding_period: 8, // months
      tax_rate: 15 // %
    },
    expenses: {
      trading_costs: 80000,
      office_expenses: 150000,
      communication: 24000
    },
    deductions: {
      zakat_paid: 78000,
      business_insurance: 30000
    },
    wealth: {
      securities_portfolio: 3500000,
      property_value: 10000000
    },
    expectedTax: 580000
  }
];

async function populateTaxData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting comprehensive tax data population...\n');
    
    // Get current tax year
    const taxYearResult = await client.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }
    
    const { id: taxYearId, tax_year: taxYear } = taxYearResult.rows[0];
    console.log(`📅 Using tax year: ${taxYear} (${taxYearId})\n`);
    
    for (const scenario of taxScenarios) {
      console.log(`👤 Processing: ${scenario.name} (${scenario.email})`);
      console.log(`   Scenario: ${scenario.scenario}`);
      
      await client.query('BEGIN');
      
      try {
        // Get user ID
        const userResult = await client.query(`
          SELECT id FROM users WHERE email = $1
        `, [scenario.email]);
        
        if (userResult.rows.length === 0) {
          console.log(`   ⚠️  User not found, skipping...\n`);
          continue;
        }
        
        const userId = userResult.rows[0].id;
        
        // Get or create tax return
        let taxReturnResult = await client.query(`
          SELECT id FROM tax_returns 
          WHERE user_id = $1 AND tax_year_id = $2
        `, [userId, taxYearId]);
        
        let taxReturnId;
        if (taxReturnResult.rows.length === 0) {
          // Create tax return
          const newReturnResult = await client.query(`
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
        
        // 1. INCOME FORM (using actual schema)
        const monthlySalary = Math.round((scenario.income.salary_income || 0) / 12);
        const totalGrossIncome = (scenario.income.salary_income || 0) + (scenario.income.bonus || 0) + 
                                (scenario.income.freelance_income || 0) + (scenario.income.business_income || 0) + 
                                (scenario.income.rental_income || 0) + (scenario.income.dividend_income || 0) +
                                (scenario.income.bank_profit || 0) + (scenario.income.capital_gains || 0);
        
        await client.query(`
          INSERT INTO income_forms (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            monthly_salary, bonus, car_allowance, other_taxable,
            salary_tax_deducted, additional_tax_deducted, medical_allowance,
            employer_contribution, other_exempt, other_sources,
            total_gross_income, total_exempt_income, total_taxable_income, is_complete
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true)
          ON CONFLICT (tax_return_id) DO UPDATE SET
            monthly_salary = EXCLUDED.monthly_salary,
            bonus = EXCLUDED.bonus,
            car_allowance = EXCLUDED.car_allowance,
            other_taxable = EXCLUDED.other_taxable,
            salary_tax_deducted = EXCLUDED.salary_tax_deducted,
            additional_tax_deducted = EXCLUDED.additional_tax_deducted,
            medical_allowance = EXCLUDED.medical_allowance,
            employer_contribution = EXCLUDED.employer_contribution,
            other_exempt = EXCLUDED.other_exempt,
            other_sources = EXCLUDED.other_sources,
            total_gross_income = EXCLUDED.total_gross_income,
            total_exempt_income = EXCLUDED.total_exempt_income,
            total_taxable_income = EXCLUDED.total_taxable_income,
            is_complete = true,
            updated_at = NOW()
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          monthlySalary,
          scenario.income.bonus || 0,
          scenario.income.overtime || 0, // Using car_allowance field for overtime
          (scenario.income.freelance_income || 0) + (scenario.income.business_income || 0) + 
          (scenario.income.rental_income || 0), // other_taxable
          scenario.income.tax_deducted || 0,
          scenario.income.advance_tax_paid || 0,
          0, // medical_allowance
          0, // employer_contribution
          0, // other_exempt
          (scenario.income.dividend_income || 0) + (scenario.income.bank_profit || 0) + 
          (scenario.income.capital_gains || 0), // other_sources
          totalGrossIncome,
          0, // total_exempt_income
          totalGrossIncome
        ]);
        
        // 2. DEDUCTIONS FORM (using actual schema)
        if (scenario.deductions) {
          const totalDeductions = (scenario.deductions.zakat_paid || 0) + 
                                 (scenario.deductions.life_insurance || scenario.deductions.business_insurance || 0) + 
                                 (scenario.deductions.medical_expenses || 0) + 
                                 (scenario.deductions.children_education || scenario.deductions.research_expenses || scenario.deductions.professional_development || 0) +
                                 (scenario.deductions.charity || 0) +
                                 (scenario.deductions.health_insurance || scenario.deductions.provident_fund || 0);
                                 
          await client.query(`
            INSERT INTO deductions_forms (
              tax_return_id, user_id, user_email, tax_year_id, tax_year,
              zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions, total_deductions, is_complete
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
            ON CONFLICT (tax_return_id) DO UPDATE SET
              zakat = EXCLUDED.zakat,
              ushr = EXCLUDED.ushr,
              tax_paid_foreign_country = EXCLUDED.tax_paid_foreign_country,
              advance_tax = EXCLUDED.advance_tax,
              other_deductions = EXCLUDED.other_deductions,
              total_deductions = EXCLUDED.total_deductions,
              is_complete = true,
              updated_at = NOW()
          `, [
            taxReturnId, userId, scenario.email, taxYearId, taxYear,
            scenario.deductions.zakat_paid || 0,
            0, // ushr
            0, // tax_paid_foreign_country
            scenario.income.advance_tax_paid || 0,
            totalDeductions - (scenario.deductions.zakat_paid || 0) - (scenario.income.advance_tax_paid || 0),
            totalDeductions
          ]);
        }
        
        // Skip other forms for now - focus on income and deductions first
        // This will give us enough data to see meaningful tax calculations
        
        // 6. UPDATE COMPLETION STATUS (simplified)
        const completionPercentage = scenario.deductions ? 80 : 50;
        
        await client.query(`
          INSERT INTO form_completion_status (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            completion_percentage
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (tax_return_id) DO UPDATE SET
            completion_percentage = $6,
            updated_at = NOW()
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          completionPercentage
        ]);
        
        // 7. CREATE PRELIMINARY TAX CALCULATION (simplified)
        const grossIncome = totalGrossIncome;
        const totalDeductionsAmount = scenario.deductions ? 
          Object.values(scenario.deductions).reduce((sum, val) => sum + (val || 0), 0) : 0;
        const taxableIncome = Math.max(0, grossIncome - totalDeductionsAmount);
        const taxPaid = (scenario.income.tax_deducted || 0) + (scenario.income.advance_tax_paid || 0);
        
        await client.query(`
          INSERT INTO tax_calculations (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            gross_income, total_deductions, taxable_income,
            total_tax_liability, tax_already_paid, refund_due, additional_tax_due,
            is_final, calculation_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW())
          ON CONFLICT (tax_return_id, is_final) DO UPDATE SET
            gross_income = EXCLUDED.gross_income,
            total_deductions = EXCLUDED.total_deductions,
            taxable_income = EXCLUDED.taxable_income,
            total_tax_liability = EXCLUDED.total_tax_liability,
            tax_already_paid = EXCLUDED.tax_already_paid,
            refund_due = EXCLUDED.refund_due,
            additional_tax_due = EXCLUDED.additional_tax_due,
            calculation_date = NOW()
        `, [
          taxReturnId, userId, scenario.email, taxYearId, taxYear,
          grossIncome,
          totalDeductionsAmount,
          taxableIncome,
          scenario.expectedTax,
          taxPaid,
          Math.max(0, taxPaid - scenario.expectedTax), // Refund due
          Math.max(0, scenario.expectedTax - taxPaid)  // Additional tax due
        ]);
        
        await client.query('COMMIT');
        console.log(`   ✅ Successfully populated data`);
        console.log(`   💰 Expected Tax: Rs. ${scenario.expectedTax.toLocaleString()}\n`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
    
    console.log('🎉 Tax data population completed!\n');
    
    // Summary
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_returns,
        AVG(completion_percentage) as avg_completion,
        SUM(CASE WHEN completion_percentage = 100 THEN 1 ELSE 0 END) as completed_returns
      FROM form_completion_status fcs
      JOIN tax_returns tr ON fcs.tax_return_id = tr.id
      WHERE tr.tax_year = $1
    `, [taxYear]);
    
    const taxSummary = await client.query(`
      SELECT 
        COUNT(*) as total_calculations,
        SUM(total_tax_liability) as total_tax_liability,
        AVG(total_tax_liability) as avg_tax_liability
      FROM tax_calculations tc
      JOIN tax_returns tr ON tc.tax_return_id = tr.id
      WHERE tr.tax_year = $1 AND tc.is_final = false
    `, [taxYear]);
    
    console.log('📊 SUMMARY:');
    console.log(`   Tax Returns: ${summary.rows[0].total_returns}`);
    console.log(`   Completed: ${summary.rows[0].completed_returns}`);
    console.log(`   Average Completion: ${Math.round(summary.rows[0].avg_completion)}%`);
    console.log(`   Total Tax Calculations: ${taxSummary.rows[0].total_calculations}`);
    console.log(`   Total Tax Liability: Rs. ${parseInt(taxSummary.rows[0].total_tax_liability || 0).toLocaleString()}`);
    console.log(`   Average Tax per Return: Rs. ${Math.round(taxSummary.rows[0].avg_tax_liability || 0).toLocaleString()}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Fatal error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the population
populateTaxData().catch(console.error);