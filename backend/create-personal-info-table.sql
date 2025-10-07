-- Create personal_information table for FBR report data
CREATE TABLE IF NOT EXISTS personal_information (
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

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_personal_info_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_personal_info_updated_at
    BEFORE UPDATE ON personal_information
    FOR EACH ROW
    EXECUTE FUNCTION update_personal_info_updated_at_column();