-- Pakistani Tax Advisor Database Initialization
-- Optimized for 10,000 users
-- Created: 2024

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set timezone
SET timezone = 'UTC';

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user', 'accountant');
CREATE TYPE tax_type AS ENUM ('salaried', 'non_salaried');
CREATE TYPE filer_status AS ENUM ('filer', 'non_filer');

-- =====================================
-- USERS TABLE
-- =====================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    
    -- Additional fields for tax purposes
    national_id VARCHAR(20),
    tax_year INTEGER,
    preferred_language VARCHAR(10) DEFAULT 'en'
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_national_id ON users(national_id);
CREATE INDEX idx_users_tax_year ON users(tax_year);

-- =====================================
-- TAX SLABS TABLE
-- =====================================
CREATE TABLE tax_slabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_year INTEGER NOT NULL,
    tax_type tax_type NOT NULL,
    slab_min DECIMAL(15,2) NOT NULL,
    slab_max DECIMAL(15,2),
    rate DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tax_year, tax_type, slab_min, slab_max)
);

-- Indexes for tax_slabs table
CREATE INDEX idx_tax_slabs_year_type ON tax_slabs(tax_year, tax_type);
CREATE INDEX idx_tax_slabs_active ON tax_slabs(is_active);
CREATE INDEX idx_tax_slabs_range ON tax_slabs(slab_min, slab_max);

-- =====================================
-- TAX CALCULATIONS TABLE
-- =====================================
CREATE TABLE tax_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100), -- For anonymous calculations
    
    -- Input data
    gross_income DECIMAL(15,2) NOT NULL,
    tax_year INTEGER NOT NULL,
    tax_type tax_type NOT NULL,
    filer_status filer_status NOT NULL,
    
    -- Results
    taxable_income DECIMAL(15,2) NOT NULL,
    total_tax DECIMAL(15,2) NOT NULL,
    net_income DECIMAL(15,2) NOT NULL,
    effective_rate DECIMAL(5,2) NOT NULL,
    marginal_rate DECIMAL(5,2) NOT NULL,
    additional_tax DECIMAL(15,2) DEFAULT 0,
    
    -- Metadata
    calculation_data JSONB, -- Store detailed breakdown
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Performance optimization
    CONSTRAINT check_positive_income CHECK (gross_income > 0),
    CONSTRAINT check_valid_tax_year CHECK (tax_year >= 2020 AND tax_year <= 2030)
);

-- Indexes for tax_calculations table
CREATE INDEX idx_tax_calculations_user_id ON tax_calculations(user_id);
CREATE INDEX idx_tax_calculations_session_id ON tax_calculations(session_id);
CREATE INDEX idx_tax_calculations_tax_year ON tax_calculations(tax_year);
CREATE INDEX idx_tax_calculations_tax_type ON tax_calculations(tax_type);
CREATE INDEX idx_tax_calculations_created_at ON tax_calculations(created_at);
CREATE INDEX idx_tax_calculations_income_range ON tax_calculations(gross_income);

-- GIN index for JSON data queries
CREATE INDEX idx_tax_calculations_data_gin ON tax_calculations USING GIN(calculation_data);

-- Composite indexes for common queries
CREATE INDEX idx_tax_calculations_user_year ON tax_calculations(user_id, tax_year);
CREATE INDEX idx_tax_calculations_type_year ON tax_calculations(tax_type, tax_year);

-- =====================================
-- USER SESSIONS TABLE
-- =====================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for user_sessions table
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);

-- =====================================
-- AUDIT LOG TABLE
-- =====================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_log table
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- =====================================
-- SYSTEM SETTINGS TABLE
-- =====================================
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for system_settings table
CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_active ON system_settings(is_active);

-- =====================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_slabs_updated_at 
    BEFORE UPDATE ON tax_slabs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at 
    BEFORE UPDATE ON system_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- INSERT INITIAL DATA
-- =====================================

-- Insert tax slabs for 2024-25
INSERT INTO tax_slabs (tax_year, tax_type, slab_min, slab_max, rate) VALUES
-- Salaried individuals
(2024, 'salaried', 0, 600000, 0),
(2024, 'salaried', 600001, 1200000, 5),
(2024, 'salaried', 1200001, 2200000, 15),
(2024, 'salaried', 2200001, 3200000, 25),
(2024, 'salaried', 3200001, 4100000, 30),
(2024, 'salaried', 4100001, NULL, 35),

-- Non-salaried individuals
(2024, 'non_salaried', 0, 600000, 0),
(2024, 'non_salaried', 600001, 1200000, 15),
(2024, 'non_salaried', 1200001, 1600000, 20),
(2024, 'non_salaried', 1600001, 3200000, 30),
(2024, 'non_salaried', 3200001, 5600000, 40),
(2024, 'non_salaried', 5600001, NULL, 45);

-- Insert tax slabs for 2025-26 (same as 2024-25 for now)
INSERT INTO tax_slabs (tax_year, tax_type, slab_min, slab_max, rate) VALUES
-- Salaried individuals
(2025, 'salaried', 0, 600000, 0),
(2025, 'salaried', 600001, 1200000, 5),
(2025, 'salaried', 1200001, 2200000, 15),
(2025, 'salaried', 2200001, 3200000, 25),
(2025, 'salaried', 3200001, 4100000, 30),
(2025, 'salaried', 4100001, NULL, 35),

-- Non-salaried individuals
(2025, 'non_salaried', 0, 600000, 0),
(2025, 'non_salaried', 600001, 1200000, 15),
(2025, 'non_salaried', 1200001, 1600000, 20),
(2025, 'non_salaried', 1600001, 3200000, 30),
(2025, 'non_salaried', 3200001, 5600000, 40),
(2025, 'non_salaried', 5600001, NULL, 45);

-- Insert system settings
INSERT INTO system_settings (key, value, description) VALUES
('app_name', 'Pakistani Tax Advisor', 'Application name'),
('current_tax_year', '2024', 'Current tax year'),
('max_calculations_per_day', '50', 'Maximum calculations per user per day'),
('cache_expiry_hours', '24', 'Cache expiry time in hours'),
('enable_rate_limiting', 'true', 'Enable API rate limiting'),
('additional_tax_threshold', '10000000', 'Additional tax threshold (10M PKR)'),
('super_tax_threshold', '150000000', 'Super tax threshold (150M PKR)'),
('maintenance_mode', 'false', 'Enable maintenance mode');

-- =====================================
-- PERFORMANCE VIEWS
-- =====================================

-- View for user statistics
CREATE VIEW user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_last_30_days,
    COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as active_users_last_7_days
FROM users;

-- View for calculation statistics
CREATE VIEW calculation_stats AS
SELECT 
    COUNT(*) as total_calculations,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as calculations_last_24h,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as calculations_last_7_days,
    AVG(gross_income) as avg_income,
    AVG(total_tax) as avg_tax,
    COUNT(CASE WHEN tax_type = 'salaried' THEN 1 END) as salaried_calculations,
    COUNT(CASE WHEN tax_type = 'non_salaried' THEN 1 END) as non_salaried_calculations
FROM tax_calculations;

-- =====================================
-- CLEANUP PROCEDURES
-- =====================================

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (keep last 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- ANALYZE TABLES FOR OPTIMIZATION
-- =====================================
ANALYZE users;
ANALYZE tax_slabs;
ANALYZE tax_calculations;
ANALYZE user_sessions;
ANALYZE audit_log;
ANALYZE system_settings;

-- =====================================
-- GRANT PERMISSIONS
-- =====================================
-- Grant permissions to application user (create this user separately)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

COMMIT; 