// Self-service password reset (phase-z13).
//
//   POST /api/forgot-password { email }     → email a single-use reset link
//   POST /api/reset-password  { token, password } → consume it, set new password
//
// Security:
//   - Only sha256(token) is stored; the raw token lives only in the emailed link.
//   - forgot-password ALWAYS returns the same generic response (anti-enumeration).
//   - Tokens are single-use + expire after RESET_TTL_MIN minutes.
//   - On reset we bump users.token_version to kill every existing session (SEC-01).
//   - Both routes sit behind the login rate-limiter (mounted in app.js).

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { insertAudit } = require('../helpers/auditLog');
const { validatePasswordPolicy, BCRYPT_ROUNDS } = require('../helpers/passwordPolicy');
const email = require('../services/email');

const router = express.Router();

const RESET_TTL_MIN = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Reset link points at the frontend. Prefer the configured origin; fall back to
// the request's Origin header so it works on whichever domain served the app.
function baseUrl(req) {
  const fromEnv = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const origin = (req.headers.origin || '').replace(/\/+$/, '');
  return origin; // '' → relative link (still works when same-origin)
}

// POST /api/forgot-password
router.post('/forgot-password', async (req, res) => {
  const emailAddr = (req.body?.email || '').toString().trim().toLowerCase();
  // One generic response for every path — never reveal whether the email exists.
  const genericOk = () =>
    res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });

  if (!EMAIL_RE.test(emailAddr)) return genericOk();

  try {
    const u = await pool.query(
      'SELECT id, email, name FROM users WHERE lower(email) = $1 AND is_active = true LIMIT 1',
      [emailAddr]
    );
    if (u.rows.length === 0) return genericOk();
    const user = u.rows[0];

    if (!email.isConfigured()) {
      logger.error('forgot-password: SMTP not configured — cannot send reset email');
      return genericOk();
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const ip = req.ip || null;

    // Supersede any outstanding tokens, then store the new one (hashed).
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)`,
      [user.id, sha256(rawToken), String(RESET_TTL_MIN), ip]
    );

    const link = `${baseUrl(req)}/reset-password?token=${rawToken}`;
    const name = user.name ? ` ${user.name}` : '';
    await email.sendMail({
      to: user.email,
      subject: 'Reset your MeraTax password',
      text:
        `Hi${name},\n\nWe received a request to reset your MeraTax password. ` +
        `Use the link below to set a new one (valid for ${RESET_TTL_MIN} minutes):\n\n${link}\n\n` +
        `If you didn't request this, you can safely ignore this email — your password won't change.\n\n— MeraTax`,
      html:
        `<p>Hi${name},</p>` +
        `<p>We received a request to reset your MeraTax password. Use the button below to set a new one (valid for ${RESET_TTL_MIN} minutes):</p>` +
        `<p><a href="${link}" style="background:#28396C;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Reset password</a></p>` +
        `<p style="color:#5b6478;font-size:13px;word-break:break-all">Or paste this link: ${link}</p>` +
        `<p style="color:#5b6478;font-size:13px">If you didn't request this, ignore this email — your password won't change.</p>` +
        `<p style="color:#5b6478;font-size:13px">— MeraTax</p>`,
    });

    await insertAudit(pool, {
      userId: user.id,
      userEmail: user.email,
      action: 'password_reset_requested',
      tableName: 'password_reset_tokens',
      recordId: user.id,
      category: 'security',
      severity: 'info',
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || null,
      mandatory: false,
    });

    return genericOk();
  } catch (e) {
    logger.error('forgot-password error:', e.message);
    return genericOk(); // never leak internals to the client
  }
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  const token = (req.body?.token || '').toString();
  const password = (req.body?.password || '').toString();
  const invalid = () =>
    res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });

  if (!token || token.length < 32) return invalid();

  const basic = validatePasswordPolicy(password);
  if (!basic.ok) return res.status(400).json({ success: false, message: basic.message });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT prt.id, prt.user_id, u.email
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()
        FOR UPDATE`,
      [sha256(token)]
    );
    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return invalid();
    }
    const { id: tokenId, user_id: userId, email: userEmail } = r.rows[0];

    const withEmail = validatePasswordPolicy(password, { email: userEmail });
    if (!withEmail.ok) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: withEmail.message });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await client.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1,
              must_reset_password = false, updated_at = NOW()
        WHERE id = $2`,
      [hash, userId]
    );
    // Consume this token and any other outstanding ones for the user.
    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
    await client.query('COMMIT');

    await insertAudit(pool, {
      userId,
      userEmail,
      action: 'password_reset_completed',
      tableName: 'users',
      recordId: userId,
      category: 'security',
      severity: 'info',
      ipAddress: req.ip || null,
      userAgent: req.headers['user-agent'] || null,
      mandatory: false,
    });

    res.json({ success: true, message: 'Your password has been reset. You can now sign in.' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('reset-password error:', e.message);
    res.status(500).json({ success: false, message: 'Could not reset password. Please try again.' });
  } finally {
    client.release();
  }
});

module.exports = router;
