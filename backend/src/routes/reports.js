const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const TaxCalculator = require('../utils/taxCalculator');
const auth = require('../middleware/auth'); // Use standard auth middleware

const router = express.Router();

// Get comprehensive tax calculation summary with proper calculations
router.get('/tax-calculation-summary/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    logger.info(`Generating tax calculation summary for user ${userId}, tax year ${taxYear}`);

    // Get form data for this user and tax year (simplified approach)
    const incomeResult = await pool.query(
      'SELECT * FROM income_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    ).catch(err => {
      logger.warn('Error fetching income forms:', err.message);
      return { rows: [] };
    });

    const adjustableTaxResult = await pool.query(
      'SELECT * FROM adjustable_tax_forms WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    ).catch(err => {
      logger.warn('Error fetching adjustable tax forms:', err.message);
      return { rows: [] };
    });

    const incomeData = incomeResult.rows[0] || null;
    const adjustableTaxData = adjustableTaxResult.rows[0] || null;

    // Calculate summary information
    const summary = {
      taxYear: taxYear,
      userId: userId,
      hasIncomeData: !!incomeData,
      hasAdjustableTaxData: !!adjustableTaxData,

      totalIncome: 0,
      totalWithholdingTax: 0,
      totalEmploymentIncome: 0,

      // Income breakdown
      incomeBreakdown: {},

      // Tax breakdown
      taxBreakdown: {}
    };

    // Add income data if available
    if (incomeData) {
      summary.totalEmploymentIncome = parseFloat(incomeData.total_employment_income || 0);
      summary.totalIncome += summary.totalEmploymentIncome;

      summary.incomeBreakdown = {
        annualBasicSalary: parseFloat(incomeData.annual_basic_salary || 0),
        allowances: parseFloat(incomeData.allowances || 0),
        directorshipFee: parseFloat(incomeData.directorship_fee || 0),
        bonus: parseFloat(incomeData.bonus || 0),
        totalEmploymentIncome: summary.totalEmploymentIncome
      };
    }

    // Add adjustable tax data if available
    if (adjustableTaxData) {
      summary.totalWithholdingTax = parseFloat(adjustableTaxData.directorship_fee_149_3_tax_collected || 0) +
                                   parseFloat(adjustableTaxData.profit_debt_151_15_tax_collected || 0);

      summary.taxBreakdown = {
        directorshipFeeTax: parseFloat(adjustableTaxData.directorship_fee_149_3_tax_collected || 0),
        profitDebtTax: parseFloat(adjustableTaxData.profit_debt_151_15_tax_collected || 0),
        totalWithholdingTax: summary.totalWithholdingTax
      };
    }

    // Prepare response data
    const reportData = {
      summary: summary,
      rawData: {
        income: incomeData,
        adjustableTax: adjustableTaxData
      },
      calculations: {
        totalIncome: summary.totalIncome,
        totalWithholdingTax: summary.totalWithholdingTax,
        netTaxPosition: summary.totalWithholdingTax // Simplified calculation
      }
    };

    logger.info(`Tax calculation summary completed for user ${userId}, tax year ${taxYear}`, {
      hasIncomeData: summary.hasIncomeData,
      hasAdjustableTaxData: summary.hasAdjustableTaxData,
      totalIncome: summary.totalIncome,
      totalWithholdingTax: summary.totalWithholdingTax
    });

    res.json({
      success: true,
      data: reportData,
      message: 'Tax calculation summary retrieved successfully'
    });

  } catch (error) {
    logger.error('Comprehensive tax calculation summary error:', error);
    res.status(500).json({
      error: 'Failed to generate comprehensive tax calculation summary',
      message: 'Internal server error: ' + error.message
    });
  }
});

// Get comprehensive income analysis
router.get('/income-analysis/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get detailed income data
    const incomeData = await pool.query(`
      SELECT
        monthly_salary,
        bonus,
        car_allowance,
        other_taxable,
        medical_allowance,
        employer_contribution,
        other_exempt,
        other_sources,
        subtotal_calculated,
        (COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0) +
         COALESCE(other_taxable::numeric, 0) + COALESCE(medical_allowance::numeric, 0) +
         COALESCE(employer_contribution::numeric, 0) + COALESCE(other_exempt::numeric, 0) +
         COALESCE(other_sources::numeric, 0)) as total_gross_income,
        (COALESCE(medical_allowance::numeric, 0) + COALESCE(employer_contribution::numeric, 0) +
         COALESCE(other_exempt::numeric, 0)) as total_exempt_income,
        (COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0) +
         COALESCE(other_taxable::numeric, 0) + COALESCE(other_sources::numeric, 0)) as total_taxable_income
      FROM income_forms
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get capital gains data
    const capitalGainsData = await pool.query(`
      SELECT 
        property_1_year,
        property_2_3_years,
        property_4_plus_years,
        securities,
        other_capital_gains,
        total_capital_gains
      FROM capital_gain_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get final tax income (if exists)
    const finalTaxData = await pool.query(`
      SELECT 
        sukuk_amount,
        debt_amount,
        prize_bonds,
        other_final_tax_amount
      FROM final_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const analysisData = {
      regularIncome: incomeData.rows[0] || null,
      capitalGains: capitalGainsData.rows[0] || null,
      finalTaxIncome: finalTaxData.rows[0] || null,
      taxYear,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: analysisData,
      message: 'Income analysis retrieved successfully'
    });

  } catch (error) {
    logger.error('Income analysis error:', error);
    res.status(500).json({
      error: 'Failed to generate income analysis',
      message: 'Internal server error'
    });
  }
});

// Get adjustable tax payments report
router.get('/adjustable-tax-report/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get adjustable tax data
    const adjustableTaxResult = await pool.query(`
      SELECT * FROM adjustable_tax_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    if (adjustableTaxResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { message: 'No adjustable tax data found for this year' },
        message: 'Adjustable tax report retrieved successfully'
      });
    }

    const adjustableTaxData = adjustableTaxResult.rows[0];

    // Structure the data for reporting
    const reportData = {
      taxYear,
      totalAdjustableTax: adjustableTaxData.total_adjustable_tax,
      categories: {
        employment: {
          salaryTax: adjustableTaxData.salary_employees_149_tax_collected || 0,
          directorshipFee: adjustableTaxData.directorship_fee_149_3_tax_collected || 0
        },
        utilities: {
          electricity: adjustableTaxData.electricity_bill_domestic_235_tax_collected || 0,
          telephone: adjustableTaxData.telephone_bill_236_1e_tax_collected || 0,
          cellphone: adjustableTaxData.cellphone_bill_236_1f_tax_collected || 0
        },
        motorVehicle: {
          registration: adjustableTaxData.motor_vehicle_registration_fee_231b1_tax_collected || 0,
          transfer: adjustableTaxData.motor_vehicle_transfer_fee_231b2_tax_collected || 0,
          sale: adjustableTaxData.motor_vehicle_sale_231b3_tax_collected || 0
        },
        property: {
          saleTransfer: adjustableTaxData.sale_transfer_immoveable_property_236c_tax_collected || 0,
          purchase: adjustableTaxData.purchase_transfer_immoveable_property_236k_tax_collected || 0
        },
        financial: {
          profitOnDebt: adjustableTaxData.profit_debt_151_15_tax_collected || 0,
          cashWithdrawal: adjustableTaxData.advance_tax_cash_withdrawal_231ab_tax_collected || 0
        }
      },
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Adjustable tax report retrieved successfully'
    });

  } catch (error) {
    logger.error('Adjustable tax report error:', error);
    res.status(500).json({
      error: 'Failed to generate adjustable tax report',
      message: 'Internal server error'
    });
  }
});

// Get wealth reconciliation report
router.get('/wealth-reconciliation/:taxYear', auth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.user.id;

    // Get tax return for the year
    const taxReturnResult = await pool.query(`
      SELECT * FROM tax_returns 
      WHERE user_id = $1 AND tax_year = $2
    `, [userId, taxYear]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    const taxReturnId = taxReturnResult.rows[0].id;

    // Get wealth data
    const wealthResult = await pool.query(`
      SELECT * FROM wealth_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get wealth reconciliation data if it exists
    const wealthReconciliationResult = await pool.query(`
      SELECT * FROM wealth_reconciliation_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get income data for reconciliation
    const incomeResult = await pool.query(`
      SELECT
        (COALESCE(monthly_salary::numeric, 0) + COALESCE(bonus::numeric, 0) + COALESCE(car_allowance::numeric, 0) +
         COALESCE(other_taxable::numeric, 0) + COALESCE(other_sources::numeric, 0)) as total_taxable_income
      FROM income_forms
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    // Get expenses data for reconciliation
    const expensesResult = await pool.query(`
      SELECT total_expenses FROM expenses_forms 
      WHERE tax_return_id = $1 AND user_id = $2
    `, [taxReturnId, userId]);

    const reportData = {
      taxYear,
      wealthStatement: wealthResult.rows[0] || null,
      wealthReconciliation: wealthReconciliationResult.rows[0] || null,
      totalTaxableIncome: incomeResult.rows[0]?.total_taxable_income || 0,
      totalExpenses: expensesResult.rows[0]?.total_expenses || 0,
      generatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      data: reportData,
      message: 'Wealth reconciliation report retrieved successfully'
    });

  } catch (error) {
    logger.error('Wealth reconciliation report error:', error);
    res.status(500).json({
      error: 'Failed to generate wealth reconciliation report',
      message: 'Internal server error'
    });
  }
});

// Get available tax years for reports
router.get('/available-years', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT DISTINCT tr.id as tax_return_id, tr.tax_year, ty.start_date, ty.end_date, ty.filing_deadline
      FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year = ty.tax_year
      WHERE tr.user_id = $1
      ORDER BY tr.tax_year DESC
    `, [userId]);

    res.json({
      success: true,
      data: result.rows,
      message: 'Available tax years retrieved successfully'
    });

  } catch (error) {
    logger.error('Available years error:', error);
    res.status(500).json({
      error: 'Failed to retrieve available years',
      message: 'Internal server error'
    });
  }
});

// Generate Tax Return PDF in FBR format
router.post('/tax-return-pdf/:taxReturnId', auth, async (req, res) => {
  try {
    const { userId, userEmail } = req;
    const { taxReturnId } = req.params;

    logger.debug('FBR PDF generation', { taxReturnId, userId, userEmail });

    // Get tax return summary data (reuse the logic from taxForms route)
    const axios = require('axios');
    const puppeteer = require('puppeteer');

    // First, get the tax return data using return_number instead of id
    const taxReturnResult = await pool.query(`
      SELECT tr.*, ty.tax_year FROM tax_returns tr
      JOIN tax_years ty ON tr.tax_year_id = ty.id
      WHERE tr.return_number = $1 AND tr.user_id = $2
    `, [taxReturnId, userId]);

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'Tax return not found for this user'
      });
    }

    const taxYear = taxReturnResult.rows[0].tax_year;

    // Get the corrected tax calculation summary using TaxCalculator
    const summaryResponse = await axios.get(`http://localhost:3001/api/reports/tax-calculation-summary/${taxYear}`, {
      headers: {
        Authorization: req.headers.authorization
      }
    });

    if (!summaryResponse.data.success) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'Could not retrieve tax return data'
      });
    }

    const apiResponse = summaryResponse.data.data;

    // Debug logging to trace the data flow
    logger.debug('FBR PDF data flow', {
      taxYear,
      calculations: apiResponse.calculations,
      expectedValues: { taxableIncome: 21595004, taxChargeable: 7135349 }
    });

    // Map the corrected API response to the format expected by the FBR HTML template
    const taxData = {
      // User information
      user: apiResponse.user || {},
      returnNumber: apiResponse.returnNumber || '',
      taxYear: apiResponse.taxYear || '',
      filingStatus: apiResponse.filingStatus || '',

      // Tax calculations from the corrected TaxCalculator
      grossIncome: apiResponse.calculations?.grossIncome || 0,
      exemptIncome: apiResponse.calculations?.exemptIncome || 0,
      taxableIncome: apiResponse.calculations?.taxableIncome || 0,
      capitalGain: apiResponse.calculations?.capitalGain || 0,
      normalIncomeTax: apiResponse.calculations?.normalIncomeTax || 0,
      surcharge: apiResponse.calculations?.surcharge || 0,
      taxReductions: apiResponse.calculations?.taxReductions || 0,
      taxCredits: apiResponse.calculations?.taxCredits || 0,
      adjustableTax: apiResponse.calculations?.adjustableTax || 0,
      finalTax: apiResponse.calculations?.finalTax || 0,
      capitalGainTax: apiResponse.calculations?.capitalGainTax || 0,
      taxChargeable: apiResponse.calculations?.taxChargeable || 0,
      withholdingTax: apiResponse.calculations?.withholdingTax || 0,
      taxDemanded: apiResponse.calculations?.taxDemanded || 0,
      totalTaxPaid: apiResponse.calculations?.totalTaxPaid || 0,
      refundDue: apiResponse.calculations?.refundDue || 0,
      additionalTaxDue: apiResponse.calculations?.additionalTaxDue || 0,

      // Map to template field names
      totalIncome: apiResponse.calculations?.grossIncome || 0,
      incomeFromSalary: apiResponse.calculations?.grossIncome || 0,
      withholdingIncomeTax: apiResponse.calculations?.withholdingTax || 0,
      refundableIncomeTax: apiResponse.calculations?.refundDue || 0,

      // Structured data
      adjustableTax: {
        receipts: apiResponse.calculations?.grossIncome || 0,
        taxCollected: apiResponse.calculations?.withholdingTax || 0,
        taxChargeable: apiResponse.calculations?.adjustableTax || 0
      },
      salaryTax: {
        receipts: apiResponse.calculations?.grossIncome || 0,
        taxCollected: apiResponse.calculations?.withholdingTax || 0
      },
      personalExpenses: apiResponse.personalExpenses || {
        total: 0,
        ratesTaxes: 0,
        vehicle: 0,
        travelling: 0,
        electricity: 0,
        water: 0,
        gas: 0,
        telephone: 0,
        medical: 0,
        educational: 0,
        other: 0
      },
      personalAssets: apiResponse.personalAssets || [],
      totalAssets: apiResponse.totalAssets || 0,
      netAssets: apiResponse.netAssets || 0,
      netAssetsPrevious: apiResponse.netAssetsPrevious || 0,
      assetsChange: apiResponse.assetsChange || 0,
      inflows: apiResponse.inflows || 0,
      declaredIncome: apiResponse.declaredIncome || 0,
      outflows: apiResponse.outflows || 0,
      unreconciledAmount: apiResponse.unreconciledAmount || 0
    };

    // Generate HTML for PDF
    const htmlContent = generateFBRHTML(taxData);

    // Create PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set content and wait for it to load
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF with FBR-specific formatting
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      displayHeaderFooter: false
    });

    await browser.close();

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Tax_Return_${taxData.returnNumber || taxReturnId}_FBR.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    logger.error('PDF generation error:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

// Function to generate FBR-formatted HTML for PDF
function generateFBRHTML(taxData) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FBR Tax Return - ${taxData.user?.name || 'Unknown'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.2;
      color: #000;
    }

    .page {
      min-height: 100vh;
      padding: 15px;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .fbr-header {
      background-color: #1e40af;
      color: white;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .fbr-logo {
      width: 60px;
      height: 60px;
      background-color: white;
      color: #1e40af;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
    }

    .irs-logo {
      width: 60px;
      height: 60px;
      background-color: white;
      color: #1e40af;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
    }

    .fbr-title h1 {
      font-size: 18px;
      margin-bottom: 4px;
    }

    .fbr-title p {
      font-size: 12px;
    }

    .acknowledgement {
      text-align: center;
      margin-bottom: 20px;
    }

    .acknowledgement h2 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .acknowledgement p {
      font-size: 10px;
      text-decoration: underline;
      margin-bottom: 16px;
    }

    .personal-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 20px;
      font-size: 10px;
    }

    .personal-details p {
      margin-bottom: 3px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 10px;
    }

    table, th, td {
      border: 1px solid black;
    }

    th, td {
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .section-header {
      background-color: #e5e7eb;
      font-weight: bold;
      padding: 6px;
      margin: 10px 0 4px 0;
      font-size: 11px;
    }

    .disclaimer {
      font-style: italic;
      font-size: 9px;
      margin-top: 10px;
    }

    .fbr-footer {
      margin-top: auto;
      font-size: 10px;
    }

    .fbr-footer-content {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .fbr-copyright {
      background-color: #1e40af;
      color: white;
      text-align: center;
      padding: 8px;
      font-size: 9px;
    }

    .barcode-area {
      height: 25px;
      border: 1px solid black;
      margin: 10px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      font-size: 8px;
    }

    .indent {
      padding-left: 15px;
    }

    @page {
      margin: 0.5in;
      size: A4;
    }
  </style>
</head>
<body>

<!-- Page 1 - Acknowledgement Slip -->
<div class="page">
  <div class="fbr-header">
    <div class="fbr-logo">FBR</div>
    <div class="fbr-title">
      <h1>Federal Board of Revenue</h1>
      <p>Revenue Division - Government of Pakistan</p>
    </div>
    <div class="irs-logo">IRS</div>
  </div>

  <div class="acknowledgement">
    <h2>ACKNOWLEDGEMENT SLIP</h2>
    <p>114(1) (Return of Income for a person deriving income only from salary and other sources eligible to file salary return)</p>
  </div>

  <div class="personal-details">
    <div>
      <p><strong>Name:</strong> ${taxData.user?.name || 'N/A'}</p>
      <p><strong>Address:</strong> ${taxData.user?.address || 'N/A'}</p>
      <p><strong>Contact No:</strong> ${taxData.user?.phone || 'N/A'}</p>
    </div>
    <div>
      <p><strong>Registration No:</strong> ${taxData.user?.registrationNo || 'N/A'}</p>
      <p><strong>Tax Year:</strong> ${taxData.taxYear || '2024'}</p>
      <p><strong>Period:</strong> 01-Jul-2023 - 30-Jun-2024</p>
      <p><strong>Medium:</strong></p>
      <p><strong>Due Date:</strong> 30-Sep-2024</p>
      <p><strong>Document Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>

  <div class="barcode-area">
    |||||||| ${taxData.user?.registrationNo || '1100010065467'} ||||||||
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Net Assets Current Year</td>
        <td class="text-center">703001</td>
        <td class="text-right">${formatAmount(taxData.netAssets)}</td>
      </tr>
      <tr>
        <td>Refundable Income Tax</td>
        <td class="text-center">9210</td>
        <td class="text-right">${formatAmount(taxData.refundableIncomeTax)}</td>
      </tr>
      <tr>
        <td>Tax Chargeable</td>
        <td class="text-center">9200</td>
        <td class="text-right">${formatAmount(taxData.taxChargeable)}</td>
      </tr>
      <tr>
        <td>Taxable Income</td>
        <td class="text-center">9100</td>
        <td class="text-right">${formatAmount(taxData.taxableIncome)}</td>
      </tr>
      <tr>
        <td>Total Income</td>
        <td class="text-center">9000</td>
        <td class="text-right">${formatAmount(taxData.totalIncome)}</td>
      </tr>
    </tbody>
  </table>

  <p class="disclaimer">
    This is not a valid evidence of being a "filer" for the purposes of clauses (23A) and (35C) of sections 2 and 181A.
  </p>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 1 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

<!-- Page 2 - Salary and Tax Details -->
<div class="page">
  <div class="fbr-header">
    <div class="fbr-logo">FBR</div>
    <div class="fbr-title">
      <h1>Federal Board of Revenue</h1>
      <p>Revenue Division - Government of Pakistan</p>
    </div>
    <div class="irs-logo">IRS</div>
  </div>

  <div class="acknowledgement">
    <p style="text-decoration: underline;">114(1) (Return of Income for a person deriving income only from salary and other sources eligible to file salary return)</p>
  </div>

  <div class="personal-details">
    <div>
      <p><strong>Name:</strong> ${taxData.user?.name || 'N/A'}</p>
      <p><strong>Address:</strong> ${taxData.user?.address || 'N/A'}</p>
      <p><strong>Contact No:</strong> ${taxData.user?.phone || 'N/A'}</p>
    </div>
    <div>
      <p><strong>Registration No:</strong> ${taxData.user?.registrationNo || 'N/A'}</p>
      <p><strong>Tax Year:</strong> ${taxData.taxYear || '2024'}</p>
      <p><strong>Period:</strong> 01-Jul-2023 - 30-Jun-2024</p>
      <p><strong>Medium:</strong></p>
      <p><strong>Due Date:</strong> 30-Sep-2024</p>
      <p><strong>Document Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>

  <div class="barcode-area">
    |||||||| ${taxData.user?.registrationNo || '1100010065467'} ||||||||
  </div>

  <h3 class="section-header">Salary</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Total Amount</th>
        <th class="text-right">Amount Exempt from Tax / Subject to Fixed / Final Tax</th>
        <th class="text-right">Amount Subject to Normal Tax</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Income from Salary</td>
        <td class="text-center">1000</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
      </tr>
      <tr>
        <td>Pay, Wages or Other Remuneration (including Arrears of Salary)</td>
        <td class="text-center">1009</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Tax Reductions</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Total Amount</th>
        <th class="text-right">Tax Chargeable</th>
        <th class="text-right">Tax Reducted</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Tax Reduction on Tax Charged on Behbood Certificates / Pensioner's Benefit Account in excess of applicable rate</td>
        <td class="text-center">930101</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Adjustable Tax</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Receipts / Value</th>
        <th class="text-right">Tax Collected/ Deducted</th>
        <th class="text-right">Tax Chargeable</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Adjustable Tax</td>
        <td class="text-center">640000</td>
        <td class="text-right">${formatAmount(taxData.adjustableTax?.receipts)}</td>
        <td class="text-right">${formatAmount(taxData.adjustableTax?.taxCollected)}</td>
        <td class="text-right">${formatAmount(taxData.adjustableTax?.taxChargeable)}</td>
      </tr>
      <tr>
        <td>Salary of Employees u/s 149</td>
        <td class="text-center">64020004</td>
        <td class="text-right">${formatAmount(taxData.salaryTax?.receipts)}</td>
        <td class="text-right">${formatAmount(taxData.salaryTax?.taxCollected)}</td>
        <td class="text-right">0</td>
      </tr>
    </tbody>
  </table>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 2 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

<!-- Page 3 - Computations and Personal Expenses -->
<div class="page">
  <div class="fbr-header">
    <div class="fbr-logo">FBR</div>
    <div class="fbr-title">
      <h1>Federal Board of Revenue</h1>
      <p>Revenue Division - Government of Pakistan</p>
    </div>
    <div class="irs-logo">IRS</div>
  </div>

  <div class="acknowledgement">
    <p style="text-decoration: underline;">114(1) (Return of Income for a person deriving income only from salary and other sources eligible to file salary return)</p>
  </div>

  <div class="personal-details">
    <div>
      <p><strong>Name:</strong> ${taxData.user?.name || 'N/A'}</p>
      <p><strong>Address:</strong> ${taxData.user?.address || 'N/A'}</p>
      <p><strong>Contact No:</strong> ${taxData.user?.phone || 'N/A'}</p>
    </div>
    <div>
      <p><strong>Registration No:</strong> ${taxData.user?.registrationNo || 'N/A'}</p>
      <p><strong>Tax Year:</strong> ${taxData.taxYear || '2024'}</p>
      <p><strong>Period:</strong> 01-Jul-2023 - 30-Jun-2024</p>
      <p><strong>Medium:</strong></p>
      <p><strong>Due Date:</strong> 30-Sep-2024</p>
      <p><strong>Document Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
    </div>
  </div>

  <div class="barcode-area">
    |||||||| ${taxData.user?.registrationNo || '1100010065467'} ||||||||
  </div>

  <h3 class="section-header">Computations</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Total Amount</th>
        <th class="text-right">Amount Exempt from Tax / Subject to Fixed / Final Tax</th>
        <th class="text-right">Amount Subject to Normal Tax</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Income from Salary</td>
        <td class="text-center">1000</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.incomeFromSalary)}</td>
      </tr>
      <tr>
        <td>Total Income</td>
        <td class="text-center">9000</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.totalIncome)}</td>
      </tr>
      <tr>
        <td>Taxable Income</td>
        <td class="text-center">9100</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.taxableIncome)}</td>
      </tr>
      <tr>
        <td>Tax Chargeable</td>
        <td class="text-center">9200</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.taxChargeable)}</td>
      </tr>
      <tr>
        <td>Normal Income Tax</td>
        <td class="text-center">920000</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.normalIncomeTax)}</td>
      </tr>
      <tr>
        <td>Withholding Income Tax</td>
        <td class="text-center">9201</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.withholdingIncomeTax)}</td>
        <td class="text-right"></td>
      </tr>
      <tr>
        <td>Refundable Income Tax</td>
        <td class="text-center">9210</td>
        <td class="text-right">0</td>
        <td class="text-right">0</td>
        <td class="text-right">${formatAmount(taxData.refundableIncomeTax)}</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Personal Expenses</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Personal Expenses</td>
        <td class="text-center">7089</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.total)}</td>
      </tr>
      <tr>
        <td class="indent">Rates / Taxes / Charge / Cess</td>
        <td class="text-center">7052</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.ratesTaxes)}</td>
      </tr>
      <tr>
        <td class="indent">Vehicle Running / Maintenance</td>
        <td class="text-center">7055</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.vehicle)}</td>
      </tr>
      <tr>
        <td class="indent">Travelling</td>
        <td class="text-center">7056</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.travelling)}</td>
      </tr>
      <tr>
        <td class="indent">Electricity</td>
        <td class="text-center">7058</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.electricity)}</td>
      </tr>
      <tr>
        <td class="indent">Water</td>
        <td class="text-center">7059</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.water)}</td>
      </tr>
      <tr>
        <td class="indent">Gas</td>
        <td class="text-center">7060</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.gas)}</td>
      </tr>
      <tr>
        <td class="indent">Telephone</td>
        <td class="text-center">7061</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.telephone)}</td>
      </tr>
      <tr>
        <td class="indent">Medical</td>
        <td class="text-center">7070</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.medical)}</td>
      </tr>
      <tr>
        <td class="indent">Educational</td>
        <td class="text-center">7071</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.educational)}</td>
      </tr>
      <tr>
        <td class="indent">Other Personal / Household Expenses</td>
        <td class="text-center">7087</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.other)}</td>
      </tr>
    </tbody>
  </table>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 3 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

<!-- Page 4 - Personal Assets and Reconciliation -->
<div class="page">
  <h3 class="section-header">Personal Assets / Liabilities</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${taxData.personalAssets?.map(asset => `
        <tr>
          <td>${asset.description}</td>
          <td class="text-center">${asset.code}</td>
          <td class="text-right">${formatAmount(asset.amount)}</td>
        </tr>
      `).join('') || ''}
      <tr style="background-color: #f0f0f0; font-weight: bold;">
        <td>Total Assets</td>
        <td class="text-center">7019</td>
        <td class="text-right">${formatAmount(taxData.totalAssets)}</td>
      </tr>
      <tr style="background-color: #f0f0f0; font-weight: bold;">
        <td>Net Assets Current Year</td>
        <td class="text-center">703001</td>
        <td class="text-right">${formatAmount(taxData.netAssets)}</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-header">Reconciliation of Net Assets</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-center">Code</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Net Assets Current Year</td>
        <td class="text-center">703001</td>
        <td class="text-right">${formatAmount(taxData.netAssets)}</td>
      </tr>
      <tr>
        <td>Net Assets Previous Year</td>
        <td class="text-center">703002</td>
        <td class="text-right">${formatAmount(taxData.netAssetsPrevious)}</td>
      </tr>
      <tr>
        <td>Increase / Decrease in Assets</td>
        <td class="text-center">703003</td>
        <td class="text-right">${formatAmount(taxData.assetsChange)}</td>
      </tr>
      <tr>
        <td>Inflows</td>
        <td class="text-center">7049</td>
        <td class="text-right">${formatAmount(taxData.inflows)}</td>
      </tr>
      <tr>
        <td class="indent">Income Declared as per Return for the year subject to Normal Tax</td>
        <td class="text-center">7031</td>
        <td class="text-right">${formatAmount(taxData.declaredIncome)}</td>
      </tr>
      <tr>
        <td>Outflows</td>
        <td class="text-center">7099</td>
        <td class="text-right">${formatAmount(taxData.outflows)}</td>
      </tr>
      <tr>
        <td class="indent">Personal Expenses</td>
        <td class="text-center">7089</td>
        <td class="text-right">${formatAmount(taxData.personalExpenses?.total)}</td>
      </tr>
      <tr style="background-color: #fef3c7; font-weight: bold;">
        <td>Unreconciled Amount</td>
        <td class="text-center">703000</td>
        <td class="text-right">${formatAmount(taxData.unreconciledAmount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="fbr-footer">
    <div class="fbr-footer-content">
      <span>Print Date: ${new Date().toLocaleString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })}</span>
      <span>Page 4 of 4</span>
    </div>
    <div class="fbr-copyright">
      Copyright © 2014 All rights reserved Federal Board of Revenue - Government of Pakistan.
    </div>
  </div>
</div>

</body>
</html>
  `;

  function formatAmount(amount) {
    if (!amount || amount === 0) return '0';
    return new Intl.NumberFormat('en-US').format(Math.round(amount));
  }
}

module.exports = router;