const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tax_advisor',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
});

// Test data from Excel extraction
const testData = {
  user: {
    id: uuidv4(),
    email: 'test@example.com',
    full_name: 'Test User from Excel',
    role: 'user'
  },

  taxYear: {
    id: uuidv4(),
    tax_year: '2024-25',
    description: 'Tax Year 2024-25'
  },

  // Personal Information
  personalInfo: {
    full_name: 'Salaried Individual Test',
    father_name: 'Father Name',
    cnic: '12345-6789012-3',
    mobile: '03001234567',
    email: 'test@example.com',
    address: 'Test Address, Lahore',
    ntn: '1234567-8',
    professional_tax_registration: 'PT123456'
  },

  // Income Form - Data from Excel 'Income' sheet
  income: {
    monthly_salary: 7200000,
    monthly_salary_tax_deducted: 2200000,
    bonus: 1500000,
    bonus_tax_deducted: 0,
    perquisites_car: 50000,
    perquisites_car_tax_deducted: 0,
    overtime: 0,
    overtime_tax_deducted: 0,
    commission: 0,
    commission_tax_deducted: 0,
    leaves_encashment: 0,
    leaves_encashment_tax_deducted: 0,
    medical_allowance: 0,
    medical_allowance_tax_deducted: 0,
    house_rent_allowance: 0,
    house_rent_allowance_tax_deducted: 0,
    other_allowances: 0,
    other_allowances_tax_deducted: 0
  },

  // Final/Min Income
  finalMinIncome: {
    dividend_reit_spv: 0,
    dividend_reit_spv_tax_deducted: 0,
    dividend_other_spv: 0,
    dividend_other_spv_tax_deducted: 0,
    dividend_ipp_shares: 0,
    dividend_ipp_shares_tax_deducted: 0,
    dividend_others: 0,
    dividend_others_tax_deducted: 0
  },

  // Adjustable Tax - Data from Excel 'Adjustable Tax' sheet
  adjustableTax: {
    salary_employees: 8750000,
    salary_employees_tax: 2200000,
    directorship_fee: 0,
    directorship_fee_tax: 0,
    profit_on_debt: 0,
    profit_on_debt_tax: 0
  },

  // Tax Reductions - Data from Excel 'Tax Reduction, Credit & deduct' sheet
  reductions: {
    teacher_researcher_amount: 0,
    teacher_researcher_tax_reduction: 581000,
    teacher_researcher_reduction_yn: 'Y',
    behbood_certificates_amount: 50000,
    behbood_certificates_tax_reduction: 5000,
    behbood_certificates_reduction_yn: 'Y',
    capital_gain_immovable_50_reduction: 0,
    capital_gain_immovable_75_reduction: 0
  },

  credits: {
    charitable_donations_amount: 0,
    charitable_donations_tax_credit: 0,
    charitable_donations_u61_yn: 'N',
    pension_fund_amount: 0,
    pension_fund_tax_credit: 0,
    pension_fund_u63_yn: 'N'
  },

  deductions: {
    educational_expenses_amount: 10000,
    educational_expenses_children_count: 1,
    educational_expenses_yn: 'Y',
    zakat_paid_amount: 0,
    zakat_paid_ordinance_yn: 'N'
  },

  // Wealth Statement - Data from Excel 'Wealth Statement' sheet
  wealthStatement: {
    agricultural_property_current: 0,
    agricultural_property_previous: 0,
    commercial_property_current: 5000000,
    commercial_property_previous: 5000000,
    defense_bahria_property_current: 5000000,
    defense_bahria_property_previous: 5000000,
    cash_bank_current: 4040000,
    cash_bank_previous: 4200000,
    equipment_current: 0,
    equipment_previous: 0,
    investments_current: 0,
    investments_previous: 0,
    liabilities_current: 0,
    liabilities_previous: 0
  },

  // Wealth Reconciliation - Data from Excel 'Wealth Recon' sheet
  wealthReconciliation: {
    net_assets_current: 14040000,
    net_assets_previous: 14200000,
    increase_decrease: -160000,
    income_normal_tax: 8750000,
    income_exempt: 500000,
    living_expenses: 9410000,
    other_inflows: 0,
    other_outflows: 0
  }
};

// Helper function to create test user if not exists
async function ensureTestUser() {
  const client = await pool.connect();
  try {
    // Check if test user exists
    const userResult = await client.query('SELECT id FROM users WHERE email = $1', [testData.user.email]);

    if (userResult.rows.length === 0) {
      // Create test user
      await client.query(`
        INSERT INTO users (id, email, full_name, role, email_verified_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
        ON CONFLICT (email) DO NOTHING
      `, [testData.user.id, testData.user.email, testData.user.full_name, testData.user.role]);
    } else {
      testData.user.id = userResult.rows[0].id;
    }

    // Ensure tax year exists
    await client.query(`
      INSERT INTO tax_years (id, tax_year, description, is_active, start_date, end_date, created_at, updated_at)
      VALUES ($1, $2, $3, true, '2024-07-01', '2025-06-30', NOW(), NOW())
      ON CONFLICT (tax_year) DO NOTHING
    `, [testData.taxYear.id, testData.taxYear.tax_year, testData.taxYear.description]);

    // Get tax year ID
    const taxYearResult = await client.query('SELECT id FROM tax_years WHERE tax_year = $1', [testData.taxYear.tax_year]);
    testData.taxYear.id = taxYearResult.rows[0].id;

    return testData.user.id;
  } finally {
    client.release();
  }
}

// Helper function to create tax return
async function ensureTaxReturn(userId) {
  const client = await pool.connect();
  try {
    const taxReturnId = uuidv4();

    await client.query(`
      INSERT INTO tax_returns (id, user_id, user_email, tax_year_id, tax_year, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW())
      ON CONFLICT (user_id, tax_year)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `, [taxReturnId, userId, testData.user.email, testData.taxYear.id, testData.taxYear.tax_year]);

    // Get the tax return ID
    const result = await client.query(`
      SELECT id FROM tax_returns
      WHERE user_id = $1 AND tax_year = $2
      ORDER BY created_at DESC LIMIT 1
    `, [userId, testData.taxYear.tax_year]);

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Route to populate test data from Excel
router.post('/populate-excel-data', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Starting Excel test data population');

    // 1. Ensure test user and tax year exist
    const userId = await ensureTestUser();
    logger.info('Test user ensured', { userId });

    // 2. Create tax return
    const taxReturnId = await ensureTaxReturn(userId);
    logger.info('Tax return created', { taxReturnId });

    // 3. Populate Income Form
    await client.query(`
      INSERT INTO income_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, monthly_salary_tax_deducted,
        bonus, bonus_tax_deducted,
        perquisites_car, perquisites_car_tax_deducted,
        overtime, overtime_tax_deducted,
        commission, commission_tax_deducted,
        leaves_encashment, leaves_encashment_tax_deducted,
        medical_allowance, medical_allowance_tax_deducted,
        house_rent_allowance, house_rent_allowance_tax_deducted,
        other_allowances, other_allowances_tax_deducted,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        monthly_salary = EXCLUDED.monthly_salary,
        monthly_salary_tax_deducted = EXCLUDED.monthly_salary_tax_deducted,
        bonus = EXCLUDED.bonus,
        bonus_tax_deducted = EXCLUDED.bonus_tax_deducted,
        perquisites_car = EXCLUDED.perquisites_car,
        perquisites_car_tax_deducted = EXCLUDED.perquisites_car_tax_deducted,
        is_complete = EXCLUDED.is_complete,
        updated_at = NOW()
    `, [
      uuidv4(), taxReturnId, userId, testData.user.email, testData.taxYear.id, testData.taxYear.tax_year,
      testData.income.monthly_salary, testData.income.monthly_salary_tax_deducted,
      testData.income.bonus, testData.income.bonus_tax_deducted,
      testData.income.perquisites_car, testData.income.perquisites_car_tax_deducted,
      testData.income.overtime, testData.income.overtime_tax_deducted,
      testData.income.commission, testData.income.commission_tax_deducted,
      testData.income.leaves_encashment, testData.income.leaves_encashment_tax_deducted,
      testData.income.medical_allowance, testData.income.medical_allowance_tax_deducted,
      testData.income.house_rent_allowance, testData.income.house_rent_allowance_tax_deducted,
      testData.income.other_allowances, testData.income.other_allowances_tax_deducted
    ]);
    logger.info('Income form populated');

    // 4. Populate Adjustable Tax
    await client.query(`
      INSERT INTO adjustable_tax_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        salary_employees, salary_employees_tax,
        directorship_fee, directorship_fee_tax,
        profit_on_debt, profit_on_debt_tax,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        salary_employees = EXCLUDED.salary_employees,
        salary_employees_tax = EXCLUDED.salary_employees_tax,
        is_complete = EXCLUDED.is_complete,
        updated_at = NOW()
    `, [
      uuidv4(), taxReturnId, userId, testData.user.email, testData.taxYear.id, testData.taxYear.tax_year,
      testData.adjustableTax.salary_employees, testData.adjustableTax.salary_employees_tax,
      testData.adjustableTax.directorship_fee, testData.adjustableTax.directorship_fee_tax,
      testData.adjustableTax.profit_on_debt, testData.adjustableTax.profit_on_debt_tax
    ]);
    logger.info('Adjustable tax populated');

    // 5. Populate Tax Reductions
    await client.query(`
      INSERT INTO reductions_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_researcher_amount, teacher_researcher_tax_reduction, teacher_researcher_reduction_yn,
        behbood_certificates_amount, behbood_certificates_tax_reduction, behbood_certificates_reduction_yn,
        capital_gain_immovable_50_reduction, capital_gain_immovable_75_reduction,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        teacher_researcher_tax_reduction = EXCLUDED.teacher_researcher_tax_reduction,
        behbood_certificates_amount = EXCLUDED.behbood_certificates_amount,
        behbood_certificates_tax_reduction = EXCLUDED.behbood_certificates_tax_reduction,
        is_complete = EXCLUDED.is_complete,
        updated_at = NOW()
    `, [
      uuidv4(), taxReturnId, userId, testData.user.email, testData.taxYear.id, testData.taxYear.tax_year,
      testData.reductions.teacher_researcher_amount, testData.reductions.teacher_researcher_tax_reduction, testData.reductions.teacher_researcher_reduction_yn,
      testData.reductions.behbood_certificates_amount, testData.reductions.behbood_certificates_tax_reduction, testData.reductions.behbood_certificates_reduction_yn,
      testData.reductions.capital_gain_immovable_50_reduction, testData.reductions.capital_gain_immovable_75_reduction
    ]);
    logger.info('Tax reductions populated');

    // 6. Populate Deductions
    await client.query(`
      INSERT INTO deductions_forms (
        id, tax_return_id, user_id, user_email, tax_year_id, tax_year,
        educational_expenses_amount, educational_expenses_children_count, educational_expenses_yn,
        zakat_paid_amount, zakat_paid_ordinance_yn,
        is_complete, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW()
      ) ON CONFLICT (tax_return_id) DO UPDATE SET
        educational_expenses_amount = EXCLUDED.educational_expenses_amount,
        educational_expenses_children_count = EXCLUDED.educational_expenses_children_count,
        is_complete = EXCLUDED.is_complete,
        updated_at = NOW()
    `, [
      uuidv4(), taxReturnId, userId, testData.user.email, testData.taxYear.id, testData.taxYear.tax_year,
      testData.deductions.educational_expenses_amount, testData.deductions.educational_expenses_children_count, testData.deductions.educational_expenses_yn,
      testData.deductions.zakat_paid_amount, testData.deductions.zakat_paid_ordinance_yn
    ]);
    logger.info('Deductions populated');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Test data from Excel populated successfully',
      data: {
        userId,
        taxReturnId,
        expectedResults: {
          totalIncome: 8750000,
          taxableIncome: 8740000, // After 10,000 deduction
          taxDeducted: 2200000,
          taxReductions: 586000,
          netAssetsCurrent: 14040000,
          netAssetsPrevious: 14200000
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error populating test data', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error populating test data',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Route to clear test data
router.post('/clear-data', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Clearing test data');

    // Delete test data for test user
    const tables = [
      'income_forms',
      'final_min_income_forms',
      'adjustable_tax_forms',
      'reductions_forms',
      'credits_forms',
      'deductions_forms',
      'capital_gain_forms',
      'expenses_forms',
      'wealth_forms',
      'wealth_reconciliation_forms',
      'tax_returns'
    ];

    for (const table of tables) {
      await client.query(`DELETE FROM ${table} WHERE user_email = $1`, [testData.user.email]);
    }

    // Optionally delete test user
    await client.query('DELETE FROM users WHERE email = $1', [testData.user.email]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Test data cleared successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error clearing test data', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error clearing test data',
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;