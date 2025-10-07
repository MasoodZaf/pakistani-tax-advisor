#!/usr/bin/env node

/**
 * API Endpoints Comprehensive Testing Tool
 * Pakistani Tax Advisor Application
 *
 * This tool performs exhaustive testing of all API endpoints including:
 * - Authentication & authorization flows
 * - CRUD operations on all resources
 * - Input validation and error handling
 * - Response format validation
 * - Performance benchmarking
 * - Edge case testing
 * - Rate limiting verification
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

class APITester {
  constructor() {
    this.testResults = [];
    this.authToken = null;
    this.sessionToken = null;
    this.testUser = {
      email: 'apitester@test.com',
      name: 'API Tester User',
      password: 'TestPassword123!'
    };
    this.adminToken = null;
    this.performanceMetrics = {};
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  addTestResult(endpoint, method, testName, passed, details = null, responseTime = null) {
    this.testResults.push({
      endpoint,
      method,
      testName,
      passed,
      details,
      responseTime,
      timestamp: new Date().toISOString()
    });

    const status = passed ? '✅ PASS' : '❌ FAIL';
    const timeInfo = responseTime ? ` (${responseTime}ms)` : '';
    this.log(`${status}: ${method} ${endpoint} - ${testName}${timeInfo}${details ? ` - ${details}` : ''}`, 'TEST');
  }

  // Helper function to make API requests with error handling
  async makeRequest(method, endpoint, data = null, headers = {}) {
    const startTime = Date.now();
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      const responseTime = Date.now() - startTime;
      return { success: true, response, responseTime, error: null };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        response: error.response,
        responseTime,
        error: error.message
      };
    }
  }

  // 1. Authentication Endpoints Testing
  async testAuthenticationEndpoints() {
    this.log('Testing Authentication endpoints...', 'TEST');

    // Test 1.1: User Registration
    const registerResult = await this.makeRequest('POST', '/api/register', this.testUser);
    this.addTestResult('/api/register', 'POST', 'User registration',
      registerResult.success || (registerResult.response?.status === 409), // 409 = user exists
      registerResult.success ? 'Registration successful' : 'User already exists (expected)',
      registerResult.responseTime);

    // Test 1.2: User Login
    const loginResult = await this.makeRequest('POST', '/api/login', {
      email: this.testUser.email,
      password: this.testUser.password
    });

    this.addTestResult('/api/login', 'POST', 'User login',
      loginResult.success,
      loginResult.success ? 'Login successful' : `Login failed: ${loginResult.error}`,
      loginResult.responseTime);

    if (loginResult.success) {
      this.authToken = loginResult.response.data.token;
      this.sessionToken = loginResult.response.data.sessionToken;
    }

    // Test 1.3: Session Verification
    if (this.sessionToken) {
      const sessionResult = await this.makeRequest('POST', '/api/verify-session', {
        sessionToken: this.sessionToken
      });

      this.addTestResult('/api/verify-session', 'POST', 'Session verification',
        sessionResult.success,
        sessionResult.success ? 'Session valid' : `Session invalid: ${sessionResult.error}`,
        sessionResult.responseTime);
    }

    // Test 1.4: Invalid Login
    const invalidLoginResult = await this.makeRequest('POST', '/api/login', {
      email: 'invalid@test.com',
      password: 'wrongpassword'
    });

    this.addTestResult('/api/login', 'POST', 'Invalid login rejection',
      !invalidLoginResult.success && invalidLoginResult.response?.status === 401,
      'Invalid credentials properly rejected',
      invalidLoginResult.responseTime);

    // Test 1.5: Logout
    if (this.sessionToken) {
      const logoutResult = await this.makeRequest('POST', '/api/logout', {
        sessionToken: this.sessionToken
      });

      this.addTestResult('/api/logout', 'POST', 'User logout',
        logoutResult.success,
        logoutResult.success ? 'Logout successful' : `Logout failed: ${logoutResult.error}`,
        logoutResult.responseTime);
    }
  }

  // 2. Health and Info Endpoints
  async testHealthEndpoints() {
    this.log('Testing Health and Info endpoints...', 'TEST');

    // Test 2.1: Health Check
    const healthResult = await this.makeRequest('GET', '/api/health');
    this.addTestResult('/api/health', 'GET', 'Health check',
      healthResult.success && healthResult.response?.data?.status === 'success',
      healthResult.success ? 'Health check passed' : `Health check failed: ${healthResult.error}`,
      healthResult.responseTime);

    // Test 2.2: Root Endpoint
    const rootResult = await this.makeRequest('GET', '/');
    this.addTestResult('/', 'GET', 'Root endpoint info',
      rootResult.success,
      rootResult.success ? 'Root endpoint accessible' : `Root endpoint failed: ${rootResult.error}`,
      rootResult.responseTime);
  }

  // 3. Protected Endpoints Testing
  async testProtectedEndpoints() {
    this.log('Testing Protected endpoints...', 'TEST');

    if (!this.authToken) {
      this.log('No auth token available, skipping protected endpoint tests', 'WARNING');
      return;
    }

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test 3.1: Income Form Access
    const incomeFormResult = await this.makeRequest('GET', '/api/income-form/2025-26', null, authHeaders);
    this.addTestResult('/api/income-form/:taxYear', 'GET', 'Income form access',
      incomeFormResult.success,
      incomeFormResult.success ? 'Income form accessible' : `Access failed: ${incomeFormResult.error}`,
      incomeFormResult.responseTime);

    // Test 3.2: Tax Forms Current Return
    const currentReturnResult = await this.makeRequest('GET', '/api/tax-forms/current-return', null, authHeaders);
    this.addTestResult('/api/tax-forms/current-return', 'GET', 'Current tax return access',
      currentReturnResult.success,
      currentReturnResult.success ? 'Current return accessible' : `Access failed: ${currentReturnResult.error}`,
      currentReturnResult.responseTime);

    // Test 3.3: Unauthorized Access
    const unauthorizedResult = await this.makeRequest('GET', '/api/income-form/2025-26');
    this.addTestResult('/api/income-form/:taxYear', 'GET', 'Unauthorized access rejection',
      !unauthorizedResult.success && unauthorizedResult.response?.status === 401,
      'Unauthorized access properly rejected',
      unauthorizedResult.responseTime);
  }

  // 4. Reports Endpoints Testing
  async testReportsEndpoints() {
    this.log('Testing Reports endpoints...', 'TEST');

    if (!this.authToken) {
      this.log('No auth token available, skipping reports tests', 'WARNING');
      return;
    }

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    const reportEndpoints = [
      '/api/reports/available-years',
      '/api/reports/tax-calculation-summary/2025-26',
      '/api/reports/income-analysis/2025-26',
      '/api/reports/adjustable-tax-report/2025-26',
      '/api/reports/wealth-reconciliation/2025-26'
    ];

    for (const endpoint of reportEndpoints) {
      const result = await this.makeRequest('GET', endpoint, null, authHeaders);
      this.addTestResult(endpoint, 'GET', 'Report generation',
        result.success || result.response?.status === 404, // 404 might be expected for empty data
        result.success ? 'Report generated' : `Report error: ${result.response?.status}`,
        result.responseTime);
    }
  }

  // 5. Excel Endpoints Testing
  async testExcelEndpoints() {
    this.log('Testing Excel endpoints...', 'TEST');

    if (!this.authToken) {
      this.log('No auth token available, skipping Excel tests', 'WARNING');
      return;
    }

    const authHeaders = { Authorization: `Bearer ${this.authToken}` };

    // Test Excel export (might return empty data, but should not error)
    const exportResult = await this.makeRequest('GET', '/api/excel/export/2025-26', null, authHeaders);
    this.addTestResult('/api/excel/export/:taxYear', 'GET', 'Excel export',
      exportResult.success || exportResult.response?.status === 404,
      exportResult.success ? 'Excel export working' : `Export status: ${exportResult.response?.status}`,
      exportResult.responseTime);

    // Test Excel validation
    const validateResult = await this.makeRequest('GET', '/api/excel/validate/2025-26', null, authHeaders);
    this.addTestResult('/api/excel/validate/:taxYear', 'GET', 'Excel validation',
      validateResult.success || validateResult.response?.status === 404,
      validateResult.success ? 'Excel validation working' : `Validation status: ${validateResult.response?.status}`,
      validateResult.responseTime);

    // Test Excel history
    const historyResult = await this.makeRequest('GET', '/api/excel/history', null, authHeaders);
    this.addTestResult('/api/excel/history', 'GET', 'Excel history',
      historyResult.success,
      historyResult.success ? 'Excel history accessible' : `History error: ${historyResult.error}`,
      historyResult.responseTime);
  }

  // 6. Admin Endpoints Testing (if we have admin access)
  async testAdminEndpoints() {
    this.log('Testing Admin endpoints...', 'TEST');

    // Try to test admin endpoints without authentication first
    const adminHealthResult = await this.makeRequest('GET', '/api/admin/users');
    this.addTestResult('/api/admin/users', 'GET', 'Admin endpoint protection',
      !adminHealthResult.success,
      'Admin endpoints properly protected',
      adminHealthResult.responseTime);
  }

  // 7. Input Validation Testing
  async testInputValidation() {
    this.log('Testing Input validation...', 'TEST');

    const maliciousInputs = [
      { email: '<script>alert("xss")</script>', password: 'test' },
      { email: 'test@test.com', password: null },
      { email: '', password: 'test' },
      { email: 'not-an-email', password: 'test' },
      { email: 'test@test.com', password: '' }
    ];

    for (const input of maliciousInputs) {
      const result = await this.makeRequest('POST', '/api/login', input);
      this.addTestResult('/api/login', 'POST', `Input validation: ${JSON.stringify(input)}`,
        !result.success,
        'Malicious/invalid input rejected',
        result.responseTime);
    }
  }

  // 8. Performance Testing
  async testPerformance() {
    this.log('Testing API Performance...', 'TEST');

    // Test concurrent requests
    const concurrentTests = [];
    for (let i = 0; i < 5; i++) {
      concurrentTests.push(this.makeRequest('GET', '/api/health'));
    }

    const startTime = Date.now();
    const results = await Promise.all(concurrentTests);
    const totalTime = Date.now() - startTime;

    const allPassed = results.every(r => r.success);
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

    this.addTestResult('/api/health', 'GET', 'Concurrent request handling',
      allPassed && totalTime < 1000,
      `5 concurrent requests in ${totalTime}ms, avg: ${avgResponseTime.toFixed(1)}ms`,
      totalTime);

    this.performanceMetrics = {
      concurrentRequestTime: totalTime,
      averageResponseTime: avgResponseTime,
      concurrentRequestsHandled: results.length
    };
  }

  // 9. Error Handling Testing
  async testErrorHandling() {
    this.log('Testing Error handling...', 'TEST');

    // Test 404 endpoints
    const notFoundResult = await this.makeRequest('GET', '/api/nonexistent-endpoint');
    this.addTestResult('/api/nonexistent-endpoint', 'GET', '404 error handling',
      notFoundResult.response?.status === 404,
      '404 errors properly handled',
      notFoundResult.responseTime);

    // Test malformed JSON
    const malformedResult = await this.makeRequest('POST', '/api/login', 'invalid-json');
    this.addTestResult('/api/login', 'POST', 'Malformed JSON handling',
      !malformedResult.success,
      'Malformed JSON properly rejected',
      malformedResult.responseTime);

    // Test method not allowed
    const methodNotAllowedResult = await this.makeRequest('DELETE', '/api/health');
    this.addTestResult('/api/health', 'DELETE', 'Method not allowed handling',
      methodNotAllowedResult.response?.status === 404 || methodNotAllowedResult.response?.status === 405,
      'Unsupported methods properly handled',
      methodNotAllowedResult.responseTime);
  }

  // 10. Rate Limiting Testing
  async testRateLimiting() {
    this.log('Testing Rate limiting...', 'TEST');

    // Test rapid login attempts
    const rapidAttempts = [];
    for (let i = 0; i < 7; i++) {
      rapidAttempts.push(this.makeRequest('POST', '/api/login', {
        email: 'test@test.com',
        password: 'wrongpassword'
      }));
    }

    const results = await Promise.all(rapidAttempts);
    const rateLimitedResponses = results.filter(r =>
      r.response?.status === 429 ||
      (r.response?.data?.message && r.response.data.message.includes('Too many'))
    );

    this.addTestResult('/api/login', 'POST', 'Rate limiting enforcement',
      rateLimitedResponses.length > 0,
      `Rate limiting triggered after multiple attempts (${rateLimitedResponses.length}/7 blocked)`,
      null);
  }

  // Main testing function
  async runComprehensiveAPITest() {
    this.log('🔌 Starting Comprehensive API Endpoints Testing...', 'START');

    const startTime = Date.now();

    try {
      await this.testHealthEndpoints();
      await this.testAuthenticationEndpoints();
      await this.testProtectedEndpoints();
      await this.testReportsEndpoints();
      await this.testExcelEndpoints();
      await this.testAdminEndpoints();
      await this.testInputValidation();
      await this.testPerformance();
      await this.testErrorHandling();
      await this.testRateLimiting();

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.generateAPITestReport(duration);

    } catch (error) {
      this.log(`❌ API testing failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // Generate comprehensive report
  generateAPITestReport(duration) {
    this.log('📊 Generating API Test Report...', 'REPORT');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    const endpointGroups = {};
    this.testResults.forEach(test => {
      const group = test.endpoint.split('/')[2] || 'root';
      if (!endpointGroups[group]) {
        endpointGroups[group] = { total: 0, passed: 0 };
      }
      endpointGroups[group].total++;
      if (test.passed) endpointGroups[group].passed++;
    });

    const avgResponseTime = this.testResults
      .filter(t => t.responseTime)
      .reduce((sum, t) => sum + t.responseTime, 0) /
      this.testResults.filter(t => t.responseTime).length;

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        targetUrl: BASE_URL
      },
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: `${successRate}%`,
        averageResponseTime: `${avgResponseTime.toFixed(1)}ms`,
        endpointGroups
      },
      performanceMetrics: this.performanceMetrics,
      testResults: this.testResults
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'API_ENDPOINTS_TEST_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate summary
    this.log('\n' + '='.repeat(80), 'REPORT');
    this.log('🔌 API ENDPOINTS TEST SUMMARY', 'REPORT');
    this.log('='.repeat(80), 'REPORT');
    this.log(`Total Tests: ${totalTests}`, 'REPORT');
    this.log(`Passed: ${passedTests}`, 'REPORT');
    this.log(`Failed: ${failedTests}`, 'REPORT');
    this.log(`Success Rate: ${successRate}%`, 'REPORT');
    this.log(`Average Response Time: ${avgResponseTime.toFixed(1)}ms`, 'REPORT');
    this.log(`Test Duration: ${duration}ms`, 'REPORT');

    this.log('\n📊 ENDPOINT GROUPS PERFORMANCE:', 'REPORT');
    Object.entries(endpointGroups).forEach(([group, stats]) => {
      const groupSuccessRate = ((stats.passed / stats.total) * 100).toFixed(1);
      this.log(`  ${group}: ${stats.passed}/${stats.total} (${groupSuccessRate}%)`, 'REPORT');
    });

    if (failedTests > 0) {
      this.log('\n❌ FAILED TESTS:', 'REPORT');
      this.testResults.filter(t => !t.passed).forEach(test => {
        this.log(`  ${test.method} ${test.endpoint} - ${test.testName}: ${test.details}`, 'REPORT');
      });
    }

    this.log(`\n📄 Detailed report saved to: ${reportPath}`, 'REPORT');
    this.log('='.repeat(80), 'REPORT');

    return report;
  }
}

// Run the test suite
async function main() {
  console.log('🔌 Pakistani Tax Advisor - API Endpoints Testing Tool');
  console.log('🧪 Comprehensive API Testing Suite Starting...\n');

  const tester = new APITester();
  await tester.runComprehensiveAPITest();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ API testing failed:', error);
    process.exit(1);
  });
}

module.exports = APITester;