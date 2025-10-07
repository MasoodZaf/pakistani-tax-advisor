const axios = require('axios');
const fs = require('fs');

// Test data based on Excel extraction
const testData = {
  // Personal Information (assumed)
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

  // Income Form - Data from 'Income' sheet
  income: {
    // Monthly Salary: 7,200,000, Tax deducted: 2,200,000
    monthly_salary: 7200000,
    monthly_salary_tax_deducted: 2200000,

    // Bonus: 1,500,000
    bonus: 1500000,
    bonus_tax_deducted: 0,

    // Car benefit: 50,000
    perquisites_car: 50000,
    perquisites_car_tax_deducted: 0,

    // Other fields set to 0
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
    other_allowances_tax_deducted: 0,

    // Calculate totals
    total_income: 8750000, // 7,200,000 + 1,500,000 + 50,000
    total_tax_deducted: 2200000
  },

  // Final/Min Income Form - Data from 'Income with Final Min tax' sheet
  finalMinIncome: {
    dividend_reit_spv: 0,
    dividend_reit_spv_tax_deducted: 0,
    dividend_other_spv: 0,
    dividend_other_spv_tax_deducted: 0,
    dividend_ipp_shares: 0,
    dividend_ipp_shares_tax_deducted: 0,
    dividend_others: 0,
    dividend_others_tax_deducted: 0,
    sukuks_10_percent: 0,
    sukuks_10_percent_tax_deducted: 0,
    sukuks_12_5_percent: 0,
    sukuks_12_5_percent_tax_deducted: 0,
    sukuks_25_percent: 0,
    sukuks_25_percent_tax_deducted: 0,
    sukuks_exceeding_1m: 0,
    sukuks_exceeding_1m_tax_deducted: 0
  },

  // Adjustable Tax - Data from 'Adjustable Tax' sheet
  adjustableTax: {
    salary_employees: 8750000,
    salary_employees_tax: 2200000,
    directorship_fee: 0,
    directorship_fee_tax: 0,
    profit_on_debt: 0,
    profit_on_debt_tax: 0,
    profit_debt_non_resident: 0,
    profit_debt_non_resident_tax: 0,
    advance_tax_cash_withdrawal: 0,
    motor_vehicle_registration: 0,
    motor_vehicle_transfer: 0,
    other_adjustable_tax: 0
  },

  // Tax Reductions, Credits & Deductions - Data from 'Tax Reduction, Credit & deduct' sheet
  reductions: {
    // Tax Reductions
    teacher_researcher_amount: 0,
    teacher_researcher_tax_reduction: 581000,
    teacher_researcher_reduction_yn: 'Y',

    behbood_certificates_amount: 50000,
    behbood_certificates_tax_reduction: 5000,
    behbood_certificates_reduction_yn: 'Y',

    capital_gain_immovable_50_reduction: 0,
    capital_gain_immovable_75_reduction: 0,
    total_tax_reductions: 586000
  },

  credits: {
    // Tax Credits (from Excel)
    charitable_donations_amount: 0,
    charitable_donations_tax_credit: 0,
    charitable_donations_u61_yn: 'N',

    charitable_donations_associate_amount: 0,
    charitable_donations_associate_tax_credit: 0,
    charitable_donations_associate_yn: 'N',

    pension_fund_amount: 0,
    pension_fund_tax_credit: 0,
    pension_fund_u63_yn: 'N',

    surrender_tax_credit_amount: 0,
    surrender_tax_credit_reduction: 0,
    surrender_tax_credit_investments_yn: 'N',

    total_tax_credits: 0
  },

  deductions: {
    // Deductible Allowances (from Tax Computation sheet: 10,000)
    educational_expenses_amount: 10000,
    educational_expenses_children_count: 1,
    educational_expenses_yn: 'Y',

    zakat_paid_amount: 0,
    zakat_paid_ordinance_yn: 'N',

    total_deduction_from_income: 10000
  },

  // Capital Gains - Data from 'Capital Gain' sheet (all zeros in this case)
  capitalGains: {
    immovable_property_1_year_taxable: 0,
    immovable_property_1_year_deducted: 0,
    immovable_property_1_year_carryable: 0,

    immovable_property_2_years_taxable: 0,
    immovable_property_2_years_deducted: 0,
    immovable_property_2_years_carryable: 0,

    immovable_property_3_years_taxable: 0,
    immovable_property_3_years_deducted: 0,
    immovable_property_3_years_carryable: 0,

    immovable_property_4_years_taxable: 0,
    immovable_property_4_years_deducted: 0,
    immovable_property_4_years_carryable: 0,

    immovable_property_5_years_taxable: 0,
    immovable_property_5_years_deducted: 0,
    immovable_property_5_years_carryable: 0,

    immovable_property_6_years_taxable: 0,
    immovable_property_6_years_deducted: 0,
    immovable_property_6_years_carryable: 0,

    immovable_property_over_6_years_taxable: 0,
    immovable_property_over_6_years_deducted: 0,
    immovable_property_over_6_years_carryable: 0,

    securities_before_july_2013_taxable: 0,
    securities_before_july_2013_deducted: 0,
    securities_before_july_2013_carryable: 0,

    securities_pmex_settled_taxable: 0,
    securities_pmex_settled_deducted: 0,
    securities_pmex_settled_carryable: 0,

    securities_37a_7_5_percent_taxable: 0,
    securities_37a_7_5_percent_deducted: 0,
    securities_37a_7_5_percent_carryable: 0,

    securities_mutual_funds_10_percent_taxable: 0,
    securities_mutual_funds_10_percent_deducted: 0,
    securities_mutual_funds_10_percent_carryable: 0,

    securities_mutual_funds_12_5_percent_taxable: 0,
    securities_mutual_funds_12_5_percent_deducted: 0,
    securities_mutual_funds_12_5_percent_carryable: 0,

    securities_other_25_percent_taxable: 0,
    securities_other_25_percent_deducted: 0,
    securities_other_25_percent_carryable: 0,

    securities_12_5_percent_before_july_2022_taxable: 0,
    securities_12_5_percent_before_july_2022_deducted: 0,
    securities_12_5_percent_before_july_2022_carryable: 0,

    securities_15_percent_taxable: 0,
    securities_15_percent_deducted: 0,
    securities_15_percent_carryable: 0
  },

  // Expenses - Data from 'Detail of Expenses' sheet
  expenses: {
    rent: 0,
    rates_taxes: 20000,
    income_tax_paid: 2200000,
    vehicle_expenses: 200000,
    travelling: 500000,
    electricity: 750000,
    // Other common expense fields
    telephone: 0,
    entertainment: 0,
    other_expenses: 0
  },

  // Wealth Statement - Data from 'Wealth Statement' sheet
  wealthStatement: {
    // Assets
    agricultural_property_current: 0,
    agricultural_property_previous: 0,

    commercial_property_current: 5000000,
    commercial_property_previous: 5000000,

    defense_bahria_property_current: 5000000,
    defense_bahria_property_previous: 5000000,

    equipment_current: 0,
    equipment_previous: 0,

    animals_current: 0,
    animals_previous: 0,

    investments_current: 0,
    investments_previous: 0,

    // Additional wealth items (estimated from Excel data)
    cash_bank_current: 4040000, // Calculated to match net assets
    cash_bank_previous: 4200000,

    // Liabilities
    liabilities_current: 0,
    liabilities_previous: 0
  },

  // Wealth Reconciliation - Data from 'Wealth Recon' sheet
  wealthReconciliation: {
    net_assets_current: 14040000,
    net_assets_previous: 14200000,
    increase_decrease: -160000,

    // Inflows
    income_normal_tax: 8750000,
    income_exempt: 500000,

    // Other reconciliation items
    other_inflows: 0,
    total_inflows: 9250000,

    // Outflows (calculated to balance)
    living_expenses: 9410000,
    other_outflows: 0,
    total_outflows: 9410000,

    reconciliation_difference: 0
  }
};

// Function to populate a single form
async function populateForm(endpoint, data, formName) {
  try {
    console.log(`Populating ${formName}...`);

    const response = await axios.post(`http://localhost:3001/api/tax-forms/${endpoint}`, {
      ...data,
      isComplete: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // You may need to adjust this
      }
    });

    console.log(`✅ ${formName} populated successfully`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error populating ${formName}:`, error.response?.data || error.message);
    return null;
  }
}

// Main function to populate all forms
async function populateAllForms() {
  console.log('🚀 Starting test data population from Excel...\n');

  // First, create a tax return (you may need to login first)
  try {
    console.log('Creating new tax return...');
    const taxReturnResponse = await axios.post('http://localhost:3001/api/tax-forms/create-return');
    console.log('✅ Tax return created:', taxReturnResponse.data.taxReturn.id);
    console.log('');
  } catch (error) {
    console.log('⚠️  Tax return creation failed - may already exist or need auth');
    console.log('');
  }

  // Populate forms in sequence
  const forms = [
    { endpoint: 'personal_info', data: testData.personalInfo, name: 'Personal Information' },
    { endpoint: 'income_forms', data: testData.income, name: 'Income Form' },
    { endpoint: 'final_min_income_forms', data: testData.finalMinIncome, name: 'Final/Min Income Form' },
    { endpoint: 'adjustable_tax_forms', data: testData.adjustableTax, name: 'Adjustable Tax' },
    { endpoint: 'reductions_forms', data: testData.reductions, name: 'Tax Reductions' },
    { endpoint: 'credits_forms', data: testData.credits, name: 'Tax Credits' },
    { endpoint: 'deductions_forms', data: testData.deductions, name: 'Deductible Allowances' },
    { endpoint: 'capital_gain_forms', data: testData.capitalGains, name: 'Capital Gains' },
    { endpoint: 'expenses_forms', data: testData.expenses, name: 'Expenses' },
    { endpoint: 'wealth_forms', data: testData.wealthStatement, name: 'Wealth Statement' },
    { endpoint: 'wealth_reconciliation_forms', data: testData.wealthReconciliation, name: 'Wealth Reconciliation' }
  ];

  for (const form of forms) {
    await populateForm(form.endpoint, form.data, form.name);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n🎉 Test data population complete!');
  console.log('\n📊 Expected Results Based on Excel:');
  console.log('- Total Income: PKR 8,750,000');
  console.log('- Taxable Income: PKR 8,740,000 (after PKR 10,000 deduction)');
  console.log('- Tax Deducted: PKR 2,200,000');
  console.log('- Tax Reductions: PKR 586,000');
  console.log('- Net Assets Current: PKR 14,040,000');
  console.log('- Net Assets Previous: PKR 14,200,000');
  console.log('\n✨ You can now test the app calculations against these values!');
}

// Export test data for individual use
module.exports = { testData, populateAllForms };

// Run if executed directly
if (require.main === module) {
  populateAllForms().catch(console.error);
}