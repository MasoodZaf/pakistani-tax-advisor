const axios = require('axios');
const { pool } = require('./src/config/database');

async function testCascadeDeletion() {
    console.log('🧪 Testing CASCADE DELETION Functionality\n');

    try {
        // Step 1: Find a test user to delete
        const testEmails = ['gg@example.com', 'ali.raza@example.com', 'omer.shaikh@example.com'];

        let targetUser = null;
        for (const email of testEmails) {
            const userResult = await pool.query(
                'SELECT id, name, email FROM users WHERE email = $1',
                [email]
            );

            if (userResult.rows.length > 0) {
                targetUser = userResult.rows[0];
                break;
            }
        }

        if (!targetUser) {
            console.log('❌ No test users found to delete. Please create test users first.');
            return;
        }

        console.log(`🎯 Target User: ${targetUser.name} (${targetUser.email})`);
        console.log(`   ID: ${targetUser.id}\n`);

        // Step 2: Count related data BEFORE deletion
        console.log('📊 BEFORE DELETION - Related Data Count:');

        const formTables = [
            'wealth_forms', 'capital_gain_forms', 'expenses_forms', 'final_tax_forms',
            'deductions_forms', 'credits_forms', 'reductions_forms',
            'adjustable_tax_forms', 'income_forms', 'form_completion_status'
        ];

        let totalRecordsBefore = 0;
        const beforeCounts = {};

        for (const table of formTables) {
            const result = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE user_id = $1`, [targetUser.id]);
            const count = parseInt(result.rows[0].count);
            beforeCounts[table] = count;
            totalRecordsBefore += count;
            if (count > 0) {
                console.log(`   ${table}: ${count} records`);
            }
        }

        // Check tax returns
        const taxReturnsResult = await pool.query(`SELECT COUNT(*) FROM tax_returns WHERE user_id = $1`, [targetUser.id]);
        const taxReturnsCount = parseInt(taxReturnsResult.rows[0].count);
        beforeCounts.tax_returns = taxReturnsCount;
        totalRecordsBefore += taxReturnsCount;
        console.log(`   tax_returns: ${taxReturnsCount} records`);

        // Check user sessions
        const sessionsResult = await pool.query(`SELECT COUNT(*) FROM user_sessions WHERE user_id = $1`, [targetUser.id]);
        const sessionsCount = parseInt(sessionsResult.rows[0].count);
        beforeCounts.user_sessions = sessionsCount;
        totalRecordsBefore += sessionsCount;
        console.log(`   user_sessions: ${sessionsCount} records`);

        console.log(`   👥 TOTAL RELATED RECORDS: ${totalRecordsBefore}\n`);

        // Step 3: Perform deletion via API
        console.log('🚀 PERFORMING CASCADE DELETION via API...');

        // First login as super admin
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'superadmin@paktaxadvisor.com',
            password: 'SuperAdmin123!@#'
        });

        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data);
            return;
        }

        const authToken = loginResponse.data.data.sessionToken;
        console.log('✅ Logged in as super admin');

        // Perform deletion
        const deleteResponse = await axios.delete(`http://localhost:3001/api/admin/users/${targetUser.id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (deleteResponse.data.success) {
            console.log('✅ DELETE API CALL SUCCESSFUL');
            console.log(`   Message: ${deleteResponse.data.message}`);
            if (deleteResponse.data.deletedRecords) {
                console.log(`   Records Deleted: ${deleteResponse.data.deletedRecords}`);
            }
        } else {
            console.log('❌ DELETE API CALL FAILED:', deleteResponse.data);
            return;
        }

        // Step 4: Verify deletion - count remaining data
        console.log('\n📊 AFTER DELETION - Verification:');

        let totalRecordsAfter = 0;

        for (const table of formTables) {
            const result = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE user_id = $1`, [targetUser.id]);
            const count = parseInt(result.rows[0].count);
            totalRecordsAfter += count;

            if (beforeCounts[table] > 0 || count > 0) {
                const status = count === 0 ? '✅' : '❌';
                console.log(`   ${status} ${table}: ${beforeCounts[table]} → ${count}`);
            }
        }

        // Verify tax returns
        const taxReturnsAfter = await pool.query(`SELECT COUNT(*) FROM tax_returns WHERE user_id = $1`, [targetUser.id]);
        const taxReturnsAfterCount = parseInt(taxReturnsAfter.rows[0].count);
        totalRecordsAfter += taxReturnsAfterCount;
        const taxReturnStatus = taxReturnsAfterCount === 0 ? '✅' : '❌';
        console.log(`   ${taxReturnStatus} tax_returns: ${taxReturnsCount} → ${taxReturnsAfterCount}`);

        // Verify user sessions
        const sessionsAfter = await pool.query(`SELECT COUNT(*) FROM user_sessions WHERE user_id = $1`, [targetUser.id]);
        const sessionsAfterCount = parseInt(sessionsAfter.rows[0].count);
        totalRecordsAfter += sessionsAfterCount;
        const sessionStatus = sessionsAfterCount === 0 ? '✅' : '❌';
        console.log(`   ${sessionStatus} user_sessions: ${sessionsCount} → ${sessionsAfterCount}`);

        // Verify user record
        const userAfter = await pool.query(`SELECT COUNT(*) FROM users WHERE id = $1`, [targetUser.id]);
        const userAfterCount = parseInt(userAfter.rows[0].count);
        totalRecordsAfter += userAfterCount;
        const userStatus = userAfterCount === 0 ? '✅' : '❌';
        console.log(`   ${userStatus} users: 1 → ${userAfterCount}`);

        console.log(`\n📈 SUMMARY:`);
        console.log(`   Total Records Before: ${totalRecordsBefore + 1}`); // +1 for user record
        console.log(`   Total Records After: ${totalRecordsAfter}`);
        console.log(`   Records Deleted: ${totalRecordsBefore + 1 - totalRecordsAfter}`);

        if (totalRecordsAfter === 0) {
            console.log('\n🎉 CASCADE DELETION SUCCESSFUL! All related data removed.');
        } else {
            console.log('\n⚠️  CASCADE DELETION INCOMPLETE! Some data remains.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testCascadeDeletion().then(() => {
    console.log('\n🏁 Cascade deletion test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});