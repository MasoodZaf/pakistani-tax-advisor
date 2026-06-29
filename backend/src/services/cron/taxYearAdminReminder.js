// Annual Finance-Act reminder for admins.
//
// Pakistan's Finance Act usually passes in mid-June and applies from
// 1 July. This service emits a reminder on three dates:
//
//   April 1   — heads-up: Budget proposals due in June
//   June 15   — prepare: Finance Act expected this week
//   June 30   — final: check fbr.gov.pk and ensure tax_slabs are seeded
//
// Each fires once per calendar day. Delivery is email + audit-log row.
// If SMTP is not configured the audit row still gets written so the admin
// sees the reminder when they next visit the audit screen.

const nodemailer = require('nodemailer');
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');
const { insertAudit } = require('../../helpers/auditLog');
const { fiscalLabel } = require('./taxYearRollover');

const REMINDERS = {
  '04-01': {
    severity: 'info',
    subject: (yr) => `Heads-up: Federal Budget FY ${yr} due in June`,
    body: (yr) => `Federal Budget proposals for tax year ${yr} are expected in early June. ` +
      `Watch fbr.gov.pk and the Ministry of Finance announcements. No action required yet — ` +
      `this is a calendar nudge so slabs/rates can be updated promptly when the Finance Act passes.`,
  },
  '06-15': {
    severity: 'warning',
    subject: (yr) => `Finance Act FY ${yr} due this week — prepare slab updates`,
    body: (yr) => `The Finance Act for tax year ${yr} is typically published this week. ` +
      `When it's out: (1) review the new slabs/rates on fbr.gov.pk, (2) update the tax_slabs table ` +
      `and any rate constants, (3) test against representative incomes, (4) flip is_active=true ` +
      `on the tax_years row for ${yr} once verified. The rollover cron will flip is_current on 1 July.`,
  },
  '06-30': {
    severity: 'critical',
    subject: (yr) => `Final reminder: tax year ${yr} starts tomorrow`,
    body: (yr) => `Tax year ${yr} starts 1 July (tomorrow). The rollover cron will set is_current ` +
      `automatically, but the tax_years row will stay is_active=false until you've reviewed the ` +
      `Finance Act and updated tax_slabs. Filers will see the new year only after activation.`,
  },
};

function todayKey(date) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// Fiscal year that STARTS this calendar year — the one the admin is being
// reminded about. April/June reminders are about the year starting that July.
function upcomingFiscalLabel(date) {
  return fiscalLabel(date.getUTCFullYear());
}

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT) return null;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return _transporter;
}

// Recipients: every active user with role in (super_admin, admin). One row
// per address; admins can manage who gets reminders via the existing
// admin-accounts UI.
async function adminEmails() {
  const { rows } = await pool.query(
    `SELECT email FROM users
      WHERE role IN ('super_admin', 'admin') AND is_active = true
      ORDER BY email`
  );
  return rows.map((r) => r.email).filter(Boolean);
}

async function maybeSend(reminder, taxYear) {
  const transporter = getTransporter();
  const recipients = await adminEmails();
  const subject = reminder.subject(taxYear);
  const body = reminder.body(taxYear);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@mera-tax.com';

  if (!transporter) {
    logger.warn('admin reminder: SMTP not configured, audit-only', { subject, recipients });
    return { delivered: false, recipients };
  }
  if (recipients.length === 0) {
    logger.warn('admin reminder: no active admins', { subject });
    return { delivered: false, recipients: [] };
  }
  try {
    await transporter.sendMail({ from, to: recipients.join(','), subject, text: body });
    return { delivered: true, recipients };
  } catch (err) {
    logger.error('admin reminder send failed', { message: err.message, subject });
    return { delivered: false, recipients, error: err.message };
  }
}

// Check today against the reminder calendar. Fires at most once per
// (date, severity) — the audit table is the dedupe key (we look back 36h).
async function checkAndFireOnce(now = new Date()) {
  const key = todayKey(now);
  const reminder = REMINDERS[key];
  if (!reminder) return { fired: false, reason: 'not_a_reminder_day' };

  // Dedupe: did we already fire today? (cron may run more than once per
  // day during testing/restart). new_value is JSON-stringified text in
  // audit_log, so we dedupe by substring on severity + tax_year.
  const taxYear = upcomingFiscalLabel(now);
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const sigil = `"severity":"${reminder.severity}"`;
  const yearSigil = `"tax_year":"${taxYear}"`;
  const existing = await pool.query(
    `SELECT 1 FROM audit_log
      WHERE action = 'tax_year_admin_reminder'
        AND created_at > $1
        AND new_value LIKE '%' || $2 || '%'
        AND new_value LIKE '%' || $3 || '%'
      LIMIT 1`,
    [since, sigil, yearSigil]
  );
  if (existing.rowCount > 0) {
    return { fired: false, reason: 'already_fired_today' };
  }

  const sendResult = await maybeSend(reminder, taxYear);
  await insertAudit(pool, {
    userId: null,
    userEmail: null,
    action: 'tax_year_admin_reminder',
    tableName: 'tax_years',
    newValue: {
      tax_year: taxYear,
      severity: reminder.severity,
      subject: reminder.subject(taxYear),
      delivered: sendResult.delivered,
      recipients: sendResult.recipients,
    },
    mandatory: true,
  }).catch((e) => logger.warn('reminder audit insert failed', { message: e.message }));

  return { fired: true, taxYear, severity: reminder.severity, ...sendResult };
}

module.exports = { checkAndFireOnce, REMINDERS };
