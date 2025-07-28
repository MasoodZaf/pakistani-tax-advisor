const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { pool } = require('./config/database');

// Initialize Express app
const app = express();

// Ensure required directories exist
const logsDir = path.join(__dirname, '..', 'logs');
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Configure logger first
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'app.log')
    })
  ]
});

// Log environment setup
logger.info('Environment variables loaded');
logger.info(`Node environment: ${process.env.NODE_ENV}`);
logger.info(`Server will run on: ${process.env.HOST}:${process.env.PORT}`);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Static files
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    // Get some basic stats
    const dbStats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM tax_years) as tax_years_count,
        (SELECT COUNT(*) FROM income_forms) as income_forms_count
    `);

    res.json({
      status: 'success',
      message: 'Server is healthy',
      database: {
        connected: true,
        timestamp: result.rows[0].now,
        stats: dbStats.rows[0]
      },
      server: {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      },
      theme: {
        primary: process.env.THEME_COLOR_PRIMARY || '#00A651',
        secondary: process.env.THEME_COLOR_SECONDARY || '#FFFFFF'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
}); 