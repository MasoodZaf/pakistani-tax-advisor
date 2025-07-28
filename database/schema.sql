-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core Tables

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT false,
    account_locked_until TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    require_password_change BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
    ('super_admin', 'Super Administrator with full system access', '{
        "users": {"create": true, "read": true, "update": true, "delete": true},
        "organizations": {"create": true, "read": true, "update": true, "delete": true},
        "tax_years": {"create": true, "read": true, "update": true, "delete": true},
        "tax_returns": {"create": true, "read": true, "update": true, "delete": true},
        "reports": {"create": true, "read": true, "export": true},
        "settings": {"update": true},
        "audit_logs": {"read": true}
    }'::jsonb),
    ('admin', 'Administrator with limited system access', '{
        "users": {"create": true, "read": true, "update": true, "delete": false},
        "organizations": {"create": true, "read": true, "update": true, "delete": false},
        "tax_years": {"create": false, "read": true, "update": false, "delete": false},
        "tax_returns": {"create": true, "read": true, "update": true, "delete": false},
        "reports": {"create": true, "read": true, "export": true},
        "settings": {"update": false},
        "audit_logs": {"read": true}
    }'::jsonb);

-- Insert default super admin user
INSERT INTO admin_users (
    username,
    email,
    password_hash,
    role_id,
    is_active,
    password_changed_at
) VALUES (
    'superadmin',
    'superadmin@taxadvisor.pk',
    crypt('Admin@123', gen_salt('bf')),  -- Change this password in production
    (SELECT id FROM roles WHERE name = 'super_admin'),
    true,
    CURRENT_TIMESTAMP
);

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(50) UNIQUE,
    tax_identification_number VARCHAR(50) UNIQUE,
    organization_type VARCHAR(50) NOT NULL,
    address JSONB,
    contact_info JSONB,
    subscription_plan VARCHAR(50),
    subscription_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    cnic VARCHAR(15) UNIQUE,
    name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    user_type VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    permissions JSONB,
    preferences JSONB,
    parent_user_id UUID,
    relationship_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT fk_parent_user FOREIGN KEY (parent_user_id) REFERENCES users(id),
    CONSTRAINT unique_user_id_email UNIQUE (id, email)
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_email FOREIGN KEY (user_email) REFERENCES users(email)
);

-- Tax years table
CREATE TABLE tax_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_year VARCHAR(10) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    filing_deadline DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_tax_year CHECK (tax_year ~ '^\d{4}-\d{2}$'),
    CONSTRAINT valid_dates CHECK (start_date < end_date AND end_date <= filing_deadline),
    CONSTRAINT unique_tax_year UNIQUE (tax_year),
    CONSTRAINT unique_tax_year_id_year UNIQUE (id, tax_year)
);

-- Tax slabs table
CREATE TABLE tax_slabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    slab_name VARCHAR(100) NOT NULL,
    slab_order INTEGER NOT NULL,
    min_income DECIMAL(15,2) NOT NULL,
    max_income DECIMAL(15,2),
    tax_rate DECIMAL(5,4) NOT NULL,
    slab_type VARCHAR(50) NOT NULL,
    applicable_to JSONB,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_slab_range CHECK (min_income >= 0 AND (max_income IS NULL OR max_income > min_income)),
    CONSTRAINT valid_tax_rate CHECK (tax_rate >= 0 AND tax_rate <= 1)
);

-- Tax returns table
CREATE TABLE tax_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    return_number VARCHAR(50) UNIQUE NOT NULL,
    filing_status VARCHAR(50) NOT NULL DEFAULT 'draft',
    filing_type VARCHAR(50) NOT NULL DEFAULT 'normal',
    submission_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Create indexes for core tables
CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_organizations_registration ON organizations(registration_number);
CREATE INDEX idx_organizations_tin ON organizations(tax_identification_number);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cnic ON users(cnic);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_parent ON users(parent_user_id);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, user_email);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_tax_years_year ON tax_years(tax_year);
CREATE INDEX idx_tax_years_current ON tax_years(is_current) WHERE is_current = true;
CREATE INDEX idx_tax_years_active ON tax_years(is_active) WHERE is_active = true;

CREATE INDEX idx_tax_slabs_year ON tax_slabs(tax_year_id);
CREATE INDEX idx_tax_slabs_order ON tax_slabs(tax_year_id, slab_order);
CREATE INDEX idx_tax_slabs_income ON tax_slabs(min_income, max_income);

CREATE INDEX idx_tax_returns_user ON tax_returns(user_id, user_email);
CREATE INDEX idx_tax_returns_year ON tax_returns(tax_year_id);
CREATE INDEX idx_tax_returns_status ON tax_returns(filing_status);
CREATE INDEX idx_tax_returns_number ON tax_returns(return_number);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_returns_updated_at
    BEFORE UPDATE ON tax_returns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Tax Form Tables

-- Income forms table
CREATE TABLE income_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    monthly_salary DECIMAL(15,2) DEFAULT 0,
    bonus DECIMAL(15,2) DEFAULT 0,
    car_allowance DECIMAL(15,2) DEFAULT 0,
    other_taxable DECIMAL(15,2) DEFAULT 0,
    salary_tax_deducted DECIMAL(15,2) DEFAULT 0,
    multiple_employer VARCHAR(1),
    additional_tax_deducted DECIMAL(15,2) DEFAULT 0,
    medical_allowance DECIMAL(15,2) DEFAULT 0,
    employer_contribution DECIMAL(15,2) DEFAULT 0,
    other_exempt DECIMAL(15,2) DEFAULT 0,
    other_sources DECIMAL(15,2) DEFAULT 0,
    total_gross_income DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(monthly_salary, 0) + 
        COALESCE(bonus, 0) + 
        COALESCE(car_allowance, 0) + 
        COALESCE(other_taxable, 0)
    ) STORED,
    total_exempt_income DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(medical_allowance, 0) + 
        COALESCE(employer_contribution, 0) + 
        COALESCE(other_exempt, 0)
    ) STORED,
    total_taxable_income DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(monthly_salary, 0) + 
        COALESCE(bonus, 0) + 
        COALESCE(car_allowance, 0) + 
        COALESCE(other_taxable, 0) - 
        (COALESCE(medical_allowance, 0) + COALESCE(employer_contribution, 0) + COALESCE(other_exempt, 0))
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tax_return FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year),
    CONSTRAINT fk_last_updated_by FOREIGN KEY (last_updated_by) REFERENCES users(id),
    CONSTRAINT valid_multiple_employer CHECK (multiple_employer IN ('Y', 'N') OR multiple_employer IS NULL)
);

-- Adjustable tax forms table
CREATE TABLE adjustable_tax_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    profit_on_debt DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_tax DECIMAL(15,2) DEFAULT 0,
    electricity_bill DECIMAL(15,2) DEFAULT 0,
    electricity_tax DECIMAL(15,2) DEFAULT 0,
    phone_bill DECIMAL(15,2) DEFAULT 0,
    phone_tax DECIMAL(15,2) DEFAULT 0,
    vehicle_amount DECIMAL(15,2) DEFAULT 0,
    vehicle_tax DECIMAL(15,2) DEFAULT 0,
    other_tax DECIMAL(15,2) DEFAULT 0,
    total_adjustable_tax DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(profit_on_debt_tax, 0) + 
        COALESCE(electricity_tax, 0) + 
        COALESCE(phone_tax, 0) + 
        COALESCE(vehicle_tax, 0) + 
        COALESCE(other_tax, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tax_return FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year),
    CONSTRAINT fk_last_updated_by FOREIGN KEY (last_updated_by) REFERENCES users(id)
);

-- Reductions forms table
CREATE TABLE reductions_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    teacher_amount DECIMAL(15,2) DEFAULT 0,
    teacher_reduction DECIMAL(15,2) DEFAULT 0,
    behbood_reduction DECIMAL(15,2) DEFAULT 0,
    export_income_reduction DECIMAL(15,2) DEFAULT 0,
    industrial_undertaking_reduction DECIMAL(15,2) DEFAULT 0,
    other_reductions DECIMAL(15,2) DEFAULT 0,
    total_reductions DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(teacher_reduction, 0) + 
        COALESCE(behbood_reduction, 0) + 
        COALESCE(export_income_reduction, 0) + 
        COALESCE(industrial_undertaking_reduction, 0) + 
        COALESCE(other_reductions, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Credits forms table
CREATE TABLE credits_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    charitable_donation DECIMAL(15,2) DEFAULT 0,
    pension_contribution DECIMAL(15,2) DEFAULT 0,
    life_insurance_premium DECIMAL(15,2) DEFAULT 0,
    investment_tax_credit DECIMAL(15,2) DEFAULT 0,
    other_credits DECIMAL(15,2) DEFAULT 0,
    total_credits DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(charitable_donation, 0) + 
        COALESCE(pension_contribution, 0) + 
        COALESCE(life_insurance_premium, 0) + 
        COALESCE(investment_tax_credit, 0) + 
        COALESCE(other_credits, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Deductions forms table
CREATE TABLE deductions_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    zakat DECIMAL(15,2) DEFAULT 0,
    ushr DECIMAL(15,2) DEFAULT 0,
    tax_paid_foreign_country DECIMAL(15,2) DEFAULT 0,
    advance_tax DECIMAL(15,2) DEFAULT 0,
    other_deductions DECIMAL(15,2) DEFAULT 0,
    total_deductions DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(zakat, 0) + 
        COALESCE(ushr, 0) + 
        COALESCE(tax_paid_foreign_country, 0) + 
        COALESCE(advance_tax, 0) + 
        COALESCE(other_deductions, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Create indexes for form tables
CREATE INDEX idx_income_forms_user ON income_forms(user_id, user_email);
CREATE INDEX idx_income_forms_return ON income_forms(tax_return_id);
CREATE INDEX idx_income_forms_year ON income_forms(tax_year_id, tax_year);

CREATE INDEX idx_adjustable_tax_forms_user ON adjustable_tax_forms(user_id, user_email);
CREATE INDEX idx_adjustable_tax_forms_return ON adjustable_tax_forms(tax_return_id);
CREATE INDEX idx_adjustable_tax_forms_year ON adjustable_tax_forms(tax_year_id, tax_year);

CREATE INDEX idx_reductions_forms_user ON reductions_forms(user_id, user_email);
CREATE INDEX idx_reductions_forms_return ON reductions_forms(tax_return_id);
CREATE INDEX idx_reductions_forms_year ON reductions_forms(tax_year_id, tax_year);

CREATE INDEX idx_credits_forms_user ON credits_forms(user_id, user_email);
CREATE INDEX idx_credits_forms_return ON credits_forms(tax_return_id);
CREATE INDEX idx_credits_forms_year ON credits_forms(tax_year_id, tax_year);

CREATE INDEX idx_deductions_forms_user ON deductions_forms(user_id, user_email);
CREATE INDEX idx_deductions_forms_return ON deductions_forms(tax_return_id);
CREATE INDEX idx_deductions_forms_year ON deductions_forms(tax_year_id, tax_year);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_income_forms_updated_at
    BEFORE UPDATE ON income_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_adjustable_tax_forms_updated_at
    BEFORE UPDATE ON adjustable_tax_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reductions_forms_updated_at
    BEFORE UPDATE ON reductions_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credits_forms_updated_at
    BEFORE UPDATE ON credits_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deductions_forms_updated_at
    BEFORE UPDATE ON deductions_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 

-- Final tax forms table
CREATE TABLE final_tax_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    sukuk_amount DECIMAL(15,2) DEFAULT 0,
    sukuk_tax_rate DECIMAL(5,4) DEFAULT 0.10,
    sukuk_tax_amount DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(sukuk_amount, 0) * COALESCE(sukuk_tax_rate, 0.10)
    ) STORED,
    debt_amount DECIMAL(15,2) DEFAULT 0,
    debt_tax_rate DECIMAL(5,4) DEFAULT 0.15,
    debt_tax_amount DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(debt_amount, 0) * COALESCE(debt_tax_rate, 0.15)
    ) STORED,
    prize_bonds DECIMAL(15,2) DEFAULT 0,
    prize_bonds_tax DECIMAL(15,2) DEFAULT 0,
    other_final_tax_amount DECIMAL(15,2) DEFAULT 0,
    other_final_tax DECIMAL(15,2) DEFAULT 0,
    total_final_tax DECIMAL(15,2) GENERATED ALWAYS AS (
        (COALESCE(sukuk_amount, 0) * COALESCE(sukuk_tax_rate, 0.10)) +
        (COALESCE(debt_amount, 0) * COALESCE(debt_tax_rate, 0.15)) +
        COALESCE(prize_bonds_tax, 0) +
        COALESCE(other_final_tax, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Capital gain forms table
CREATE TABLE capital_gain_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    property_1_year DECIMAL(15,2) DEFAULT 0,
    property_1_year_tax_rate DECIMAL(5,4) DEFAULT 0.15,
    property_1_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_1_year_tax_due DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(property_1_year, 0) * COALESCE(property_1_year_tax_rate, 0.15) - 
        COALESCE(property_1_year_tax_deducted, 0)
    ) STORED,
    property_2_3_years DECIMAL(15,2) DEFAULT 0,
    property_2_3_years_tax_rate DECIMAL(5,4) DEFAULT 0.10,
    property_2_3_years_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_2_3_years_tax_due DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(property_2_3_years, 0) * COALESCE(property_2_3_years_tax_rate, 0.10) - 
        COALESCE(property_2_3_years_tax_deducted, 0)
    ) STORED,
    property_4_plus_years DECIMAL(15,2) DEFAULT 0,
    property_4_plus_years_tax_deducted DECIMAL(15,2) DEFAULT 0,
    securities DECIMAL(15,2) DEFAULT 0,
    securities_tax_rate DECIMAL(5,4) DEFAULT 0.125,
    securities_tax_deducted DECIMAL(15,2) DEFAULT 0,
    securities_tax_due DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(securities, 0) * COALESCE(securities_tax_rate, 0.125) - 
        COALESCE(securities_tax_deducted, 0)
    ) STORED,
    other_capital_gains DECIMAL(15,2) DEFAULT 0,
    other_capital_gains_tax DECIMAL(15,2) DEFAULT 0,
    total_capital_gains DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(property_1_year, 0) + 
        COALESCE(property_2_3_years, 0) + 
        COALESCE(property_4_plus_years, 0) + 
        COALESCE(securities, 0) + 
        COALESCE(other_capital_gains, 0)
    ) STORED,
    total_capital_gains_tax DECIMAL(15,2) GENERATED ALWAYS AS (
        (COALESCE(property_1_year, 0) * COALESCE(property_1_year_tax_rate, 0.15)) +
        (COALESCE(property_2_3_years, 0) * COALESCE(property_2_3_years_tax_rate, 0.10)) +
        (COALESCE(securities, 0) * COALESCE(securities_tax_rate, 0.125)) +
        COALESCE(other_capital_gains_tax, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Expenses forms table
CREATE TABLE expenses_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    rent DECIMAL(15,2) DEFAULT 0,
    rates DECIMAL(15,2) DEFAULT 0,
    income_tax DECIMAL(15,2) DEFAULT 0,
    vehicle DECIMAL(15,2) DEFAULT 0,
    travelling DECIMAL(15,2) DEFAULT 0,
    electricity DECIMAL(15,2) DEFAULT 0,
    water DECIMAL(15,2) DEFAULT 0,
    gas DECIMAL(15,2) DEFAULT 0,
    telephone DECIMAL(15,2) DEFAULT 0,
    medical DECIMAL(15,2) DEFAULT 0,
    educational DECIMAL(15,2) DEFAULT 0,
    donations DECIMAL(15,2) DEFAULT 0,
    other_expenses DECIMAL(15,2) DEFAULT 0,
    entertainment DECIMAL(15,2) DEFAULT 0,
    maintenance DECIMAL(15,2) DEFAULT 0,
    total_expenses DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(rent, 0) + COALESCE(rates, 0) + 
        COALESCE(income_tax, 0) + COALESCE(vehicle, 0) + 
        COALESCE(travelling, 0) + COALESCE(electricity, 0) + 
        COALESCE(water, 0) + COALESCE(gas, 0) + 
        COALESCE(telephone, 0) + COALESCE(medical, 0) + 
        COALESCE(educational, 0) + COALESCE(donations, 0) + 
        COALESCE(other_expenses, 0) + COALESCE(entertainment, 0) + 
        COALESCE(maintenance, 0)
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Wealth forms table
CREATE TABLE wealth_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    property_previous_year DECIMAL(15,2) DEFAULT 0,
    investment_previous_year DECIMAL(15,2) DEFAULT 0,
    vehicle_previous_year DECIMAL(15,2) DEFAULT 0,
    jewelry_previous_year DECIMAL(15,2) DEFAULT 0,
    cash_previous_year DECIMAL(15,2) DEFAULT 0,
    pf_previous_year DECIMAL(15,2) DEFAULT 0,
    bank_balance_previous_year DECIMAL(15,2) DEFAULT 0,
    other_assets_previous_year DECIMAL(15,2) DEFAULT 0,
    property_current_year DECIMAL(15,2) DEFAULT 0,
    investment_current_year DECIMAL(15,2) DEFAULT 0,
    vehicle_current_year DECIMAL(15,2) DEFAULT 0,
    jewelry_current_year DECIMAL(15,2) DEFAULT 0,
    cash_current_year DECIMAL(15,2) DEFAULT 0,
    pf_current_year DECIMAL(15,2) DEFAULT 0,
    bank_balance_current_year DECIMAL(15,2) DEFAULT 0,
    other_assets_current_year DECIMAL(15,2) DEFAULT 0,
    loan_previous_year DECIMAL(15,2) DEFAULT 0,
    loan_current_year DECIMAL(15,2) DEFAULT 0,
    other_liabilities_previous_year DECIMAL(15,2) DEFAULT 0,
    other_liabilities_current_year DECIMAL(15,2) DEFAULT 0,
    total_assets_previous_year DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(property_previous_year, 0) + 
        COALESCE(investment_previous_year, 0) + 
        COALESCE(vehicle_previous_year, 0) + 
        COALESCE(jewelry_previous_year, 0) + 
        COALESCE(cash_previous_year, 0) + 
        COALESCE(pf_previous_year, 0) + 
        COALESCE(bank_balance_previous_year, 0) + 
        COALESCE(other_assets_previous_year, 0)
    ) STORED,
    total_assets_current_year DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(property_current_year, 0) + 
        COALESCE(investment_current_year, 0) + 
        COALESCE(vehicle_current_year, 0) + 
        COALESCE(jewelry_current_year, 0) + 
        COALESCE(cash_current_year, 0) + 
        COALESCE(pf_current_year, 0) + 
        COALESCE(bank_balance_current_year, 0) + 
        COALESCE(other_assets_current_year, 0)
    ) STORED,
    total_liabilities_previous_year DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(loan_previous_year, 0) + 
        COALESCE(other_liabilities_previous_year, 0)
    ) STORED,
    total_liabilities_current_year DECIMAL(15,2) GENERATED ALWAYS AS (
        COALESCE(loan_current_year, 0) + 
        COALESCE(other_liabilities_current_year, 0)
    ) STORED,
    net_worth_previous_year DECIMAL(15,2) GENERATED ALWAYS AS (
        (COALESCE(property_previous_year, 0) + 
         COALESCE(investment_previous_year, 0) + 
         COALESCE(vehicle_previous_year, 0) + 
         COALESCE(jewelry_previous_year, 0) + 
         COALESCE(cash_previous_year, 0) + 
         COALESCE(pf_previous_year, 0) + 
         COALESCE(bank_balance_previous_year, 0) + 
         COALESCE(other_assets_previous_year, 0)) -
        (COALESCE(loan_previous_year, 0) + 
         COALESCE(other_liabilities_previous_year, 0))
    ) STORED,
    net_worth_current_year DECIMAL(15,2) GENERATED ALWAYS AS (
        (COALESCE(property_current_year, 0) + 
         COALESCE(investment_current_year, 0) + 
         COALESCE(vehicle_current_year, 0) + 
         COALESCE(jewelry_current_year, 0) + 
         COALESCE(cash_current_year, 0) + 
         COALESCE(pf_current_year, 0) + 
         COALESCE(bank_balance_current_year, 0) + 
         COALESCE(other_assets_current_year, 0)) -
        (COALESCE(loan_current_year, 0) + 
         COALESCE(other_liabilities_current_year, 0))
    ) STORED,
    wealth_increase DECIMAL(15,2) GENERATED ALWAYS AS (
        (COALESCE(property_current_year, 0) + 
         COALESCE(investment_current_year, 0) + 
         COALESCE(vehicle_current_year, 0) + 
         COALESCE(jewelry_current_year, 0) + 
         COALESCE(cash_current_year, 0) + 
         COALESCE(pf_current_year, 0) + 
         COALESCE(bank_balance_current_year, 0) + 
         COALESCE(other_assets_current_year, 0)) -
        (COALESCE(loan_current_year, 0) + 
         COALESCE(other_liabilities_current_year, 0)) -
        ((COALESCE(property_previous_year, 0) + 
          COALESCE(investment_previous_year, 0) + 
          COALESCE(vehicle_previous_year, 0) + 
          COALESCE(jewelry_previous_year, 0) + 
          COALESCE(cash_previous_year, 0) + 
          COALESCE(pf_previous_year, 0) + 
          COALESCE(bank_balance_previous_year, 0) + 
          COALESCE(other_assets_previous_year, 0)) -
         (COALESCE(loan_previous_year, 0) + 
          COALESCE(other_liabilities_previous_year, 0)))
    ) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Form completion status table
CREATE TABLE form_completion_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    income_form_complete BOOLEAN DEFAULT false,
    adjustable_tax_form_complete BOOLEAN DEFAULT false,
    reductions_form_complete BOOLEAN DEFAULT false,
    credits_form_complete BOOLEAN DEFAULT false,
    deductions_form_complete BOOLEAN DEFAULT false,
    final_tax_form_complete BOOLEAN DEFAULT false,
    capital_gain_form_complete BOOLEAN DEFAULT false,
    expenses_form_complete BOOLEAN DEFAULT false,
    wealth_form_complete BOOLEAN DEFAULT false,
    all_forms_complete BOOLEAN GENERATED ALWAYS AS (
        CASE WHEN 
            income_form_complete AND
            adjustable_tax_form_complete AND
            reductions_form_complete AND
            credits_form_complete AND
            deductions_form_complete AND
            final_tax_form_complete AND
            capital_gain_form_complete AND
            expenses_form_complete AND
            wealth_form_complete
        THEN true ELSE false END
    ) STORED,
    completion_percentage INTEGER GENERATED ALWAYS AS (
        (CASE WHEN income_form_complete THEN 1 ELSE 0 END +
         CASE WHEN adjustable_tax_form_complete THEN 1 ELSE 0 END +
         CASE WHEN reductions_form_complete THEN 1 ELSE 0 END +
         CASE WHEN credits_form_complete THEN 1 ELSE 0 END +
         CASE WHEN deductions_form_complete THEN 1 ELSE 0 END +
         CASE WHEN final_tax_form_complete THEN 1 ELSE 0 END +
         CASE WHEN capital_gain_form_complete THEN 1 ELSE 0 END +
         CASE WHEN expenses_form_complete THEN 1 ELSE 0 END +
         CASE WHEN wealth_form_complete THEN 1 ELSE 0 END) * 100 / 9
    ) STORED,
    last_form_updated VARCHAR(50),
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Tax calculations table
CREATE TABLE tax_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL REFERENCES tax_returns(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL REFERENCES tax_years(id),
    tax_year VARCHAR(10) NOT NULL,
    calculation_type VARCHAR(50) NOT NULL,
    calculation_version VARCHAR(20) NOT NULL,
    engine_version VARCHAR(20),
    gross_income DECIMAL(15,2) NOT NULL,
    exempt_income DECIMAL(15,2) NOT NULL,
    taxable_income DECIMAL(15,2) NOT NULL,
    normal_tax DECIMAL(15,2) NOT NULL,
    tax_reductions DECIMAL(15,2) NOT NULL,
    tax_credits DECIMAL(15,2) NOT NULL,
    final_tax DECIMAL(15,2) NOT NULL,
    capital_gains_tax DECIMAL(15,2) NOT NULL,
    total_tax_liability DECIMAL(15,2) NOT NULL,
    advance_tax_paid DECIMAL(15,2) NOT NULL,
    adjustable_tax_paid DECIMAL(15,2) NOT NULL,
    total_tax_paid DECIMAL(15,2) NOT NULL,
    refund_due DECIMAL(15,2) NOT NULL,
    additional_tax_due DECIMAL(15,2) NOT NULL,
    calculation_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    is_final BOOLEAN DEFAULT false,
    superseded_by UUID REFERENCES tax_calculations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
    CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year)
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email VARCHAR(255) NOT NULL,
    session_id UUID,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    field_name VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    change_summary TEXT,
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    severity VARCHAR(20),
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email)
);

-- Create indexes for remaining tables
CREATE INDEX idx_final_tax_forms_user ON final_tax_forms(user_id, user_email);
CREATE INDEX idx_final_tax_forms_return ON final_tax_forms(tax_return_id);
CREATE INDEX idx_final_tax_forms_year ON final_tax_forms(tax_year_id, tax_year);

CREATE INDEX idx_capital_gain_forms_user ON capital_gain_forms(user_id, user_email);
CREATE INDEX idx_capital_gain_forms_return ON capital_gain_forms(tax_return_id);
CREATE INDEX idx_capital_gain_forms_year ON capital_gain_forms(tax_year_id, tax_year);

CREATE INDEX idx_expenses_forms_user ON expenses_forms(user_id, user_email);
CREATE INDEX idx_expenses_forms_return ON expenses_forms(tax_return_id);
CREATE INDEX idx_expenses_forms_year ON expenses_forms(tax_year_id, tax_year);

CREATE INDEX idx_wealth_forms_user ON wealth_forms(user_id, user_email);
CREATE INDEX idx_wealth_forms_return ON wealth_forms(tax_return_id);
CREATE INDEX idx_wealth_forms_year ON wealth_forms(tax_year_id, tax_year);

CREATE INDEX idx_completion_status_user ON form_completion_status(user_id, user_email);
CREATE INDEX idx_completion_status_return ON form_completion_status(tax_return_id);
CREATE INDEX idx_completion_status_year ON form_completion_status(tax_year_id, tax_year);
CREATE INDEX idx_completion_status_complete ON form_completion_status(all_forms_complete) WHERE all_forms_complete = true;

CREATE INDEX idx_tax_calculations_user ON tax_calculations(user_id, user_email);
CREATE INDEX idx_tax_calculations_return ON tax_calculations(tax_return_id);
CREATE INDEX idx_tax_calculations_year ON tax_calculations(tax_year_id, tax_year);
CREATE INDEX idx_tax_calculations_final ON tax_calculations(is_final) WHERE is_final = true;

CREATE INDEX idx_audit_log_user ON audit_log(user_id, user_email);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_final_tax_forms_updated_at
    BEFORE UPDATE ON final_tax_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capital_gain_forms_updated_at
    BEFORE UPDATE ON capital_gain_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_forms_updated_at
    BEFORE UPDATE ON expenses_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wealth_forms_updated_at
    BEFORE UPDATE ON wealth_forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add audit triggers
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSON;
    new_data JSON;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        old_data = row_to_json(OLD);
        INSERT INTO audit_log (
            user_id, user_email, action, table_name, record_id,
            old_value, change_summary, category
        )
        VALUES (
            OLD.user_id, OLD.user_email, 'DELETE', TG_TABLE_NAME, OLD.id,
            old_data::text, 'Record deleted', TG_TABLE_NAME || '_delete'
        );
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        old_data = row_to_json(OLD);
        new_data = row_to_json(NEW);
        INSERT INTO audit_log (
            user_id, user_email, action, table_name, record_id,
            old_value, new_value, change_summary, category
        )
        VALUES (
            NEW.user_id, NEW.user_email, 'UPDATE', TG_TABLE_NAME, NEW.id,
            old_data::text, new_data::text,
            'Record updated', TG_TABLE_NAME || '_update'
        );
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        new_data = row_to_json(NEW);
        INSERT INTO audit_log (
            user_id, user_email, action, table_name, record_id,
            new_value, change_summary, category
        )
        VALUES (
            NEW.user_id, NEW.user_email, 'INSERT', TG_TABLE_NAME, NEW.id,
            new_data::text, 'Record created', TG_TABLE_NAME || '_insert'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for all form tables
CREATE TRIGGER audit_income_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON income_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_adjustable_tax_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON adjustable_tax_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_reductions_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reductions_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_credits_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON credits_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_deductions_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON deductions_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_final_tax_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON final_tax_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_capital_gain_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON capital_gain_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_expenses_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON expenses_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_wealth_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON wealth_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Insert initial tax year and slabs for 2024-25
INSERT INTO tax_years (
    tax_year, start_date, end_date, filing_deadline, is_current, is_active, description
) VALUES (
    '2024-25',
    '2024-07-01',
    '2025-06-30',
    '2025-09-30',
    true,
    true,
    'Tax Year 2024-25'
);

-- Insert tax slabs for 2024-25
WITH tax_year AS (SELECT id FROM tax_years WHERE tax_year = '2024-25')
INSERT INTO tax_slabs (
    tax_year_id, slab_name, slab_order, min_income, max_income, tax_rate,
    slab_type, applicable_to, effective_from, effective_to
) VALUES
    ((SELECT id FROM tax_year), 'Slab 1', 1, 0, 600000, 0.00, 'individual', '{"individual": true}', '2024-07-01', '2025-06-30'),
    ((SELECT id FROM tax_year), 'Slab 2', 2, 600001, 1200000, 0.05, 'individual', '{"individual": true}', '2024-07-01', '2025-06-30'),
    ((SELECT id FROM tax_year), 'Slab 3', 3, 1200001, 2200000, 0.15, 'individual', '{"individual": true}', '2024-07-01', '2025-06-30'),
    ((SELECT id FROM tax_year), 'Slab 4', 4, 2200001, 3200000, 0.25, 'individual', '{"individual": true}', '2024-07-01', '2025-06-30'),
    ((SELECT id FROM tax_year), 'Slab 5', 5, 3200001, 4100000, 0.30, 'individual', '{"individual": true}', '2024-07-01', '2025-06-30'),
    ((SELECT id FROM tax_year), 'Slab 6', 6, 4100001, NULL, 0.35, 'individual', '{"individual": true}', '2024-07-01', '2025-06-30'); 