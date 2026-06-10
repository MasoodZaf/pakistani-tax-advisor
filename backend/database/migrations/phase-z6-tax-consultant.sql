-- Phase Z6: introduce the `tax_consultant` role and the bulk-import force-reset flag.
--
-- Background
-- ----------
-- The Tax Consultant module adds a third staff role that sits BETWEEN admin and
-- super_admin in capability, but on a different axis:
--   * tax_consultant CAN do everything super_admin can — manage regular users
--     (add / edit / impersonate / bulk-import / bulk soft-delete), and curate the
--     AI tax-efficiency Playbook.
--   * tax_consultant CANNOT change tax rates / slabs / the rates bundle, CANNOT
--     change a user's role, and CANNOT create or manage admin / super_admin
--     accounts. Those stay super_admin-only to prevent privilege escalation
--     (a consultant must not be able to mint a super_admin and thereby bypass the
--     rate-change restriction).
--
-- Enforcement is in the application layer (backend/src/middleware/roleGuard.js +
-- the in-controller checks). The `roles` row seeded here is the canonical record
-- of what the role is allowed to do — it mirrors the middleware tiers and is the
-- source of truth for any future permissions UI. `users.role` itself is a plain
-- VARCHAR(50) with no CHECK constraint, so no enum to alter.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z6-tax-consultant.sql
-- Safe to run multiple times (ON CONFLICT upsert + ADD COLUMN IF NOT EXISTS).

BEGIN;

-- 1. Seed (or refresh) the tax_consultant role. Idempotent via the UNIQUE(name)
--    constraint on roles — re-runs update the description/permissions in place.
INSERT INTO roles (name, description, permissions) VALUES
    ('tax_consultant',
     'Tax Consultant — all super-admin powers EXCEPT changing tax rates/slabs, changing user roles, and managing admin accounts',
     '{
        "users": {"create": true, "read": true, "update": true, "delete": true, "bulk_import": true, "bulk_delete": true, "impersonate": true},
        "tax_returns": {"create": true, "read": true, "update": true, "delete": true},
        "tax_efficiency": {"create": true, "read": true, "update": true, "approve": true},
        "reports": {"create": true, "read": true, "export": true},
        "audit_logs": {"read": true},
        "tax_rates": {"create": false, "read": true, "update": false, "delete": false},
        "user_roles": {"update": false},
        "admin_accounts": {"create": false, "read": false, "update": false, "delete": false}
     }'::jsonb)
ON CONFLICT (name) DO UPDATE
    SET description = EXCLUDED.description,
        permissions = EXCLUDED.permissions,
        updated_at  = CURRENT_TIMESTAMP;

-- 2. Force-reset flag. Bulk-imported users get a random temporary password and
--    must set a new one on first login; the login flow checks this column.
--    Defaults false so every existing user and the normal self-registration path
--    are unaffected.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT false;

COMMIT;
