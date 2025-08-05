-- Completion of Remaining 5 Scenarios (6-10) for Comprehensive Test Data
-- This file contains scenarios 6-10 to complete the 10-scenario test suite

-- This should be executed after the main script

DO $$
DECLARE
    tax_year_2025_26_id UUID;
    
    -- User IDs for scenarios 6-10
    sara_user_id UUID;
    ahmed_user_id UUID;
    tariq_user_id UUID;
    zain_user_id UUID;
    imran_user_id UUID;
    
    -- Tax Return IDs for scenarios 6-10
    sara_return_id UUID;
    ahmed_return_id UUID;
    tariq_return_id UUID;
    zain_return_id UUID;
    imran_return_id UUID;
    
BEGIN
    -- Get tax year ID
    SELECT id INTO tax_year_2025_26_id FROM tax_years WHERE tax_year = '2025-26';
    
    -- Get user IDs for remaining scenarios
    SELECT id INTO sara_user_id FROM users WHERE cnic = '42301-1111006-6';
    SELECT id INTO ahmed_user_id FROM users WHERE cnic = '35202-1111007-7';
    SELECT id INTO tariq_user_id FROM users WHERE cnic = '35201-1111008-8';
    SELECT id INTO zain_user_id FROM users WHERE cnic = '42301-1111009-9';
    SELECT id INTO imran_user_id FROM users WHERE cnic = '35202-1111010-0';
    
    -- Get tax return IDs for remaining scenarios
    SELECT id INTO sara_return_id FROM tax_returns WHERE user_id = sara_user_id AND tax_year = '2025-26';
    SELECT id INTO ahmed_return_id FROM tax_returns WHERE user_id = ahmed_user_id AND tax_year = '2025-26';
    SELECT id INTO tariq_return_id FROM tax_returns WHERE user_id = tariq_user_id AND tax_year = '2025-26';
    SELECT id INTO zain_return_id FROM tax_returns WHERE user_id = zain_user_id AND tax_year = '2025-26';
    SELECT id INTO imran_return_id FROM tax_returns WHERE user_id = imran_user_id AND tax_year = '2025-26';
    
    -- ========================================
    -- SCENARIO 6: SARA KHAN - NON-FILER PROFESSIONAL
    -- Non-filer consultant, PKR 200,000/month
    -- Annual Income: PKR 2,400,000
    -- Expected Tax: Higher non-filer rates apply
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26',
        200000,   -- Monthly salary: PKR 200,000 (Annual: 2,400,000)
        240000,   -- Annual bonus
        0,        -- No car allowance
        100000,   -- Other consulting income
        180000,   -- Higher tax deducted for non-filer
        'Y',      -- Multiple clients
        30000,    -- Additional tax deducted
        10000,    -- Medical allowance
        25000,    -- Employer contribution
        5000,     -- Other exempt
        480000,   -- Additional consulting projects
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
        sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- No profit on debt
        60000, 15000,       -- Higher electricity tax for non-filer
        24000, 6000,        -- Higher phone tax for non-filer
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
        sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- Not a teacher
        0,                  -- No behbood reduction
        0,                  -- No export income (non-filer can't claim)
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
        sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26',
        20000,              -- Limited charitable donations
        15000,              -- Small pension contribution
        24000,              -- Life insurance premium
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
        sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26',
        0,                  -- No zakat deduction
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
        sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26',
        2000000, 300000, 1200000, 80000, 50000, 100000, 150000, 20000,      -- Previous: 3.9M
        2200000, 450000, 1200000, 100000, 80000, 125000, 200000, 30000,     -- Current: 4.385M
        800000, 600000,                                                      -- Personal loans
        25000, 15000,                                                        -- Other liabilities
        true,
        sara_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- SCENARIO 7: DR. AHMED HASSAN - UNIVERSITY TEACHER
    -- Teacher with reduction benefits, PKR 100,000/month
    -- Annual Income: PKR 1,200,000
    -- Expected Tax: PKR 15,000 (after teacher reduction)
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26',
        100000,   -- Monthly salary: PKR 100,000 (Annual: 1,200,000)
        100000,   -- Research allowance/bonus
        0,        -- No car allowance
        50000,    -- Private tutoring income
        15000,    -- Tax deducted (after teacher reduction)
        'Y',      -- University + private tutoring
        5000,     -- Additional tax from tutoring
        8000,     -- Medical allowance
        15000,    -- University PF contribution
        12000,    -- Research grants (exempt)
        240000,   -- Private tutoring and consulting
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
        ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- No profit on debt
        36000, 0,           -- Electricity (under threshold)
        18000, 0,           -- Phone (under threshold)
        0, 0,               -- No vehicle purchase
        0,                  -- No other adjustable tax
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
        ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26',
        1200000, 60000,     -- Teacher reduction: 5% of salary income
        0,                  -- No behbood reduction
        0,                  -- No export income
        0,                  -- No industrial undertaking
        0,                  -- No other reductions
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
        ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26',
        30000,              -- Charitable donations
        20000,              -- Additional pension
        24000,              -- Life insurance: PKR 2,000/month
        0,                  -- No investment credit
        0,                  -- No other credits
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26',
        10000,              -- Zakat deduction
        0,                  -- No ushr
        0,                  -- No foreign tax
        0,                  -- No advance tax
        0,                  -- No other deductions
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
        ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26',
        3000000, 200000, 600000, 80000, 40000, 180000, 80000, 50000,       -- Previous: 4.23M
        3200000, 280000, 600000, 100000, 60000, 195000, 120000, 70000,     -- Current: 4.625M
        1500000, 1300000,                                                   -- House loan
        20000, 15000,                                                       -- Other liabilities
        true,
        ahmed_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- SCENARIO 8: MUHAMMAD TARIQ - BUSINESS OWNER
    -- Trading business with capital gains, PKR 700,000/month
    -- Annual Income: PKR 8,400,000
    -- Expected Tax: PKR 1,737,500 (high bracket with capital gains)
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        700000,   -- Monthly director salary: PKR 700,000 (Annual: 8,400,000)
        1680000,  -- Performance bonus (2 months)
        420000,   -- Car allowance: PKR 35,000/month
        300000,   -- Other benefits
        1737500,  -- Tax deducted at source
        'N',      -- Single company
        0,        -- No additional tax deducted
        35000,    -- Medical allowance
        100000,   -- Company PF contribution
        15000,    -- Other exempt
        1200000,  -- Trading profits
        true,     -- Form complete
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        300000, 45000,      -- Business profit on debt
        120000, 18000,      -- Office + home electricity
        36000, 5400,        -- Multiple business phones
        8000000, 800000,    -- Commercial vehicle fleet
        50000,              -- Other business adjustable tax
        true,
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- Not a teacher
        0,                  -- No behbood reduction
        600000,             -- Export business income reduction
        0,                  -- No industrial undertaking
        0,                  -- No other reductions
        true,
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        200000,             -- Business charitable donations
        150000,             -- Pension contribution
        84000,              -- Life insurance: PKR 7,000/month
        100000,             -- Business investment credit
        50000,              -- Other credits
        true,
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        0,                  -- No zakat deduction
        0,                  -- No ushr
        50000,              -- Tax paid abroad on exports
        200000,             -- Advance tax paid
        25000,              -- Other deductions
        true,
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO final_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        sukuk_amount, sukuk_tax_rate, debt_amount, debt_tax_rate,
        prize_bonds, prize_bonds_tax, other_final_tax_amount, other_final_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        2000000, 0.10,      -- Sukuk investments
        800000, 0.15,       -- Debt securities
        100000, 25000,      -- Prize bonds
        50000, 10000,       -- Other final tax investments
        true,
        tariq_user_id,
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
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        10000000, 0.15, 1500000,            -- Property speculation (1 year)
        8000000, 0.10, 800000,              -- Property sale 2-3 years
        0, 0,                               -- No long-term property
        2000000, 0.125, 250000,             -- Securities trading
        500000, 125000,                     -- Business asset sale
        true,
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO expenses_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        rent, rates, income_tax, vehicle, travelling, electricity, water, gas,
        telephone, medical, educational, donations, other_expenses,
        entertainment, maintenance,
        is_complete, last_updated_by, created_at
    ) VALUES (
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        480000,     -- Office rent: PKR 40,000/month
        0,          -- No rates
        0,          -- No income tax expense
        180000,     -- Vehicle expenses
        240000,     -- Business travel
        120000,     -- Electricity
        36000,      -- Water
        72000,      -- Gas
        36000,      -- Telephone
        60000,      -- Medical
        0,          -- No educational
        200000,     -- Business donations
        300000,     -- Other business expenses
        120000,     -- Entertainment
        150000,     -- Maintenance
        true,
        tariq_user_id,
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
        tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26',
        25000000, 5000000, 8000000, 200000, 300000, 600000, 2000000, 1000000,    -- Previous: 42.1M
        7000000, 8000000, 16000000, 250000, 500000, 650000, 3000000, 2000000,    -- Current: 37.4M (sold properties)
        15000000, 12000000,                                                       -- Business loans
        200000, 150000,                                                           -- Other liabilities
        true,
        tariq_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- SCENARIO 9: ZAIN MALIK - FREELANCE IT CONSULTANT
    -- Export income specialist, PKR 400,000/month
    -- Annual Income: PKR 4,800,000
    -- Expected Tax: PKR 577,500 (with export reductions)
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        400000,   -- Monthly consulting income: PKR 400,000 (Annual: 4,800,000)
        480000,   -- Project bonuses
        120000,   -- Equipment allowance
        200000,   -- Other consulting income
        577500,   -- Tax deducted (after export reductions)
        'Y',      -- Multiple clients
        25000,    -- Additional tax from local clients
        0,        -- No medical allowance (freelancer)
        0,        -- No employer contribution
        0,        -- No other exempt
        1800000,  -- International client income (export)
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
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        150000, 22500,      -- Profit on business debt
        96000, 14400,       -- High electricity (home office)
        30000, 4500,        -- Multiple business phones
        4000000, 400000,    -- Vehicle purchase for business
        30000,              -- Other equipment taxes
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
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- Not a teacher
        0,                  -- No behbood reduction
        1800000,            -- Large export income reduction (IT services)
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
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        80000,              -- Charitable donations
        100000,             -- Self-contributed pension
        60000,              -- Life insurance: PKR 5,000/month
        150000,             -- Technology investment credit
        40000,              -- Other credits
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        0,                  -- No zakat deduction
        0,                  -- No ushr
        80000,              -- Tax paid to foreign countries (US, EU clients)
        120000,             -- Advance tax paid
        20000,              -- Other deductions
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
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        0, 0.15, 0,                         -- No property sale within 1 year
        3000000, 0.10, 300000,              -- Property sale 2-3 years
        0, 0,                               -- No long-term property
        1000000, 0.125, 125000,             -- Tech stock trading
        200000, 50000,                      -- Equipment/asset sale
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
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        360000,     -- Home office portion: PKR 30,000/month
        0,          -- No rates
        0,          -- No income tax expense
        120000,     -- Vehicle expenses
        180000,     -- Client meetings travel
        96000,      -- Home office electricity
        24000,      -- Water
        48000,      -- Gas
        30000,      -- Multiple phone/internet
        40000,      -- Health insurance (self-paid)
        50000,      -- Professional development courses
        80000,      -- Professional donations
        200000,     -- Equipment, software, subscriptions
        60000,      -- Client entertainment
        80000,      -- Equipment maintenance
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
        zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26',
        8000000, 2000000, 2500000, 100000, 200000, 300000, 800000, 500000,      -- Previous: 14.4M
        5000000, 3000000, 6000000, 120000, 300000, 400000, 1200000, 800000,     -- Current: 16.82M (sold property)
        4000000, 3500000,                                                        -- Business loans
        80000, 60000,                                                            -- Other liabilities
        true,
        zain_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- ========================================
    -- SCENARIO 10: IMRAN SHAH - WEALTHY INVESTOR
    -- Super high income with complex investments, PKR 1,300,000/month
    -- Annual Income: PKR 15,600,000
    -- Expected Tax: PKR 4,449,000 (highest bracket)
    -- ========================================
    
    INSERT INTO income_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        monthly_salary, bonus, car_allowance, other_taxable,
        salary_tax_deducted, multiple_employer, additional_tax_deducted,
        medical_allowance, employer_contribution, other_exempt, other_sources,
        is_complete, last_updated_by, created_at
    ) VALUES (
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        1300000,  -- Monthly income: PKR 1,300,000 (Annual: 15,600,000)
        3900000,  -- Performance bonus (3 months)
        780000,   -- Car allowance: PKR 65,000/month
        600000,   -- Other benefits
        4449000,  -- Tax deducted at source (39% bracket)
        'Y',      -- Multiple income sources
        100000,   -- Additional tax from other sources
        80000,    -- Medical allowance
        200000,   -- Employer contribution
        50000,    -- Other exempt
        2400000,  -- Investment advisory income
        true,     -- Form complete
        imran_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO adjustable_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
        phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        1000000, 150000,    -- Large profit on debt transactions
        180000, 27000,      -- Multiple properties electricity
        60000, 9000,        -- Multiple phone connections
        25000000, 2500000,  -- Luxury vehicle collection
        200000,             -- Other adjustable tax
        true,
        imran_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO reductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        teacher_amount, teacher_reduction, behbood_reduction,
        export_income_reduction, industrial_undertaking_reduction, other_reductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        0, 0,               -- Not a teacher
        0,                  -- No behbood reduction
        0,                  -- No export income
        0,                  -- No industrial undertaking
        0,                  -- No other reductions
        true,
        imran_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO credits_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        charitable_donation, pension_contribution, life_insurance_premium,
        investment_tax_credit, other_credits,
        is_complete, last_updated_by, created_at
    ) VALUES (
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        1000000,            -- Large charitable donations
        500000,             -- Substantial pension contribution
        300000,             -- Multiple life insurance policies
        400000,             -- Large investment tax credit
        200000,             -- Other credits
        true,
        imran_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO deductions_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
        is_complete, last_updated_by, created_at
    ) VALUES (
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        0,                  -- No zakat deduction
        0,                  -- No ushr
        200000,             -- Tax paid abroad on international investments
        500000,             -- Large advance tax payment
        100000,             -- Other deductions
        true,
        imran_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    INSERT INTO final_tax_forms (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        sukuk_amount, sukuk_tax_rate, debt_amount, debt_tax_rate,
        prize_bonds, prize_bonds_tax, other_final_tax_amount, other_final_tax,
        is_complete, last_updated_by, created_at
    ) VALUES (
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        10000000, 0.10,     -- Massive Sukuk portfolio
        5000000, 0.15,      -- Large debt securities
        1000000, 250000,    -- Substantial prize bonds
        2000000, 400000,    -- Other final tax investments
        true,
        imran_user_id,
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
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        50000000, 0.15, 7500000,            -- Massive property speculation
        30000000, 0.10, 3000000,            -- Large property development sale
        20000000, 0,                        -- Long-term holdings (exempt)
        15000000, 0.125, 1875000,           -- Extensive securities trading
        5000000, 1250000,                   -- Other investment gains
        true,
        imran_user_id,
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
        imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26',
        200000000, 50000000, 30000000, 2000000, 2000000, 3000000, 20000000, 5000000,    -- Previous: 312M
        120000000, 100000000, 55000000, 2500000, 3000000, 3200000, 35000000, 10000000,  -- Current: 328.7M
        80000000, 70000000,                                                               -- Investment loans
        1000000, 800000,                                                                  -- Other liabilities
        true,
        imran_user_id,
        NOW()
    ) ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
    -- Complete form completion status for remaining scenarios
    INSERT INTO form_completion_status (
        tax_return_id, user_id, user_email, tax_year_id, tax_year,
        income_form_complete, adjustable_tax_form_complete, reductions_form_complete,
        credits_form_complete, deductions_form_complete, final_tax_form_complete,
        capital_gain_form_complete, expenses_form_complete, wealth_form_complete,
        created_at
    ) VALUES
        (sara_return_id, sara_user_id, 'sara.khan@consultants.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, false, false, false, true, NOW()),
        (ahmed_return_id, ahmed_user_id, 'dr.ahmed.hassan@comsats.edu.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, false, false, false, true, NOW()),
        (tariq_return_id, tariq_user_id, 'muhammad.tariq@globaltrading.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, true, true, true, true, NOW()),
        (zain_return_id, zain_user_id, 'zain.malik@consultants.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, false, true, true, true, NOW()),
        (imran_return_id, imran_user_id, 'imran.shah@ktrade.com.pk', tax_year_2025_26_id, '2025-26', true, true, true, true, true, true, true, false, true, NOW())
    ON CONFLICT (tax_return_id, user_id, user_email, tax_year_id) DO NOTHING;
    
END $$;

SELECT 'Remaining 5 scenarios (6-10) completed successfully!' as status;