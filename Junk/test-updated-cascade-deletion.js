const axios = require('axios');

async function testUpdatedCascadeDeletion() {
    console.log('🧪 TESTING UPDATED CASCADE DELETION');
    console.log('==================================');

    try {
        // First login as admin
        console.log('1. Logging in as admin...');
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'admin@test.com',
            password: 'admin123'
        });

        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data);
            return;
        }

        const authToken = loginResponse.data.sessionToken;
        console.log('✅ Login successful');

        // Get list of users to find one to test delete
        console.log('\n2. Getting user list...');
        const usersResponse = await axios.get('http://localhost:3001/api/admin/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!usersResponse.data.success) {
            console.log('❌ Failed to get users:', usersResponse.data);
            return;
        }

        // Find a test user (not admin) to delete
        const testUsers = usersResponse.data.data.filter(u =>
            u.role === 'user' &&
            u.is_active &&
            (u.email.includes('test') || u.email.includes('example'))
        );

        if (testUsers.length === 0) {
            console.log('❌ No test users found to delete');
            return;
        }

        const targetUser = testUsers[0];
        console.log(`✅ Found test user: ${targetUser.name} (${targetUser.email})`);

        // Check if user has tax calculations (the problematic table)
        console.log('\n3. Checking for related tax calculations...');
        // We can't query directly from frontend, so we'll just attempt the delete

        // Attempt deletion
        console.log('\n4. Attempting cascade deletion...');
        try {
            const deleteResponse = await axios.delete(`http://localhost:3001/api/admin/users/${targetUser.id}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (deleteResponse.data.success) {
                console.log('🎉 CASCADE DELETION SUCCESSFUL!');
                console.log(`✅ Message: ${deleteResponse.data.message}`);
                if (deleteResponse.data.deletedRecords) {
                    console.log(`📊 Total records deleted: ${deleteResponse.data.deletedRecords}`);
                }

                // Verify user is gone by trying to fetch again
                console.log('\n5. Verifying deletion...');
                const verifyResponse = await axios.get('http://localhost:3001/api/admin/users', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                const stillExists = verifyResponse.data.data.find(u => u.id === targetUser.id);
                if (stillExists) {
                    console.log('❌ User still exists after deletion!');
                } else {
                    console.log('✅ User successfully removed from database');
                }

            } else {
                console.log('❌ DELETE FAILED:', deleteResponse.data);
            }

        } catch (error) {
            console.log('❌ DELETE ERROR:', error.response?.data || error.message);

            if (error.response?.data?.message?.includes('foreign key')) {
                console.log('\n🔍 FOREIGN KEY ERROR DETECTED:');
                console.log('This indicates we are still missing some table from cascade deletion');
                console.log('Check the error message above for the specific table/constraint');
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testUpdatedCascadeDeletion().then(() => {
    console.log('\n🏁 Updated cascade deletion test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});