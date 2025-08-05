const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tax_advisor',
  password: 'password',
  port: 5432,
});

async function fixTaxSlabs() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Checking tax_slabs table structure...');
    
    // Check if fixed_amount column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tax_slabs' AND column_name = 'fixed_amount'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('Adding fixed_amount column to tax_slabs table...');
      await client.query(`
        ALTER TABLE tax_slabs 
        ADD COLUMN fixed_amount DECIMAL(15,2) DEFAULT 0
      `);
      console.log('✅ fixed_amount column added');
    } else {
      console.log('✅ fixed_amount column already exists');
    }
    
    // Update existing tax slabs to have proper fixed amounts
    // Pakistani tax slabs for 2025-26 typically have these fixed amounts
    const taxSlabUpdates = [
      { min: 0, max: 600000, rate: 0, fixed: 0 },
      { min: 600000, max: 1200000, rate: 5, fixed: 0 },
      { min: 1200000, max: 2200000, rate: 12.5, fixed: 30000 },
      { min: 2200000, max: 3200000, rate: 20, fixed: 155000 },
      { min: 3200000, max: 4100000, rate: 25, fixed: 355000 },
      { min: 4100000, max: null, rate: 35, fixed: 580000 }
    ];
    
    console.log('Updating tax slab rates and fixed amounts...');
    
    for (const slab of taxSlabUpdates) {
      const whereClause = slab.max 
        ? 'min_income = $1 AND max_income = $2'
        : 'min_income = $1 AND max_income IS NULL';
      
      const params = slab.max ? [slab.min, slab.max] : [slab.min];
      
      await client.query(`
        UPDATE tax_slabs 
        SET tax_rate = $${params.length + 1}, fixed_amount = $${params.length + 2}
        WHERE ${whereClause}
      `, [...params, slab.rate, slab.fixed]);
      
      console.log(`Updated slab: ${slab.min.toLocaleString()} - ${slab.max ? slab.max.toLocaleString() : 'Above'} (${slab.rate}% + ${slab.fixed.toLocaleString()})`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Tax slabs structure and data updated successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing tax slabs:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTaxSlabs();