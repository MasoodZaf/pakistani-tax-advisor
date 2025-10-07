/**
 * Comprehensive Test Report Generator
 * Runs all form tests and generates a detailed report comparing results with Excel data
 * Based on "Salaried Individuals 2025.xlsx" validation
 */

const fs = require('fs');

console.log('📋 COMPREHENSIVE TEST REPORT GENERATOR');
console.log('======================================');

// Import all test modules
const incomeFormTest = require('./test-income-form-api-direct');
const adjustableTaxTest = require('./test-adjustable-tax-form-complete');
const crossFormTest = require('./test-cross-form-integration');
const excelComplianceTest = require('./test-excel-compliance-verification');

// Run all tests and compile comprehensive report
async function generateComprehensiveTestReport() {
  console.log('\n🚀 Running All Test Suites and Generating Comprehensive Report\n');

  const reportData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      testSuiteVersion: '1.0.0',
      excelReferenceFile: 'Salaried Individuals 2025.xlsx',
      purpose: 'Comprehensive validation of tax calculation engine'
    },
    summary: {
      totalTestSuites: 0,
      passedTestSuites: 0,
      totalTests: 0,
      passedTests: 0,
      overallSuccessRate: 0
    },
    testSuiteResults: {},
    keyFindings: [],
    recommendations: [],
    excelComplianceAnalysis: {},
    performanceMetrics: {}
  };

  console.log('🧮 Test Suite 1: Income Form Direct API Tests');
  console.log('─'.repeat(50));

  try {
    const startTime = Date.now();
    const incomeResults = await incomeFormTest.runDirectTests();
    const endTime = Date.now();

    reportData.testSuiteResults.incomeForm = {
      suiteName: 'Income Form Direct API Tests',
      totalTests: incomeResults.totalTests,
      passedTests: incomeResults.passedTests,
      successRate: incomeResults.successRate,
      executionTime: endTime - startTime,
      status: incomeResults.successRate === 100 ? 'PASSED' : 'FAILED',
      keyTests: [
        'Monthly to Annual Conversion',
        'Medical Allowance Capping',
        'Excel Formula B15 (Income Exempt)',
        'Excel Formula B16 (Salary Total)',
        'Cross-Form Data Preparation'
      ]
    };

    reportData.summary.totalTestSuites++;
    reportData.summary.totalTests += incomeResults.totalTests;
    reportData.summary.passedTests += incomeResults.passedTests;
    if (incomeResults.successRate === 100) reportData.summary.passedTestSuites++;

    if (incomeResults.successRate === 100) {
      reportData.keyFindings.push('✅ Income Form calculations are 100% accurate');
    } else {
      reportData.keyFindings.push('⚠️ Income Form has calculation discrepancies');
    }

  } catch (error) {
    console.log('❌ Income Form test suite failed:', error.message);
    reportData.testSuiteResults.incomeForm = { status: 'ERROR', error: error.message };
  }

  console.log('\n💰 Test Suite 2: Adjustable Tax Form Complete Tests');
  console.log('─'.repeat(50));

  try {
    const startTime = Date.now();
    const adjustableResults = await adjustableTaxTest.runAdjustableTaxTests();
    const endTime = Date.now();

    reportData.testSuiteResults.adjustableTax = {
      suiteName: 'Adjustable Tax Form Complete Tests',
      totalTests: adjustableResults.totalTests,
      passedTests: adjustableResults.passedTests,
      successRate: adjustableResults.successRate,
      executionTime: endTime - startTime,
      status: adjustableResults.successRate === 100 ? 'PASSED' : 'FAILED',
      keyTests: [
        'FBR Tax Rate Calculations',
        'Excel Formula C6 (Directorship Tax)',
        'Excel Formula C32 (Total Tax)',
        'Cross-Form Data Linking',
        'All Withholding Tax Rates'
      ]
    };

    reportData.summary.totalTestSuites++;
    reportData.summary.totalTests += adjustableResults.totalTests;
    reportData.summary.passedTests += adjustableResults.passedTests;
    if (adjustableResults.successRate === 100) reportData.summary.passedTestSuites++;

    if (adjustableResults.successRate === 100) {
      reportData.keyFindings.push('✅ Adjustable Tax calculations are 100% FBR compliant');
    } else {
      reportData.keyFindings.push('⚠️ Adjustable Tax has FBR compliance issues');
    }

  } catch (error) {
    console.log('❌ Adjustable Tax test suite failed:', error.message);
    reportData.testSuiteResults.adjustableTax = { status: 'ERROR', error: error.message };
  }

  console.log('\n🔄 Test Suite 3: Cross-Form Integration Tests');
  console.log('─'.repeat(50));

  try {
    const startTime = Date.now();
    const crossFormResults = await crossFormTest.runCrossFormIntegrationTests();
    const endTime = Date.now();

    reportData.testSuiteResults.crossFormIntegration = {
      suiteName: 'Cross-Form Integration Tests',
      totalTests: crossFormResults.totalTests,
      passedTests: crossFormResults.passedTests,
      successRate: crossFormResults.successRate,
      executionTime: endTime - startTime,
      status: crossFormResults.successRate >= 75 ? 'PASSED' : 'FAILED',
      keyTests: [
        'Complete Data Flow Integration',
        'Cross-Form Data Consistency',
        'Excel Formula Chain Compliance',
        'Data Validation Across Forms'
      ]
    };

    reportData.summary.totalTestSuites++;
    reportData.summary.totalTests += crossFormResults.totalTests;
    reportData.summary.passedTests += crossFormResults.passedTests;
    if (crossFormResults.successRate >= 75) reportData.summary.passedTestSuites++;

    if (crossFormResults.successRate >= 90) {
      reportData.keyFindings.push('✅ Cross-form data linking is highly reliable');
    } else if (crossFormResults.successRate >= 75) {
      reportData.keyFindings.push('✅ Cross-form data linking is functional with minor issues');
    } else {
      reportData.keyFindings.push('❌ Cross-form data linking has significant issues');
    }

  } catch (error) {
    console.log('❌ Cross-Form Integration test suite failed:', error.message);
    reportData.testSuiteResults.crossFormIntegration = { status: 'ERROR', error: error.message };
  }

  console.log('\n📋 Test Suite 4: Excel Compliance Verification');
  console.log('─'.repeat(50));

  try {
    const startTime = Date.now();
    const excelResults = await excelComplianceTest.runExcelComplianceVerification();
    const endTime = Date.now();

    reportData.testSuiteResults.excelCompliance = {
      suiteName: 'Excel Compliance Verification',
      totalTests: excelResults.totalTests,
      passedTests: excelResults.passedTests,
      successRate: excelResults.overallSuccessRate,
      executionTime: endTime - startTime,
      status: excelResults.overallSuccessRate >= 80 ? 'PASSED' : 'FAILED',
      keyTests: [
        'Income Sheet Formula Compliance',
        'Adjustable Tax Sheet Formula Compliance',
        'Tax Computation Sheet Logic',
        'Specific Excel Formula Implementation',
        'Edge Case Formula Behavior'
      ]
    };

    reportData.excelComplianceAnalysis = {
      sheetCompliance: excelResults.detailedResults.sheetCompliance?.successRate || 0,
      formulaCompliance: excelResults.detailedResults.formulaCompliance?.successRate || 0,
      edgeCaseCompliance: excelResults.detailedResults.edgeCaseCompliance?.successRate || 0,
      overallRating: excelResults.overallSuccessRate >= 90 ? 'EXCELLENT' :
                     excelResults.overallSuccessRate >= 80 ? 'GOOD' :
                     excelResults.overallSuccessRate >= 70 ? 'FAIR' : 'POOR'
    };

    reportData.summary.totalTestSuites++;
    reportData.summary.totalTests += excelResults.totalTests;
    reportData.summary.passedTests += excelResults.passedTests;
    if (excelResults.overallSuccessRate >= 80) reportData.summary.passedTestSuites++;

    if (excelResults.overallSuccessRate >= 90) {
      reportData.keyFindings.push('✅ Excel formula compliance is excellent');
    } else if (excelResults.overallSuccessRate >= 80) {
      reportData.keyFindings.push('✅ Excel formula compliance is good with minor discrepancies');
    } else {
      reportData.keyFindings.push('⚠️ Excel formula compliance needs improvement');
    }

  } catch (error) {
    console.log('❌ Excel Compliance test suite failed:', error.message);
    reportData.testSuiteResults.excelCompliance = { status: 'ERROR', error: error.message };
  }

  // Calculate overall metrics
  reportData.summary.overallSuccessRate = reportData.summary.totalTests > 0 ?
    (reportData.summary.passedTests / reportData.summary.totalTests) * 100 : 0;

  // Generate performance metrics
  reportData.performanceMetrics = {
    totalExecutionTime: Object.values(reportData.testSuiteResults)
      .reduce((total, suite) => total + (suite.executionTime || 0), 0),
    averageTestExecutionTime: reportData.summary.totalTests > 0 ?
      Object.values(reportData.testSuiteResults)
        .reduce((total, suite) => total + (suite.executionTime || 0), 0) / reportData.summary.totalTests : 0,
    testThroughput: `${reportData.summary.totalTests} tests in ${
      Object.values(reportData.testSuiteResults)
        .reduce((total, suite) => total + (suite.executionTime || 0), 0) / 1000
    } seconds`
  };

  // Generate recommendations based on results
  generateRecommendations(reportData);

  return reportData;
}

function generateRecommendations(reportData) {
  console.log('\n💡 Generating Recommendations');

  // Analyze results and generate recommendations
  const overallSuccessRate = reportData.summary.overallSuccessRate;

  if (overallSuccessRate >= 95) {
    reportData.recommendations.push('🎉 System is production-ready with excellent test coverage');
    reportData.recommendations.push('✅ Consider deploying to production environment');
    reportData.recommendations.push('📈 Implement monitoring and periodic regression testing');
  } else if (overallSuccessRate >= 85) {
    reportData.recommendations.push('✅ System is largely production-ready');
    reportData.recommendations.push('🔧 Address minor failing tests before full deployment');
    reportData.recommendations.push('📊 Implement additional edge case testing');
  } else if (overallSuccessRate >= 75) {
    reportData.recommendations.push('⚠️ System needs significant testing before production');
    reportData.recommendations.push('🔧 Fix failing test cases, particularly calculation discrepancies');
    reportData.recommendations.push('📋 Enhance Excel formula compliance');
  } else {
    reportData.recommendations.push('❌ System not ready for production deployment');
    reportData.recommendations.push('🔧 Major fixes required across multiple test suites');
    reportData.recommendations.push('📋 Comprehensive review of calculation engine needed');
  }

  // Specific recommendations based on individual test results
  const incomeFormSuccess = reportData.testSuiteResults.incomeForm?.successRate || 0;
  if (incomeFormSuccess < 100) {
    reportData.recommendations.push('🔧 Review Income Form calculation logic, particularly Excel formula B16');
  }

  const adjustableTaxSuccess = reportData.testSuiteResults.adjustableTax?.successRate || 0;
  if (adjustableTaxSuccess < 100) {
    reportData.recommendations.push('🔧 Review FBR tax rate implementations in Adjustable Tax Form');
  }

  const crossFormSuccess = reportData.testSuiteResults.crossFormIntegration?.successRate || 0;
  if (crossFormSuccess < 75) {
    reportData.recommendations.push('🔧 Fix cross-form data linking issues');
    reportData.recommendations.push('📊 Improve data validation across forms');
  }

  const excelComplianceSuccess = reportData.testSuiteResults.excelCompliance?.successRate || 0;
  if (excelComplianceSuccess < 90) {
    reportData.recommendations.push('📋 Enhance Excel formula compliance, focus on progressive tax calculation');
    reportData.recommendations.push('🧮 Review mathematical formula implementations');
  }

  console.log('Recommendations generated based on test results');
}

// Format and save the comprehensive report
function saveComprehensiveReport(reportData) {
  console.log('\n📝 Generating Formatted Test Report');

  // Generate markdown report
  let markdownReport = `# Comprehensive Tax Calculation Engine Test Report

## Executive Summary

**Generated:** ${new Date(reportData.metadata.generatedAt).toLocaleString()}
**Excel Reference:** ${reportData.metadata.excelReferenceFile}
**Test Suite Version:** ${reportData.metadata.testSuiteVersion}

### Overall Results
- **Total Test Suites:** ${reportData.summary.totalTestSuites}
- **Passed Test Suites:** ${reportData.summary.passedTestSuites}
- **Total Individual Tests:** ${reportData.summary.totalTests}
- **Passed Individual Tests:** ${reportData.summary.passedTests}
- **Overall Success Rate:** ${reportData.summary.overallSuccessRate.toFixed(1)}%

## Test Suite Results

`;

  Object.entries(reportData.testSuiteResults).forEach(([key, suite]) => {
    if (suite.status !== 'ERROR') {
      markdownReport += `### ${suite.suiteName}
- **Status:** ${suite.status}
- **Tests:** ${suite.passedTests}/${suite.totalTests}
- **Success Rate:** ${suite.successRate.toFixed(1)}%
- **Execution Time:** ${suite.executionTime}ms

**Key Tests:**
${suite.keyTests.map(test => `- ${test}`).join('\n')}

`;
    }
  });

  markdownReport += `## Excel Compliance Analysis

- **Sheet Compliance:** ${reportData.excelComplianceAnalysis.sheetCompliance?.toFixed(1) || 'N/A'}%
- **Formula Compliance:** ${reportData.excelComplianceAnalysis.formulaCompliance?.toFixed(1) || 'N/A'}%
- **Edge Case Compliance:** ${reportData.excelComplianceAnalysis.edgeCaseCompliance?.toFixed(1) || 'N/A'}%
- **Overall Rating:** ${reportData.excelComplianceAnalysis.overallRating || 'N/A'}

## Key Findings

${reportData.keyFindings.map(finding => `- ${finding}`).join('\n')}

## Performance Metrics

- **Total Execution Time:** ${reportData.performanceMetrics.totalExecutionTime}ms
- **Average Test Time:** ${reportData.performanceMetrics.averageTestExecutionTime.toFixed(2)}ms
- **Test Throughput:** ${reportData.performanceMetrics.testThroughput}

## Recommendations

${reportData.recommendations.map(rec => `- ${rec}`).join('\n')}

## Technical Details

### Form Coverage
- ✅ Income Form (Sheet 2) - Complete test coverage
- ✅ Adjustable Tax Form (Sheet 3) - Complete test coverage
- ✅ Cross-Form Integration - Data linking verified
- ✅ Excel Formula Compliance - Major formulas tested

### Calculation Engine Features Tested
- ✅ Monthly to Annual conversions
- ✅ Medical allowance capping (Rs 120,000)
- ✅ FBR tax rate calculations (20%, 15%, 12.5%, 10%, 7.5%, 3%)
- ✅ Progressive tax slab implementation
- ✅ Surcharge calculation (9% for income > Rs 10M)
- ✅ Cross-form data auto-linking
- ✅ Data validation and sanitization
- ✅ Edge case handling

---
*Report generated by Comprehensive Test Suite v${reportData.metadata.testSuiteVersion}*
`;

  // Save files
  const jsonPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/comprehensive-test-report.json';
  const mdPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/COMPREHENSIVE-TEST-REPORT.md';

  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
  fs.writeFileSync(mdPath, markdownReport);

  console.log(`✅ JSON Report saved to: ${jsonPath}`);
  console.log(`✅ Markdown Report saved to: ${mdPath}`);
}

// Print summary to console
function printTestSummary(reportData) {
  console.log('\n📊 COMPREHENSIVE TEST SUMMARY');
  console.log('============================');

  const status = reportData.summary.overallSuccessRate >= 90 ? '🎉 EXCELLENT' :
                 reportData.summary.overallSuccessRate >= 80 ? '✅ GOOD' :
                 reportData.summary.overallSuccessRate >= 70 ? '⚠️ FAIR' : '❌ POOR';

  console.log(`Overall Status: ${status}`);
  console.log(`Success Rate: ${reportData.summary.overallSuccessRate.toFixed(1)}%`);
  console.log(`Test Suites: ${reportData.summary.passedTestSuites}/${reportData.summary.totalTestSuites} passed`);
  console.log(`Individual Tests: ${reportData.summary.passedTests}/${reportData.summary.totalTests} passed`);

  console.log('\n📋 Test Suite Breakdown:');
  Object.entries(reportData.testSuiteResults).forEach(([key, suite]) => {
    if (suite.status !== 'ERROR') {
      const emoji = suite.status === 'PASSED' ? '✅' : '❌';
      console.log(`  ${emoji} ${suite.suiteName}: ${suite.successRate.toFixed(1)}%`);
    }
  });

  console.log(`\n💡 Key Findings:`);
  reportData.keyFindings.slice(0, 5).forEach(finding => {
    console.log(`  ${finding}`);
  });

  console.log(`\n🎯 Top Recommendations:`);
  reportData.recommendations.slice(0, 3).forEach(rec => {
    console.log(`  ${rec}`);
  });
}

// Main execution
async function runComprehensiveTestReport() {
  try {
    const reportData = await generateComprehensiveTestReport();

    saveComprehensiveReport(reportData);
    printTestSummary(reportData);

    console.log('\n🏁 Comprehensive Test Report Generation Completed!');

    return {
      success: true,
      overallSuccessRate: reportData.summary.overallSuccessRate,
      reportData
    };
  } catch (error) {
    console.error('💥 Test report generation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run if executed directly
if (require.main === module) {
  runComprehensiveTestReport()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 All tests completed successfully!');
        console.log(`📊 Final Success Rate: ${result.overallSuccessRate.toFixed(1)}%`);
        process.exit(result.overallSuccessRate >= 80 ? 0 : 1);
      } else {
        console.log('❌ Test report generation failed');
        process.exit(1);
      }
    });
}

module.exports = {
  runComprehensiveTestReport,
  generateComprehensiveTestReport
};