// Tax Calculation Verification Script
// This script verifies the tax calculations for our 10 comprehensive scenarios

// Test scenarios data
const scenarios = [
  {
    id: 1,
    name: "Hassan Ali - Fresh Graduate",
    taxableIncome: 720000,
    expectedTax: 3000,
    userType: 'filer'
  },
  {
    id: 2,
    name: "Ayesha Ahmed - Mid-Level Engineer", 
    taxableIncome: 1800000,
    expectedTax: 90000,
    userType: 'filer'
  },
  {
    id: 3,
    name: "Omar Sheikh - Senior Manager",
    taxableIncome: 3600000,
    expectedTax: 435000,
    userType: 'filer'
  },
  {
    id: 4,
    name: "Fatima Malik - Bank Executive",
    taxableIncome: 6000000,
    expectedTax: 1095000,
    userType: 'filer'
  },
  {
    id: 5,
    name: "Ali Raza - CEO/Director",
    taxableIncome: 12000000,
    expectedTax: 3045000,
    userType: 'filer'
  },
  {
    id: 6,
    name: "Sara Khan - Non-Filer Professional",
    taxableIncome: 2400000,
    expectedTax: 480000, // Higher non-filer rates
    userType: 'non_filer'
  },
  {
    id: 7,
    name: "Dr. Ahmed Hassan - Teacher",
    taxableIncome: 1200000,
    expectedTax: 15000, // After teacher reduction
    userType: 'filer'
  },
  {
    id: 8,
    name: "Muhammad Tariq - Business Owner",
    taxableIncome: 8400000,
    expectedTax: 1737500,
    userType: 'filer'
  },
  {
    id: 9,
    name: "Zain Malik - IT Consultant",
    taxableIncome: 4800000,
    expectedTax: 577500, // After export reductions
    userType: 'filer'
  },
  {
    id: 10,
    name: "Imran Shah - Wealthy Investor",
    taxableIncome: 15600000,
    expectedTax: 4449000,
    userType: 'filer'
  }
];

// Manual tax calculation function for verification
function calculateTaxManually(income, userType = 'filer') {
  const slabs = userType === 'filer' ? [
    { min: 0, max: 600000, rate: 0.00 },
    { min: 600001, max: 1200000, rate: 0.025 },
    { min: 1200001, max: 2400000, rate: 0.125 },
    { min: 2400001, max: 3600000, rate: 0.225 },
    { min: 3600001, max: 6000000, rate: 0.275 },
    { min: 6000001, max: 12000000, rate: 0.325 },
    { min: 12000001, max: Infinity, rate: 0.39 }
  ] : [
    { min: 0, max: 600000, rate: 0.00 },
    { min: 600001, max: 1200000, rate: 0.05 },
    { min: 1200001, max: 2400000, rate: 0.25 },
    { min: 2400001, max: 3600000, rate: 0.45 },
    { min: 3600001, max: 6000000, rate: 0.55 },
    { min: 6000001, max: 12000000, rate: 0.65 },
    { min: 12000001, max: Infinity, rate: 0.75 }
  ];

  let totalTax = 0;
  let remainingIncome = income;

  for (const slab of slabs) {
    if (remainingIncome <= 0) break;
    
    if (income > slab.min) {
      const incomeInSlab = Math.min(remainingIncome, Math.min(slab.max, income) - slab.min);
      if (incomeInSlab > 0) {
        totalTax += incomeInSlab * slab.rate;
        remainingIncome -= incomeInSlab;
      }
    }
  }

  return Math.round(totalTax);
}

// Verification function
async function verifyTaxCalculations() {
  console.log('🧮 VERIFYING TAX CALCULATIONS FOR 10 SCENARIOS');
  console.log('='.repeat(60));
  
  let allPassed = true;
  
  for (const scenario of scenarios) {
    console.log(`\n📊 Scenario ${scenario.id}: ${scenario.name}`);
    console.log(`💰 Taxable Income: PKR ${scenario.taxableIncome.toLocaleString()}`);
    console.log(`👤 User Type: ${scenario.userType}`);
    
    // Manual calculation
    const manualTax = calculateTaxManually(scenario.taxableIncome, scenario.userType);
    console.log(`🖩  Manual Calculation: PKR ${manualTax.toLocaleString()}`);
    console.log(`📋 Expected Tax: PKR ${scenario.expectedTax.toLocaleString()}`);
    
    // Check if calculations match
    const difference = Math.abs(manualTax - scenario.expectedTax);
    const tolerance = scenario.expectedTax * 0.01; // 1% tolerance
    
    if (difference <= tolerance) {
      console.log(`✅ PASSED - Difference: PKR ${difference.toLocaleString()}`);
    } else {
      console.log(`❌ FAILED - Difference: PKR ${difference.toLocaleString()}`);
      allPassed = false;
    }
    
    // Calculate effective tax rate
    const effectiveRate = (manualTax / scenario.taxableIncome * 100).toFixed(2);
    console.log(`📈 Effective Tax Rate: ${effectiveRate}%`);
  }
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TAX CALCULATIONS VERIFIED SUCCESSFULLY!');
  } else {
    console.log('⚠️  SOME CALCULATIONS NEED REVIEW');
  }
  console.log('='.repeat(60));
  
  return allPassed;
}

// Detailed breakdown for each scenario
function showDetailedBreakdown() {
  console.log('\n📋 DETAILED TAX BREAKDOWN FOR EACH SCENARIO');
  console.log('='.repeat(80));
  
  scenarios.forEach(scenario => {
    console.log(`\n🔍 Scenario ${scenario.id}: ${scenario.name}`);
    console.log(`💰 Income: PKR ${scenario.taxableIncome.toLocaleString()}`);
    
    const slabs = scenario.userType === 'filer' ? [
      { name: 'Tax Free (0 - 600K)', min: 0, max: 600000, rate: 0.00 },
      { name: 'Low Income (600K - 1.2M)', min: 600001, max: 1200000, rate: 0.025 },
      { name: 'Medium 1 (1.2M - 2.4M)', min: 1200001, max: 2400000, rate: 0.125 },
      { name: 'Medium 2 (2.4M - 3.6M)', min: 2400001, max: 3600000, rate: 0.225 },
      { name: 'High 1 (3.6M - 6M)', min: 3600001, max: 6000000, rate: 0.275 },
      { name: 'High 2 (6M - 12M)', min: 6000001, max: 12000000, rate: 0.325 },
      { name: 'Super High (12M+)', min: 12000001, max: Infinity, rate: 0.39 }
    ] : [
      { name: 'Non-Filer Tax Free', min: 0, max: 600000, rate: 0.00 },
      { name: 'Non-Filer Low', min: 600001, max: 1200000, rate: 0.05 },
      { name: 'Non-Filer Medium 1', min: 1200001, max: 2400000, rate: 0.25 },
      { name: 'Non-Filer Medium 2', min: 2400001, max: 3600000, rate: 0.45 },
      { name: 'Non-Filer High 1', min: 3600001, max: 6000000, rate: 0.55 },
      { name: 'Non-Filer High 2', min: 6000001, max: 12000000, rate: 0.65 },
      { name: 'Non-Filer Super', min: 12000001, max: Infinity, rate: 0.75 }
    ];
    
    let totalTax = 0;
    let remainingIncome = scenario.taxableIncome;
    
    slabs.forEach(slab => {
      if (remainingIncome <= 0) return;
      
      if (scenario.taxableIncome > slab.min) {
        const incomeInSlab = Math.min(remainingIncome, Math.min(slab.max, scenario.taxableIncome) - slab.min);
        if (incomeInSlab > 0) {
          const taxInSlab = incomeInSlab * slab.rate;
          totalTax += taxInSlab;
          remainingIncome -= incomeInSlab;
          
          console.log(`   ${slab.name}: PKR ${incomeInSlab.toLocaleString()} × ${(slab.rate * 100).toFixed(1)}% = PKR ${Math.round(taxInSlab).toLocaleString()}`);
        }
      }
    });
    
    console.log(`   💳 Total Tax: PKR ${Math.round(totalTax).toLocaleString()}`);
    console.log(`   📊 Effective Rate: ${(totalTax / scenario.taxableIncome * 100).toFixed(2)}%`);
  });
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    verifyTaxCalculations,
    showDetailedBreakdown,
    scenarios
  };
}

// Run verification if script is executed directly
if (require.main === module) {
  verifyTaxCalculations().then(result => {
    if (result) {
      showDetailedBreakdown();
    }
  });
}