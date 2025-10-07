-- Add property type fields to capital_gain_forms table
-- Each immovable property row should have a property type (Plot, House, Flat)

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_1_year_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_1_year_type IN ('Plot', 'House', 'Flat'));

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_2_years_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_2_years_type IN ('Plot', 'House', 'Flat'));

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_3_years_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_3_years_type IN ('Plot', 'House', 'Flat'));

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_4_years_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_4_years_type IN ('Plot', 'House', 'Flat'));

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_5_years_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_5_years_type IN ('Plot', 'House', 'Flat'));

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_6_years_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_6_years_type IN ('Plot', 'House', 'Flat'));

ALTER TABLE capital_gain_forms
ADD COLUMN immovable_property_over_6_years_type VARCHAR(20) DEFAULT 'Plot' CHECK (immovable_property_over_6_years_type IN ('Plot', 'House', 'Flat'));

-- Add comments for clarity
COMMENT ON COLUMN capital_gain_forms.immovable_property_1_year_type IS 'Property type for immovable property held <= 1 year: Plot, House, or Flat';
COMMENT ON COLUMN capital_gain_forms.immovable_property_2_years_type IS 'Property type for immovable property held 1-2 years: Plot, House, or Flat';
COMMENT ON COLUMN capital_gain_forms.immovable_property_3_years_type IS 'Property type for immovable property held 2-3 years: Plot, House, or Flat';
COMMENT ON COLUMN capital_gain_forms.immovable_property_4_years_type IS 'Property type for immovable property held 3-4 years: Plot, House, or Flat';
COMMENT ON COLUMN capital_gain_forms.immovable_property_5_years_type IS 'Property type for immovable property held 4-5 years: Plot, House, or Flat';
COMMENT ON COLUMN capital_gain_forms.immovable_property_6_years_type IS 'Property type for immovable property held 5-6 years: Plot, House, or Flat';
COMMENT ON COLUMN capital_gain_forms.immovable_property_over_6_years_type IS 'Property type for immovable property held > 6 years: Plot, House, or Flat';