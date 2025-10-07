// Direct test of income form API endpoint
const axios = require('axios');

async function testIncomeAPI() {
  try {
    console.log('Testing Income Form API endpoint directly...');

    // Step 1: Login as Super Admin
    const loginResponse = await axios.post('http://localhost:3001/api/login', {
      email: 'khurramj@taxadvisor.pk',
      password: 'password123'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }

    const { token } = loginResponse.data;
    console.log('✅ Super Admin login successful');

    // Step 2: Test income form API with the current tax year (2025-26)
    const incomeFormResponse = await axios.get('http://localhost:3001/api/income-form/2025-26', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Income form API endpoint accessible');

    const incomeData = incomeFormResponse.data;

    console.log('\n=== INCOME FORM DATA FROM API ===');
    console.log('PAYMENTS BY EMPLOYER:');
    console.log(`- Annual Basic Salary: ${parseInt(incomeData.annual_basic_salary || 0).toLocaleString()}`);
    console.log(`- Allowances: ${parseInt(incomeData.allowances || 0).toLocaleString()}`);
    console.log(`- Bonus: ${parseInt(incomeData.bonus || 0).toLocaleString()}`);
    console.log(`- Medical allowance: ${parseInt(incomeData.medical_allowance || 0).toLocaleString()}`);
    console.log(`- Pension from ex-employer: ${parseInt(incomeData.pension_from_ex_employer || 0).toLocaleString()}`);
    console.log(`- Employment Termination: ${parseInt(incomeData.employment_termination_payment || 0).toLocaleString()}`);
    console.log(`- Retirement funds: ${parseInt(incomeData.retirement_from_approved_funds || 0).toLocaleString()}`);
    console.log(`- Directorship Fee: ${parseInt(incomeData.directorship_fee || 0).toLocaleString()}`);
    console.log(`- Other cash benefits: ${parseInt(incomeData.other_cash_benefits || 0).toLocaleString()}`);

    console.log('\nNON CASH BENEFITS:');
    console.log(`- Employer Contribution: ${parseInt(incomeData.employer_contribution_provident || 0).toLocaleString()}`);
    console.log(`- Taxable Car Value: ${parseInt(incomeData.taxable_car_value || 0).toLocaleString()}`);
    console.log(`- Other subsidies: ${parseInt(incomeData.other_taxable_subsidies || 0).toLocaleString()}`);

    console.log('\nOTHER INCOME (MIN TAX):');
    console.log(`- Profit on Debt 15%: ${parseInt(incomeData.profit_on_debt_15_percent || 0).toLocaleString()}`);
    console.log(`- Profit on Debt 12.5%: ${parseInt(incomeData.profit_on_debt_12_5_percent || 0).toLocaleString()}`);

    console.log('\nOTHER INCOME (NO MIN TAX):');
    console.log(`- Rent income: ${parseInt(incomeData.other_taxable_income_rent || 0).toLocaleString()}`);
    console.log(`- Others: ${parseInt(incomeData.other_taxable_income_others || 0).toLocaleString()}`);

    // Check if calculated fields are present
    if (incomeData.employment_termination_total !== undefined) {
      console.log('\nCALCULATED TOTALS:');
      console.log(`- Employment Termination Total: ${parseInt(incomeData.employment_termination_total || 0).toLocaleString()}`);
      console.log(`- Total Non Cash Benefits: ${parseInt(incomeData.total_non_cash_benefits || 0).toLocaleString()}`);
      console.log(`- Other Income (Min Tax) Total: ${parseInt(incomeData.other_income_min_tax_total || 0).toLocaleString()}`);
      console.log(`- Other Income (No Min Tax) Total: ${parseInt(incomeData.other_income_no_min_tax_total || 0).toLocaleString()}`);
    }

    // Verify data matches what we inserted
    const expectedValues = {
      annual_basic_salary: 7200000,
      allowances: 6000000,
      bonus: 1500000,
      medical_allowance: 720000,
      pension_from_ex_employer: 400000,
      employment_termination_payment: 2000000,
      retirement_from_approved_funds: 5000000,
      directorship_fee: 40000,
      other_cash_benefits: 1200000,
      employer_contribution_provident: 720000,
      taxable_car_value: 1500000,
      other_taxable_subsidies: 200000,
      profit_on_debt_15_percent: 700000,
      profit_on_debt_12_5_percent: 1500000,
      other_taxable_income_rent: 700000,
      other_taxable_income_others: 50000
    };

    let allMatch = true;
    console.log('\n=== DATA VALIDATION ===');
    for (const [field, expectedValue] of Object.entries(expectedValues)) {
      const actualValue = parseInt(incomeData[field] || 0);
      const matches = actualValue === expectedValue;
      console.log(`${field}: ${matches ? '✅' : '❌'} Expected: ${expectedValue.toLocaleString()}, Got: ${actualValue.toLocaleString()}`);
      if (!matches) allMatch = false;
    }

    if (allMatch) {
      console.log('\n🎉 ALL DATA MATCHES! The income form API is working correctly.');
      console.log('The Super Admin can now log in and see the populated income form data.');
    } else {
      console.log('\n⚠️  Some data does not match the expected values.');
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testIncomeAPI()
  .then(() => {
    console.log('\n✨ Income form API test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });