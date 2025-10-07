/**
 * Comprehensive Mock Data Sets for Form Testing
 * Based on "Salaried Individuals 2025.xlsx" user input fields analysis
 */

const fs = require('fs');

console.log('🎭 CREATING COMPREHENSIVE MOCK DATA SETS');
console.log('========================================');

// Load the Excel analysis data
let excelAnalysis = {};
try {
  const analysisPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/excel-user-input-analysis.json';
  excelAnalysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
  console.log('✅ Loaded Excel analysis data');
} catch (error) {
  console.log('⚠️ Could not load Excel analysis, using default data');
}

/**
 * Mock Data Sets based on Excel User Input Fields
 */
const mockDataSets = {
  // Test User Accounts
  testUsers: {
    basicSalaried: {
      email: 'basic.salaried@test.com',
      name: 'Muhammad Ahmed',
      password: 'TestPassword123',
      user_type: 'individual',
      role: 'user'
    },
    midProfessional: {
      email: 'mid.professional@test.com',
      name: 'Fatima Khan',
      password: 'TestPassword123',
      user_type: 'individual',
      role: 'user'
    },
    highExecutive: {
      email: 'high.executive@test.com',
      name: 'Ali Hassan',
      password: 'TestPassword123',
      user_type: 'individual',
      role: 'user'
    }
  },

  // Income Form Test Data (Sheet 2)
  incomeFormData: {
    basicSalaried: {
      // Monthly inputs that convert to annual
      monthly_basic_salary: 50000,         // 600K annually
      monthly_allowances: 8000,            // 96K annually
      monthly_house_rent_allowance: 15000, // 180K annually
      monthly_conveyance_allowance: 2000,  // 24K annually
      monthly_medical_allowance: 3000,     // 36K annually (capped at 120K)

      // Annual inputs
      bonus: 50000,
      directorship_fee: 0,
      pension_from_ex_employer: 0,
      employment_termination_payment: 0,
      retirement_from_approved_funds: 0,
      other_cash_benefits: 0,

      // Expected calculated fields
      expected: {
        annual_basic_salary: 600000,
        annual_allowances: 96000,
        annual_medical_allowance: 36000,  // Under cap
        income_exempt_from_tax: -36000,   // -(medical allowance)
        annual_salary_wages_total: 756000, // Sum of all salary components
        total_employment_income: 756000
      }
    },

    midProfessional: {
      // Based on Excel extracted values
      monthly_basic_salary: 150000,        // 1.8M annually
      monthly_allowances: 25000,           // 300K annually
      monthly_house_rent_allowance: 40000, // 480K annually
      monthly_conveyance_allowance: 5000,  // 60K annually
      monthly_medical_allowance: 10000,    // 120K annually (capped)

      // Annual inputs from Excel
      bonus: 500000,
      directorship_fee: 1000000,          // From Excel: significant directorship
      pension_from_ex_employer: 0,
      employment_termination_payment: 0,
      retirement_from_approved_funds: 0,
      other_cash_benefits: 100000,

      // Expected calculated fields
      expected: {
        annual_basic_salary: 1800000,
        annual_allowances: 300000,
        annual_medical_allowance: 120000,  // Capped at max
        income_exempt_from_tax: -120000,   // -(medical allowance)
        annual_salary_wages_total: 3140000, // All components sum
        total_employment_income: 3140000
      }
    },

    highExecutive: {
      // High-income scenario from Excel patterns
      monthly_basic_salary: 600000,        // 7.2M annually (Excel shows ~7.2M)
      monthly_allowances: 50000,           // 600K annually
      monthly_house_rent_allowance: 100000,// 1.2M annually
      monthly_conveyance_allowance: 10000, // 120K annually
      monthly_medical_allowance: 15000,    // 120K annually (capped)

      // Annual high-value inputs
      bonus: 1500000,                      // Excel shows 1.5M bonus
      directorship_fee: 3000000,          // Excel shows significant directorship
      pension_from_ex_employer: 200000,
      employment_termination_payment: 0,
      retirement_from_approved_funds: 0,
      other_cash_benefits: 500000,

      // Expected calculated fields
      expected: {
        annual_basic_salary: 7200000,
        annual_allowances: 600000,
        annual_medical_allowance: 120000,  // Capped
        income_exempt_from_tax: -320000,   // -(medical + pension)
        annual_salary_wages_total: 10620000,
        total_employment_income: 10620000
      }
    }
  },

  // Adjustable Tax Form Test Data (Sheet 3)
  adjustableTaxFormData: {
    basicSalaried: {
      // Withholding tax receipts and tax collected
      directorship_fee_149_3_gross_receipt: 0,
      directorship_fee_149_3_tax_collected: 0,
      profit_debt_15_percent_gross_receipt: 25000,
      profit_debt_15_percent_tax_collected: 3750,    // 15% of 25K
      sukook_12_5_percent_gross_receipt: 0,
      sukook_12_5_percent_tax_collected: 0,
      rent_section_155_gross_receipt: 0,
      rent_section_155_tax_collected: 0,
      motor_vehicle_transfer_gross_receipt: 0,
      motor_vehicle_transfer_tax_collected: 0,
      electricity_domestic_gross_receipt: 15000,
      electricity_domestic_tax_collected: 1125,      // 7.5% of 15K
      cellphone_bill_gross_receipt: 10000,
      cellphone_bill_tax_collected: 1500,           // 15% of 10K

      expected: {
        total_gross_receipt: 50000,
        total_tax_collected: 6375
      }
    },

    midProfessional: {
      // Auto-linked from income form + additional withholdings
      directorship_fee_149_3_gross_receipt: 1000000, // Linked from income
      directorship_fee_149_3_tax_collected: 200000,  // 20% of 1M
      profit_debt_15_percent_gross_receipt: 100000,
      profit_debt_15_percent_tax_collected: 15000,   // 15% of 100K
      sukook_12_5_percent_gross_receipt: 50000,
      sukook_12_5_percent_tax_collected: 6250,       // 12.5% of 50K
      rent_section_155_gross_receipt: 200000,
      rent_section_155_tax_collected: 20000,         // 10% of 200K
      motor_vehicle_transfer_gross_receipt: 500000,
      motor_vehicle_transfer_tax_collected: 15000,   // 3% of 500K
      electricity_domestic_gross_receipt: 50000,
      electricity_domestic_tax_collected: 3750,      // 7.5% of 50K
      cellphone_bill_gross_receipt: 25000,
      cellphone_bill_tax_collected: 3750,            // 15% of 25K

      expected: {
        total_gross_receipt: 1925000,
        total_tax_collected: 263750
      }
    },

    highExecutive: {
      // High-value withholdings based on Excel patterns
      directorship_fee_149_3_gross_receipt: 3000000, // Linked from income
      directorship_fee_149_3_tax_collected: 600000,  // 20% of 3M
      profit_debt_15_percent_gross_receipt: 500000,
      profit_debt_15_percent_tax_collected: 75000,   // 15% of 500K
      sukook_12_5_percent_gross_receipt: 200000,
      sukook_12_5_percent_tax_collected: 25000,      // 12.5% of 200K
      rent_section_155_gross_receipt: 1000000,
      rent_section_155_tax_collected: 100000,        // 10% of 1M
      motor_vehicle_transfer_gross_receipt: 2000000,
      motor_vehicle_transfer_tax_collected: 60000,   // 3% of 2M
      electricity_domestic_gross_receipt: 200000,
      electricity_domestic_tax_collected: 15000,     // 7.5% of 200K
      cellphone_bill_gross_receipt: 100000,
      cellphone_bill_tax_collected: 15000,           // 15% of 100K

      expected: {
        total_gross_receipt: 7000000,
        total_tax_collected: 890000
      }
    }
  },

  // Capital Gains Form Test Data (Sheet 5)
  capitalGainsFormData: {
    basicSalaried: {
      // Minimal capital gains
      property_sale_proceeds: 0,
      property_cost: 0,
      property_holding_period_months: 0,
      securities_sale_proceeds: 25000,
      securities_cost: 20000,
      securities_gain: 5000,

      expected: {
        total_capital_gains: 5000,
        capital_gains_tax: 375    // 7.5% on securities
      }
    },

    midProfessional: {
      // Property transaction from Excel
      property_sale_proceeds: 5000000,
      property_cost: 4500000,
      property_holding_period_months: 30, // 2.5 years
      property_gain: 500000,              // From Excel
      securities_sale_proceeds: 200000,
      securities_cost: 150000,
      securities_gain: 50000,

      expected: {
        total_capital_gains: 550000,
        property_tax: 125000,     // 25% for non-ATL property
        securities_tax: 3750,     // 7.5% on securities
        total_capital_gains_tax: 128750
      }
    },

    highExecutive: {
      // Multiple property and securities transactions
      property_sale_proceeds: 15000000,
      property_cost: 12000000,
      property_holding_period_months: 48, // 4 years
      property_gain: 3000000,
      securities_sale_proceeds: 1000000,
      securities_cost: 800000,
      securities_gain: 200000,

      expected: {
        total_capital_gains: 3200000,
        property_tax: 450000,     // 15% for ATL property >4 years
        securities_tax: 15000,    // 7.5% on securities
        total_capital_gains_tax: 465000
      }
    }
  },

  // Tax Computation Expected Results (Sheet 6)
  taxComputationExpected: {
    basicSalaried: {
      total_income: 761000,       // Income + Capital gains
      taxable_income: 725000,     // After exemptions
      normal_income_tax: 12500,   // Progressive rates
      surcharge: 0,               // Income < 10M
      capital_gains_tax: 375,
      total_tax_before_adjustments: 12875,
      withholding_tax: 6375,      // From adjustable tax
      net_tax_payable: 6500,
      balance_payable: 125        // Net - withholding
    },

    midProfessional: {
      total_income: 3690000,      // Income + Capital gains
      taxable_income: 3570000,    // After exemptions
      normal_income_tax: 909500,  // Progressive calculation
      surcharge: 0,               // Income < 10M
      capital_gains_tax: 128750,
      total_tax_before_adjustments: 1038250,
      withholding_tax: 263750,    // From adjustable tax
      net_tax_payable: 774500,
      balance_payable: 510750     // Net - withholding
    },

    highExecutive: {
      total_income: 13820000,     // Income + Capital gains
      taxable_income: 13500000,   // After exemptions
      normal_income_tax: 4284000, // Progressive calculation
      surcharge: 385560,          // 9% surcharge (income > 10M)
      capital_gains_tax: 465000,
      total_tax_before_adjustments: 5134560,
      withholding_tax: 890000,    // From adjustable tax
      net_tax_payable: 4244560,
      balance_payable: 3354560    // Net - withholding
    }
  },

  // Test Validation Rules
  validationRules: {
    income: {
      monthly_basic_salary: { min: 0, max: 10000000 },
      bonus: { min: 0, max: 50000000 },
      medical_allowance_cap: 120000,
      directorship_fee: { min: 0, max: 100000000 }
    },
    adjustableTax: {
      directorship_fee_rate: 0.20,
      profit_debt_15_rate: 0.15,
      sukook_rate: 0.125,
      rent_rate: 0.10,
      motor_vehicle_rate: 0.03,
      electricity_rate: 0.075,
      cellphone_rate: 0.15
    },
    capitalGains: {
      property_atl_rate_4plus_years: 0.15,
      property_non_atl_rate: 0.25,
      securities_rate: 0.075
    },
    progressive_tax_slabs: [
      { min: 0, max: 600000, rate: 0.00, fixed: 0 },
      { min: 600001, max: 1200000, rate: 0.01, fixed: 0 },
      { min: 1200001, max: 2400000, rate: 0.11, fixed: 6000 },
      { min: 2400001, max: 3600000, rate: 0.23, fixed: 138000 },
      { min: 3600001, max: 6000000, rate: 0.30, fixed: 414000 },
      { min: 6000001, max: Infinity, rate: 0.35, fixed: 1134000 }
    ],
    surcharge_threshold: 10000000,
    surcharge_rate: 0.09
  },

  // Cross-Form Data Linking Maps
  crossFormLinking: {
    incomeToAdjustableTax: {
      directorship_fee: 'directorship_fee_149_3_gross_receipt',
      profit_on_debt_15_percent: 'profit_debt_15_percent_gross_receipt',
      profit_on_debt_12_5_percent: 'sukook_12_5_percent_gross_receipt',
      other_taxable_income_rent: 'rent_section_155_gross_receipt'
    },
    incomeToTaxComputation: {
      total_employment_income: 'income_from_salary',
      annual_salary_wages_total: 'salary_income_component'
    },
    adjustableTaxToTaxComputation: {
      total_tax_collected: 'withholding_tax'
    },
    capitalGainsToTaxComputation: {
      total_capital_gains_tax: 'capital_gains_tax'
    }
  }
};

// Save mock data sets
function saveMockDataSets() {
  const outputPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/comprehensive-mock-data-sets.json';
  fs.writeFileSync(outputPath, JSON.stringify(mockDataSets, null, 2));

  console.log(`✅ Mock data sets saved to: ${outputPath}`);

  // Print summary
  console.log('\n📊 MOCK DATA SUMMARY');
  console.log('====================');
  console.log(`🧑‍💼 Test Users: ${Object.keys(mockDataSets.testUsers).length}`);
  console.log(`💰 Income Scenarios: ${Object.keys(mockDataSets.incomeFormData).length}`);
  console.log(`📋 Adjustable Tax Scenarios: ${Object.keys(mockDataSets.adjustableTaxFormData).length}`);
  console.log(`📈 Capital Gains Scenarios: ${Object.keys(mockDataSets.capitalGainsFormData).length}`);
  console.log(`🧮 Tax Computation Expected Results: ${Object.keys(mockDataSets.taxComputationExpected).length}`);

  // Show sample data
  console.log('\n💡 SAMPLE DATA PREVIEW');
  console.log('======================');
  const basicIncome = mockDataSets.incomeFormData.basicSalaried;
  console.log('Basic Salaried Income:');
  console.log(`  Monthly Salary: Rs ${basicIncome.monthly_basic_salary.toLocaleString()}`);
  console.log(`  Expected Annual: Rs ${basicIncome.expected.annual_basic_salary.toLocaleString()}`);
  console.log(`  Expected Total: Rs ${basicIncome.expected.total_employment_income.toLocaleString()}`);
}

// Generate additional edge case scenarios
function generateEdgeCaseScenarios() {
  console.log('\n🔬 Generating Edge Case Scenarios');

  mockDataSets.edgeCases = {
    zeroIncome: {
      description: 'All zero values test',
      incomeForm: Object.fromEntries(
        Object.keys(mockDataSets.incomeFormData.basicSalaried).map(key => [key, 0])
      )
    },
    maxValues: {
      description: 'Maximum allowable values test',
      incomeForm: {
        monthly_basic_salary: 1000000,    // 12M annually
        monthly_medical_allowance: 15000, // Will be capped at 120K
        bonus: 10000000,
        directorship_fee: 50000000
      }
    },
    medicalAllowanceCap: {
      description: 'Medical allowance capping test',
      incomeForm: {
        monthly_basic_salary: 100000,
        monthly_medical_allowance: 20000  // 240K annually, should cap at 120K
      }
    }
  };

  console.log(`✅ Generated ${Object.keys(mockDataSets.edgeCases).length} edge case scenarios`);
}

// Run mock data generation
if (require.main === module) {
  generateEdgeCaseScenarios();
  saveMockDataSets();
  console.log('\n🎉 Mock data generation completed successfully!');
}

module.exports = mockDataSets;