const ExcelJS = require('exceljs');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

class ExcelService {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
  }

  // Define modern styling
  getModernStyles() {
    return {
      headerStyle: {
        font: { 
          name: 'Segoe UI',
          size: 14,
          bold: true,
          color: { argb: 'FFFFFF' }
        },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '2E7D32' } // Dark green
        },
        alignment: { 
          vertical: 'middle', 
          horizontal: 'center',
          wrapText: true
        },
        border: {
          top: {style: 'thin', color: {argb: 'CCCCCC'}},
          left: {style: 'thin', color: {argb: 'CCCCCC'}},
          bottom: {style: 'thin', color: {argb: 'CCCCCC'}},
          right: {style: 'thin', color: {argb: 'CCCCCC'}}
        }
      },
      subHeaderStyle: {
        font: { 
          name: 'Segoe UI',
          size: 12,
          bold: true,
          color: { argb: '2E7D32' }
        },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'E8F5E8' } // Light green
        },
        alignment: { 
          vertical: 'middle', 
          horizontal: 'left',
          wrapText: true
        },
        border: {
          top: {style: 'thin', color: {argb: 'CCCCCC'}},
          left: {style: 'thin', color: {argb: 'CCCCCC'}},
          bottom: {style: 'thin', color: {argb: 'CCCCCC'}},
          right: {style: 'thin', color: {argb: 'CCCCCC'}}
        }
      },
      dataStyle: {
        font: { 
          name: 'Segoe UI',
          size: 11
        },
        alignment: { 
          vertical: 'middle', 
          horizontal: 'left',
          wrapText: true
        },
        border: {
          top: {style: 'thin', color: {argb: 'E0E0E0'}},
          left: {style: 'thin', color: {argb: 'E0E0E0'}},
          bottom: {style: 'thin', color: {argb: 'E0E0E0'}},
          right: {style: 'thin', color: {argb: 'E0E0E0'}}
        }
      },
      numberStyle: {
        font: { 
          name: 'Segoe UI',
          size: 11
        },
        alignment: { 
          vertical: 'middle', 
          horizontal: 'right'
        },
        border: {
          top: {style: 'thin', color: {argb: 'E0E0E0'}},
          left: {style: 'thin', color: {argb: 'E0E0E0'}},
          bottom: {style: 'thin', color: {argb: 'E0E0E0'}},
          right: {style: 'thin', color: {argb: 'E0E0E0'}}
        },
        numFmt: '#,##0.00'
      },
      titleStyle: {
        font: { 
          name: 'Segoe UI',
          size: 18,
          bold: true,
          color: { argb: '1B5E20' }
        },
        alignment: { 
          vertical: 'middle', 
          horizontal: 'center'
        }
      }
    };
  }

  // Create user details worksheet
  async createUserDetailsSheet(userData, taxReturnData) {
    const worksheet = this.workbook.addWorksheet('Taxpayer profile', {
      properties: { tabColor: { argb: '2E7D32' } }
    });
    const styles = this.getModernStyles();

    // Set column widths
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 40 }
    ];

    // Title
    worksheet.mergeCells('A1:B1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'Pakistani Tax Return - User Details';
    titleCell.style = styles.titleStyle;
    worksheet.getRow(1).height = 30;

    // Headers
    worksheet.getRow(3).values = ['Field', 'Value'];
    worksheet.getRow(3).eachCell(cell => {
      cell.style = styles.headerStyle;
    });
    worksheet.getRow(3).height = 25;

    // User data
    const userDetails = [
      ['Name', userData.name || ''],
      ['Email', userData.email || ''],
      ['User Type', userData.user_type || ''],
      ['Account Created', userData.created_at ? new Date(userData.created_at).toLocaleDateString() : ''],
      ['', ''], // Empty row
      ['Tax Year', taxReturnData.tax_year || ''],
      ['Return Number', taxReturnData.return_number || ''],
      ['Filing Status', taxReturnData.filing_status || ''],
      ['Created Date', taxReturnData.created_at ? new Date(taxReturnData.created_at).toLocaleDateString() : ''],
      ['Last Updated', taxReturnData.updated_at ? new Date(taxReturnData.updated_at).toLocaleDateString() : '']
    ];

    userDetails.forEach((row, index) => {
      const rowNum = index + 4;
      if (row[0] === '') {
        // Empty row for spacing
        worksheet.getRow(rowNum).height = 15;
        return;
      }
      
      const currentRow = worksheet.getRow(rowNum);
      currentRow.values = row;
      
      // Style the field name (column A)
      currentRow.getCell(1).style = styles.subHeaderStyle;
      // Style the value (column B)
      currentRow.getCell(2).style = styles.dataStyle;
    });

    return worksheet;
  }

  // Create form worksheet with data
  async createFormSheet(formName, formData, fieldMappings) {
    const worksheet = this.workbook.addWorksheet(formName, {
      properties: { tabColor: { argb: '4CAF50' } }
    });
    const styles = this.getModernStyles();

    // Set column widths
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 35 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'Description', key: 'description', width: 50 }
    ];

    // Title
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${formName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    titleCell.style = styles.titleStyle;
    worksheet.getRow(1).height = 30;

    // Headers
    worksheet.getRow(3).values = ['Field', 'Value (PKR)', 'Description'];
    worksheet.getRow(3).eachCell(cell => {
      cell.style = styles.headerStyle;
    });
    worksheet.getRow(3).height = 25;

    // Form data
    let rowNum = 4;
    
    for (const [fieldName, fieldConfig] of Object.entries(fieldMappings)) {
      if (fieldName.includes('id') || fieldName.includes('created_at') || 
          fieldName.includes('updated_at') || fieldName.includes('last_updated_by')) {
        continue; // Skip system fields
      }

      const currentRow = worksheet.getRow(rowNum);
      const fieldValue = formData?.[fieldName] || 0;
      
      currentRow.values = [
        fieldConfig.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        fieldValue,
        fieldConfig.description || ''
      ];
      
      // Style the row
      currentRow.getCell(1).style = styles.subHeaderStyle;
      
      if (typeof fieldValue === 'number' || !isNaN(fieldValue)) {
        currentRow.getCell(2).style = styles.numberStyle;
      } else {
        currentRow.getCell(2).style = styles.dataStyle;
      }
      
      currentRow.getCell(3).style = styles.dataStyle;
      rowNum++;
    }

    // Add totals if they exist in the data
    const totalFields = Object.keys(formData || {}).filter(key => 
      key.includes('total') || key.includes('subtotal') || key.includes('grand_total')
    );
    
    if (totalFields.length > 0) {
      rowNum++; // Empty row
      const totalHeaderRow = worksheet.getRow(rowNum);
      totalHeaderRow.values = ['TOTALS', '', ''];
      totalHeaderRow.getCell(1).style = {
        ...styles.headerStyle,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1976D2' } }
      };
      totalHeaderRow.getCell(2).style = styles.headerStyle;
      totalHeaderRow.getCell(3).style = styles.headerStyle;
      rowNum++;

      totalFields.forEach(field => {
        const currentRow = worksheet.getRow(rowNum);
        currentRow.values = [
          field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          formData[field] || 0,
          'Calculated Total'
        ];
        
        currentRow.getCell(1).style = styles.subHeaderStyle;
        currentRow.getCell(2).style = {
          ...styles.numberStyle,
          font: { ...styles.numberStyle.font, bold: true }
        };
        currentRow.getCell(3).style = styles.dataStyle;
        rowNum++;
      });
    }

    return worksheet;
  }

  // Export complete tax return as Excel workbook
  async exportTaxReturn(userId, taxYear) {
    try {
      this.workbook = new ExcelJS.Workbook();
      
      // Set workbook properties
      this.workbook.creator = 'Pakistani Tax Advisor';
      this.workbook.lastModifiedBy = 'Pakistani Tax Advisor';
      this.workbook.created = new Date();
      this.workbook.modified = new Date();
      this.workbook.subject = `Tax Return ${taxYear}`;

      // Get user and tax return data
      const userResult = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      const taxReturnResult = await pool.query(
        'SELECT * FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (taxReturnResult.rows.length === 0) {
        throw new Error('Tax return not found');
      }

      const userData = userResult.rows[0];
      const taxReturnData = taxReturnResult.rows[0];
      const taxReturnId = taxReturnData.id;

      // Create user details sheet
      await this.createUserDetailsSheet(userData, taxReturnData);

      // Define field mappings for each form
      const formConfigurations = this.getFormConfigurations();

      // Create sheets for each form
      for (const [tableName, config] of Object.entries(formConfigurations)) {
        try {
          const formResult = await pool.query(
            `SELECT * FROM ${tableName} WHERE tax_return_id = $1 AND user_id = $2`,
            [taxReturnId, userId]
          );

          await this.createFormSheet(
            config.sheetName,
            formResult.rows[0] || {},
            config.fields
          );
        } catch (error) {
          logger.warn(`Could not create sheet for ${tableName}:`, error.message);
        }
      }

      return this.workbook;

    } catch (error) {
      logger.error('Excel export error:', error);
      throw error;
    }
  }

  // Import Excel workbook and update database
  async importTaxReturn(userId, taxYear, workbookBuffer) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(workbookBuffer);

      // Get tax return ID, user email, and tax year ID
      const taxReturnResult = await pool.query(
        'SELECT tr.id, tr.tax_year_id, u.email FROM tax_returns tr JOIN users u ON tr.user_id = u.id WHERE tr.user_id = $1 AND tr.tax_year = $2',
        [userId, taxYear]
      );

      if (taxReturnResult.rows.length === 0) {
        throw new Error('Tax return not found');
      }

      const taxReturnId = taxReturnResult.rows[0].id;
      const taxYearId = taxReturnResult.rows[0].tax_year_id;
      const userEmail = taxReturnResult.rows[0].email;
      const formConfigurations = this.getFormConfigurations();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Process each form sheet
        for (const [tableName, config] of Object.entries(formConfigurations)) {
          const worksheet = workbook.getWorksheet(config.sheetName);
          if (!worksheet) continue;

          const formData = {};
          let currentRow = 4; // Start after headers

          // Extract data from worksheet
          while (worksheet.getRow(currentRow).getCell(1).value) {
            const fieldLabel = worksheet.getRow(currentRow).getCell(1).value;
            const fieldValue = worksheet.getRow(currentRow).getCell(2).value;

            if (fieldLabel === 'TOTALS') break; // Stop at totals section

            // Find field name by label
            const fieldName = Object.keys(config.fields).find(key => 
              config.fields[key].label === fieldLabel ||
              key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) === fieldLabel
            );

            if (fieldName && fieldName !== 'id' && !fieldName.includes('created_at') && 
                !fieldName.includes('updated_at')) {
              formData[fieldName] = fieldValue || 0;
            }

            currentRow++;
          }

          // Update database
          if (Object.keys(formData).length > 0) {
            await this.updateFormData(client, tableName, taxReturnId, userId, userEmail, taxYearId, taxYear, formData);
          }
        }

        await client.query('COMMIT');
        logger.info(`Excel import completed for user ${userId}, tax year ${taxYear}`);

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Excel import error:', error);
      throw error;
    }
  }

  // Update form data in database
  async updateFormData(client, tableName, taxReturnId, userId, userEmail, taxYearId, taxYear, formData) {
    const fields = Object.keys(formData);
    if (fields.length === 0) return;

    // Get list of generated columns for this table to skip them
    const generatedColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1 AND is_generated = 'ALWAYS'
    `, [tableName]);

    const generatedColumns = new Set(generatedColumnsResult.rows.map(row => row.column_name));

    // Filter out generated columns
    const updateableFields = fields.filter(field => !generatedColumns.has(field));

    if (updateableFields.length === 0) return;

    // Check if table has user_email and tax_year_id columns
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1 AND column_name IN ('user_email', 'tax_year_id', 'tax_year')
    `, [tableName]);

    const tableColumns = new Set(columnsResult.rows.map(row => row.column_name));
    const hasUserEmail = tableColumns.has('user_email');
    const hasTaxYearId = tableColumns.has('tax_year_id');
    const hasTaxYear = tableColumns.has('tax_year');

    // First check if record exists
    const existingResult = await client.query(
      `SELECT id FROM ${tableName} WHERE tax_return_id = $1 AND user_id = $2`,
      [taxReturnId, userId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing record
      const setClause = updateableFields.map((field, index) => `${field} = $${index + 3}`).join(', ');
      const values = [taxReturnId, userId, ...updateableFields.map(field => formData[field])];

      const updateQuery = `
        UPDATE ${tableName}
        SET ${setClause}, updated_at = NOW()
        WHERE tax_return_id = $1 AND user_id = $2
      `;

      await client.query(updateQuery, values);
    } else {
      // Insert new record - build base fields based on table structure
      const baseFields = ['tax_return_id', 'user_id'];
      const baseValues = [taxReturnId, userId];

      if (hasUserEmail) {
        baseFields.push('user_email');
        baseValues.push(userEmail);
      }

      if (hasTaxYearId) {
        baseFields.push('tax_year_id');
        baseValues.push(taxYearId);
      }

      if (hasTaxYear) {
        baseFields.push('tax_year');
        baseValues.push(taxYear);
      }

      baseFields.push('updated_at');
      baseValues.push(new Date());

      const fieldNames = [...baseFields, ...updateableFields];
      const values = [...baseValues, ...updateableFields.map(field => formData[field])];
      const placeholders = fieldNames.map((_, index) => `$${index + 1}`).join(', ');

      const insertQuery = `
        INSERT INTO ${tableName} (${fieldNames.join(', ')})
        VALUES (${placeholders})
      `;

      await client.query(insertQuery, values);
    }
  }

  // Define form configurations with field mappings
  getFormConfigurations() {
    return {
      income_forms: {
        sheetName: 'Income',
        fields: {
          annual_basic_salary: { label: 'Annual Basic Salary', description: 'Annual basic salary (B6)', excelCell: 'B6' },
          allowances: { label: 'Allowances (excluding bonus and medical allowance)', description: 'Annual allowances (B7)', excelCell: 'B7' },
          bonus: { label: 'Bonus', description: 'Annual bonus (B8)', excelCell: 'B8' },
          medical_allowance: { label: 'Medical allowance (Where medical facility not provided by employer)', description: 'Medical allowance (B9)', excelCell: 'B9' },
          pension_from_ex_employer: { label: 'Pension received from ex-employer', description: 'Pension from ex-employer (B10)', excelCell: 'B10' },
          employment_termination_payment: { label: 'Employment Termination payment (Section 12 (2) e iii)', description: 'Employment termination payment (B11)', excelCell: 'B11' },
          retirement_from_approved_funds: { label: 'Amount received on retirement from approved funds (Provident, pension, gratuity)', description: 'Retirement from approved funds (B12)', excelCell: 'B12' },
          directorship_fee: { label: 'Directorship Fee u/s 149(3)', description: 'Directorship fee (B13)', excelCell: 'B13' },
          other_cash_benefits: { label: 'Other cash benefits (LFA, Children education, etc.)', description: 'Other cash benefits (B14)', excelCell: 'B14' },
          income_exempt_from_tax: { label: 'Income Exempt from tax', description: 'Income exempt from tax (B15)', excelCell: 'B15', calculated: true },
          annual_salary_wages_total: { label: 'Annual Salary and Wages', description: 'Annual salary and wages total (B16)', excelCell: 'B16', calculated: true },
          employer_contribution_provident: { label: 'Employer Contribution to Approved Provident Funds', description: 'Employer contribution to provident funds (B19)', excelCell: 'B19' },
          taxable_car_value: { label: 'Taxable value of Car provided by employer', description: 'Taxable car value (B20)', excelCell: 'B20' },
          other_taxable_subsidies: { label: 'Other taxable subsidies and non cash benefits', description: 'Other taxable subsidies (B21)', excelCell: 'B21' },
          non_cash_benefit_exempt: { label: 'Non cash benefit exempt from tax', description: 'Non cash benefit exempt (B22)', excelCell: 'B22', calculated: true },
          total_non_cash_benefits: { label: 'Total non cash benefits', description: 'Total non cash benefits (B23)', excelCell: 'B23', calculated: true },
          profit_on_debt_15_percent: { label: 'Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)', description: 'Profit on debt 15% (B26)', excelCell: 'B26' },
          profit_on_debt_12_5_percent: { label: 'Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)', description: 'Profit on debt 12.5% (B27)', excelCell: 'B27' },
          other_income_min_tax_total: { label: 'Other Income Min Tax Total', description: 'Other income min tax total (B28)', excelCell: 'B28', calculated: true },
          other_taxable_income_rent: { label: 'Other taxable income - Rent income', description: 'Rent income (B31)', excelCell: 'B31' },
          other_taxable_income_others: { label: 'Other taxable income - Others', description: 'Other income (B32)', excelCell: 'B32' },
          other_income_no_min_tax_total: { label: 'Other taxable income - Total', description: 'Other income no min tax total (B33)', excelCell: 'B33', calculated: true }
        }
      },
      adjustable_tax_forms: {
        sheetName: 'Adjustable Tax',
        fields: {
          salary_employees_149_gross_receipt: { label: 'Salary of Employees u/s 149', description: 'Salary gross receipt (B5)', excelCell: 'B5' },
          salary_employees_149_tax_collected: { label: 'Salary Tax Collected', description: 'Tax collected on salary (C5)', excelCell: 'C5' },
          directorship_fee_149_3_gross_receipt: { label: 'Directorship Fee u/s 149(3)', description: 'Directorship fee gross receipt (B6)', excelCell: 'B6' },
          directorship_fee_149_3_tax_collected: { label: 'Directorship Fee Tax', description: 'Tax on directorship fee (C6)', excelCell: 'C6' },
          profit_debt_15_percent_gross_receipt: { label: 'Profit on Debt u/s 151 @ 15% (Profit on debt Exceeding Rs 5m)', description: 'Profit on debt 15% gross receipt (B7)', excelCell: 'B7' },
          profit_debt_15_percent_tax_collected: { label: 'Profit on Debt Tax 15%', description: 'Tax on profit on debt 15% (C7)', excelCell: 'C7' },
          sukook_12_5_percent_gross_receipt: { label: 'Profit on Debt u/s 151A @ 12.5% (Sukook Exceeding Rs 5m)', description: 'Sukook gross receipt (B8)', excelCell: 'B8' },
          sukook_12_5_percent_tax_collected: { label: 'Sukook Tax 12.5%', description: 'Tax on sukook 12.5% (C8)', excelCell: 'C8' },
          rent_section_155_gross_receipt: { label: 'Tax deducted on Rent received (Section 155)', description: 'Rent gross receipt (B9)', excelCell: 'B9' },
          rent_section_155_tax_collected: { label: 'Rent Tax', description: 'Tax on rent (C9)', excelCell: 'C9' },
          motor_vehicle_transfer_gross_receipt: { label: 'Motor Vehicle Transfer Fee u/s 231B(2)', description: 'Motor vehicle transfer gross receipt (B12)', excelCell: 'B12' },
          motor_vehicle_transfer_tax_collected: { label: 'Motor Vehicle Transfer Tax', description: 'Tax on motor vehicle transfer (C12)', excelCell: 'C12' },
          electricity_domestic_gross_receipt: { label: 'Electricity Bill of Domestic Consumer u/s 235', description: 'Electricity bill gross receipt (B15)', excelCell: 'B15' },
          electricity_domestic_tax_collected: { label: 'Electricity Bill Tax', description: 'Tax on electricity bills (C15)', excelCell: 'C15' },
          cellphone_bill_gross_receipt: { label: 'Cellphone Bill u/s 236(1)(a)', description: 'Cellphone bill gross receipt (B17)', excelCell: 'B17' },
          cellphone_bill_tax_collected: { label: 'Cellphone Tax', description: 'Tax on cellphone bills (C17)', excelCell: 'C17' }
        }
      },
      capital_gain_forms: {
        sheetName: 'Capital Gain',
        fields: {
          property_1_year: { label: 'Property (< 1 Year)', description: 'Property held for less than 1 year', excelCell: 'B5' },
          property_2_3_years: { label: 'Property (2-3 Years)', description: 'Property held for 2-3 years', excelCell: 'B6' },
          property_4_plus_years: { label: 'Property (4+ Years)', description: 'Property held for 4+ years', excelCell: 'B7' },
          securities: { label: 'Securities', description: 'Securities capital gains', excelCell: 'E17' },
          other_capital_gains: { label: 'Other Capital Gains', description: 'Other capital gains', excelCell: 'B18' },
          total_capital_gains: { label: 'Total Capital Gains', description: 'Total capital gains (E19)', excelCell: 'E19', calculated: true }
        }
      },
      wealth_forms: {
        sheetName: 'Wealth Statement',
        fields: {
          property_previous_year: { label: 'Property (Previous)', description: 'Property value previous year' },
          property_current_year: { label: 'Property (Current)', description: 'Property value current year' },
          investment_previous_year: { label: 'Investment (Previous)', description: 'Investment value previous year' },
          investment_current_year: { label: 'Investment (Current)', description: 'Investment value current year' },
          vehicle_previous_year: { label: 'Vehicle (Previous)', description: 'Vehicle value previous year' },
          vehicle_current_year: { label: 'Vehicle (Current)', description: 'Vehicle value current year' },
          cash_previous_year: { label: 'Cash (Previous)', description: 'Cash value previous year' },
          cash_current_year: { label: 'Cash (Current)', description: 'Cash value current year' }
        }
      },
      expenses_forms: {
        sheetName: 'Detail of Expenses',
        fields: {
          rent: { label: 'Rent', description: 'Rent expenses' },
          electricity: { label: 'Electricity', description: 'Electricity expenses' },
          vehicle: { label: 'Vehicle Expenses', description: 'Vehicle related expenses' },
          medical: { label: 'Medical Expenses', description: 'Medical expenses' },
          educational: { label: 'Educational Expenses', description: 'Educational expenses' },
          other_expenses: { label: 'Other Expenses', description: 'Other miscellaneous expenses' }
        }
      },
      credits_forms: {
        sheetName: 'Tax Reduction, Credit & deduct ',
        fields: {
          charitable_donation: { label: 'Charitable Donation', description: 'Charitable donations made' },
          pension_contribution: { label: 'Pension Contribution', description: 'Pension fund contributions' },
          life_insurance_premium: { label: 'Life Insurance Premium', description: 'Life insurance premiums paid' },
          investment_tax_credit: { label: 'Investment Tax Credit', description: 'Tax credits on investments' },
          other_credits: { label: 'Other Credits', description: 'Other tax credits' }
        }
      },
      deductions_forms: {
        sheetName: 'Tax Reduction, Credit & deduct ',
        fields: {
          zakat: { label: 'Zakat', description: 'Zakat deductions' },
          ushr: { label: 'Ushr', description: 'Ushr deductions' },
          tax_paid_foreign_country: { label: 'Foreign Tax Paid', description: 'Tax paid in foreign country' },
          advance_tax: { label: 'Advance Tax', description: 'Advance tax payments' },
          other_deductions: { label: 'Other Deductions', description: 'Other allowable deductions' }
        }
      },
      reductions_forms: {
        sheetName: 'Tax Reduction, Credit & deduct ',
        fields: {
          teacher_amount: { label: 'Teacher Amount', description: 'Income amount for teacher reduction' },
          teacher_reduction: { label: 'Teacher Reduction', description: 'Tax reduction for teachers' },
          behbood_reduction: { label: 'Behbood Reduction', description: 'Behbood Sahyogi scheme reduction' },
          export_income_reduction: { label: 'Export Income Reduction', description: 'Export income tax reduction' },
          industrial_undertaking_reduction: { label: 'Industrial Reduction', description: 'Industrial undertaking reduction' },
          other_reductions: { label: 'Other Reductions', description: 'Other tax reductions' }
        }
      },
      final_tax_forms: {
        sheetName: 'Income with Final Min tax',
        fields: {
          dividend_reit_spv: { label: 'Dividend u/s 150 @0% share of profit from REIT SPV', description: 'Dividend from REIT SPV (B3)', excelCell: 'B3' },
          dividend_other_spv: { label: 'Dividend u/s 150 @35% share of profit from other SPV', description: 'Dividend from other SPV (B4)', excelCell: 'B4' },
          dividend_ipp_shares: { label: 'Dividend u/s 150 @7.5% IPP Shares', description: 'Dividend from IPP shares (B5)', excelCell: 'B5' },
          dividend_in_kind: { label: 'Dividend u/s 150 @15% (Dividend in kind or Mutual funds with less than 50% profit on debt)', description: 'Dividend in kind (B6)', excelCell: 'B6' },
          dividend_bf_losses: { label: 'Dividend u/s 150 @25% (From Companies not paying tax due to BF losses or Mutual funds with 50% and above profit on debt)', description: 'Dividend from BF losses companies (B7)', excelCell: 'B7' },
          profit_on_debt_final: { label: 'Profit on debt u/s 151 @15%', description: 'Profit on debt final tax (B13)', excelCell: 'B13' },
          capital_gain_final: { label: 'Capital Gain', description: 'Capital gain from Capital Gain sheet (B19)', excelCell: 'B19' },
          total_final_tax_income: { label: 'Total Income Subject to Final Tax', description: 'Total final tax income (B20)', excelCell: 'B20', calculated: true }
        }
      },
      taxpayer_profile: {
        sheetName: 'Taxpayer profile',
        fields: {
          name: { label: 'Name', description: 'Taxpayer name', excelCell: 'B3' },
          nic: { label: 'NIC', description: 'National Identity Card number', excelCell: 'B4' },
          email: { label: 'Email', description: 'Email address', excelCell: 'B5' },
          mobile_phone: { label: 'Mobile Phone Number/Service provider', description: 'Mobile phone number', excelCell: 'B6' },
          major_source_income: { label: 'Major Source of Income', description: 'Primary income source', excelCell: 'B7' }
        }
      },
      tax_computation: {
        sheetName: 'Tax Computation',
        fields: {
          income_from_salary: { label: 'Income from Salary', description: 'Total salary income (B6)', excelCell: 'B6' },
          income_from_other_sources: { label: 'Income from Other Sources', description: 'Other income sources (B7)', excelCell: 'B7' },
          income_from_capital_gains: { label: 'Income from Capital Gains', description: 'Capital gains income (B8)', excelCell: 'B8' },
          total_income: { label: 'Total Income', description: 'Sum of all income (B9)', excelCell: 'B9', calculated: true },
          taxable_income_excluding_cg: { label: 'Taxable Income excluding CG', description: 'Taxable income without capital gains (B11)', excelCell: 'B11', calculated: true },
          normal_income_tax: { label: 'Normal Income Tax', description: 'Progressive tax calculation (B16)', excelCell: 'B16', calculated: true },
          surcharge: { label: 'Surcharge', description: 'Surcharge if income > 10M (B17)', excelCell: 'B17', calculated: true },
          capital_gains_tax: { label: 'Capital Gains Tax', description: 'Tax on capital gains (B18)', excelCell: 'B18' },
          total_tax_before_adjustments: { label: 'Total Tax before adjustments', description: 'Total tax before reductions (B19)', excelCell: 'B19', calculated: true },
          net_tax_payable: { label: 'Net Tax Payable', description: 'Final tax liability (B28)', excelCell: 'B28', calculated: true },
          balance_payable_refundable: { label: 'Balance Payable/Refundable', description: 'Final balance due or refund (B30)', excelCell: 'B30', calculated: true }
        }
      },
      wealth_reconciliation: {
        sheetName: 'Wealth Recon',
        fields: {
          net_worth_previous_year: { label: 'Net Worth Previous Year', description: 'Net worth from previous year (B5)', excelCell: 'B5' },
          net_worth_current_year: { label: 'Net Worth Current Year', description: 'Net worth current year (B6)', excelCell: 'B6' },
          wealth_increase: { label: 'Wealth Increase', description: 'Increase in wealth (B7)', excelCell: 'B7', calculated: true },
          total_income_sources: { label: 'Total Income from all Sources', description: 'All income sources (B21)', excelCell: 'B21', calculated: true },
          total_expenses: { label: 'Total Expenses', description: 'All expenses (B27)', excelCell: 'B27', calculated: true },
          net_cash_flow: { label: 'Net Cash Flow', description: 'Income minus expenses (B29)', excelCell: 'B29', calculated: true },
          unexplained_wealth: { label: 'Unexplained Wealth', description: 'Wealth increase not explained by income (B31)', excelCell: 'B31', calculated: true }
        }
      }
    };
  }
}

module.exports = ExcelService;