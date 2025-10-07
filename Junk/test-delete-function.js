const axios = require('axios');

// Test the admin delete function
async function testDeleteFunction() {
    const baseURL = 'http://localhost:3001';
    let authToken = '';

    console.log('🔍 Testing Admin Delete Function\n');

    try {
        // Step 1: Login as super admin
        console.log('1️⃣ Logging in as super admin...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            email: 'super_admin@pakistanitaxadvisor.com',
            password: 'SuperAdmin123!'
        });

        if (loginResponse.data.success) {
            authToken = loginResponse.data.data.sessionToken;
            console.log('✅ Login successful');
            console.log(`   User: ${loginResponse.data.data.user.name} (${loginResponse.data.data.user.role})`);
        } else {
            console.log('❌ Login failed:', loginResponse.data);
            return;
        }

        // Step 2: Get all users
        console.log('\n2️⃣ Fetching all users...');
        const usersResponse = await axios.get(`${baseURL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (usersResponse.data.success) {
            const users = usersResponse.data.data;
            console.log(`✅ Found ${users.length} users:`);

            // Find our test users (the ones we just created)
            const testUsers = users.filter(user =>
                ['gg@example.com', 'ali.raza@example.com', 'omer.shaikh@example.com'].includes(user.email)
            );

            console.log('\n📋 Test users available for deletion:');
            testUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.name} (${user.email}) - ID: ${user.id} - Status: ${user.is_active ? 'ACTIVE' : 'INACTIVE'}`);
            });

            if (testUsers.length === 0) {
                console.log('⚠️  No test users found. Please create test users first.');
                return;
            }

            // Step 3: Test delete function on first test user
            const userToDelete = testUsers[0];
            console.log(`\n3️⃣ Testing delete function on user: ${userToDelete.name}`);
            console.log(`   User ID: ${userToDelete.id}`);
            console.log(`   Current status: ${userToDelete.is_active ? 'ACTIVE' : 'INACTIVE'}`);

            try {
                const deleteResponse = await axios.delete(`${baseURL}/api/admin/users/${userToDelete.id}`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                console.log('\n✅ Delete request successful!');
                console.log(`   Response: ${deleteResponse.data.message}`);

                // Step 4: Verify deletion (check if user is now inactive)
                console.log('\n4️⃣ Verifying deletion...');
                const verifyResponse = await axios.get(`${baseURL}/api/admin/users`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (verifyResponse.data.success) {
                    const updatedUser = verifyResponse.data.data.find(u => u.id === userToDelete.id);
                    if (updatedUser) {
                        console.log(`✅ User status after deletion: ${updatedUser.is_active ? 'ACTIVE' : 'INACTIVE'}`);
                        if (!updatedUser.is_active) {
                            console.log('🎉 DELETE FUNCTION WORKING CORRECTLY! User was soft-deleted (deactivated).');
                        } else {
                            console.log('❌ DELETE FUNCTION NOT WORKING! User is still active.');
                        }
                    } else {
                        console.log('❌ User not found after deletion attempt.');
                    }
                }

            } catch (deleteError) {
                console.log('\n❌ Delete request failed!');
                console.log(`   Status: ${deleteError.response?.status}`);
                console.log(`   Error: ${deleteError.response?.data?.error || deleteError.message}`);
                console.log(`   Message: ${deleteError.response?.data?.message || 'Unknown error'}`);

                // Check if it's an authorization issue
                if (deleteError.response?.status === 403) {
                    console.log('\n🔍 This appears to be an authorization issue.');
                    console.log('   Make sure the user has super_admin role.');
                }
            }

        } else {
            console.log('❌ Failed to fetch users:', usersResponse.data);
        }

    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data:`, error.response.data);
        }
    }
}

// Run the test
testDeleteFunction().then(() => {
    console.log('\n🏁 Test completed.');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});