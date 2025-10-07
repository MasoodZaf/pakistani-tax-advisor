const axios = require('axios');
const jwt = require('jsonwebtoken');

async function debugIncomeFormData() {
  try {
    console.log('🔍 Debugging Income Form Data Structure...\n');

    const baseURL = 'http://localhost:3001/api';
    const testEmail = 'khurramja@taxadvisor.pk';
    const testPassword = 'password';

    // 1. Login first
    const loginResponse = await axios.post(`${baseURL}/login`, {
      email: testEmail,
      password: testPassword
    });

    const jwtToken = loginResponse.data.token;

    // 2. Get current tax return data
    const taxReturnResponse = await axios.get(`${baseURL}/tax-forms/current-return`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Full Tax Return Response Structure:');
    console.log(JSON.stringify(taxReturnResponse.data, null, 2));

    if (taxReturnResponse.data.formData?.income) {
      console.log('\n📋 Income Form Data Only:');
      const incomeData = taxReturnResponse.data.formData.income;

      // List all fields and their values
      Object.keys(incomeData).forEach(key => {
        const value = incomeData[key];
        const type = typeof value;
        console.log(`  ${key}: ${value} (${type})`);
      });

      console.log('\n🎯 User Input Fields (should be integers):');
      const userInputFields = [
        'annual_basic_salary',
        'allowances',
        'bonus',
        'medical_allowance',
        'pension_from_ex_employer',
        'employment_termination_payment',
        'retirement_from_approved_funds',
        'directorship_fee',
        'other_cash_benefits',
        'income_exempt_from_tax',
        'employer_contribution_provident',
        'taxable_car_value',
        'other_taxable_subsidies',
        'non_cash_benefit_exempt',
        'profit_on_debt_15_percent',
        'profit_on_debt_12_5_percent',
        'other_taxable_income_rent',
        'other_taxable_income_others'
      ];

      userInputFields.forEach(field => {
        if (incomeData[field] !== undefined) {
          const value = incomeData[field];
          const intValue = Math.abs(parseInt(value) || 0);
          console.log(`  ${field}: ${value} -> should be: ${intValue}`);
        }
      });

      console.log('\n📊 Calculated Fields (should NOT be populated from DB):');
      const calculatedFields = [
        'total_employment_termination',
        'total_non_cash_benefits',
        'total_other_income_min_tax',
        'total_other_income_no_min_tax',
        'employment_termination_total',
        'other_income_min_tax_total',
        'other_income_no_min_tax_total'
      ];

      calculatedFields.forEach(field => {
        if (incomeData[field] !== undefined) {
          console.log(`  ${field}: ${incomeData[field]} (should be computed, not from DB)`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Run the debug
debugIncomeFormData();