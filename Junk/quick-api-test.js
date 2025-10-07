#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function quickTest() {
  try {
    // 1. Login
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'khurramj@taxadvisor.pk',
      password: 'password123'
    });

    const token = loginResponse.data.token;
    console.log('✅ Login successful');

    // 2. Test Income Form API
    console.log('\n2. Testing Income Form API...');

    // Create income form
    const createResponse = await axios.post(
      `${BASE_URL}/api/income-form/2025-26`,
      {
        monthly_basic_salary: 150000,
        monthly_allowances: 50000,
        directorship_fee: 500000
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('Create Response Status:', createResponse.status);
    console.log('Create Response Keys:', Object.keys(createResponse.data));
    console.log('Create Response Sample:', JSON.stringify(createResponse.data, null, 2).substring(0, 500));

    // Retrieve income form
    const getResponse = await axios.get(
      `${BASE_URL}/api/income-form/2025-26`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('\nGet Response Status:', getResponse.status);
    console.log('Get Response Keys:', Object.keys(getResponse.data));
    console.log('Get Response Sample:', JSON.stringify(getResponse.data, null, 2).substring(0, 500));

    // 3. Test Adjustable Tax Form API
    console.log('\n3. Testing Adjustable Tax Form API...');

    const adjustableResponse = await axios.post(
      `${BASE_URL}/api/tax-forms/adjustable-tax`,
      {
        directorship_fee_149_3_gross_receipt: 500000,
        profit_debt_15_percent_gross_receipt: 250000
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('Adjustable Create Response Status:', adjustableResponse.status);
    console.log('Adjustable Create Response Keys:', Object.keys(adjustableResponse.data));

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

quickTest();