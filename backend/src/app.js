require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const excelRoutes = require('./routes/excel');
const systemSettingsRoutes = require('./routes/systemSettings');
const personalInfoRoutes = require('./routes/personalInfo');
const testDataRoutes = require('./routes/testData');

// Module imports
const incomeTaxModule = require('./modules/IncomeTax');
const wealthStatementModule = require('./modules/WealthStatement');
const adminModule = require('./modules/Admin');

// Legacy routes (still needed for compatibility)
const incomeFormRoutes = require('./routes/incomeForm');
const adminRoutes = require('./routes/admin');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Configure CORS with security considerations
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com', // Add your production domain here
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Rate limiting for authentication endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // Higher limit for development
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Serve static files (for test interface)
app.use(express.static('public'));

// Mount routes with rate limiting on auth endpoints
app.use('/api', loginLimiter, authRoutes);
app.use('/api/reports', reportsRoutes); // Reports API routes
app.use('/api/excel', excelRoutes); // Excel import/export routes
app.use('/api/admin/system-settings', systemSettingsRoutes); // System settings routes
app.use('/api/personal-info', personalInfoRoutes); // Personal information routes
app.use('/api/test', testDataRoutes); // Test data population routes

// Mount modular routes
app.use('/api/income-tax', incomeTaxModule); // Income Tax module
app.use('/api/wealth-statement', wealthStatementModule); // Wealth Statement module
app.use('/api/admin', adminModule); // Admin module

// Legacy API routes (direct routes for compatibility)
app.use('/api/income-form', incomeFormRoutes); // Direct income form routes

// Import and mount tax forms routes
const taxFormsRoutes = require('./modules/IncomeTax/routes/taxForms');
app.use('/api/tax-forms', taxFormsRoutes); // Tax forms API routes

// Keep admin routes for now (until moved to Admin module)
app.use('/api/old-admin', adminRoutes); // Legacy admin routes

// Tax Computation routes (Inter-form data linking)
try {
  const taxComputationRoutes = require('./routes/taxComputation');
  app.use('/api/tax-computation', taxComputationRoutes); // Tax computation with Excel linking
} catch (error) {
  logger.warn('Tax computation routes not loaded:', error.message);
}

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
      },
      taxComputation: {
        calculate: '/api/tax-computation/:taxYear',
        summary: '/api/tax-computation/:taxYear/summary',
        incomeData: '/api/tax-computation/:taxYear/income-data',
        adjustableData: '/api/tax-computation/:taxYear/adjustable-data',
        updateLinks: '/api/tax-computation/:taxYear/update-links'
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
