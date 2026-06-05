const { pool } = require('../../../config/database');
const logger = require('../../../utils/logger');
const TaxRateService = require('../../../services/taxRateService');
const CalculationService = require('../../../services/calculationService');
const ensureTaxReturn = require('../../../helpers/ensureTaxReturn');
const {
  getCurrentTaxYear,
} = require('../helpers/taxFormsShared');

const getAdjustableTax = async (req, res) => {
  try {
    const userId = req.user.id;
    const taxYear = req.query.taxYear || await getCurrentTaxYear();

    logger.info(`Fetching adjustable tax data for user ${userId}, tax year ${taxYear}`);

    // Get income form data for auto-linking
    let incomeFormData = null;
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (incomeResult.rows.length > 0) {
        incomeFormData = incomeResult.rows[0];
        logger.info('Income form data found for auto-linking:', {
          directorship_fee: incomeFormData.directorship_fee,
          profit_debt_15: incomeFormData.profit_on_debt_15_percent,
          profit_debt_12_5: incomeFormData.profit_on_debt_12_5_percent,
          rent_income: incomeFormData.other_taxable_income_rent,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch income form data for auto-linking:', error.message);
    }

    const result = await pool.query(
      'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (result.rows.length === 0) {
      // No existing data - return auto-linked values from income form WITH calculated tax
      if (incomeFormData) {
        const autoLinkedData = {
          // Salary u/s 149 = Annual Salary and Wages Total (as shown in withholding certificate)
          salary_employees_149_gross_receipt: incomeFormData.annual_salary_wages_total || 0,
          directorship_fee_149_3_gross_receipt: incomeFormData.directorship_fee || 0,
          profit_debt_151_15_gross_receipt: incomeFormData.profit_on_debt_15_percent || 0,
          profit_debt_sukook_151a_gross_receipt: incomeFormData.profit_on_debt_12_5_percent || 0,
          tax_deducted_rent_section_155_gross_receipt:
            incomeFormData.other_taxable_income_rent || 0,
        };

        // Calculate tax collected amounts using FBR rates
        const TaxRateService = require('../../../services/taxRateService');
        const taxRates = await TaxRateService.getWithholdingTaxRates(taxYear);
        const calculations = CalculationService.calculateAdjustableTaxFields(
          autoLinkedData,
          taxRates
        );

        // Add calculated tax values to auto-linked data
        autoLinkedData.salary_employees_149_tax_collected = 0; // Salary is not subject to withholding
        autoLinkedData.directorship_fee_149_3_tax_collected =
          calculations.directorship_fee_149_3_tax_collected || 0;
        autoLinkedData.profit_debt_151_15_tax_collected =
          calculations.profit_debt_15_percent_tax_collected || 0;
        autoLinkedData.profit_debt_sukook_151a_tax_collected =
          calculations.sukook_12_5_percent_tax_collected || 0;
        autoLinkedData.tax_deducted_rent_section_155_tax_collected =
          calculations.rent_section_155_tax_collected || 0;

        logger.info('Auto-linked data from income form with calculated tax:', autoLinkedData);

        return res.json({
          success: true,
          data: autoLinkedData,
          autoLinked: true,
          message:
            'No adjustable tax data found, returning auto-linked values from income form with calculated tax',
        });
      }

      return res.json({
        success: true,
        data: null,
        autoLinked: false,
        message: 'No adjustable tax data found',
      });
    }

    const adjustableTaxData = result.rows[0];

    // Auto-link values if they are 0 and income form has data AND calculate tax.
    // pg NUMERIC columns come back as strings ("0.00") — ALWAYS coerce with
    // parseFloat before equality checks, or `=== 0` is permanently false and
    // auto-link silently skips on every existing row.
    if (incomeFormData) {
      let needsRecalculation = false;
      const toNum = (v) => {
        const n = typeof v === 'number' ? v : parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      };

      // Always use the income-form value for salary — it's the canonical source.
      const incomeSalary = toNum(incomeFormData.annual_salary_wages_total);
      if (
        toNum(adjustableTaxData.salary_employees_149_gross_receipt) === 0 &&
        incomeSalary > 0
      ) {
        adjustableTaxData.salary_employees_149_gross_receipt = incomeSalary;
        logger.info('Auto-linked salary employees (annual salary wages total):', incomeSalary);
        needsRecalculation = true;
      }

      const incomeDirectorship = toNum(incomeFormData.directorship_fee);
      if (
        toNum(adjustableTaxData.directorship_fee_149_3_gross_receipt) === 0 &&
        incomeDirectorship > 0
      ) {
        adjustableTaxData.directorship_fee_149_3_gross_receipt = incomeDirectorship;
        logger.info('Auto-linked directorship fee:', incomeDirectorship);
        needsRecalculation = true;
      }

      const incomeProfit15 = toNum(incomeFormData.profit_on_debt_15_percent);
      if (
        toNum(adjustableTaxData.profit_debt_151_15_gross_receipt) === 0 &&
        incomeProfit15 > 0
      ) {
        adjustableTaxData.profit_debt_151_15_gross_receipt = incomeProfit15;
        logger.info('Auto-linked profit debt 15%:', incomeProfit15);
        needsRecalculation = true;
      }

      const incomeSukook = toNum(incomeFormData.profit_on_debt_12_5_percent);
      if (
        toNum(adjustableTaxData.profit_debt_sukook_151a_gross_receipt) === 0 &&
        incomeSukook > 0
      ) {
        adjustableTaxData.profit_debt_sukook_151a_gross_receipt = incomeSukook;
        logger.info('Auto-linked profit debt 12.5%:', incomeSukook);
        needsRecalculation = true;
      }

      const incomeRent = toNum(incomeFormData.other_taxable_income_rent);
      if (
        toNum(adjustableTaxData.tax_deducted_rent_section_155_gross_receipt) === 0 &&
        incomeRent > 0
      ) {
        adjustableTaxData.tax_deducted_rent_section_155_gross_receipt = incomeRent;
        logger.info('Auto-linked rent income:', incomeRent);
        needsRecalculation = true;
      }

      // Recalculate tax collected amounts if any gross receipt was auto-linked
      if (needsRecalculation) {
        const TaxRateService = require('../../../services/taxRateService');
        const taxRates = await TaxRateService.getWithholdingTaxRates(taxYear);
        const calculations = CalculationService.calculateAdjustableTaxFields(
          adjustableTaxData,
          taxRates
        );

        // Update tax collected fields with calculated values
        adjustableTaxData.directorship_fee_149_3_tax_collected =
          calculations.directorship_fee_149_3_tax_collected || 0;
        adjustableTaxData.profit_debt_151_15_tax_collected =
          calculations.profit_debt_15_percent_tax_collected || 0;
        adjustableTaxData.profit_debt_sukook_151a_tax_collected =
          calculations.sukook_12_5_percent_tax_collected || 0;
        adjustableTaxData.tax_deducted_rent_section_155_tax_collected =
          calculations.rent_section_155_tax_collected || 0;

        logger.info('Recalculated tax collected values:', {
          directorship_tax: adjustableTaxData.directorship_fee_149_3_tax_collected,
          profit_15_tax: adjustableTaxData.profit_debt_151_15_tax_collected,
          sukook_tax: adjustableTaxData.profit_debt_sukook_151a_tax_collected,
          rent_tax: adjustableTaxData.tax_deducted_rent_section_155_tax_collected,
        });
      }
    }

    res.json({
      success: true,
      data: adjustableTaxData,
      autoLinked: incomeFormData ? true : false,
      message: 'Adjustable tax data retrieved successfully',
    });
  } catch (error) {
    logger.error('Error fetching adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch adjustable tax data',
      error: error.message,
    });
  }
};

const saveAdjustableTax = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;
    const taxYear = req.body.taxYear || await getCurrentTaxYear();
    const isComplete = req.body.isComplete || false;
    const formData = req.body;

    logger.info(`Saving adjustable tax data for user ${userId}, tax year ${taxYear}`);

    // Get or create tax return (validated + typed via Prisma helper)
    let taxReturnId;
    try {
      taxReturnId = await ensureTaxReturn(userId, userEmail, taxYear);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    // Resolve tax_year_id for the data payload
    const taxYearRow = await pool.query('SELECT id FROM tax_years WHERE tax_year = $1', [taxYear]);
    const taxYearId = taxYearRow.rows[0].id;

    // Get FBR tax rates
    const taxRates = await TaxRateService.getWithholdingTaxRates(taxYear);
    logger.info('FBR tax rates loaded:', taxRates);

    // Get income form data for cross-form linking
    let incomeFormData = null;
    try {
      const incomeResult = await pool.query(
        'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );
      if (incomeResult.rows.length > 0) {
        incomeFormData = incomeResult.rows[0];
        logger.info('Income form data found for linking:', {
          directorship_fee: incomeFormData.directorship_fee,
          profit_debt_15: incomeFormData.profit_on_debt_15_percent,
        });
      }
    } catch (error) {
      logger.warn('Could not fetch income form data for linking:', error.message);
    }

    // Clean and validate input data - handle both old and new field formats
    const cleanedData = {};

    // Helper function to get numeric value
    const getNumericValue = (value) => {
      if (value === '' || value === null || value === undefined) return 0;
      if (typeof value === 'string') {
        const numericValue = parseFloat(value.replace(/,/g, ''));
        return isNaN(numericValue) ? 0 : numericValue;
      }
      if (typeof value === 'number') return value;
      return 0;
    };

    // Map salary tax collected (user input field)
    cleanedData.salary_employees_149_tax_collected =
      getNumericValue(formData.salary_employees_149_tax_collected) ||
      getNumericValue(formData.salaryEmployees149?.taxCollected) ||
      0;

    // Map both old complex format and new simple format
    cleanedData.directorship_fee_149_3_gross_receipt =
      getNumericValue(formData.directorship_fee_149_3_gross_receipt) ||
      getNumericValue(formData.directorshipFee149_3?.grossReceipt) ||
      0;

    cleanedData.profit_debt_15_percent_gross_receipt =
      getNumericValue(formData.profit_debt_15_percent_gross_receipt) ||
      getNumericValue(formData.profitDebt151_15?.grossReceipt) ||
      0;

    cleanedData.profit_debt_sukook_151a_gross_receipt =
      getNumericValue(formData.profit_debt_sukook_151a_gross_receipt) ||
      getNumericValue(formData.sukook_12_5_percent_gross_receipt) ||
      getNumericValue(formData.profitDebtSukook151A?.grossReceipt) ||
      0;

    cleanedData.tax_deducted_rent_section_155_gross_receipt =
      getNumericValue(formData.tax_deducted_rent_section_155_gross_receipt) ||
      getNumericValue(formData.rent_section_155_gross_receipt) ||
      getNumericValue(formData.taxDeductedRentSection155?.grossReceipt) ||
      0;

    // Frontend sends the long form name motor_vehicle_transfer_fee_231b2_*;
    // legacy short names kept as fallbacks so old Excel imports / nested
    // payloads still work.
    cleanedData.motor_vehicle_transfer_gross_receipt =
      getNumericValue(formData.motor_vehicle_transfer_fee_231b2_gross_receipt) ||
      getNumericValue(formData.motor_vehicle_transfer_gross_receipt) ||
      getNumericValue(formData.motorVehicleTransferFee231B2?.grossReceipt) ||
      0;

    // All Motor Vehicle fields
    cleanedData.motor_vehicle_registration_fee_231b1_gross_receipt =
      getNumericValue(formData.motor_vehicle_registration_fee_231b1_gross_receipt) ||
      getNumericValue(formData.motorVehicleRegistrationFee231B1?.grossReceipt) ||
      0;

    cleanedData.motor_vehicle_sale_231b3_gross_receipt =
      getNumericValue(formData.motor_vehicle_sale_231b3_gross_receipt) ||
      getNumericValue(formData.motorVehicleSale231B3?.grossReceipt) ||
      0;

    cleanedData.motor_vehicle_leasing_231b1a_gross_receipt =
      getNumericValue(formData.motor_vehicle_leasing_231b1a_gross_receipt) ||
      getNumericValue(formData.motorVehicleLeasing231B1A?.grossReceipt) ||
      0;

    cleanedData.advance_tax_motor_vehicle_231b2a_gross_receipt =
      getNumericValue(formData.advance_tax_motor_vehicle_231b2a_gross_receipt) ||
      getNumericValue(formData.advanceTaxMotorVehicle231B2A?.grossReceipt) ||
      0;

    // Motor Vehicle tax collected fields
    cleanedData.motor_vehicle_registration_fee_231b1_tax_collected =
      getNumericValue(formData.motor_vehicle_registration_fee_231b1_tax_collected) ||
      getNumericValue(formData.motorVehicleRegistrationFee231B1?.taxCollected) ||
      0;

    cleanedData.motor_vehicle_sale_231b3_tax_collected =
      getNumericValue(formData.motor_vehicle_sale_231b3_tax_collected) ||
      getNumericValue(formData.motorVehicleSale231B3?.taxCollected) ||
      0;

    cleanedData.motor_vehicle_leasing_231b1a_tax_collected =
      getNumericValue(formData.motor_vehicle_leasing_231b1a_tax_collected) ||
      getNumericValue(formData.motorVehicleLeasing231B1A?.taxCollected) ||
      0;

    cleanedData.advance_tax_motor_vehicle_231b2a_tax_collected =
      getNumericValue(formData.advance_tax_motor_vehicle_231b2a_tax_collected) ||
      getNumericValue(formData.advanceTaxMotorVehicle231B2A?.taxCollected) ||
      0;

    // Frontend field names include the `_235` / `_236_1f` section suffixes;
    // legacy short names kept as fallbacks.
    cleanedData.electricity_domestic_gross_receipt =
      getNumericValue(formData.electricity_bill_domestic_235_gross_receipt) ||
      getNumericValue(formData.electricity_domestic_gross_receipt) ||
      getNumericValue(formData.electricityBillDomestic235?.grossReceipt) ||
      0;

    cleanedData.cellphone_bill_gross_receipt =
      getNumericValue(formData.cellphone_bill_236_1f_gross_receipt) ||
      getNumericValue(formData.cellphone_bill_gross_receipt) ||
      getNumericValue(formData.cellphoneBill236_1F?.grossReceipt) ||
      0;

    cleanedData.electricity_domestic_tax_collected =
      getNumericValue(formData.electricity_bill_domestic_235_tax_collected) ||
      getNumericValue(formData.electricity_domestic_tax_collected) ||
      getNumericValue(formData.electricityBillDomestic235?.taxCollected) ||
      0;

    cleanedData.cellphone_bill_tax_collected =
      getNumericValue(formData.cellphone_bill_236_1f_tax_collected) ||
      getNumericValue(formData.cellphone_bill_tax_collected) ||
      getNumericValue(formData.cellphoneBill236_1F?.taxCollected) ||
      0;

    // Telecommunications fields
    cleanedData.telephone_bill_236_1e_gross_receipt =
      getNumericValue(formData.telephone_bill_236_1e_gross_receipt) ||
      getNumericValue(formData.telephoneBill236_1E?.grossReceipt) ||
      0;

    cleanedData.telephone_bill_236_1e_tax_collected =
      getNumericValue(formData.telephone_bill_236_1e_tax_collected) ||
      getNumericValue(formData.telephoneBill236_1E?.taxCollected) ||
      0;

    cleanedData.cellphone_bill_236_1f_gross_receipt =
      getNumericValue(formData.cellphone_bill_236_1f_gross_receipt) ||
      getNumericValue(formData.cellphoneBill236_1F?.grossReceipt) ||
      getNumericValue(formData.cellphone_bill_gross_receipt) ||
      0;

    cleanedData.cellphone_bill_236_1f_tax_collected =
      getNumericValue(formData.cellphone_bill_236_1f_tax_collected) ||
      getNumericValue(formData.cellphoneBill236_1F?.taxCollected) ||
      getNumericValue(formData.cellphone_bill_tax_collected) ||
      0;

    cleanedData.prepaid_telephone_card_236_1b_gross_receipt =
      getNumericValue(formData.prepaid_telephone_card_236_1b_gross_receipt) ||
      getNumericValue(formData.prepaidTelephoneCard236_1B?.grossReceipt) ||
      0;

    cleanedData.prepaid_telephone_card_236_1b_tax_collected =
      getNumericValue(formData.prepaid_telephone_card_236_1b_tax_collected) ||
      getNumericValue(formData.prepaidTelephoneCard236_1B?.taxCollected) ||
      0;

    cleanedData.phone_unit_236_1c_gross_receipt =
      getNumericValue(formData.phone_unit_236_1c_gross_receipt) ||
      getNumericValue(formData.phoneUnit236_1C?.grossReceipt) ||
      0;

    cleanedData.phone_unit_236_1c_tax_collected =
      getNumericValue(formData.phone_unit_236_1c_tax_collected) ||
      getNumericValue(formData.phoneUnit236_1C?.taxCollected) ||
      0;

    cleanedData.internet_bill_236_1d_gross_receipt =
      getNumericValue(formData.internet_bill_236_1d_gross_receipt) ||
      getNumericValue(formData.internetBill236_1D?.grossReceipt) ||
      0;

    cleanedData.internet_bill_236_1d_tax_collected =
      getNumericValue(formData.internet_bill_236_1d_tax_collected) ||
      getNumericValue(formData.internetBill236_1D?.taxCollected) ||
      0;

    cleanedData.prepaid_internet_card_236_1e_gross_receipt =
      getNumericValue(formData.prepaid_internet_card_236_1e_gross_receipt) ||
      getNumericValue(formData.prepaidInternetCard236_1E?.grossReceipt) ||
      0;

    cleanedData.prepaid_internet_card_236_1e_tax_collected =
      getNumericValue(formData.prepaid_internet_card_236_1e_tax_collected) ||
      getNumericValue(formData.prepaidInternetCard236_1E?.taxCollected) ||
      0;

    // Property fields
    cleanedData.sale_transfer_immoveable_property_236c_gross_receipt =
      getNumericValue(formData.sale_transfer_immoveable_property_236c_gross_receipt) ||
      getNumericValue(formData.saleTransferImmoveableProperty236C?.grossReceipt) ||
      0;

    cleanedData.sale_transfer_immoveable_property_236c_tax_collected =
      getNumericValue(formData.sale_transfer_immoveable_property_236c_tax_collected) ||
      getNumericValue(formData.saleTransferImmoveableProperty236C?.taxCollected) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt =
      getNumericValue(formData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedSoldSameYear?.grossReceipt) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected =
      getNumericValue(formData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedSoldSameYear?.taxCollected) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_prior_year_gross_receipt =
      getNumericValue(formData.tax_deducted_236c_property_purchased_prior_year_gross_receipt) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedPriorYear?.grossReceipt) ||
      0;

    cleanedData.tax_deducted_236c_property_purchased_prior_year_tax_collected =
      getNumericValue(formData.tax_deducted_236c_property_purchased_prior_year_tax_collected) ||
      getNumericValue(formData.taxDeducted236CPropertyPurchasedPriorYear?.taxCollected) ||
      0;

    cleanedData.purchase_transfer_immoveable_property_236k_gross_receipt =
      getNumericValue(formData.purchase_transfer_immoveable_property_236k_gross_receipt) ||
      getNumericValue(formData.purchaseTransferImmoveableProperty236K?.grossReceipt) ||
      0;

    cleanedData.purchase_transfer_immoveable_property_236k_tax_collected =
      getNumericValue(formData.purchase_transfer_immoveable_property_236k_tax_collected) ||
      getNumericValue(formData.purchaseTransferImmoveableProperty236K?.taxCollected) ||
      0;

    // Events and Services fields
    cleanedData.functions_gatherings_charges_236cb_gross_receipt =
      getNumericValue(formData.functions_gatherings_charges_236cb_gross_receipt) ||
      getNumericValue(formData.functionsGatheringsCharges236CB?.grossReceipt) ||
      0;

    cleanedData.functions_gatherings_charges_236cb_tax_collected =
      getNumericValue(formData.functions_gatherings_charges_236cb_tax_collected) ||
      getNumericValue(formData.functionsGatheringsCharges236CB?.taxCollected) ||
      0;

    cleanedData.withholding_tax_sale_considerations_37e_gross_receipt =
      getNumericValue(formData.withholding_tax_sale_considerations_37e_gross_receipt) ||
      getNumericValue(formData.withholdingTaxSaleConsiderations37E?.grossReceipt) ||
      0;

    cleanedData.withholding_tax_sale_considerations_37e_tax_collected =
      getNumericValue(formData.withholding_tax_sale_considerations_37e_tax_collected) ||
      getNumericValue(formData.withholdingTaxSaleConsiderations37E?.taxCollected) ||
      0;

    // Financial and International fields
    cleanedData.advance_fund_23a_part_i_second_schedule_gross_receipt =
      getNumericValue(formData.advance_fund_23a_part_i_second_schedule_gross_receipt) ||
      getNumericValue(formData.advanceFund23APartISecondSchedule?.grossReceipt) ||
      0;

    cleanedData.advance_fund_23a_part_i_second_schedule_tax_collected =
      getNumericValue(formData.advance_fund_23a_part_i_second_schedule_tax_collected) ||
      getNumericValue(formData.advanceFund23APartISecondSchedule?.taxCollected) ||
      0;

    cleanedData.persons_remitting_amount_abroad_236v_gross_receipt =
      getNumericValue(formData.persons_remitting_amount_abroad_236v_gross_receipt) ||
      getNumericValue(formData.personsRemittingAmountAbroad236V?.grossReceipt) ||
      0;

    cleanedData.persons_remitting_amount_abroad_236v_tax_collected =
      getNumericValue(formData.persons_remitting_amount_abroad_236v_tax_collected) ||
      getNumericValue(formData.personsRemittingAmountAbroad236V?.taxCollected) ||
      0;

    cleanedData.advance_tax_foreign_domestic_workers_231c_gross_receipt =
      getNumericValue(formData.advance_tax_foreign_domestic_workers_231c_gross_receipt) ||
      getNumericValue(formData.advanceTaxForeignDomesticWorkers231C?.grossReceipt) ||
      0;

    cleanedData.advance_tax_foreign_domestic_workers_231c_tax_collected =
      getNumericValue(formData.advance_tax_foreign_domestic_workers_231c_tax_collected) ||
      getNumericValue(formData.advanceTaxForeignDomesticWorkers231C?.taxCollected) ||
      0;

    // Cash withdrawal field
    cleanedData.advance_tax_cash_withdrawal_231ab_gross_receipt =
      getNumericValue(formData.advance_tax_cash_withdrawal_231ab_gross_receipt) ||
      getNumericValue(formData.advanceTaxCashWithdrawal231AB?.grossReceipt) ||
      0;

    cleanedData.advance_tax_cash_withdrawal_231ab_tax_collected =
      getNumericValue(formData.advance_tax_cash_withdrawal_231ab_tax_collected) ||
      getNumericValue(formData.advanceTaxCashWithdrawal231AB?.taxCollected) ||
      0;

    // Auto-link from Income Form if data is available and fields are zero
    // Map ALL 5 fields: salary, directorship, profit 15%, sukook 12.5%, rent
    if (incomeFormData) {
      // Auto-link salary from annual_salary_wages_total (withholding certificate value, excl. non-cash benefits)
      cleanedData.salary_employees_149_gross_receipt = parseFloat(
        incomeFormData.annual_salary_wages_total || incomeFormData.total_employment_income || 0
      );
      if (cleanedData.salary_employees_149_gross_receipt > 0) {
        logger.info(
          'Auto-linked salary from income form:',
          cleanedData.salary_employees_149_gross_receipt
        );
      }

      // Auto-link directorship fee
      if (
        cleanedData.directorship_fee_149_3_gross_receipt === 0 &&
        incomeFormData.directorship_fee > 0
      ) {
        cleanedData.directorship_fee_149_3_gross_receipt = parseFloat(
          incomeFormData.directorship_fee
        );
        logger.info(
          'Auto-linked directorship fee from income form:',
          cleanedData.directorship_fee_149_3_gross_receipt
        );
      }

      // Auto-link profit @15%
      if (
        cleanedData.profit_debt_15_percent_gross_receipt === 0 &&
        incomeFormData.profit_on_debt_15_percent > 0
      ) {
        cleanedData.profit_debt_15_percent_gross_receipt = parseFloat(
          incomeFormData.profit_on_debt_15_percent
        );
        logger.info(
          'Auto-linked profit debt 15% from income form:',
          cleanedData.profit_debt_15_percent_gross_receipt
        );
      }

      // Auto-link Sukook @12.5%
      if (
        cleanedData.profit_debt_sukook_151a_gross_receipt === 0 &&
        incomeFormData.profit_on_debt_12_5_percent > 0
      ) {
        cleanedData.profit_debt_sukook_151a_gross_receipt = parseFloat(
          incomeFormData.profit_on_debt_12_5_percent
        );
        // Also set the field name expected by CalculationService
        cleanedData.sukook_12_5_percent_gross_receipt =
          cleanedData.profit_debt_sukook_151a_gross_receipt;
        logger.info(
          'Auto-linked sukook 12.5% from income form:',
          cleanedData.profit_debt_sukook_151a_gross_receipt
        );
      }

      // Auto-link Rent
      if (
        cleanedData.tax_deducted_rent_section_155_gross_receipt === 0 &&
        incomeFormData.other_taxable_income_rent > 0
      ) {
        cleanedData.tax_deducted_rent_section_155_gross_receipt = parseFloat(
          incomeFormData.other_taxable_income_rent
        );
        // Also set the field name expected by CalculationService
        cleanedData.rent_section_155_gross_receipt =
          cleanedData.tax_deducted_rent_section_155_gross_receipt;
        logger.info(
          'Auto-linked rent from income form:',
          cleanedData.tax_deducted_rent_section_155_gross_receipt
        );
      }
    }

    // Calculate FBR compliant tax amounts using CalculationService
    const calculations = CalculationService.calculateAdjustableTaxFields(cleanedData, taxRates);
    logger.info('Adjustable tax calculations completed:', {
      directorship_tax: calculations.directorship_fee_149_3_tax_collected,
      total_tax: calculations.total_tax_collected,
    });

    // Helper: use user's explicitly provided tax value if present (even if 0),
    // fall back to calculated only when user didn't send the field at all.
    // Uses ?? (nullish coalescing) so 0 is treated as a valid override.
    const userTax = (flatField, nestedObj, nestedKey, calculatedValue) => {
      const flat = formData[flatField];
      if (flat !== null && flat !== undefined && flat !== '') {
        return parseFloat(flat);
      }
      const nested = nestedObj?.[nestedKey];
      if (nested !== null && nested !== undefined && nested !== '') {
        return parseFloat(nested);
      }
      // User didn't provide — use FBR-calculated value
      return calculatedValue ?? 0;
    };

    // Prepare data for the complex database structure (maintain backward compatibility)
    const adjustableTaxData = {
      tax_return_id: taxReturnId,
      user_id: userId,
      user_email: userEmail,
      tax_year_id: taxYearId,
      tax_year: taxYear,

      // Map to existing database fields - main ones we need for testing
      // For auto-calculated but editable fields: respect user's value (including explicit 0)
      directorship_fee_149_3_gross_receipt: cleanedData.directorship_fee_149_3_gross_receipt,
      directorship_fee_149_3_tax_collected: userTax(
        'directorship_fee_149_3_tax_collected', formData.directorshipFee149_3, 'taxCollected',
        calculations.directorship_fee_149_3_tax_collected),
      profit_debt_151_15_gross_receipt: cleanedData.profit_debt_15_percent_gross_receipt,
      profit_debt_151_15_tax_collected: userTax(
        'profit_debt_151_15_tax_collected', formData.profitDebt151_15, 'taxCollected',
        calculations.profit_debt_15_percent_tax_collected),
      profit_debt_sukook_151a_gross_receipt: cleanedData.profit_debt_sukook_151a_gross_receipt,
      profit_debt_sukook_151a_tax_collected: userTax(
        'profit_debt_sukook_151a_tax_collected', formData.profitDebtSukook151A, 'taxCollected',
        calculations.sukook_12_5_percent_tax_collected),
      tax_deducted_rent_section_155_gross_receipt:
        cleanedData.tax_deducted_rent_section_155_gross_receipt,
      tax_deducted_rent_section_155_tax_collected: userTax(
        'tax_deducted_rent_section_155_tax_collected', formData.taxDeductedRentSection155, 'taxCollected',
        calculations.rent_section_155_tax_collected),
      motor_vehicle_transfer_fee_231b2_gross_receipt:
        cleanedData.motor_vehicle_transfer_gross_receipt,
      motor_vehicle_transfer_fee_231b2_tax_collected: userTax(
        'motor_vehicle_transfer_fee_231b2_tax_collected', formData.motorVehicleTransferFee231B2, 'taxCollected',
        calculations.motor_vehicle_transfer_tax_collected),
      electricity_bill_domestic_235_gross_receipt: cleanedData.electricity_domestic_gross_receipt,
      electricity_bill_domestic_235_tax_collected: userTax(
        'electricity_bill_domestic_235_tax_collected', formData.electricityBillDomestic235, 'taxCollected',
        calculations.electricity_domestic_tax_collected),
      cellphone_bill_236_1f_gross_receipt: cleanedData.cellphone_bill_236_1f_gross_receipt || 0,
      cellphone_bill_236_1f_tax_collected: cleanedData.cellphone_bill_236_1f_tax_collected || 0,

      // Set all other fields to 0 to maintain database compatibility
      // EXCEPT salary which is auto-linked from income form
      salary_employees_149_gross_receipt: cleanedData.salary_employees_149_gross_receipt || 0,
      salary_employees_149_tax_collected: cleanedData.salary_employees_149_tax_collected || 0, // User input field
      advance_tax_cash_withdrawal_231ab_gross_receipt: cleanedData.advance_tax_cash_withdrawal_231ab_gross_receipt || 0,
      advance_tax_cash_withdrawal_231ab_tax_collected: cleanedData.advance_tax_cash_withdrawal_231ab_tax_collected || 0,
      motor_vehicle_registration_fee_231b1_gross_receipt: cleanedData.motor_vehicle_registration_fee_231b1_gross_receipt || 0,
      motor_vehicle_registration_fee_231b1_tax_collected: cleanedData.motor_vehicle_registration_fee_231b1_tax_collected || 0,
      motor_vehicle_sale_231b3_gross_receipt: cleanedData.motor_vehicle_sale_231b3_gross_receipt || 0,
      motor_vehicle_sale_231b3_tax_collected: cleanedData.motor_vehicle_sale_231b3_tax_collected || 0,
      motor_vehicle_leasing_231b1a_gross_receipt: cleanedData.motor_vehicle_leasing_231b1a_gross_receipt || 0,
      motor_vehicle_leasing_231b1a_tax_collected: cleanedData.motor_vehicle_leasing_231b1a_tax_collected || 0,
      advance_tax_motor_vehicle_231b2a_gross_receipt: cleanedData.advance_tax_motor_vehicle_231b2a_gross_receipt || 0,
      advance_tax_motor_vehicle_231b2a_tax_collected: cleanedData.advance_tax_motor_vehicle_231b2a_tax_collected || 0,
      telephone_bill_236_1e_gross_receipt: cleanedData.telephone_bill_236_1e_gross_receipt || 0,
      telephone_bill_236_1e_tax_collected: cleanedData.telephone_bill_236_1e_tax_collected || 0,
      prepaid_telephone_card_236_1b_gross_receipt: cleanedData.prepaid_telephone_card_236_1b_gross_receipt || 0,
      prepaid_telephone_card_236_1b_tax_collected: cleanedData.prepaid_telephone_card_236_1b_tax_collected || 0,
      phone_unit_236_1c_gross_receipt: cleanedData.phone_unit_236_1c_gross_receipt || 0,
      phone_unit_236_1c_tax_collected: cleanedData.phone_unit_236_1c_tax_collected || 0,
      internet_bill_236_1d_gross_receipt: cleanedData.internet_bill_236_1d_gross_receipt || 0,
      internet_bill_236_1d_tax_collected: cleanedData.internet_bill_236_1d_tax_collected || 0,
      prepaid_internet_card_236_1e_gross_receipt: cleanedData.prepaid_internet_card_236_1e_gross_receipt || 0,
      prepaid_internet_card_236_1e_tax_collected: cleanedData.prepaid_internet_card_236_1e_tax_collected || 0,
      sale_transfer_immoveable_property_236c_gross_receipt: cleanedData.sale_transfer_immoveable_property_236c_gross_receipt || 0,
      sale_transfer_immoveable_property_236c_tax_collected: cleanedData.sale_transfer_immoveable_property_236c_tax_collected || 0,
      tax_deducted_236c_property_purchased_sold_same_year_gross_recei: cleanedData.tax_deducted_236c_property_purchased_sold_same_year_gross_receipt || 0,
      tax_deducted_236c_property_purchased_sold_same_year_tax_collect: cleanedData.tax_deducted_236c_property_purchased_sold_same_year_tax_collected || 0,
      tax_deducted_236c_property_purchased_prior_year_gross_receipt: cleanedData.tax_deducted_236c_property_purchased_prior_year_gross_receipt || 0,
      tax_deducted_236c_property_purchased_prior_year_tax_collected: cleanedData.tax_deducted_236c_property_purchased_prior_year_tax_collected || 0,
      purchase_transfer_immoveable_property_236k_gross_receipt: cleanedData.purchase_transfer_immoveable_property_236k_gross_receipt || 0,
      purchase_transfer_immoveable_property_236k_tax_collected: cleanedData.purchase_transfer_immoveable_property_236k_tax_collected || 0,
      functions_gatherings_charges_236cb_gross_receipt: cleanedData.functions_gatherings_charges_236cb_gross_receipt || 0,
      functions_gatherings_charges_236cb_tax_collected: cleanedData.functions_gatherings_charges_236cb_tax_collected || 0,
      withholding_tax_sale_considerations_37e_gross_receipt: cleanedData.withholding_tax_sale_considerations_37e_gross_receipt || 0,
      withholding_tax_sale_considerations_37e_tax_collected: cleanedData.withholding_tax_sale_considerations_37e_tax_collected || 0,
      advance_fund_23a_part_i_second_schedule_gross_receipt: cleanedData.advance_fund_23a_part_i_second_schedule_gross_receipt || 0,
      advance_fund_23a_part_i_second_schedule_tax_collected: cleanedData.advance_fund_23a_part_i_second_schedule_tax_collected || 0,
      persons_remitting_amount_abroad_236v_gross_receipt: cleanedData.persons_remitting_amount_abroad_236v_gross_receipt || 0,
      persons_remitting_amount_abroad_236v_tax_collected: cleanedData.persons_remitting_amount_abroad_236v_tax_collected || 0,
      advance_tax_foreign_domestic_workers_231c_gross_receipt: cleanedData.advance_tax_foreign_domestic_workers_231c_gross_receipt || 0,
      advance_tax_foreign_domestic_workers_231c_tax_collected: cleanedData.advance_tax_foreign_domestic_workers_231c_tax_collected || 0,

      is_complete: isComplete,
      last_updated_by: userId,
    };

    // Single atomic upsert (BE-05): the previous SELECT-then-UPDATE/INSERT branch
    // was a TOCTOU race — two concurrent saves could both miss the row and both
    // INSERT, hitting the UNIQUE(user_id, tax_year) constraint with a 500. The
    // upsert collapses it to one statement. is_complete is sticky (BE-06).
    const identityKeys = new Set(['tax_return_id', 'user_id', 'user_email', 'tax_year_id', 'tax_year']);
    const columns = Object.keys(adjustableTaxData);
    const values = columns.map((c) => adjustableTaxData[c]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const updateAssignments = columns
      .filter((c) => !identityKeys.has(c))
      .map((c) => c === 'is_complete'
        ? `is_complete = adjustable_tax_forms.is_complete OR EXCLUDED.is_complete`
        : `${c} = EXCLUDED.${c}`)
      .concat(['updated_at = CURRENT_TIMESTAMP'])
      .join(', ');

    const result = await pool.query(
      `INSERT INTO adjustable_tax_forms (${columns.join(', ')}) VALUES (${placeholders}) ` +
      `ON CONFLICT (user_id, tax_year) DO UPDATE SET ${updateAssignments} RETURNING *`,
      values
    );

    logger.info(`Adjustable tax data saved for user ${userId}, tax year ${taxYear}`, {
      directorship_tax: result.rows[0].directorship_fee_149_3_tax_collected,
      total_fields_saved: Object.keys(result.rows[0]).length,
    });

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Adjustable tax data saved successfully',
      calculations: calculations,
      taxRatesUsed: taxRates,
      crossFormLinking: incomeFormData ? 'enabled' : 'no_income_data',
    });
  } catch (error) {
    logger.error('Error saving adjustable tax data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save adjustable tax data',
      error: error.message,
    });
  }
};

module.exports = { getAdjustableTax, saveAdjustableTax };
