-- Phase R: add onboarding_completed flag on users.
--
-- Without this flag, the frontend has no way to tell "this user finished the
-- onboarding wizard" from "this user has an account but never completed it",
-- so the OnboardingRoute kicked anyone with a session straight to the
-- dashboard — silently skipping the rest of onboarding. The Onboarding wizard
-- now updates this flag at the final step so subsequent logins go straight
-- to dashboard, while in-progress accounts stay on the wizard.
--
-- Apply:  psql -d tax_advisor -f backend/database/migrations/phase-r-onboarding-flag.sql

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Existing users predate the wizard — assume they completed onboarding through
-- the legacy paths so they're not forced through the new flow on next login.
UPDATE users SET onboarding_completed = true WHERE onboarding_completed = false;

-- Going forward, INSERTs default to false (= must onboard).
ALTER TABLE users ALTER COLUMN onboarding_completed SET DEFAULT false;

COMMIT;
