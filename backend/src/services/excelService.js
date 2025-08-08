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
    const worksheet = this.workbook.addWorksheet('User Details', {
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

      // Get tax return ID
      const taxReturnResult = await pool.query(
        'SELECT id FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
        [userId, taxYear]
      );

      if (taxReturnResult.rows.length === 0) {
        throw new Error('Tax return not found');
      }

      const taxReturnId = taxReturnResult.rows[0].id;
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
            await this.updateFormData(client, tableName, taxReturnId, userId, formData);
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
  async updateFormData(client, tableName, taxReturnId, userId, formData) {
    const fields = Object.keys(formData);
    if (fields.length === 0) return;

    // First check if record exists
    const existingResult = await client.query(
      `SELECT id FROM ${tableName} WHERE tax_return_id = $1 AND user_id = $2`,
      [taxReturnId, userId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing record
      const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
      const values = [taxReturnId, userId, ...fields.map(field => formData[field])];

      const updateQuery = `
        UPDATE ${tableName} 
        SET ${setClause}, updated_at = NOW()
        WHERE tax_return_id = $1 AND user_id = $2
      `;

      await client.query(updateQuery, values);
    } else {
      // Insert new record
      const fieldNames = ['tax_return_id', 'user_id', 'updated_at', ...fields];
      const values = [taxReturnId, userId, new Date(), ...fields.map(field => formData[field])];
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
        sheetName: 'Income Details',
        fields: {
          monthly_salary: { label: 'Monthly Salary', description: 'Monthly salary income' },
          bonus: { label: 'Bonus', description: 'Annual bonus received' },
          car_allowance: { label: 'Car Allowance', description: 'Car allowance received' },
          other_taxable: { label: 'Other Taxable Income', description: 'Other taxable income sources' },
          medical_allowance: { label: 'Medical Allowance', description: 'Medical allowance (exempt)' },
          employer_contribution: { label: 'Employer Contribution', description: 'Employer contribution to fund' },
          other_exempt: { label: 'Other Exempt Income', description: 'Other exempt income sources' },
          other_sources: { label: 'Other Sources', description: 'Other income sources' }
        }
      },
      adjustable_tax_forms: {
        sheetName: 'Adjustable Tax',
        fields: {
          salary_employees_149_tax_collected: { label: 'Salary Tax Collected', description: 'Tax collected on salary' },
          directorship_fee_149_3_tax_collected: { label: 'Directorship Fee Tax', description: 'Tax on directorship fee' },
          electricity_bill_domestic_235_tax_collected: { label: 'Electricity Bill Tax', description: 'Tax on electricity bills' },
          telephone_bill_236_1e_tax_collected: { label: 'Telephone Tax', description: 'Tax on telephone bills' },
          cellphone_bill_236_1f_tax_collected: { label: 'Cellphone Tax', description: 'Tax on cellphone bills' }
        }
      },
      capital_gain_forms: {
        sheetName: 'Capital Gains',
        fields: {
          property_1_year: { label: 'Property (< 1 Year)', description: 'Property held for less than 1 year' },
          property_2_3_years: { label: 'Property (2-3 Years)', description: 'Property held for 2-3 years' },
          property_4_plus_years: { label: 'Property (4+ Years)', description: 'Property held for 4+ years' },
          securities: { label: 'Securities', description: 'Securities capital gains' },
          other_capital_gains: { label: 'Other Capital Gains', description: 'Other capital gains' }
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
        sheetName: 'Expenses',
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
        sheetName: 'Tax Credits',
        fields: {
          charitable_donation: { label: 'Charitable Donation', description: 'Charitable donations made' },
          pension_contribution: { label: 'Pension Contribution', description: 'Pension fund contributions' },
          life_insurance_premium: { label: 'Life Insurance Premium', description: 'Life insurance premiums paid' },
          investment_tax_credit: { label: 'Investment Tax Credit', description: 'Tax credits on investments' },
          other_credits: { label: 'Other Credits', description: 'Other tax credits' }
        }
      },
      deductions_forms: {
        sheetName: 'Tax Deductions',
        fields: {
          zakat: { label: 'Zakat', description: 'Zakat deductions' },
          ushr: { label: 'Ushr', description: 'Ushr deductions' },
          tax_paid_foreign_country: { label: 'Foreign Tax Paid', description: 'Tax paid in foreign country' },
          advance_tax: { label: 'Advance Tax', description: 'Advance tax payments' },
          other_deductions: { label: 'Other Deductions', description: 'Other allowable deductions' }
        }
      },
      reductions_forms: {
        sheetName: 'Tax Reductions',
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
        sheetName: 'Final Tax',
        fields: {
          sukuk_amount: { label: 'Sukuk Amount', description: 'Investment in Sukuk' },
          debt_amount: { label: 'Debt Amount', description: 'Investment in debt securities' },
          prize_bonds: { label: 'Prize Bonds', description: 'Prize bonds held' },
          other_final_tax_amount: { label: 'Other Final Tax', description: 'Other final tax amounts' }
        }
      }
    };
  }
}

module.exports = ExcelService;