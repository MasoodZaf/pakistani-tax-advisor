const { pool } = require('./src/config/database');
const axios = require('axios');

async function testIncomeEndpoints() {
  try {
    console.log('🧪 Testing Income Form API Endpoints...\n');

    // Base URL for the API
    const baseURL = 'http://localhost:3001/api';

    // Test user ID (Khurram Jamili - khurramja@taxadvisor.pk)
    const testUserId = '30c42be9-affa-47c5-9f09-67ca7edbf524';
    const taxYear = '2025-26';

    // 1. First, verify the data in database
    console.log('1. Checking database data...');
    const dbResult = await pool.query(
      'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
      [testUserId, taxYear]
    );

    if (dbResult.rows.length === 0) {
      console.log('❌ No data found in database');
      return;
    }

    const dbData = dbResult.rows[0];
    console.log('✅ Database data found:');
    console.log('   Annual Basic Salary:', dbData.annual_basic_salary);
    console.log('   Allowances:', dbData.allowances);
    console.log('   Bonus:', dbData.bonus);
    console.log('   Medical Allowance:', dbData.medical_allowance);
    console.log('   Pension from Ex-Employer:', dbData.pension_from_ex_employer);
    console.log('   Employment Termination Payment:', dbData.employment_termination_payment);
    console.log('   Retirement from Approved Funds:', dbData.retirement_from_approved_funds);
    console.log('   Directorship Fee:', dbData.directorship_fee);
    console.log('   Other Cash Benefits:', dbData.other_cash_benefits);
    console.log('   Employer Contribution Provident:', dbData.employer_contribution_provident);
    console.log('   Taxable Car Value:', dbData.taxable_car_value);
    console.log('   Other Taxable Subsidies:', dbData.other_taxable_subsidies);
    console.log('   Profit on Debt 15%:', dbData.profit_on_debt_15_percent);
    console.log('   Profit on Debt 12.5%:', dbData.profit_on_debt_12_5_percent);
    console.log('   Other Taxable Income Rent:', dbData.other_taxable_income_rent);
    console.log('   Other Taxable Income Others:', dbData.other_taxable_income_others);
    console.log('');

    // 2. Test JWT generation for the user
    console.log('2. Generating test JWT token...');
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = 'your-super-secret-jwt-key-for-production-use-long-random-string';

    const token = jwt.sign(
      {
        userId: testUserId,
        email: 'khurramja@taxadvisor.pk',
        name: 'Khurram Jamili'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✅ JWT Token generated');
    console.log('');

    // 3. Test GET income form endpoint
    console.log('3. Testing GET /income-form/:taxYear endpoint...');
    try {
      const getResponse = await axios.get(`${baseURL}/income-form/${taxYear}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ GET endpoint successful');
      console.log('   Status:', getResponse.status);
      console.log('   Data received:');
      const responseData = getResponse.data;
      console.log('     Annual Basic Salary:', responseData.annual_basic_salary);
      console.log('     Allowances:', responseData.allowances);
      console.log('     Bonus:', responseData.bonus);
      console.log('     Medical Allowance:', responseData.medical_allowance);
      console.log('     Pension from Ex-Employer:', responseData.pension_from_ex_employer);
      console.log('     Employment Termination Payment:', responseData.employment_termination_payment);
      console.log('     Retirement from Approved Funds:', responseData.retirement_from_approved_funds);
      console.log('     Directorship Fee:', responseData.directorship_fee);
      console.log('     Other Cash Benefits:', responseData.other_cash_benefits);
      console.log('     Employer Contribution Provident:', responseData.employer_contribution_provident);
      console.log('     Taxable Car Value:', responseData.taxable_car_value);
      console.log('     Other Taxable Subsidies:', responseData.other_taxable_subsidies);
      console.log('     Profit on Debt 15%:', responseData.profit_on_debt_15_percent);
      console.log('     Profit on Debt 12.5%:', responseData.profit_on_debt_12_5_percent);
      console.log('     Other Taxable Income Rent:', responseData.other_taxable_income_rent);
      console.log('     Other Taxable Income Others:', responseData.other_taxable_income_others);
      console.log('');
    } catch (error) {
      console.log('❌ GET endpoint failed:', error.response?.data || error.message);
      console.log('');
    }

    // 4. Test GET summary endpoint
    console.log('4. Testing GET /income-form/:taxYear/summary endpoint...');
    try {
      const summaryResponse = await axios.get(`${baseURL}/income-form/${taxYear}/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ GET summary endpoint successful');
      console.log('   Status:', summaryResponse.status);
      console.log('   Summary data:');
      const summaryData = summaryResponse.data.data;
      console.log('     Employment Termination Total:', summaryData.employment_termination_total);
      console.log('     Total Non-Cash Benefits:', summaryData.total_non_cash_benefits);
      console.log('     Other Income Min Tax Total:', summaryData.other_income_min_tax_total);
      console.log('     Other Income No Min Tax Total:', summaryData.other_income_no_min_tax_total);
      console.log('     Income Exempt from Tax:', summaryData.income_exempt_from_tax);
      console.log('     Non-Cash Benefit Exempt:', summaryData.non_cash_benefit_exempt);
      console.log('     Total Income:', summaryData.total_income);
      console.log('');
    } catch (error) {
      console.log('❌ GET summary endpoint failed:', error.response?.data || error.message);
      console.log('');
    }

    // 5. Test the new tax-forms endpoint that frontend uses
    console.log('5. Testing GET /tax-forms/current-return endpoint...');
    try {
      const taxFormsResponse = await axios.get(`${baseURL}/tax-forms/current-return`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ GET tax-forms current-return endpoint successful');
      console.log('   Status:', taxFormsResponse.status);
      console.log('   Tax Return ID:', taxFormsResponse.data.taxReturn.id);
      console.log('   Completed Steps:', taxFormsResponse.data.completedSteps);

      if (taxFormsResponse.data.formData.income) {
        console.log('   Income Form Data Found:');
        const incomeData = taxFormsResponse.data.formData.income;
        console.log('     Annual Basic Salary:', incomeData.annual_basic_salary);
        console.log('     Allowances:', incomeData.allowances);
        console.log('     Bonus:', incomeData.bonus);
        console.log('     Medical Allowance:', incomeData.medical_allowance);
      } else {
        console.log('   ❌ No income form data found in tax-forms response');
      }
      console.log('');
    } catch (error) {
      console.log('❌ GET tax-forms current-return endpoint failed:', error.response?.data || error.message);
      console.log('');
    }

    console.log('🎉 Testing completed!');

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testIncomeEndpoints();