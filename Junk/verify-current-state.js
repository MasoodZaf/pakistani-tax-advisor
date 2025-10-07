const { pool } = require('./src/config/database');

async function verifyCurrentState() {
    console.log('📊 CURRENT DATABASE STATE:');
    console.log('==========================');

    try {
        const users = await pool.query(`
            SELECT id, name, email, user_type, role, is_active, created_at,
                   (SELECT COUNT(*) FROM tax_returns WHERE user_id = users.id) as tax_returns_count
            FROM users
            WHERE role = 'taxpayer'
            ORDER BY created_at DESC
        `);

        console.log(`Found ${users.rows.length} taxpayer users in database:`);
        users.rows.forEach((user, i) => {
            console.log(`${i+1}. ${user.name} (${user.email})`);
            console.log(`   Status: ${user.is_active ? 'ACTIVE' : 'INACTIVE'}`);
            console.log(`   Tax Returns: ${user.tax_returns_count}`);
            console.log(`   Created: ${user.created_at.toISOString().split('T')[0]}`);
            console.log('');
        });

        // Also check if there are any admin users
        const admins = await pool.query(`
            SELECT id, name, email, role, is_active
            FROM users
            WHERE role IN ('admin', 'super_admin')
            ORDER BY created_at DESC
        `);

        console.log(`\nFound ${admins.rows.length} admin users:`);
        admins.rows.forEach((user, i) => {
            console.log(`${i+1}. ${user.name} (${user.email}) - ${user.role}`);
            console.log(`   Status: ${user.is_active ? 'ACTIVE' : 'INACTIVE'}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyCurrentState().then(() => {
    console.log('\n🏁 Verification completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Verification crashed:', error);
    process.exit(1);
});