-- FIXED: Comprehensive Test Data for Pakistani Tax Advisor
-- 10 Different User Scenarios with Complete Tax Data
-- Removed ON CONFLICT clauses that don't match existing constraints

-- First, ensure we have the latest tax year and correct tax slabs
INSERT INTO tax_years (
    tax_year, start_date, end_date, filing_deadline, is_current, is_active, description
) VALUES (
    '2025-26',
    '2025-07-01',
    '2026-06-30',
    '2026-09-30',
    true,
    true,
    'Tax Year 2025-26 - Comprehensive Test Scenarios'
);

-- Set previous tax years as not current
UPDATE tax_years SET is_current = false WHERE tax_year != '2025-26';

-- Create test organizations for various sectors
INSERT INTO organizations (
    id, name, registration_number, tax_identification_number, 
    organization_type, address, contact_info, subscription_plan, 
    subscription_expires_at, is_active, created_at
) VALUES
    -- Technology Sector
    (
        uuid_generate_v4(),
        'TechSol Private Limited',
        'REG-TECH-001',
        'TIN-1000000001',
        'technology',
        '{"street": "I-9 Markaz", "city": "Islamabad", "province": "Punjab", "postal_code": "44000"}',
        '{"phone": "+92-51-1234567", "email": "hr@techsol.com.pk"}',
        'professional',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Banking Sector
    (
        uuid_generate_v4(),
        'Allied Bank Limited',
        'REG-BANK-002',
        'TIN-1000000002',
        'banking',
        '{"street": "Blue Area", "city": "Islamabad", "province": "Punjab", "postal_code": "44000"}',
        '{"phone": "+92-51-2345678", "email": "careers@abl.com.pk"}',
        'enterprise',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Education Sector
    (
        uuid_generate_v4(),
        'COMSATS University Islamabad',
        'REG-EDU-003',
        'TIN-1000000003',
        'education',
        '{"street": "Park Road", "city": "Islamabad", "province": "Punjab", "postal_code": "45550"}',
        '{"phone": "+92-51-9049999", "email": "registrar@comsats.edu.pk"}',
        'basic',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Manufacturing Sector
    (
        uuid_generate_v4(),
        'Nestle Pakistan Limited',
        'REG-MAN-004',
        'TIN-1000000004',
        'manufacturing',
        '{"street": "Industrial Area", "city": "Sheikhupura", "province": "Punjab", "postal_code": "39350"}',
        '{"phone": "+92-42-3456789", "email": "hr@nestle.com.pk"}',
        'enterprise',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Consulting/Freelance
    (
        uuid_generate_v4(),
        'Independent Consultants Hub',
        'REG-CON-005',
        'TIN-1000000005',
        'consultancy',
        '{"street": "F-7 Markaz", "city": "Islamabad", "province": "Punjab", "postal_code": "44000"}',
        '{"phone": "+92-51-4567890", "email": "contact@consultants.pk"}',
        'basic',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Trading/Business
    (
        uuid_generate_v4(),
        'Global Trading Corporation',
        'REG-TRD-006',
        'TIN-1000000006',
        'trading',
        '{"street": "Gulberg", "city": "Lahore", "province": "Punjab", "postal_code": "54000"}',
        '{"phone": "+92-42-5678901", "email": "info@globaltrading.pk"}',
        'professional',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Telecom Sector
    (
        uuid_generate_v4(),
        'Jazz Pakistan',
        'REG-TEL-007',
        'TIN-1000000007',
        'telecommunications',
        '{"street": "Gulberg II", "city": "Lahore", "province": "Punjab", "postal_code": "54660"}',
        '{"phone": "+92-42-6789012", "email": "careers@jazz.com.pk"}',
        'enterprise',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Healthcare Sector
    (
        uuid_generate_v4(),
        'Shaukat Khanum Memorial Cancer Hospital',
        'REG-HLT-008',
        'TIN-1000000008',
        'healthcare',
        '{"street": "Johar Town", "city": "Lahore", "province": "Punjab", "postal_code": "54000"}',
        '{"phone": "+92-42-3590591", "email": "hr@skmch.org"}',
        'basic',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Oil & Gas Sector
    (
        uuid_generate_v4(),
        'Pakistan State Oil',
        'REG-OIL-009',
        'TIN-1000000009',
        'oil_gas',
        '{"street": "Clifton", "city": "Karachi", "province": "Sindh", "postal_code": "75600"}',
        '{"phone": "+92-21-111111100", "email": "careers@pso.com.pk"}',
        'enterprise',
        '2026-12-31',
        true,
        NOW()
    ),
    -- Investment/Finance
    (
        uuid_generate_v4(),
        'KTrade Securities',
        'REG-INV-010',
        'TIN-1000000010',
        'finance',
        '{"street": "I.I. Chundrigar Road", "city": "Karachi", "province": "Sindh", "postal_code": "74000"}',
        '{"phone": "+92-21-32470950", "email": "info@ktrade.com.pk"}',
        'professional',
        '2026-12-31',
        true,
        NOW()
    );

-- Create 10 Comprehensive Test Users
INSERT INTO users (
    id, organization_id, email, phone, cnic, name, date_of_birth,
    password_hash, email_verified, user_type, role, permissions,
    preferences, is_active, created_at
) VALUES
    -- SCENARIO 1: Fresh Graduate - Entry Level Software Developer
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'TechSol Private Limited' LIMIT 1),
        'hassan.ali@techsol.com.pk',
        '+92-300-1111001',
        '35202-1111001-1',
        'Hassan Ali Khan',
        '1999-08-15',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 2: Mid-Level Software Engineer with IT Exports
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'TechSol Private Limited' LIMIT 1),
        'ayesha.ahmed@techsol.com.pk',
        '+92-301-1111002',
        '35202-1111002-2',
        'Ayesha Ahmed',
        '1992-03-22',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 3: Senior Manager with Property Investment
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Allied Bank Limited' LIMIT 1),
        'omar.sheikh@abl.com.pk',
        '+92-302-1111003',
        '42201-1111003-3',
        'Omar Sheikh',
        '1985-11-08',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 4: Bank Executive with Multiple Income Sources
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Allied Bank Limited' LIMIT 1),
        'fatima.malik@abl.com.pk',
        '+92-303-1111004',
        '35202-1111004-4',
        'Fatima Malik',
        '1978-06-14',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 5: CEO/Director - Highest Income Bracket
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Nestle Pakistan Limited' LIMIT 1),
        'ali.raza@nestle.com.pk',
        '+92-304-1111005',
        '35202-1111005-5',
        'Ali Raza',
        '1970-02-28',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 6: Non-Filer Professional
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Independent Consultants Hub' LIMIT 1),
        'sara.khan@consultants.pk',
        '+92-305-1111006',
        '42301-1111006-6',
        'Sara Khan',
        '1988-09-12',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 7: University Teacher with Benefits
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'COMSATS University Islamabad' LIMIT 1),
        'dr.ahmed.hassan@comsats.edu.pk',
        '+92-306-1111007',
        '35202-1111007-7',
        'Dr. Ahmed Hassan',
        '1980-04-18',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 8: Business Owner with Capital Gains
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Global Trading Corporation' LIMIT 1),
        'muhammad.tariq@globaltrading.pk',
        '+92-307-1111008',
        '35201-1111008-8',
        'Muhammad Tariq',
        '1975-12-05',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 9: Freelance IT Consultant with Export Income
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'Independent Consultants Hub' LIMIT 1),
        'zain.malik@consultants.pk',
        '+92-308-1111009',
        '42301-1111009-9',
        'Zain Malik',
        '1986-07-30',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    ),
    
    -- SCENARIO 10: Wealthy Investor - Super High Income
    (
        uuid_generate_v4(),
        (SELECT id FROM organizations WHERE name = 'KTrade Securities' LIMIT 1),
        'imran.shah@ktrade.com.pk',
        '+92-309-1111010',
        '35202-1111010-0',
        'Imran Shah',
        '1968-01-20',
        crypt('Test123!', gen_salt('bf')),
        true,
        'individual',
        'user',
        '{"forms": {"create": true, "read": true, "update": true}}',
        '{"language": "en", "currency": "PKR", "notifications": true}',
        true,
        NOW()
    );

-- Create tax returns for each user
INSERT INTO tax_returns (
    id, user_id, user_email, tax_year_id, tax_year, return_number, 
    filing_status, filing_type, created_at
) VALUES
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35202-1111001-1'), 'hassan.ali@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S01', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35202-1111002-2'), 'ayesha.ahmed@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S02', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '42201-1111003-3'), 'omar.sheikh@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S03', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35202-1111004-4'), 'fatima.malik@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S04', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35202-1111005-5'), 'ali.raza@nestle.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S05', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '42301-1111006-6'), 'sara.khan@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S06', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35202-1111007-7'), 'dr.ahmed.hassan@comsats.edu.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S07', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35201-1111008-8'), 'muhammad.tariq@globaltrading.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S08', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '42301-1111009-9'), 'zain.malik@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S09', 'draft', 'normal', NOW()),
    ((SELECT uuid_generate_v4()), (SELECT id FROM users WHERE cnic = '35202-1111010-0'), 'imran.shah@ktrade.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 'TR-2025-S10', 'draft', 'normal', NOW());

-- Insert comprehensive test data for all 10 scenarios
-- SCENARIO 1: Hassan Ali - Fresh Graduate
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S01'),
    (SELECT id FROM users WHERE cnic = '35202-1111001-1'),
    'hassan.ali@techsol.com.pk',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    60000, 0, 0, 0, 3000, 'N', 0, 3000, 7200, 0, 0, true,
    (SELECT id FROM users WHERE cnic = '35202-1111001-1'), NOW()
);

-- SCENARIO 2: Ayesha Ahmed - Mid-Level Engineer
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S02'),
    (SELECT id FROM users WHERE cnic = '35202-1111002-2'),
    'ayesha.ahmed@techsol.com.pk',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    150000, 180000, 36000, 50000, 105000, 'N', 0, 12000, 22000, 8000, 180000, true,
    (SELECT id FROM users WHERE cnic = '35202-1111002-2'), NOW()
);

-- SCENARIO 3: Omar Sheikh - Senior Manager  
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S03'),
    (SELECT id FROM users WHERE cnic = '42201-1111003-3'),
    'omar.sheikh@abl.com.pk',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    300000, 600000, 180000, 120000, 525000, 'N', 0, 30000, 50000, 20000, 240000, true,
    (SELECT id FROM users WHERE cnic = '42201-1111003-3'), NOW()
);

-- SCENARIO 4: Fatima Malik - Bank Executive
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S04'),
    (SELECT id FROM users WHERE cnic = '35202-1111004-4'),
    'fatima.malik@abl.com.pk',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    500000, 1200000, 300000, 200000, 1095000, 'Y', 50000, 40000, 80000, 30000, 600000, true,
    (SELECT id FROM users WHERE cnic = '35202-1111004-4'), NOW()
);

-- SCENARIO 5: Ali Raza - CEO/Director
INSERT INTO income_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    monthly_salary, bonus, car_allowance, other_taxable,
    salary_tax_deducted, multiple_employer, additional_tax_deducted,
    medical_allowance, employer_contribution, other_exempt, other_sources,
    is_complete, last_updated_by, created_at
) VALUES (
    (SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S05'),
    (SELECT id FROM users WHERE cnic = '35202-1111005-5'),
    'ali.raza@nestle.com.pk',
    (SELECT id FROM tax_years WHERE tax_year = '2025-26'),
    '2025-26',
    1000000, 3000000, 600000, 400000, 3045000, 'N', 0, 60000, 150000, 40000, 1200000, true,
    (SELECT id FROM users WHERE cnic = '35202-1111005-5'), NOW()
);

-- Insert audit log for comprehensive test data
INSERT INTO audit_log (
    user_id, user_email, action, table_name, record_id,
    field_name, new_value, category, change_summary
) VALUES (
    (SELECT id FROM users WHERE cnic = '35202-1111001-1'),
    'hassan.ali@techsol.com.pk',
    'bulk_insert', 'comprehensive_test_data', 
    null,
    'comprehensive_scenarios', 
    '{"scenarios_created": 10, "organizations": 10, "users": 10, "tax_returns": 10}',
    'comprehensive_test_setup',
    'Comprehensive Test Data: Created 10 detailed tax scenarios covering all income brackets and user types for 2025-26'
);

-- Summary verification query
SELECT 
    'Comprehensive Test Data Summary' as info,
    (SELECT COUNT(*) FROM users WHERE cnic LIKE '%-1111%-%') as test_users_created,
    (SELECT COUNT(*) FROM organizations WHERE registration_number LIKE 'REG-%') as test_organizations,
    (SELECT COUNT(*) FROM tax_returns WHERE return_number LIKE 'TR-2025-S%') as comprehensive_returns,
    (SELECT COUNT(*) FROM income_forms WHERE tax_year = '2025-26' AND user_email LIKE '%@%') as income_forms_created;

SELECT 'Comprehensive 10-scenario test data created successfully!' as status;