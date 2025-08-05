const bcrypt = require('bcrypt');
const { pool } = require('./src/config/database');

async function testLogin(email, password) {
  try {
    console.log('Testing login for:', email);
    
    // First try to authenticate as admin user (exact same query as in auth.js)
    let adminUser = await pool.query(`
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
    
    console.log('Admin user query result:', adminUser.rows.length);
    
    let userData = null;
    let isAdmin = false;
    
    if (adminUser.rows.length > 0) {
      console.log('Admin user found, checking password...');
      const passwordMatch = await bcrypt.compare(password, adminUser.rows[0].password_hash);
      console.log('Password match:', passwordMatch);
      
      if (passwordMatch) {
        userData = adminUser.rows[0];
        isAdmin = true;
        console.log('Admin authentication successful');
      } else {
        console.log('Admin password mismatch');
      }
    }
    
    if (!userData) {
      // Try to authenticate as regular user
      console.log('Trying regular user authentication...');
      const user = await pool.query(`
        SELECT id, email, name, password_hash, role, user_type 
        FROM users 
        WHERE email = $1 AND is_active = true
      `, [email]);
      
      console.log('Regular user query result:', user.rows.length);
      if (user.rows.length > 0) {
        console.log('User found, checking password...');
        const passwordMatch = await bcrypt.compare(password, user.rows[0].password_hash);
        console.log('Password match:', passwordMatch);
        
        if (passwordMatch) {
          userData = user.rows[0];
          console.log('User authentication successful');
        }
      }
    }
    
    if (!userData) {
      console.log('Authentication failed - no matching user/password combination');
      return null;
    }
    
    console.log('Authentication successful!');
    console.log('User data:', {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      user_type: userData.user_type,
      isAdmin
    });
    
    return userData;
    
  } catch (error) {
    console.error('Login test error:', error);
    return null;
  }
}

(async () => {
  await testLogin('admin@demo.pk', 'admin123');
  process.exit(0);
})();