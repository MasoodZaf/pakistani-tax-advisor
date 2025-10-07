const { pool } = require('./src/config/database');
const bcrypt = require('bcrypt');

async function debugDeleteIssue() {
    console.log('🔍 DEBUG: Investigating Delete Function Issue\n');

    try {
        // Step 1: Check if our test users exist
        console.log('1️⃣ Checking if test users exist...');
        const testEmails = ['gg@example.com', 'ali.raza@example.com', 'omer.shaikh@example.com'];

        for (const email of testEmails) {
            const userResult = await pool.query(
                'SELECT id, name, email, is_active, role FROM users WHERE email = $1',
                [email]
            );

            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                console.log(`   ✅ ${user.name} (${user.email})`);
                console.log(`      ID: ${user.id}`);
                console.log(`      Status: ${user.is_active ? 'ACTIVE' : 'INACTIVE'}`);
                console.log(`      Role: ${user.role}`);
            } else {
                console.log(`   ❌ ${email} - NOT FOUND`);
            }
        }

        // Step 2: Check super admin accounts
        console.log('\n2️⃣ Checking super admin accounts...');
        const adminResult = await pool.query(
            'SELECT id, name, email, role, is_active FROM users WHERE role IN ($1, $2)',
            ['admin', 'super_admin']
        );

        if (adminResult.rows.length > 0) {
            console.log(`   Found ${adminResult.rows.length} admin users:`);
            adminResult.rows.forEach(admin => {
                console.log(`   ${admin.role === 'super_admin' ? '🚀' : '🔧'} ${admin.name} (${admin.email})`);
                console.log(`      Role: ${admin.role}`);
                console.log(`      Status: ${admin.is_active ? 'ACTIVE' : 'INACTIVE'}`);
            });
        } else {
            console.log('   ❌ No admin users found!');
        }

        // Step 3: Test the soft delete functionality manually
        console.log('\n3️⃣ Testing soft delete functionality...');

        // Find the first test user that's active
        const activeTestUser = await pool.query(`
            SELECT id, name, email, is_active
            FROM users
            WHERE email = ANY($1) AND is_active = true
            LIMIT 1
        `, [testEmails]);

        if (activeTestUser.rows.length > 0) {
            const user = activeTestUser.rows[0];
            console.log(`   Testing soft delete on: ${user.name} (${user.email})`);
            console.log(`   Current status: ${user.is_active ? 'ACTIVE' : 'INACTIVE'}`);

            // Perform soft delete manually (like the backend route does)
            const deleteResult = await pool.query(`
                UPDATE users
                SET is_active = false, updated_at = NOW()
                WHERE id = $1
                RETURNING id, name, email, is_active
            `, [user.id]);

            if (deleteResult.rows.length > 0) {
                const updatedUser = deleteResult.rows[0];
                console.log(`   ✅ Soft delete successful!`);
                console.log(`   New status: ${updatedUser.is_active ? 'ACTIVE' : 'INACTIVE'}`);

                // Now reactivate the user for further testing
                await pool.query(`
                    UPDATE users
                    SET is_active = true, updated_at = NOW()
                    WHERE id = $1
                `, [user.id]);
                console.log(`   ↩️  User reactivated for further testing`);

            } else {
                console.log(`   ❌ Soft delete failed - no rows affected`);
            }
        } else {
            console.log('   ⚠️  No active test users found to test delete on');
        }

        // Step 4: Check audit log to see if any delete operations were recorded
        console.log('\n4️⃣ Checking recent delete operations in audit log...');
        const auditResult = await pool.query(`
            SELECT user_email, action, table_name, record_id, created_at
            FROM audit_log
            WHERE action = 'delete' AND table_name = 'users'
            ORDER BY created_at DESC
            LIMIT 5
        `);

        if (auditResult.rows.length > 0) {
            console.log(`   Found ${auditResult.rows.length} recent delete operations:`);
            auditResult.rows.forEach((audit, index) => {
                console.log(`   ${index + 1}. ${audit.user_email} deleted user ${audit.record_id}`);
                console.log(`      Time: ${audit.created_at}`);
            });
        } else {
            console.log('   📝 No delete operations found in audit log');
        }

        // Step 5: Check user sessions to see if admin is properly logged in
        console.log('\n5️⃣ Checking active admin sessions...');
        const sessionsResult = await pool.query(`
            SELECT us.user_id, us.user_email, u.name, u.role, us.expires_at
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE u.role IN ('admin', 'super_admin') AND us.expires_at > NOW()
            ORDER BY us.created_at DESC
        `);

        if (sessionsResult.rows.length > 0) {
            console.log(`   Found ${sessionsResult.rows.length} active admin sessions:`);
            sessionsResult.rows.forEach((session, index) => {
                console.log(`   ${index + 1}. ${session.name} (${session.user_email}) - ${session.role}`);
                console.log(`      Expires: ${session.expires_at}`);
            });
        } else {
            console.log('   ⚠️  No active admin sessions found - this could be the issue!');
        }

        // Step 6: Recommendations
        console.log('\n📋 DIAGNOSIS & RECOMMENDATIONS:');

        if (adminResult.rows.length === 0) {
            console.log('❌ ISSUE: No admin users found in database');
            console.log('   SOLUTION: Create admin users or run admin creation script');
        }

        if (sessionsResult.rows.length === 0) {
            console.log('❌ ISSUE: No active admin sessions');
            console.log('   SOLUTION: Login to admin panel first before trying to delete users');
        }

        if (activeTestUser.rows.length === 0) {
            console.log('❌ ISSUE: No active test users to delete');
            console.log('   SOLUTION: Create test users first or reactivate existing users');
        }

        console.log('\n💡 COMMON DELETE ISSUES:');
        console.log('1. User not logged in as super admin');
        console.log('2. Session token expired or invalid');
        console.log('3. Frontend not refreshing user list after delete');
        console.log('4. JavaScript errors preventing delete request');
        console.log('5. Network/CORS issues between frontend and backend');

        console.log('\n✅ Next steps:');
        console.log('1. Login to admin panel as superadmin@paktaxadvisor.com');
        console.log('2. Open browser dev tools (Network tab)');
        console.log('3. Try to delete a user and watch the network requests');
        console.log('4. Check if DELETE request is made and what response is received');

    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

// Run the debug
debugDeleteIssue().then(() => {
    console.log('\n🏁 Debug completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Debug crashed:', error);
    process.exit(1);
});