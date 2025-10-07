const axios = require('axios');

async function testAPIEndpoint() {
    console.log('🧪 TESTING API ENDPOINT DIRECTLY');
    console.log('================================');

    try {
        // First login as super admin
        console.log('1. Logging in as super admin...');
        const loginResponse = await axios.post('http://localhost:3001/api/login', {
            email: 'admin@test.com',
            password: 'admin123'
        });

        console.log('Login response:', loginResponse.data);

        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data);
            return;
        }

        const authToken = loginResponse.data.sessionToken;
        console.log('✅ Login successful');

        // Test the users API endpoint
        console.log('\n2. Testing /api/admin/users endpoint...');
        const usersResponse = await axios.get('http://localhost:3001/api/admin/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (usersResponse.data.success) {
            console.log('✅ API endpoint working');
            console.log(`📊 Returned ${usersResponse.data.data.length} users:`);

            usersResponse.data.data.forEach((user, i) => {
                console.log(`${i+1}. ${user.name} (${user.email})`);
                console.log(`   Status: ${user.is_active ? 'ACTIVE' : 'INACTIVE'}`);
                console.log(`   Role: ${user.role}`);
                console.log(`   Tax Returns: ${user.tax_returns_count}`);
                console.log('');
            });

            console.log('📋 Response Headers:');
            console.log('   Cache-Control:', usersResponse.headers['cache-control']);
            console.log('   Pragma:', usersResponse.headers['pragma']);
            console.log('   Expires:', usersResponse.headers['expires']);

        } else {
            console.log('❌ API call failed:', usersResponse.data);
        }

        // Test with cache busting
        console.log('\n3. Testing with cache busting parameters...');
        const cacheBustResponse = await axios.get(`http://localhost:3001/api/admin/users?_t=${Date.now()}&refresh=true`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (cacheBustResponse.data.success) {
            console.log('✅ Cache busting API call working');
            console.log(`📊 Returned ${cacheBustResponse.data.data.length} users with cache busting`);
        } else {
            console.log('❌ Cache busting API call failed:', cacheBustResponse.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testAPIEndpoint().then(() => {
    console.log('\n🏁 API test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});