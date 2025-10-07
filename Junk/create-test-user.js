#!/usr/bin/env node

/**
 * Create Test User Script
 * Creates a test user for API testing purposes
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

const testUser = {
  email: 'khurramj@test.com',
  password: 'password123',
  name: 'Khurram Javed',
  phone: '+92-300-1234567',
  cnic: '12345-6789012-3',
  dateOfBirth: '1985-01-15',
  userType: 'individual',
  role: 'user'
};

async function createTestUser() {
  try {
    console.log('🔧 Creating test user for API testing...');
    console.log(`📧 Email: ${testUser.email}`);
    console.log(`👤 Name: ${testUser.name}`);

    const response = await axios.post(`${BASE_URL}/api/register`, testUser);

    if (response.status === 201) {
      console.log('✅ Test user created successfully!');
      console.log(`User ID: ${response.data.user.id}`);
      console.log(`Email: ${response.data.user.email}`);
      console.log('🔐 Password: password123');

      // Test immediate login
      console.log('\n🔐 Testing login...');
      const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
        email: testUser.email,
        password: testUser.password
      });

      if (loginResponse.status === 200) {
        console.log('✅ Login test successful!');
        console.log(`Token: ${loginResponse.data.token.substring(0, 20)}...`);
      } else {
        console.log('❌ Login test failed');
      }

    } else {
      console.log(`❌ Failed to create test user. Status: ${response.status}`);
    }

  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('ℹ️  Test user already exists, that\'s fine!');

      // Test login with existing user
      console.log('🔐 Testing login with existing user...');
      try {
        const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
          email: testUser.email,
          password: testUser.password
        });

        if (loginResponse.status === 200) {
          console.log('✅ Login test with existing user successful!');
        } else {
          console.log('❌ Login test with existing user failed');
        }
      } catch (loginError) {
        console.log(`❌ Login failed: ${loginError.response?.data?.message || loginError.message}`);
      }
    } else {
      console.log(`❌ Error creating test user: ${error.response?.data?.message || error.message}`);
    }
  }
}

if (require.main === module) {
  createTestUser()
    .then(() => {
      console.log('\n✅ Test user setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.log(`\n❌ Test user setup failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { createTestUser, testUser };