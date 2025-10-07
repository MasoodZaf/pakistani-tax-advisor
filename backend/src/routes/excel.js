const express = require('express');
const multer = require('multer');
const ExcelService = require('../services/excelService');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx) files are allowed'), false);
    }
  }
});

// Middleware to verify session token authentication
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
      message: 'Internal server error during authentication'
    });
  }
};

// Export tax return as Excel workbook
router.get('/export/:taxYear', requireAuth, async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    logger.info(`Excel export requested for user ${userId}, tax year ${taxYear}`);

    // Verify tax return exists
    const taxReturnResult = await pool.query(
      'SELECT * FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    // Create Excel service and generate workbook
    const excelService = new ExcelService();
    const workbook = await excelService.exportTaxReturn(userId, taxYear);

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Tax_Return_${taxYear}_${req.user.name.replace(/\s+/g, '_')}.xlsx"`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    
    logger.info(`Excel export completed for user ${userId}, tax year ${taxYear}`);

  } catch (error) {
    logger.error('Excel export error:', error);
    res.status(500).json({
      error: 'Failed to export Excel file',
      message: error.message
    });
  }
});

// Import Excel workbook and update tax return data
router.post('/import/:taxYear', requireAuth, upload.single('excelFile'), async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select an Excel file to upload'
      });
    }

    logger.info(`Excel import requested for user ${userId}, tax year ${taxYear}`);

    // Verify tax return exists
    const taxReturnResult = await pool.query(
      'SELECT * FROM tax_returns WHERE user_id = $1 AND tax_year = $2',
      [userId, taxYear]
    );

    if (taxReturnResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tax return not found',
        message: 'No tax return found for the specified year'
      });
    }

    // Create Excel service and import data
    const excelService = new ExcelService();
    await excelService.importTaxReturn(userId, taxYear, req.file.buffer);

    // Log the import activity
    await pool.query(`
      INSERT INTO audit_log (user_id, user_email, action, table_name, change_summary, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      userId,
      req.userEmail,
      'EXCEL_IMPORT',
      'multiple_forms',
      `Excel workbook imported for tax year ${taxYear}`
    ]);

    res.json({
      success: true,
      message: 'Excel file imported successfully',
      data: {
        taxYear,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        importedAt: new Date().toISOString()
      }
    });

    logger.info(`Excel import completed for user ${userId}, tax year ${taxYear}`);

  } catch (error) {
    logger.error('Excel import error:', error);
    
    let errorMessage = 'Failed to import Excel file';
    let statusCode = 500;

    if (error.message.includes('Tax return not found')) {
      statusCode = 404;
      errorMessage = 'Tax return not found';
    } else if (error.message.includes('Invalid file format')) {
      statusCode = 400;
      errorMessage = 'Invalid Excel file format';
    }

    res.status(statusCode).json({
      error: errorMessage,
      message: error.message
    });
  }
});

// Get import/export history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const historyResult = await pool.query(`
      SELECT 
        action,
        change_summary as description,
        created_at
      FROM audit_log 
      WHERE user_id = $1 AND (action = 'EXCEL_IMPORT' OR action = 'EXCEL_EXPORT')
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({
      success: true,
      data: historyResult.rows,
      message: 'Import/export history retrieved successfully'
    });

  } catch (error) {
    logger.error('History retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve history',
      message: 'Internal server error'
    });
  }
});

// Validate Excel file before import (preview)
router.post('/validate/:taxYear', requireAuth, upload.single('excelFile'), async (req, res) => {
  try {
    const { taxYear } = req.params;
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select an Excel file to validate'
      });
    }

    // Create Excel service and validate file
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const validation = {
      valid: true,
      warnings: [],
      errors: [],
      sheets: [],
      summary: {
        totalSheets: workbook.worksheets.length,
        validSheets: 0,
        missingSheets: 0
      }
    };

    // Expected sheets (matching "Salaried Individuals 2025.xlsx" exactly)
    const expectedSheets = [
      'Taxpayer profile',
      'Income',
      'Adjustable Tax',
      'Income with Final Min tax',
      'Capital Gain',
      'Tax Computation',
      'Tax Reduction, Credit & deduct ',
      'Detail of Expenses',
      'Wealth Statement',
      'Wealth Recon'
    ];

    // Validate each expected sheet
    expectedSheets.forEach(sheetName => {
      const worksheet = workbook.getWorksheet(sheetName);
      if (worksheet) {
        validation.sheets.push({
          name: sheetName,
          exists: true,
          rowCount: worksheet.rowCount,
          columnCount: worksheet.columnCount
        });
        validation.summary.validSheets++;
      } else {
        validation.sheets.push({
          name: sheetName,
          exists: false,
          rowCount: 0,
          columnCount: 0
        });
        validation.summary.missingSheets++;
        validation.warnings.push(`Sheet "${sheetName}" is missing`);
      }
    });

    // Check for unexpected sheets
    workbook.worksheets.forEach(worksheet => {
      if (!expectedSheets.includes(worksheet.name)) {
        validation.warnings.push(`Unexpected sheet found: "${worksheet.name}"`);
      }
    });

    if (validation.summary.missingSheets > 0) {
      validation.warnings.push(`${validation.summary.missingSheets} expected sheets are missing`);
    }

    res.json({
      success: true,
      data: validation,
      message: 'File validation completed'
    });

  } catch (error) {
    logger.error('Excel validation error:', error);
    res.status(400).json({
      error: 'Invalid Excel file',
      message: error.message
    });
  }
});

module.exports = router;