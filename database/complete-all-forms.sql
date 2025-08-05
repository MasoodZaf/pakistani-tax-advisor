-- Complete all tax forms for the 10 comprehensive scenarios
-- This script adds the remaining forms (adjustable tax, reductions, credits, etc.) for all users

-- Insert adjustable tax forms for all scenarios
INSERT INTO adjustable_tax_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    profit_on_debt, profit_on_debt_tax, electricity_bill, electricity_tax,
    phone_bill, phone_tax, vehicle_amount, vehicle_tax, other_tax,
    is_complete, last_updated_by, created_at
) VALUES
    -- Scenario 1: Hassan Ali - Minimal adjustable tax
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S01'), (SELECT id FROM users WHERE cnic = '35202-1111001-1'), 'hassan.ali@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 18000, 0, 9600, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111001-1'), NOW()),
    
    -- Scenario 2: Ayesha Ahmed - IT professional with some withholding
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S02'), (SELECT id FROM users WHERE cnic = '35202-1111002-2'), 'ayesha.ahmed@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 15000, 2250, 36000, 5400, 15000, 2250, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111002-2'), NOW()),
    
    -- Scenario 3: Omar Sheikh - Higher bills with advance tax
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S03'), (SELECT id FROM users WHERE cnic = '42201-1111003-3'), 'omar.sheikh@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 80000, 12000, 72000, 10800, 24000, 3600, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '42201-1111003-3'), NOW()),
    
    -- Scenario 4: Fatima Malik - High income with vehicle purchase
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S04'), (SELECT id FROM users WHERE cnic = '35202-1111004-4'), 'fatima.malik@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 200000, 30000, 96000, 14400, 30000, 4500, 6000000, 600000, 25000, true, (SELECT id FROM users WHERE cnic = '35202-1111004-4'), NOW()),
    
    -- Scenario 5: Ali Raza - CEO with large purchases
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S05'), (SELECT id FROM users WHERE cnic = '35202-1111005-5'), 'ali.raza@nestle.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 500000, 75000, 150000, 22500, 60000, 9000, 15000000, 1500000, 100000, true, (SELECT id FROM users WHERE cnic = '35202-1111005-5'), NOW()),
    
    -- Scenario 6: Sara Khan - Non-filer with higher advance tax
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S06'), (SELECT id FROM users WHERE cnic = '42301-1111006-6'), 'sara.khan@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 60000, 15000, 24000, 6000, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '42301-1111006-6'), NOW()),
    
    -- Scenario 7: Dr. Ahmed Hassan - Teacher with minimal tax
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S07'), (SELECT id FROM users WHERE cnic = '35202-1111007-7'), 'dr.ahmed.hassan@comsats.edu.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 36000, 0, 18000, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111007-7'), NOW()),
    
    -- Scenario 8: Muhammad Tariq - Business owner with significant taxes
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S08'), (SELECT id FROM users WHERE cnic = '35201-1111008-8'), 'muhammad.tariq@globaltrading.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 300000, 45000, 120000, 18000, 36000, 5400, 8000000, 800000, 50000, true, (SELECT id FROM users WHERE cnic = '35201-1111008-8'), NOW()),
    
    -- Scenario 9: Zain Malik - IT consultant with business expenses
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S09'), (SELECT id FROM users WHERE cnic = '42301-1111009-9'), 'zain.malik@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 150000, 22500, 96000, 14400, 30000, 4500, 4000000, 400000, 30000, true, (SELECT id FROM users WHERE cnic = '42301-1111009-9'), NOW()),
    
    -- Scenario 10: Imran Shah - Wealthy investor with massive transactions
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S10'), (SELECT id FROM users WHERE cnic = '35202-1111010-0'), 'imran.shah@ktrade.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 1000000, 150000, 180000, 27000, 60000, 9000, 25000000, 2500000, 200000, true, (SELECT id FROM users WHERE cnic = '35202-1111010-0'), NOW());

-- Insert reductions forms
INSERT INTO reductions_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    teacher_amount, teacher_reduction, behbood_reduction,
    export_income_reduction, industrial_undertaking_reduction, other_reductions,
    is_complete, last_updated_by, created_at
) VALUES
    -- Scenario 1: Hassan Ali - No reductions yet
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S01'), (SELECT id FROM users WHERE cnic = '35202-1111001-1'), 'hassan.ali@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111001-1'), NOW()),
    
    -- Scenario 2: Ayesha Ahmed - IT export reduction
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S02'), (SELECT id FROM users WHERE cnic = '35202-1111002-2'), 'ayesha.ahmed@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 180000, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111002-2'), NOW()),
    
    -- Scenario 3: Omar Sheikh - No specific reductions
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S03'), (SELECT id FROM users WHERE cnic = '42201-1111003-3'), 'omar.sheikh@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '42201-1111003-3'), NOW()),
    
    -- Scenario 4: Fatima Malik - No reductions
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S04'), (SELECT id FROM users WHERE cnic = '35202-1111004-4'), 'fatima.malik@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111004-4'), NOW()),
    
    -- Scenario 5: Ali Raza - Industrial undertaking reduction
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S05'), (SELECT id FROM users WHERE cnic = '35202-1111005-5'), 'ali.raza@nestle.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 500000, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111005-5'), NOW()),
    
    -- Scenario 6: Sara Khan - Non-filer, limited reductions
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S06'), (SELECT id FROM users WHERE cnic = '42301-1111006-6'), 'sara.khan@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '42301-1111006-6'), NOW()),
    
    -- Scenario 7: Dr. Ahmed Hassan - Teacher reduction
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S07'), (SELECT id FROM users WHERE cnic = '35202-1111007-7'), 'dr.ahmed.hassan@comsats.edu.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 1200000, 60000, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111007-7'), NOW()),
    
    -- Scenario 8: Muhammad Tariq - Export income reduction
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S08'), (SELECT id FROM users WHERE cnic = '35201-1111008-8'), 'muhammad.tariq@globaltrading.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 600000, 0, 0, true, (SELECT id FROM users WHERE cnic = '35201-1111008-8'), NOW()),
    
    -- Scenario 9: Zain Malik - Large IT export reduction
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S09'), (SELECT id FROM users WHERE cnic = '42301-1111009-9'), 'zain.malik@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 1800000, 0, 0, true, (SELECT id FROM users WHERE cnic = '42301-1111009-9'), NOW()),
    
    -- Scenario 10: Imran Shah - No reductions (pure investment income)
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S10'), (SELECT id FROM users WHERE cnic = '35202-1111010-0'), 'imran.shah@ktrade.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111010-0'), NOW());

-- Insert credits forms
INSERT INTO credits_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    charitable_donation, pension_contribution, life_insurance_premium,
    investment_tax_credit, other_credits,
    is_complete, last_updated_by, created_at
) VALUES
    -- Scenario 1: Hassan Ali - Basic credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S01'), (SELECT id FROM users WHERE cnic = '35202-1111001-1'), 'hassan.ali@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 2000, 0, 6000, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111001-1'), NOW()),
    
    -- Scenario 2: Ayesha Ahmed - Moderate credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S02'), (SELECT id FROM users WHERE cnic = '35202-1111002-2'), 'ayesha.ahmed@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 25000, 30000, 24000, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111002-2'), NOW()),
    
    -- Scenario 3: Omar Sheikh - Good credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S03'), (SELECT id FROM users WHERE cnic = '42201-1111003-3'), 'omar.sheikh@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 100000, 80000, 60000, 50000, 0, true, (SELECT id FROM users WHERE cnic = '42201-1111003-3'), NOW()),
    
    -- Scenario 4: Fatima Malik - High credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S04'), (SELECT id FROM users WHERE cnic = '35202-1111004-4'), 'fatima.malik@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 150000, 120000, 100000, 80000, 30000, true, (SELECT id FROM users WHERE cnic = '35202-1111004-4'), NOW()),
    
    -- Scenario 5: Ali Raza - Maximum credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S05'), (SELECT id FROM users WHERE cnic = '35202-1111005-5'), 'ali.raza@nestle.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 500000, 300000, 200000, 250000, 100000, true, (SELECT id FROM users WHERE cnic = '35202-1111005-5'), NOW()),
    
    -- Scenario 6: Sara Khan - Limited credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S06'), (SELECT id FROM users WHERE cnic = '42301-1111006-6'), 'sara.khan@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 20000, 15000, 24000, 0, 0, true, (SELECT id FROM users WHERE cnic = '42301-1111006-6'), NOW()),
    
    -- Scenario 7: Dr. Ahmed Hassan - Academic credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S07'), (SELECT id FROM users WHERE cnic = '35202-1111007-7'), 'dr.ahmed.hassan@comsats.edu.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 30000, 20000, 24000, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111007-7'), NOW()),
    
    -- Scenario 8: Muhammad Tariq - Business credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S08'), (SELECT id FROM users WHERE cnic = '35201-1111008-8'), 'muhammad.tariq@globaltrading.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 200000, 150000, 84000, 100000, 50000, true, (SELECT id FROM users WHERE cnic = '35201-1111008-8'), NOW()),
    
    -- Scenario 9: Zain Malik - Professional credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S09'), (SELECT id FROM users WHERE cnic = '42301-1111009-9'), 'zain.malik@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 80000, 100000, 60000, 150000, 40000, true, (SELECT id FROM users WHERE cnic = '42301-1111009-9'), NOW()),
    
    -- Scenario 10: Imran Shah - Wealthy investor credits
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S10'), (SELECT id FROM users WHERE cnic = '35202-1111010-0'), 'imran.shah@ktrade.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 1000000, 500000, 300000, 400000, 200000, true, (SELECT id FROM users WHERE cnic = '35202-1111010-0'), NOW());

-- Insert deductions forms
INSERT INTO deductions_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    zakat, ushr, tax_paid_foreign_country, advance_tax, other_deductions,
    is_complete, last_updated_by, created_at
) VALUES
    -- All scenarios with appropriate deductions
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S01'), (SELECT id FROM users WHERE cnic = '35202-1111001-1'), 'hassan.ali@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111001-1'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S02'), (SELECT id FROM users WHERE cnic = '35202-1111002-2'), 'ayesha.ahmed@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 15000, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111002-2'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S03'), (SELECT id FROM users WHERE cnic = '42201-1111003-3'), 'omar.sheikh@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 50000, 0, true, (SELECT id FROM users WHERE cnic = '42201-1111003-3'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S04'), (SELECT id FROM users WHERE cnic = '35202-1111004-4'), 'fatima.malik@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 100000, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111004-4'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S05'), (SELECT id FROM users WHERE cnic = '35202-1111005-5'), 'ali.raza@nestle.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 300000, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111005-5'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S06'), (SELECT id FROM users WHERE cnic = '42301-1111006-6'), 'sara.khan@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '42301-1111006-6'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S07'), (SELECT id FROM users WHERE cnic = '35202-1111007-7'), 'dr.ahmed.hassan@comsats.edu.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 10000, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111007-7'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S08'), (SELECT id FROM users WHERE cnic = '35201-1111008-8'), 'muhammad.tariq@globaltrading.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 50000, 200000, 25000, true, (SELECT id FROM users WHERE cnic = '35201-1111008-8'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S09'), (SELECT id FROM users WHERE cnic = '42301-1111009-9'), 'zain.malik@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 80000, 120000, 20000, true, (SELECT id FROM users WHERE cnic = '42301-1111009-9'), NOW()),
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S10'), (SELECT id FROM users WHERE cnic = '35202-1111010-0'), 'imran.shah@ktrade.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 0, 200000, 500000, 100000, true, (SELECT id FROM users WHERE cnic = '35202-1111010-0'), NOW());

-- Insert wealth forms for all scenarios
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
) VALUES
    -- Scenario 1: Hassan Ali - Entry level wealth
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S01'), (SELECT id FROM users WHERE cnic = '35202-1111001-1'), 'hassan.ali@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 0, 25000, 0, 15000, 20000, 30000, 12000, 0, 0, 40000, 0, 18000, 35000, 37200, 25000, 0, 0, 0, 0, 0, true, (SELECT id FROM users WHERE cnic = '35202-1111001-1'), NOW()),
    
    -- Scenario 2: Ayesha Ahmed - Growing wealth
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S02'), (SELECT id FROM users WHERE cnic = '35202-1111002-2'), 'ayesha.ahmed@techsol.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 2500000, 400000, 800000, 100000, 80000, 150000, 180000, 30000, 2800000, 600000, 800000, 120000, 120000, 172000, 250000, 50000, 1200000, 1000000, 30000, 20000, true, (SELECT id FROM users WHERE cnic = '35202-1111002-2'), NOW()),
    
    -- Scenario 3: Omar Sheikh - Substantial wealth with property sale
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S03'), (SELECT id FROM users WHERE cnic = '42201-1111003-3'), 'omar.sheikh@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 8000000, 1200000, 2500000, 200000, 150000, 400000, 500000, 100000, 3000000, 2000000, 2500000, 250000, 200000, 450000, 800000, 150000, 4000000, 3500000, 80000, 60000, true, (SELECT id FROM users WHERE cnic = '42201-1111003-3'), NOW()),
    
    -- Scenario 4: Fatima Malik - High wealth
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S04'), (SELECT id FROM users WHERE cnic = '35202-1111004-4'), 'fatima.malik@abl.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 12000000, 2000000, 3500000, 300000, 200000, 600000, 1000000, 200000, 13000000, 3500000, 9000000, 400000, 300000, 680000, 1500000, 300000, 8000000, 7000000, 100000, 80000, true, (SELECT id FROM users WHERE cnic = '35202-1111004-4'), NOW()),
    
    -- Scenario 5: Ali Raza - Ultra high wealth
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S05'), (SELECT id FROM users WHERE cnic = '35202-1111005-5'), 'ali.raza@nestle.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 50000000, 10000000, 15000000, 1000000, 500000, 2000000, 5000000, 1000000, 60000000, 20000000, 30000000, 1200000, 1000000, 2150000, 8000000, 2000000, 25000000, 20000000, 500000, 300000, true, (SELECT id FROM users WHERE cnic = '35202-1111005-5'), NOW()),
    
    -- Remaining scenarios with appropriate wealth levels
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S06'), (SELECT id FROM users WHERE cnic = '42301-1111006-6'), 'sara.khan@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 2000000, 300000, 1200000, 80000, 50000, 100000, 150000, 20000, 2200000, 450000, 1200000, 100000, 80000, 125000, 200000, 30000, 800000, 600000, 25000, 15000, true, (SELECT id FROM users WHERE cnic = '42301-1111006-6'), NOW()),
    
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S07'), (SELECT id FROM users WHERE cnic = '35202-1111007-7'), 'dr.ahmed.hassan@comsats.edu.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 3000000, 200000, 600000, 80000, 40000, 180000, 80000, 50000, 3200000, 280000, 600000, 100000, 60000, 195000, 120000, 70000, 1500000, 1300000, 20000, 15000, true, (SELECT id FROM users WHERE cnic = '35202-1111007-7'), NOW()),
    
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S08'), (SELECT id FROM users WHERE cnic = '35201-1111008-8'), 'muhammad.tariq@globaltrading.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 25000000, 5000000, 8000000, 200000, 300000, 600000, 2000000, 1000000, 7000000, 8000000, 16000000, 250000, 500000, 650000, 3000000, 2000000, 15000000, 12000000, 200000, 150000, true, (SELECT id FROM users WHERE cnic = '35201-1111008-8'), NOW()),
    
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S09'), (SELECT id FROM users WHERE cnic = '42301-1111009-9'), 'zain.malik@consultants.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 8000000, 2000000, 2500000, 100000, 200000, 300000, 800000, 500000, 5000000, 3000000, 6000000, 120000, 300000, 400000, 1200000, 800000, 4000000, 3500000, 80000, 60000, true, (SELECT id FROM users WHERE cnic = '42301-1111009-9'), NOW()),
    
    ((SELECT id FROM tax_returns WHERE return_number = 'TR-2025-S10'), (SELECT id FROM users WHERE cnic = '35202-1111010-0'), 'imran.shah@ktrade.com.pk', (SELECT id FROM tax_years WHERE tax_year = '2025-26'), '2025-26', 200000000, 50000000, 30000000, 2000000, 2000000, 3000000, 20000000, 5000000, 120000000, 100000000, 55000000, 2500000, 3000000, 3200000, 35000000, 10000000, 80000000, 70000000, 1000000, 800000, true, (SELECT id FROM users WHERE cnic = '35202-1111010-0'), NOW());

-- Add final audit log entry
INSERT INTO audit_log (
    user_id, user_email, action, table_name, record_id,
    field_name, new_value, category, change_summary
) VALUES (
    (SELECT id FROM users WHERE cnic = '35202-1111001-1'),
    'hassan.ali@techsol.com.pk',
    'bulk_insert', 'all_forms_completed', 
    null,
    'all_forms_population', 
    '{"forms_completed": "adjustable_tax, reductions, credits, deductions, wealth", "scenarios": 10}',
    'comprehensive_test_completion',
    'All Forms Completed: Populated all remaining tax forms for 10 comprehensive scenarios'
);

-- Final summary
SELECT 
    'All Forms Population Summary' as info,
    (SELECT COUNT(*) FROM adjustable_tax_forms WHERE tax_year = '2025-26') as adjustable_tax_forms,
    (SELECT COUNT(*) FROM reductions_forms WHERE tax_year = '2025-26') as reductions_forms,
    (SELECT COUNT(*) FROM credits_forms WHERE tax_year = '2025-26') as credits_forms,
    (SELECT COUNT(*) FROM deductions_forms WHERE tax_year = '2025-26') as deductions_forms,
    (SELECT COUNT(*) FROM wealth_forms WHERE tax_year = '2025-26') as wealth_forms;

SELECT 'All tax forms have been successfully populated for 10 comprehensive scenarios!' as status;