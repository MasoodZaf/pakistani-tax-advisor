-- Create personal_information table for FBR report data
-- This table stores user personal details required for tax filing
-- Migration Date: 2025-10-06

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS personal_information CASCADE;

-- Create personal_information table
CREATE TABLE personal_information (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,

    -- Personal details for FBR report
    full_name VARCHAR(255),
    father_name VARCHAR(255),
    cnic VARCHAR(20),
    ntn VARCHAR(20),
    passport_number VARCHAR(20),

    -- Address information
    residential_address TEXT,
    mailing_address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    country VARCHAR(100) DEFAULT 'Pakistan',

    -- Contact information
    mobile_number VARCHAR(20),
    landline_number VARCHAR(20),
    email_address VARCHAR(255),

    -- Professional information
    profession VARCHAR(255),
    employer_name VARCHAR(255),
    employer_address TEXT,
    employer_ntn VARCHAR(20),

    -- FBR specific information
    fbr_registration_number VARCHAR(50),
    tax_circle VARCHAR(100),
    zone VARCHAR(100),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, tax_year)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_personal_info_user_tax_year ON personal_information(user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_personal_info_user_id ON personal_information(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_info_cnic ON personal_information(cnic);
CREATE INDEX IF NOT EXISTS idx_personal_info_ntn ON personal_information(ntn);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_personal_info_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_personal_info_updated_at ON personal_information;
CREATE TRIGGER update_personal_info_updated_at
    BEFORE UPDATE ON personal_information
    FOR EACH ROW
    EXECUTE FUNCTION update_personal_info_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON personal_information TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE personal_information_id_seq TO your_app_user;

-- Add comments for documentation
COMMENT ON TABLE personal_information IS 'Stores user personal information required for FBR tax filing';
COMMENT ON COLUMN personal_information.user_id IS 'Foreign key reference to users table';
COMMENT ON COLUMN personal_information.tax_year IS 'Tax year in format YYYY-YY (e.g., 2025-26)';
COMMENT ON COLUMN personal_information.cnic IS 'Computerized National Identity Card number (13 digits)';
COMMENT ON COLUMN personal_information.ntn IS 'National Tax Number (7 digits)';
COMMENT ON COLUMN personal_information.fbr_registration_number IS 'Federal Board of Revenue registration number';
COMMENT ON COLUMN personal_information.tax_circle IS 'Tax office circle assigned to the taxpayer';
COMMENT ON COLUMN personal_information.zone IS 'Tax zone assigned to the taxpayer';
