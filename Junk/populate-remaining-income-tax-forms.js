const XLSX = require('xlsx');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tax_advisor',
  user: 'postgres',
  password: 'password'
});

const workbook = XLSX.readFile('Salaried Individuals 2025.xlsx');

function parseNum(val) {
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function getCellValue(sheet, row, col) {
  const cell = sheet[XLSX.utils.encode_cell({r: row, c: col})];
  return cell?.v || 0;
}

async function populateRemainingForms() {
  const client = await pool.connect();
  try {
    const userResult = await client.query("SELECT id, email FROM users WHERE email = 'khurramj@taxadvisor.pk'");
    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;

    const taxYearResult = await client.query("SELECT id FROM tax_years WHERE tax_year = '2025-26'");
    const taxYearId = taxYearResult.rows[0].id;

    const taxReturnResult = await client.query('SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year_id = $2', [userId, taxYearId]);
    const taxReturnId = taxReturnResult.rows[0].id;

    console.log('✓ User, Tax Year, and Tax Return IDs obtained');

    // ===== CAPITAL GAIN FORM =====
    console.log('\n=== POPULATING CAPITAL GAIN FORM ===');
    const capitalSheet = workbook.Sheets['Capital Gain'];
    const capitalData = {
      immovable_property_1_year_taxable: parseNum(getCellValue(capitalSheet, 3, 8)) // Row 4, Col I
    };

    console.log('Capital gain data:', capitalData);

    await client.query("DELETE FROM capital_gain_forms WHERE user_id = $1 AND tax_year = '2025-26'", [userId]);

    await client.query(`
      INSERT INTO capital_gain_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        immovable_property_1_year_taxable
      ) VALUES (
        $1, $2, $3, $4, '2025-26', $5
      )
    `, [taxReturnId, userId, userEmail, taxYearId, capitalData.immovable_property_1_year_taxable]);

    console.log('✓ Capital gain form populated');

    // ===== FINAL MIN INCOME FORM =====
    console.log('\n=== POPULATING FINAL MIN INCOME FORM ===');
    const finalMinSheet = workbook.Sheets['Income with Final Min tax'];

    const finalMinData = {
      dividend_reit_spv_0: parseNum(getCellValue(finalMinSheet, 2, 4)),
      dividend_other_spv_35: parseNum(getCellValue(finalMinSheet, 3, 4)),
      dividend_ipp_7_5: parseNum(getCellValue(finalMinSheet, 4, 4)),
      dividend_kind_mutual_15: parseNum(getCellValue(finalMinSheet, 5, 4)),
      sukuks_151_1a_25: parseNum(getCellValue(finalMinSheet, 7, 4)),
      sukuks_151_1a_12_5_1m_5m: parseNum(getCellValue(finalMinSheet, 8, 4)),
      sukuks_151_1a_10_upto_1m: parseNum(getCellValue(finalMinSheet, 9, 4)),
      debt_fcva_scra_10: parseNum(getCellValue(finalMinSheet, 10, 4)),
      nsc_defence_savings_39_4a: parseNum(getCellValue(finalMinSheet, 11, 6)),
      profit_debt_7b_15_upto_5m: parseNum(getCellValue(finalMinSheet, 12, 4)),
      prize_bond_156: parseNum(getCellValue(finalMinSheet, 13, 4)),
      prize_raffle_lottery_156: parseNum(getCellValue(finalMinSheet, 14, 4)),
      salary_arrears_12_7: parseNum(getCellValue(finalMinSheet, 16, 6))
    };

    console.log('Final min income data (sample):', {
      dividend_reit_spv_0: finalMinData.dividend_reit_spv_0,
      dividend_other_spv_35: finalMinData.dividend_other_spv_35,
      profit_debt_7b_15_upto_5m: finalMinData.profit_debt_7b_15_upto_5m
    });

    await client.query("DELETE FROM final_min_income_forms WHERE user_id = $1 AND tax_year = '2025-26'", [userId]);

    await client.query(`
      INSERT INTO final_min_income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        dividend_reit_spv_0, dividend_other_spv_35, dividend_ipp_7_5,
        dividend_kind_mutual_15, sukuks_151_1a_25, sukuks_151_1a_12_5_1m_5m,
        sukuks_151_1a_10_upto_1m, debt_fcva_scra_10, nsc_defence_savings_39_4a,
        profit_debt_7b_15_upto_5m, prize_bond_156, prize_raffle_lottery_156,
        salary_arrears_12_7
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      finalMinData.dividend_reit_spv_0, finalMinData.dividend_other_spv_35,
      finalMinData.dividend_ipp_7_5, finalMinData.dividend_kind_mutual_15,
      finalMinData.sukuks_151_1a_25, finalMinData.sukuks_151_1a_12_5_1m_5m,
      finalMinData.sukuks_151_1a_10_upto_1m, finalMinData.debt_fcva_scra_10,
      finalMinData.nsc_defence_savings_39_4a, finalMinData.profit_debt_7b_15_upto_5m,
      finalMinData.prize_bond_156, finalMinData.prize_raffle_lottery_156,
      finalMinData.salary_arrears_12_7
    ]);

    console.log('✓ Final min income form populated');

    // ===== REDUCTIONS FORM =====
    console.log('\n=== POPULATING REDUCTIONS FORM ===');
    const reductionSheet = workbook.Sheets['Tax Reduction, Credit & deduct '];
    const zakatPaid = getCellValue(reductionSheet, 20, 6);
    const zakatPaidBool = zakatPaid && zakatPaid.toString().toUpperCase() === 'Y';

    console.log('Zakat paid:', zakatPaidBool);

    await client.query("DELETE FROM reductions_forms WHERE user_id = $1 AND tax_year = '2025-26'", [userId]);

    await client.query(`
      INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year
      ) VALUES (
        $1, $2, $3, $4, '2025-26'
      )
    `, [taxReturnId, userId, userEmail, taxYearId]);

    console.log('✓ Reductions form populated');

    console.log('\n✅ ALL INCOME TAX MODULE FORMS POPULATED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

populateRemainingForms();
