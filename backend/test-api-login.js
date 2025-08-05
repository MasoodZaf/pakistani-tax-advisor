const bcrypt = require('bcrypt');
const { pool } = require('./src/config/database');

async function testAPILogin(email, password) {
  try {
    console.log('=== API Login Test ===');
    console.log(`Testing login for: ${email}`);
    
    // EXACT same query as in auth.js
    const adminUser = await pool.query(`
      SELECT 
        au.id, 
        au.email, 
        au.username as name, 
        au.password_hash, 
        r.name as role, 
        r.permissions,
        'admin' as user_type
      FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.email = $1 AND au.is_active = true
    `, [email]);
    
    console.log(`Admin user query result: ${adminUser.rows.length} rows`);
    
    let userData = null;
    let isAdmin = false;
    
    if (adminUser.rows.length > 0) {
      console.log('Admin user found, checking password...');
      console.log('Hash from DB:', adminUser.rows[0].password_hash);
      
      const passwordMatch = await bcrypt.compare(password, adminUser.rows[0].password_hash);
      console.log(`Password match result: ${passwordMatch}`);
      
      if (passwordMatch) {
        userData = adminUser.rows[0];
        isAdmin = true;
        console.log('Admin authentication successful');
        
        return {
          success: true,
          user: {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            user_type: userData.user_type,
            permissions: userData.permissions
          },
          isAdmin,
          sessionToken: 'test-token-123'
        };
      } else {
        console.log('Admin password mismatch');
        return { success: false, error: 'Invalid credentials (admin password mismatch)' };
      }
    } else {
      console.log('No admin user found, trying regular user...');
      
      const user = await pool.query(`
        SELECT id, email, name, password_hash, role, user_type 
        FROM users 
        WHERE email = $1 AND is_active = true
      `, [email]);
      
      console.log(`Regular user query result: ${user.rows.length} rows`);
      
      if (user.rows.length === 0) {
        console.log('No regular user found either');
        return { success: false, error: 'Invalid credentials (no user found)' };
      }
      
      const passwordMatch = await bcrypt.compare(password, user.rows[0].password_hash);
      console.log(`Regular user password match: ${passwordMatch}`);
      
      if (!passwordMatch) {
        console.log('Regular user password mismatch');
        return { success: false, error: 'Invalid credentials (user password mismatch)' };
      }
      
      userData = user.rows[0];
      console.log('Regular user authentication successful');
      
      return {
        success: true,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          user_type: userData.user_type
        },
        isAdmin: false,
        sessionToken: 'test-token-456'
      };
    }
    
  } catch (error) {
    console.error('API Login test error:', error);
    return { success: false, error: error.message };
  }
}

(async () => {
  const result = await testAPILogin('admin@demo.pk', 'admin123');
  console.log('\n=== Final Result ===');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();