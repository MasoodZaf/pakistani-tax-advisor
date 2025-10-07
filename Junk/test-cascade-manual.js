const { pool } = require('./src/config/database');

async function testCascadeManually() {
    console.log('🧪 Testing CASCADE DELETION Manually\n');

    try {
        // Step 1: Find our test user
        const targetUser = await pool.query(
            'SELECT id, name, email FROM users WHERE email = $1',
            ['ali.raza@example.com']
        );

        if (targetUser.rows.length === 0) {
            console.log('❌ Test user Ali Raza not found');
            return;
        }

        const user = targetUser.rows[0];
        console.log(`🎯 Target User: ${user.name} (${user.email})`);
        console.log(`   ID: ${user.id}\n`);

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
            const result = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE user_id = $1`, [user.id]);
            const count = parseInt(result.rows[0].count);
            beforeCounts[table] = count;
            totalRecordsBefore += count;
            if (count > 0) {
                console.log(`   ${table}: ${count} records`);
            }
        }

        // Check tax returns
        const taxReturnsResult = await pool.query(`SELECT COUNT(*) FROM tax_returns WHERE user_id = $1`, [user.id]);
        const taxReturnsCount = parseInt(taxReturnsResult.rows[0].count);
        beforeCounts.tax_returns = taxReturnsCount;
        totalRecordsBefore += taxReturnsCount;
        console.log(`   tax_returns: ${taxReturnsCount} records`);

        console.log(`   👥 TOTAL RELATED RECORDS: ${totalRecordsBefore}\n`);

        // Step 3: Perform CASCADE DELETION manually using the same logic as admin route
        console.log('🚀 PERFORMING CASCADE DELETION manually...');

        // Start transaction
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            let deletedRecordsCount = 0;

            // Delete from form tables first
            for (const tableName of formTables) {
                const deleteResult = await client.query(`DELETE FROM ${tableName} WHERE user_id = $1`, [user.id]);
                deletedRecordsCount += deleteResult.rowCount;
                console.log(`   Deleted ${deleteResult.rowCount} records from ${tableName}`);
            }

            // Delete tax returns
            const taxReturnsDeleteResult = await client.query(`DELETE FROM tax_returns WHERE user_id = $1`, [user.id]);
            deletedRecordsCount += taxReturnsDeleteResult.rowCount;
            console.log(`   Deleted ${taxReturnsDeleteResult.rowCount} records from tax_returns`);

            // Delete user sessions
            const sessionsDeleteResult = await client.query(`DELETE FROM user_sessions WHERE user_id = $1`, [user.id]);
            deletedRecordsCount += sessionsDeleteResult.rowCount;
            console.log(`   Deleted ${sessionsDeleteResult.rowCount} records from user_sessions`);

            // Delete audit logs
            const auditLogsDeleteResult = await client.query(`DELETE FROM audit_log WHERE user_id = $1`, [user.id]);
            deletedRecordsCount += auditLogsDeleteResult.rowCount;
            console.log(`   Deleted ${auditLogsDeleteResult.rowCount} records from audit_log`);

            // HARD DELETE - Actually remove the user record
            const userDeleteResult = await client.query(`DELETE FROM users WHERE id = $1`, [user.id]);
            console.log(`   Deleted ${userDeleteResult.rowCount} user record`);

            await client.query('COMMIT');
            console.log(`✅ CASCADE DELETION SUCCESSFUL - Total ${deletedRecordsCount + userDeleteResult.rowCount} records deleted`);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

        // Step 4: Verify deletion
        console.log('\n📊 AFTER DELETION - Verification:');

        let totalRecordsAfter = 0;

        for (const table of formTables) {
            const result = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE user_id = $1`, [user.id]);
            const count = parseInt(result.rows[0].count);
            totalRecordsAfter += count;

            if (beforeCounts[table] > 0 || count > 0) {
                const status = count === 0 ? '✅' : '❌';
                console.log(`   ${status} ${table}: ${beforeCounts[table]} → ${count}`);
            }
        }

        // Verify tax returns
        const taxReturnsAfter = await pool.query(`SELECT COUNT(*) FROM tax_returns WHERE user_id = $1`, [user.id]);
        const taxReturnsAfterCount = parseInt(taxReturnsAfter.rows[0].count);
        totalRecordsAfter += taxReturnsAfterCount;
        const taxReturnStatus = taxReturnsAfterCount === 0 ? '✅' : '❌';
        console.log(`   ${taxReturnStatus} tax_returns: ${taxReturnsCount} → ${taxReturnsAfterCount}`);

        // Verify user record
        const userAfter = await pool.query(`SELECT COUNT(*) FROM users WHERE id = $1`, [user.id]);
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
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testCascadeManually().then(() => {
    console.log('\n🏁 Manual cascade deletion test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});