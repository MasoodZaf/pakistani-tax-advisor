require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const taxFormsRoutes = require('./routes/taxForms');
const adjustableTaxFormsRoutes = require('./routes/adjustableTaxForms');
const comprehensiveIncomeFormsRoutes = require('./routes/comprehensiveIncomeForms');
const reportsRoutes = require('./routes/reports');
const excelRoutes = require('./routes/excel');
const adminRoutes = require('./routes/admin');
const systemSettingsRoutes = require('./routes/systemSettings');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Enable CORS for all origins in development
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Mount routes
app.use('/api', authRoutes);
app.use('/api/tax-forms', taxFormsRoutes); // Mount tax forms routes at /api/tax-forms
app.use('/api/tax-forms/adjustable-tax', adjustableTaxFormsRoutes); // Enhanced adjustable tax routes
app.use('/api/tax-forms/comprehensive-income', comprehensiveIncomeFormsRoutes); // Comprehensive income routes
app.use('/api/reports', reportsRoutes); // Reports API routes
app.use('/api/excel', excelRoutes); // Excel import/export routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/system-settings', systemSettingsRoutes); // System settings routes

// Basic health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    const response = {
      status: 'success',
      message: 'Server is healthy',
      database: {
        connected: true,
        timestamp: result.rows[0].now
      }
    };

    logger.info('Health check successful', response);
    res.json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message
    });
  }
});

// Add a root endpoint for easy testing
app.get('/', (req, res) => {
  const response = {
    message: 'Welcome to Pakistani Tax Advisor API',
    endpoints: {
      health: '/api/health',
      auth: {
        register: '/api/register',
        login: '/api/login'
      },
      forms: {
        taxYears: '/api/tax-years',
        employers: '/api/employers',
        taxData: '/api/tax-data/:taxYear',
        income: '/api/forms/income/:taxYear',
        completionStatus: '/api/forms/completion-status/:taxYearId'
      },
      reports: {
        taxCalculationSummary: '/api/reports/tax-calculation-summary/:taxYear',
        incomeAnalysis: '/api/reports/income-analysis/:taxYear',
        adjustableTaxReport: '/api/reports/adjustable-tax-report/:taxYear',
        wealthReconciliation: '/api/reports/wealth-reconciliation/:taxYear',
        availableYears: '/api/reports/available-years'
      },
      excel: {
        export: '/api/excel/export/:taxYear',
        import: '/api/excel/import/:taxYear',
        validate: '/api/excel/validate/:taxYear',
        history: '/api/excel/history'
      }
    }
  };
  
  logger.info('Root endpoint accessed');
  res.json(response);
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info('Try accessing:');
  logger.info(`1. http://${HOST}:${PORT}`);
  logger.info(`2. http://${HOST}:${PORT}/api/health`);
});
