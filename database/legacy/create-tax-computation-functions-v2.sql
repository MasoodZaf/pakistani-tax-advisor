-- =====================================================
-- TAX COMPUTATION SQL FUNCTIONS V2 (No Trigger Loops)
-- FBR Pakistan Tax Year 2025-26
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS recalculate_tax_computation(UUID, VARCHAR);

-- =====================================================
-- MAIN TAX COMPUTATION FUNCTION (No Source Table Updates)
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_tax_computation(
    p_user_id UUID,
    p_tax_year VARCHAR
)
RETURNS TABLE(
    income_from_salary_out NUMERIC,
    normal_income_tax_out NUMERIC,
    surcharge_out NUMERIC,
    capital_gains_tax_out NUMERIC,
    tax_reductions_out NUMERIC,
    tax_credits_out NUMERIC,
    net_tax_payable_out NUMERIC,
    total_tax_liability_out NUMERIC,
    balance_payable_out NUMERIC
) AS $$
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

    v_net_tax_payable NUMERIC := 0;
    v_total_tax_liability NUMERIC := 0;
    v_balance_payable NUMERIC := 0;

    v_record_exists BOOLEAN;
BEGIN
    -- Get tax year ID
    SELECT id INTO v_tax_year_id FROM tax_years WHERE tax_year = p_tax_year;
    IF v_tax_year_id IS NULL THEN
        RAISE EXCEPTION 'Tax year % not found', p_tax_year;
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

    -- ==================== CALCULATE NET AND TOTAL ====================
    v_net_tax_payable := v_normal_income_tax + v_surcharge + v_capital_gains_tax - v_total_reductions - v_total_credits;
    v_total_tax_liability := v_net_tax_payable + v_final_fixed_tax;
    v_balance_payable := v_total_tax_liability - v_withholding_tax;

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
            minimum_tax_on_other_income = v_other_income_min_tax,
            updated_at = NOW()
        WHERE user_id = p_user_id AND tax_year = p_tax_year;
    ELSE
        INSERT INTO tax_computation_forms (
            tax_return_id, user_id, user_email, tax_year_id, tax_year,
            income_from_salary, other_income_subject_to_min_tax, income_loss_other_sources,
            deductible_allowances, capital_gains_loss,
            normal_income_tax, surcharge_amount, capital_gains_tax,
            tax_reductions, tax_credits,
            final_fixed_tax, advance_tax_paid, minimum_tax_on_other_income,
            is_complete, last_updated_by
        ) VALUES (
            v_tax_return_id, p_user_id, v_user_email, v_tax_year_id, p_tax_year,
            v_income_from_salary, v_other_income_min_tax, v_other_income_normal_tax,
            v_deductible_allowances, v_capital_gains,
            v_normal_income_tax, v_surcharge, v_capital_gains_tax,
            v_total_reductions, v_total_credits,
            v_final_fixed_tax, v_withholding_tax, v_other_income_min_tax,
            TRUE, p_user_id
        );
    END IF;

    -- Return the calculated values
    RETURN QUERY SELECT
        v_income_from_salary,
        v_normal_income_tax,
        v_surcharge,
        v_capital_gains_tax,
        v_total_reductions,
        v_total_credits,
        v_net_tax_payable,
        v_total_tax_liability,
        v_balance_payable;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION recalculate_tax_computation(UUID, VARCHAR) TO PUBLIC;
