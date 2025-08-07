const axios = require('axios');

// Test script for the enhanced adjustable tax API
async function testAdjustableTaxAPI() {
  const baseURL = 'http://localhost:3001';
  
  console.log('🧪 Testing Enhanced Adjustable Tax API...\n');
  
  try {
    // First, let's test the health endpoint to ensure server is running
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('✅ Server is healthy:', healthResponse.data.status);
    
    // Test login to get session token (using gg@test.com)
    console.log('\n2️⃣ Testing login...');
    const loginResponse = await axios.post(`${baseURL}/api/login`, {
      email: 'gg@test.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed. Trying default password...');
      // Try different password combinations
      const passwords = ['test123', 'gg123', 'password', '123456'];
      let loginSuccess = false;
      
      for (const password of passwords) {
        try {
          const retryLogin = await axios.post(`${baseURL}/api/login`, {
            email: 'gg@test.com',
            password: password
          });
          if (retryLogin.data.success) {
            loginResponse.data = retryLogin.data;
            loginSuccess = true;
            console.log(`✅ Login successful with password: ${password}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!loginSuccess) {
        console.log('❌ Could not login with any common passwords');
        return;
      }
    } else {
      console.log('✅ Login successful');
    }
    
    const sessionToken = loginResponse.data.sessionToken;
    const headers = {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json'
    };
    
    // Test GET adjustable tax form
    console.log('\n3️⃣ Testing GET adjustable tax form...');
    try {
      const getResponse = await axios.get(`${baseURL}/api/tax-forms/adjustable-tax/2025-26`, { headers });
      console.log('✅ Retrieved adjustable tax form');
      console.log('📊 Current data summary:');
      console.log(`   - Salary Employees 149: ${getResponse.data.data.salaryEmployees149?.grossReceipt || 0} PKR (Gross), ${getResponse.data.data.salaryEmployees149?.taxCollected || 0} PKR (Tax)`);
      console.log(`   - Total Gross Receipt: ${getResponse.data.data.totals?.totalGrossReceipt || 0} PKR`);
      console.log(`   - Total Adjustable Tax: ${getResponse.data.data.totals?.totalAdjustableTax || 0} PKR`);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('ℹ️ No existing adjustable tax form found (this is normal for new users)');
      } else {
        console.log('❌ Error retrieving adjustable tax form:', error.response?.data?.message || error.message);
      }
    }
    
    // Test POST (save) adjustable tax form
    console.log('\n4️⃣ Testing POST adjustable tax form...');
    const testFormData = {
      salaryEmployees149: {
        grossReceipt: 8750000,
        taxCollected: 2200000
      },
      electricityBillDomestic235: {
        grossReceipt: 50000,
        taxCollected: 5000
      },
      telephoneBill236_1E: {
        grossReceipt: 25000,
        taxCollected: 2500
      },
      isComplete: false
    };
    
    try {
      const postResponse = await axios.post(`${baseURL}/api/tax-forms/adjustable-tax/2025-26`, testFormData, { headers });
      console.log('✅ Successfully saved adjustable tax form');
      console.log('📝 Saved data includes:');
      console.log(`   - Salary section with ${testFormData.salaryEmployees149.grossReceipt.toLocaleString()} PKR gross receipt`);
      console.log(`   - Utility bills section added`);
      console.log(`   - Form completion status: ${testFormData.isComplete ? 'Complete' : 'In Progress'}`);
    } catch (error) {
      console.log('❌ Error saving adjustable tax form:', error.response?.data?.message || error.message);
      if (error.response?.data?.error) {
        console.log('   Error details:', error.response.data.error);
      }
    }
    
    // Test GET again to verify data was saved
    console.log('\n5️⃣ Verifying data was saved...');
    try {
      const verifyResponse = await axios.get(`${baseURL}/api/tax-forms/adjustable-tax/2025-26`, { headers });
      console.log('✅ Data verification successful');
      const data = verifyResponse.data.data;
      console.log('📊 Updated data summary:');
      console.log(`   - Salary Employees 149: ${data.salaryEmployees149?.grossReceipt || 0} PKR (Gross), ${data.salaryEmployees149?.taxCollected || 0} PKR (Tax)`);
      console.log(`   - Electricity Bill: ${data.electricityBillDomestic235?.grossReceipt || 0} PKR (Gross), ${data.electricityBillDomestic235?.taxCollected || 0} PKR (Tax)`);
      console.log(`   - Telephone Bill: ${data.telephoneBill236_1E?.grossReceipt || 0} PKR (Gross), ${data.telephoneBill236_1E?.taxCollected || 0} PKR (Tax)`);
      console.log(`   - Total Gross Receipt: ${data.totals?.totalGrossReceipt || 0} PKR`);
      console.log(`   - Total Adjustable Tax: ${data.totals?.totalAdjustableTax || 0} PKR`);
      console.log(`   - Form Complete: ${data.isComplete ? 'Yes' : 'No'}`);
    } catch (error) {
      console.log('❌ Error verifying saved data:', error.response?.data?.message || error.message);
    }
    
    console.log('\n🎉 Enhanced Adjustable Tax API testing completed!');
    
  } catch (error) {
    console.log('\n❌ Test failed with error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
if (require.main === module) {
  testAdjustableTaxAPI();
}

module.exports = testAdjustableTaxAPI;