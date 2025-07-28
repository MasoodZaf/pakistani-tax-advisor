-- Insert test data for Tax Advisor System

-- Connect to database
\c pakistani_tax_advisor

-- Insert test organization (if not exists)
INSERT INTO organizations (
    name, 
    registration_number, 
    tax_identification_number, 
    organization_type,
    address,
    contact_info
)
SELECT
    'Test Organization',
    'REG123',
    'TIN123',
    'company',
    '{"street": "123 Test St", "city": "Lahore", "country": "Pakistan"}'::jsonb,
    '{"phone": "+92123456789", "email": "test@org.pk", "website": "www.testorg.pk"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM organizations WHERE registration_number = 'REG123'
);

-- Insert test users (if not exists)
INSERT INTO users (
    organization_id,
    email,
    phone,
    cnic,
    name,
    date_of_birth,
    password_hash,
    email_verified,
    user_type,
    role,
    permissions,
    preferences
)
SELECT
    (SELECT id FROM organizations WHERE registration_number = 'REG123'),
    'test@test.com',
    '+923001234567',
    '12345-1234567-2',
    'Test User',
    '1990-01-01',
    crypt('password123', gen_salt('bf')),
    true,
    'admin',
    'admin',
    '{"can_manage_users": true, "can_manage_tax_returns": true}'::jsonb,
    '{"theme": "light", "language": "en"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'test@test.com'
);

-- Insert test tax returns for various income levels
DO $$
DECLARE
    test_user_id uuid;
    test_user_email varchar(255);
    test_tax_year_id uuid;
    test_return_id uuid;
    income_levels numeric[] := ARRAY[
        500000,    -- No tax
        800000,    -- 5% bracket
        1200000,   -- 10% bracket
        2400000,   -- 15% bracket
        3000000,   -- 20% bracket
        4000000,   -- 25% bracket
        6000000,   -- 30% bracket
        12000000   -- 35% bracket with surcharge
    ];
    income numeric;
    i integer := 0;
BEGIN
    -- Get test user
    SELECT id, email INTO test_user_id, test_user_email FROM users WHERE email = 'test@test.com';

    -- Get tax year
    SELECT id INTO test_tax_year_id FROM tax_years WHERE tax_year = '2024-25';

    -- Create tax returns for each income level
    FOREACH income IN ARRAY income_levels
    LOOP
        i := i + 1;

        -- Create tax return
        INSERT INTO tax_returns (
            user_id,
            user_email,
            tax_year_id,
            tax_year,
            return_number,
            filing_status
        )
        VALUES (
            test_user_id,
            test_user_email,
            test_tax_year_id,
            '2024-25',
            'TR-2024-' || i::text,
            'draft'
        )
        RETURNING id INTO test_return_id;

        -- Add income form
        INSERT INTO income_forms (
            tax_return_id,
            user_id,
            user_email,
            tax_year_id,
            tax_year,
            monthly_salary,
            bonus,
            car_allowance,
            other_taxable,
            medical_allowance,
            employer_contribution,
            other_exempt
        )
        VALUES (
            test_return_id,
            test_user_id,
            test_user_email,
            test_tax_year_id,
            '2024-25',
            (income * 0.60)::numeric,  -- 60% monthly salary
            (income * 0.10)::numeric,  -- 10% bonus
            (income * 0.05)::numeric,  -- 5% car allowance
            (income * 0.05)::numeric,  -- 5% other taxable
            (income * 0.10)::numeric,  -- 10% medical allowance
            (income * 0.05)::numeric,  -- 5% employer contribution
            (income * 0.05)::numeric   -- 5% other exempt
        );

        -- Add credits form (for high income)
        IF income > 2400000 THEN
            INSERT INTO credits_forms (
                tax_return_id,
                user_id,
                user_email,
                tax_year_id,
                tax_year,
                charitable_donation,
                pension_contribution,
                life_insurance_premium,
                investment_tax_credit
            )
            VALUES (
                test_return_id,
                test_user_id,
                test_user_email,
                test_tax_year_id,
                '2024-25',
                50000::numeric,   -- Charitable donation
                (income * 0.10)::numeric,  -- 10% pension contribution
                30000::numeric,   -- Life insurance premium
                (income * 0.05)::numeric   -- 5% investment tax credit
            );
        END IF;

        -- Add reductions form (for very high income)
        IF income > 6000000 THEN
            INSERT INTO reductions_forms (
                tax_return_id,
                user_id,
                user_email,
                tax_year_id,
                tax_year,
                teacher_amount,
                teacher_reduction,
                behbood_reduction,
                export_income_reduction
            )
            VALUES (
                test_return_id,
                test_user_id,
                test_user_email,
                test_tax_year_id,
                '2024-25',
                100000::numeric,  -- Teacher amount
                10000::numeric,   -- Teacher reduction
                50000::numeric,   -- Behbood reduction
                (income * 0.05)::numeric   -- 5% export income reduction
            );
        END IF;
    END LOOP;
END $$; 