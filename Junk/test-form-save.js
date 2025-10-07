// Test script to debug form save functionality
const axios = require('axios');

async function testFormSave() {
  try {
    console.log('Testing form save functionality...');

    // First, login to get a valid token
    console.log('Step 1: Login to get token...');
    const loginResponse = await axios.post('http://localhost:3001/api/login', {
      email: 'khurramj@taxadvisor.pk',
      password: 'khurram123'
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');

    // Get current tax return
    console.log('Step 2: Getting current tax return...');
    const taxReturnResponse = await axios.get('http://localhost:3001/api/tax-forms/current-return', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const taxReturnId = taxReturnResponse.data.taxReturn?.id;
    if (!taxReturnId) {
      console.error('No tax return ID found');
      return;
    }

    console.log('✅ Tax return ID:', taxReturnId);

    // Test saving income form data
    console.log('Step 3: Testing income form save...');
    const saveResponse = await axios.post('http://localhost:3001/api/tax-forms/income_forms', {
      taxReturnId: taxReturnId,
      salary: 100000,
      bonus: 10000,
      allowances: 5000
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Save successful:', saveResponse.data);

  } catch (error) {
    console.error('❌ Error during test:');
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  }
}

testFormSave();