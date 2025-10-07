const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function createNewTestUser() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // New test user details
    const testUser = {
      name: 'Test User Demo',
      email: 'testuser@paktaxadvisor.com',
      password: 'TestUser123',
      user_type: 'individual',
      role: 'user'
    };
    
    console.log(`🔄 Creating new test user: ${testUser.email}`);
    
    // Check if user already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [testUser.email]);
    if (existingUser.rows.length > 0) {
      console.log('❌ User already exists, deleting first...');
      // Delete existing user first
      await client.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    console.log('✅ Password hashed successfully');
    
    // Create user with UUID
    const userId = uuidv4();
    const userResult = await client.query(`
      INSERT INTO users (
        id, email, name, password_hash, user_type, role, 
        is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id, email, name, user_type, role, is_active, created_at
    `, [userId, testUser.email, testUser.name, passwordHash, testUser.user_type, testUser.role]);
    
    const newUser = userResult.rows[0];
    console.log('✅ User created:', {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      user_type: newUser.user_type
    });
    
    // Get current tax year
    const taxYearResult = await client.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true AND is_active = true
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }
    
    const currentTaxYear = taxYearResult.rows[0];
    console.log('✅ Current tax year:', currentTaxYear.tax_year);
    
    // Create tax return for current year
    const taxReturnId = uuidv4();
    const returnNumber = `TR-${userId.slice(0, 8)}-${currentTaxYear.tax_year}`;
    
    const returnResult = await client.query(`
      INSERT INTO tax_returns (
        id, user_id, user_email, tax_year_id, tax_year,
        return_number, filing_status, filing_type, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', 'normal', NOW())
      RETURNING id, return_number
    `, [
      taxReturnId,
      newUser.id,
      newUser.email,
      currentTaxYear.id,
      currentTaxYear.tax_year,
      returnNumber
    ]);
    
    console.log('✅ Tax return created:', returnResult.rows[0].return_number);
    
    // Initialize form tables
    const formTables = [
      'income_forms', 'adjustable_tax_forms', 'reductions_forms',
      'credits_forms', 'deductions_forms', 'final_tax_forms',
      'capital_gain_forms', 'expenses_forms', 'wealth_forms',
      'form_completion_status'
    ];
    
    for (const tableName of formTables) {
      try {
        await client.query(`
          INSERT INTO ${tableName} (
            id, tax_return_id, user_id, user_email,
            tax_year_id, tax_year, created_at
          ) VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, NOW())
        `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
        
        console.log(`✅ Initialized ${tableName}`);
      } catch (error) {
        console.log(`⚠️  Warning: Could not initialize ${tableName} - ${error.message}`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n🎉 NEW TEST USER CREATED SUCCESSFULLY!');
    console.log('=====================================');
    console.log(`Email: ${testUser.email}`);
    console.log(`Password: ${testUser.password}`);
    console.log(`Name: ${testUser.name}`);
    console.log(`Role: ${testUser.role}`);
    console.log(`User Type: ${testUser.user_type}`);
    console.log(`Tax Return: ${returnNumber}`);
    console.log('=====================================');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating test user:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

createNewTestUser();