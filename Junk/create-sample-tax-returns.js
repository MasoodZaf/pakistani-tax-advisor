const { pool } = require('./src/config/database');
const bcrypt = require('bcrypt');

console.log('Creating comprehensive tax returns for 3 sample users...\n');

const TAX_YEAR = '2025-26';
const TAX_YEAR_ID = '229805e2-9e8c-458e-97d0-b5f92e5693f1';

// User profiles based on Pakistani tax brackets
const users = [
  {
    name: 'gg',
    email: 'gg@example.com',
    profile: 'HIGH_EARNER',
    description: 'High-income individual in maximum tax bracket (35%)',
    income: {
      monthly_salary: 6000000, // 72M annually - above 4.1M bracket
      bonus: 15000000,
      car_allowance: 2400000,
      other_taxable: 3600000,
      medical_allowance: 600000,  // Exempt
      employer_contribution: 1200000, // Exempt
      other_exempt: 800000,
      other_sources: 5000000
    }
  },
  {
    name: 'Ali Raza',
    email: 'ali.raza@example.com',
    profile: 'MEDIUM_EARNER',
    description: 'Medium-income individual in 20-25% tax brackets',
    income: {
      monthly_salary: 2500000, // 30M annually - in 25% bracket
      bonus: 3000000,
      car_allowance: 600000,
      other_taxable: 1200000,
      medical_allowance: 300000,  // Exempt
      employer_contribution: 400000, // Exempt
      other_exempt: 200000,
      other_sources: 800000
    }
  },
  {
    name: 'Omer Shaikh',
    email: 'omer.shaikh@example.com',
    profile: 'LOW_EARNER',
    description: 'Low-income individual in 0-5% tax brackets',
    income: {
      monthly_salary: 800000, // 9.6M annually - in 5% bracket
      bonus: 500000,
      car_allowance: 200000,
      other_taxable: 300000,
      medical_allowance: 150000,  // Exempt
      employer_contribution: 100000, // Exempt
      other_exempt: 50000,
      other_sources: 200000
    }
  }
];

async function createUsersAndTaxReturns() {
  try {
    console.log('Starting tax return creation process...\n');

    for (const userData of users) {
      console.log(`\n=== Processing ${userData.name} (${userData.profile}) ===`);
      console.log(`Description: ${userData.description}`);

      // 1. Create/update user
      const hashedPassword = await bcrypt.hash('password123', 10);

      const userResult = await pool.query(`
        INSERT INTO users (name, email, password_hash, user_type, role, is_active)
        VALUES ($1, $2, $3, 'filer', 'taxpayer', true)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          user_type = EXCLUDED.user_type,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active
        RETURNING id, name, email
      `, [userData.name, userData.email, hashedPassword]);

      const user = userResult.rows[0];
      console.log(`✅ User created: ${user.name} (${user.email})`);

      // 2. Create tax return with a unique return number
      const returnNumber = `TR-${TAX_YEAR}-${user.name.replace(/\s+/g, '').toUpperCase()}-${Date.now()}`;
      const taxReturnResult = await pool.query(`
        INSERT INTO tax_returns (user_id, user_email, tax_year_id, tax_year, return_number, filing_status)
        VALUES ($1, $2, $3, $4, $5, 'complete')
        ON CONFLICT (return_number) DO UPDATE SET
          filing_status = EXCLUDED.filing_status
        RETURNING id
      `, [user.id, user.email, TAX_YEAR_ID, TAX_YEAR, returnNumber]);

      const taxReturnId = taxReturnResult.rows[0].id;
      console.log(`✅ Tax return created: ${taxReturnId}`);

      // 3. Create comprehensive income form
      await pool.query(`
        INSERT INTO income_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          monthly_salary, bonus, car_allowance, other_taxable,
          medical_allowance, employer_contribution, other_exempt, other_sources,
          is_complete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
        ON CONFLICT (tax_return_id, user_id) DO UPDATE SET
          monthly_salary = EXCLUDED.monthly_salary,
          bonus = EXCLUDED.bonus,
          car_allowance = EXCLUDED.car_allowance,
          other_taxable = EXCLUDED.other_taxable,
          medical_allowance = EXCLUDED.medical_allowance,
          employer_contribution = EXCLUDED.employer_contribution,
          other_exempt = EXCLUDED.other_exempt,
          other_sources = EXCLUDED.other_sources,
          is_complete = EXCLUDED.is_complete
      `, [
        taxReturnId, user.id, user.email, TAX_YEAR_ID, TAX_YEAR,
        userData.income.monthly_salary, userData.income.bonus, userData.income.car_allowance,
        userData.income.other_taxable, userData.income.medical_allowance,
        userData.income.employer_contribution, userData.income.other_exempt, userData.income.other_sources
      ]);

      // 4. Create adjustable tax data (different amounts for different profiles)
      const adjustableTaxData = getAdjustableTaxData(userData.profile);
      await pool.query(`
        INSERT INTO adjustable_tax_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          salary_employees_149_tax_collected,
          electricity_bill_domestic_235_tax_collected,
          telephone_bill_236_1e_tax_collected,
          motor_vehicle_registration_fee_231b1_tax_collected,
          profit_debt_151_15_tax_collected,
          total_adjustable_tax,
          is_complete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        ON CONFLICT (tax_return_id, user_id) DO UPDATE SET
          salary_employees_149_tax_collected = EXCLUDED.salary_employees_149_tax_collected,
          electricity_bill_domestic_235_tax_collected = EXCLUDED.electricity_bill_domestic_235_tax_collected,
          telephone_bill_236_1e_tax_collected = EXCLUDED.telephone_bill_236_1e_tax_collected,
          motor_vehicle_registration_fee_231b1_tax_collected = EXCLUDED.motor_vehicle_registration_fee_231b1_tax_collected,
          profit_debt_151_15_tax_collected = EXCLUDED.profit_debt_151_15_tax_collected,
          total_adjustable_tax = EXCLUDED.total_adjustable_tax,
          is_complete = EXCLUDED.is_complete
      `, [
        taxReturnId, user.id, user.email, TAX_YEAR_ID, TAX_YEAR,
        adjustableTaxData.salary_tax, adjustableTaxData.electricity_tax,
        adjustableTaxData.phone_tax, adjustableTaxData.vehicle_tax,
        adjustableTaxData.profit_debt_tax, adjustableTaxData.total
      ]);

      // 5. Create credits data
      const creditsData = getCreditsData(userData.profile);
      await pool.query(`
        INSERT INTO credits_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          charitable_donation, pension_contribution, life_insurance_premium,
          total_tax_credits, is_complete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        ON CONFLICT (tax_return_id, user_id) DO UPDATE SET
          charitable_donation = EXCLUDED.charitable_donation,
          pension_contribution = EXCLUDED.pension_contribution,
          life_insurance_premium = EXCLUDED.life_insurance_premium,
          total_tax_credits = EXCLUDED.total_tax_credits,
          is_complete = EXCLUDED.is_complete
      `, [
        taxReturnId, user.id, user.email, TAX_YEAR_ID, TAX_YEAR,
        creditsData.charity, creditsData.pension, creditsData.insurance, creditsData.total
      ]);

      // 6. Create deductions data
      const deductionsData = getDeductionsData(userData.profile);
      await pool.query(`
        INSERT INTO deductions_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          professional_expenses_amount, zakat_paid_amount, advance_tax,
          total_deduction_from_income, is_complete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        ON CONFLICT (tax_return_id, user_id) DO UPDATE SET
          professional_expenses_amount = EXCLUDED.professional_expenses_amount,
          zakat_paid_amount = EXCLUDED.zakat_paid_amount,
          advance_tax = EXCLUDED.advance_tax,
          total_deduction_from_income = EXCLUDED.total_deduction_from_income,
          is_complete = EXCLUDED.is_complete
      `, [
        taxReturnId, user.id, user.email, TAX_YEAR_ID, TAX_YEAR,
        deductionsData.professional, deductionsData.zakat, deductionsData.advance, deductionsData.total
      ]);

      // 7. Create capital gains data
      const capitalGainsData = getCapitalGainsData(userData.profile);
      await pool.query(`
        INSERT INTO capital_gain_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          property_1_year, property_2_3_years, securities, other_capital_gains,
          total_capital_gains, is_complete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        ON CONFLICT (tax_return_id, user_id) DO UPDATE SET
          property_1_year = EXCLUDED.property_1_year,
          property_2_3_years = EXCLUDED.property_2_3_years,
          securities = EXCLUDED.securities,
          other_capital_gains = EXCLUDED.other_capital_gains,
          total_capital_gains = EXCLUDED.total_capital_gains,
          is_complete = EXCLUDED.is_complete
      `, [
        taxReturnId, user.id, user.email, TAX_YEAR_ID, TAX_YEAR,
        capitalGainsData.property1yr, capitalGainsData.property23yr,
        capitalGainsData.securities, capitalGainsData.other, capitalGainsData.total
      ]);

      // 8. Create wealth statement
      const wealthData = getWealthData(userData.profile);
      await pool.query(`
        INSERT INTO wealth_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          property_current_year, investment_current_year, vehicle_current_year,
          jewelry_current_year, cash_current_year, bank_balance_current_year,
          total_assets_current_year, loan_current_year, other_liabilities_current_year,
          total_liabilities_current_year, net_worth_current_year, is_complete
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true)
        ON CONFLICT (tax_return_id, user_id) DO UPDATE SET
          property_current_year = EXCLUDED.property_current_year,
          investment_current_year = EXCLUDED.investment_current_year,
          vehicle_current_year = EXCLUDED.vehicle_current_year,
          jewelry_current_year = EXCLUDED.jewelry_current_year,
          cash_current_year = EXCLUDED.cash_current_year,
          bank_balance_current_year = EXCLUDED.bank_balance_current_year,
          total_assets_current_year = EXCLUDED.total_assets_current_year,
          loan_current_year = EXCLUDED.loan_current_year,
          other_liabilities_current_year = EXCLUDED.other_liabilities_current_year,
          total_liabilities_current_year = EXCLUDED.total_liabilities_current_year,
          net_worth_current_year = EXCLUDED.net_worth_current_year,
          is_complete = EXCLUDED.is_complete
      `, [
        taxReturnId, user.id, user.email, TAX_YEAR_ID, TAX_YEAR,
        wealthData.property, wealthData.investment, wealthData.vehicle,
        wealthData.jewelry, wealthData.cash, wealthData.bank,
        wealthData.totalAssets, wealthData.loan, wealthData.otherLiabilities,
        wealthData.totalLiabilities, wealthData.netWorth
      ]);

      console.log(`✅ Complete tax return created for ${userData.name}`);

      // Calculate and display summary
      const grossIncome = userData.income.monthly_salary + userData.income.bonus +
                         userData.income.car_allowance + userData.income.other_taxable + userData.income.other_sources;
      const exemptIncome = userData.income.medical_allowance + userData.income.employer_contribution + userData.income.other_exempt;
      const taxableIncome = grossIncome - exemptIncome - deductionsData.total;

      console.log(`   📊 Gross Income: ${formatCurrency(grossIncome)}`);
      console.log(`   📊 Exempt Income: ${formatCurrency(exemptIncome)}`);
      console.log(`   📊 Taxable Income: ${formatCurrency(taxableIncome)}`);
      console.log(`   📊 Adjustable Tax: ${formatCurrency(adjustableTaxData.total)}`);
      console.log(`   📊 Net Worth: ${formatCurrency(wealthData.netWorth)}`);
    }

    console.log('\n🎉 All tax returns created successfully!');
    console.log('\n📋 Summary:');
    console.log('1. gg - High earner (Above 4.1M bracket, 35% tax rate)');
    console.log('2. Ali Raza - Medium earner (2.2M-4.1M bracket, 20-25% tax rate)');
    console.log('3. Omer Shaikh - Low earner (600K-1.2M bracket, 0-5% tax rate)');

  } catch (error) {
    console.error('Error creating tax returns:', error);
    throw error;
  }
}

// Helper functions to generate realistic data based on income profile
function getAdjustableTaxData(profile) {
  switch(profile) {
    case 'HIGH_EARNER':
      return {
        salary_tax: 180000,      // Higher salary tax collected
        electricity_tax: 45000,   // Higher utility bills
        phone_tax: 15000,
        vehicle_tax: 2400000,    // Luxury vehicle registration
        profit_debt_tax: 120000, // Higher investment income
        total: 2760000
      };
    case 'MEDIUM_EARNER':
      return {
        salary_tax: 75000,
        electricity_tax: 18000,
        phone_tax: 7200,
        vehicle_tax: 600000,     // Mid-range vehicle
        profit_debt_tax: 40000,
        total: 740200
      };
    case 'LOW_EARNER':
      return {
        salary_tax: 24000,
        electricity_tax: 6000,
        phone_tax: 2400,
        vehicle_tax: 150000,     // Basic vehicle
        profit_debt_tax: 8000,
        total: 190400
      };
    default:
      return { salary_tax: 0, electricity_tax: 0, phone_tax: 0, vehicle_tax: 0, profit_debt_tax: 0, total: 0 };
  }
}

function getCreditsData(profile) {
  switch(profile) {
    case 'HIGH_EARNER':
      return { charity: 500000, pension: 300000, insurance: 200000, total: 1000000 };
    case 'MEDIUM_EARNER':
      return { charity: 150000, pension: 100000, insurance: 75000, total: 325000 };
    case 'LOW_EARNER':
      return { charity: 50000, pension: 30000, insurance: 25000, total: 105000 };
    default:
      return { charity: 0, pension: 0, insurance: 0, total: 0 };
  }
}

function getDeductionsData(profile) {
  switch(profile) {
    case 'HIGH_EARNER':
      return { professional: 600000, zakat: 400000, advance: 800000, total: 1800000 };
    case 'MEDIUM_EARNER':
      return { professional: 200000, zakat: 150000, advance: 250000, total: 600000 };
    case 'LOW_EARNER':
      return { professional: 80000, zakat: 60000, advance: 100000, total: 240000 };
    default:
      return { professional: 0, zakat: 0, advance: 0, total: 0 };
  }
}

function getCapitalGainsData(profile) {
  switch(profile) {
    case 'HIGH_EARNER':
      return { property1yr: 5000000, property23yr: 8000000, securities: 3000000, other: 2000000, total: 18000000 };
    case 'MEDIUM_EARNER':
      return { property1yr: 1500000, property23yr: 2000000, securities: 800000, other: 500000, total: 4800000 };
    case 'LOW_EARNER':
      return { property1yr: 500000, property23yr: 300000, securities: 0, other: 100000, total: 900000 };
    default:
      return { property1yr: 0, property23yr: 0, securities: 0, other: 0, total: 0 };
  }
}

function getWealthData(profile) {
  switch(profile) {
    case 'HIGH_EARNER':
      return {
        property: 150000000, investment: 50000000, vehicle: 25000000,
        jewelry: 5000000, cash: 10000000, bank: 30000000,
        totalAssets: 270000000, loan: 30000000, otherLiabilities: 5000000,
        totalLiabilities: 35000000, netWorth: 235000000
      };
    case 'MEDIUM_EARNER':
      return {
        property: 45000000, investment: 15000000, vehicle: 8000000,
        jewelry: 1500000, cash: 3000000, bank: 8000000,
        totalAssets: 80500000, loan: 12000000, otherLiabilities: 2000000,
        totalLiabilities: 14000000, netWorth: 66500000
      };
    case 'LOW_EARNER':
      return {
        property: 12000000, investment: 2000000, vehicle: 2500000,
        jewelry: 300000, cash: 800000, bank: 1500000,
        totalAssets: 19100000, loan: 3000000, otherLiabilities: 500000,
        totalLiabilities: 3500000, netWorth: 15600000
      };
    default:
      return {
        property: 0, investment: 0, vehicle: 0, jewelry: 0, cash: 0, bank: 0,
        totalAssets: 0, loan: 0, otherLiabilities: 0, totalLiabilities: 0, netWorth: 0
      };
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Run the script
createUsersAndTaxReturns()
  .then(() => {
    console.log('\n✅ Tax return creation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to create tax returns:', error);
    process.exit(1);
  });