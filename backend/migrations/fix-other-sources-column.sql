-- Fix the other_sources column issue by adding it as an alias to income_from_other_sources
-- This will maintain backward compatibility

-- Add other_sources column as an alias/copy of income_from_other_sources
ALTER TABLE income_forms
ADD COLUMN IF NOT EXISTS other_sources NUMERIC(15,2) DEFAULT 0;

-- Update existing records to sync the values
UPDATE income_forms
SET other_sources = income_from_other_sources
WHERE other_sources IS NULL OR other_sources = 0;

-- Create a trigger to keep both columns in sync
CREATE OR REPLACE FUNCTION sync_other_sources_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- When income_from_other_sources is updated, sync to other_sources
    IF NEW.income_from_other_sources IS NOT NULL THEN
        NEW.other_sources = NEW.income_from_other_sources;
    END IF;

    -- When other_sources is updated, sync to income_from_other_sources
    IF NEW.other_sources IS NOT NULL AND NEW.other_sources != OLD.other_sources THEN
        NEW.income_from_other_sources = NEW.other_sources;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS sync_other_sources_trigger ON income_forms;
CREATE TRIGGER sync_other_sources_trigger
    BEFORE INSERT OR UPDATE ON income_forms
    FOR EACH ROW
    EXECUTE FUNCTION sync_other_sources_columns();

COMMIT;