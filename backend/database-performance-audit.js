#!/usr/bin/env node

/**
 * Database Schema & Performance Audit Tool
 * Pakistani Tax Advisor Application
 *
 * This tool performs comprehensive database analysis including:
 * - Schema integrity and design analysis
 * - Index optimization assessment
 * - Query performance testing
 * - Foreign key constraints validation
 * - Data consistency checks
 * - Storage optimization recommendations
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseAudit {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'tax_advisor',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.auditResults = {
      schemaAnalysis: {},
      performanceMetrics: {},
      indexAnalysis: {},
      constraintAnalysis: {},
      dataIntegrity: {},
      recommendations: []
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  addRecommendation(category, priority, description, sql = null) {
    this.auditResults.recommendations.push({
      category,
      priority,
      description,
      sql,
      timestamp: new Date().toISOString()
    });
  }

  // 1. Schema Analysis
  async analyzeSchema() {
    this.log('Analyzing database schema...', 'AUDIT');

    try {
      // Get all tables
      const tablesResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          tableowner,
          hasindexes,
          hasrules,
          hastriggers
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);

      // Get table sizes
      const tableSizesResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      // Get column information
      const columnsResult = await this.pool.query(`
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      // Get row counts
      const rowCountQueries = tablesResult.rows.map(table =>
        `SELECT '${table.tablename}' as table_name, COUNT(*) as row_count FROM ${table.tablename}`
      );

      const rowCountsResult = await this.pool.query(`
        ${rowCountQueries.join(' UNION ALL ')}
        ORDER BY row_count DESC
      `);

      this.auditResults.schemaAnalysis = {
        tables: tablesResult.rows,
        tableSizes: tableSizesResult.rows,
        columns: columnsResult.rows,
        rowCounts: rowCountsResult.rows,
        totalTables: tablesResult.rows.length,
        totalColumns: columnsResult.rows.length
      };

      // Analyze for potential issues
      this.analyzeSchemaIssues();

      this.log(`Schema analysis completed: ${tablesResult.rows.length} tables, ${columnsResult.rows.length} columns`, 'SUCCESS');

    } catch (error) {
      this.log(`Schema analysis failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  analyzeSchemaIssues() {
    const { tables, columns, tableSizes, rowCounts } = this.auditResults.schemaAnalysis;

    // Check for missing primary keys
    const tablesWithoutPK = tables.filter(table => !table.hasindexes);
    if (tablesWithoutPK.length > 0) {
      this.addRecommendation('Schema Design', 'HIGH',
        `Tables without indexes detected: ${tablesWithoutPK.map(t => t.tablename).join(', ')}`);
    }

    // Check for large tables without proper indexing
    const largeTables = tableSizes.filter(table => table.size_bytes > 1000000); // > 1MB
    if (largeTables.length > 0) {
      this.addRecommendation('Performance', 'MEDIUM',
        `Large tables detected that may need index optimization: ${largeTables.map(t => t.tablename).join(', ')}`);
    }

    // Check for tables with many columns (potential normalization issues)
    const columnsByTable = {};
    columns.forEach(col => {
      if (!columnsByTable[col.table_name]) columnsByTable[col.table_name] = 0;
      columnsByTable[col.table_name]++;
    });

    const tablesWithManyColumns = Object.entries(columnsByTable)
      .filter(([table, count]) => count > 20)
      .map(([table, count]) => ({ table, count }));

    if (tablesWithManyColumns.length > 0) {
      this.addRecommendation('Schema Design', 'LOW',
        `Tables with many columns (potential normalization issue): ${tablesWithManyColumns.map(t => `${t.table}(${t.count})`).join(', ')}`);
    }
  }

  // 2. Index Analysis
  async analyzeIndexes() {
    this.log('Analyzing database indexes...', 'AUDIT');

    try {
      // Get all indexes
      const indexesResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

      // Get index usage statistics
      const indexStatsResult = await this.pool.query(`
        SELECT
          schemaname,
          relname as tablename,
          indexrelname as indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `);

      // Get unused indexes
      const unusedIndexesResult = await this.pool.query(`
        SELECT
          schemaname,
          relname as tablename,
          indexrelname as indexname,
          idx_scan
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public' AND idx_scan = 0
      `);

      this.auditResults.indexAnalysis = {
        indexes: indexesResult.rows,
        indexStats: indexStatsResult.rows,
        unusedIndexes: unusedIndexesResult.rows,
        totalIndexes: indexesResult.rows.length
      };

      // Analyze index issues
      if (unusedIndexesResult.rows.length > 0) {
        this.addRecommendation('Performance', 'MEDIUM',
          `Unused indexes detected: ${unusedIndexesResult.rows.map(i => i.indexname).join(', ')}`,
          `-- Consider dropping unused indexes:\n${unusedIndexesResult.rows.map(i => `DROP INDEX IF EXISTS ${i.indexname};`).join('\n')}`);
      }

      this.log(`Index analysis completed: ${indexesResult.rows.length} indexes found, ${unusedIndexesResult.rows.length} unused`, 'SUCCESS');

    } catch (error) {
      this.log(`Index analysis failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // 3. Foreign Key Constraints Analysis
  async analyzeConstraints() {
    this.log('Analyzing foreign key constraints...', 'AUDIT');

    try {
      // Get all foreign key constraints
      const foreignKeysResult = await this.pool.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `);

      // Get primary key constraints
      const primaryKeysResult = await this.pool.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      // Check for orphaned records
      const orphanedRecordsQueries = [];
      for (const fk of foreignKeysResult.rows) {
        orphanedRecordsQueries.push(`
          SELECT '${fk.table_name}' as table_name,
                 '${fk.column_name}' as column_name,
                 COUNT(*) as orphaned_count
          FROM ${fk.table_name} t1
          LEFT JOIN ${fk.foreign_table_name} t2 ON t1.${fk.column_name} = t2.${fk.foreign_column_name}
          WHERE t1.${fk.column_name} IS NOT NULL AND t2.${fk.foreign_column_name} IS NULL
        `);
      }

      let orphanedRecords = [];
      if (orphanedRecordsQueries.length > 0) {
        const orphanedResult = await this.pool.query(orphanedRecordsQueries.join(' UNION ALL '));
        orphanedRecords = orphanedResult.rows.filter(row => row.orphaned_count > 0);
      }

      this.auditResults.constraintAnalysis = {
        foreignKeys: foreignKeysResult.rows,
        primaryKeys: primaryKeysResult.rows,
        orphanedRecords: orphanedRecords,
        totalForeignKeys: foreignKeysResult.rows.length,
        totalPrimaryKeys: primaryKeysResult.rows.length
      };

      if (orphanedRecords.length > 0) {
        this.addRecommendation('Data Integrity', 'HIGH',
          `Orphaned records detected: ${orphanedRecords.map(r => `${r.table_name}.${r.column_name} (${r.orphaned_count})`).join(', ')}`);
      }

      this.log(`Constraint analysis completed: ${foreignKeysResult.rows.length} foreign keys, ${primaryKeysResult.rows.length} primary keys`, 'SUCCESS');

    } catch (error) {
      this.log(`Constraint analysis failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // 4. Performance Testing
  async performanceTest() {
    this.log('Running performance tests...', 'AUDIT');

    try {
      const performanceTests = [
        {
          name: 'Simple SELECT performance',
          query: 'SELECT COUNT(*) FROM users',
          expectedTime: 50 // ms
        },
        {
          name: 'Complex JOIN performance',
          query: `
            SELECT u.email, tr.tax_year, if.annual_basic_salary
            FROM users u
            JOIN tax_returns tr ON u.id = tr.user_id
            JOIN income_forms if ON tr.id = if.tax_return_id
            LIMIT 100
          `,
          expectedTime: 100 // ms
        },
        {
          name: 'Tax calculation view performance',
          query: 'SELECT * FROM v_comprehensive_tax_calculation LIMIT 10',
          expectedTime: 200 // ms
        },
        {
          name: 'Aggregate query performance',
          query: `
            SELECT tax_year, COUNT(*) as user_count, AVG(annual_basic_salary) as avg_salary
            FROM income_forms
            WHERE annual_basic_salary IS NOT NULL
            GROUP BY tax_year
          `,
          expectedTime: 100 // ms
        }
      ];

      const results = [];

      for (const test of performanceTests) {
        const startTime = Date.now();
        try {
          await this.pool.query(test.query);
          const endTime = Date.now();
          const duration = endTime - startTime;

          results.push({
            name: test.name,
            duration: duration,
            expectedTime: test.expectedTime,
            passed: duration <= test.expectedTime,
            performance: duration <= test.expectedTime ? 'GOOD' : 'SLOW'
          });

          if (duration > test.expectedTime) {
            this.addRecommendation('Performance', 'MEDIUM',
              `Slow query detected: "${test.name}" took ${duration}ms (expected: ${test.expectedTime}ms)`,
              test.query);
          }

        } catch (error) {
          results.push({
            name: test.name,
            duration: null,
            error: error.message,
            passed: false,
            performance: 'ERROR'
          });
        }
      }

      // Test connection pool performance
      const connectionStartTime = Date.now();
      const connections = [];
      for (let i = 0; i < 10; i++) {
        connections.push(this.pool.connect());
      }

      await Promise.all(connections);
      const connectionEndTime = Date.now();
      const connectionPoolTime = connectionEndTime - connectionStartTime;

      // Release connections
      const clients = await Promise.all(connections);
      clients.forEach(client => client.release());

      this.auditResults.performanceMetrics = {
        queryTests: results,
        connectionPoolTime: connectionPoolTime,
        avgQueryTime: results.filter(r => r.duration).reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.duration).length,
        slowQueries: results.filter(r => r.performance === 'SLOW').length
      };

      if (connectionPoolTime > 1000) {
        this.addRecommendation('Performance', 'HIGH',
          `Connection pool performance is slow: ${connectionPoolTime}ms for 10 connections`);
      }

      this.log(`Performance testing completed: ${results.length} tests, ${results.filter(r => r.passed).length} passed`, 'SUCCESS');

    } catch (error) {
      this.log(`Performance testing failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // 5. Data Integrity Checks
  async checkDataIntegrity() {
    this.log('Checking data integrity...', 'AUDIT');

    try {
      const integrityChecks = [];

      // Check for NULL values in critical fields
      const nullChecks = [
        { table: 'users', column: 'email', critical: true },
        { table: 'users', column: 'password_hash', critical: true },
        { table: 'tax_returns', column: 'user_id', critical: true },
        { table: 'income_forms', column: 'tax_return_id', critical: true }
      ];

      for (const check of nullChecks) {
        const result = await this.pool.query(`
          SELECT COUNT(*) as null_count
          FROM ${check.table}
          WHERE ${check.column} IS NULL
        `);

        const nullCount = parseInt(result.rows[0].null_count);
        integrityChecks.push({
          type: 'NULL_CHECK',
          table: check.table,
          column: check.column,
          nullCount: nullCount,
          critical: check.critical,
          passed: nullCount === 0
        });

        if (nullCount > 0 && check.critical) {
          this.addRecommendation('Data Integrity', 'HIGH',
            `Critical NULL values found: ${check.table}.${check.column} has ${nullCount} NULL values`);
        }
      }

      // Check for duplicate emails
      const duplicateEmailsResult = await this.pool.query(`
        SELECT email, COUNT(*) as count
        FROM users
        GROUP BY email
        HAVING COUNT(*) > 1
      `);

      integrityChecks.push({
        type: 'DUPLICATE_CHECK',
        table: 'users',
        column: 'email',
        duplicates: duplicateEmailsResult.rows.length,
        passed: duplicateEmailsResult.rows.length === 0
      });

      if (duplicateEmailsResult.rows.length > 0) {
        this.addRecommendation('Data Integrity', 'HIGH',
          `Duplicate emails found: ${duplicateEmailsResult.rows.length} duplicate email addresses`);
      }

      // Check data consistency between forms
      const inconsistentDataResult = await this.pool.query(`
        SELECT tr.id, tr.user_id, tr.tax_year,
               CASE WHEN if.tax_return_id IS NULL THEN 'missing_income' ELSE 'ok' END as income_status,
               CASE WHEN atf.tax_return_id IS NULL THEN 'missing_adjustable' ELSE 'ok' END as adjustable_status
        FROM tax_returns tr
        LEFT JOIN income_forms if ON tr.id = if.tax_return_id
        LEFT JOIN adjustable_tax_forms atf ON tr.id = atf.tax_return_id
        WHERE if.tax_return_id IS NULL OR atf.tax_return_id IS NULL
        LIMIT 10
      `);

      integrityChecks.push({
        type: 'CONSISTENCY_CHECK',
        description: 'Tax returns with missing form data',
        inconsistentRecords: inconsistentDataResult.rows.length,
        passed: inconsistentDataResult.rows.length === 0
      });

      this.auditResults.dataIntegrity = {
        checks: integrityChecks,
        totalChecks: integrityChecks.length,
        passedChecks: integrityChecks.filter(c => c.passed).length,
        criticalIssues: integrityChecks.filter(c => !c.passed && c.critical).length
      };

      this.log(`Data integrity checks completed: ${integrityChecks.filter(c => c.passed).length}/${integrityChecks.length} passed`, 'SUCCESS');

    } catch (error) {
      this.log(`Data integrity checks failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // 6. Generate Database Health Score
  calculateHealthScore() {
    let score = 100;
    const { recommendations } = this.auditResults;

    // Deduct points based on issues
    const criticalIssues = recommendations.filter(r => r.priority === 'HIGH').length;
    const mediumIssues = recommendations.filter(r => r.priority === 'MEDIUM').length;
    const lowIssues = recommendations.filter(r => r.priority === 'LOW').length;

    score -= (criticalIssues * 15) + (mediumIssues * 8) + (lowIssues * 3);

    // Performance bonus/penalty
    const { performanceMetrics } = this.auditResults;
    if (performanceMetrics.avgQueryTime < 50) score += 5;
    if (performanceMetrics.avgQueryTime > 200) score -= 10;
    if (performanceMetrics.slowQueries > 2) score -= 15;

    // Data integrity bonus/penalty
    const { dataIntegrity } = this.auditResults;
    if (dataIntegrity.criticalIssues === 0) score += 5;
    if (dataIntegrity.criticalIssues > 0) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  // Main audit function
  async runDatabaseAudit() {
    this.log('🗄️  Starting Comprehensive Database Audit...', 'START');

    const startTime = Date.now();

    try {
      await this.analyzeSchema();
      await this.analyzeIndexes();
      await this.analyzeConstraints();
      await this.performanceTest();
      await this.checkDataIntegrity();

      const healthScore = this.calculateHealthScore();
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.generateDatabaseReport(healthScore, duration);

    } catch (error) {
      this.log(`❌ Database audit failed: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  // Generate comprehensive report
  generateDatabaseReport(healthScore, duration) {
    this.log('📊 Generating Database Audit Report...', 'REPORT');

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        databaseName: process.env.DB_NAME || 'tax_advisor',
        healthScore: healthScore
      },
      summary: {
        healthScore: healthScore,
        totalTables: this.auditResults.schemaAnalysis.totalTables,
        totalIndexes: this.auditResults.indexAnalysis.totalIndexes,
        totalRecommendations: this.auditResults.recommendations.length,
        criticalIssues: this.auditResults.recommendations.filter(r => r.priority === 'HIGH').length,
        performanceRating: this.auditResults.performanceMetrics.avgQueryTime < 100 ? 'EXCELLENT' : 'GOOD'
      },
      detailed: this.auditResults
    };

    // Write report to file
    const reportPath = path.join(__dirname, 'DATABASE_AUDIT_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate summary
    this.log('\n' + '='.repeat(80), 'REPORT');
    this.log('🗄️  DATABASE AUDIT SUMMARY', 'REPORT');
    this.log('='.repeat(80), 'REPORT');
    this.log(`Database Health Score: ${healthScore}/100`, 'REPORT');
    this.log(`Total Tables: ${report.summary.totalTables}`, 'REPORT');
    this.log(`Total Indexes: ${report.summary.totalIndexes}`, 'REPORT');
    this.log(`Performance Rating: ${report.summary.performanceRating}`, 'REPORT');
    this.log(`Critical Issues: ${report.summary.criticalIssues}`, 'REPORT');
    this.log(`Audit Duration: ${duration}ms`, 'REPORT');

    if (this.auditResults.recommendations.length > 0) {
      this.log('\n📋 RECOMMENDATIONS BY PRIORITY:', 'REPORT');
      ['HIGH', 'MEDIUM', 'LOW'].forEach(priority => {
        const recs = this.auditResults.recommendations.filter(r => r.priority === priority);
        if (recs.length > 0) {
          this.log(`\n${priority} PRIORITY (${recs.length} items):`, 'REPORT');
          recs.forEach((rec, index) => {
            this.log(`  ${index + 1}. [${rec.category}] ${rec.description}`, 'REPORT');
          });
        }
      });
    }

    this.log(`\n📄 Detailed report saved to: ${reportPath}`, 'REPORT');
    this.log('='.repeat(80), 'REPORT');

    return report;
  }
}

// Run the audit
async function main() {
  console.log('🗄️  Pakistani Tax Advisor - Database Audit Tool');
  console.log('📊 Comprehensive Database Performance & Schema Analysis Starting...\n');

  const audit = new DatabaseAudit();
  await audit.runDatabaseAudit();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Database audit failed:', error);
    process.exit(1);
  });
}

module.exports = DatabaseAudit;