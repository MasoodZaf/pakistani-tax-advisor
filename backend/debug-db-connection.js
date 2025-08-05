const { pool } = require('./src/config/database');

(async () => {
  try {
    console.log('Testing database connection and admin user query...');
    
    // Test basic connection
    const healthCheck = await pool.query('SELECT NOW() as current_time');
    console.log('Database connection successful:', healthCheck.rows[0]);
    
    // Test the exact query from auth.js
    const adminQuery = `
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
    `;
    
    console.log('Executing admin query with email: admin@demo.pk');
    const adminResult = await pool.query(adminQuery, ['admin@demo.pk']);
    console.log(`Admin query result: ${adminResult.rows.length} rows`);
    
    if (adminResult.rows.length > 0) {
      console.log('Admin user found:');
      console.log('- ID:', adminResult.rows[0].id);
      console.log('- Email:', adminResult.rows[0].email);
      console.log('- Name:', adminResult.rows[0].name);
      console.log('- Role:', adminResult.rows[0].role);
      console.log('- Has password hash:', !!adminResult.rows[0].password_hash);
    } else {
      console.log('No admin user found');
      
      // Debug: Check admin_users table directly
      const directAdminQuery = await pool.query('SELECT id, email, username, is_active FROM admin_users WHERE email = $1', ['admin@demo.pk']);
      console.log(`Direct admin_users query: ${directAdminQuery.rows.length} rows`);
      if (directAdminQuery.rows.length > 0) {
        console.log('Direct admin user data:', directAdminQuery.rows[0]);
        
        // Check if the role join is the issue
        const roleQuery = await pool.query('SELECT * FROM roles WHERE id = (SELECT role_id FROM admin_users WHERE email = $1)', ['admin@demo.pk']);
        console.log(`Role query: ${roleQuery.rows.length} rows`);
        if (roleQuery.rows.length > 0) {
          console.log('Role data:', roleQuery.rows[0]);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Database test error:', error);
    process.exit(1);
  }
})();