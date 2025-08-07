const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Middleware to verify session token authentication (same as main taxForms)
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    const sessionToken = authHeader.substring(7);
    
    const sessionResult = await pool.query(`
      SELECT us.user_id, us.user_email, u.id, u.email, u.name, u.user_type, u.role, u.is_active 
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid session',
        message: 'Session expired or invalid'
      });
    }
    
    const sessionData = sessionResult.rows[0];
    req.user = {
      id: sessionData.id,
      email: sessionData.email,
      name: sessionData.name,
      user_type: sessionData.user_type,
      role: sessionData.role,
      is_active: sessionData.is_active
    };
    req.userId = sessionData.user_id;
    req.userEmail = sessionData.user_email;
    next();
    
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: error.message
    });
  }
};

// Get adjustable tax form data
router.get('/:taxYear', requireAuth, async (req, res) => {
  try {
    const { userId, userEmail } = req;
    const { taxYear } = req.params;
    
    logger.info(`Getting adjustable tax form for user ${userEmail}, tax year ${taxYear}`);
    
    const result = await pool.query(`
      SELECT atf.*, ty.id as tax_year_id, tr.id as tax_return_id
      FROM adjustable_tax_forms atf
      JOIN tax_years ty ON atf.tax_year = ty.tax_year
      JOIN tax_returns tr ON atf.tax_return_id = tr.id
      WHERE atf.user_id = $1 AND atf.user_email = $2 AND atf.tax_year = $3
    `, [userId, userEmail, taxYear]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Adjustable tax form not found',
        message: `No adjustable tax form found for tax year ${taxYear}`
      });
    }
    
    const formData = result.rows[0];
    
    // Structure the data to match the Excel layout
    const structuredData = {
      formId: formData.id,
      taxReturnId: formData.tax_return_id,
      taxYearId: formData.tax_year_id,
      taxYear: formData.tax_year,
      isComplete: formData.is_complete,
      
      // Employment and Salary
      salaryEmployees149: {
        grossReceipt: parseFloat(formData.salary_employees_149_gross_receipt || 0),
        taxCollected: parseFloat(formData.salary_employees_149_tax_collected || 0)
      },
      directorshipFee149_3: {
        grossReceipt: parseFloat(formData.directorship_fee_149_3_gross_receipt || 0),
        taxCollected: parseFloat(formData.directorship_fee_149_3_tax_collected || 0)
      },
      
      // Profit on Debt
      profitDebt151_15: {
        grossReceipt: parseFloat(formData.profit_debt_151_15_gross_receipt || 0),
        taxCollected: parseFloat(formData.profit_debt_151_15_tax_collected || 0)
      },
      profitDebtNonResident152_2: {
        grossReceipt: parseFloat(formData.profit_debt_non_resident_152_2_gross_receipt || 0),
        taxCollected: parseFloat(formData.profit_debt_non_resident_152_2_tax_collected || 0)
      },
      
      // Banking
      advanceTaxCashWithdrawal231AB: {
        grossReceipt: parseFloat(formData.advance_tax_cash_withdrawal_231ab_gross_receipt || 0),
        taxCollected: parseFloat(formData.advance_tax_cash_withdrawal_231ab_tax_collected || 0)
      },
      
      // Motor Vehicle Related
      motorVehicleRegistrationFee231B1: {
        grossReceipt: parseFloat(formData.motor_vehicle_registration_fee_231b1_gross_receipt || 0),
        taxCollected: parseFloat(formData.motor_vehicle_registration_fee_231b1_tax_collected || 0)
      },
      motorVehicleTransferFee231B2: {
        grossReceipt: parseFloat(formData.motor_vehicle_transfer_fee_231b2_gross_receipt || 0),
        taxCollected: parseFloat(formData.motor_vehicle_transfer_fee_231b2_tax_collected || 0)
      },
      motorVehicleSale231B3: {
        grossReceipt: parseFloat(formData.motor_vehicle_sale_231b3_gross_receipt || 0),
        taxCollected: parseFloat(formData.motor_vehicle_sale_231b3_tax_collected || 0)
      },
      motorVehicleLeasing231B1A: {
        grossReceipt: parseFloat(formData.motor_vehicle_leasing_231b1a_gross_receipt || 0),
        taxCollected: parseFloat(formData.motor_vehicle_leasing_231b1a_tax_collected || 0)
      },
      advanceTaxMotorVehicle231B2A: {
        grossReceipt: parseFloat(formData.advance_tax_motor_vehicle_231b2a_gross_receipt || 0),
        taxCollected: parseFloat(formData.advance_tax_motor_vehicle_231b2a_tax_collected || 0)
      },
      
      // Utility Bills
      electricityBillDomestic235: {
        grossReceipt: parseFloat(formData.electricity_bill_domestic_235_gross_receipt || 0),
        taxCollected: parseFloat(formData.electricity_bill_domestic_235_tax_collected || 0)
      },
      telephoneBill236_1E: {
        grossReceipt: parseFloat(formData.telephone_bill_236_1e_gross_receipt || 0),
        taxCollected: parseFloat(formData.telephone_bill_236_1e_tax_collected || 0)
      },
      cellphoneBill236_1F: {
        grossReceipt: parseFloat(formData.cellphone_bill_236_1f_gross_receipt || 0),
        taxCollected: parseFloat(formData.cellphone_bill_236_1f_tax_collected || 0)
      },
      prepaidTelephoneCard236_1B: {
        grossReceipt: parseFloat(formData.prepaid_telephone_card_236_1b_gross_receipt || 0),
        taxCollected: parseFloat(formData.prepaid_telephone_card_236_1b_tax_collected || 0)
      },
      phoneUnit236_1C: {
        grossReceipt: parseFloat(formData.phone_unit_236_1c_gross_receipt || 0),
        taxCollected: parseFloat(formData.phone_unit_236_1c_tax_collected || 0)
      },
      internetBill236_1D: {
        grossReceipt: parseFloat(formData.internet_bill_236_1d_gross_receipt || 0),
        taxCollected: parseFloat(formData.internet_bill_236_1d_tax_collected || 0)
      },
      prepaidInternetCard236_1E: {
        grossReceipt: parseFloat(formData.prepaid_internet_card_236_1e_gross_receipt || 0),
        taxCollected: parseFloat(formData.prepaid_internet_card_236_1e_tax_collected || 0)
      },
      
      // Property Related
      saleTransferImmoveableProperty236C: {
        grossReceipt: parseFloat(formData.sale_transfer_immoveable_property_236c_gross_receipt || 0),
        taxCollected: parseFloat(formData.sale_transfer_immoveable_property_236c_tax_collected || 0)
      },
      taxDeducted236CPropertyPurchasedSoldSameYear: {
        grossReceipt: parseFloat(formData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt || 0),
        taxCollected: parseFloat(formData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected || 0)
      },
      taxDeducted236CPropertyPurchasedPriorYear: {
        grossReceipt: parseFloat(formData.tax_deducted_236c_property_purchased_prior_year_gross_receipt || 0),
        taxCollected: parseFloat(formData.tax_deducted_236c_property_purchased_prior_year_tax_collected || 0)
      },
      purchaseTransferImmoveableProperty236K: {
        grossReceipt: parseFloat(formData.purchase_transfer_immoveable_property_236k_gross_receipt || 0),
        taxCollected: parseFloat(formData.purchase_transfer_immoveable_property_236k_tax_collected || 0)
      },
      
      // Events and Services
      functionsGatheringsCharges236CB: {
        grossReceipt: parseFloat(formData.functions_gatherings_charges_236cb_gross_receipt || 0),
        taxCollected: parseFloat(formData.functions_gatherings_charges_236cb_tax_collected || 0)
      },
      withholdingTaxSaleConsiderations37E: {
        grossReceipt: parseFloat(formData.withholding_tax_sale_considerations_37e_gross_receipt || 0),
        taxCollected: parseFloat(formData.withholding_tax_sale_considerations_37e_tax_collected || 0)
      },
      
      // Financial and International
      advanceFund23APartISecondSchedule: {
        grossReceipt: parseFloat(formData.advance_fund_23a_part_i_second_schedule_gross_receipt || 0),
        taxCollected: parseFloat(formData.advance_fund_23a_part_i_second_schedule_tax_collected || 0)
      },
      advanceTaxWithdrawalPensionFund23A: {
        grossReceipt: parseFloat(formData.advance_tax_withdrawal_pension_fund_23a_gross_receipt || 0),
        taxCollected: parseFloat(formData.advance_tax_withdrawal_pension_fund_23a_tax_collected || 0)
      },
      personsRemittingAmountAbroad236V: {
        grossReceipt: parseFloat(formData.persons_remitting_amount_abroad_236v_gross_receipt || 0),
        taxCollected: parseFloat(formData.persons_remitting_amount_abroad_236v_tax_collected || 0)
      },
      advanceTaxForeignDomesticWorkers231C: {
        grossReceipt: parseFloat(formData.advance_tax_foreign_domestic_workers_231c_gross_receipt || 0),
        taxCollected: parseFloat(formData.advance_tax_foreign_domestic_workers_231c_tax_collected || 0)
      },
      
      // Totals
      totals: {
        totalGrossReceipt: parseFloat(formData.total_gross_receipt || 0),
        totalAdjustableTax: parseFloat(formData.total_adjustable_tax || 0)
      },
      
      lastUpdatedBy: formData.last_updated_by,
      createdAt: formData.created_at,
      updatedAt: formData.updated_at
    };
    
    res.json({
      success: true,
      data: structuredData,
      message: 'Adjustable tax form retrieved successfully'
    });
    
  } catch (error) {
    logger.error('Error getting adjustable tax form:', error);
    res.status(500).json({ 
      error: 'Database error',
      message: 'Failed to retrieve adjustable tax form data'
    });
  }
});

// Save/Update adjustable tax form data
router.post('/:taxYear', requireAuth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { userId, userEmail } = req;
    const { taxYear } = req.params;
    const formData = req.body;
    
    logger.info(`Saving adjustable tax form for user ${userEmail}, tax year ${taxYear}`);
    
    // Get tax year and tax return IDs
    const taxYearResult = await client.query(
      'SELECT id FROM tax_years WHERE tax_year = $1',
      [taxYear]
    );
    
    if (taxYearResult.rows.length === 0) {
      throw new Error(`Tax year ${taxYear} not found`);
    }
    
    const taxYearId = taxYearResult.rows[0].id;
    
    const taxReturnResult = await client.query(
      'SELECT id FROM tax_returns WHERE user_id = $1 AND user_email = $2 AND tax_year = $3',
      [userId, userEmail, taxYear]
    );
    
    if (taxReturnResult.rows.length === 0) {
      throw new Error(`Tax return not found for user ${userEmail} and tax year ${taxYear}`);
    }
    
    const taxReturnId = taxReturnResult.rows[0].id;
    
    // Prepare the update/insert query
    const upsertQuery = `
      INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        salary_employees_149_gross_receipt, salary_employees_149_tax_collected,
        directorship_fee_149_3_gross_receipt, directorship_fee_149_3_tax_collected,
        profit_debt_151_15_gross_receipt, profit_debt_151_15_tax_collected,
        profit_debt_non_resident_152_2_gross_receipt, profit_debt_non_resident_152_2_tax_collected,
        advance_tax_cash_withdrawal_231ab_gross_receipt, advance_tax_cash_withdrawal_231ab_tax_collected,
        motor_vehicle_registration_fee_231b1_gross_receipt, motor_vehicle_registration_fee_231b1_tax_collected,
        motor_vehicle_transfer_fee_231b2_gross_receipt, motor_vehicle_transfer_fee_231b2_tax_collected,
        motor_vehicle_sale_231b3_gross_receipt, motor_vehicle_sale_231b3_tax_collected,
        motor_vehicle_leasing_231b1a_gross_receipt, motor_vehicle_leasing_231b1a_tax_collected,
        advance_tax_motor_vehicle_231b2a_gross_receipt, advance_tax_motor_vehicle_231b2a_tax_collected,
        electricity_bill_domestic_235_gross_receipt, electricity_bill_domestic_235_tax_collected,
        telephone_bill_236_1e_gross_receipt, telephone_bill_236_1e_tax_collected,
        cellphone_bill_236_1f_gross_receipt, cellphone_bill_236_1f_tax_collected,
        prepaid_telephone_card_236_1b_gross_receipt, prepaid_telephone_card_236_1b_tax_collected,
        phone_unit_236_1c_gross_receipt, phone_unit_236_1c_tax_collected,
        internet_bill_236_1d_gross_receipt, internet_bill_236_1d_tax_collected,
        prepaid_internet_card_236_1e_gross_receipt, prepaid_internet_card_236_1e_tax_collected,
        sale_transfer_immoveable_property_236c_gross_receipt, sale_transfer_immoveable_property_236c_tax_collected,
        tax_deducted_236c_property_purchased_sold_same_year_gross_receipt, tax_deducted_236c_property_purchased_sold_same_year_tax_collected,
        tax_deducted_236c_property_purchased_prior_year_gross_receipt, tax_deducted_236c_property_purchased_prior_year_tax_collected,
        purchase_transfer_immoveable_property_236k_gross_receipt, purchase_transfer_immoveable_property_236k_tax_collected,
        functions_gatherings_charges_236cb_gross_receipt, functions_gatherings_charges_236cb_tax_collected,
        withholding_tax_sale_considerations_37e_gross_receipt, withholding_tax_sale_considerations_37e_tax_collected,
        advance_fund_23a_part_i_second_schedule_gross_receipt, advance_fund_23a_part_i_second_schedule_tax_collected,
        advance_tax_withdrawal_pension_fund_23a_gross_receipt, advance_tax_withdrawal_pension_fund_23a_tax_collected,
        persons_remitting_amount_abroad_236v_gross_receipt, persons_remitting_amount_abroad_236v_tax_collected,
        advance_tax_foreign_domestic_workers_231c_gross_receipt, advance_tax_foreign_domestic_workers_231c_tax_collected,
        is_complete, last_updated_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45,
        $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61
      )
      ON CONFLICT (user_id, tax_year_id) 
      DO UPDATE SET
        salary_employees_149_gross_receipt = EXCLUDED.salary_employees_149_gross_receipt,
        salary_employees_149_tax_collected = EXCLUDED.salary_employees_149_tax_collected,
        directorship_fee_149_3_gross_receipt = EXCLUDED.directorship_fee_149_3_gross_receipt,
        directorship_fee_149_3_tax_collected = EXCLUDED.directorship_fee_149_3_tax_collected,
        profit_debt_151_15_gross_receipt = EXCLUDED.profit_debt_151_15_gross_receipt,
        profit_debt_151_15_tax_collected = EXCLUDED.profit_debt_151_15_tax_collected,
        profit_debt_non_resident_152_2_gross_receipt = EXCLUDED.profit_debt_non_resident_152_2_gross_receipt,
        profit_debt_non_resident_152_2_tax_collected = EXCLUDED.profit_debt_non_resident_152_2_tax_collected,
        advance_tax_cash_withdrawal_231ab_gross_receipt = EXCLUDED.advance_tax_cash_withdrawal_231ab_gross_receipt,
        advance_tax_cash_withdrawal_231ab_tax_collected = EXCLUDED.advance_tax_cash_withdrawal_231ab_tax_collected,
        motor_vehicle_registration_fee_231b1_gross_receipt = EXCLUDED.motor_vehicle_registration_fee_231b1_gross_receipt,
        motor_vehicle_registration_fee_231b1_tax_collected = EXCLUDED.motor_vehicle_registration_fee_231b1_tax_collected,
        motor_vehicle_transfer_fee_231b2_gross_receipt = EXCLUDED.motor_vehicle_transfer_fee_231b2_gross_receipt,
        motor_vehicle_transfer_fee_231b2_tax_collected = EXCLUDED.motor_vehicle_transfer_fee_231b2_tax_collected,
        motor_vehicle_sale_231b3_gross_receipt = EXCLUDED.motor_vehicle_sale_231b3_gross_receipt,
        motor_vehicle_sale_231b3_tax_collected = EXCLUDED.motor_vehicle_sale_231b3_tax_collected,
        motor_vehicle_leasing_231b1a_gross_receipt = EXCLUDED.motor_vehicle_leasing_231b1a_gross_receipt,
        motor_vehicle_leasing_231b1a_tax_collected = EXCLUDED.motor_vehicle_leasing_231b1a_tax_collected,
        advance_tax_motor_vehicle_231b2a_gross_receipt = EXCLUDED.advance_tax_motor_vehicle_231b2a_gross_receipt,
        advance_tax_motor_vehicle_231b2a_tax_collected = EXCLUDED.advance_tax_motor_vehicle_231b2a_tax_collected,
        electricity_bill_domestic_235_gross_receipt = EXCLUDED.electricity_bill_domestic_235_gross_receipt,
        electricity_bill_domestic_235_tax_collected = EXCLUDED.electricity_bill_domestic_235_tax_collected,
        telephone_bill_236_1e_gross_receipt = EXCLUDED.telephone_bill_236_1e_gross_receipt,
        telephone_bill_236_1e_tax_collected = EXCLUDED.telephone_bill_236_1e_tax_collected,
        cellphone_bill_236_1f_gross_receipt = EXCLUDED.cellphone_bill_236_1f_gross_receipt,
        cellphone_bill_236_1f_tax_collected = EXCLUDED.cellphone_bill_236_1f_tax_collected,
        prepaid_telephone_card_236_1b_gross_receipt = EXCLUDED.prepaid_telephone_card_236_1b_gross_receipt,
        prepaid_telephone_card_236_1b_tax_collected = EXCLUDED.prepaid_telephone_card_236_1b_tax_collected,
        phone_unit_236_1c_gross_receipt = EXCLUDED.phone_unit_236_1c_gross_receipt,
        phone_unit_236_1c_tax_collected = EXCLUDED.phone_unit_236_1c_tax_collected,
        internet_bill_236_1d_gross_receipt = EXCLUDED.internet_bill_236_1d_gross_receipt,
        internet_bill_236_1d_tax_collected = EXCLUDED.internet_bill_236_1d_tax_collected,
        prepaid_internet_card_236_1e_gross_receipt = EXCLUDED.prepaid_internet_card_236_1e_gross_receipt,
        prepaid_internet_card_236_1e_tax_collected = EXCLUDED.prepaid_internet_card_236_1e_tax_collected,
        sale_transfer_immoveable_property_236c_gross_receipt = EXCLUDED.sale_transfer_immoveable_property_236c_gross_receipt,
        sale_transfer_immoveable_property_236c_tax_collected = EXCLUDED.sale_transfer_immoveable_property_236c_tax_collected,
        tax_deducted_236c_property_purchased_sold_same_year_gross_receipt = EXCLUDED.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt,
        tax_deducted_236c_property_purchased_sold_same_year_tax_collected = EXCLUDED.tax_deducted_236c_property_purchased_sold_same_year_tax_collected,
        tax_deducted_236c_property_purchased_prior_year_gross_receipt = EXCLUDED.tax_deducted_236c_property_purchased_prior_year_gross_receipt,
        tax_deducted_236c_property_purchased_prior_year_tax_collected = EXCLUDED.tax_deducted_236c_property_purchased_prior_year_tax_collected,
        purchase_transfer_immoveable_property_236k_gross_receipt = EXCLUDED.purchase_transfer_immoveable_property_236k_gross_receipt,
        purchase_transfer_immoveable_property_236k_tax_collected = EXCLUDED.purchase_transfer_immoveable_property_236k_tax_collected,
        functions_gatherings_charges_236cb_gross_receipt = EXCLUDED.functions_gatherings_charges_236cb_gross_receipt,
        functions_gatherings_charges_236cb_tax_collected = EXCLUDED.functions_gatherings_charges_236cb_tax_collected,
        withholding_tax_sale_considerations_37e_gross_receipt = EXCLUDED.withholding_tax_sale_considerations_37e_gross_receipt,
        withholding_tax_sale_considerations_37e_tax_collected = EXCLUDED.withholding_tax_sale_considerations_37e_tax_collected,
        advance_fund_23a_part_i_second_schedule_gross_receipt = EXCLUDED.advance_fund_23a_part_i_second_schedule_gross_receipt,
        advance_fund_23a_part_i_second_schedule_tax_collected = EXCLUDED.advance_fund_23a_part_i_second_schedule_tax_collected,
        advance_tax_withdrawal_pension_fund_23a_gross_receipt = EXCLUDED.advance_tax_withdrawal_pension_fund_23a_gross_receipt,
        advance_tax_withdrawal_pension_fund_23a_tax_collected = EXCLUDED.advance_tax_withdrawal_pension_fund_23a_tax_collected,
        persons_remitting_amount_abroad_236v_gross_receipt = EXCLUDED.persons_remitting_amount_abroad_236v_gross_receipt,
        persons_remitting_amount_abroad_236v_tax_collected = EXCLUDED.persons_remitting_amount_abroad_236v_tax_collected,
        advance_tax_foreign_domestic_workers_231c_gross_receipt = EXCLUDED.advance_tax_foreign_domestic_workers_231c_gross_receipt,
        advance_tax_foreign_domestic_workers_231c_tax_collected = EXCLUDED.advance_tax_foreign_domestic_workers_231c_tax_collected,
        is_complete = EXCLUDED.is_complete,
        last_updated_by = EXCLUDED.last_updated_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`;
    
    // Execute the upsert with form data
    const values = [
      taxReturnId, userId, userEmail, taxYearId, taxYear,
      formData.salaryEmployees149?.grossReceipt || 0,
      formData.salaryEmployees149?.taxCollected || 0,
      formData.directorshipFee149_3?.grossReceipt || 0,
      formData.directorshipFee149_3?.taxCollected || 0,
      formData.profitDebt151_15?.grossReceipt || 0,
      formData.profitDebt151_15?.taxCollected || 0,
      formData.profitDebtNonResident152_2?.grossReceipt || 0,
      formData.profitDebtNonResident152_2?.taxCollected || 0,
      formData.advanceTaxCashWithdrawal231AB?.grossReceipt || 0,
      formData.advanceTaxCashWithdrawal231AB?.taxCollected || 0,
      formData.motorVehicleRegistrationFee231B1?.grossReceipt || 0,
      formData.motorVehicleRegistrationFee231B1?.taxCollected || 0,
      formData.motorVehicleTransferFee231B2?.grossReceipt || 0,
      formData.motorVehicleTransferFee231B2?.taxCollected || 0,
      formData.motorVehicleSale231B3?.grossReceipt || 0,
      formData.motorVehicleSale231B3?.taxCollected || 0,
      formData.motorVehicleLeasing231B1A?.grossReceipt || 0,
      formData.motorVehicleLeasing231B1A?.taxCollected || 0,
      formData.advanceTaxMotorVehicle231B2A?.grossReceipt || 0,
      formData.advanceTaxMotorVehicle231B2A?.taxCollected || 0,
      formData.electricityBillDomestic235?.grossReceipt || 0,
      formData.electricityBillDomestic235?.taxCollected || 0,
      formData.telephoneBill236_1E?.grossReceipt || 0,
      formData.telephoneBill236_1E?.taxCollected || 0,
      formData.cellphoneBill236_1F?.grossReceipt || 0,
      formData.cellphoneBill236_1F?.taxCollected || 0,
      formData.prepaidTelephoneCard236_1B?.grossReceipt || 0,
      formData.prepaidTelephoneCard236_1B?.taxCollected || 0,
      formData.phoneUnit236_1C?.grossReceipt || 0,
      formData.phoneUnit236_1C?.taxCollected || 0,
      formData.internetBill236_1D?.grossReceipt || 0,
      formData.internetBill236_1D?.taxCollected || 0,
      formData.prepaidInternetCard236_1E?.grossReceipt || 0,
      formData.prepaidInternetCard236_1E?.taxCollected || 0,
      formData.saleTransferImmoveableProperty236C?.grossReceipt || 0,
      formData.saleTransferImmoveableProperty236C?.taxCollected || 0,
      formData.taxDeducted236CPropertyPurchasedSoldSameYear?.grossReceipt || 0,
      formData.taxDeducted236CPropertyPurchasedSoldSameYear?.taxCollected || 0,
      formData.taxDeducted236CPropertyPurchasedPriorYear?.grossReceipt || 0,
      formData.taxDeducted236CPropertyPurchasedPriorYear?.taxCollected || 0,
      formData.purchaseTransferImmoveableProperty236K?.grossReceipt || 0,
      formData.purchaseTransferImmoveableProperty236K?.taxCollected || 0,
      formData.functionsGatheringsCharges236CB?.grossReceipt || 0,
      formData.functionsGatheringsCharges236CB?.taxCollected || 0,
      formData.withholdingTaxSaleConsiderations37E?.grossReceipt || 0,
      formData.withholdingTaxSaleConsiderations37E?.taxCollected || 0,
      formData.advanceFund23APartISecondSchedule?.grossReceipt || 0,
      formData.advanceFund23APartISecondSchedule?.taxCollected || 0,
      formData.advanceTaxWithdrawalPensionFund23A?.grossReceipt || 0,
      formData.advanceTaxWithdrawalPensionFund23A?.taxCollected || 0,
      formData.personsRemittingAmountAbroad236V?.grossReceipt || 0,
      formData.personsRemittingAmountAbroad236V?.taxCollected || 0,
      formData.advanceTaxForeignDomesticWorkers231C?.grossReceipt || 0,
      formData.advanceTaxForeignDomesticWorkers231C?.taxCollected || 0,
      formData.isComplete || false,
      userId
    ];
    
    const result = await client.query(upsertQuery, values);
    
    await client.query('COMMIT');
    
    logger.info(`Successfully saved adjustable tax form for user ${userEmail}, tax year ${taxYear}`);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Adjustable tax form saved successfully'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error saving adjustable tax form:', error);
    res.status(500).json({ 
      error: 'Database error',
      message: 'Failed to save adjustable tax form data'
    });
  } finally {
    client.release();
  }
});

module.exports = router;