-- Phase Z: admin-managed Tax-Efficiency Playbook strategies.
--
-- Lets super-admins (and, in time, vetted consultants) add/review/approve
-- legal tax-efficiency strategies without a code deploy. APPROVED strategies are
-- ingested into the AI knowledge base (alongside the bundled playbook.md) so the
-- consultant + /optimize retrieve them. This is the dynamic half of the
-- "master file" — general tax knowledge only, never any user's data.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-z-playbook-strategies.sql

CREATE TABLE IF NOT EXISTS playbook_strategies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(200) NOT NULL,
  profile     TEXT,                       -- who it applies to / the trigger
  relief      VARCHAR(200),               -- the relief/credit/allowance
  section     VARCHAR(120),               -- Ordinance section / schedule
  cap_note    VARCHAR(200),               -- statutory cap, e.g. "30% of taxable income"
  how_to      TEXT,                       -- what to do / enter
  caveat      TEXT,                       -- eligibility limits / warnings
  form_step   VARCHAR(50),                -- app form deep-link target
  status      VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | approved | archived
  created_by  UUID,
  approved_by UUID,
  approved_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_playbook_strategies_status ON playbook_strategies (status);
