const { pool } = require('./src/config/database');

async function calculateAndInsertTaxComputation() {
  const userId = '6bf47a47-5341-4884-9960-bb660dfdd9df';
  const taxYear = '2025-26';

  try {
    console.log('Fetching all form data for KhurramJ...\n');

    // Get tax year ID
    const taxYearResult = await pool.query(
      'SELECT id FROM tax_years WHERE tax_year = $1',
      [taxYear]
    );
    const taxYearId = taxYearResult.rows[0].id;

    // Get tax return ID
    const taxReturnResult = await pool.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const taxReturnId = taxReturnResult.rows[0].id;

    // 1. Fetch Income Form data
    const incomeResult = await pool.query(
      'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const incomeData = incomeResult.rows[0] || {};

    // 2. Fetch Adjustable Tax data
    const adjustableResult = await pool.query(
      'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const adjustableData = adjustableResult.rows[0] || {};

    // 3. Fetch Capital Gains data
    const capitalResult = await pool.query(
      'SELECT * FROM capital_gain_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const capitalData = capitalResult.rows[0] || {};

    // 4. Fetch Reductions data
    const reductionsResult = await pool.query(
      'SELECT * FROM reductions_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const reductionsData = reductionsResult.rows[0] || {};

    // 5. Fetch Credits data
    const creditsResult = await pool.query(
      'SELECT * FROM credits_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const creditsData = creditsResult.rows[0] || {};

    // 6. Fetch Deductions data
    const deductionsResult = await pool.query(
      'SELECT * FROM deductions_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const deductionsData = deductionsResult.rows[0] || {};

    // 7. Fetch Final Min Income data
    const finalMinResult = await pool.query(
      'SELECT * FROM final_min_income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );
    const finalMinData = finalMinResult.rows[0] || {};

    console.log('Calculating Tax Computation values...\n');

    // ==== INCOME CALCULATIONS (as per Excel sheet) ====

    // Income from Salary (=Income!B16+Income!B23)
    // Using total_employment_income which includes all salary and employment income
    const incomeFromSalary = parseFloat(incomeData.total_employment_income || 0);

    // Other Income subject to minimum tax (=Income!B28)
    // Using other_income_min_tax_total from income_forms (dividends, interest, etc.)
    const otherIncomeMinTax = parseFloat(incomeData.other_income_min_tax_total || 0);

    // Income from Other Sources (=Income!B33)
    // Using other_income_no_min_tax_total from income_forms (income subject to normal tax)
    const incomeOtherSources = parseFloat(incomeData.other_income_no_min_tax_total || 0);

    // Total Income = Sum(B6:B8)
    const totalIncome = incomeFromSalary + otherIncomeMinTax + incomeOtherSources;

    // Deductible Allowances (='Tax Reduction, Credit & deduct '!C22)
    // C22 = Total Deduction from Income (Zakat)
    const deductibleAllowances = parseFloat(deductionsData.total_deduction_from_income || 0);

    // Taxable Income (excluding CG) = Total Income - Deductible Allowances
    const taxableIncome = totalIncome - deductibleAllowances;

    // Capital Gains/Loss (='Capital Gain'!E19)
    // E19 = Total Capital Gain
    const capitalGains = parseFloat(capitalData.total_capital_gains || 0);

    // ==== TAX CALCULATIONS ====

    // Normal Income Tax - Using exact Excel formula
    // Tax slabs (as per FBR):
    // 0 - 600,000: 0%
    // 600,001 - 1,200,000: (income - 600,000) * 5%
    // 1,200,001 - 2,200,000: (income - 1,200,000) * 15% + 30,000
    // 2,200,001 - 3,200,000: (income - 2,200,000) * 25% + 180,000
    // 3,200,001 - 4,100,000: (income - 3,200,000) * 30% + 430,000
    // Above 4,100,000: (income - 4,100,000) * 35% + 700,000

    let normalIncomeTax = 0;

    if (taxableIncome > 0) {
      if (taxableIncome > 600000 && taxableIncome <= 1200000) {
        normalIncomeTax = (taxableIncome - 600000) * 0.05;
      } else if (taxableIncome > 1200000 && taxableIncome <= 2200000) {
        normalIncomeTax = (taxableIncome - 1200000) * 0.15 + 30000;
      } else if (taxableIncome > 2200000 && taxableIncome <= 3200000) {
        normalIncomeTax = (taxableIncome - 2200000) * 0.25 + 180000;
      } else if (taxableIncome > 3200000 && taxableIncome <= 4100000) {
        normalIncomeTax = (taxableIncome - 3200000) * 0.30 + 430000;
      } else if (taxableIncome > 4100000) {
        normalIncomeTax = (taxableIncome - 4100000) * 0.35 + 700000;
      }
    }

    // Surcharge (10% if income > 10,000,000)
    const surcharge = taxableIncome > 10000000 ? normalIncomeTax * 0.10 : 0;

    // Capital Gains Tax (='Capital Gain'!G19)
    const capitalGainsTax = parseFloat(capitalData.total_capital_gains_tax || 0);

    // Normal Tax including Surcharge + CGT
    const normalTaxWithSurchargeCGT = normalIncomeTax + surcharge + capitalGainsTax;

    // ==== TAX REDUCTIONS & CREDITS ====

    // Tax Reductions (='Tax Reduction, Credit & deduct '!C17)
    const taxReductions = parseFloat(reductionsData.total_reductions || 0);

    // Tax Credits (='Tax Reduction, Credit & deduct '!C19)
    const taxCredits = parseFloat(creditsData.total_credits || 0);

    // Net Tax Payable = Normal Tax + Surcharge + CGT - Reductions - Credits
    const netTaxPayable = normalTaxWithSurchargeCGT - taxReductions - taxCredits;

    // ==== FINAL/MINIMUM TAX ====

    // Final/Fixed/Minimum Tax = Sum of all tax deducted from final_min_income_forms
    const finalFixedTax = (
      parseFloat(finalMinData.dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted || 0) +
      parseFloat(finalMinData.dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted || 0) +
      parseFloat(finalMinData.dividend_u_s_150_7_5pc_ipp_shares_tax_deducted || 0) +
      parseFloat(finalMinData.dividend_u_s_150_31pc_atl_tax_deducted || 0) +
      parseFloat(finalMinData.return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted || 0) +
      parseFloat(finalMinData.profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted || 0) +
      parseFloat(finalMinData.profit_debt_national_savings_defence_39_14a_tax_deducted || 0) +
      parseFloat(finalMinData.interest_income_profit_debt_7b_up_to_5m_tax_deducted || 0) +
      parseFloat(finalMinData.employment_termination_benefits_12_6_avg_rate_tax_deducted || 0) +
      parseFloat(finalMinData.salary_arrears_12_7_relevant_rate_tax_deducted || 0) +
      parseFloat(finalMinData.capital_gain_tax_deducted || 0)
    );

    // Total Tax Chargeable = Net Tax Payable + Final Tax
    const totalTaxLiability = netTaxPayable + finalFixedTax;

    // ==== TAX PAYMENTS ====

    // Calculate total tax deducted from all final_min_income sources
    const finalMinTaxDeducted = (
      parseFloat(finalMinData.dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted || 0) +
      parseFloat(finalMinData.dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted || 0) +
      parseFloat(finalMinData.dividend_u_s_150_7_5pc_ipp_shares_tax_deducted || 0) +
      parseFloat(finalMinData.dividend_u_s_150_31pc_atl_tax_deducted || 0) +
      parseFloat(finalMinData.return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted || 0) +
      parseFloat(finalMinData.return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted || 0) +
      parseFloat(finalMinData.profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted || 0) +
      parseFloat(finalMinData.profit_debt_national_savings_defence_39_14a_tax_deducted || 0) +
      parseFloat(finalMinData.interest_income_profit_debt_7b_up_to_5m_tax_deducted || 0)
    );

    // Withholding Income Tax = Adjustable Tax collected (salary tax withholding)
    const withholdingIncomeTax = parseFloat(adjustableData.total_adjustable_tax || 0);

    // Total Taxes Paid = Withholding + Final Min Tax
    const totalTaxesPaid = withholdingIncomeTax + finalMinTaxDeducted;

    // Balance Payable/(Refundable) = Total Tax Chargeable - Total Taxes Paid
    const balancePayable = totalTaxLiability - totalTaxesPaid;

    console.log('=== TAX COMPUTATION RESULTS ===\n');
    console.log(`Income from Salary: ${incomeFromSalary.toLocaleString()}`);
    console.log(`Other Income subject to min tax: ${otherIncomeMinTax.toLocaleString()}`);
    console.log(`Income from Other Sources: ${incomeOtherSources.toLocaleString()}`);
    console.log(`Total Income: ${totalIncome.toLocaleString()}`);
    console.log(`Deductible Allowances: ${deductibleAllowances.toLocaleString()}`);
    console.log(`Taxable Income (excl CG): ${taxableIncome.toLocaleString()}`);
    console.log(`Capital Gains/Loss: ${capitalGains.toLocaleString()}`);
    console.log('');
    console.log(`Normal Income Tax: ${normalIncomeTax.toLocaleString()}`);
    console.log(`Surcharge: ${surcharge.toLocaleString()}`);
    console.log(`Capital Gains Tax: ${capitalGainsTax.toLocaleString()}`);
    console.log(`Normal Tax + Surcharge + CGT: ${normalTaxWithSurchargeCGT.toLocaleString()}`);
    console.log('');
    console.log(`Tax Reductions: ${taxReductions.toLocaleString()}`);
    console.log(`Tax Credits: ${taxCredits.toLocaleString()}`);
    console.log(`Net Tax Payable: ${netTaxPayable.toLocaleString()}`);
    console.log('');
    console.log(`Final/Fixed/Minimum Tax: ${finalFixedTax.toLocaleString()}`);
    console.log(`Total Tax Chargeable: ${totalTaxLiability.toLocaleString()}`);
    console.log('');
    console.log(`Withholding Income Tax: ${withholdingIncomeTax.toLocaleString()}`);
    console.log(`Total Taxes Paid: ${totalTaxesPaid.toLocaleString()}`);
    console.log(`Tax Demanded/(Refundable): ${balancePayable.toLocaleString()}`);
    console.log('\n');

    // ==== INSERT/UPDATE TAX COMPUTATION TABLE ====

    console.log('Inserting into tax_computation_forms...\n');

    // Check if record exists
    const existingResult = await pool.query(
      'SELECT id FROM tax_computation_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (existingResult.rows.length > 0) {
      // Update existing
      const updateResult = await pool.query(`
        UPDATE tax_computation_forms SET
          income_from_salary = $1,
          other_income_subject_to_min_tax = $2,
          income_loss_other_sources = $3,
          deductible_allowances = $4,
          capital_gains_loss = $5,
          normal_income_tax = $6,
          surcharge_amount = $7,
          capital_gains_tax = $8,
          tax_reductions = $9,
          tax_credits = $10,
          final_fixed_tax = $11,
          advance_tax_paid = $12,
          updated_at = NOW()
        WHERE user_id = $13 AND tax_year = $14
        RETURNING *
      `, [
        incomeFromSalary,
        otherIncomeMinTax,
        incomeOtherSources,
        deductibleAllowances,
        capitalGains,
        normalIncomeTax,
        surcharge,
        capitalGainsTax,
        taxReductions,
        taxCredits,
        finalFixedTax,
        totalTaxesPaid,
        userId,
        taxYear
      ]);

      console.log('✓ Tax computation updated successfully!');
      console.log('\nGenerated columns (auto-calculated by database):');
      const result = updateResult.rows[0];
      console.log(`Total Income: ${parseFloat(result.total_income).toLocaleString()}`);
      console.log(`Taxable Income (excl CG): ${parseFloat(result.taxable_income_excluding_cg).toLocaleString()}`);
      console.log(`Taxable Income (incl CG): ${parseFloat(result.taxable_income_including_cg).toLocaleString()}`);
      console.log(`Normal Tax + Surcharge + CGT: ${parseFloat(result.normal_tax_including_surcharge_cgt).toLocaleString()}`);
      console.log(`Net Tax Payable: ${parseFloat(result.net_tax_payable).toLocaleString()}`);
      console.log(`Total Tax Liability: ${parseFloat(result.total_tax_liability).toLocaleString()}`);
      console.log(`Balance Payable: ${parseFloat(result.balance_payable).toLocaleString()}`);

    } else {
      // Insert new
      const insertResult = await pool.query(`
        INSERT INTO tax_computation_forms (
          tax_return_id, user_id, user_email, tax_year_id, tax_year,
          income_from_salary, other_income_subject_to_min_tax, income_loss_other_sources,
          deductible_allowances, capital_gains_loss,
          normal_income_tax, surcharge_amount, capital_gains_tax,
          tax_reductions, tax_credits,
          final_fixed_tax, advance_tax_paid,
          is_complete, last_updated_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, true, $2
        ) RETURNING *
      `, [
        taxReturnId, userId, 'khurramj@taxadvisor.pk', taxYearId, taxYear,
        incomeFromSalary, otherIncomeMinTax, incomeOtherSources,
        deductibleAllowances, capitalGains,
        normalIncomeTax, surcharge, capitalGainsTax,
        taxReductions, taxCredits,
        finalFixedTax, totalTaxesPaid
      ]);

      console.log('✓ Tax computation inserted successfully!');
      console.log('\nGenerated columns (auto-calculated by database):');
      const result = insertResult.rows[0];
      console.log(`Total Income: ${parseFloat(result.total_income).toLocaleString()}`);
      console.log(`Taxable Income (excl CG): ${parseFloat(result.taxable_income_excluding_cg).toLocaleString()}`);
      console.log(`Taxable Income (incl CG): ${parseFloat(result.taxable_income_including_cg).toLocaleString()}`);
      console.log(`Normal Tax + Surcharge + CGT: ${parseFloat(result.normal_tax_including_surcharge_cgt).toLocaleString()}`);
      console.log(`Net Tax Payable: ${parseFloat(result.net_tax_payable).toLocaleString()}`);
      console.log(`Total Tax Liability: ${parseFloat(result.total_tax_liability).toLocaleString()}`);
      console.log(`Balance Payable: ${parseFloat(result.balance_payable).toLocaleString()}`);
    }

    console.log('\n✓ Tax computation completed successfully!');

  } catch (error) {
    console.error('Error calculating tax computation:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the calculation
calculateAndInsertTaxComputation();
