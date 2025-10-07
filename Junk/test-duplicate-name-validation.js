const axios = require('axios');

async function testDuplicateNameValidation() {
    console.log('🧪 TESTING DUPLICATE NAME VALIDATION');
    console.log('===================================');

    try {
        // Test 1: Try to register a user with existing name "gg"
        console.log('\n1. Testing duplicate name validation in registration...');

        try {
            const duplicateNameResponse = await axios.post('http://localhost:3001/api/register', {
                email: 'newgg@example.com',
                name: 'gg',  // This name already exists
                password: 'password123'
            });

            console.log('❌ VALIDATION FAILED - Registration allowed duplicate name');
            console.log('Response:', duplicateNameResponse.data);

        } catch (error) {
            if (error.response?.status === 409 && error.response?.data?.error?.includes('name already exists')) {
                console.log('✅ VALIDATION WORKING - Duplicate name rejected');
                console.log('Error message:', error.response.data.error);
                console.log('Details:', error.response.data.message);
                console.log('Suggestion:', error.response.data.suggestion);
            } else {
                console.log('❓ Unexpected error:', error.response?.data || error.message);
            }
        }

        // Test 2: Try with case variations
        console.log('\n2. Testing case-insensitive duplicate name validation...');

        try {
            const caseVariationResponse = await axios.post('http://localhost:3001/api/register', {
                email: 'uppergg@example.com',
                name: 'GG',  // Same name but uppercase
                password: 'password123'
            });

            console.log('❌ VALIDATION FAILED - Case variation allowed');
            console.log('Response:', caseVariationResponse.data);

        } catch (error) {
            if (error.response?.status === 409 && error.response?.data?.error?.includes('name already exists')) {
                console.log('✅ CASE-INSENSITIVE VALIDATION WORKING - Uppercase variation rejected');
                console.log('Error message:', error.response.data.error);
            } else {
                console.log('❓ Unexpected error:', error.response?.data || error.message);
            }
        }

        // Test 3: Try with space variations
        console.log('\n3. Testing space-trimmed duplicate name validation...');

        try {
            const spaceVariationResponse = await axios.post('http://localhost:3001/api/register', {
                email: 'spacegg@example.com',
                name: '  gg  ',  // Same name but with spaces
                password: 'password123'
            });

            console.log('❌ VALIDATION FAILED - Space variation allowed');
            console.log('Response:', spaceVariationResponse.data);

        } catch (error) {
            if (error.response?.status === 409 && error.response?.data?.error?.includes('name already exists')) {
                console.log('✅ SPACE-TRIMMED VALIDATION WORKING - Space variation rejected');
                console.log('Error message:', error.response.data.error);
            } else {
                console.log('❓ Unexpected error:', error.response?.data || error.message);
            }
        }

        // Test 4: Try to create user with unique name (should work)
        console.log('\n4. Testing unique name registration (should succeed)...');

        try {
            const uniqueNameResponse = await axios.post('http://localhost:3001/api/register', {
                email: 'unique@example.com',
                name: 'Unique Test User',
                password: 'password123'
            });

            if (uniqueNameResponse.data.success) {
                console.log('✅ UNIQUE NAME ALLOWED - Registration successful');
                console.log('New user:', uniqueNameResponse.data.user?.name);

                // Clean up - delete the test user
                console.log('   Cleaning up test user...');
                // Note: Would need admin login and delete, but for now just note it was created

            } else {
                console.log('❌ Unique name registration failed:', uniqueNameResponse.data);
            }

        } catch (error) {
            console.log('❌ Unique name registration failed:', error.response?.data || error.message);
        }

        // Test 5: Test admin user creation with duplicate name
        console.log('\n5. Testing admin user creation with duplicate name...');

        // First login as admin
        try {
            const loginResponse = await axios.post('http://localhost:3001/api/login', {
                email: 'admin@test.com',
                password: 'admin123'
            });

            if (loginResponse.data.success) {
                const authToken = loginResponse.data.sessionToken;
                console.log('   Logged in as admin successfully');

                // Try to create user with duplicate name via admin
                try {
                    const adminDuplicateResponse = await axios.post('http://localhost:3001/api/admin/users', {
                        email: 'admin-gg@example.com',
                        name: 'gg',  // Duplicate name
                        password: 'password123',
                        role: 'user'
                    }, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });

                    console.log('❌ ADMIN VALIDATION FAILED - Duplicate name allowed');
                    console.log('Response:', adminDuplicateResponse.data);

                } catch (error) {
                    if (error.response?.status === 409 && error.response?.data?.error?.includes('name already exists')) {
                        console.log('✅ ADMIN VALIDATION WORKING - Duplicate name rejected');
                        console.log('Error message:', error.response.data.error);
                        console.log('Details:', error.response.data.message);
                    } else {
                        console.log('❓ Unexpected admin error:', error.response?.data || error.message);
                    }
                }
            }
        } catch (loginError) {
            console.log('❌ Admin login failed:', loginError.response?.data || loginError.message);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testDuplicateNameValidation().then(() => {
    console.log('\n🏁 Duplicate name validation test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});