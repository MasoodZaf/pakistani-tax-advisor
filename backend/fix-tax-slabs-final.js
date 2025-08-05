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
    
    console.log('Fixing tax slabs for 2025-26...');
    
    // Get tax year ID
    const taxYearResult = await client.query(`
      SELECT id FROM tax_years WHERE tax_year = '2025-26'
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('Tax year 2025-26 not found');
    }
    
    const taxYearId = taxYearResult.rows[0].id;
    
    // Clear existing slabs for 2025-26
    await client.query(`
      DELETE FROM tax_slabs WHERE tax_year_id = $1
    `, [taxYearId]);
    
    console.log('Cleared existing tax slabs');
    
    // Insert new tax slabs with proper Pakistani FBR rates for 2025-26
    const newTaxSlabs = [
      {
        slab_name: 'Slab 1',
        slab_order: 1,
        min_income: 0,
        max_income: 600000,
        tax_rate: 0,
        fixed_amount: 0
      },
      {
        slab_name: 'Slab 2',
        slab_order: 2,
        min_income: 600000,
        max_income: 1200000,
        tax_rate: 5,
        fixed_amount: 0
      },
      {
        slab_name: 'Slab 3',
        slab_order: 3,
        min_income: 1200000,
        max_income: 2200000,
        tax_rate: 12.5,
        fixed_amount: 30000
      },
      {
        slab_name: 'Slab 4',
        slab_order: 4,
        min_income: 2200000,
        max_income: 3200000,
        tax_rate: 20,
        fixed_amount: 155000
      },
      {
        slab_name: 'Slab 5',
        slab_order: 5,
        min_income: 3200000,
        max_income: 4100000,
        tax_rate: 25,
        fixed_amount: 355000
      },
      {
        slab_name: 'Slab 6',
        slab_order: 6,
        min_income: 4100000,
        max_income: null,
        tax_rate: 35,
        fixed_amount: 580000
      }
    ];
    
    console.log('Inserting new tax slabs...');
    
    for (const slab of newTaxSlabs) {
      await client.query(`
        INSERT INTO tax_slabs (
          id, tax_year_id, slab_name, slab_order, min_income, 
          max_income, tax_rate, fixed_amount, slab_type, 
          applicable_to, effective_from, effective_to, created_at, updated_at
        )
        VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, 
          'individual', '{"individual": true, "business": true}', 
          '2025-07-01', '2026-06-30', NOW(), NOW()
        )
      `, [
        taxYearId,
        slab.slab_name,
        slab.slab_order,
        slab.min_income,
        slab.max_income,
        slab.tax_rate,
        slab.fixed_amount
      ]);
      
      const maxDisplay = slab.max_income ? slab.max_income.toLocaleString() : 'Above';
      console.log(`✅ ${slab.slab_name}: Rs. ${slab.min_income.toLocaleString()} - ${maxDisplay} | Rate: ${slab.tax_rate}% | Fixed: Rs. ${slab.fixed_amount.toLocaleString()}`);
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 Tax slabs for 2025-26 updated successfully!');
    console.log('Pakistani FBR tax rates are now properly configured.');
    
    // Verify the slabs
    const verifyResult = await pool.query(`
      SELECT slab_name, min_income, max_income, tax_rate, fixed_amount
      FROM tax_slabs 
      WHERE tax_year_id = $1 
      ORDER BY slab_order
    `, [taxYearId]);
    
    console.log('\nVerification - Tax Slabs:');
    verifyResult.rows.forEach(slab => {
      const maxDisplay = slab.max_income ? `Rs. ${parseInt(slab.max_income).toLocaleString()}` : 'Above';
      console.log(`${slab.slab_name}: Rs. ${parseInt(slab.min_income).toLocaleString()} - ${maxDisplay} | ${slab.tax_rate}% + Rs. ${parseInt(slab.fixed_amount).toLocaleString()}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing tax slabs:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixTaxSlabs();