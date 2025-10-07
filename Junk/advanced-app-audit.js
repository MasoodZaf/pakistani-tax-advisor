#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';
let authToken = null;

// Audit results storage
const auditResults = {
  codeQuality: { score: 0, issues: [], recommendations: [] },
  security: { score: 0, vulnerabilities: [], warnings: [] },
  performance: { score: 0, metrics: {}, issues: [] },
  architecture: { score: 0, analysis: [], concerns: [] },
  database: { score: 0, schema: {}, issues: [] },
  business: { score: 0, calculations: [], errors: [] },
  overall: { score: 0, status: 'PENDING' }
};

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const colors = {
    'INFO': '\x1b[36m',
    'WARN': '\x1b[33m',
    'ERROR': '\x1b[31m',
    'SUCCESS': '\x1b[32m',
    'AUDIT': '\x1b[35m'
  };
  console.log(`${colors[level]}[${timestamp}] [${level}] ${message}\x1b[0m`);
}

function addIssue(category, severity, title, description, recommendation = '') {
  auditResults[category].issues.push({
    severity,
    title,
    description,
    recommendation,
    timestamp: new Date().toISOString()
  });
}

// 1. CODE QUALITY AUDIT
async function auditCodeQuality() {
  log('Starting Code Quality Audit...', 'AUDIT');

  const backendPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/backend/src';
  const frontendPath = '/Users/masoodzafar/Documents/IT Hustle/Tax Advisor/Frontend/src';

  // Check for code patterns and anti-patterns
  const codeIssues = [];
  let score = 100;

  // Check backend files
  const backendFiles = getAllJSFiles(backendPath);
  for (const file of backendFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Check for console.log statements (should use logger)
    if (content.includes('console.log') && !file.includes('test') && !file.includes('audit')) {
      codeIssues.push({
        file: file.replace(backendPath, ''),
        issue: 'Using console.log instead of logger',
        severity: 'MEDIUM'
      });
      score -= 2;
    }

    // Check for hardcoded credentials
    if (content.match(/password\s*[:=]\s*['"].*['"]/) && !file.includes('test')) {
      codeIssues.push({
        file: file.replace(backendPath, ''),
        issue: 'Potential hardcoded credentials detected',
        severity: 'HIGH'
      });
      score -= 10;
    }

    // Check for proper error handling
    if (content.includes('try {') && !content.includes('catch')) {
      codeIssues.push({
        file: file.replace(backendPath, ''),
        issue: 'Try block without catch - improper error handling',
        severity: 'HIGH'
      });
      score -= 5;
    }

    // Check for SQL injection protection
    if (content.includes('pool.query') && content.includes('${')) {
      codeIssues.push({
        file: file.replace(backendPath, ''),
        issue: 'Potential SQL injection vulnerability - string interpolation in query',
        severity: 'CRITICAL'
      });
      score -= 20;
    }

    // Check for proper async/await usage
    if (content.includes('async function') && !content.includes('await')) {
      codeIssues.push({
        file: file.replace(backendPath, ''),
        issue: 'Async function without await usage',
        severity: 'LOW'
      });
      score -= 1;
    }
  }

  // Check frontend files
  const frontendFiles = getAllJSFiles(frontendPath);
  for (const file of frontendFiles) {
    const content = fs.readFileSync(file, 'utf8');

    // Check for inline styles (should use CSS classes)
    if (content.includes('style={{') && content.split('style={{').length > 3) {
      codeIssues.push({
        file: file.replace(frontendPath, ''),
        issue: 'Excessive inline styles - should use CSS classes',
        severity: 'LOW'
      });
      score -= 1;
    }

    // Check for proper state management
    if (content.includes('useState') && content.split('useState').length > 5) {
      codeIssues.push({
        file: file.replace(frontendPath, ''),
        issue: 'Too many useState hooks - consider useReducer or context',
        severity: 'MEDIUM'
      });
      score -= 2;
    }

    // Check for accessibility issues
    if (content.includes('<input') && !content.includes('aria-label') && !content.includes('placeholder')) {
      codeIssues.push({
        file: file.replace(frontendPath, ''),
        issue: 'Input elements missing accessibility labels',
        severity: 'MEDIUM'
      });
      score -= 2;
    }
  }

  auditResults.codeQuality.score = Math.max(0, score);
  auditResults.codeQuality.issues = codeIssues;

  log(`Code Quality Score: ${auditResults.codeQuality.score}/100`, 'AUDIT');
  log(`Found ${codeIssues.length} code quality issues`, 'AUDIT');
}

// 2. SECURITY AUDIT
async function auditSecurity() {
  log('Starting Security Audit...', 'AUDIT');

  let score = 100;
  const vulnerabilities = [];

  try {
    // Test authentication bypass
    const noTokenResponse = await axios.get(`${BASE_URL}/api/income-form/2025-26`).catch(e => e.response);
    if (noTokenResponse?.status !== 401) {
      vulnerabilities.push({
        severity: 'CRITICAL',
        type: 'Authentication Bypass',
        description: 'Protected endpoint accessible without authentication'
      });
      score -= 30;
    }

    // Test for JWT security
    const invalidTokenResponse = await axios.get(`${BASE_URL}/api/income-form/2025-26`, {
      headers: { Authorization: 'Bearer invalid_token' }
    }).catch(e => e.response);

    if (invalidTokenResponse?.status !== 401) {
      vulnerabilities.push({
        severity: 'HIGH',
        type: 'JWT Validation',
        description: 'Invalid JWT tokens not properly rejected'
      });
      score -= 20;
    }

    // Test for SQL injection
    const sqlInjectionTest = await axios.post(`${BASE_URL}/api/login`, {
      email: "' OR '1'='1",
      password: "' OR '1'='1"
    }).catch(e => e.response);

    if (sqlInjectionTest?.data?.success) {
      vulnerabilities.push({
        severity: 'CRITICAL',
        type: 'SQL Injection',
        description: 'Login endpoint vulnerable to SQL injection'
      });
      score -= 40;
    }

    // Test CORS configuration
    const corsTest = await axios.options(`${BASE_URL}/api/health`).catch(e => e.response);
    if (corsTest?.headers['access-control-allow-origin'] === '*') {
      vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'CORS Misconfiguration',
        description: 'Overly permissive CORS policy allows all origins'
      });
      score -= 10;
    }

    // Check for rate limiting
    const rateLimitPromises = Array(10).fill().map(() =>
      axios.post(`${BASE_URL}/api/login`, { email: 'test', password: 'test' }).catch(e => e.response)
    );
    const rateLimitResponses = await Promise.all(rateLimitPromises);
    const rateLimited = rateLimitResponses.some(r => r?.status === 429);

    if (!rateLimited) {
      vulnerabilities.push({
        severity: 'MEDIUM',
        type: 'Rate Limiting',
        description: 'No rate limiting detected on login endpoint'
      });
      score -= 10;
    }

  } catch (error) {
    log(`Security audit error: ${error.message}`, 'ERROR');
  }

  auditResults.security.score = Math.max(0, score);
  auditResults.security.vulnerabilities = vulnerabilities;

  log(`Security Score: ${auditResults.security.score}/100`, 'AUDIT');
  log(`Found ${vulnerabilities.length} security issues`, 'AUDIT');
}

// 3. PERFORMANCE AUDIT
async function auditPerformance() {
  log('Starting Performance Audit...', 'AUDIT');

  let score = 100;
  const metrics = {};
  const issues = [];

  try {
    // Test response times
    const startTime = Date.now();
    await axios.get(`${BASE_URL}/api/health`);
    const healthResponseTime = Date.now() - startTime;
    metrics.healthResponseTime = healthResponseTime;

    if (healthResponseTime > 1000) {
      issues.push({
        type: 'Slow Response',
        description: `Health endpoint response time: ${healthResponseTime}ms (should be < 1000ms)`
      });
      score -= 10;
    }

    // Test database query performance
    const dbStartTime = Date.now();
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'khurramj@taxadvisor.pk',
      password: '123456'
    });
    const dbResponseTime = Date.now() - dbStartTime;
    metrics.dbResponseTime = dbResponseTime;

    if (dbResponseTime > 2000) {
      issues.push({
        type: 'Slow Database',
        description: `Database query time: ${dbResponseTime}ms (should be < 2000ms)`
      });
      score -= 15;
    }

    authToken = loginResponse.data.token;

    // Test form data loading performance
    const formStartTime = Date.now();
    await axios.get(`${BASE_URL}/api/income-form/2025-26`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const formResponseTime = Date.now() - formStartTime;
    metrics.formResponseTime = formResponseTime;

    if (formResponseTime > 1500) {
      issues.push({
        type: 'Slow Form Loading',
        description: `Form loading time: ${formResponseTime}ms (should be < 1500ms)`
      });
      score -= 10;
    }

    // Test concurrent requests
    const concurrentStart = Date.now();
    const concurrentPromises = Array(5).fill().map(() =>
      axios.get(`${BASE_URL}/api/health`)
    );
    await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    metrics.concurrentRequestTime = concurrentTime;

    if (concurrentTime > 3000) {
      issues.push({
        type: 'Poor Concurrent Performance',
        description: `5 concurrent requests took ${concurrentTime}ms (should be < 3000ms)`
      });
      score -= 10;
    }

  } catch (error) {
    log(`Performance audit error: ${error.message}`, 'ERROR');
    score -= 20;
  }

  auditResults.performance.score = Math.max(0, score);
  auditResults.performance.metrics = metrics;
  auditResults.performance.issues = issues;

  log(`Performance Score: ${auditResults.performance.score}/100`, 'AUDIT');
  log(`Response times - Health: ${metrics.healthResponseTime}ms, DB: ${metrics.dbResponseTime}ms, Form: ${metrics.formResponseTime}ms`, 'AUDIT');
}

// 4. BUSINESS LOGIC AUDIT
async function auditBusinessLogic() {
  log('Starting Business Logic Audit...', 'AUDIT');

  let score = 100;
  const calculations = [];
  const errors = [];

  try {
    if (!authToken) {
      const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
        email: 'khurramj@taxadvisor.pk',
        password: '123456'
      });
      authToken = loginResponse.data.token;
    }

    // Test calculation accuracy
    const testCases = [
      { monthly: 100000, expectedAnnual: 1200000, allowances: 10000, expectedAllowancesAnnual: 120000 },
      { monthly: 500000, expectedAnnual: 6000000, allowances: 25000, expectedAllowancesAnnual: 300000 },
      { monthly: 1000000, expectedAnnual: 12000000, allowances: 50000, expectedAllowancesAnnual: 600000 }
    ];

    for (const testCase of testCases) {
      const response = await axios.post(`${BASE_URL}/api/income-form/2025-26`, {
        monthly_basic_salary: testCase.monthly,
        monthly_allowances: testCase.allowances,
        bonus: 0
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const actualAnnual = parseFloat(response.data.data.annual_basic_salary);
      const actualAllowances = parseFloat(response.data.data.allowances);

      const salaryCorrect = actualAnnual === testCase.expectedAnnual;
      const allowancesCorrect = actualAllowances === testCase.expectedAllowancesAnnual;

      calculations.push({
        input: testCase,
        output: { actualAnnual, actualAllowances },
        correct: salaryCorrect && allowancesCorrect
      });

      if (!salaryCorrect) {
        errors.push({
          type: 'Salary Calculation Error',
          description: `Monthly ${testCase.monthly} should calculate to ${testCase.expectedAnnual}, got ${actualAnnual}`
        });
        score -= 15;
      }

      if (!allowancesCorrect) {
        errors.push({
          type: 'Allowances Calculation Error',
          description: `Monthly allowances ${testCase.allowances} should calculate to ${testCase.expectedAllowancesAnnual}, got ${actualAllowances}`
        });
        score -= 15;
      }
    }

    // Test edge cases
    const edgeCases = [
      { monthly: 0, description: 'Zero salary' },
      { monthly: -100, description: 'Negative salary' },
      { monthly: 999999999, description: 'Very large salary' }
    ];

    for (const edgeCase of edgeCases) {
      try {
        const response = await axios.post(`${BASE_URL}/api/income-form/2025-26`, {
          monthly_basic_salary: edgeCase.monthly,
          bonus: 0
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        const result = parseFloat(response.data.data.annual_basic_salary);

        if (edgeCase.monthly < 0 && result < 0) {
          errors.push({
            type: 'Negative Value Handling',
            description: `${edgeCase.description}: Negative values should not be allowed`
          });
          score -= 10;
        }

      } catch (error) {
        // Edge case handling errors are expected for some cases
      }
    }

  } catch (error) {
    log(`Business logic audit error: ${error.message}`, 'ERROR');
    score -= 20;
  }

  auditResults.business.score = Math.max(0, score);
  auditResults.business.calculations = calculations;
  auditResults.business.errors = errors;

  log(`Business Logic Score: ${auditResults.business.score}/100`, 'AUDIT');
  log(`Tested ${calculations.length} calculation scenarios`, 'AUDIT');
}

// 5. DATABASE AUDIT
async function auditDatabase() {
  log('Starting Database Audit...', 'AUDIT');

  let score = 100;
  const schema = {};
  const issues = [];

  // This would require database access - simulated for now
  try {
    // Test database connection
    const healthResponse = await axios.get(`${BASE_URL}/api/health`);
    if (!healthResponse.data.database.connected) {
      issues.push({
        severity: 'CRITICAL',
        type: 'Database Connection',
        description: 'Database connection failed'
      });
      score -= 50;
    } else {
      schema.connected = true;
      schema.connectionTime = healthResponse.data.database.timestamp;
    }

    // Test data integrity
    if (authToken) {
      const formResponse = await axios.get(`${BASE_URL}/api/income-form/2025-26`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const data = formResponse.data;
      if (data.annual_basic_salary && data.allowances) {
        schema.dataIntegrity = 'PASS';
      } else {
        issues.push({
          severity: 'HIGH',
          type: 'Data Integrity',
          description: 'Form data missing required fields'
        });
        score -= 20;
      }
    }

  } catch (error) {
    log(`Database audit error: ${error.message}`, 'ERROR');
    score -= 30;
  }

  auditResults.database.score = Math.max(0, score);
  auditResults.database.schema = schema;
  auditResults.database.issues = issues;

  log(`Database Score: ${auditResults.database.score}/100`, 'AUDIT');
}

// Helper function to get all JS files
function getAllJSFiles(dir) {
  const files = [];

  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walkDir(fullPath);
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    }
  }

  if (fs.existsSync(dir)) {
    walkDir(dir);
  }

  return files;
}

// Calculate overall score
function calculateOverallScore() {
  const weights = {
    codeQuality: 0.20,
    security: 0.25,
    performance: 0.20,
    business: 0.25,
    database: 0.10
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const [category, weight] of Object.entries(weights)) {
    if (auditResults[category].score !== undefined) {
      totalScore += auditResults[category].score * weight;
      totalWeight += weight;
    }
  }

  auditResults.overall.score = Math.round(totalScore / totalWeight);

  if (auditResults.overall.score >= 90) {
    auditResults.overall.status = 'EXCELLENT';
  } else if (auditResults.overall.score >= 80) {
    auditResults.overall.status = 'GOOD';
  } else if (auditResults.overall.score >= 70) {
    auditResults.overall.status = 'FAIR';
  } else if (auditResults.overall.score >= 60) {
    auditResults.overall.status = 'POOR';
  } else {
    auditResults.overall.status = 'CRITICAL';
  }
}

// Generate comprehensive report
function generateReport() {
  log('\n=================== COMPREHENSIVE AUDIT REPORT ===================', 'SUCCESS');
  log(`Overall Score: ${auditResults.overall.score}/100 (${auditResults.overall.status})`, 'SUCCESS');
  log('================================================================\n', 'SUCCESS');

  // Individual scores
  log('CATEGORY SCORES:', 'INFO');
  log(`🔧 Code Quality:     ${auditResults.codeQuality.score}/100`, 'INFO');
  log(`🔒 Security:         ${auditResults.security.score}/100`, 'INFO');
  log(`⚡ Performance:      ${auditResults.performance.score}/100`, 'INFO');
  log(`💼 Business Logic:   ${auditResults.business.score}/100`, 'INFO');
  log(`🗄️  Database:         ${auditResults.database.score}/100`, 'INFO');

  // Critical issues
  const criticalIssues = [];
  Object.values(auditResults).forEach(category => {
    if (category.issues) {
      criticalIssues.push(...category.issues.filter(issue =>
        issue.severity === 'CRITICAL' || issue.severity === 'HIGH'
      ));
    }
    if (category.vulnerabilities) {
      criticalIssues.push(...category.vulnerabilities.filter(vuln =>
        vuln.severity === 'CRITICAL' || vuln.severity === 'HIGH'
      ));
    }
  });

  if (criticalIssues.length > 0) {
    log('\n⚠️  CRITICAL/HIGH PRIORITY ISSUES:', 'WARN');
    criticalIssues.forEach((issue, index) => {
      log(`${index + 1}. [${issue.severity}] ${issue.title || issue.type}: ${issue.description}`, 'WARN');
    });
  }

  // Performance metrics
  if (auditResults.performance.metrics) {
    log('\n📊 PERFORMANCE METRICS:', 'INFO');
    Object.entries(auditResults.performance.metrics).forEach(([key, value]) => {
      log(`   ${key}: ${value}ms`, 'INFO');
    });
  }

  log('\n================================================================', 'SUCCESS');
  log('AUDIT COMPLETE', 'SUCCESS');
  log('================================================================\n', 'SUCCESS');
}

// Main audit execution
async function runComprehensiveAudit() {
  log('🚀 Starting Comprehensive Application Audit...', 'SUCCESS');
  log('This will perform deep quality control checks on all aspects of the application.\n', 'INFO');

  try {
    await auditCodeQuality();
    await auditSecurity();
    await auditPerformance();
    await auditBusinessLogic();
    await auditDatabase();

    calculateOverallScore();
    generateReport();

    // Save detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      results: auditResults,
      summary: {
        overallScore: auditResults.overall.score,
        status: auditResults.overall.status,
        categories: Object.keys(auditResults).filter(key => key !== 'overall').map(key => ({
          name: key,
          score: auditResults[key].score
        }))
      }
    };

    fs.writeFileSync('DETAILED_AUDIT_REPORT.json', JSON.stringify(reportData, null, 2));
    log('📄 Detailed audit report saved to DETAILED_AUDIT_REPORT.json', 'SUCCESS');

    process.exit(auditResults.overall.score < 70 ? 1 : 0);

  } catch (error) {
    log(`Fatal audit error: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run the comprehensive audit
runComprehensiveAudit();