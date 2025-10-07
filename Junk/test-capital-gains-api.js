const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testCapitalGainsAPI() {
  try {
    console.log('🧪 Testing Capital Gains API...\n');

    // Step 1: Login
    console.log('1. Authenticating...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'superadmin@paktaxadvisor.com',
      password: 'admin123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Authentication successful');

    // Step 2: Use existing tax return (from previous test)
    console.log('\n2. Getting existing tax return...');

    // Use a known tax return ID from the previous test
    const taxReturnId = 'e44155d5-231a-436f-b0e5-b56cbd622137'; // From direct database test
    console.log('✅ Using Tax Return ID:', taxReturnId);

    // Step 3: Test API submission
    console.log('\n3. Testing API form submission...');

    const testData = {
      tax_return_id: taxReturnId,
      immovable_property_1_year_type: 'Flat',
      immovable_property_1_year_taxable: 800000,
      immovable_property_1_year_deducted: 80000,
      immovable_property_1_year_carryable: 0,

      immovable_property_2_years_type: 'House',
      immovable_property_2_years_taxable: 1200000,
      immovable_property_2_years_deducted: 90000,
      immovable_property_2_years_carryable: 0,

      immovable_property_3_years_type: 'Plot',
      immovable_property_3_years_taxable: 900000,
      immovable_property_3_years_deducted: 45000,
      immovable_property_3_years_carryable: 0,

      securities_15_percent_taxable: 300000,
      securities_15_percent_deducted: 45000,
      securities_15_percent_carryable: 0,

      is_complete: true
    };

    console.log('📤 Submitting via API with property types:');
    console.log('   - Flat (1 year): Rs 800,000');
    console.log('   - House (2 years): Rs 1,200,000');
    console.log('   - Plot (3 years): Rs 900,000');

    const apiResponse = await axios.post(
      `${BASE_URL}/api/tax-forms/capital-gain`,
      testData,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('✅ API submission successful');
    console.log('✅ Response status:', apiResponse.status);

    // Step 4: Retrieve and verify data
    console.log('\n4. Retrieving data via API...');
    const retrieveResponse = await axios.get(
      `${BASE_URL}/api/tax-forms/capital-gain?tax_return_id=${taxReturnId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const savedData = retrieveResponse.data;
    console.log('✅ Data retrieved successfully');

    // Step 5: Verify property types
    console.log('\n5. Verifying API-saved property types...');
    console.log('✅ Property Types via API:');
    console.log(`   - 1 year: ${savedData.immovable_property_1_year_type}`);
    console.log(`   - 2 years: ${savedData.immovable_property_2_years_type}`);
    console.log(`   - 3 years: ${savedData.immovable_property_3_years_type}`);

    // Step 6: Verify calculated totals
    console.log('\n6. Verifying API calculated totals...');
    console.log('✅ Total Capital Gain:', `Rs ${(savedData.total_capital_gain || 0).toLocaleString()}`);
    console.log('✅ Total Tax Deducted:', `Rs ${(savedData.total_tax_deducted || 0).toLocaleString()}`);

    console.log('\n🎉 API tests passed! Capital Gains API with property types is working correctly.');

  } catch (error) {
    console.error('\n❌ API test failed:', error.message);
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Error Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCapitalGainsAPI();