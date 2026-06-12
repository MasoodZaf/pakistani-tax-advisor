-- Phase Z10: notifications read-marker.
--
-- The header bell (rebuilt as a REAL feature after the decorative one was
-- removed) derives a per-user feed from audit_log — account-access events
-- (impersonation, credential bypass), consultant assignment changes, password
-- resets — plus a synthetic filing-deadline reminder. The only state it needs
-- is "when did this user last open the panel", so the unread dot lights only
-- for genuinely new events.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z10-notifications-seen.sql
-- Safe to run multiple times.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ(6);
