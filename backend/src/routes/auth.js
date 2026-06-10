const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const jwtAuth = require('../middleware/auth'); // JWT middleware for protected routes
const validate = require('../middleware/validate');
const { insertAudit } = require('../helpers/auditLog');
const { validatePasswordPolicy, BCRYPT_ROUNDS, DUMMY_BCRYPT_HASH } = require('../helpers/passwordPolicy');
const oidc = require('../services/oidcVerifier');

const router = express.Router();

// ── Validation schemas ──────────────────────────────────────────────────────
// Password complexity is enforced separately via validatePasswordPolicy so
// the message text stays under one source of truth.
const registerSchema = z.object({
  email:    z.string().trim().toLowerCase().email().max(254),
  name:     z.string().trim().min(1).max(120),
  password: z.string().min(1), // policy check happens in handler
  cnic:     z.string().trim().regex(/^\d{5}-?\d{7}-?\d$/).optional().nullable(),
  phone:    z.string().trim().max(20).optional().nullable(),
}).strip();

const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email(),
  password: z.string().min(1).optional(), // optional for admin-assisted login
  adminBypassToken: z.string().optional(),
}).strip();

const verifySessionSchema = z.object({
  sessionToken: z.string().min(1),
}).strip();

// User Registration
router.post('/register', validate(registerSchema), async (req, res) => {
  const client = await pool.connect();

  // ROLLBACK + return helper. Early returns inside the BEGIN block must NOT
  // skip the rollback — relying on `client.release()` to clear the txn is a
  // landmine if anyone later moves the release point or adds work after the
  // early return. Use this for every non-error early exit below.
  const abort = async (status, body) => {
    try { await client.query('ROLLBACK'); } catch { /* already aborted */ }
    return res.status(status).json(body);
  };

  try {
    await client.query('BEGIN');

    const { email, name, password, user_type = 'individual' } = req.body;

    if (!email || !name || !password) {
      return abort(400, { error: 'Email, name, and password are required' });
    }

    const policy = validatePasswordPolicy(password, { email });
    if (!policy.ok) {
      return abort(400, { error: 'Password does not meet policy', message: policy.message });
    }

    // Check if user already exists by email
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return abort(409, { error: 'User with this email already exists' });
    }

    // Check if user with same name already exists. Return a generic 409 —
    // leaking the existing user's email is a PII enumeration vector (an
    // attacker can iterate common names to harvest registered emails).
    const existingName = await client.query(
      'SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = true',
      [name]
    );

    if (existingName.rows.length > 0) {
      return abort(409, {
        error: 'Name already in use',
        message: 'Please choose a different name.'
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    // Create user. onboarding_completed defaults to false — flipped to true
    // by the wizard's final step so returning users skip the flow.
    const userResult = await client.query(`
      INSERT INTO users (email, name, password_hash, user_type, role, is_active)
      VALUES ($1, $2, $3, $4, 'user', true)
      RETURNING id, email, name, user_type, role, onboarding_completed
    `, [email, name, passwordHash, user_type]);
    
    const newUser = userResult.rows[0];
    
    // Get current tax year
    const taxYearResult = await client.query(`
      SELECT id, tax_year FROM tax_years WHERE is_current = true AND is_active = true
    `);
    
    if (taxYearResult.rows.length === 0) {
      throw new Error('No current tax year found');
    }
    
    const currentTaxYear = taxYearResult.rows[0];
    
    // Create tax return for current year
    const returnResult = await client.query(`
      INSERT INTO tax_returns (
        user_id, user_email, tax_year_id, tax_year,
        return_number, filing_status, filing_type
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', 'normal')
      RETURNING id
    `, [
      newUser.id,
      newUser.email,
      currentTaxYear.id,
      currentTaxYear.tax_year,
      // Full UUID — 8-char prefix has a ~77k-user birthday collision bound.
      `TR-${newUser.id}-${currentTaxYear.tax_year}`
    ]);
    
    const taxReturnId = returnResult.rows[0].id;
    
    // Initialize form tables for current year
    const formTables = [
      'income_forms',
      'adjustable_tax_forms',
      'reductions_forms',
      'credits_forms',
      'deductions_forms',
      'final_tax_forms',
      'capital_gain_forms',
      'expenses_forms',
      'wealth_forms',
      'final_min_income_forms',
      'wealth_reconciliation_forms',
      'tax_computation_forms',
      'form_completion_status'
    ];
    
    // Placeholder rows — concurrent registration retries can race here, so
    // DO NOTHING on the (user_id, tax_year) unique constraint added in the
    // phase-d migration. Avoids the duplicate-row pattern we saw in
    // adjustable_tax_forms.
    for (const tableName of formTables) {
      await client.query(`
        INSERT INTO ${tableName} (
          tax_return_id, user_id, user_email,
          tax_year_id, tax_year
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, tax_year) DO NOTHING
      `, [taxReturnId, newUser.id, newUser.email, currentTaxYear.id, currentTaxYear.tax_year]);
    }
    
    await client.query('COMMIT');

    // Issue JWT so the frontend can log the user in immediately after registration
    const jwt = require('jsonwebtoken');
    const jwtToken = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        onboarding_completed: newUser.onboarding_completed,
        token_version: newUser.token_version ?? 0
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info(`User registered successfully: ${email}`);

    res.json({
      success: true,
      message: 'User registered successfully',
      token: jwtToken,
      user: newUser,
      currentTaxYear: currentTaxYear.tax_year
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Registration error:', error);
    // Don't leak the raw DB/JS error to the client — prod sanitizer would strip
    // it anyway, but being explicit here keeps dev behaviour generic too.
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// User Login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password, adminBypassToken } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check for admin bypass token
    let isAdminAssisted = false;
    let adminInfo = null;
    
    if (adminBypassToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(adminBypassToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });

        if (decoded.admin_assisted && decoded.user_email === email) {
          // Single-use enforcement (SEC-02): the bypass token must carry a jti
          // and may only be redeemed once. Record it atomically — ON CONFLICT
          // DO NOTHING means a replay inserts 0 rows and is rejected.
          if (!decoded.jti) {
            logger.warn(`Admin bypass token without jti rejected for ${email}`);
            return res.status(401).json({ error: 'Invalid or expired admin bypass token' });
          }
          const consume = await pool.query(
            `INSERT INTO consumed_tokens (jti, purpose, expires_at)
             VALUES ($1, 'admin_assisted_login', to_timestamp($2))
             ON CONFLICT (jti) DO NOTHING`,
            [decoded.jti, decoded.exp]
          );
          if (consume.rowCount === 0) {
            logger.warn(`Admin bypass token replay blocked for ${email}`);
            return res.status(401).json({ error: 'Admin bypass token has already been used' });
          }
          isAdminAssisted = true;
          adminInfo = {
            admin_id: decoded.admin_id,
            admin_email: decoded.admin_email
          };
          logger.info(`Admin-assisted login for ${email} by admin ${decoded.admin_email}`);
        }
      } catch (jwtError) {
        logger.warn(`Invalid admin bypass token for ${email}`);
        return res.status(401).json({ error: 'Invalid or expired admin bypass token' });
      }
    }

    if (!password && !isAdminAssisted) {
      return res.status(400).json({ error: 'Password or admin bypass token is required' });
    }
    
    logger.info(`Login attempt for: ${email}`);

    // Try to authenticate user (both regular and admin users are in users table)
    const user = await pool.query(`
      SELECT id, email, name, password_hash, role, user_type, permissions, onboarding_completed, cnic, phone, token_version, must_reset_password
      FROM users
      WHERE email = $1 AND is_active = true
    `, [email]);

    if (user.rows.length === 0) {
      logger.warn(`No user found for: ${email}`);
      // Run a dummy bcrypt comparison so a non-existent account takes the same
      // time as a wrong password — otherwise response timing leaks which emails
      // are registered (SEC-07). Skip for admin-assisted login (no password).
      if (!isAdminAssisted) {
        await bcrypt.compare(password || '', DUMMY_BCRYPT_HASH);
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const userData = user.rows[0];
    
    // Check password (skip for admin-assisted login)
    if (!isAdminAssisted) {
      const passwordMatch = await bcrypt.compare(password, userData.password_hash);
      if (!passwordMatch) {
        logger.warn(`Password mismatch for: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }
    
    const isAdmin = ['admin', 'super_admin'].includes(userData.role);
    logger.info(`Authentication successful for: ${email}`);
    
    // Create session token
    const sessionToken = uuidv4();

    // Create JWT token for API authentication
    const jwt = require('jsonwebtoken');
    const jwtToken = jwt.sign(
      {
        userId: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        onboarding_completed: userData.onboarding_completed,
        token_version: userData.token_version ?? 0
      },
      process.env.JWT_SECRET,
      // Password-less admin-assisted sessions are short-lived (SEC-02); a normal
      // password login gets the full day.
      { expiresIn: isAdminAssisted ? '1h' : '24h' }
    );

    // Store session for ALL users (both admin and regular)
    await pool.query(`
      INSERT INTO user_sessions (
        user_id, user_email, session_token,
        ip_address, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [
      userData.id,
      userData.email,
      sessionToken,
      req.ip,
      new Date(Date.now() + 24*60*60*1000)
    ]);
    
    // Audit trail for login. Fail-OPEN: breaking login because audit is down
    // is worse than a missing audit record. ERROR-level log so it paged.
    await insertAudit(pool, {
      userId: userData.id,
      userEmail: userData.email,
      action: isAdminAssisted ? 'admin_assisted_login' : 'login',
      tableName: 'users',
      newValue: isAdminAssisted ? { admin_email: adminInfo.admin_email } : null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: false,
    });
    
    // Get tax years summary for regular users
    let taxYearsSummary = [];
    let currentYearData = null;
    let hasPersonalInfo = false;

    if (!isAdmin) {
      taxYearsSummary = await pool.query(`
        SELECT
          ty.tax_year,
          ty.is_current,
          tr.id as tax_return_id,
          tr.filing_status,
          tr.return_number,
          fcs.completion_percentage,
          tc.total_tax_liability,
          tc.refund_due,
          tc.additional_tax_due
        FROM tax_years ty
        LEFT JOIN tax_returns tr ON ty.id = tr.tax_year_id AND tr.user_id = $1
        LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
        LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true
        WHERE ty.is_active = true
        ORDER BY ty.tax_year DESC
      `, [userData.id]);

      const currentYearResult = await pool.query(`
        SELECT
          tr.id as tax_return_id,
          tr.tax_year,
          tr.filing_status,
          tr.return_number,
          fcs.completion_percentage,
          tc.total_tax_liability,
          tc.refund_due,
          tc.additional_tax_due
        FROM tax_returns tr
        JOIN tax_years ty ON tr.tax_year_id = ty.id
        LEFT JOIN form_completion_status fcs ON tr.id = fcs.tax_return_id
        LEFT JOIN tax_calculations tc ON tr.id = tc.tax_return_id AND tc.is_final = true
        WHERE tr.user_id = $1 AND ty.is_current = true
      `, [userData.id]);

      currentYearData = currentYearResult.rows[0] || null;

      // Check if user has completed personal information
      const personalInfoCheck = await pool.query(`
        SELECT id FROM personal_information
        WHERE user_id = $1 AND tax_year = (
          SELECT tax_year FROM tax_years WHERE is_current = true LIMIT 1
        )
      `, [userData.id]);

      hasPersonalInfo = personalInfoCheck.rows.length > 0;
    }
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        user_type: userData.user_type,
        permissions: userData.permissions || null,
        onboarding_completed: userData.onboarding_completed,
        cnic: userData.cnic,
        phone: userData.phone,
        // True for bulk-imported users on a temp password — the client must route
        // them to set a new password before they can use the app. Cleared by
        // POST /change-password.
        must_reset_password: userData.must_reset_password === true
      },
      taxYearsSummary: taxYearsSummary.rows || [],
      currentYearData: currentYearData,
      hasPersonalInfo: hasPersonalInfo,
      sessionToken,
      token: jwtToken,
      isAdmin
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (sessionToken) {
      await pool.query(
        'DELETE FROM user_sessions WHERE session_token = $1',
        [sessionToken]
      );
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Authoritative current user (FE-05). jwtAuth has already verified the token
// signature + token_version and loaded the user row FROM THE DB, so role here is
// server-sourced — the client uses this on bootstrap to confirm/correct the role
// it optimistically decoded from the (locally-unverified) JWT.
router.get('/me', jwtAuth, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// Verify session
router.post('/verify-session', validate(verifySessionSchema), async (req, res) => {
  try {
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Session token required' });
    }

    // Validate session token format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionToken)) {
      return res.status(401).json({ error: 'Invalid session token format' });
    }

    const session = await pool.query(`
      SELECT us.*, u.email, u.name, u.role, u.user_type, u.cnic, u.phone
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = $1 AND us.expires_at > NOW() AND u.is_active = true
    `, [sessionToken]);

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const sessionData = session.rows[0];

    // Update session last_accessed timestamp for security tracking
    await pool.query(`
      UPDATE user_sessions
      SET last_accessed_at = NOW()
      WHERE session_token = $1
    `, [sessionToken]);

    res.json({
      success: true,
      user: {
        id: sessionData.user_id,
        email: sessionData.email,
        name: sessionData.name,
        role: sessionData.role,
        user_type: sessionData.user_type,
        cnic: sessionData.cnic,
        phone: sessionData.phone
      }
    });

  } catch (error) {
    logger.error('Session verification error:', error);
    res.status(500).json({ error: 'Session verification failed' });
  }
});

// [REMOVED] /debug-admin/:email endpoint — security risk, not for production

// Change Password endpoint — protected by JWT middleware
router.post('/change-password', jwtAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // req.user is already populated by jwtAuth middleware
    const { id: userId, email: userEmail } = req.user;

    const policy = validatePasswordPolicy(newPassword, { email: userEmail });
    if (!policy.ok) {
      return res.status(400).json({ success: false, message: policy.message });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password.',
      });
    }

    // Fetch current password hash for the authenticated user
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

    if (!isCurrentPasswordValid) {
      logger.warn(`Failed password change attempt for ${userEmail} - incorrect current password`);
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Bump token_version so every JWT issued before this password change is
    // immediately rejected (SEC-01) — a changed password must not leave old
    // sessions alive on other devices.
    const upd = await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1,
              must_reset_password = false, updated_at = NOW()
        WHERE id = $2
       RETURNING token_version, name, role, onboarding_completed`,
      [hashedNewPassword, userId]
    );

    // Audit trail — mandatory. Password change is security-sensitive; a silent
    // audit failure would hide the event from operators.
    await insertAudit(pool, {
      userId,
      userEmail,
      action: 'password_change',
      tableName: 'users',
      changeSummary: 'Password changed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    logger.info(`Password changed successfully for user: ${userEmail}`);

    // Issue a fresh token carrying the new token_version so the device that just
    // changed the password stays signed in; every other outstanding token is now
    // stale and will be rejected on its next request.
    const freshUser = upd.rows[0];
    const freshToken = jwt.sign(
      {
        userId,
        email: userEmail,
        name: freshUser.name,
        role: freshUser.role,
        onboarding_completed: freshUser.onboarding_completed,
        token_version: freshUser.token_version,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, message: 'Password changed successfully', token: freshToken });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while changing password'
    });
  }
});

// Mark the onboarding wizard as complete. Issues a fresh JWT with the
// updated flag so the client doesn't have to re-login to escape the wizard
// guard. Idempotent — calling twice is harmless.
router.post('/onboarding/complete', jwtAuth, async (req, res) => {
  try {
    const { id: userId, email: userEmail } = req.user;

    const result = await pool.query(
      `UPDATE users SET onboarding_completed = true, updated_at = NOW()
        WHERE id = $1 AND is_active = true
       RETURNING id, email, name, role, user_type, onboarding_completed, token_version`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        userId: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        onboarding_completed: u.onboarding_completed,
        token_version: u.token_version ?? 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await insertAudit(pool, {
      userId,
      userEmail,
      action: 'onboarding_complete',
      tableName: 'users',
      mandatory: false,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      token,
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        user_type: u.user_type,
        onboarding_completed: u.onboarding_completed,
      },
    });
  } catch (e) {
    logger.error('onboarding complete failed', { message: e?.message });
    res.status(500).json({ error: 'Failed to mark onboarding complete' });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/my-activity — user-facing audit log
//
// Returns the current user's own audit_log entries (most recent first).
// Used by the Settings → Recent Activity panel so a user can see what
// changed and when, especially when a consultant has been impersonating.
// Pagination defaults are deliberately small to keep the panel scannable.
// ──────────────────────────────────────────────────────────────────────────
router.get('/my-activity', jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0,  0);

    const result = await pool.query(
      `SELECT id, action, table_name, record_id, field_name,
              change_summary, severity, category,
              old_value, new_value,
              ip_address, created_at
         FROM audit_log
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const totalRow = await pool.query(
      'SELECT COUNT(*)::int AS n FROM audit_log WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total:   totalRow.rows[0].n,
        limit,
        offset,
        hasMore: offset + result.rows.length < totalRow.rows[0].n,
      },
    });
  } catch (e) {
    logger.error('my-activity failed', { message: e?.message });
    res.status(500).json({ success: false, message: 'Failed to load activity' });
  }
});

// ─── Single Sign-On ─────────────────────────────────────────────────────────
// Backend bridge for OAuth/OIDC: client (web or mobile) does the user-facing
// OAuth dance, gets an ID token, hands it to us. We verify it against the
// provider's JWKS, look up / create / link a user row, issue our own session.
//
// Coexists with email+password. Existing users who SSO with their account
// email get linked automatically (Google and Apple both verify ownership).

async function loginViaSso(provider, claims, req) {
  // 1. Try matching by SSO identity first — the strongest signal.
  let result = await pool.query(
    `SELECT id, email, name, role, user_type, permissions, onboarding_completed, cnic, phone, is_active, token_version
     FROM users
     WHERE sso_provider = $1 AND sso_subject = $2`,
    [provider, claims.sub]
  );

  let userData = result.rows[0];

  // 2. If no SSO identity matches, check whether the verified email is already
  //    claimed by an existing row (password or another SSO). We do NOT auto-link
  //    to a password account: /register has no email-verification step, so an
  //    attacker who squats on a victim's email with a password registration
  //    would silently inherit the victim's later SSO login. Instead, refuse
  //    with a clear error and let the user link from their profile after
  //    signing in with their password.
  //
  //    Email comparison is case-insensitive: claims.email is already
  //    lowercased by oidcVerifier; legacy mixed-case rows would otherwise
  //    miss and trigger a duplicate-row INSERT collision.
  if (!userData) {
    result = await pool.query(
      `SELECT id, sso_provider FROM users WHERE LOWER(email) = $1`,
      [claims.email]
    );
    const existing = result.rows[0];
    if (existing) {
      const err = new Error('sso_email_conflict');
      err.status = 409;
      logger.warn(`SSO email already claimed by another account`, {
        provider,
        existingUserId: existing.id,
        existingProvider: existing.sso_provider || 'password',
      });
      throw err;
    }
  }

  // 3. Brand new user — create the row. SSO-only signup, no password_hash.
  if (!userData) {
    const insertResult = await pool.query(
      `INSERT INTO users (
        email, name, user_type, password_hash,
        sso_provider, sso_subject, email_verified,
        is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, NULL, $4, $5, TRUE, TRUE, NOW(), NOW())
       RETURNING id, email, name, role, user_type, permissions, onboarding_completed, cnic, phone, is_active, token_version`,
      [claims.email, claims.name || claims.email.split('@')[0], 'individual', provider, claims.sub]
    );
    userData = insertResult.rows[0];
    logger.info(`SSO new-user signup`, { provider, userId: userData.id, email: userData.email });
  }

  if (!userData.is_active) {
    const err = new Error('account_disabled');
    err.status = 403;
    throw err;
  }

  const isAdmin = ['admin', 'super_admin'].includes(userData.role);

  // Session + JWT — same shape login produces, so client code doesn't fork.
  const sessionToken = uuidv4();
  const jwtToken = jwt.sign(
    {
      userId: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      onboarding_completed: userData.onboarding_completed,
      token_version: userData.token_version ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  await pool.query(
    `INSERT INTO user_sessions (user_id, user_email, session_token, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      userData.id,
      userData.email,
      sessionToken,
      req.ip,
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    ]
  );

  await insertAudit(pool, {
    userId: userData.id,
    userEmail: userData.email,
    action: 'sso_login',
    tableName: 'users',
    newValue: { provider },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    mandatory: false,
  });

  return {
    success: true,
    user: {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      user_type: userData.user_type,
      permissions: userData.permissions || null,
      onboarding_completed: userData.onboarding_completed,
      cnic: userData.cnic,
      phone: userData.phone,
    },
    sessionToken,
    token: jwtToken,
    isAdmin,
    sso: { provider },
  };
}

// Validation + dispatch wrapper. Errors thrown by verifyIdToken bubble up
// as the user-visible reason (`token_expired`, `invalid_claims`, etc.).
async function handleSsoLogin(provider, req, res) {
  try {
    const { idToken, nonce } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken_required' });
    }
    // Nonce is MANDATORY (SEC-03): every SSO ID token must be bound to a
    // client-generated nonce, or the anti-replay defense is inert. Web + the
    // updated mobile client both send one; reject anything that doesn't.
    if (typeof nonce !== 'string' || nonce.length === 0) {
      return res.status(400).json({ error: 'nonce_required' });
    }
    const expectedNonce = nonce;

    const claims = await oidc.verify(provider, idToken, expectedNonce);
    const payload = await loginViaSso(provider, claims, req);
    res.json(payload);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    // Verifier errors are short strings; treat as 401 (auth failed).
    const VERIFIER_ERRORS = new Set([
      'token_expired', 'invalid_claims', 'invalid_token', 'invalid_nonce',
      'missing_sub', 'missing_email', 'email_not_verified',
      'unsupported_provider', 'provider_not_configured',
    ]);
    if (VERIFIER_ERRORS.has(err.message)) {
      return res.status(401).json({ error: err.message });
    }
    logger.error(`SSO login failed (${provider})`, { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'sso_login_failed' });
  }
}

router.post('/sso/google', (req, res) => handleSsoLogin('google', req, res));
router.post('/sso/apple', (req, res) => handleSsoLogin('apple', req, res));

// ─── SSO link / unlink (authenticated) ──────────────────────────────────────
// Self-service for users who hit `sso_email_conflict` during the SSO login
// flow. Pattern: sign in with password first, then from the profile settings
// link a Google/Apple identity to your existing account.
//
// Security:
//   - Requires a valid JWT (jwtAuth).
//   - Re-verifies the OIDC ID token, including the nonce the client supplied.
//   - The verified email on the SSO token must EXACTLY match the user's
//     account email (case-insensitive). This is what makes the link safe —
//     the user has proved ownership of the email through both the password
//     login AND the SSO round-trip.
//   - Refuses if the user already has any SSO identity linked (one provider
//     per user keeps the model simple — call unlink first to switch).
//   - Refuses if the SSO identity is already claimed by another account.

async function handleSsoLink(provider, req, res) {
  try {
    const { idToken, nonce } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken_required' });
    }
    // Nonce mandatory (SEC-03) — same as the login flow.
    if (typeof nonce !== 'string' || nonce.length === 0) {
      return res.status(400).json({ error: 'nonce_required' });
    }
    const expectedNonce = nonce;
    const claims = await oidc.verify(provider, idToken, expectedNonce);

    const userId = req.user.id;
    const userEmail = String(req.user.email || '').toLowerCase();

    if (claims.email !== userEmail) {
      // Don't reveal what the verified email actually was — the user could
      // be probing for whether another account exists.
      logger.warn(`SSO link refused: email mismatch`, { provider, userId });
      return res.status(403).json({ error: 'email_mismatch' });
    }

    // Reject if the user already has any SSO identity attached.
    const existing = await pool.query(
      `SELECT sso_provider FROM users WHERE id = $1`,
      [userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    if (existing.rows[0].sso_provider) {
      return res.status(409).json({
        error: 'sso_already_linked',
        current_provider: existing.rows[0].sso_provider,
      });
    }

    // Reject if the SSO identity is already claimed by someone else.
    const claimed = await pool.query(
      `SELECT id FROM users WHERE sso_provider = $1 AND sso_subject = $2`,
      [provider, claims.sub]
    );
    if (claimed.rows.length > 0 && claimed.rows[0].id !== userId) {
      return res.status(409).json({ error: 'sso_identity_taken' });
    }

    await pool.query(
      `UPDATE users
       SET sso_provider = $1, sso_subject = $2, email_verified = TRUE, updated_at = NOW()
       WHERE id = $3`,
      [provider, claims.sub, userId]
    );

    await insertAudit(pool, {
      userId,
      userEmail: req.user.email,
      action: 'sso_link',
      tableName: 'users',
      newValue: { provider },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    logger.info(`SSO identity linked`, { provider, userId });
    return res.json({ success: true, provider });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    const VERIFIER_ERRORS = new Set([
      'token_expired', 'invalid_claims', 'invalid_token', 'invalid_nonce',
      'missing_sub', 'missing_email', 'email_not_verified',
      'unsupported_provider', 'provider_not_configured',
    ]);
    if (VERIFIER_ERRORS.has(err.message)) {
      return res.status(401).json({ error: err.message });
    }
    logger.error(`SSO link failed (${provider})`, { message: err.message, stack: err.stack });
    return res.status(500).json({ error: 'sso_link_failed' });
  }
}

router.post('/sso/link/google', jwtAuth, (req, res) => handleSsoLink('google', req, res));
router.post('/sso/link/apple', jwtAuth, (req, res) => handleSsoLink('apple', req, res));

// Unlink the currently-linked SSO identity. Refuses if the account has no
// password_hash — otherwise the `users_has_auth_method` CHECK constraint
// would (correctly) reject the update and the user would be locked out.
// Better to refuse here with a clear error and tell them to set a password first.
router.post('/sso/unlink', jwtAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const r = await pool.query(
      `SELECT sso_provider, password_hash FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    const { sso_provider: currentProvider, password_hash: passwordHash } = r.rows[0];
    if (!currentProvider) {
      return res.status(409).json({ error: 'no_sso_linked' });
    }
    if (!passwordHash) {
      // Avoid locking the user out — they'd have no remaining auth method.
      return res.status(409).json({
        error: 'no_password_set',
        message: 'Set a password before unlinking your only sign-in method.',
      });
    }

    await pool.query(
      `UPDATE users
       SET sso_provider = NULL, sso_subject = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    await insertAudit(pool, {
      userId,
      userEmail: req.user.email,
      action: 'sso_unlink',
      tableName: 'users',
      oldValue: { provider: currentProvider },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      mandatory: true,
    });

    logger.info(`SSO identity unlinked`, { provider: currentProvider, userId });
    return res.json({ success: true, unlinked_provider: currentProvider });
  } catch (err) {
    logger.error('SSO unlink failed', { message: err.message, stack: err.stack });
    return res.status(500).json({ error: 'sso_unlink_failed' });
  }
});

// Read the current user's linked SSO provider (or null). Used by the
// Settings UI to render the "Connected accounts" panel.
router.get('/sso/status', jwtAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT sso_provider, password_hash IS NOT NULL AS has_password
       FROM users WHERE id = $1 AND is_active = true`,
      [req.user.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'user_not_found' });
    }
    return res.json({
      provider: r.rows[0].sso_provider || null,
      has_password: !!r.rows[0].has_password,
    });
  } catch (err) {
    logger.error('SSO status failed', { message: err.message });
    return res.status(500).json({ error: 'sso_status_failed' });
  }
});

module.exports = router;