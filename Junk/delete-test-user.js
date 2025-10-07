const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function deleteTestUser() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Let's identify the problematic test user - likely ayesha.ahmed@techsol.com.pk
    const testEmail = 'ayesha.ahmed@techsol.com.pk';
    
    console.log(`🔍 Looking for test user: ${testEmail}`);
    
    // Get user details
    const userResult = await client.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Test user not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.name} (ID: ${user.id})`);
    
    // Delete all related data in proper order to avoid foreign key constraints
    
    // 1. Delete form data
    const formTables = [
      'form_completion_status',
      'income_forms', 
      'adjustable_tax_forms', 
      'reductions_forms',
      'credits_forms', 
      'deductions_forms', 
      'final_tax_forms',
      'capital_gain_forms', 
      'expenses_forms', 
      'wealth_forms'
    ];
    
    for (const table of formTables) {
      const result = await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [user.id]);
      console.log(`🗑️  Deleted ${result.rowCount} records from ${table}`);
    }
    
    // 2. Delete tax returns
    const taxReturnsResult = await client.query('DELETE FROM tax_returns WHERE user_id = $1', [user.id]);
    console.log(`🗑️  Deleted ${taxReturnsResult.rowCount} tax returns`);
    
    // 3. Delete user sessions
    const sessionsResult = await client.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id]);
    console.log(`🗑️  Deleted ${sessionsResult.rowCount} user sessions`);
    
    // 4. Delete audit logs
    const auditResult = await client.query('DELETE FROM audit_log WHERE user_id = $1', [user.id]);
    console.log(`🗑️  Deleted ${auditResult.rowCount} audit log entries`);
    
    // 5. Finally delete the user
    const userDeleteResult = await client.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log(`🗑️  Deleted user account: ${userDeleteResult.rowCount} record`);
    
    await client.query('COMMIT');
    
    console.log(`✅ Successfully deleted test user: ${testEmail}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting test user:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

deleteTestUser();