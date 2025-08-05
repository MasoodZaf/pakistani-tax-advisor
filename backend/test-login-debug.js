const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost', 
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function testLogin() {
  try {
    const testEmail = 'ayesha.ahmed@techsol.com.pk';
    const testPassword = 'TestPass123';
    
    console.log('Testing login for:', testEmail);
    
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:', user.name);
    console.log('Role:', user.role);
    console.log('Active:', user.is_active);
    
    const passwordMatch = await bcrypt.compare(testPassword, user.password_hash);
    console.log('Password match:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('❌ Password does not match');
      console.log('Stored hash:', user.password_hash);
      
      // Let's fix the password by updating it
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('Updating password hash...');
      
      await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [newHash, testEmail]);
      console.log('✅ Password updated successfully');
    } else {
      console.log('✅ Login should work!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testLogin();