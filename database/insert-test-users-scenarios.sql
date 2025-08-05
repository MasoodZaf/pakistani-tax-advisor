-- Comprehensive Test Data for Pakistani Tax Advisor
-- 5 Different User Scenarios with Complete Tax Data
-- This script creates realistic test scenarios to validate system capabilities

-- First, ensure we have the latest tax year
INSERT INTO tax_years (
    tax_year, start_date, end_date, filing_deadline, is_current, is_active, description
) VALUES (
    '2025-26',
    '2025-07-01',
    '2026-06-30',
    '2026-09-30',
    true,
    true,
    'Tax Year 2025-26 - Test Data'
) ON CONFLICT (tax_year) DO NOTHING;

-- Create test organizations
INSERT INTO organizations (
    id, name, registration_number, tax_identification_number, 
    organization_type, address, contact_info, subscription_plan, 
    subscription_expires_at, is_active, created_at
) VALUES
    (
        uuid_generate_v4(),
        'Packages Limited',
        'REG-001-2020',
        'TIN-1234567890',
        'manufacturing',
        '{"street": "Main Boulevard", "city": "Lahore", "province": "Punjab", "postal_code": "54000"}',
        '{"phone": "+92-42-1234567", "email": "hr@packages.com.pk"}',
        'enterprise',
        '2026-12-31',
        true,
        NOW()
    ),
    (
        uuid_generate_v4(),
        'Systems Limited',
        'REG-002-2018',
        'TIN-0987654321',
        'technology',
        '{"street": "Arfa Software Technology Park", "city": "Lahore", "province": "Punjab", "postal_code": "54000"}',
        '{"phone": "+92-42-7654321", "email": "hr@systems.com.pk"}',
        'professional',
        '2026-12-31',
        true,
        NOW()
    ),
    (
        uuid_generate_v4(),
        'Habib Bank Limited',
        'REG-003-1947',
        'TIN-1122334455',
        'banking',
        '{"street": "I.I. Chundrigar Road", "city": "Karachi", "province": "Sindh", "postal_code": "74000"}',
        '{"phone": "+92-21-1111222", "email": "careers@hbl.com"}',
        'enterprise',
        '2026-12-31',
        true,
        NOW()
    ),
    (
        uuid_generate_v4(),
        'University of Punjab',
        'REG-004-1882',
        'TIN-5566778899',
        'education',
        '{"street": "Quaid-e-Azam Campus", "city": "Lahore", "province": "Punjab", "postal_code": "54590"}',
        '{"phone": "+92-42-9231581", "email": "registrar@pu.edu.pk"}',
        'basic',
        '2026-12-31',
        true,
        NOW()
    ),
    (
        uuid_generate_v4(),
        'Freelance Consultant',
        'REG-005-2023',
        'TIN-9988776655',
        'consultancy',
        '{"street": "DHA Phase 5", "city": "Karachi", "province": "Sindh", "postal_code": "75500"}',
        '{"phone": "+92-21-3333444", "email": "contact@consultant.pk"}',
        'basic',
        '2026-12-31',
        true,
        NOW()
    )
ON CONFLICT (registration_number) DO NOTHING;

-- Create 5 Test Users with Different Scenarios
INSERT INTO users (
    id, organization_id, email, phone, cnic, name, date_of_birth,
    password_hash, email_verified, user_type, role, permissions,
    preferences, is_active, created_at
) VALUES
    -- User 1: Low Income Salaried Employee (Entry Level)
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Packages Limited' LIMIT 1),
        'ahmed.hassan@packages.com.pk',
        '+92-300-1234567',
        '35202-1234567-1',
        'Ahmed Hassan',
        '1995-03-15',
        crypt('TestPass123', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- User 2: Mid Income Professional (Software Engineer)
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Systems Limited' LIMIT 1),
        'fatima.khan@systems.com.pk',
        '+92-301-2345678',
        '35202-2345678-2',
        'Fatima Khan',
        '1988-07-22',
        crypt('TestPass123', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- User 3: High Income Banking Executive
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Habib Bank Limited' LIMIT 1),
        'muhammad.ali@hbl.com',
        '+92-302-3456789',
        '42201-3456789-3',
        'Muhammad Ali',
        '1975-11-10',
        crypt('TestPass123', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- User 4: Non-Filer University Professor
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'University of Punjab' LIMIT 1),
        'dr.sara.ahmed@pu.edu.pk',
        '+92-303-4567890',
        '35202-4567890-4',
        'Dr. Sara Ahmed',
        '1970-05-18',
        crypt('TestPass123', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- User 5: Complex Investment Scenario (Business Owner/Consultant)
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Freelance Consultant' LIMIT 1),
        'zain.malik@consultant.pk',
        '+92-304-5678901',
        '42301-5678901-5',
        'Zain Malik',
        '1982-09-25',
        crypt('TestPass123', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    )
ON CONFLICT (email) DO NOTHING;

-- Get the current tax year ID for inserting form data
DO $$
DECLARE
    tax_year_2025_26_id UUID;
    ahmed_user_id UUID;
    fatima_user_id UUID;
    muhammad_user_id UUID;
    sara_user_id UUID;
    zain_user_id UUID;
    ahmed_tax_return_id UUID;
    fatima_tax_return_id UUID;
    muhammad_tax_return_id UUID;
    sara_tax_return_id UUID;
    zain_tax_return_id UUID;
BEGIN
    -- Get tax year ID
    SELECT id INTO tax_year_2025_26_id FROM tax_years WHERE tax_year = '2025-26';
    
    -- Get user IDs
    SELECT id INTO ahmed_user_id FROM users WHERE email = 'ahmed.hassan@packages.com.pk';
    SELECT id INTO fatima_user_id FROM users WHERE email = 'fatima.khan@systems.com.pk';
    SELECT id INTO muhammad_user_id FROM users WHERE email = 'muhammad.ali@hbl.com';
    SELECT id INTO sara_user_id FROM users WHERE email = 'dr.sara.ahmed@pu.edu.pk';
    SELECT id INTO zain_user_id FROM users WHERE email = 'zain.malik@consultant.pk';
    
    -- Create tax returns for each user
    INSERT INTO tax_returns (
        id, user_id, user_email, tax_year_id, tax_year, return_number, 
        filing_status, filing_type, created_at
    ) VALUES
        (uuid_generate_v4(), ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26', 'TR-2025-001', 'draft', 'normal', NOW()),
        (uuid_generate_v4(), fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26', 'TR-2025-002', 'draft', 'normal', NOW()),
        (uuid_generate_v4(), muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26', 'TR-2025-003', 'draft', 'normal', NOW()),
        (uuid_generate_v4(), sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26', 'TR-2025-004', 'draft', 'normal', NOW()),
        (uuid_generate_v4(), zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26', 'TR-2025-005', 'draft', 'normal', NOW())
    ON CONFLICT (return_number) DO NOTHING;
    
    -- Get tax return IDs
    SELECT id INTO ahmed_tax_return_id FROM tax_returns WHERE user_id = ahmed_user_id AND tax_year = '2025-26';
    SELECT id INTO fatima_tax_return_id FROM tax_returns WHERE user_id = fatima_user_id AND tax_year = '2025-26';
    SELECT id INTO muhammad_tax_return_id FROM tax_returns WHERE user_id = muhammad_user_id AND tax_year = '2025-26';
    SELECT id INTO sara_tax_return_id FROM tax_returns WHERE user_id = sara_user_id AND tax_year = '2025-26';
    SELECT id INTO zain_tax_return_id FROM tax_returns WHERE user_id = zain_user_id AND tax_year = '2025-26';
    
    -- ========================================
    -- USER 1: AHMED HASSAN - LOW INCOME SCENARIO
    -- Entry level employee, PKR 50,000/month salary
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26',
        50000,    -- Monthly salary: PKR 50,000 (Annual: 600,000 - Tax Free bracket)
        15000,    -- Bonus: PKR 15,000
        0,        -- No car allowance
        0,        -- No other taxable income
        3750,     -- Tax deducted: PKR 3,750 (2.5% on 15,000 bonus)
        'N',      -- Single employer
        0,        -- No additional tax deducted
        5000,     -- Medical allowance: PKR 5,000 (exempt)
        7500,     -- Employer PF contribution: PKR 7,500 (exempt)
        0,        -- No other exempt income
        0,        -- No other sources
        true,     -- Form complete
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26',
        0, 0,      -- No profit on debt
        24000, 0,  -- Electricity bill: PKR 2,000/month, no advance tax (under threshold)
        12000, 0,  -- Phone bill: PKR 1,000/month, no advance tax
        0, 0,      -- No vehicle
        0,         -- No other adjustable tax
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26',
        0, 0,      -- Not a teacher
        0,         -- No behbood reduction
        0,         -- No export income
        0,         -- No industrial undertaking
        0,         -- No other reductions
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26',
        5000,      -- Charitable donations: PKR 5,000
        0,         -- No additional pension contribution
        12000,     -- Life insurance premium: PKR 1,000/month
        0,         -- No investment tax credit
        0,         -- No other credits
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26',
        0,         -- No zakat deduction
        0,         -- No ushr
        0,         -- No foreign tax
        0,         -- No advance tax
        0,         -- No other deductions
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
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
        ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26',
        0, 50000, 0, 20000, 25000, 45000, 15000, 0,        -- Previous year assets
        0, 75000, 0, 25000, 30000, 52500, 18000, 0,        -- Current year assets
        0, 0,                                               -- No loans
        0, 0,                                               -- No other liabilities
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- USER 2: FATIMA KHAN - MID INCOME SCENARIO
    -- Software Engineer, PKR 180,000/month salary
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        180000,   -- Monthly salary: PKR 180,000 (Annual: 2,160,000)
        360000,   -- Annual bonus: PKR 360,000 (2 months salary)
        60000,    -- Car allowance: PKR 5,000/month
        50000,    -- Other taxable benefits
        195000,   -- Tax deducted: Calculated on progressive slabs
        'N',      -- Single employer
        0,        -- No additional tax deducted
        15000,    -- Medical allowance: PKR 15,000 (exempt)
        25000,    -- Employer PF contribution (exempt)
        10000,    -- Other exempt income
        120000,   -- Freelance consulting income
        true,     -- Form complete
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        25000, 3750,    -- Profit on debt with 15% withholding
        48000, 7200,    -- Electricity bill with advance tax
        18000, 2700,    -- Phone bill with advance tax
        0, 0,           -- No vehicle purchase
        0,              -- No other adjustable tax
        true,
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        0, 0,           -- Not a teacher
        0,              -- No behbood reduction
        120000,         -- Export income reduction on IT services
        0,              -- No industrial undertaking
        0,              -- No other reductions
        true,
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        50000,          -- Charitable donations
        50000,          -- Additional pension contribution
        36000,          -- Life insurance premium: PKR 3,000/month
        0,              -- No investment tax credit
        0,              -- No other credits
        true,
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        0,              -- No zakat deduction
        0,              -- No ushr
        0,              -- No foreign tax
        25000,          -- Advance tax paid
        0,              -- No other deductions
        true,
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO capital_gain_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        property_1_year, property_1_year_tax_rate, property_1_year_tax_deducted,
        property_2_3_years, property_2_3_years_tax_rate, property_2_3_years_tax_deducted,
        property_4_plus_years, property_4_plus_years_tax_deducted,
        securities, securities_tax_rate, securities_tax_deducted,
        other_capital_gains, other_capital_gains_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        0, 0.15, 0,                     -- No property sale within 1 year
        0, 0.10, 0,                     -- No property sale 2-3 years
        0, 0,                           -- No property sale 4+ years
        500000, 0.125, 62500,           -- Securities sale with 12.5% tax
        0, 0,                           -- No other capital gains
        true,
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
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
        fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26',
        5000000, 800000, 1200000, 150000, 100000, 200000, 250000, 50000,    -- Previous year: 7.75M
        5200000, 1300000, 1200000, 200000, 150000, 225000, 300000, 100000,  -- Current year: 8.675M
        2000000, 1800000,                                                    -- Home loan
        50000, 25000,                                                        -- Credit card debt
        true,
        fatima_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- USER 3: MUHAMMAD ALI - HIGH INCOME SCENARIO
    -- Banking Executive, PKR 500,000/month salary
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        500000,   -- Monthly salary: PKR 500,000 (Annual: 6,000,000)
        2000000,  -- Performance bonus: PKR 2,000,000
        300000,   -- Car allowance: PKR 25,000/month
        150000,   -- Other taxable benefits (club membership, etc.)
        1950000,  -- Tax deducted at source (calculated on progressive slabs)
        'N',      -- Single employer
        0,        -- No additional tax deducted
        50000,    -- Medical allowance (exempt)
        100000,   -- Employer PF contribution (exempt)
        25000,    -- Other exempt income
        500000,   -- Dividend income from investments
        true,     -- Form complete
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        150000, 22500,      -- Profit on debt with 15% withholding
        120000, 18000,      -- High electricity consumption with advance tax
        36000, 5400,        -- Multiple phone connections with advance tax
        8000000, 800000,    -- Vehicle purchase (Luxury car) with 10% advance tax
        50000,              -- Other adjustable tax
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        0, 0,               -- Not a teacher
        0,                  -- No behbood reduction
        0,                  -- No export income
        0,                  -- No industrial undertaking
        0,                  -- No other reductions
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        200000,             -- Charitable donations
        150000,             -- Additional pension contribution
        120000,             -- Life insurance premium: PKR 10,000/month
        100000,             -- Investment tax credit
        50000,              -- Other credits
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        0,                  -- No zakat deduction
        0,                  -- No ushr
        0,                  -- No foreign tax
        150000,             -- Advance tax paid
        0,                  -- No other deductions
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO final_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        sukuk_amount, sukuk_tax_rate, debt_amount, debt_tax_rate,
        prize_bonds, prize_bonds_tax, other_final_tax_amount, other_final_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        2000000, 0.10,              -- Sukuk investment with 10% final tax
        500000, 0.15,               -- Debt securities with 15% final tax
        100000, 25000,              -- Prize bonds with tax deducted
        0, 0,                       -- No other final tax
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO capital_gain_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        property_1_year, property_1_year_tax_rate, property_1_year_tax_deducted,
        property_2_3_years, property_2_3_years_tax_rate, property_2_3_years_tax_deducted,
        property_4_plus_years, property_4_plus_years_tax_deducted,
        securities, securities_tax_rate, securities_tax_deducted,
        other_capital_gains, other_capital_gains_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        0, 0.15, 0,                         -- No property sale within 1 year
        15000000, 0.10, 1500000,            -- Property sale 2-3 years with 10% tax
        0, 0,                               -- No property sale 4+ years
        2000000, 0.125, 250000,             -- Securities sale with 12.5% tax
        0, 0,                               -- No other capital gains
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
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
        muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26',
        25000000, 5000000, 8000000, 500000, 300000, 1000000, 2000000, 200000,    -- Previous: 42M
        40000000, 7000000, 15000000, 600000, 500000, 1150000, 3000000, 500000,   -- Current: 67.75M
        15000000, 12000000,                                                       -- Property loans
        200000, 100000,                                                           -- Other liabilities
        true,
        muhammad_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- USER 4: DR. SARA AHMED - NON-FILER SCENARIO
    -- University Professor, PKR 150,000/month salary
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26',
        150000,   -- Monthly salary: PKR 150,000 (Annual: 1,800,000)
        150000,   -- Research bonus
        0,        -- No car allowance
        50000,    -- Consultation fees
        90000,    -- Tax deducted (higher rate for non-filer)
        'Y',      -- Multiple employers (university + private practice)
        15000,    -- Additional tax deducted from private practice
        12000,    -- Medical allowance
        20000,    -- Employer PF contribution
        8000,     -- Other exempt income
        300000,   -- Private consultation income (not reported regularly)
        true,     -- Form complete
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- No profit on debt
        60000, 12000,       -- Higher electricity tax for non-filer
        24000, 4800,        -- Higher phone tax for non-filer
        0, 0,               -- No vehicle purchase
        0,                  -- No other adjustable tax
        true,
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26',
        1800000, 90000,     -- Teacher reduction: 5% of salary income
        0,                  -- No behbood reduction
        0,                  -- No export income
        0,                  -- No industrial undertaking
        0,                  -- No other reductions
        true,
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26',
        30000,              -- Charitable donations
        25000,              -- Additional pension contribution
        30000,              -- Life insurance premium
        0,                  -- No investment tax credit
        0,                  -- No other credits
        true,
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26',
        15000,              -- Zakat deduction
        0,                  -- No ushr
        0,                  -- No foreign tax
        0,                  -- No advance tax
        0,                  -- No other deductions
        true,
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
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
        sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26',
        3000000, 200000, 800000, 100000, 50000, 300000, 80000, 20000,      -- Previous: 4.55M
        3200000, 250000, 800000, 120000, 75000, 325000, 100000, 30000,     -- Current: 4.9M
        1500000, 1200000,                                                   -- House loan
        30000, 20000,                                                       -- Other liabilities
        true,
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- USER 5: ZAIN MALIK - COMPLEX INVESTMENT SCENARIO
    -- Business Owner/Consultant with multiple income sources
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        250000,   -- Director salary: PKR 250,000/month
        1000000,  -- Performance bonus
        120000,   -- Car allowance: PKR 10,000/month
        200000,   -- Other taxable benefits
        450000,   -- Tax deducted on salary and bonus
        'Y',      -- Multiple sources of income
        50000,    -- Additional tax deducted
        20000,    -- Medical allowance
        40000,    -- Employer PF contribution
        15000,    -- Other exempt income
        2500000,  -- Business/consulting income
        true,     -- Form complete
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        400000, 60000,      -- Profit on debt with 15% withholding
        180000, 27000,      -- High electricity consumption (office + home)
        48000, 7200,        -- Multiple phone connections
        12000000, 1200000,  -- Multiple vehicle purchases (business use)
        100000,             -- Other adjustable tax (equipment purchases)
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- Not a teacher
        0,                  -- No behbood reduction
        1500000,            -- Export income reduction (IT consulting exports)
        0,                  -- No industrial undertaking
        0,                  -- No other reductions
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        150000,             -- Charitable donations
        200000,             -- Additional pension contribution
        100000,             -- Life insurance premium
        250000,             -- Investment tax credit (business investments)
        75000,              -- Other credits
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        0,                  -- No zakat deduction
        0,                  -- No ushr
        100000,             -- Tax paid in foreign country (US clients)
        400000,             -- Advance tax paid
        50000,              -- Other deductions
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO final_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        sukuk_amount, sukuk_tax_rate, debt_amount, debt_tax_rate,
        prize_bonds, prize_bonds_tax, other_final_tax_amount, other_final_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        5000000, 0.10,      -- Large Sukuk investment
        1000000, 0.15,      -- Debt securities
        500000, 125000,     -- Prize bonds with tax
        200000, 40000,      -- Other investments with final tax
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO capital_gain_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        property_1_year, property_1_year_tax_rate, property_1_year_tax_deducted,
        property_2_3_years, property_2_3_years_tax_rate, property_2_3_years_tax_deducted,
        property_4_plus_years, property_4_plus_years_tax_deducted,
        securities, securities_tax_rate, securities_tax_deducted,
        other_capital_gains, other_capital_gains_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        20000000, 0.15, 3000000,            -- Property flip within 1 year
        10000000, 0.10, 1000000,            -- Property sale 2-3 years
        5000000, 0,                         -- Long-term property (exempt)
        3000000, 0.125, 375000,             -- Securities trading
        1000000, 250000,                    -- Other capital gains (business assets)
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO expenses_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        rent, rates, income_tax, vehicle, travelling, electricity, water, gas,
        telephone, medical, educational, donations, other_expenses,
        entertainment, maintenance,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        600000,     -- Office rent: PKR 50,000/month
        0,          -- No rates
        0,          -- No income tax expense
        240000,     -- Vehicle expenses: PKR 20,000/month
        300000,     -- Business travel
        180000,     -- Electricity (office + home)
        60000,      -- Water bills
        120000,     -- Gas bills
        48000,      -- Telephone expenses
        100000,     -- Medical expenses
        0,          -- No educational expenses
        150000,     -- Business donations
        500000,     -- Other business expenses
        150000,     -- Entertainment (business)
        200000,     -- Equipment maintenance
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
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
        zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26',
        50000000, 10000000, 15000000, 300000, 1000000, 500000, 5000000, 2000000,    -- Previous: 83.8M
        75000000, 18000000, 27000000, 400000, 1500000, 600000, 8000000, 5000000,    -- Current: 135.5M
        25000000, 20000000,                                                          -- Business loans
        500000, 300000,                                                              -- Other liabilities
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- Create form completion status for all users
    INSERT INTO form_completion_status (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        income_form_complete, adjustable_tax_form_complete, reductions_form_complete,
        credits_form_complete, deductions_form_complete, final_tax_form_complete,
        capital_gain_form_complete, expenses_form_complete, wealth_form_complete,
        created_at
    ) VALUES
        (ahmed_tax_return_id, ahmed_user_id, 'ahmed.hassan@packages.com.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, false, false, false, true, NOW()),
        (fatima_tax_return_id, fatima_user_id, 'fatima.khan@systems.com.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, false, true, false, true, NOW()),
        (muhammad_tax_return_id, muhammad_user_id, 'muhammad.ali@hbl.com', tax_year_2025_26_id, '2025-26', true, true, true, true, true, true, true, false, true, NOW()),
        (sara_tax_return_id, sara_user_id, 'dr.sara.ahmed@pu.edu.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, false, false, false, true, NOW()),
        (zain_tax_return_id, zain_user_id, 'zain.malik@consultant.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, true, true, true, true, NOW())
    ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
END $$;

-- Insert audit log entries for test data creation
INSERT INTO audit_log (
    user_id, user_email, action, table_name, record_id,
    field_name, new_value, category, change_summary
) VALUES (
    (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
    (SELECT email FROM users WHERE role = 'super_admin' LIMIT 1),
    'bulk_insert', 'users', 
    null,
    'test_data_creation', 
    '{"users_created": 5, "organizations_created": 5, "tax_returns_created": 5, "scenarios": ["low_income", "mid_income", "high_income", "non_filer", "complex_investment"]}',
    'test_data_setup',
    'Test Data: Created 5 comprehensive user scenarios with complete tax form data for testing system capabilities'
);

-- Summary query to verify test data
SELECT 
    'Test Data Summary' as info,
    (SELECT COUNT(*) FROM users WHERE email LIKE '%@%.%') as total_users,
    (SELECT COUNT(*) FROM organizations WHERE is_active = true) as total_organizations,
    (SELECT COUNT(*) FROM tax_returns WHERE tax_year = '2025-26') as tax_returns_2025_26,
    (SELECT COUNT(*) FROM income_forms WHERE tax_year = '2025-26') as income_forms,
    (SELECT COUNT(*) FROM wealth_forms WHERE tax_year = '2025-26') as wealth_forms;

SELECT 'Test users created successfully with comprehensive tax scenarios!' as status;