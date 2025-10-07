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

async function populateIncomeTaxModule() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get KhurramJ's user info
    const userResult = await client.query(
      "SELECT id, email FROM users WHERE email = 'khurramj@taxadvisor.pk'"
    );

    if (userResult.rows.length === 0) {
      throw new Error('KhurramJ user not found');
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    console.log('✓ Found user:', userEmail);

    // Get tax year ID
    const taxYearResult = await client.query(
      "SELECT id FROM tax_years WHERE tax_year = '2025-26'"
    );
    const taxYearId = taxYearResult.rows[0].id;
    console.log('✓ Tax year 2025-26 ID:', taxYearId);

    // Get or create tax return
    let taxReturnResult = await client.query(
      `SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year_id = $2`,
      [userId, taxYearId]
    );

    let taxReturnId;
    if (taxReturnResult.rows.length === 0) {
      const insertReturn = await client.query(
        `INSERT INTO tax_returns (user_id, user_email, tax_year_id, filing_status, return_number)
         VALUES ($1, $2, $3, 'draft', $4) RETURNING id`,
        [userId, userEmail, taxYearId, `TR-${userId.substring(0, 8)}-2025-26`]
      );
      taxReturnId = insertReturn.rows[0].id;
      console.log('✓ Created new tax return:', taxReturnId);
    } else {
      taxReturnId = taxReturnResult.rows[0].id;
      console.log('✓ Using existing tax return:', taxReturnId);
    }

    // ===== 1. INCOME FORM =====
    console.log('\n=== POPULATING INCOME FORM ===');
    const incomeSheet = workbook.Sheets['Income'];

    const incomeData = {
      annual_basic_salary: parseNum(getCellValue(incomeSheet, 5, 1)), // Row 6, Col B
      allowances: parseNum(getCellValue(incomeSheet, 6, 1)),
      bonus: parseNum(getCellValue(incomeSheet, 7, 1)),
      medical_allowance: parseNum(getCellValue(incomeSheet, 8, 1)),
      pension_from_ex_employer: parseNum(getCellValue(incomeSheet, 9, 1)),
      employment_termination_payment: parseNum(getCellValue(incomeSheet, 10, 1)),
      retirement_from_approved_funds: parseNum(getCellValue(incomeSheet, 11, 1)),
      directorship_fee: parseNum(getCellValue(incomeSheet, 12, 1)),
      other_cash_benefits: parseNum(getCellValue(incomeSheet, 13, 1)),
      employer_contribution_provident: parseNum(getCellValue(incomeSheet, 18, 1)),
      taxable_car_value: parseNum(getCellValue(incomeSheet, 19, 1)),
      other_taxable_subsidies: parseNum(getCellValue(incomeSheet, 20, 1))
    };

    console.log('Income data extracted:', JSON.stringify(incomeData, null, 2));

    // Delete existing income form
    await client.query(
      `DELETE FROM income_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert new income data
    const incomeInsert = await client.query(`
      INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        annual_basic_salary, allowances, bonus, medical_allowance,
        pension_from_ex_employer, employment_termination_payment,
        retirement_from_approved_funds, directorship_fee,
        other_cash_benefits, employer_contribution_provident,
        taxable_car_value, other_taxable_subsidies
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id, annual_salary_wages_total, total_employment_income
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      incomeData.annual_basic_salary, incomeData.allowances,
      incomeData.bonus, incomeData.medical_allowance,
      incomeData.pension_from_ex_employer, incomeData.employment_termination_payment,
      incomeData.retirement_from_approved_funds, incomeData.directorship_fee,
      incomeData.other_cash_benefits, incomeData.employer_contribution_provident,
      incomeData.taxable_car_value, incomeData.other_taxable_subsidies
    ]);

    console.log('✓ Income form populated');
    console.log('  Annual Salary/Wages Total:', incomeInsert.rows[0].annual_salary_wages_total);
    console.log('  Total Employment Income:', incomeInsert.rows[0].total_employment_income);

    // ===== 2. ADJUSTABLE TAX FORM =====
    console.log('\n=== POPULATING ADJUSTABLE TAX FORM ===');
    const adjustableSheet = workbook.Sheets['Adjustable Tax'];

    // Column B = Gross Receipt, Column C = Tax Collected
    const adjustableData = {
      salary_employees_149_gross_receipt: parseNum(getCellValue(adjustableSheet, 4, 1)), // Row 5, Col B
      salary_employees_149_tax_collected: parseNum(getCellValue(adjustableSheet, 4, 2)), // Row 5, Col C
      directorship_fee_149_3_gross_receipt: parseNum(getCellValue(adjustableSheet, 5, 1)),
      directorship_fee_149_3_tax_collected: parseNum(getCellValue(adjustableSheet, 5, 2)),
      profit_debt_151_15_gross_receipt: parseNum(getCellValue(adjustableSheet, 6, 1)),
      profit_debt_151_15_tax_collected: parseNum(getCellValue(adjustableSheet, 6, 2)),
      profit_debt_sukook_151a_gross_receipt: parseNum(getCellValue(adjustableSheet, 7, 1)),
      profit_debt_sukook_151a_tax_collected: parseNum(getCellValue(adjustableSheet, 7, 2)),
      profit_debt_non_resident_152_2_gross_receipt: parseNum(getCellValue(adjustableSheet, 8, 1)),
      profit_debt_non_resident_152_2_tax_collected: parseNum(getCellValue(adjustableSheet, 8, 2)),
      advance_tax_cash_withdrawal_231ab_gross_receipt: parseNum(getCellValue(adjustableSheet, 9, 1)),
      advance_tax_cash_withdrawal_231ab_tax_collected: parseNum(getCellValue(adjustableSheet, 9, 2)),
      motor_vehicle_registration_fee_231b1_gross_receipt: parseNum(getCellValue(adjustableSheet, 10, 1)),
      motor_vehicle_registration_fee_231b1_tax_collected: parseNum(getCellValue(adjustableSheet, 10, 2)),
      motor_vehicle_transfer_fee_231b2_gross_receipt: parseNum(getCellValue(adjustableSheet, 11, 1)),
      motor_vehicle_transfer_fee_231b2_tax_collected: parseNum(getCellValue(adjustableSheet, 11, 2)),
      motor_vehicle_sale_231b3_gross_receipt: parseNum(getCellValue(adjustableSheet, 12, 1)),
      motor_vehicle_sale_231b3_tax_collected: parseNum(getCellValue(adjustableSheet, 12, 2)),
      motor_vehicle_leasing_231b1a_gross_receipt: parseNum(getCellValue(adjustableSheet, 13, 1)),
      motor_vehicle_leasing_231b1a_tax_collected: parseNum(getCellValue(adjustableSheet, 13, 2)),
      electricity_bill_domestic_235_gross_receipt: parseNum(getCellValue(adjustableSheet, 14, 1)),
      electricity_bill_domestic_235_tax_collected: parseNum(getCellValue(adjustableSheet, 14, 2)),
      telephone_bill_236_1e_gross_receipt: parseNum(getCellValue(adjustableSheet, 15, 1)),
      telephone_bill_236_1e_tax_collected: parseNum(getCellValue(adjustableSheet, 15, 2)),
      cellphone_bill_236_1f_gross_receipt: parseNum(getCellValue(adjustableSheet, 16, 1)),
      cellphone_bill_236_1f_tax_collected: parseNum(getCellValue(adjustableSheet, 16, 2)),
      prepaid_telephone_card_236_1b_gross_receipt: parseNum(getCellValue(adjustableSheet, 17, 1)),
      prepaid_telephone_card_236_1b_tax_collected: parseNum(getCellValue(adjustableSheet, 17, 2)),
      phone_unit_236_1c_gross_receipt: parseNum(getCellValue(adjustableSheet, 18, 1)),
      phone_unit_236_1c_tax_collected: parseNum(getCellValue(adjustableSheet, 18, 2)),
      internet_bill_236_1d_gross_receipt: parseNum(getCellValue(adjustableSheet, 19, 1)),
      internet_bill_236_1d_tax_collected: parseNum(getCellValue(adjustableSheet, 19, 2)),
      prepaid_internet_card_236_1e_gross_receipt: parseNum(getCellValue(adjustableSheet, 20, 1)),
      prepaid_internet_card_236_1e_tax_collected: parseNum(getCellValue(adjustableSheet, 20, 2)),
      sale_transfer_immoveable_property_236c_gross_receipt: parseNum(getCellValue(adjustableSheet, 21, 1)),
      sale_transfer_immoveable_property_236c_tax_collected: parseNum(getCellValue(adjustableSheet, 21, 2)),
      tax_deducted_236c_property_purchased_prior_year_gross_receipt: parseNum(getCellValue(adjustableSheet, 23, 1)),
      tax_deducted_236c_property_purchased_prior_year_tax_collected: parseNum(getCellValue(adjustableSheet, 23, 2)),
      functions_gatherings_charges_236cb_gross_receipt: parseNum(getCellValue(adjustableSheet, 24, 1)),
      functions_gatherings_charges_236cb_tax_collected: parseNum(getCellValue(adjustableSheet, 24, 2)),
      withholding_tax_sale_considerations_37e_gross_receipt: parseNum(getCellValue(adjustableSheet, 25, 1)),
      withholding_tax_sale_considerations_37e_tax_collected: parseNum(getCellValue(adjustableSheet, 25, 2)),
      purchase_transfer_immoveable_property_236k_gross_receipt: parseNum(getCellValue(adjustableSheet, 26, 1)),
      purchase_transfer_immoveable_property_236k_tax_collected: parseNum(getCellValue(adjustableSheet, 26, 2)),
      advance_fund_23a_part_i_second_schedule_gross_receipt: parseNum(getCellValue(adjustableSheet, 27, 1)),
      advance_fund_23a_part_i_second_schedule_tax_collected: parseNum(getCellValue(adjustableSheet, 27, 2)),
      advance_tax_motor_vehicle_231b2a_gross_receipt: parseNum(getCellValue(adjustableSheet, 28, 1)),
      advance_tax_motor_vehicle_231b2a_tax_collected: parseNum(getCellValue(adjustableSheet, 28, 2)),
      persons_remitting_amount_abroad_236v_gross_receipt: parseNum(getCellValue(adjustableSheet, 29, 1)),
      persons_remitting_amount_abroad_236v_tax_collected: parseNum(getCellValue(adjustableSheet, 29, 2)),
      advance_tax_foreign_domestic_workers_231c_gross_receipt: parseNum(getCellValue(adjustableSheet, 30, 1)),
      advance_tax_foreign_domestic_workers_231c_tax_collected: parseNum(getCellValue(adjustableSheet, 30, 2))
    };

    console.log('Adjustable tax data extracted (sample):', {
      salary_employees_149_gross_receipt: adjustableData.salary_employees_149_gross_receipt,
      salary_employees_149_tax_collected: adjustableData.salary_employees_149_tax_collected,
      directorship_fee_149_3_gross_receipt: adjustableData.directorship_fee_149_3_gross_receipt,
      directorship_fee_149_3_tax_collected: adjustableData.directorship_fee_149_3_tax_collected
    });

    // Delete existing adjustable tax form
    await client.query(
      `DELETE FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert adjustable tax data
    await client.query(`
      INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        salary_employees_149_gross_receipt, salary_employees_149_tax_collected,
        directorship_fee_149_3_gross_receipt, directorship_fee_149_3_tax_collected,
        profit_debt_151_15_gross_receipt, profit_debt_151_15_tax_collected,
        profit_debt_sukook_151a_gross_receipt, profit_debt_sukook_151a_tax_collected,
        profit_debt_non_resident_152_2_gross_receipt, profit_debt_non_resident_152_2_tax_collected,
        advance_tax_cash_withdrawal_231ab_gross_receipt, advance_tax_cash_withdrawal_231ab_tax_collected,
        motor_vehicle_registration_fee_231b1_gross_receipt, motor_vehicle_registration_fee_231b1_tax_collected,
        motor_vehicle_transfer_fee_231b2_gross_receipt, motor_vehicle_transfer_fee_231b2_tax_collected,
        motor_vehicle_sale_231b3_gross_receipt, motor_vehicle_sale_231b3_tax_collected,
        motor_vehicle_leasing_231b1a_gross_receipt, motor_vehicle_leasing_231b1a_tax_collected,
        electricity_bill_domestic_235_gross_receipt, electricity_bill_domestic_235_tax_collected,
        telephone_bill_236_1e_gross_receipt, telephone_bill_236_1e_tax_collected,
        cellphone_bill_236_1f_gross_receipt, cellphone_bill_236_1f_tax_collected,
        prepaid_telephone_card_236_1b_gross_receipt, prepaid_telephone_card_236_1b_tax_collected,
        phone_unit_236_1c_gross_receipt, phone_unit_236_1c_tax_collected,
        internet_bill_236_1d_gross_receipt, internet_bill_236_1d_tax_collected,
        prepaid_internet_card_236_1e_gross_receipt, prepaid_internet_card_236_1e_tax_collected,
        sale_transfer_immoveable_property_236c_gross_receipt, sale_transfer_immoveable_property_236c_tax_collected,
        tax_deducted_236c_property_purchased_prior_year_gross_receipt, tax_deducted_236c_property_purchased_prior_year_tax_collected,
        functions_gatherings_charges_236cb_gross_receipt, functions_gatherings_charges_236cb_tax_collected,
        withholding_tax_sale_considerations_37e_gross_receipt, withholding_tax_sale_considerations_37e_tax_collected,
        purchase_transfer_immoveable_property_236k_gross_receipt, purchase_transfer_immoveable_property_236k_tax_collected,
        advance_fund_23a_part_i_second_schedule_gross_receipt, advance_fund_23a_part_i_second_schedule_tax_collected,
        advance_tax_motor_vehicle_231b2a_gross_receipt, advance_tax_motor_vehicle_231b2a_tax_collected,
        persons_remitting_amount_abroad_236v_gross_receipt, persons_remitting_amount_abroad_236v_tax_collected,
        advance_tax_foreign_domestic_workers_231c_gross_receipt, advance_tax_foreign_domestic_workers_231c_tax_collected
      ) VALUES (
        $1, $2, $3, $4, '2025-26',
        $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
        $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52,
        $53, $54, $55, $56, $57, $58
      )
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      adjustableData.salary_employees_149_gross_receipt, adjustableData.salary_employees_149_tax_collected,
      adjustableData.directorship_fee_149_3_gross_receipt, adjustableData.directorship_fee_149_3_tax_collected,
      adjustableData.profit_debt_151_15_gross_receipt, adjustableData.profit_debt_151_15_tax_collected,
      adjustableData.profit_debt_sukook_151a_gross_receipt, adjustableData.profit_debt_sukook_151a_tax_collected,
      adjustableData.profit_debt_non_resident_152_2_gross_receipt, adjustableData.profit_debt_non_resident_152_2_tax_collected,
      adjustableData.advance_tax_cash_withdrawal_231ab_gross_receipt, adjustableData.advance_tax_cash_withdrawal_231ab_tax_collected,
      adjustableData.motor_vehicle_registration_fee_231b1_gross_receipt, adjustableData.motor_vehicle_registration_fee_231b1_tax_collected,
      adjustableData.motor_vehicle_transfer_fee_231b2_gross_receipt, adjustableData.motor_vehicle_transfer_fee_231b2_tax_collected,
      adjustableData.motor_vehicle_sale_231b3_gross_receipt, adjustableData.motor_vehicle_sale_231b3_tax_collected,
      adjustableData.motor_vehicle_leasing_231b1a_gross_receipt, adjustableData.motor_vehicle_leasing_231b1a_tax_collected,
      adjustableData.electricity_bill_domestic_235_gross_receipt, adjustableData.electricity_bill_domestic_235_tax_collected,
      adjustableData.telephone_bill_236_1e_gross_receipt, adjustableData.telephone_bill_236_1e_tax_collected,
      adjustableData.cellphone_bill_236_1f_gross_receipt, adjustableData.cellphone_bill_236_1f_tax_collected,
      adjustableData.prepaid_telephone_card_236_1b_gross_receipt, adjustableData.prepaid_telephone_card_236_1b_tax_collected,
      adjustableData.phone_unit_236_1c_gross_receipt, adjustableData.phone_unit_236_1c_tax_collected,
      adjustableData.internet_bill_236_1d_gross_receipt, adjustableData.internet_bill_236_1d_tax_collected,
      adjustableData.prepaid_internet_card_236_1e_gross_receipt, adjustableData.prepaid_internet_card_236_1e_tax_collected,
      adjustableData.sale_transfer_immoveable_property_236c_gross_receipt, adjustableData.sale_transfer_immoveable_property_236c_tax_collected,
      adjustableData.tax_deducted_236c_property_purchased_prior_year_gross_receipt, adjustableData.tax_deducted_236c_property_purchased_prior_year_tax_collected,
      adjustableData.functions_gatherings_charges_236cb_gross_receipt, adjustableData.functions_gatherings_charges_236cb_tax_collected,
      adjustableData.withholding_tax_sale_considerations_37e_gross_receipt, adjustableData.withholding_tax_sale_considerations_37e_tax_collected,
      adjustableData.purchase_transfer_immoveable_property_236k_gross_receipt, adjustableData.purchase_transfer_immoveable_property_236k_tax_collected,
      adjustableData.advance_fund_23a_part_i_second_schedule_gross_receipt, adjustableData.advance_fund_23a_part_i_second_schedule_tax_collected,
      adjustableData.advance_tax_motor_vehicle_231b2a_gross_receipt, adjustableData.advance_tax_motor_vehicle_231b2a_tax_collected,
      adjustableData.persons_remitting_amount_abroad_236v_gross_receipt, adjustableData.persons_remitting_amount_abroad_236v_tax_collected,
      adjustableData.advance_tax_foreign_domestic_workers_231c_gross_receipt, adjustableData.advance_tax_foreign_domestic_workers_231c_tax_collected
    ]);

    console.log('✓ Adjustable tax form populated');

    // ===== 3. CAPITAL GAIN FORM =====
    console.log('\n=== POPULATING CAPITAL GAIN FORM ===');
    const capitalSheet = workbook.Sheets['Capital Gain'];

    const capitalData = {
      immovable_property_1_year_taxable: parseNum(getCellValue(capitalSheet, 3, 8)) // Row 4, Col I
    };

    console.log('Capital gain data extracted:', capitalData);

    // Delete existing capital gain form
    await client.query(
      `DELETE FROM capital_gain_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert capital gain data
    await client.query(`
      INSERT INTO capital_gain_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        immovable_property_1_year_taxable
      ) VALUES (
        $1, $2, $3, $4, '2025-26', $5
      )
    `, [
      taxReturnId, userId, userEmail, taxYearId,
      capitalData.immovable_property_1_year_taxable
    ]);

    console.log('✓ Capital gain form populated');

    // ===== 4. FINAL MIN INCOME FORM =====
    console.log('\n=== POPULATING FINAL MIN INCOME FORM ===');
    const finalMinSheet = workbook.Sheets['Income with Final Min tax'];

    const finalMinData = {
      dividend_reit_spv_0: parseNum(getCellValue(finalMinSheet, 2, 4)), // Row 3, Col E
      dividend_other_spv_35: parseNum(getCellValue(finalMinSheet, 3, 4)),
      dividend_ipp_7_5: parseNum(getCellValue(finalMinSheet, 4, 4)),
      dividend_kind_mutual_15: parseNum(getCellValue(finalMinSheet, 5, 4)),
      sukuks_151_1a_25: parseNum(getCellValue(finalMinSheet, 7, 4)),
      sukuks_151_1a_12_5_1m_5m: parseNum(getCellValue(finalMinSheet, 8, 4)),
      sukuks_151_1a_10_upto_1m: parseNum(getCellValue(finalMinSheet, 9, 4)),
      debt_fcva_scra_10: parseNum(getCellValue(finalMinSheet, 10, 4)),
      nsc_defence_savings_39_4a: parseNum(getCellValue(finalMinSheet, 11, 6)), // Col G
      profit_debt_7b_15_upto_5m: parseNum(getCellValue(finalMinSheet, 12, 4)), // Col E
      prize_bond_156: parseNum(getCellValue(finalMinSheet, 13, 4)),
      prize_raffle_lottery_156: parseNum(getCellValue(finalMinSheet, 14, 4)),
      salary_arrears_12_7: parseNum(getCellValue(finalMinSheet, 16, 6)) // Col G
    };

    console.log('Final min income data extracted (sample):', {
      dividend_reit_spv_0: finalMinData.dividend_reit_spv_0,
      dividend_other_spv_35: finalMinData.dividend_other_spv_35,
      profit_debt_7b_15_upto_5m: finalMinData.profit_debt_7b_15_upto_5m
    });

    // Delete existing final min income form
    await client.query(
      `DELETE FROM final_min_income_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert final min income data
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

    // ===== 5. REDUCTIONS FORM (Zakat) =====
    console.log('\n=== POPULATING REDUCTIONS FORM ===');
    const reductionSheet = workbook.Sheets['Tax Reduction, Credit & deduct '];

    // Check if Zakat was paid (Y/N in Row 21, Col G)
    const zakatPaid = getCellValue(reductionSheet, 20, 6);
    const zakatPaidBool = zakatPaid && zakatPaid.toString().toUpperCase() === 'Y';

    console.log('Zakat paid:', zakatPaidBool);

    // Delete existing reductions form
    await client.query(
      `DELETE FROM reductions_forms WHERE user_id = $1 AND tax_year = '2025-26'`,
      [userId]
    );

    // Insert reductions data (we'll add zakat_paid field if it exists)
    await client.query(`
      INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year
      ) VALUES (
        $1, $2, $3, $4, '2025-26'
      )
    `, [
      taxReturnId, userId, userEmail, taxYearId
    ]);

    console.log('✓ Reductions form populated');

    // ===== VERIFICATION =====
    console.log('\n=== VERIFICATION ===');

    const verifyIncome = await client.query(`
      SELECT
        annual_basic_salary,
        allowances,
        bonus,
        annual_salary_wages_total,
        total_employment_income
      FROM income_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('\n📊 Income Form:');
    console.log('  Basic Salary:', verifyIncome.rows[0].annual_basic_salary);
    console.log('  Allowances:', verifyIncome.rows[0].allowances);
    console.log('  Bonus:', verifyIncome.rows[0].bonus);
    console.log('  ✓ Annual Salary/Wages Total:', verifyIncome.rows[0].annual_salary_wages_total);
    console.log('  ✓ Total Employment Income:', verifyIncome.rows[0].total_employment_income);

    const verifyAdjustable = await client.query(`
      SELECT COUNT(*) as count FROM adjustable_tax_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('\n📊 Adjustable Tax Form:', verifyAdjustable.rows[0].count, 'record(s)');

    const verifyCapital = await client.query(`
      SELECT COUNT(*) as count FROM capital_gain_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('📊 Capital Gain Form:', verifyCapital.rows[0].count, 'record(s)');

    const verifyFinalMin = await client.query(`
      SELECT COUNT(*) as count FROM final_min_income_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('📊 Final Min Income Form:', verifyFinalMin.rows[0].count, 'record(s)');

    const verifyReductions = await client.query(`
      SELECT COUNT(*) as count FROM reductions_forms
      WHERE user_id = $1 AND tax_year = '2025-26'
    `, [userId]);

    console.log('📊 Reductions Form:', verifyReductions.rows[0].count, 'record(s)');

    await client.query('COMMIT');

    console.log('\n✅ ALL INCOME TAX MODULE DATA POPULATED SUCCESSFULLY FOR KHURRAMJ');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

populateIncomeTaxModule().catch(console.error);
