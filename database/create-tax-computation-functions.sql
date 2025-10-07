-- =====================================================
-- TAX COMPUTATION SQL FUNCTIONS
-- FBR Pakistan Tax Year 2025-26
-- =====================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS calculate_normal_income_tax(NUMERIC);
DROP FUNCTION IF EXISTS calculate_teacher_reduction(NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS calculate_charitable_credit(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS calculate_pension_credit(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS calculate_surrender_credit(NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS calculate_behbood_reduction(NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS recalculate_tax_computation(UUID, VARCHAR);
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON income_forms;
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON capital_gain_forms;
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON reductions_forms;
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON credits_forms;
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON deductions_forms;
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON final_min_income_forms;
DROP TRIGGER IF EXISTS trigger_recalculate_tax_computation ON adjustable_tax_forms;

-- =====================================================
-- 1. NORMAL INCOME TAX CALCULATION (FBR 2025-26 Slabs)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_normal_income_tax(taxable_income NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    income_tax NUMERIC := 0;
BEGIN
    -- FBR Tax Slabs for Individuals (2025-26)
    -- 0 - 600,000: 0%
    -- 600,001 - 1,200,000: (income - 600,000) * 5%
    -- 1,200,001 - 2,200,000: (income - 1,200,000) * 15% + 30,000
    -- 2,200,001 - 3,200,000: (income - 2,200,000) * 25% + 180,000
    -- 3,200,001 - 4,100,000: (income - 3,200,000) * 30% + 430,000
    -- Above 4,100,000: (income - 4,100,000) * 35% + 700,000

    IF taxable_income <= 600000 THEN
        income_tax := 0;
    ELSIF taxable_income <= 1200000 THEN
        income_tax := (taxable_income - 600000) * 0.05;
    ELSIF taxable_income <= 2200000 THEN
        income_tax := (taxable_income - 1200000) * 0.15 + 30000;
    ELSIF taxable_income <= 3200000 THEN
        income_tax := (taxable_income - 2200000) * 0.25 + 180000;
    ELSIF taxable_income <= 4100000 THEN
        income_tax := (taxable_income - 3200000) * 0.30 + 430000;
    ELSE
        income_tax := (taxable_income - 4100000) * 0.35 + 700000;
    END IF;

    RETURN ROUND(income_tax, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 2. TEACHER/RESEARCHER TAX REDUCTION (Section 60C)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_teacher_reduction(
    salary_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC,
    total_income NUMERIC,
    is_teacher BOOLEAN
)
RETURNS NUMERIC AS $$
DECLARE
    reduction NUMERIC := 0;
BEGIN
    -- Formula: (SalaryIncome * (NormalTax + Surcharge) / TotalIncome) * 25%
    IF is_teacher AND total_income > 0 THEN
        reduction := (salary_income * (normal_tax + surcharge) / total_income) * 0.25;
    END IF;

    RETURN ROUND(reduction, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 3. BEHBOOD CERTIFICATES TAX REDUCTION
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_behbood_reduction(
    certificate_amount NUMERIC,
    applicable_rate NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    reduction NUMERIC := 0;
BEGIN
    -- Formula: (TaxRate - 5%) * CertificateAmount
    -- TaxRate is passed as decimal (e.g., 0.10 for 10%)
    reduction := (applicable_rate - 0.05) * certificate_amount;

    RETURN ROUND(reduction, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 4. CHARITABLE DONATIONS TAX CREDIT (Section 61)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_charitable_credit(
    donation_amount NUMERIC,
    taxable_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    max_allowable NUMERIC;
    eligible_amount NUMERIC;
    credit NUMERIC := 0;
BEGIN
    -- Formula: (MIN(DonationAmount, TaxableIncome * 30%)) * (NormalTax + Surcharge) / TaxableIncome
    IF taxable_income > 0 THEN
        max_allowable := taxable_income * 0.30;
        eligible_amount := LEAST(donation_amount, max_allowable);
        credit := eligible_amount * (normal_tax + surcharge) / taxable_income;
    END IF;

    RETURN ROUND(credit, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 5. PENSION FUND TAX CREDIT (Section 63)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_pension_credit(
    pension_amount NUMERIC,
    taxable_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    max_allowable NUMERIC;
    eligible_amount NUMERIC;
    credit NUMERIC := 0;
BEGIN
    -- Formula: (MIN(PensionAmount, TaxableIncome * 50%)) * (NormalTax + Surcharge) / TaxableIncome
    IF taxable_income > 0 THEN
        max_allowable := taxable_income * 0.50;
        eligible_amount := LEAST(pension_amount, max_allowable);
        credit := eligible_amount * (normal_tax + surcharge) / taxable_income;
    END IF;

    RETURN ROUND(credit, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 6. SURRENDER TAX CREDIT (Negative Credit)
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_surrender_credit(
    surrender_amount NUMERIC,
    taxable_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    credit NUMERIC := 0;
BEGIN
    -- Formula: (SurrenderAmount * (NormalTax + Surcharge) / TaxableIncome) * -1
    IF taxable_income > 0 THEN
        credit := (surrender_amount * (normal_tax + surcharge) / taxable_income) * -1;
    END IF;

    RETURN ROUND(credit, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 7. MAIN TAX COMPUTATION FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_tax_computation(
    p_user_id UUID,
    p_tax_year VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_tax_year_id UUID;
    v_tax_return_id UUID;
    v_user_email VARCHAR;

    -- Income variables
    v_income_from_salary NUMERIC := 0;
    v_other_income_min_tax NUMERIC := 0;
    v_other_income_normal_tax NUMERIC := 0;
    v_total_income NUMERIC := 0;

    -- Deductions
    v_deductible_allowances NUMERIC := 0;
    v_taxable_income NUMERIC := 0;

    -- Capital Gains
    v_capital_gains NUMERIC := 0;
    v_capital_gains_tax NUMERIC := 0;

    -- Tax Calculations
    v_normal_income_tax NUMERIC := 0;
    v_surcharge NUMERIC := 0;

    -- Reductions
    v_teacher_yn BOOLEAN := FALSE;
    v_behbood_yn BOOLEAN := FALSE;
    v_behbood_amount NUMERIC := 0;
    v_behbood_rate NUMERIC := 0.10;
    v_teacher_reduction NUMERIC := 0;
    v_behbood_reduction NUMERIC := 0;
    v_total_reductions NUMERIC := 0;

    -- Credits
    v_charitable_yn BOOLEAN := FALSE;
    v_charitable_amount NUMERIC := 0;
    v_pension_yn BOOLEAN := FALSE;
    v_pension_amount NUMERIC := 0;
    v_surrender_amount NUMERIC := 0;
    v_charitable_credit NUMERIC := 0;
    v_pension_credit NUMERIC := 0;
    v_surrender_credit NUMERIC := 0;
    v_total_credits NUMERIC := 0;

    -- Final Tax
    v_final_fixed_tax NUMERIC := 0;
    v_withholding_tax NUMERIC := 0;
    v_adjustable_tax NUMERIC := 0;

    v_record_exists BOOLEAN;
BEGIN
    -- Get tax year ID
    SELECT id INTO v_tax_year_id FROM tax_years WHERE tax_year = p_tax_year;
    IF v_tax_year_id IS NULL THEN
        RAISE NOTICE 'Tax year % not found', p_tax_year;
        RETURN;
    END IF;

    -- Get user email
    SELECT email INTO v_user_email FROM users WHERE id = p_user_id;

    -- Get or create tax return
    SELECT id INTO v_tax_return_id
    FROM tax_returns
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    IF v_tax_return_id IS NULL THEN
        INSERT INTO tax_returns (user_id, user_email, tax_year_id, tax_year, filing_status, return_number)
        VALUES (p_user_id, v_user_email, v_tax_year_id, p_tax_year, 'draft',
                'TR-' || SUBSTRING(p_user_id::TEXT, 1, 8) || '-' || p_tax_year)
        RETURNING id INTO v_tax_return_id;
    END IF;

    -- ==================== FETCH INCOME DATA ====================
    SELECT
        COALESCE(total_employment_income, 0),
        COALESCE(other_income_min_tax_total, 0),
        COALESCE(other_income_no_min_tax_total, 0)
    INTO
        v_income_from_salary,
        v_other_income_min_tax,
        v_other_income_normal_tax
    FROM income_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    v_total_income := v_income_from_salary + v_other_income_min_tax + v_other_income_normal_tax;

    -- ==================== FETCH DEDUCTIONS ====================
    SELECT COALESCE(total_deduction_from_income, 0)
    INTO v_deductible_allowances
    FROM deductions_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    v_taxable_income := v_total_income - v_deductible_allowances;

    -- ==================== FETCH CAPITAL GAINS ====================
    SELECT
        COALESCE(total_capital_gains, 0),
        COALESCE(total_capital_gains_tax, 0)
    INTO
        v_capital_gains,
        v_capital_gains_tax
    FROM capital_gain_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    -- ==================== CALCULATE NORMAL INCOME TAX ====================
    v_normal_income_tax := calculate_normal_income_tax(v_taxable_income);

    -- ==================== CALCULATE SURCHARGE ====================
    -- 10% surcharge if taxable income > 10,000,000
    IF v_taxable_income > 10000000 THEN
        v_surcharge := v_normal_income_tax * 0.10;
    ELSE
        v_surcharge := 0;
    END IF;

    -- ==================== FETCH REDUCTIONS DATA ====================
    SELECT
        COALESCE(teacher_researcher_reduction_yn = 'Y', FALSE),
        COALESCE(behbood_certificates_reduction_yn = 'Y', FALSE),
        COALESCE(behbood_certificates_amount, 0)
    INTO
        v_teacher_yn,
        v_behbood_yn,
        v_behbood_amount
    FROM reductions_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    -- ==================== CALCULATE REDUCTIONS ====================
    v_teacher_reduction := calculate_teacher_reduction(
        v_income_from_salary,
        v_normal_income_tax,
        v_surcharge,
        v_total_income,
        v_teacher_yn
    );

    IF v_behbood_yn THEN
        v_behbood_reduction := calculate_behbood_reduction(v_behbood_amount, v_behbood_rate);
    END IF;

    v_total_reductions := v_teacher_reduction + v_behbood_reduction;

    -- Update reductions_forms with calculated values
    UPDATE reductions_forms SET
        teacher_researcher_tax_reduction = v_teacher_reduction,
        behbood_certificates_tax_reduction = v_behbood_reduction
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    -- ==================== FETCH CREDITS DATA ====================
    SELECT
        COALESCE(charitable_donations_u61_yn = 'Y', FALSE),
        COALESCE(charitable_donations_amount, 0),
        COALESCE(pension_fund_u63_yn = 'Y', FALSE),
        COALESCE(pension_fund_amount, 0),
        COALESCE(surrender_tax_credit_amount, 0)
    INTO
        v_charitable_yn,
        v_charitable_amount,
        v_pension_yn,
        v_pension_amount,
        v_surrender_amount
    FROM credits_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    -- ==================== CALCULATE CREDITS ====================
    IF v_charitable_yn THEN
        v_charitable_credit := calculate_charitable_credit(
            v_charitable_amount,
            v_taxable_income,
            v_normal_income_tax,
            v_surcharge
        );
    END IF;

    IF v_pension_yn THEN
        v_pension_credit := calculate_pension_credit(
            v_pension_amount,
            v_taxable_income,
            v_normal_income_tax,
            v_surcharge
        );
    END IF;

    IF v_surrender_amount > 0 THEN
        v_surrender_credit := calculate_surrender_credit(
            v_surrender_amount,
            v_taxable_income,
            v_normal_income_tax,
            v_surcharge
        );
    END IF;

    v_total_credits := v_charitable_credit + v_pension_credit + v_surrender_credit;

    -- Update credits_forms with calculated values
    UPDATE credits_forms SET
        charitable_donations_tax_credit = v_charitable_credit,
        pension_fund_tax_credit = v_pension_credit,
        surrender_tax_credit_reduction = v_surrender_credit
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    -- ==================== FETCH FINAL/MINIMUM TAX ====================
    SELECT
        COALESCE(
            dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted +
            dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted +
            dividend_u_s_150_7_5pc_ipp_shares_tax_deducted +
            dividend_u_s_150_31pc_atl_tax_deducted +
            return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted +
            return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted +
            return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted +
            return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted +
            return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted +
            profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted +
            profit_debt_national_savings_defence_39_14a_tax_deducted +
            interest_income_profit_debt_7b_up_to_5m_tax_deducted +
            employment_termination_benefits_12_6_avg_rate_tax_deducted +
            salary_arrears_12_7_relevant_rate_tax_deducted +
            capital_gain_tax_deducted,
        0)
    INTO v_final_fixed_tax
    FROM final_min_income_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    -- ==================== FETCH WITHHOLDING TAX ====================
    SELECT COALESCE(total_adjustable_tax, 0)
    INTO v_adjustable_tax
    FROM adjustable_tax_forms
    WHERE user_id = p_user_id AND tax_year = p_tax_year;

    v_withholding_tax := v_adjustable_tax + v_final_fixed_tax;

    -- ==================== INSERT OR UPDATE TAX COMPUTATION ====================
    SELECT EXISTS(
        SELECT 1 FROM tax_computation_forms
        WHERE user_id = p_user_id AND tax_year = p_tax_year
    ) INTO v_record_exists;

    IF v_record_exists THEN
        UPDATE tax_computation_forms SET
            income_from_salary = v_income_from_salary,
            other_income_subject_to_min_tax = v_other_income_min_tax,
            income_loss_other_sources = v_other_income_normal_tax,
            deductible_allowances = v_deductible_allowances,
            capital_gains_loss = v_capital_gains,
            normal_income_tax = v_normal_income_tax,
            surcharge_amount = v_surcharge,
            capital_gains_tax = v_capital_gains_tax,
            tax_reductions = v_total_reductions,
            tax_credits = v_total_credits,
            final_fixed_tax = v_final_fixed_tax,
            advance_tax_paid = v_withholding_tax,
            updated_at = NOW()
        WHERE user_id = p_user_id AND tax_year = p_tax_year;
    ELSE
        INSERT INTO tax_computation_forms (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            income_from_salary, other_income_subject_to_min_tax, income_loss_other_sources,
            deductible_allowances, capital_gains_loss,
            normal_income_tax, surcharge_amount, capital_gains_tax,
            tax_reductions, tax_credits,
            final_fixed_tax, advance_tax_paid,
            is_complete, last_updated_by
        ) VALUES (
            v_tax_return_id, p_user_id, v_user_email, v_tax_year_id, p_tax_year,
            v_income_from_salary, v_other_income_min_tax, v_other_income_normal_tax,
            v_deductible_allowances, v_capital_gains,
            v_normal_income_tax, v_surcharge, v_capital_gains_tax,
            v_total_reductions, v_total_credits,
            v_final_fixed_tax, v_withholding_tax,
            TRUE, p_user_id
        );
    END IF;

    RAISE NOTICE 'Tax computation recalculated for user % tax year %', p_user_id, p_tax_year;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. CREATE TRIGGERS FOR AUTOMATIC RECALCULATION
-- =====================================================

-- Trigger function to call recalculate_tax_computation
CREATE OR REPLACE FUNCTION trigger_recalculate_tax_computation()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the recalculation function with user_id and tax_year from the modified row
    PERFORM recalculate_tax_computation(NEW.user_id, NEW.tax_year);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on all relevant tables
CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON income_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON capital_gain_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON reductions_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON credits_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON deductions_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON final_min_income_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

CREATE TRIGGER trigger_recalculate_tax_computation
    AFTER INSERT OR UPDATE ON adjustable_tax_forms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_tax_computation();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION calculate_normal_income_tax(NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_teacher_reduction(NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_charitable_credit(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_pension_credit(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_surrender_credit(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_behbood_reduction(NUMERIC, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION recalculate_tax_computation(UUID, VARCHAR) TO PUBLIC;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================
-- Manual recalculation:
-- SELECT recalculate_tax_computation('6bf47a47-5341-4884-9960-bb660dfdd9df', '2025-26');

-- Test individual functions:
-- SELECT calculate_normal_income_tax(21485000); -- Should return 6784750
-- SELECT calculate_teacher_reduction(18610000, 6784750, 678475, 21560000, TRUE); -- Should return 1610512.72
