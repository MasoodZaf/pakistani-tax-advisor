// User notifications (phase-z10).
//
// Not a notifications TABLE — a derived feed. The audit log already records
// everything a user genuinely wants to be told about:
//   * someone opened their account (consultant/admin impersonation, support
//     credential bypass)
//   * their consultant relationship changed (assigned / removed)
//   * their password was reset by staff
// plus one synthetic, non-unread item: the filing-deadline countdown.
//
// Self-initiated events are excluded (al.user_id <> me) — you don't need a
// notification that you did something yourself.
//
// Unread state = audit events newer than users.notifications_seen_at.
// POST /seen stamps it. The deadline reminder never counts as unread, so the
// red dot only ever means "something happened to your account".

const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');

const router = express.Router();

// Actions surfaced to the affected user (audit_log.record_id = user id).
const FEED_ACTIONS = [
  'impersonate_start',
  'super_admin_credential_bypass',
  'consultant_assigned',
  'consultant_unassigned',
  'password_reset',
];

function describe(row) {
  const actor = row.user_email || 'A staff member';
  switch (row.action) {
    case 'impersonate_start':
      return {
        type: 'access',
        title: 'Your account was accessed',
        body: `${actor} opened your account to work on your return.`,
      };
    case 'super_admin_credential_bypass':
      return {
        type: 'access',
        title: 'Support sign-in issued',
        body: `${actor} generated temporary sign-in access to your account.`,
      };
    case 'consultant_assigned': {
      let email = '';
      try { email = JSON.parse(row.new_value || '{}').consultant_email || ''; } catch { /* noop */ }
      return {
        type: 'consultant',
        title: 'Consultant assigned',
        body: email
          ? `Your return is now managed by ${email}. You can end this anytime in Settings.`
          : 'A tax consultant was assigned to your account. You can end this anytime in Settings.',
      };
    }
    case 'consultant_unassigned':
      return {
        type: 'consultant',
        title: 'Consultant removed',
        body: 'You are filing independently again — no consultant has access to your data.',
      };
    case 'password_reset':
      return {
        type: 'security',
        title: 'Password reset',
        body: `${actor} reset your account password.`,
      };
    default:
      return { type: 'info', title: row.action, body: row.change_summary || '' };
  }
}

// Filing deadline for the current tax year: 30 September of the year the tax
// year ends ('2025-26' → 2026-09-30). Shown from 120 days out until the day
// itself; informational only (never unread).
function deadlineItem(taxYear) {
  const match = /^(\d{4})-(\d{2})$/.exec(taxYear || '');
  if (!match) return null;
  const endYear = Math.floor(Number(match[1]) / 100) * 100 + Number(match[2]);
  const deadline = new Date(Date.UTC(endYear, 8, 30)); // month 8 = September
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0 || daysLeft > 120) return null;
  return {
    id: `deadline-${taxYear}`,
    type: 'deadline',
    title: daysLeft === 0 ? 'Filing deadline is TODAY' : `Filing deadline in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    body: `Returns for Tax Year ${taxYear} are due ${deadline.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.`,
    created_at: new Date().toISOString(),
    unread: false,
  };
}

// GET /api/notifications — feed + unread count.
router.get('/', auth, async (req, res) => {
  try {
    const [seenRow, events, yearRow] = await Promise.all([
      pool.query('SELECT notifications_seen_at FROM users WHERE id = $1', [req.user.id]),
      pool.query(`
        SELECT id, user_email, action, new_value, change_summary, created_at
        FROM audit_log
        WHERE record_id = $1
          AND user_id <> $1
          AND action = ANY($2)
        ORDER BY created_at DESC
        LIMIT 20
      `, [req.user.id, FEED_ACTIONS]),
      pool.query('SELECT tax_year FROM tax_years WHERE is_current = true LIMIT 1'),
    ]);

    const seenAt = seenRow.rows[0]?.notifications_seen_at || null;
    const items = events.rows.map(row => ({
      id: row.id,
      ...describe(row),
      created_at: row.created_at,
      unread: !seenAt || new Date(row.created_at) > new Date(seenAt),
    }));

    const deadline = deadlineItem(yearRow.rows[0]?.tax_year);
    if (deadline) items.unshift(deadline);

    res.json({
      success: true,
      data: {
        items,
        unread: items.filter(i => i.unread).length,
      },
    });
  } catch (error) {
    logger.error('Notifications feed error:', error);
    res.status(500).json({ error: 'Failed to load notifications', message: error.message });
  }
});

// POST /api/notifications/seen — mark everything read.
router.post('/seen', auth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET notifications_seen_at = NOW() WHERE id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Notifications seen error:', error);
    res.status(500).json({ error: 'Failed to mark notifications read', message: error.message });
  }
});

module.exports = router;
