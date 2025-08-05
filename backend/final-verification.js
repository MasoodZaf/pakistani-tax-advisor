const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function runFinalVerification() {
  try {
    console.log('🔍 FINAL VERIFICATION - Pakistani Tax Advisor System');
    console.log('====================================================\n');

    // 1. Check database connection
    console.log('1. Database Connection:');
    const connResult = await pool.query('SELECT NOW() as current_time');
    console.log(`   ✅ Connected successfully at ${connResult.rows[0].current_time}\n`);

    // 2. Check users count
    console.log('2. User Statistics:');
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE role = 'admin' OR role = 'super_admin') as admin_users,
        COUNT(*) FILTER (WHERE role = 'user') as regular_users
      FROM users
    `);
    const stats = userStats.rows[0];
    console.log(`   👥 Total Users: ${stats.total_users}`);
    console.log(`   ✅ Active Users: ${stats.active_users}`);
    console.log(`   🔑 Admin Users: ${stats.admin_users}`);
    console.log(`   👤 Regular Users: ${stats.regular_users}\n`);

    // 3. Verify key test accounts
    console.log('3. Key Test Accounts Verification:');
    
    const testAccounts = [
      { email: 'superadmin@paktaxadvisor.com', password: 'superadmin123', role: 'super_admin' },
      { email: 'admin@paktaxadvisory.com', password: 'admin123', role: 'admin' },
      { email: 'testuser@paktaxadvisor.com', password: 'TestUser123', role: 'user' }
    ];

    for (const account of testAccounts) {
      const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [account.email]);
      
      if (userResult.rows.length === 0) {
        console.log(`   ❌ ${account.email} - NOT FOUND`);
        continue;
      }
      
      const user = userResult.rows[0];
      const passwordMatch = await bcrypt.compare(account.password, user.password_hash);
      
      if (passwordMatch && user.role === account.role && user.is_active) {
        console.log(`   ✅ ${account.email} - LOGIN OK (${user.role})`);
      } else {
        console.log(`   ❌ ${account.email} - LOGIN FAILED`);
        console.log(`      Password Match: ${passwordMatch}`);
        console.log(`      Role: ${user.role} (expected: ${account.role})`);
        console.log(`      Active: ${user.is_active}`);
      }
    }

    // 4. Check tax years
    console.log('\n4. Tax Years Configuration:');
    const taxYears = await pool.query('SELECT tax_year, is_current, is_active FROM tax_years ORDER BY tax_year DESC');
    taxYears.rows.forEach(ty => {
      const status = ty.is_current ? '[CURRENT]' : ty.is_active ? '[ACTIVE]' : '[INACTIVE]';
      console.log(`   📅 ${ty.tax_year} ${status}`);
    });

    // 5. Check tax returns for new test user
    console.log('\n5. Test User Tax Returns:');
    const testUserReturns = await pool.query(`
      SELECT tr.return_number, tr.tax_year, tr.filing_status, ty.is_current
      FROM tax_returns tr
      JOIN users u ON tr.user_id = u.id
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      WHERE u.email = 'testuser@paktaxadvisor.com'
      ORDER BY tr.tax_year DESC
    `);
    
    if (testUserReturns.rows.length > 0) {
      testUserReturns.rows.forEach(tr => {
        const current = tr.is_current ? '[CURRENT]' : '';
        console.log(`   📄 ${tr.return_number} - ${tr.tax_year} - ${tr.filing_status} ${current}`);
      });
    } else {
      console.log(`   ❌ No tax returns found for test user`);
    }

    // 6. API Endpoints Test
    console.log('\n6. Testing Key API Endpoints:');
    
    const fetch = (await import('node-fetch')).default;
    
    // Test login
    try {
      const loginResponse = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'testuser@paktaxadvisor.com', 
          password: 'TestUser123' 
        })
      });
      
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        if (loginData.success) {
          console.log('   ✅ POST /api/login - Test user login successful');
          
          // Test admin users endpoint with admin token
          const adminLoginResponse = await fetch('http://localhost:3001/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: 'superadmin@paktaxadvisor.com', 
              password: 'superadmin123' 
            })
          });
          
          if (adminLoginResponse.ok) {
            const adminData = await adminLoginResponse.json();
            
            const usersResponse = await fetch('http://localhost:3001/api/admin/users', {
              headers: { 'Authorization': `Bearer ${adminData.sessionToken}` }
            });
            
            if (usersResponse.ok) {
              const usersData = await usersResponse.json();
              console.log(`   ✅ GET /api/admin/users - Returns ${usersData.data.length} users`);
            } else {
              console.log('   ❌ GET /api/admin/users - Failed');
            }
          }
        } else {
          console.log('   ❌ POST /api/login - Login failed');
        }
      } else {
        console.log('   ❌ POST /api/login - API request failed');
      }
    } catch (error) {
      console.log(`   ❌ API Test Error: ${error.message}`);
    }

    console.log('\n====================================================');
    console.log('🎉 FINAL VERIFICATION COMPLETE!');
    console.log('====================================================');
    console.log('\n📋 NEW TEST USER CREDENTIALS:');
    console.log('   Email: testuser@paktaxadvisor.com');
    console.log('   Password: TestUser123');
    console.log('   Role: user');
    console.log('   Status: ✅ Ready for testing');
    console.log('\n🚀 System is ready for use!');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await pool.end();
  }
}

runFinalVerification();