require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const excelRoutes = require('./routes/excel');
const systemSettingsRoutes = require('./routes/systemSettings');
const personalInfoRoutes = require('./routes/personalInfo');
const testDataRoutes = require('./routes/testData');
const taxHistoryRoutes = require('./routes/taxHistory');
const taxYearRoutes = require('./routes/taxYear');
const aiConsultantRoutes = require('./routes/aiConsultant');
const aiKnowledgeBase = require('./services/aiConsultant/knowledgeBase');
const mobileApiRoutes = require('./routes/mobileApi');
const wizardRoutes = require('./routes/wizard');

// Module imports
const incomeTaxModule = require('./modules/IncomeTax');
const wealthStatementModule = require('./modules/WealthStatement');
const adminModule = require('./modules/Admin');

// Legacy routes (still needed for compatibility)
const incomeFormRoutes = require('./routes/incomeForm');
const logger = require('./utils/logger');
const { expressErrorHandler } = require('./utils/sendError');
const sentry = require('./utils/sentry');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.stack || reason });
  sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err?.message, stack: err?.stack });
  sentry.captureException(err);
});

// Initialize Express app
const app = express();

// Trust the reverse proxy (Render/Railway/nginx) so req.ip reflects the real
// client, not the proxy — essential for rate limiting.
app.set('trust proxy', 1);

// Security headers (CSP, X-Frame-Options, etc.) + gzip compression.
app.use(helmet());
app.use(compression());

// Configure CORS with security considerations (SEC-05).
//
// Auth is via the `Authorization: Bearer` header, not cookies, so a no-Origin
// request cannot ride a victim's session (CSRF needs a browser, and browsers
// always send Origin). We therefore allow no-Origin for the legitimate
// non-browser callers — the Expo mobile app (RN fetch omits Origin), curl, and
// health checks — while still enforcing a strict allowlist for every browser
// origin. The dev localhost origin is only added outside production so it can't
// be used as an allowed origin against the live API.
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : []),
      ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: blocked disallowed origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// Parse JSON bodies — explicit size limit to cap DoS surface.
app.use(express.json({ limit: '1mb' }));

// Defense-in-depth (SEC-06): in production, never let a 5xx response body leak
// internal detail. Many handlers still build their own bodies with
// `error: err.message` / `message: err.message` / `{ status:'error', error }`
// instead of going through sendError(). Rather than strip a single field (which
// missed `message:`-style leaks and nested SQL/stack text), replace the WHOLE
// 5xx body with a canonical generic envelope. The full error is still logged
// server-side and shipped to Sentry by sendError/the global handler.
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 500) {
        const safe = { success: false, message: 'Internal server error' };
        // Preserve a correlation id if the handler set one (sendError does) so
        // support can still tie a user report to the server-side log entry.
        if (body && typeof body === 'object' && body.requestId) safe.requestId = body.requestId;
        return originalJson(safe);
      }
      return originalJson(body);
    };
    next();
  });
}

// Rate limiting — env-tunable. Defaults keep prod strict, dev workable, and
// E2E / CI runs can bump further via LOGIN_RATE_LIMIT_MAX / API_RATE_LIMIT_MAX.
const isProd = process.env.NODE_ENV === 'production';
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || (isProd ? 5 : 1000),
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || (isProd ? 60 : 5000),
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});

// Rate limiting — file uploads (very strict)
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { success: false, message: 'Too many upload requests. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve static files (for test interface)
app.use(express.static('public'));

// ── Route mounting ──────────────────────────────────────────────────────────
// Auth: only /login, /register and the SSO endpoints get the strict
// anti-brute-force limit. SSO endpoints accept ID tokens, so they need the
// same throttle to prevent token-verification grinding and email enumeration.
// /api/sso covers /sso/google, /sso/apple, /sso/link/*, /sso/unlink, /sso/status.
app.use(['/api/login', '/api/register', '/api/sso', '/api/verify-session', '/api/forgot-password', '/api/reset-password'], loginLimiter);
app.use('/api', authRoutes);
// Self-service password reset (forgot-password / reset-password) — same strict
// login limiter applied above.
app.use('/api', require('./routes/passwordReset'));

// Public read-only info (tax year config) — no auth, no throttle needed
app.use('/api/tax-year', taxYearRoutes);

// Standard authenticated read/write routes — API write limiter
app.use('/api/reports',           apiWriteLimiter, reportsRoutes);
app.use('/api/personal-info',     apiWriteLimiter, personalInfoRoutes);
app.use('/api/consultant-link',   apiWriteLimiter, require('./routes/consultantLink'));
app.use('/api/notifications',     apiWriteLimiter, require('./routes/notifications'));
app.use('/api/agreements',        apiWriteLimiter, require('./routes/agreements'));
app.use('/api/admin/system-settings', apiWriteLimiter, systemSettingsRoutes);
app.use('/api/admin/email-test',  apiWriteLimiter, require('./routes/emailTest'));

// File upload routes — strict upload limiter
app.use('/api/excel',       uploadLimiter, excelRoutes);
app.use('/api/tax-history', uploadLimiter, taxHistoryRoutes);

// Test data routes — gated behind explicit ENABLE_TEST_ROUTES=true AND super_admin auth.
// Never auto-enabled by NODE_ENV alone; staging/preview deploys must opt in explicitly.
if (process.env.ENABLE_TEST_ROUTES === 'true') {
  logger.warn('Test data routes ENABLED — requires super_admin authentication');
  app.use('/api/test', testDataRoutes);
}

// Modular routes — API write limiter
app.use('/api/income-tax',        apiWriteLimiter, incomeTaxModule);
app.use('/api/wealth-statement',  apiWriteLimiter, wealthStatementModule);
app.use('/api/admin',             apiWriteLimiter, adminModule);

// Legacy income form routes (still used by IncomeForm.js)
app.use('/api/income-form', apiWriteLimiter, incomeFormRoutes);

// Tax forms module routes
const taxFormsRoutes = require('./modules/IncomeTax/routes/taxForms');
app.use('/api/tax-forms', apiWriteLimiter, taxFormsRoutes);

// Mobile-specific API surface. Offline-first sync, batched expense writes,
// receipt uploads. See docs/mobile-expenses-design.md.
// Same write limiter as the rest; receipt upload is throttled separately
// inside the route via uploadLimiter when wired up.
app.use('/api/mobile/v1', apiWriteLimiter, mobileApiRoutes);

// AI tax consultant — DeepSeek-backed chat + form helper.
// Same write limiter; the route module short-circuits when DEEPSEEK_API_KEY
// isn't set so the rest of the app keeps working without it.
app.use('/api/ai-consultant', apiWriteLimiter, aiConsultantRoutes);

// AI quick-start wizard — short conversational intake that populates form
// drafts and returns a rough tax estimate. Auth + rate limit applied at
// the route file (jwtAuth) and here (apiWriteLimiter).
app.use('/api/wizard', apiWriteLimiter, wizardRoutes);

// Tax Computation routes (Inter-form data linking).
// `apiWriteLimiter` is applied even on the read endpoints — the
// computation runs are CPU-heavy (slab walks, surcharge math, super-tax
// brackets) so the same throttle the other write surfaces use is the
// right one here too.
try {
  const taxComputationRoutes = require('./routes/taxComputation');
  app.use('/api/tax-computation', apiWriteLimiter, taxComputationRoutes);
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
    message: 'Welcome to MeraTax API',
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

// Global error handler — MUST be last middleware. Strips error.message from 5xx in prod.
app.use(expressErrorHandler);

const PORT = process.env.PORT || 3001;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

const server = app.listen(PORT, HOST, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info('Try accessing:');
  logger.info(`1. http://${HOST}:${PORT}`);
  logger.info(`2. http://${HOST}:${PORT}/api/health`);

  // Warm up the AI consultant knowledge base in the background. Failure
  // is non-fatal — the chat routes degrade to "no KB context" rather than
  // 500ing the rest of the server.
  aiKnowledgeBase.loadAll().catch((e) =>
    logger.warn('AI knowledge base initial load failed', { message: e.message })
  );

  // Daily background jobs (tax-year rollover, Finance Act admin reminder).
  try {
    require('./services/cron').startSchedulers();
  } catch (e) {
    logger.error('cron bootstrap failed', { message: e.message });
  }
});

function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop cron timers BEFORE closing the server so no new background jobs
  // (rollover, reminder, backup) fire mid-shutdown. In-flight runs keep
  // executing — the event loop won't exit until they return.
  try {
    require('./services/cron').stopSchedulers();
  } catch (e) {
    logger.error('cron shutdown failed', { message: e?.message });
  }

  server.close(async () => {
    // Close the shared PDF browser (PERF-01 pool) so no Chromium lingers.
    try {
      await require('./services/pdf/browserPool').closeBrowser();
    } catch (e) {
      logger.error('Error closing PDF browser', { message: e?.message });
    }
    try {
      await pool.end();
      logger.info('DB pool closed');
    } catch (e) {
      logger.error('Error closing DB pool', { message: e?.message });
    }
    // Flush any pending Sentry events before exiting.
    await sentry.flush(2000);
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
