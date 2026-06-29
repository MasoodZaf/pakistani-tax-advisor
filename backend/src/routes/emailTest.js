// Super-admin email diagnostics — confirm outbound email (e.g. Resend) works
// before relying on it in production.
//
//   GET  /api/admin/email-test  → report SMTP config + verify the connection
//                                 (no email sent).
//   POST /api/admin/email-test  { to? } → send a test email (defaults to the
//                                 caller's own address).

const express = require('express');
const logger = require('../utils/logger');
const { requireSuperAdmin } = require('../middleware/roleGuard');
const { isConfigured, defaultFrom, verifyConnection, sendMail } = require('../services/email');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function providerName() {
  const host = (process.env.SMTP_HOST || '').toLowerCase();
  if (!host) return 'none';
  if (host.includes('resend')) return 'resend';
  if (host.includes('outlook') || host.includes('office365')) return 'microsoft';
  if (host.includes('google') || host.includes('gmail')) return 'google';
  return 'custom';
}

function configInfo() {
  return {
    configured: isConfigured(),
    provider: providerName(),
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || null,
    from: defaultFrom(),
  };
}

// GET — report config and verify the SMTP connection (does NOT send).
router.get('/', requireSuperAdmin, async (req, res) => {
  const info = configInfo();
  if (!info.configured) {
    return res.json({ success: true, verified: false, message: 'SMTP not configured', info });
  }
  try {
    await verifyConnection();
    res.json({ success: true, verified: true, message: 'SMTP connection OK', info });
  } catch (e) {
    logger.warn('email-test verify failed:', e.message);
    res.status(502).json({ success: false, verified: false, message: `SMTP verify failed: ${e.message}`, info });
  }
});

// POST — send a real test email.
router.post('/', requireSuperAdmin, async (req, res) => {
  const to = (req.body?.to ? String(req.body.to).trim() : '') || req.user.email;

  if (!EMAIL_RE.test(to)) {
    return res.status(400).json({ success: false, message: 'A valid "to" email address is required' });
  }
  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'SMTP not configured. Set SMTP_HOST/SMTP_PORT (e.g. Resend) and restart the backend.',
    });
  }

  const stamp = new Date().toISOString();
  try {
    const info = await sendMail({
      to,
      subject: 'MeraTax — outbound email test',
      text:
        `This is a test email from MeraTax sent at ${stamp}.\n\n` +
        `If you received this, outbound email (Resend/SMTP) is working correctly.\n` +
        `Sent from: ${defaultFrom()}`,
      html:
        `<p>This is a test email from <strong>MeraTax</strong> sent at ${stamp}.</p>` +
        `<p>If you received this, outbound email (Resend/SMTP) is working correctly.</p>` +
        `<p style="color:#5b6478;font-size:13px">Sent from: ${defaultFrom()}</p>`,
    });
    logger.info(`email-test sent to ${to} by ${req.user.email} (messageId=${info?.messageId || 'n/a'})`);
    res.json({ success: true, message: `Test email sent to ${to}`, messageId: info?.messageId || null, from: defaultFrom() });
  } catch (e) {
    logger.error('email-test send failed:', e.message);
    res.status(502).json({ success: false, message: `Send failed: ${e.message}` });
  }
});

module.exports = router;
