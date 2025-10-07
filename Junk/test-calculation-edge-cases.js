const TaxCalculator = require('./src/utils/taxCalculator');
const ValidationMiddleware = require('./src/middleware/validation');

console.log('=== Testing Tax Calculation Edge Cases ===\n');

// Test 1: String concatenation vulnerability
console.log('Test 1: String vs Numeric Operations');
const testData1 = {
  income: {
    monthly_salary: "150000.00",    // String from database
    bonus: "50000.00",              // String from database
    car_allowance: "25000.00",      // String from database
    other_taxable: "10000.00",      // String from database
    medical_allowance: "15000.00",  // String from database
    employer_contribution: "12000.00", // String from database
    other_exempt: "8000.00",        // String from database
    other_sources: "5000.00"        // String from database
  },
  adjustableTax: {},
  reductions: {},
  credits: {},
  deductions: {},
  finalTax: {},
  capitalGain: {}
};

// Test raw concatenation (old bug)
const rawConcatenation = testData1.income.monthly_salary + testData1.income.bonus;
console.log('Raw concatenation result:', rawConcatenation);
console.log('Type:', typeof rawConcatenation);

// Test proper numeric conversion
const properAddition = parseFloat(testData1.income.monthly_salary) + parseFloat(testData1.income.bonus);
console.log('Proper numeric addition:', properAddition);
console.log('Type:', typeof properAddition);
console.log();

// Test 2: Validation middleware
console.log('Test 2: Input Validation');

// Valid input
const validInput = {
  monthly_salary: "150000",
  bonus: "25000.50",
  car_allowance: "12000"
};

Object.entries(validInput).forEach(([field, value]) => {
  const validation = ValidationMiddleware.validateNumeric(value, field);
  console.log(`${field}: ${value} -> Valid: ${validation.isValid}, Sanitized: ${validation.sanitized}`);
});

console.log();

// Invalid inputs
const invalidInputs = {
  monthly_salary: "not_a_number",
  bonus: "-5000",  // Negative value
  car_allowance: "999999999999"  // Too large
};

Object.entries(invalidInputs).forEach(([field, value]) => {
  const validation = ValidationMiddleware.validateNumeric(value, field, { min: 0, max: 120000000 });
  console.log(`${field}: ${value} -> Valid: ${validation.isValid}, Error: ${validation.error}`);
});

console.log();

// Test 3: Edge case values
console.log('Test 3: Edge Case Values');

const edgeCases = [
  { value: null, description: 'null value' },
  { value: undefined, description: 'undefined value' },
  { value: "", description: 'empty string' },
  { value: "0", description: 'zero string' },
  { value: 0, description: 'zero number' },
  { value: "0.00", description: 'zero decimal string' },
  { value: "150000.999", description: 'many decimals' },
  { value: " 25000 ", description: 'whitespace padded' },
  { value: "25,000", description: 'comma formatted' },
  { value: "1e6", description: 'scientific notation' }
];

edgeCases.forEach(testCase => {
  const validation = ValidationMiddleware.validateNumeric(testCase.value, 'test_field');
  console.log(`${testCase.description}: ${testCase.value} -> Valid: ${validation.isValid}, Sanitized: ${validation.sanitized}, Error: ${validation.error || 'None'}`);
});

console.log();

// Test 4: Comprehensive tax calculation with edge cases
console.log('Test 4: Tax Calculation with Mixed Data Types');

async function testTaxCalculation() {
  try {
    // Simulate mixed data types from database
    const mixedTypeData = {
      income: {
        monthly_salary: "1200000",     // String
        bonus: 150000,                 // Number
        car_allowance: "50000.50",     // String with decimal
        other_taxable: null,           // Null
        medical_allowance: "25000",    // String
        employer_contribution: "20000", // String
        other_exempt: "10000",         // String
        other_sources: 0               // Zero
      },
      adjustableTax: {
        profit_on_debt_tax: "5000.00", // String
        electricity_tax: 2500,         // Number
        phone_tax: null                // Null
      },
      reductions: {},
      credits: {
        charitable_donation: "15000.50", // String
        pension_contribution: 8000       // Number
      },
      deductions: {
        zakat_paid_amount: "12000",    // String
        professional_expenses_amount: 25000 // Number
      },
      finalTax: {},
      capitalGain: {}
    };

    // This would normally cause string concatenation issues without parseFloat()
    const calculation = await TaxCalculator.calculateComprehensiveTax(
      mixedTypeData,
      '229805e2-9e8c-458e-97d0-b5f92e5693f1',
      'filer'
    );

    console.log('Tax calculation completed successfully with mixed data types');
    console.log('Gross Income:', calculation.grossIncome);
    console.log('Taxable Income:', calculation.taxableIncome);
    console.log('Normal Tax:', calculation.normalTax);
    console.log();

  } catch (error) {
    console.log('Tax calculation failed with error:', error.message);
    console.log();
  }
}

// Test 5: Sanitization function
console.log('Test 5: General Sanitization');

const unsanitizedData = {
  monthly_salary: "150000.999",
  bonus: "50000",
  car_allowance: 25000.12345,
  invalid_field: "not_a_number",
  null_field: null,
  empty_field: "",
  description: "This is text"
};

const sanitized = ValidationMiddleware.sanitizeAllNumericFields(unsanitizedData);
console.log('Original data:', unsanitizedData);
console.log('Sanitized data:', sanitized);
console.log();

// Run the async test
testTaxCalculation().then(() => {
  console.log('=== All Edge Case Tests Completed ===');
}).catch(error => {
  console.error('Test execution failed:', error);
});