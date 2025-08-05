const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function fixTable() {
  try {
    console.log('Checking form_completion_status table structure...');
    const result = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'form_completion_status\' ORDER BY ordinal_position');
    console.log('Current columns:', result.rows.map(r => r.column_name).join(', '));
    
    // Add missing columns if they don't exist
    const missingColumns = ['created_at', 'updated_at'];
    for (const col of missingColumns) {
      const exists = result.rows.some(r => r.column_name === col);
      if (!exists) {
        console.log(`Adding column: ${col}`);
        await pool.query(`ALTER TABLE form_completion_status ADD COLUMN ${col} TIMESTAMP DEFAULT NOW()`);
      }
    }
    
    console.log('✅ Table fixed successfully');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixTable();