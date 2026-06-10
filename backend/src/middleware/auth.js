const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Set it in your .env or deploy config — no default will be used.'
  );
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}
const JWT_SECRET = process.env.JWT_SECRET;

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token — pin the algorithm so a token forged with alg:none or an
    // asymmetric-key confusion attack (RS256→HS256) can't be accepted. We only
    // ever sign with the HS256 default, so verification must require it too.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    // Get user from database
    const userResult = await pool.query(
      'SELECT id, name, email, role, user_type, token_version, must_reset_password FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Revocation check (SEC-01): a token only stays valid while its embedded
    // token_version matches the user's current one. Bumping the column (on
    // password change) invalidates every previously-issued token. Tokens minted
    // before this feature — and short-lived admin/impersonation tokens — carry
    // no token_version; we skip the check for them so deploying this doesn't log
    // everyone out (they expire on their own 24h TTL).
    const u = userResult.rows[0];
    if (decoded.token_version !== undefined && decoded.token_version !== u.token_version) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please sign in again.'
      });
    }

    // Add user to request object
    req.user = u;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

module.exports = auth;