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
    
    console.log('Checking current tax slabs...');
    
    // Get current tax slabs
    const currentSlabs = await client.query(`
      SELECT * FROM tax_slabs 
      WHERE tax_year_id = (SELECT id FROM tax_years WHERE tax_year = '2025-26')
      ORDER BY min_income ASC
    `);
    
    console.log('Current slabs:', currentSlabs.rows.length);
    
    // Clear existing slabs for 2025-26
    await client.query(`
      DELETE FROM tax_slabs 
      WHERE tax_year_id = (SELECT id FROM tax_years WHERE tax_year = '2025-26')
    `);
    
    console.log('Cleared existing tax slabs');
    
    // Get tax year ID
    const taxYearResult = await client.query(`
      SELECT id FROM tax_years WHERE tax_year = '2025-26'
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('Tax year 2025-26 not found');
    }
    
    const taxYearId = taxYearResult.rows[0].id;
    
    // Insert new tax slabs with proper Pakistani FBR rates for 2025-26
    const newTaxSlabs = [
      {
        min_income: 0,
        max_income: 600000,
        tax_rate: 0,
        fixed_amount: 0,
        description: 'Up to Rs. 600,000'
      },
      {
        min_income: 600000,
        max_income: 1200000,
        tax_rate: 5,
        fixed_amount: 0,
        description: 'Rs. 600,001 to Rs. 1,200,000'
      },
      {
        min_income: 1200000,
        max_income: 2200000,
        tax_rate: 12.5,
        fixed_amount: 30000,
        description: 'Rs. 1,200,001 to Rs. 2,200,000'
      },
      {
        min_income: 2200000,
        max_income: 3200000,
        tax_rate: 20,
        fixed_amount: 155000,
        description: 'Rs. 2,200,001 to Rs. 3,200,000'
      },
      {
        min_income: 3200000,
        max_income: 4100000,
        tax_rate: 25,
        fixed_amount: 355000,
        description: 'Rs. 3,200,001 to Rs. 4,100,000'
      },
      {
        min_income: 4100000,
        max_income: null,
        tax_rate: 35,
        fixed_amount: 580000,
        description: 'Above Rs. 4,100,000'
      }
    ];
    
    console.log('Inserting new tax slabs...');
    
    for (const slab of newTaxSlabs) {
      await client.query(`
        INSERT INTO tax_slabs (
          tax_year_id, min_income, max_income, tax_rate, 
          fixed_amount, description, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        taxYearId,
        slab.min_income,
        slab.max_income,
        slab.tax_rate,
        slab.fixed_amount,
        slab.description
      ]);
      
      console.log(`✅ Inserted: ${slab.description} - ${slab.tax_rate}% (Fixed: Rs. ${slab.fixed_amount.toLocaleString()})`);
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 Tax slabs for 2025-26 updated successfully!');
    console.log('Pakistani FBR tax rates are now properly configured.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing tax slabs:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTaxSlabs();