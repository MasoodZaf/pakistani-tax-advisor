require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const taxFormsRoutes = require('./routes/taxForms');

// Initialize Express app
const app = express();

// Enable CORS for all origins in development
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Mount routes
app.use('/api', authRoutes);
app.use('/api', taxFormsRoutes); // Changed from /api/forms to /api to match frontend

// Basic health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    res.json({
      status: 'success',
      message: 'Server is healthy',
      database: {
        connected: true,
        timestamp: result.rows[0].now
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message
    });
  }
});

// Add a root endpoint for easy testing
app.get('/', (req, res) => {
  res.json({
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
        income: '/api/forms/income/:taxYear',
        completionStatus: '/api/forms/completion-status/:taxYearId'
      }
    }
  });
});

const PORT = 3001;  // Using 3001 since 3000 is used by system ControlCenter
const HOST = 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Try accessing:`);
  console.log(`1. http://${HOST}:${PORT}`);
  console.log(`2. http://${HOST}:${PORT}/api/health`);
});
