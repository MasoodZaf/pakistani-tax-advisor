const axios = require('axios');
const { pool } = require('./src/config/database');

async function testCompleteLoginFlow() {
  try {
    console.log('🧪 Testing Complete Login and JWT Flow...\n');

    const baseURL = 'http://localhost:3001/api';
    const testEmail = 'khurramja@taxadvisor.pk';
    const testPassword = 'password';

    // 1. Test login endpoint
    console.log('1. Testing login endpoint...');
    const loginResponse = await axios.post(`${baseURL}/login`, {
      email: testEmail,
      password: testPassword
    });

    console.log('✅ Login successful');
    console.log('   Status:', loginResponse.status);
    console.log('   Response structure:');
    console.log('     - success:', loginResponse.data.success);
    console.log('     - user.id:', loginResponse.data.user?.id);
    console.log('     - user.email:', loginResponse.data.user?.email);
    console.log('     - user.name:', loginResponse.data.user?.name);
    console.log('     - user.role:', loginResponse.data.user?.role);
    console.log('     - sessionToken length:', loginResponse.data.sessionToken?.length);
    console.log('     - JWT token length:', loginResponse.data.token?.length);
    console.log('     - isAdmin:', loginResponse.data.isAdmin);
    console.log('');

    // Extract the JWT token for further tests
    const jwtToken = loginResponse.data.token;
    const userId = loginResponse.data.user.id;

    if (!jwtToken) {
      console.log('❌ No JWT token received from login response');
      return;
    }

    // 2. Test JWT token validation with a protected endpoint
    console.log('2. Testing JWT token with protected endpoint...');
    try {
      const taxReturnResponse = await axios.get(`${baseURL}/tax-forms/current-return`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ JWT token works with protected endpoint');
      console.log('   Status:', taxReturnResponse.status);
      console.log('   Tax Return ID:', taxReturnResponse.data.taxReturn?.id);
      console.log('   Completed Steps:', taxReturnResponse.data.completedSteps);

      if (taxReturnResponse.data.formData?.income) {
        console.log('   Income Data Found:');
        const incomeData = taxReturnResponse.data.formData.income;
        console.log('     - Annual Basic Salary:', incomeData.annual_basic_salary);
        console.log('     - Allowances:', incomeData.allowances);
        console.log('     - Bonus:', incomeData.bonus);
        console.log('     - Medical Allowance:', incomeData.medical_allowance);
      } else {
        console.log('   ⚠️  No income data found in response');
      }
      console.log('');
    } catch (jwtError) {
      console.log('❌ JWT token validation failed:', jwtError.response?.data || jwtError.message);
      console.log('   Status Code:', jwtError.response?.status);
      console.log('   Error Details:', jwtError.response?.data);
      console.log('');
    }

    // 3. Test income form endpoint specifically
    console.log('3. Testing income form endpoint...');
    try {
      const incomeResponse = await axios.get(`${baseURL}/income-form/2025-26`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Income form endpoint works');
      console.log('   Status:', incomeResponse.status);
      console.log('   Income Form Data:');
      console.log('     - Annual Basic Salary:', incomeResponse.data.annual_basic_salary);
      console.log('     - Allowances:', incomeResponse.data.allowances);
      console.log('     - Bonus:', incomeResponse.data.bonus);
      console.log('     - Medical Allowance:', incomeResponse.data.medical_allowance);
      console.log('     - Pension from Ex-Employer:', incomeResponse.data.pension_from_ex_employer);
      console.log('     - Employment Termination Payment:', incomeResponse.data.employment_termination_payment);
      console.log('');
    } catch (incomeError) {
      console.log('❌ Income form endpoint failed:', incomeError.response?.data || incomeError.message);
      console.log('');
    }

    // 4. Verify database data exists
    console.log('4. Verifying database data...');
    const dbResult = await pool.query(
      'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, '2025-26']
    );

    if (dbResult.rows.length > 0) {
      console.log('✅ Database has income data');
      const dbData = dbResult.rows[0];
      console.log('   Database Income Data:');
      console.log('     - Annual Basic Salary:', dbData.annual_basic_salary);
      console.log('     - Allowances:', dbData.allowances);
      console.log('     - Bonus:', dbData.bonus);
      console.log('     - Medical Allowance:', dbData.medical_allowance);
    } else {
      console.log('❌ No income data found in database');
    }

    console.log('\n🎉 Login flow testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.log('   Response Status:', error.response.status);
      console.log('   Response Data:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

// Run the test
testCompleteLoginFlow();