#!/usr/bin/env node

/**
 * ERROR DETECTION ANALYSIS
 * Comprehensive check for unexpected errors in the system
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

class ErrorDetector {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.criticalIssues = [];
  }

  async runErrorDetection() {
    console.log('🔍 COMPREHENSIVE ERROR DETECTION ANALYSIS');
    console.log('=========================================\n');

    try {
      await this.checkDatabaseErrors();
      await this.checkFileSystemErrors();
      await this.checkCodeSyntaxErrors();
      await this.checkConfigurationErrors();
      await this.checkDataConsistencyErrors();
      await this.generateErrorReport();
    } catch (error) {
      console.error('❌ Error detection failed:', error.message);
      this.criticalIssues.push(`Error detection failure: ${error.message}`);
    } finally {
      await this.cleanup();
    }
  }

  async checkDatabaseErrors() {
    console.log('🗄️  1. DATABASE ERROR ANALYSIS');
    console.log('==============================');

    try {
      const client = await pool.connect();

      // Check for database connection issues
      try {
        await client.query('SELECT 1');
        console.log('✅ Database connection healthy');
      } catch (connError) {
        console.log('❌ Database connection error:', connError.message);
        this.criticalIssues.push(`Database connection: ${connError.message}`);
      }

      // Check for missing foreign key constraints
      const fkCheck = await client.query(`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN ('income_forms', 'adjustable_tax_forms', 'capital_gain_forms')
      `);

      if (fkCheck.rows.length === 0) {
        console.log('⚠️  No foreign key constraints found - potential data integrity issue');
        this.warnings.push('Missing foreign key constraints on form tables');
      } else {
        console.log(`✅ Found ${fkCheck.rows.length} foreign key constraints`);
      }

      // Check for orphaned records
      const orphanCheck = await client.query(`
        SELECT 
          'income_forms' as table_name,
          COUNT(*) as orphan_count
        FROM income_forms i
        LEFT JOIN users u ON i.user_id = u.id
        WHERE u.id IS NULL AND i.user_id IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'adjustable_tax_forms' as table_name,
          COUNT(*) as orphan_count
        FROM adjustable_tax_forms a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE u.id IS NULL AND a.user_id IS NOT NULL
      `);

      orphanCheck.rows.forEach(row => {
        if (row.orphan_count > 0) {
          console.log(`⚠️  Found ${row.orphan_count} orphaned records in ${row.table_name}`);
          this.warnings.push(`Orphaned records in ${row.table_name}: ${row.orphan_count}`);
        } else {
          console.log(`✅ No orphaned records in ${row.table_name}`);
        }
      });

      // Check for data type mismatches
      const dataTypeCheck = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'income_forms'
          AND column_name LIKE '%salary%'
          AND data_type != 'numeric'
      `);

      if (dataTypeCheck.rows.length > 0) {
        console.log('⚠️  Potential data type issues in salary columns');
        dataTypeCheck.rows.forEach(row => {
          this.warnings.push(`Column ${row.column_name} has type ${row.data_type} instead of numeric`);
        });
      } else {
        console.log('✅ All salary columns have correct numeric data types');
      }

      // Check for generated column errors
      const generatedColumnCheck = await client.query(`
        SELECT column_name, generation_expression
        FROM information_schema.columns
        WHERE table_name = 'income_forms' 
          AND is_generated = 'ALWAYS'
      `);

      if (generatedColumnCheck.rows.length < 7) {
        console.log(`⚠️  Expected 7 generated columns, found ${generatedColumnCheck.rows.length}`);
        this.warnings.push(`Missing generated columns: expected 7, found ${generatedColumnCheck.rows.length}`);
      } else {
        console.log(`✅ All ${generatedColumnCheck.rows.length} generated columns present`);
      }

      client.release();
    } catch (error) {
      console.log('❌ Database error analysis failed:', error.message);
      this.errors.push(`Database analysis: ${error.message}`);
    }

    console.log('');
  }

  async checkFileSystemErrors() {
    console.log('📁 2. FILE SYSTEM ERROR ANALYSIS');
    console.log('=================================');

    // Check for missing critical files
    const criticalFiles = [
      'backend/src/services/excelService.js',
      'backend/src/services/taxCalculationService.js',
      'backend/src/routes/taxComputation.js',
      'backend/src/app.js',
      'database/create-income-forms-clean.sql'
    ];

    criticalFiles.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          console.log(`✅ Critical file exists: ${filePath}`);
        } else {
          console.log(`❌ Missing critical file: ${filePath}`);
          this.criticalIssues.push(`Missing file: ${filePath}`);
        }
      } catch (error) {
        console.log(`❌ Error checking file ${filePath}: ${error.message}`);
        this.errors.push(`File check error: ${filePath} - ${error.message}`);
      }
    });

    // Check for file permissions
    try {
      const testFile = 'temp-permission-test.txt';
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('✅ File system write permissions OK');
    } catch (error) {
      console.log('❌ File system permission error:', error.message);
      this.errors.push(`File permissions: ${error.message}`);
    }

    console.log('');
  }

  async checkCodeSyntaxErrors() {
    console.log('💻 3. CODE SYNTAX ERROR ANALYSIS');
    console.log('=================================');

    const codeFiles = [
      'backend/src/services/taxCalculationService.js',
      'backend/src/routes/taxComputation.js',
      'backend/src/services/excelService.js'
    ];

    for (const filePath of codeFiles) {
      try {
        if (fs.existsSync(filePath)) {
          // Try to require the module to check for syntax errors
          delete require.cache[require.resolve(`./${filePath}`)];
          require(`./${filePath}`);
          console.log(`✅ Syntax OK: ${filePath}`);
        }
      } catch (error) {
        console.log(`❌ Syntax error in ${filePath}: ${error.message}`);
        this.errors.push(`Syntax error: ${filePath} - ${error.message}`);
      }
    }

    console.log('');
  }

  async checkConfigurationErrors() {
    console.log('⚙️  4. CONFIGURATION ERROR ANALYSIS');
    console.log('===================================');

    // Check environment variables
    const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
    const missingEnvVars = [];

    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        missingEnvVars.push(envVar);
      }
    });

    if (missingEnvVars.length > 0) {
      console.log(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
      this.warnings.push(`Missing env vars: ${missingEnvVars.join(', ')}`);
    } else {
      console.log('✅ All required environment variables present');
    }

    // Check package.json dependencies
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const backendPackageJson = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
      
      const requiredDeps = ['pg', 'axios'];
      const missingDeps = [];

      requiredDeps.forEach(dep => {
        if (!packageJson.dependencies?.[dep] && !backendPackageJson.dependencies?.[dep]) {
          missingDeps.push(dep);
        }
      });

      if (missingDeps.length > 0) {
        console.log(`⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
        this.warnings.push(`Missing dependencies: ${missingDeps.join(', ')}`);
      } else {
        console.log('✅ All required dependencies present');
      }
    } catch (error) {
      console.log('⚠️  Could not verify package.json dependencies');
      this.warnings.push('Package.json verification failed');
    }

    console.log('');
  }

  async checkDataConsistencyErrors() {
    console.log('🔍 5. DATA CONSISTENCY ERROR ANALYSIS');
    console.log('=====================================');

    try {
      const client = await pool.connect();

      // Insert test data to check for calculation errors
      const testUserId = '00000000-0000-0000-0000-000000000test';
      const testTaxYear = '2025-26';

      await client.query(`
        INSERT INTO income_forms (
          user_id, tax_year, annual_basic_salary, allowances, bonus,
          medical_allowance, retirement_from_approved_funds,
          employment_termination_payment, employer_contribution_provident
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, tax_year) DO UPDATE SET
          annual_basic_salary = EXCLUDED.annual_basic_salary,
          allowances = EXCLUDED.allowances,
          bonus = EXCLUDED.bonus,
          medical_allowance = EXCLUDED.medical_allowance,
          retirement_from_approved_funds = EXCLUDED.retirement_from_approved_funds,
          employment_termination_payment = EXCLUDED.employment_termination_payment,
          employer_contribution_provident = EXCLUDED.employer_contribution_provident
      `, [testUserId, testTaxYear, 1000000, 500000, 100000, 50000, 200000, 100000, 75000]);

      // Check calculated values
      const result = await client.query(`
        SELECT 
          income_exempt_from_tax,
          annual_salary_wages_total,
          non_cash_benefit_exempt,
          total_non_cash_benefits
        FROM income_forms 
        WHERE user_id = $1 AND tax_year = $2
      `, [testUserId, testTaxYear]);

      if (result.rows.length > 0) {
        const data = result.rows[0];
        
        // Verify calculations
        const expectedIncomeExempt = -(200000 + 100000 + 50000); // -350000
        const expectedNonCashExempt = -Math.min(75000, 150000); // -75000
        
        if (Math.abs(data.income_exempt_from_tax - expectedIncomeExempt) < 1) {
          console.log('✅ Income exempt calculation correct');
        } else {
          console.log(`❌ Income exempt calculation error: expected ${expectedIncomeExempt}, got ${data.income_exempt_from_tax}`);
          this.errors.push(`Income exempt calculation mismatch`);
        }

        if (Math.abs(data.non_cash_benefit_exempt - expectedNonCashExempt) < 1) {
          console.log('✅ Non-cash benefit exempt calculation correct');
        } else {
          console.log(`❌ Non-cash benefit exempt calculation error: expected ${expectedNonCashExempt}, got ${data.non_cash_benefit_exempt}`);
          this.errors.push(`Non-cash benefit exempt calculation mismatch`);
        }

        // Check for NULL values in calculated fields
        const nullFields = [];
        Object.entries(data).forEach(([field, value]) => {
          if (value === null) {
            nullFields.push(field);
          }
        });

        if (nullFields.length > 0) {
          console.log(`⚠️  NULL values in calculated fields: ${nullFields.join(', ')}`);
          this.warnings.push(`NULL calculated fields: ${nullFields.join(', ')}`);
        } else {
          console.log('✅ No NULL values in calculated fields');
        }

      } else {
        console.log('❌ Test data insertion/retrieval failed');
        this.errors.push('Test data operations failed');
      }

      // Cleanup test data
      await client.query('DELETE FROM income_forms WHERE user_id = $1', [testUserId]);
      client.release();

    } catch (error) {
      console.log('❌ Data consistency check failed:', error.message);
      this.errors.push(`Data consistency: ${error.message}`);
    }

    console.log('');
  }

  async generateErrorReport() {
    console.log('📋 ERROR DETECTION REPORT');
    console.log('=========================');

    const totalIssues = this.criticalIssues.length + this.errors.length + this.warnings.length;

    console.log(`\n🎯 SUMMARY:`);
    console.log(`Critical Issues: ${this.criticalIssues.length}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`Total Issues: ${totalIssues}`);

    if (this.criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES:`);
      this.criticalIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORS:`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`);
      });
    }

    if (totalIssues === 0) {
      console.log(`\n🎉 NO UNEXPECTED ERRORS FOUND!`);
      console.log(`✅ System is clean and error-free`);
      console.log(`✅ All components functioning correctly`);
    } else if (this.criticalIssues.length === 0 && this.errors.length === 0) {
      console.log(`\n✅ NO CRITICAL ERRORS OR ERRORS FOUND!`);
      console.log(`⚠️  Only minor warnings present`);
      console.log(`✅ System is stable and functional`);
    } else {
      console.log(`\n⚠️  ISSUES DETECTED THAT NEED ATTENTION`);
      console.log(`🔧 Recommend addressing critical issues and errors first`);
    }

    console.log(`\n✅ ERROR DETECTION ANALYSIS COMPLETED`);
  }

  async cleanup() {
    try {
      await pool.end();
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }
}

// Run error detection
if (require.main === module) {
  const detector = new ErrorDetector();
  detector.runErrorDetection().catch(console.error);
}

module.exports = ErrorDetector;