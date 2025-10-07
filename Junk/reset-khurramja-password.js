const { pool } = require('./src/config/database');
const bcrypt = require('bcrypt');

async function resetKhurramjaPassword() {
  try {
    console.log('Resetting password for khurramja@taxadvisor.pk...');

    // Hash the new password
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = $2
       RETURNING id, email, name`,
      [hashedPassword, 'khurramja@taxadvisor.pk']
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found!');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Password updated successfully!');
    console.log('User ID:', user.id);
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('New Password: admin123');

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
resetKhurramjaPassword()
  .then(() => {
    console.log('\n✅ Password reset completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Password reset failed:', error);
    process.exit(1);
  });