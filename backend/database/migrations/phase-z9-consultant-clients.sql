-- Phase Z9: consultant ↔ client assignment (multi-consultant isolation).
--
-- Until now the tax_consultant role saw EVERY user (phase-z6 granted global
-- user permissions — fine while the firm had a single consultant). With more
-- than one consultant, client data is privileged: consultant A must never see
-- consultant B's clients, and INDEPENDENT self-filers (the predominant user
-- base) must be invisible to ALL consultants.
--
-- Model (user-decided 2026-06-11):
--   * Strictly ONE consultant per client — UNIQUE(client_id).
--   * No row  = independent user. Invisible to every consultant. The default.
--   * A row is created only deliberately: the consultant creates/bulk-imports
--     the client (auto-assign), or a super_admin assigns an existing user.
--   * Re-assignment is a two-step flow: the client must first deregister from
--     the current consultant (or super_admin unassigns) — the API refuses to
--     silently switch an assigned client (409). Enforcement lives in
--     usersController.setUserConsultant + routes/consultantLink.js.
--   * Scoping is enforced in SQL on every /api/admin/users* read and write —
--     consultants query "my assigned clients", never "all minus others".
--
-- ON DELETE CASCADE: deleting either side of the relationship removes the link;
-- a deleted consultant releases their clients back to independent status.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z9-consultant-clients.sql
-- Safe to run multiple times (IF NOT EXISTS throughout).

BEGIN;

CREATE TABLE IF NOT EXISTS consultant_clients (
    id            UUID NOT NULL DEFAULT uuid_generate_v4(),
    consultant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT consultant_clients_pkey PRIMARY KEY (id),
    -- Strictly one consultant per client.
    CONSTRAINT consultant_clients_client_unique UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_consultant_clients_consultant
    ON consultant_clients(consultant_id);

-- Document the scoping in the canonical role record (phase-z6 seeded it with
-- global user permissions; the application layer now scopes every user
-- operation to assigned clients).
UPDATE roles
   SET permissions = jsonb_set(permissions, '{users,scope}', '"assigned_clients"'),
       description = 'Tax Consultant — manages ONLY explicitly assigned clients; cannot change tax rates/slabs, user roles, or admin accounts. Independent users are invisible.',
       updated_at  = CURRENT_TIMESTAMP
 WHERE name = 'tax_consultant';

COMMIT;
