require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const taxFormsRoutes = require('./routes/taxForms');
const adminRoutes = require('./routes/admin');
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
app.use('/api/admin', adminRoutes);

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
      }
    }
  };
  
  logger.info('Root endpoint accessed');
  res.json(response);
});

const PORT = 3001;  // Using 3001 since 3000 is used by system ControlCenter
const HOST = 'localhost';

app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info('Try accessing:');
  logger.info(`1. http://${HOST}:${PORT}`);
  logger.info(`2. http://${HOST}:${PORT}/api/health`);
});
