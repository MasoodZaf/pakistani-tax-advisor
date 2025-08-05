-- Create Admin and Super Admin accounts with comprehensive sample data
-- This script creates administrative users with different permission levels

-- First, create administrative organizations
INSERT INTO organizations (
    id, name, registration_number, tax_identification_number, 
    organization_type, address, contact_info, subscription_plan, 
    subscription_expires_at, is_active, created_at
) VALUES
    -- Tax Advisory Firm (for Admin)
    (
        uuid_generate_v4(),
        'Pakistan Tax Advisory Services',
        'REG-ADMIN-001',
        'TIN-ADMIN-001',
        'professional_services',
        '{"street": "Blue Area, Main Boulevard", "city": "Islamabad", "province": "Punjab", "postal_code": "44000"}',
        '{"phone": "+92-51-1111111", "email": "admin@paktaxadvisory.com"}',
        'enterprise',
        '2030-12-31',
        true,
        NOW()
    ),
    
    -- System Management Company (for Super Admin)
    (
        uuid_generate_v4(),
        'Pakistani Tax Advisor System HQ',
        'REG-SUPERADMIN-001',
        'TIN-SUPERADMIN-001',
        'technology',
        '{"street": "F-6/1, Diplomatic Enclave", "city": "Islamabad", "province": "Punjab", "postal_code": "44000"}',
        '{"phone": "+92-51-2222222", "email": "superadmin@paktaxadvisor.com"}',
        'enterprise',
        '2030-12-31',
        true,
        NOW()
    );

-- Create Admin and Super Admin user accounts
INSERT INTO users (
    id, organization_id, email, phone, cnic, name, date_of_birth,
    password_hash, email_verified, user_type, role, permissions,
    preferences, is_active, created_at
) VALUES
    -- ADMIN USER: Tax Professional with administrative access
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Pakistan Tax Advisory Services' LIMIT 1),
        'admin@paktaxadvisory.com',
        '+92-300-ADMIN01',
        '35202-ADMIN01-1',
        'Ahmed Ali Khan (Admin)',
        '1985-06-15',
        crypt('Admin123!@#', gen_salt('bf')),
        true,
        'admin',
        'admin',
        '{
            "users": {"create": true, "read": true, "update": true, "delete": false},
            "forms": {"create": true, "read": true, "update": true, "delete": true},
            "tax_returns": {"create": true, "read": true, "update": true, "delete": false},
            "organizations": {"create": false, "read": true, "update": true, "delete": false},
            "tax_slabs": {"create": false, "read": true, "update": false, "delete": false},
            "reports": {"create": true, "read": true, "update": true, "delete": false},
            "audit_logs": {"create": false, "read": true, "update": false, "delete": false},
            "settings": {"read": true, "update": false}
        }',
        '{"language": "en", "currency": "PKR", "notifications": true, "theme": "light", "dashboard": "admin"}',
        true,
        NOW()
    ),
    
    -- SUPER ADMIN USER: System administrator with full access
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Pakistani Tax Advisor System HQ' LIMIT 1),
        'superadmin@paktaxadvisor.com',
        '+92-300-SUPER01',
        '35202-SUPER01-1',
        'Muhammad Hassan (Super Admin)',
        '1980-03-10',
        crypt('SuperAdmin123!@#', gen_salt('bf')),
        true,
        'super_admin',
        'super_admin',
        '{
            "users": {"create": true, "read": true, "update": true, "delete": true},
            "forms": {"create": true, "read": true, "update": true, "delete": true},
            "tax_returns": {"create": true, "read": true, "update": true, "delete": true},
            "organizations": {"create": true, "read": true, "update": true, "delete": true},
            "tax_slabs": {"create": true, "read": true, "update": true, "delete": true},
            "reports": {"create": true, "read": true, "update": true, "delete": true},
            "audit_logs": {"create": true, "read": true, "update": true, "delete": true},
            "settings": {"read": true, "update": true},
            "system": {"backup": true, "restore": true, "maintenance": true, "logs": true}
        }',
        '{"language": "en", "currency": "PKR", "notifications": true, "theme": "dark", "dashboard": "super_admin"}',
        true,
        NOW()
    );

-- Create tax returns for admin users to demonstrate their own tax situations
INSERT INTO tax_returns (
    id, user_id, user_email, tax_year_id, tax_year, return_number, 
    filing_status, filing_type, created_at
) VALUES
    -- Admin's tax return
    (uuid_generate_v4(), 
     (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'), 
     'admin@paktaxadvisory.com', 
     (SELECT id FROM tax_years WHERE tax_year = '2025-26'), 
     '2025-26', 
     'TR-2025-ADMIN', 
     'filed', 
     'normal', 
     NOW()),
    
    -- Super Admin's tax return
    (uuid_generate_v4(), 
     (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'), 
     'superadmin@paktaxadvisor.com', 
     (SELECT id FROM tax_years WHERE tax_year = '2025-26'), 
     '2025-26', 
     'TR-2025-SUPERADMIN', 
     'filed', 
     'normal', 
     NOW());

-- Sample tax data for ADMIN USER (Tax Professional earning PKR 500,000/month)
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    500000,    -- Monthly salary: PKR 500,000 (Annual: 6,000,000)
    1000000,   -- Annual bonus
    300000,    -- Car allowance: PKR 25,000/month
    150000,    -- Professional consultation income
    1095000,   -- Tax deducted (calculated on slabs)
    'Y',       -- Multiple income sources (salary + consultation)
    25000,     -- Additional tax from consultation
    40000,     -- Medical allowance (exempt)
    75000,     -- Employer PF contribution (exempt)
    20000,     -- Other exempt allowances
    800000,    -- Professional consultation and advisory income
    true,      -- Form complete
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO adjustable_tax_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
    phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    100000, 15000,    -- Profit on debt with 15% withholding
    84000, 12600,     -- Professional office electricity
    36000, 5400,      -- Multiple phone connections
    7000000, 700000,  -- Professional vehicle purchase with advance tax
    15000,            -- Other equipment taxes
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO reductions_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    teacher_amount, teacher_reduction, behbood_reduction,
    export_income_reduction, industrial_undertaking_reduction, other_reductions,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    0, 0,           -- Not a teacher
    0,              -- No behbood reduction
    0,              -- No export income
    0,              -- No industrial undertaking
    0,              -- No other reductions
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO credits_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    charitable_donation, pension_contribution, life_insurance_premium,
    investment_tax_credit, other_credits,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    150000,         -- Charitable donations (professional giving)
    100000,         -- Additional pension contribution
    80000,          -- Life insurance premium
    75000,          -- Investment tax credit
    25000,          -- Other professional credits
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO deductions_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    0,              -- No zakat deduction
    0,              -- No ushr
    0,              -- No foreign tax
    80000,          -- Advance tax paid
    15000,          -- Other professional deductions
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO final_tax_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    sukuk_amount, sukuk_tax_rate, debt_amount, debt_tax_rate,
    prize_bonds, prize_bonds_tax, other_final_tax_amount, other_final_tax,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    1500000, 0.10,  -- Sukuk investments with 10% final tax
    500000, 0.15,   -- Debt securities with 15% final tax
    100000, 25000,  -- Prize bonds with tax
    0, 0,           -- No other final tax investments
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO capital_gain_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    property_1_year, property_1_year_tax_rate, property_1_year_tax_deducted,
    property_2_3_years, property_2_3_years_tax_rate, property_2_3_years_tax_deducted,
    property_4_plus_years, property_4_plus_years_tax_deducted,
    securities, securities_tax_rate, securities_tax_deducted,
    other_capital_gains, other_capital_gains_tax,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    0, 0.15, 0,                     -- No property sale within 1 year
    3000000, 0.10, 300000,          -- Property sale 2-3 years with 10% tax
    0, 0,                           -- No property sale 4+ years
    800000, 0.125, 100000,          -- Securities trading with 12.5% tax
    0, 0,                           -- No other capital gains
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO expenses_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    rent, rates, income_tax, vehicle, travelling, electricity, water, gas,
    telephone, medical, educational, donations, other_expenses,
    entertainment, maintenance,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    480000,     -- Professional office rent: PKR 40,000/month
    12000,      -- Property rates
    0,          -- No income tax expense
    150000,     -- Vehicle expenses for professional use
    180000,     -- Professional travel and client meetings
    84000,      -- Office electricity
    24000,      -- Water bills
    60000,      -- Gas bills
    36000,      -- Professional telephone/internet
    50000,      -- Medical expenses
    80000,      -- Professional development and courses
    150000,     -- Professional charitable donations
    200000,     -- Other professional expenses (software, subscriptions)
    100000,     -- Client entertainment
    120000,     -- Office equipment maintenance
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

INSERT INTO wealth_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    property_previous_year, investment_previous_year, vehicle_previous_year,
    jewelry_previous_year, cash_previous_year, pf_previous_year,
    bank_balance_previous_year, other_assets_previous_year,
    property_current_year, investment_current_year, vehicle_current_year,
    jewelry_current_year, cash_current_year, pf_current_year,
    bank_balance_current_year, other_assets_current_year,
    loan_previous_year, loan_current_year,
    other_liabilities_previous_year, other_liabilities_current_year,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    'admin@paktaxadvisory.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    15000000, 2000000, 5000000, 300000, 200000, 800000, 1500000, 500000,    -- Previous: 25.3M
    12000000, 3200000, 12000000, 350000, 300000, 875000, 2000000, 800000,   -- Current: 31.525M (sold property, bought vehicle)
    8000000, 7000000,                                                        -- Professional loans
    150000, 100000,                                                          -- Other liabilities
    true,
    (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
    NOW()
);

-- Sample tax data for SUPER ADMIN USER (System Administrator earning PKR 800,000/month)
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    800000,    -- Monthly salary: PKR 800,000 (Annual: 9,600,000)
    2400000,   -- Annual bonus (3 months)
    480000,    -- Car allowance: PKR 40,000/month
    300000,    -- Stock options and other benefits
    2145000,   -- Tax deducted (calculated on High Income bracket)
    'N',       -- Single employer
    0,         -- No additional tax deducted
    60000,     -- Medical allowance (exempt)
    120000,    -- Employer PF contribution (exempt)
    30000,     -- Other exempt allowances
    1200000,   -- Technology consulting and system design income
    true,      -- Form complete
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO adjustable_tax_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
    phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    400000, 60000,      -- Larger profit on debt investments
    120000, 18000,      -- High-end home office electricity
    48000, 7200,        -- Multiple premium phone connections
    12000000, 1200000,  -- Luxury vehicle purchase with advance tax
    50000,              -- High-end equipment and technology taxes
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO reductions_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    teacher_amount, teacher_reduction, behbood_reduction,
    export_income_reduction, industrial_undertaking_reduction, other_reductions,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    0, 0,               -- Not a teacher
    0,                  -- No behbood reduction
    1200000,            -- Export income reduction (IT consulting to international clients)
    0,                  -- No industrial undertaking
    0,                  -- No other reductions
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO credits_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    charitable_donation, pension_contribution, life_insurance_premium,
    investment_tax_credit, other_credits,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    300000,             -- Large charitable donations (tech education initiatives)
    200000,             -- Substantial pension contribution
    120000,             -- Multiple life insurance policies
    150000,             -- Technology investment tax credit
    75000,              -- Other tech-related credits
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO deductions_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    0,                  -- No zakat deduction
    0,                  -- No ushr
    120000,             -- Tax paid in foreign countries (international consulting)
    250000,             -- Large advance tax payment
    50000,              -- Other professional deductions
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO final_tax_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    sukuk_amount, sukuk_tax_rate, debt_amount, debt_tax_rate,
    prize_bonds, prize_bonds_tax, other_final_tax_amount, other_final_tax,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    3000000, 0.10,      -- Large Sukuk investment portfolio
    1000000, 0.15,      -- Substantial debt securities
    200000, 50000,      -- Prize bonds with tax deducted
    500000, 100000,     -- Other technology-related final tax investments
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO capital_gain_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    property_1_year, property_1_year_tax_rate, property_1_year_tax_deducted,
    property_2_3_years, property_2_3_years_tax_rate, property_2_3_years_tax_deducted,
    property_4_plus_years, property_4_plus_years_tax_deducted,
    securities, securities_tax_rate, securities_tax_deducted,
    other_capital_gains, other_capital_gains_tax,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    0, 0.15, 0,                         -- No property speculation
    8000000, 0.10, 800000,              -- Strategic property sale 2-3 years
    5000000, 0,                         -- Long-term property holdings (exempt)
    2000000, 0.125, 250000,             -- Technology stock trading
    500000, 125000,                     -- Other capital gains (tech assets)
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO expenses_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    rent, rates, income_tax, vehicle, travelling, electricity, water, gas,
    telephone, medical, educational, donations, other_expenses,
    entertainment, maintenance,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    600000,     -- Premium home office space: PKR 50,000/month
    18000,      -- Property rates
    0,          -- No income tax expense
    200000,     -- High-end vehicle expenses
    300000,     -- International travel for tech conferences
    120000,     -- High-end home office electricity (servers, equipment)
    36000,      -- Water bills
    72000,      -- Gas bills
    48000,      -- Premium internet and communication services
    80000,      -- Premium healthcare
    150000,     -- Advanced technology certifications and training
    300000,     -- Technology education charitable donations
    400000,     -- High-end equipment, software licenses, cloud services
    150000,     -- Professional networking and conferences
    200000,     -- Equipment maintenance and upgrades
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

INSERT INTO wealth_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    property_previous_year, investment_previous_year, vehicle_previous_year,
    jewelry_previous_year, cash_previous_year, pf_previous_year,
    bank_balance_previous_year, other_assets_previous_year,
    property_current_year, investment_current_year, vehicle_current_year,
    jewelry_current_year, cash_current_year, pf_current_year,
    bank_balance_current_year, other_assets_current_year,
    loan_previous_year, loan_current_year,
    other_liabilities_previous_year, other_liabilities_current_year,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'),
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    'superadmin@paktaxadvisor.com',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    30000000, 8000000, 10000000, 400000, 500000, 1500000, 3000000, 2000000,    -- Previous: 55.4M
    22000000, 15000000, 22000000, 500000, 800000, 1620000, 5000000, 5000000,   -- Current: 71.92M (strategic changes)
    15000000, 12000000,                                                         -- Technology business loans
    300000, 200000,                                                             -- Other liabilities
    true,
    (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
    NOW()
);

-- Create form completion status for admin users
INSERT INTO form_completion_status (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    income_form_complete, adjustable_tax_form_complete, reductions_form_complete,
    credits_form_complete, deductions_form_complete, final_tax_form_complete,
    capital_gain_form_complete, expenses_form_complete, wealth_form_complete,
    created_at
) VALUES
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-ADMIN'), 
     (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'), 
     'admin@paktaxadvisory.com', 
     (SELECT id FROM tax_years WHERE tax_year = '2025-26'), 
     '2025-26', 
     true, true, true, true, true, true, true, true, true, NOW()),
     
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-SUPERADMIN'), 
     (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'), 
     'superadmin@paktaxadvisor.com', 
     (SELECT id FROM tax_years WHERE tax_year = '2025-26'), 
     '2025-26', 
     true, true, true, true, true, true, true, true, true, NOW());

-- Insert audit log entries for admin account creation
INSERT INTO audit_log (
    user_id, user_email, action, table_name, record_id,
    field_name, new_value, category, change_summary
) VALUES 
    (
        (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
        'superadmin@paktaxadvisor.com',
        'admin_creation', 'users', 
        (SELECT id FROM users WHERE cnic = '35202-ADMIN01-1'),
        'admin_account_setup', 
        '{"role": "admin", "permissions": "administrative", "organization": "Pakistan Tax Advisory Services"}',
        'admin_management',
        'Admin Account Created: Ahmed Ali Khan with administrative permissions'
    ),
    (
        (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
        'superadmin@paktaxadvisor.com',
        'superadmin_creation', 'users', 
        (SELECT id FROM users WHERE cnic = '35202-SUPER01-1'),
        'superadmin_account_setup', 
        '{"role": "super_admin", "permissions": "full_system", "organization": "Pakistani Tax Advisor System HQ"}',
        'system_management',
        'Super Admin Account Created: Muhammad Hassan with full system permissions'
    );

-- Display admin account summary
SELECT 
    '🔐 ADMIN ACCOUNTS CREATED SUCCESSFULLY!' as status;

SELECT 
    'ADMIN ACCOUNTS SUMMARY' as section,
    u.name,
    u.cnic,
    u.email,
    u.role,
    u.user_type,
    o.name as organization,
    CASE 
        WHEN u.role = 'admin' THEN 'Administrative access to user management, reports, and tax processing'
        WHEN u.role = 'super_admin' THEN 'Full system access including system settings, database management, and all administrative functions'
        ELSE 'Standard user access'
    END as access_level
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.cnic IN ('35202-ADMIN01-1', '35202-SUPER01-1')
ORDER BY u.role DESC;

SELECT 'Admin and Super Admin accounts with comprehensive sample data created successfully!' as final_status;