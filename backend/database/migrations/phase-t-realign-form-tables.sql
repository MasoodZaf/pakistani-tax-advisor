-- =============================================================================
-- Phase T - Realign form tables with application code (Prisma 0_init schema)
-- =============================================================================
--
-- WHAT THIS DOES
-- --------------
-- Drops and recreates the 13 form tables that the application code expects.
-- The deployed VPS DB (tax.aurmak.com) was initialized from the top-level
-- /schema.sql, which carries an OLD pre-Prisma schema for these form tables
-- (e.g. income_forms.monthly_salary, .bonus, .car_allowance, ...).
--
-- The application code in backend/src/routes/ and backend/src/modules/*/routes/
-- expects the NEW Prisma schema from
--   backend/prisma/migrations/0_init/migration.sql
-- (e.g. income_forms.annual_basic_salary, .allowances,
-- .profit_on_debt_15_percent, .employer_contribution_provident, ...).
--
-- Result of the drift: every POST /api/<form>/<taxYear> fails with
--   column "annual_basic_salary" of relation "income_forms" does not exist
-- and the end-to-end form flow is unusable.
--
-- This migration drops those 13 tables and recreates them from the Prisma
-- 0_init definition, with one mandatory rewrite: every
--   DEFAULT (<expr-referencing-other-columns>)
-- is rewritten as
--   GENERATED ALWAYS AS (<expr>) STORED
-- because Postgres rejects column-referencing DEFAULTs. (Prisma's 0_init.sql
-- is not runnable as-is on a fresh Postgres - the same gotcha already worked
-- around in /schema.sql and /database/schema.sql for the simpler tables.)
--
-- Tables affected (13):
--   income_forms, adjustable_tax_forms, capital_gain_forms, credits_forms,
--   deductions_forms, expenses_forms, final_min_income_forms, final_tax_forms,
--   reductions_forms, tax_computation_forms, wealth_forms,
--   wealth_reconciliation_forms, form_completion_status
--
-- Notes on table-name choice:
--   * wealth_forms (NOT wealth_statement_forms) is recreated. The main
--     IncomeTax form flow in backend/src/modules/IncomeTax/routes/taxForms.js
--     and helpers/services use wealth_forms. (wealth_statement_forms exists
--     in 0_init too but is only referenced by the standalone
--     backend/src/modules/WealthStatement/routes/wealthForm.js, which is not
--     part of the main 13-form return flow this migration targets.)
--   * form_completion_status IS included - it is queried by the main forms
--     completion router and by admin/auth routes.
--
-- DATA LOSS
-- ---------
-- DROP TABLE ... CASCADE is used. Any rows previously stored in these 13
-- tables on the target DB will be lost. This is acceptable for the current
-- staging / early-prototype state where no end-user has successfully completed
-- a return through the broken UI flow. If you want a safety net first:
--
--   docker exec tax-advisor-db pg_dump -U postgres -d tax_advisor \
--     -t income_forms -t adjustable_tax_forms -t capital_gain_forms \
--     -t credits_forms -t deductions_forms -t expenses_forms \
--     -t final_min_income_forms -t final_tax_forms -t reductions_forms \
--     -t tax_computation_forms -t wealth_forms \
--     -t wealth_reconciliation_forms -t form_completion_status \
--     > /tmp/form_tables_backup_$(date +%Y%m%d_%H%M%S).sql
--
-- The parent tables (users, tax_years, tax_returns, personal_information,
-- audit_log, sessions, etc.) are NOT touched - only the form tables.
-- CASCADE on the DROPs cleans up the FKs *from* these form tables; no FK
-- *into* these tables exists elsewhere in the schema.
--
-- IDEMPOTENT
-- ----------
-- Safe to re-run. DROP IF EXISTS + fresh CREATE TABLE.
--
-- HOW TO APPLY
-- ------------
--   docker exec -i tax-advisor-db psql -U postgres -d tax_advisor \
--     < phase-t-realign-form-tables.sql
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Drop the 13 form tables (CASCADE clears FKs originating from them).
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS form_completion_status      CASCADE;
DROP TABLE IF EXISTS tax_computation_forms       CASCADE;
DROP TABLE IF EXISTS wealth_reconciliation_forms CASCADE;
DROP TABLE IF EXISTS wealth_forms                CASCADE;
DROP TABLE IF EXISTS expenses_forms              CASCADE;
DROP TABLE IF EXISTS deductions_forms            CASCADE;
DROP TABLE IF EXISTS credits_forms               CASCADE;
DROP TABLE IF EXISTS reductions_forms            CASCADE;
DROP TABLE IF EXISTS final_tax_forms             CASCADE;
DROP TABLE IF EXISTS final_min_income_forms      CASCADE;
DROP TABLE IF EXISTS capital_gain_forms          CASCADE;
DROP TABLE IF EXISTS adjustable_tax_forms        CASCADE;
DROP TABLE IF EXISTS income_forms                CASCADE;

-- -----------------------------------------------------------------------------
-- 2. income_forms
-- -----------------------------------------------------------------------------

CREATE TABLE income_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID,
    user_id UUID NOT NULL,
    user_email VARCHAR(255),
    tax_year_id UUID,
    tax_year VARCHAR(10) NOT NULL,
    annual_basic_salary DECIMAL(15,2) DEFAULT 0,
    allowances DECIMAL(15,2) DEFAULT 0,
    bonus DECIMAL(15,2) DEFAULT 0,
    medical_allowance DECIMAL(15,2) DEFAULT 0,
    pension_from_ex_employer DECIMAL(15,2) DEFAULT 0,
    employment_termination_payment DECIMAL(15,2) DEFAULT 0,
    retirement_from_approved_funds DECIMAL(15,2) DEFAULT 0,
    directorship_fee DECIMAL(15,2) DEFAULT 0,
    other_cash_benefits DECIMAL(15,2) DEFAULT 0,
    employer_contribution_provident DECIMAL(15,2) DEFAULT 0,
    taxable_car_value DECIMAL(15,2) DEFAULT 0,
    other_taxable_subsidies DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_15_percent DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_12_5_percent DECIMAL(15,2) DEFAULT 0,
    other_taxable_income_rent DECIMAL(15,2) DEFAULT 0,
    other_taxable_income_others DECIMAL(15,2) DEFAULT 0,
    income_exempt_from_tax DECIMAL(15,2) GENERATED ALWAYS AS (- ((COALESCE(retirement_from_approved_funds, (0)::numeric) + COALESCE(employment_termination_payment, (0)::numeric)) + COALESCE(medical_allowance, (0)::numeric))) STORED,
    annual_salary_wages_total DECIMAL(15,2) GENERATED ALWAYS AS (((((((((COALESCE(annual_basic_salary, (0)::numeric) + COALESCE(allowances, (0)::numeric)) + COALESCE(bonus, (0)::numeric)) + COALESCE(medical_allowance, (0)::numeric)) + COALESCE(pension_from_ex_employer, (0)::numeric)) + COALESCE(employment_termination_payment, (0)::numeric)) + COALESCE(retirement_from_approved_funds, (0)::numeric)) + COALESCE(directorship_fee, (0)::numeric)) + COALESCE(other_cash_benefits, (0)::numeric)) + (- ((COALESCE(retirement_from_approved_funds, (0)::numeric) + COALESCE(employment_termination_payment, (0)::numeric)) + COALESCE(medical_allowance, (0)::numeric)))) STORED,
    non_cash_benefit_exempt DECIMAL(15,2) GENERATED ALWAYS AS (- LEAST(COALESCE(employer_contribution_provident, (0)::numeric), (150000)::numeric)) STORED,
    total_non_cash_benefits DECIMAL(15,2) GENERATED ALWAYS AS (((COALESCE(employer_contribution_provident, (0)::numeric) + COALESCE(taxable_car_value, (0)::numeric)) + COALESCE(other_taxable_subsidies, (0)::numeric)) + (- LEAST(COALESCE(employer_contribution_provident, (0)::numeric), (150000)::numeric))) STORED,
    other_income_min_tax_total DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(profit_on_debt_15_percent, (0)::numeric) + COALESCE(profit_on_debt_12_5_percent, (0)::numeric)) STORED,
    other_income_no_min_tax_total DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(other_taxable_income_rent, (0)::numeric) + COALESCE(other_taxable_income_others, (0)::numeric)) STORED,
    total_employment_income DECIMAL(15,2) GENERATED ALWAYS AS ((((((((((COALESCE(annual_basic_salary, (0)::numeric) + COALESCE(allowances, (0)::numeric)) + COALESCE(bonus, (0)::numeric)) + COALESCE(medical_allowance, (0)::numeric)) + COALESCE(pension_from_ex_employer, (0)::numeric)) + COALESCE(employment_termination_payment, (0)::numeric)) + COALESCE(retirement_from_approved_funds, (0)::numeric)) + COALESCE(directorship_fee, (0)::numeric)) + COALESCE(other_cash_benefits, (0)::numeric)) + (- ((COALESCE(retirement_from_approved_funds, (0)::numeric) + COALESCE(employment_termination_payment, (0)::numeric)) + COALESCE(medical_allowance, (0)::numeric)))) + (((COALESCE(employer_contribution_provident, (0)::numeric) + COALESCE(taxable_car_value, (0)::numeric)) + COALESCE(other_taxable_subsidies, (0)::numeric)) + (- LEAST(COALESCE(employer_contribution_provident, (0)::numeric), (150000)::numeric)))) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT income_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 3. adjustable_tax_forms
-- -----------------------------------------------------------------------------

CREATE TABLE adjustable_tax_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    salary_employees_149_gross_receipt DECIMAL(15,2) DEFAULT 0,
    salary_employees_149_tax_collected DECIMAL(15,2) DEFAULT 0,
    directorship_fee_149_3_gross_receipt DECIMAL(15,2) DEFAULT 0,
    directorship_fee_149_3_tax_collected DECIMAL(15,2) DEFAULT 0,
    profit_debt_151_15_gross_receipt DECIMAL(15,2) DEFAULT 0,
    profit_debt_151_15_tax_collected DECIMAL(15,2) DEFAULT 0,
    profit_debt_sukook_151a_gross_receipt DECIMAL(15,2) DEFAULT 0,
    profit_debt_sukook_151a_tax_collected DECIMAL(15,2) DEFAULT 0,
    tax_deducted_rent_section_155_gross_receipt DECIMAL(15,2) DEFAULT 0,
    tax_deducted_rent_section_155_tax_collected DECIMAL(15,2) DEFAULT 0,
    advance_tax_cash_withdrawal_231ab_gross_receipt DECIMAL(15,2) DEFAULT 0,
    advance_tax_cash_withdrawal_231ab_tax_collected DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_registration_fee_231b1_gross_receipt DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_registration_fee_231b1_tax_collected DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_transfer_fee_231b2_gross_receipt DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_transfer_fee_231b2_tax_collected DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_sale_231b3_gross_receipt DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_sale_231b3_tax_collected DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_leasing_231b1a_gross_receipt DECIMAL(15,2) DEFAULT 0,
    motor_vehicle_leasing_231b1a_tax_collected DECIMAL(15,2) DEFAULT 0,
    advance_tax_motor_vehicle_231b2a_gross_receipt DECIMAL(15,2) DEFAULT 0,
    advance_tax_motor_vehicle_231b2a_tax_collected DECIMAL(15,2) DEFAULT 0,
    electricity_bill_domestic_235_gross_receipt DECIMAL(15,2) DEFAULT 0,
    electricity_bill_domestic_235_tax_collected DECIMAL(15,2) DEFAULT 0,
    telephone_bill_236_1e_gross_receipt DECIMAL(15,2) DEFAULT 0,
    telephone_bill_236_1e_tax_collected DECIMAL(15,2) DEFAULT 0,
    cellphone_bill_236_1f_gross_receipt DECIMAL(15,2) DEFAULT 0,
    cellphone_bill_236_1f_tax_collected DECIMAL(15,2) DEFAULT 0,
    prepaid_telephone_card_236_1b_gross_receipt DECIMAL(15,2) DEFAULT 0,
    prepaid_telephone_card_236_1b_tax_collected DECIMAL(15,2) DEFAULT 0,
    phone_unit_236_1c_gross_receipt DECIMAL(15,2) DEFAULT 0,
    phone_unit_236_1c_tax_collected DECIMAL(15,2) DEFAULT 0,
    internet_bill_236_1d_gross_receipt DECIMAL(15,2) DEFAULT 0,
    internet_bill_236_1d_tax_collected DECIMAL(15,2) DEFAULT 0,
    prepaid_internet_card_236_1e_gross_receipt DECIMAL(15,2) DEFAULT 0,
    prepaid_internet_card_236_1e_tax_collected DECIMAL(15,2) DEFAULT 0,
    sale_transfer_immoveable_property_236c_gross_receipt DECIMAL(15,2) DEFAULT 0,
    sale_transfer_immoveable_property_236c_tax_collected DECIMAL(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_sold_same_year_gross_recei DECIMAL(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_sold_same_year_tax_collect DECIMAL(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_prior_year_gross_receipt DECIMAL(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_prior_year_tax_collected DECIMAL(15,2) DEFAULT 0,
    purchase_transfer_immoveable_property_236k_gross_receipt DECIMAL(15,2) DEFAULT 0,
    purchase_transfer_immoveable_property_236k_tax_collected DECIMAL(15,2) DEFAULT 0,
    functions_gatherings_charges_236cb_gross_receipt DECIMAL(15,2) DEFAULT 0,
    functions_gatherings_charges_236cb_tax_collected DECIMAL(15,2) DEFAULT 0,
    withholding_tax_sale_considerations_37e_gross_receipt DECIMAL(15,2) DEFAULT 0,
    withholding_tax_sale_considerations_37e_tax_collected DECIMAL(15,2) DEFAULT 0,
    advance_fund_23a_part_i_second_schedule_gross_receipt DECIMAL(15,2) DEFAULT 0,
    advance_fund_23a_part_i_second_schedule_tax_collected DECIMAL(15,2) DEFAULT 0,
    persons_remitting_amount_abroad_236v_gross_receipt DECIMAL(15,2) DEFAULT 0,
    persons_remitting_amount_abroad_236v_tax_collected DECIMAL(15,2) DEFAULT 0,
    advance_tax_foreign_domestic_workers_231c_gross_receipt DECIMAL(15,2) DEFAULT 0,
    advance_tax_foreign_domestic_workers_231c_tax_collected DECIMAL(15,2) DEFAULT 0,
    total_adjustable_tax DECIMAL(15,2) GENERATED ALWAYS AS ((((((((((((((((((((((((((COALESCE(salary_employees_149_tax_collected, (0)::numeric) + COALESCE(directorship_fee_149_3_tax_collected, (0)::numeric)) + COALESCE(profit_debt_151_15_tax_collected, (0)::numeric)) + COALESCE(profit_debt_sukook_151a_tax_collected, (0)::numeric)) + COALESCE(tax_deducted_rent_section_155_tax_collected, (0)::numeric)) + COALESCE(advance_tax_cash_withdrawal_231ab_tax_collected, (0)::numeric)) + COALESCE(motor_vehicle_registration_fee_231b1_tax_collected, (0)::numeric)) + COALESCE(motor_vehicle_transfer_fee_231b2_tax_collected, (0)::numeric)) + COALESCE(motor_vehicle_sale_231b3_tax_collected, (0)::numeric)) + COALESCE(motor_vehicle_leasing_231b1a_tax_collected, (0)::numeric)) + COALESCE(advance_tax_motor_vehicle_231b2a_tax_collected, (0)::numeric)) + COALESCE(electricity_bill_domestic_235_tax_collected, (0)::numeric)) + COALESCE(telephone_bill_236_1e_tax_collected, (0)::numeric)) + COALESCE(cellphone_bill_236_1f_tax_collected, (0)::numeric)) + COALESCE(prepaid_telephone_card_236_1b_tax_collected, (0)::numeric)) + COALESCE(phone_unit_236_1c_tax_collected, (0)::numeric)) + COALESCE(internet_bill_236_1d_tax_collected, (0)::numeric)) + COALESCE(prepaid_internet_card_236_1e_tax_collected, (0)::numeric)) + COALESCE(sale_transfer_immoveable_property_236c_tax_collected, (0)::numeric)) + COALESCE(tax_deducted_236c_property_purchased_sold_same_year_tax_collect, (0)::numeric)) + COALESCE(tax_deducted_236c_property_purchased_prior_year_tax_collected, (0)::numeric)) + COALESCE(purchase_transfer_immoveable_property_236k_tax_collected, (0)::numeric)) + COALESCE(functions_gatherings_charges_236cb_tax_collected, (0)::numeric)) + COALESCE(withholding_tax_sale_considerations_37e_tax_collected, (0)::numeric)) + COALESCE(advance_fund_23a_part_i_second_schedule_tax_collected, (0)::numeric)) + COALESCE(persons_remitting_amount_abroad_236v_tax_collected, (0)::numeric)) + COALESCE(advance_tax_foreign_domestic_workers_231c_tax_collected, (0)::numeric)) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT adjustable_tax_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 4. capital_gain_forms
-- -----------------------------------------------------------------------------

CREATE TABLE capital_gain_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    property_1_year DECIMAL(15,2) DEFAULT 0,
    property_1_year_tax_rate DECIMAL(5,4) DEFAULT 0.15,
    property_1_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_1_year_tax_due DECIMAL(15,2) GENERATED ALWAYS AS ((COALESCE(property_1_year, (0)::numeric) * COALESCE(property_1_year_tax_rate, 0.15)) - COALESCE(property_1_year_tax_deducted, (0)::numeric)) STORED,
    property_2_3_years DECIMAL(15,2) DEFAULT 0,
    property_2_3_years_tax_rate DECIMAL(5,4) DEFAULT 0.10,
    property_2_3_years_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_2_3_years_tax_due DECIMAL(15,2) GENERATED ALWAYS AS ((COALESCE(property_2_3_years, (0)::numeric) * COALESCE(property_2_3_years_tax_rate, 0.10)) - COALESCE(property_2_3_years_tax_deducted, (0)::numeric)) STORED,
    property_4_plus_years DECIMAL(15,2) DEFAULT 0,
    property_4_plus_years_tax_deducted DECIMAL(15,2) DEFAULT 0,
    securities DECIMAL(15,2) DEFAULT 0,
    securities_tax_rate DECIMAL(5,4) DEFAULT 0.125,
    securities_tax_deducted DECIMAL(15,2) DEFAULT 0,
    securities_tax_due DECIMAL(15,2) GENERATED ALWAYS AS ((COALESCE(securities, (0)::numeric) * COALESCE(securities_tax_rate, 0.125)) - COALESCE(securities_tax_deducted, (0)::numeric)) STORED,
    other_capital_gains DECIMAL(15,2) DEFAULT 0,
    other_capital_gains_tax DECIMAL(15,2) DEFAULT 0,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    immovable_property_1_year_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_1_year_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_1_year_carryable DECIMAL(15,2) DEFAULT 0,
    immovable_property_2_years_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_2_years_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_2_years_carryable DECIMAL(15,2) DEFAULT 0,
    immovable_property_3_years_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_3_years_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_3_years_carryable DECIMAL(15,2) DEFAULT 0,
    immovable_property_4_years_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_4_years_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_4_years_carryable DECIMAL(15,2) DEFAULT 0,
    immovable_property_5_years_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_5_years_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_5_years_carryable DECIMAL(15,2) DEFAULT 0,
    immovable_property_6_years_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_6_years_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_6_years_carryable DECIMAL(15,2) DEFAULT 0,
    immovable_property_over_6_years_taxable DECIMAL(15,2) DEFAULT 0,
    immovable_property_over_6_years_deducted DECIMAL(15,2) DEFAULT 0,
    immovable_property_over_6_years_carryable DECIMAL(15,2) DEFAULT 0,
    securities_before_july_2013_taxable DECIMAL(15,2) DEFAULT 0,
    securities_before_july_2013_deducted DECIMAL(15,2) DEFAULT 0,
    securities_before_july_2013_carryable DECIMAL(15,2) DEFAULT 0,
    securities_pmex_settled_taxable DECIMAL(15,2) DEFAULT 0,
    securities_pmex_settled_deducted DECIMAL(15,2) DEFAULT 0,
    securities_pmex_settled_carryable DECIMAL(15,2) DEFAULT 0,
    securities_37a_7_5_percent_taxable DECIMAL(15,2) DEFAULT 0,
    securities_37a_7_5_percent_deducted DECIMAL(15,2) DEFAULT 0,
    securities_37a_7_5_percent_carryable DECIMAL(15,2) DEFAULT 0,
    securities_mutual_funds_10_percent_taxable DECIMAL(15,2) DEFAULT 0,
    securities_mutual_funds_10_percent_deducted DECIMAL(15,2) DEFAULT 0,
    securities_mutual_funds_10_percent_carryable DECIMAL(15,2) DEFAULT 0,
    securities_mutual_funds_12_5_percent_taxable DECIMAL(15,2) DEFAULT 0,
    securities_mutual_funds_12_5_percent_deducted DECIMAL(15,2) DEFAULT 0,
    securities_mutual_funds_12_5_percent_carryable DECIMAL(15,2) DEFAULT 0,
    securities_other_25_percent_taxable DECIMAL(15,2) DEFAULT 0,
    securities_other_25_percent_deducted DECIMAL(15,2) DEFAULT 0,
    securities_other_25_percent_carryable DECIMAL(15,2) DEFAULT 0,
    securities_12_5_percent_before_july_2022_taxable DECIMAL(15,2) DEFAULT 0,
    securities_12_5_percent_before_july_2022_deducted DECIMAL(15,2) DEFAULT 0,
    securities_12_5_percent_before_july_2022_carryable DECIMAL(15,2) DEFAULT 0,
    securities_15_percent_taxable DECIMAL(15,2) DEFAULT 0,
    securities_15_percent_deducted DECIMAL(15,2) DEFAULT 0,
    securities_15_percent_carryable DECIMAL(15,2) DEFAULT 0,
    total_capital_gain DECIMAL(15,2) GENERATED ALWAYS AS (((((((((((((((((((COALESCE(immovable_property_1_year_taxable, (0)::numeric) + COALESCE(immovable_property_2_years_taxable, (0)::numeric)) + COALESCE(immovable_property_3_years_taxable, (0)::numeric)) + COALESCE(immovable_property_4_years_taxable, (0)::numeric)) + COALESCE(immovable_property_5_years_taxable, (0)::numeric)) + COALESCE(immovable_property_6_years_taxable, (0)::numeric)) + COALESCE(immovable_property_over_6_years_taxable, (0)::numeric)) + COALESCE(securities_before_july_2013_taxable, (0)::numeric)) + COALESCE(securities_pmex_settled_taxable, (0)::numeric)) + COALESCE(securities_37a_7_5_percent_taxable, (0)::numeric)) + COALESCE(securities_mutual_funds_10_percent_taxable, (0)::numeric)) + COALESCE(securities_mutual_funds_12_5_percent_taxable, (0)::numeric)) + COALESCE(securities_other_25_percent_taxable, (0)::numeric)) + COALESCE(securities_12_5_percent_before_july_2022_taxable, (0)::numeric)) + COALESCE(securities_15_percent_taxable, (0)::numeric)) + COALESCE(property_1_year, (0)::numeric)) + COALESCE(property_2_3_years, (0)::numeric)) + COALESCE(property_4_plus_years, (0)::numeric)) + COALESCE(securities, (0)::numeric)) + COALESCE(other_capital_gains, (0)::numeric)) STORED,
    total_tax_deducted DECIMAL(15,2) GENERATED ALWAYS AS (((((((((((((((((((COALESCE(immovable_property_1_year_deducted, (0)::numeric) + COALESCE(immovable_property_2_years_deducted, (0)::numeric)) + COALESCE(immovable_property_3_years_deducted, (0)::numeric)) + COALESCE(immovable_property_4_years_deducted, (0)::numeric)) + COALESCE(immovable_property_5_years_deducted, (0)::numeric)) + COALESCE(immovable_property_6_years_deducted, (0)::numeric)) + COALESCE(immovable_property_over_6_years_deducted, (0)::numeric)) + COALESCE(securities_before_july_2013_deducted, (0)::numeric)) + COALESCE(securities_pmex_settled_deducted, (0)::numeric)) + COALESCE(securities_37a_7_5_percent_deducted, (0)::numeric)) + COALESCE(securities_mutual_funds_10_percent_deducted, (0)::numeric)) + COALESCE(securities_mutual_funds_12_5_percent_deducted, (0)::numeric)) + COALESCE(securities_other_25_percent_deducted, (0)::numeric)) + COALESCE(securities_12_5_percent_before_july_2022_deducted, (0)::numeric)) + COALESCE(securities_15_percent_deducted, (0)::numeric)) + COALESCE(property_1_year_tax_deducted, (0)::numeric)) + COALESCE(property_2_3_years_tax_deducted, (0)::numeric)) + COALESCE(property_4_plus_years_tax_deducted, (0)::numeric)) + COALESCE(securities_tax_deducted, (0)::numeric)) + COALESCE(other_capital_gains_tax, (0)::numeric)) STORED,
    total_tax_carryable DECIMAL(15,2) GENERATED ALWAYS AS ((((((((((((((COALESCE(immovable_property_1_year_carryable, (0)::numeric) + COALESCE(immovable_property_2_years_carryable, (0)::numeric)) + COALESCE(immovable_property_3_years_carryable, (0)::numeric)) + COALESCE(immovable_property_4_years_carryable, (0)::numeric)) + COALESCE(immovable_property_5_years_carryable, (0)::numeric)) + COALESCE(immovable_property_6_years_carryable, (0)::numeric)) + COALESCE(immovable_property_over_6_years_carryable, (0)::numeric)) + COALESCE(securities_before_july_2013_carryable, (0)::numeric)) + COALESCE(securities_pmex_settled_carryable, (0)::numeric)) + COALESCE(securities_37a_7_5_percent_carryable, (0)::numeric)) + COALESCE(securities_mutual_funds_10_percent_carryable, (0)::numeric)) + COALESCE(securities_mutual_funds_12_5_percent_carryable, (0)::numeric)) + COALESCE(securities_other_25_percent_carryable, (0)::numeric)) + COALESCE(securities_12_5_percent_before_july_2022_carryable, (0)::numeric)) + COALESCE(securities_15_percent_carryable, (0)::numeric)) STORED,
    immovable_property_1_year_type VARCHAR(20) DEFAULT 'Plot',
    immovable_property_2_years_type VARCHAR(20) DEFAULT 'Plot',
    immovable_property_3_years_type VARCHAR(20) DEFAULT 'Plot',
    immovable_property_4_years_type VARCHAR(20) DEFAULT 'Plot',
    immovable_property_5_years_type VARCHAR(20) DEFAULT 'Plot',
    immovable_property_6_years_type VARCHAR(20) DEFAULT 'Plot',
    immovable_property_over_6_years_type VARCHAR(20) DEFAULT 'Plot',
    property_1_2_years DECIMAL(15,2) DEFAULT 0,
    property_1_2_years_tax_rate DECIMAL(5,4) DEFAULT 0.125,
    property_3_4_years DECIMAL(15,2) DEFAULT 0,
    property_3_4_years_tax_rate DECIMAL(5,4) DEFAULT 0.075,
    property_4_5_years DECIMAL(15,2) DEFAULT 0,
    property_4_5_years_tax_rate DECIMAL(5,4) DEFAULT 0.05,
    property_5_6_years DECIMAL(15,2) DEFAULT 0,
    property_5_6_years_tax_rate DECIMAL(5,4) DEFAULT 0.025,
    property_plot_1_year DECIMAL(15,2) DEFAULT 0,
    property_constructed_1_year DECIMAL(15,2) DEFAULT 0,
    property_flat_1_year DECIMAL(15,2) DEFAULT 0,
    property_plot_2_3_years DECIMAL(15,2) DEFAULT 0,
    property_constructed_2_3_years DECIMAL(15,2) DEFAULT 0,
    property_flat_2_3_years DECIMAL(15,2) DEFAULT 0,
    property_2_3_years_tax_calculated DECIMAL(15,2) GENERATED ALWAYS AS (((COALESCE(property_plot_2_3_years, (0)::numeric) * 0.10) + (COALESCE(property_constructed_2_3_years, (0)::numeric) * 0.075)) + (COALESCE(property_flat_2_3_years, (0)::numeric) * 0.00)) STORED,
    total_capital_gains DECIMAL(15,2) GENERATED ALWAYS AS ((((COALESCE(property_1_year, (0)::numeric) + COALESCE(property_2_3_years, (0)::numeric)) + COALESCE(property_4_plus_years, (0)::numeric)) + COALESCE(securities, (0)::numeric)) + COALESCE(other_capital_gains, (0)::numeric)) STORED,
    total_capital_gains_tax DECIMAL(15,2) GENERATED ALWAYS AS ((((COALESCE(property_1_year, (0)::numeric) * COALESCE(property_1_year_tax_rate, 0.15)) + (COALESCE(property_2_3_years, (0)::numeric) * COALESCE(property_2_3_years_tax_rate, 0.10))) + (COALESCE(securities, (0)::numeric) * COALESCE(securities_tax_rate, 0.125))) + COALESCE(other_capital_gains_tax, (0)::numeric)) STORED,
    property_2_year DECIMAL(15,2) DEFAULT 0,
    property_2_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_3_year DECIMAL(15,2) DEFAULT 0,
    property_3_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_4_year DECIMAL(15,2) DEFAULT 0,
    property_4_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_5_year DECIMAL(15,2) DEFAULT 0,
    property_5_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_6_year DECIMAL(15,2) DEFAULT 0,
    property_6_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    property_over_6_year DECIMAL(15,2) DEFAULT 0,
    property_over_6_year_tax_deducted DECIMAL(15,2) DEFAULT 0,
    sec_pre_2013 DECIMAL(15,2) DEFAULT 0,
    sec_pre_2013_deducted DECIMAL(15,2) DEFAULT 0,
    sec_pmex DECIMAL(15,2) DEFAULT 0,
    sec_pmex_deducted DECIMAL(15,2) DEFAULT 0,
    sec_7_5_percent DECIMAL(15,2) DEFAULT 0,
    sec_7_5_percent_deducted DECIMAL(15,2) DEFAULT 0,
    sec_10_percent DECIMAL(15,2) DEFAULT 0,
    sec_10_percent_deducted DECIMAL(15,2) DEFAULT 0,
    sec_12_5_percent DECIMAL(15,2) DEFAULT 0,
    sec_12_5_percent_deducted DECIMAL(15,2) DEFAULT 0,
    sec_25_percent DECIMAL(15,2) DEFAULT 0,
    sec_25_percent_deducted DECIMAL(15,2) DEFAULT 0,
    sec_pre_2022 DECIMAL(15,2) DEFAULT 0,
    sec_pre_2022_deducted DECIMAL(15,2) DEFAULT 0,
    sec_15_percent DECIMAL(15,2) DEFAULT 0,
    sec_15_percent_deducted DECIMAL(15,2) DEFAULT 0,
    capital_gains_tax_chargeable DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT capital_gain_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 5. credits_forms
-- -----------------------------------------------------------------------------

CREATE TABLE credits_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    charitable_donation DECIMAL(15,2) DEFAULT 0,
    pension_contribution DECIMAL(15,2) DEFAULT 0,
    life_insurance_premium DECIMAL(15,2) DEFAULT 0,
    investment_tax_credit DECIMAL(15,2) DEFAULT 0,
    other_credits DECIMAL(15,2) DEFAULT 0,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    charitable_donations_u61_yn VARCHAR(1) DEFAULT '-',
    charitable_donations_amount DECIMAL(15,2) DEFAULT 0,
    charitable_donations_tax_credit DECIMAL(15,2) DEFAULT 0,
    charitable_donations_associate_yn VARCHAR(1) DEFAULT '-',
    charitable_donations_associate_amount DECIMAL(15,2) DEFAULT 0,
    charitable_donations_associate_tax_credit DECIMAL(15,2) DEFAULT 0,
    pension_contribution_yn VARCHAR(1) DEFAULT '-',
    pension_contribution_amount DECIMAL(15,2) DEFAULT 0,
    pension_contribution_tax_credit DECIMAL(15,2) DEFAULT 0,
    investment_shares_yn VARCHAR(1) DEFAULT '-',
    investment_shares_amount DECIMAL(15,2) DEFAULT 0,
    investment_shares_tax_credit DECIMAL(15,2) DEFAULT 0,
    pension_fund_u63_yn VARCHAR(1) DEFAULT '-',
    pension_fund_amount DECIMAL(15,2) DEFAULT 0,
    pension_fund_tax_credit DECIMAL(15,2) DEFAULT 0,
    surrender_tax_credit_investments_yn VARCHAR(1) DEFAULT '-',
    surrender_tax_credit_amount DECIMAL(15,2) DEFAULT 0,
    surrender_tax_credit_reduction DECIMAL(15,2) DEFAULT 0,
    total_tax_credits DECIMAL(15,2) DEFAULT 0,
    life_insurance_premium_yn VARCHAR(1) DEFAULT '',
    life_insurance_premium_amount DECIMAL(15,2) DEFAULT 0,
    life_insurance_premium_tax_credit DECIMAL(15,2) DEFAULT 0,
    provident_fund_yn VARCHAR(1) DEFAULT '',
    provident_fund_amount DECIMAL(15,2) DEFAULT 0,
    provident_fund_tax_credit DECIMAL(15,2) DEFAULT 0,
    voluntary_pension_scheme_yn VARCHAR(1) DEFAULT '',
    voluntary_pension_scheme_amount DECIMAL(15,2) DEFAULT 0,
    voluntary_pension_scheme_tax_credit DECIMAL(15,2) DEFAULT 0,
    investment_tax_credit_yn VARCHAR(1) DEFAULT '',
    investment_tax_credit_amount DECIMAL(15,2) DEFAULT 0,
    investment_tax_credit_tax_credit DECIMAL(15,2) DEFAULT 0,
    surrender_tax_credit_yn VARCHAR(1) DEFAULT '',
    total_credits DECIMAL(15,2) GENERATED ALWAYS AS (((((COALESCE(charitable_donations_tax_credit, (0)::numeric) + COALESCE(charitable_donations_associate_tax_credit, (0)::numeric)) + COALESCE(pension_fund_tax_credit, (0)::numeric)) + COALESCE(surrender_tax_credit_reduction, (0)::numeric)) + COALESCE(investment_tax_credit, (0)::numeric)) + COALESCE(other_credits, (0)::numeric)) STORED,

    CONSTRAINT credits_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 6. deductions_forms
-- -----------------------------------------------------------------------------

CREATE TABLE deductions_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    zakat DECIMAL(15,2) DEFAULT 0,
    ushr DECIMAL(15,2) DEFAULT 0,
    tax_paid_foreign_country DECIMAL(15,2) DEFAULT 0,
    advance_tax DECIMAL(15,2) DEFAULT 0,
    other_deductions DECIMAL(15,2) DEFAULT 0,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    professional_expenses_yn VARCHAR(1) DEFAULT '-',
    professional_expenses_amount DECIMAL(15,2) DEFAULT 0,
    zakat_paid_ordinance_yn VARCHAR(1) DEFAULT '-',
    zakat_paid_amount DECIMAL(15,2) DEFAULT 0,
    total_deduction_from_income DECIMAL(15,2) DEFAULT 0,
    educational_expenses_amount DECIMAL(15,2) DEFAULT 0,
    educational_expenses_children_count INTEGER DEFAULT 0,
    educational_expenses_yn VARCHAR(1) DEFAULT '',
    total_deductions DECIMAL(15,2) GENERATED ALWAYS AS (((((COALESCE(educational_expenses_amount, (0)::numeric) + COALESCE(zakat_paid_amount, (0)::numeric)) + COALESCE(ushr, (0)::numeric)) + COALESCE(tax_paid_foreign_country, (0)::numeric)) + COALESCE(advance_tax, (0)::numeric)) + COALESCE(other_deductions, (0)::numeric)) STORED,
    education_expense_amount DECIMAL(15,2) DEFAULT 0,
    education_expense_children INTEGER DEFAULT 0,

    CONSTRAINT deductions_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 7. expenses_forms
-- -----------------------------------------------------------------------------

CREATE TABLE expenses_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    rent DECIMAL(15,2) DEFAULT 0,
    rates_taxes_charges DECIMAL(15,2) DEFAULT 0,
    income_tax DECIMAL(15,2) DEFAULT 0,
    vehicle_running_maintenance DECIMAL(15,2) DEFAULT 0,
    travelling DECIMAL(15,2) DEFAULT 0,
    electricity DECIMAL(15,2) DEFAULT 0,
    water DECIMAL(15,2) DEFAULT 0,
    gas DECIMAL(15,2) DEFAULT 0,
    telephone DECIMAL(15,2) DEFAULT 0,
    medical DECIMAL(15,2) DEFAULT 0,
    educational DECIMAL(15,2) DEFAULT 0,
    donations_zakat_annuity DECIMAL(15,2) DEFAULT 0,
    other_expenses DECIMAL(15,2) DEFAULT 0,
    entertainment DECIMAL(15,2) DEFAULT 0,
    maintenance DECIMAL(15,2) DEFAULT 0,
    total_expenses DECIMAL(15,2) GENERATED ALWAYS AS ((((((((((((((COALESCE(rent, (0)::numeric) + COALESCE(rates_taxes_charges, (0)::numeric)) + COALESCE(income_tax, (0)::numeric)) + COALESCE(vehicle_running_maintenance, (0)::numeric)) + COALESCE(travelling, (0)::numeric)) + COALESCE(electricity, (0)::numeric)) + COALESCE(water, (0)::numeric)) + COALESCE(gas, (0)::numeric)) + COALESCE(telephone, (0)::numeric)) + COALESCE(medical, (0)::numeric)) + COALESCE(educational, (0)::numeric)) + COALESCE(donations_zakat_annuity, (0)::numeric)) + COALESCE(other_expenses, (0)::numeric)) + COALESCE(entertainment, (0)::numeric)) + COALESCE(maintenance, (0)::numeric)) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    asset_insurance_security DECIMAL(15,2) DEFAULT 0,
    club DECIMAL(15,2) DEFAULT 0,
    functions_gatherings DECIMAL(15,2) DEFAULT 0,
    family_contribution DECIMAL(15,2) DEFAULT 0,
    net_expenses_by_taxpayer DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT expenses_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 8. final_min_income_forms
-- -----------------------------------------------------------------------------

CREATE TABLE final_min_income_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    salary_u_s_12_7 DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_exempt_profit_rate_mlt_30 DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_31_atl_15pc DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_56_10_shares DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_10pc DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_12_5pc DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1b_15pc DECIMAL(15,2) DEFAULT 0,
    return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u DECIMAL(15,2) DEFAULT 0,
    return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10p DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_national_savings_certificates_including_defence_ DECIMAL(15,2) DEFAULT 0,
    profit_on_debt_u_s_7b DECIMAL(15,2) DEFAULT 0,
    prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156 DECIMAL(15,2) DEFAULT 0,
    bonus_shares_issued_by_companies_u_s_236f DECIMAL(15,2) DEFAULT 0,
    employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_a DECIMAL(15,2) DEFAULT 0,
    salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate DECIMAL(15,2) DEFAULT 0,
    capital_gain DECIMAL(15,2) DEFAULT 0,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    dividend_u_s_150_0pc_share_profit_reit_spv DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_35pc_share_profit_other_spv DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_7_5pc_ipp_shares DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_31pc_atl DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_25pc DECIMAL(15,2) DEFAULT 0,
    return_invest_exceed_1m_sukuk_saa_12_5pc DECIMAL(15,2) DEFAULT 0,
    return_invest_not_exceed_1m_sukuk_saa_10pc DECIMAL(15,2) DEFAULT 0,
    profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc DECIMAL(15,2) DEFAULT 0,
    profit_debt_national_savings_defence_39_14a DECIMAL(15,2) DEFAULT 0,
    interest_income_profit_debt_7b_up_to_5m DECIMAL(15,2) DEFAULT 0,
    prize_raffle_lottery_quiz_promotional_156 DECIMAL(15,2) DEFAULT 0,
    prize_bond_cross_world_puzzle_156 DECIMAL(15,2) DEFAULT 0,
    bonus_shares_companies_236f DECIMAL(15,2) DEFAULT 0,
    employment_termination_benefits_12_6_avg_rate DECIMAL(15,2) DEFAULT 0,
    salary_arrears_12_7_relevant_rate DECIMAL(15,2) DEFAULT 0,
    salary_u_s_12_7_tax_deducted DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_7_5pc_ipp_shares_tax_deducted DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_31pc_atl_tax_deducted DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
    return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
    return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
    profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted DECIMAL(15,2) DEFAULT 0,
    profit_debt_national_savings_defence_39_14a_tax_deducted DECIMAL(15,2) DEFAULT 0,
    interest_income_profit_debt_7b_up_to_5m_tax_deducted DECIMAL(15,2) DEFAULT 0,
    prize_raffle_lottery_quiz_promotional_156_tax_deducted DECIMAL(15,2) DEFAULT 0,
    prize_bond_cross_world_puzzle_156_tax_deducted DECIMAL(15,2) DEFAULT 0,
    bonus_shares_companies_236f_tax_deducted DECIMAL(15,2) DEFAULT 0,
    employment_termination_benefits_12_6_avg_rate_tax_deducted DECIMAL(15,2) DEFAULT 0,
    salary_arrears_12_7_relevant_rate_tax_deducted DECIMAL(15,2) DEFAULT 0,
    capital_gain_tax_deducted DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) GENERATED ALWAYS AS ((((((((((((((((((((((((((((((COALESCE(salary_u_s_12_7, (0)::numeric) + COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30, (0)::numeric)) + COALESCE(dividend_u_s_150_31_atl_15pc, (0)::numeric)) + COALESCE(dividend_u_s_150_56_10_shares, (0)::numeric)) + COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, (0)::numeric)) + COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, (0)::numeric)) + COALESCE(dividend_u_s_150_7_5pc_ipp_shares, (0)::numeric)) + COALESCE(dividend_u_s_150_31pc_atl, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc, (0)::numeric)) + COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u, (0)::numeric)) + COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc, (0)::numeric)) + COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc, (0)::numeric)) + COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc, (0)::numeric)) + COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10p, (0)::numeric)) + COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc, (0)::numeric)) + COALESCE(profit_on_debt_national_savings_certificates_including_defence_, (0)::numeric)) + COALESCE(profit_debt_national_savings_defence_39_14a, (0)::numeric)) + COALESCE(profit_on_debt_u_s_7b, (0)::numeric)) + COALESCE(interest_income_profit_debt_7b_up_to_5m, (0)::numeric)) + COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156, (0)::numeric)) + COALESCE(prize_raffle_lottery_quiz_promotional_156, (0)::numeric)) + COALESCE(prize_bond_cross_world_puzzle_156, (0)::numeric)) + COALESCE(bonus_shares_issued_by_companies_u_s_236f, (0)::numeric)) + COALESCE(bonus_shares_companies_236f, (0)::numeric)) + COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_a, (0)::numeric)) + COALESCE(employment_termination_benefits_12_6_avg_rate, (0)::numeric)) + COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate, (0)::numeric)) + COALESCE(salary_arrears_12_7_relevant_rate, (0)::numeric)) STORED,
    grand_total DECIMAL(15,2) GENERATED ALWAYS AS (((((((((((((((((((((((((((((((COALESCE(salary_u_s_12_7, (0)::numeric) + COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30, (0)::numeric)) + COALESCE(dividend_u_s_150_31_atl_15pc, (0)::numeric)) + COALESCE(dividend_u_s_150_56_10_shares, (0)::numeric)) + COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv, (0)::numeric)) + COALESCE(dividend_u_s_150_35pc_share_profit_other_spv, (0)::numeric)) + COALESCE(dividend_u_s_150_7_5pc_ipp_shares, (0)::numeric)) + COALESCE(dividend_u_s_150_31pc_atl, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc, (0)::numeric)) + COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u, (0)::numeric)) + COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc, (0)::numeric)) + COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc, (0)::numeric)) + COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc, (0)::numeric)) + COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10p, (0)::numeric)) + COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc, (0)::numeric)) + COALESCE(profit_on_debt_national_savings_certificates_including_defence_, (0)::numeric)) + COALESCE(profit_debt_national_savings_defence_39_14a, (0)::numeric)) + COALESCE(profit_on_debt_u_s_7b, (0)::numeric)) + COALESCE(interest_income_profit_debt_7b_up_to_5m, (0)::numeric)) + COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156, (0)::numeric)) + COALESCE(prize_raffle_lottery_quiz_promotional_156, (0)::numeric)) + COALESCE(prize_bond_cross_world_puzzle_156, (0)::numeric)) + COALESCE(bonus_shares_issued_by_companies_u_s_236f, (0)::numeric)) + COALESCE(bonus_shares_companies_236f, (0)::numeric)) + COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_a, (0)::numeric)) + COALESCE(employment_termination_benefits_12_6_avg_rate, (0)::numeric)) + COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate, (0)::numeric)) + COALESCE(salary_arrears_12_7_relevant_rate, (0)::numeric)) + COALESCE(capital_gain, (0)::numeric)) STORED,
    salary_u_s_12_7_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    dividend_u_s_150_31pc_atl_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    profit_debt_national_savings_defence_39_14a_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    interest_income_profit_debt_7b_up_to_5m_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    prize_raffle_lottery_quiz_promotional_156_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    prize_bond_cross_world_puzzle_156_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    bonus_shares_companies_236f_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    employment_termination_benefits_12_6_avg_rate_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    salary_arrears_12_7_relevant_rate_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    capital_gain_tax_chargeable DECIMAL(15,2) DEFAULT 0,
    subtotal_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS (((((((((((((((((COALESCE(salary_u_s_12_7_tax_chargeable, (0)::numeric) + COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable, (0)::numeric)) + COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable, (0)::numeric)) + COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable, (0)::numeric)) + COALESCE(dividend_u_s_150_31pc_atl_tax_chargeable, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable, (0)::numeric)) + COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable, (0)::numeric)) + COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable, (0)::numeric)) + COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable, (0)::numeric)) + COALESCE(profit_debt_national_savings_defence_39_14a_tax_chargeable, (0)::numeric)) + COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_chargeable, (0)::numeric)) + COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_chargeable, (0)::numeric)) + COALESCE(prize_bond_cross_world_puzzle_156_tax_chargeable, (0)::numeric)) + COALESCE(bonus_shares_companies_236f_tax_chargeable, (0)::numeric)) + COALESCE(employment_termination_benefits_12_6_avg_rate_tax_chargeable, (0)::numeric)) + COALESCE(salary_arrears_12_7_relevant_rate_tax_chargeable, (0)::numeric)) STORED,
    grand_total_tax_chargeable DECIMAL(15,2) GENERATED ALWAYS AS ((((((((((((((((((COALESCE(salary_u_s_12_7_tax_chargeable, (0)::numeric) + COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable, (0)::numeric)) + COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable, (0)::numeric)) + COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable, (0)::numeric)) + COALESCE(dividend_u_s_150_31pc_atl_tax_chargeable, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable, (0)::numeric)) + COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable, (0)::numeric)) + COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable, (0)::numeric)) + COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable, (0)::numeric)) + COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable, (0)::numeric)) + COALESCE(profit_debt_national_savings_defence_39_14a_tax_chargeable, (0)::numeric)) + COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_chargeable, (0)::numeric)) + COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_chargeable, (0)::numeric)) + COALESCE(prize_bond_cross_world_puzzle_156_tax_chargeable, (0)::numeric)) + COALESCE(bonus_shares_companies_236f_tax_chargeable, (0)::numeric)) + COALESCE(employment_termination_benefits_12_6_avg_rate_tax_chargeable, (0)::numeric)) + COALESCE(salary_arrears_12_7_relevant_rate_tax_chargeable, (0)::numeric)) + COALESCE(capital_gain_tax_chargeable, (0)::numeric)) STORED,

    CONSTRAINT final_min_income_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 9. final_tax_forms
-- -----------------------------------------------------------------------------

CREATE TABLE final_tax_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    sukuk_amount DECIMAL(15,2) DEFAULT 0,
    sukuk_tax_rate DECIMAL(5,4) DEFAULT 0.10,
    sukuk_tax_amount DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(sukuk_amount, (0)::numeric) * COALESCE(sukuk_tax_rate, 0.10)) STORED,
    debt_amount DECIMAL(15,2) DEFAULT 0,
    debt_tax_rate DECIMAL(5,4) DEFAULT 0.15,
    debt_tax_amount DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(debt_amount, (0)::numeric) * COALESCE(debt_tax_rate, 0.15)) STORED,
    prize_bonds DECIMAL(15,2) DEFAULT 0,
    prize_bonds_tax DECIMAL(15,2) DEFAULT 0,
    other_final_tax_amount DECIMAL(15,2) DEFAULT 0,
    other_final_tax DECIMAL(15,2) DEFAULT 0,
    total_final_tax DECIMAL(15,2) GENERATED ALWAYS AS ((((COALESCE(sukuk_amount, (0)::numeric) * COALESCE(sukuk_tax_rate, 0.10)) + (COALESCE(debt_amount, (0)::numeric) * COALESCE(debt_tax_rate, 0.15))) + COALESCE(prize_bonds_tax, (0)::numeric)) + COALESCE(other_final_tax, (0)::numeric)) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    sukuk_bonds_yn VARCHAR(1) DEFAULT '',
    sukuk_bonds_gross_amount DECIMAL(15,2) DEFAULT 0,
    sukuk_bonds_tax_rate DECIMAL(5,2) DEFAULT 0,
    sukuk_bonds_tax_amount DECIMAL(15,2) DEFAULT 0,
    debt_securities_yn VARCHAR(1) DEFAULT '',
    debt_securities_gross_amount DECIMAL(15,2) DEFAULT 0,
    debt_securities_tax_rate DECIMAL(5,2) DEFAULT 0,
    debt_securities_tax_amount DECIMAL(15,2) DEFAULT 0,
    prize_bonds_yn VARCHAR(1) DEFAULT '',
    prize_bonds_gross_amount DECIMAL(15,2) DEFAULT 0,
    prize_bonds_tax_rate DECIMAL(5,2) DEFAULT 0,
    prize_bonds_tax_amount DECIMAL(15,2) DEFAULT 0,
    other_final_tax_yn VARCHAR(1) DEFAULT '',
    other_final_tax_gross_amount DECIMAL(15,2) DEFAULT 0,
    other_final_tax_tax_rate DECIMAL(5,2) DEFAULT 0,
    other_final_tax_tax_amount DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT final_tax_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 10. reductions_forms
-- -----------------------------------------------------------------------------

CREATE TABLE reductions_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL,
    teacher_amount DECIMAL(15,2) DEFAULT 0,
    teacher_reduction DECIMAL(15,2) DEFAULT 0,
    behbood_reduction DECIMAL(15,2) DEFAULT 0,
    export_income_reduction DECIMAL(15,2) DEFAULT 0,
    industrial_undertaking_reduction DECIMAL(15,2) DEFAULT 0,
    other_reductions DECIMAL(15,2) DEFAULT 0,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    teacher_researcher_amount DECIMAL(15,2) DEFAULT 0,
    teacher_researcher_tax_reduction DECIMAL(15,2) DEFAULT 0,
    behbood_certificates_amount DECIMAL(15,2) DEFAULT 0,
    behbood_certificates_tax_reduction DECIMAL(15,2) DEFAULT 0,
    capital_gain_immovable_50_reduction DECIMAL(15,2) DEFAULT 0,
    capital_gain_immovable_75_reduction DECIMAL(15,2) DEFAULT 0,
    teacher_researcher_reduction_yn VARCHAR(1) DEFAULT '',
    behbood_certificates_reduction_yn VARCHAR(1) DEFAULT '',
    total_tax_reductions DECIMAL(15,2) DEFAULT 0,
    total_reductions DECIMAL(15,2) GENERATED ALWAYS AS ((((((COALESCE(teacher_researcher_tax_reduction, (0)::numeric) + COALESCE(behbood_certificates_tax_reduction, (0)::numeric)) + COALESCE(capital_gain_immovable_50_reduction, (0)::numeric)) + COALESCE(capital_gain_immovable_75_reduction, (0)::numeric)) + COALESCE(export_income_reduction, (0)::numeric)) + COALESCE(industrial_undertaking_reduction, (0)::numeric)) + COALESCE(other_reductions, (0)::numeric)) STORED,

    CONSTRAINT reductions_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 11. tax_computation_forms
-- -----------------------------------------------------------------------------

CREATE TABLE tax_computation_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
    tax_year VARCHAR(10) NOT NULL DEFAULT '2025-26',
    income_from_salary DECIMAL(15,2) DEFAULT 0,
    other_income_subject_to_min_tax DECIMAL(15,2) DEFAULT 0,
    income_loss_other_sources DECIMAL(15,2) DEFAULT 0,
    total_income DECIMAL(15,2) GENERATED ALWAYS AS ((COALESCE(income_from_salary, (0)::numeric) + COALESCE(other_income_subject_to_min_tax, (0)::numeric)) + COALESCE(income_loss_other_sources, (0)::numeric)) STORED,
    deductible_allowances DECIMAL(15,2) DEFAULT 0,
    taxable_income_excluding_cg DECIMAL(15,2) GENERATED ALWAYS AS (((COALESCE(income_from_salary, (0)::numeric) + COALESCE(other_income_subject_to_min_tax, (0)::numeric)) + COALESCE(income_loss_other_sources, (0)::numeric)) - COALESCE(deductible_allowances, (0)::numeric)) STORED,
    capital_gains_loss DECIMAL(15,2) DEFAULT 0,
    taxable_income_including_cg DECIMAL(15,2) GENERATED ALWAYS AS ((((COALESCE(income_from_salary, (0)::numeric) + COALESCE(other_income_subject_to_min_tax, (0)::numeric)) + COALESCE(income_loss_other_sources, (0)::numeric)) - COALESCE(deductible_allowances, (0)::numeric)) + COALESCE(capital_gains_loss, (0)::numeric)) STORED,
    normal_income_tax DECIMAL(15,2) DEFAULT 0,
    surcharge_amount DECIMAL(15,2) DEFAULT 0,
    capital_gains_tax DECIMAL(15,2) DEFAULT 0,
    normal_tax_including_surcharge_cgt DECIMAL(15,2) GENERATED ALWAYS AS ((COALESCE(normal_income_tax, (0)::numeric) + COALESCE(surcharge_amount, (0)::numeric)) + COALESCE(capital_gains_tax, (0)::numeric)) STORED,
    tax_reductions DECIMAL(15,2) DEFAULT 0,
    tax_credits DECIMAL(15,2) DEFAULT 0,
    net_tax_payable DECIMAL(15,2) GENERATED ALWAYS AS ((((COALESCE(normal_income_tax, (0)::numeric) + COALESCE(surcharge_amount, (0)::numeric)) + COALESCE(capital_gains_tax, (0)::numeric)) - COALESCE(tax_reductions, (0)::numeric)) - COALESCE(tax_credits, (0)::numeric)) STORED,
    final_fixed_tax DECIMAL(15,2) DEFAULT 0,
    minimum_tax_on_other_income DECIMAL(15,2) DEFAULT 0,
    total_tax_liability DECIMAL(15,2) GENERATED ALWAYS AS (((((COALESCE(normal_income_tax, (0)::numeric) + COALESCE(surcharge_amount, (0)::numeric)) + COALESCE(capital_gains_tax, (0)::numeric)) - COALESCE(tax_reductions, (0)::numeric)) - COALESCE(tax_credits, (0)::numeric)) + COALESCE(final_fixed_tax, (0)::numeric)) STORED,
    advance_tax_paid DECIMAL(15,2) DEFAULT 0,
    balance_payable DECIMAL(15,2) GENERATED ALWAYS AS ((((((COALESCE(normal_income_tax, (0)::numeric) + COALESCE(surcharge_amount, (0)::numeric)) + COALESCE(capital_gains_tax, (0)::numeric)) - COALESCE(tax_reductions, (0)::numeric)) - COALESCE(tax_credits, (0)::numeric)) + COALESCE(final_fixed_tax, (0)::numeric)) - COALESCE(advance_tax_paid, (0)::numeric)) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    income_from_other_sources DECIMAL(15,2) DEFAULT 0,
    gains_from_capital_assets DECIMAL(15,2) DEFAULT 0,
    surcharge DECIMAL(15,2) DEFAULT 0,
    capital_gain_tax DECIMAL(15,2) DEFAULT 0,
    total_tax DECIMAL(15,2) DEFAULT 0,
    tax_after_adjustments DECIMAL(15,2) DEFAULT 0,
    income_subject_to_final_tax DECIMAL(15,2) DEFAULT 0,
    total_tax_paid DECIMAL(15,2) DEFAULT 0,
    total_tax_paid_with_advance DECIMAL(15,2) DEFAULT 0,
    tax_payable_refundable DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT tax_computation_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 12. wealth_forms
-- -----------------------------------------------------------------------------

CREATE TABLE wealth_forms (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
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
    total_assets_previous_year DECIMAL(15,2) GENERATED ALWAYS AS (((((((COALESCE(property_previous_year, (0)::numeric) + COALESCE(investment_previous_year, (0)::numeric)) + COALESCE(vehicle_previous_year, (0)::numeric)) + COALESCE(jewelry_previous_year, (0)::numeric)) + COALESCE(cash_previous_year, (0)::numeric)) + COALESCE(pf_previous_year, (0)::numeric)) + COALESCE(bank_balance_previous_year, (0)::numeric)) + COALESCE(other_assets_previous_year, (0)::numeric)) STORED,
    total_assets_current_year DECIMAL(15,2) GENERATED ALWAYS AS (((((((COALESCE(property_current_year, (0)::numeric) + COALESCE(investment_current_year, (0)::numeric)) + COALESCE(vehicle_current_year, (0)::numeric)) + COALESCE(jewelry_current_year, (0)::numeric)) + COALESCE(cash_current_year, (0)::numeric)) + COALESCE(pf_current_year, (0)::numeric)) + COALESCE(bank_balance_current_year, (0)::numeric)) + COALESCE(other_assets_current_year, (0)::numeric)) STORED,
    total_liabilities_previous_year DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(loan_previous_year, (0)::numeric) + COALESCE(other_liabilities_previous_year, (0)::numeric)) STORED,
    total_liabilities_current_year DECIMAL(15,2) GENERATED ALWAYS AS (COALESCE(loan_current_year, (0)::numeric) + COALESCE(other_liabilities_current_year, (0)::numeric)) STORED,
    net_worth_previous_year DECIMAL(15,2) GENERATED ALWAYS AS ((((((((COALESCE(property_previous_year, (0)::numeric) + COALESCE(investment_previous_year, (0)::numeric)) + COALESCE(vehicle_previous_year, (0)::numeric)) + COALESCE(jewelry_previous_year, (0)::numeric)) + COALESCE(cash_previous_year, (0)::numeric)) + COALESCE(pf_previous_year, (0)::numeric)) + COALESCE(bank_balance_previous_year, (0)::numeric)) + COALESCE(other_assets_previous_year, (0)::numeric)) - (COALESCE(loan_previous_year, (0)::numeric) + COALESCE(other_liabilities_previous_year, (0)::numeric))) STORED,
    net_worth_current_year DECIMAL(15,2) GENERATED ALWAYS AS ((((((((COALESCE(property_current_year, (0)::numeric) + COALESCE(investment_current_year, (0)::numeric)) + COALESCE(vehicle_current_year, (0)::numeric)) + COALESCE(jewelry_current_year, (0)::numeric)) + COALESCE(cash_current_year, (0)::numeric)) + COALESCE(pf_current_year, (0)::numeric)) + COALESCE(bank_balance_current_year, (0)::numeric)) + COALESCE(other_assets_current_year, (0)::numeric)) - (COALESCE(loan_current_year, (0)::numeric) + COALESCE(other_liabilities_current_year, (0)::numeric))) STORED,
    wealth_increase DECIMAL(15,2) GENERATED ALWAYS AS (((((((((COALESCE(property_current_year, (0)::numeric) + COALESCE(investment_current_year, (0)::numeric)) + COALESCE(vehicle_current_year, (0)::numeric)) + COALESCE(jewelry_current_year, (0)::numeric)) + COALESCE(cash_current_year, (0)::numeric)) + COALESCE(pf_current_year, (0)::numeric)) + COALESCE(bank_balance_current_year, (0)::numeric)) + COALESCE(other_assets_current_year, (0)::numeric)) - (COALESCE(loan_current_year, (0)::numeric) + COALESCE(other_liabilities_current_year, (0)::numeric))) - ((((((((COALESCE(property_previous_year, (0)::numeric) + COALESCE(investment_previous_year, (0)::numeric)) + COALESCE(vehicle_previous_year, (0)::numeric)) + COALESCE(jewelry_previous_year, (0)::numeric)) + COALESCE(cash_previous_year, (0)::numeric)) + COALESCE(pf_previous_year, (0)::numeric)) + COALESCE(bank_balance_previous_year, (0)::numeric)) + COALESCE(other_assets_previous_year, (0)::numeric)) - (COALESCE(loan_previous_year, (0)::numeric) + COALESCE(other_liabilities_previous_year, (0)::numeric)))) STORED,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT wealth_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 13. wealth_reconciliation_forms
-- -----------------------------------------------------------------------------

CREATE TABLE wealth_reconciliation_forms (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tax_return_id UUID,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID,
    tax_year VARCHAR(10) NOT NULL,
    net_assets_current_year DECIMAL(15,2) DEFAULT 0,
    net_assets_previous_year DECIMAL(15,2) DEFAULT 0,
    net_assets_increase DECIMAL(15,2) DEFAULT 0,
    income_normal_tax DECIMAL(15,2) DEFAULT 0,
    income_exempt_from_tax DECIMAL(15,2) DEFAULT 0,
    income_final_tax DECIMAL(15,2) DEFAULT 0,
    foreign_remittance DECIMAL(15,2) DEFAULT 0,
    inheritance DECIMAL(15,2) DEFAULT 0,
    gift_value DECIMAL(15,2) DEFAULT 0,
    asset_disposal_gain_loss DECIMAL(15,2) DEFAULT 0,
    other_inflows DECIMAL(15,2) DEFAULT 0,
    total_inflows DECIMAL(15,2) DEFAULT 0,
    personal_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
    adjustments_outflows DECIMAL(15,2) DEFAULT 0,
    gift_outflow DECIMAL(15,2) DEFAULT 0,
    loss_on_disposal DECIMAL(15,2) DEFAULT 0,
    total_outflows DECIMAL(15,2) DEFAULT 0,
    calculated_net_increase DECIMAL(15,2) DEFAULT 0,
    unreconciled_difference DECIMAL(15,2) DEFAULT 0,
    is_complete BOOLEAN DEFAULT false,
    last_updated_by UUID,
    created_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    non_cash_expenses DECIMAL(15,2) DEFAULT 0,

    CONSTRAINT wealth_reconciliation_forms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- 14. form_completion_status
-- -----------------------------------------------------------------------------

CREATE TABLE form_completion_status (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tax_return_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    tax_year_id UUID NOT NULL,
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
    all_forms_complete BOOLEAN GENERATED ALWAYS AS (CASE
    WHEN (income_form_complete AND adjustable_tax_form_complete AND reductions_form_complete AND credits_form_complete AND deductions_form_complete AND final_tax_form_complete AND capital_gain_form_complete AND expenses_form_complete AND wealth_form_complete) THEN true
    ELSE false
END) STORED,
    completion_percentage INTEGER GENERATED ALWAYS AS ((((((((((
CASE
    WHEN income_form_complete THEN 1
    ELSE 0
END +
CASE
    WHEN adjustable_tax_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN reductions_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN credits_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN deductions_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN final_tax_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN capital_gain_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN expenses_form_complete THEN 1
    ELSE 0
END) +
CASE
    WHEN wealth_form_complete THEN 1
    ELSE 0
END) * 100) / 9) STORED,
    last_form_updated VARCHAR(50),
    last_updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT form_completion_status_pkey PRIMARY KEY (id)
);


-- =============================================================================
-- Indexes (verbatim from Prisma 0_init for the 13 form tables only)
-- =============================================================================

-- income_forms
CREATE UNIQUE INDEX income_forms_user_tax_year_unique ON income_forms(user_id, tax_year);

-- adjustable_tax_forms
CREATE INDEX idx_adjustable_tax_tax_return_id ON adjustable_tax_forms(tax_return_id);
CREATE INDEX idx_adjustable_tax_tax_year ON adjustable_tax_forms(tax_year);
CREATE INDEX idx_adjustable_tax_user_id ON adjustable_tax_forms(user_id);

-- capital_gain_forms
CREATE INDEX idx_capital_gain_forms_return ON capital_gain_forms(tax_return_id);
CREATE INDEX idx_capital_gain_forms_total_capital_gains ON capital_gain_forms(total_capital_gains);
CREATE INDEX idx_capital_gain_forms_user ON capital_gain_forms(user_id, user_email);
CREATE INDEX idx_capital_gain_forms_year ON capital_gain_forms(tax_year_id, tax_year);
CREATE INDEX idx_capital_gains_immovable_1_year ON capital_gain_forms(immovable_property_1_year_taxable);
CREATE INDEX idx_capital_gains_securities_12_5_before_2022 ON capital_gain_forms(securities_12_5_percent_before_july_2022_taxable);
CREATE INDEX idx_capital_gains_securities_before_2013 ON capital_gain_forms(securities_before_july_2013_taxable);

-- credits_forms
CREATE INDEX idx_credits_charitable ON credits_forms(charitable_donations_amount);
CREATE INDEX idx_credits_forms_comprehensive ON credits_forms(total_tax_credits);
CREATE INDEX idx_credits_forms_return ON credits_forms(tax_return_id);
CREATE INDEX idx_credits_forms_user ON credits_forms(user_id, user_email);
CREATE INDEX idx_credits_forms_year ON credits_forms(tax_year_id, tax_year);

-- deductions_forms
CREATE INDEX idx_deductions_educational ON deductions_forms(educational_expenses_amount);
CREATE INDEX idx_deductions_forms_comprehensive ON deductions_forms(total_deduction_from_income);
CREATE INDEX idx_deductions_forms_return ON deductions_forms(tax_return_id);
CREATE INDEX idx_deductions_forms_user ON deductions_forms(user_id, user_email);
CREATE INDEX idx_deductions_forms_year ON deductions_forms(tax_year_id, tax_year);

-- expenses_forms
CREATE INDEX idx_expenses_forms_return ON expenses_forms(tax_return_id);
CREATE INDEX idx_expenses_forms_user ON expenses_forms(user_id, user_email);
CREATE INDEX idx_expenses_forms_year ON expenses_forms(tax_year_id, tax_year);

-- final_min_income_forms
CREATE INDEX idx_final_min_income_forms_return ON final_min_income_forms(tax_return_id);
CREATE INDEX idx_final_min_income_forms_user ON final_min_income_forms(user_id, user_email);
CREATE INDEX idx_final_min_income_forms_year ON final_min_income_forms(tax_year_id, tax_year);
CREATE INDEX idx_final_min_income_user_tax_year ON final_min_income_forms(user_id, tax_year_id);

-- final_tax_forms
CREATE INDEX idx_final_tax_forms_return ON final_tax_forms(tax_return_id);
CREATE INDEX idx_final_tax_forms_user ON final_tax_forms(user_id, user_email);
CREATE INDEX idx_final_tax_forms_year ON final_tax_forms(tax_year_id, tax_year);

-- reductions_forms
CREATE INDEX idx_reductions_forms_return ON reductions_forms(tax_return_id);
CREATE INDEX idx_reductions_forms_user ON reductions_forms(user_id, user_email);
CREATE INDEX idx_reductions_forms_year ON reductions_forms(tax_year_id, tax_year);
CREATE INDEX idx_reductions_teacher_researcher ON reductions_forms(teacher_researcher_amount);

-- tax_computation_forms
CREATE INDEX idx_tax_computation_forms_return ON tax_computation_forms(tax_return_id);
CREATE INDEX idx_tax_computation_forms_user ON tax_computation_forms(user_id, user_email);
CREATE INDEX idx_tax_computation_forms_year ON tax_computation_forms(tax_year_id, tax_year);
CREATE INDEX idx_tax_computation_net_payable ON tax_computation_forms(net_tax_payable);
CREATE INDEX idx_tax_computation_normal_tax ON tax_computation_forms(normal_income_tax);
CREATE INDEX idx_tax_computation_taxable_income ON tax_computation_forms(taxable_income_including_cg);

-- wealth_forms
CREATE INDEX idx_wealth_forms_return ON wealth_forms(tax_return_id);
CREATE INDEX idx_wealth_forms_user ON wealth_forms(user_id, user_email);
CREATE INDEX idx_wealth_forms_year ON wealth_forms(tax_year_id, tax_year);

-- wealth_reconciliation_forms
CREATE INDEX idx_wealth_reconciliation_completion ON wealth_reconciliation_forms(is_complete, tax_year_id);
CREATE INDEX idx_wealth_reconciliation_forms_return ON wealth_reconciliation_forms(tax_return_id);
CREATE INDEX idx_wealth_reconciliation_forms_user ON wealth_reconciliation_forms(user_id, user_email);
CREATE INDEX idx_wealth_reconciliation_forms_year ON wealth_reconciliation_forms(tax_year_id, tax_year);
CREATE INDEX idx_wealth_reconciliation_user_tax_year ON wealth_reconciliation_forms(user_id, tax_year_id);
CREATE INDEX idx_wealth_reconciliation_user_year ON wealth_reconciliation_forms(user_id, tax_year_id);
CREATE UNIQUE INDEX unique_wealth_reconciliation_per_user_year ON wealth_reconciliation_forms(user_id, user_email, tax_year_id);

-- form_completion_status
CREATE INDEX idx_completion_status_return ON form_completion_status(tax_return_id);
CREATE INDEX idx_completion_status_user ON form_completion_status(user_id, user_email);
CREATE INDEX idx_completion_status_year ON form_completion_status(tax_year_id, tax_year);


-- =============================================================================
-- Foreign keys (verbatim from Prisma 0_init for the 13 form tables only)
-- =============================================================================

-- adjustable_tax_forms
ALTER TABLE adjustable_tax_forms ADD CONSTRAINT fk_last_updated_by FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE adjustable_tax_forms ADD CONSTRAINT fk_tax_return FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE adjustable_tax_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE adjustable_tax_forms ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE adjustable_tax_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- capital_gain_forms
ALTER TABLE capital_gain_forms ADD CONSTRAINT capital_gain_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE capital_gain_forms ADD CONSTRAINT capital_gain_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE capital_gain_forms ADD CONSTRAINT capital_gain_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE capital_gain_forms ADD CONSTRAINT capital_gain_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE capital_gain_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE capital_gain_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;

-- credits_forms
ALTER TABLE credits_forms ADD CONSTRAINT credits_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE credits_forms ADD CONSTRAINT credits_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE credits_forms ADD CONSTRAINT credits_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE credits_forms ADD CONSTRAINT credits_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE credits_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE credits_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;

-- deductions_forms
ALTER TABLE deductions_forms ADD CONSTRAINT deductions_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE deductions_forms ADD CONSTRAINT deductions_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE deductions_forms ADD CONSTRAINT deductions_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE deductions_forms ADD CONSTRAINT deductions_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE deductions_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE deductions_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;

-- expenses_forms
ALTER TABLE expenses_forms ADD CONSTRAINT expenses_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE expenses_forms ADD CONSTRAINT expenses_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE expenses_forms ADD CONSTRAINT expenses_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE expenses_forms ADD CONSTRAINT expenses_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE expenses_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE expenses_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;

-- final_min_income_forms
ALTER TABLE final_min_income_forms ADD CONSTRAINT fk_final_min_income_last_updated_by FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE final_min_income_forms ADD CONSTRAINT fk_final_min_income_tax_return FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE final_min_income_forms ADD CONSTRAINT fk_final_min_income_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE final_min_income_forms ADD CONSTRAINT fk_final_min_income_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE final_min_income_forms ADD CONSTRAINT fk_final_min_income_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;

-- final_tax_forms
ALTER TABLE final_tax_forms ADD CONSTRAINT final_tax_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE final_tax_forms ADD CONSTRAINT final_tax_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE final_tax_forms ADD CONSTRAINT final_tax_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE final_tax_forms ADD CONSTRAINT final_tax_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE final_tax_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE final_tax_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;

-- reductions_forms
ALTER TABLE reductions_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE reductions_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE reductions_forms ADD CONSTRAINT reductions_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE reductions_forms ADD CONSTRAINT reductions_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE reductions_forms ADD CONSTRAINT reductions_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE reductions_forms ADD CONSTRAINT reductions_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- tax_computation_forms
ALTER TABLE tax_computation_forms ADD CONSTRAINT tax_computation_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE tax_computation_forms ADD CONSTRAINT tax_computation_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE tax_computation_forms ADD CONSTRAINT tax_computation_forms_tax_year_id_tax_year_fkey FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE tax_computation_forms ADD CONSTRAINT tax_computation_forms_user_email_user_id_fkey FOREIGN KEY (user_email, user_id) REFERENCES users(email, id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE tax_computation_forms ADD CONSTRAINT tax_computation_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- wealth_forms
ALTER TABLE wealth_forms ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE wealth_forms ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE wealth_forms ADD CONSTRAINT wealth_forms_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE wealth_forms ADD CONSTRAINT wealth_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE wealth_forms ADD CONSTRAINT wealth_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE wealth_forms ADD CONSTRAINT wealth_forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- wealth_reconciliation_forms
ALTER TABLE wealth_reconciliation_forms ADD CONSTRAINT wealth_reconciliation_forms_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE wealth_reconciliation_forms ADD CONSTRAINT wealth_reconciliation_forms_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- form_completion_status
ALTER TABLE form_completion_status ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE form_completion_status ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE form_completion_status ADD CONSTRAINT form_completion_status_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE form_completion_status ADD CONSTRAINT form_completion_status_tax_year_id_fkey FOREIGN KEY (tax_year_id) REFERENCES tax_years(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE form_completion_status ADD CONSTRAINT form_completion_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION;


COMMIT;

-- =============================================================================
-- End of phase-t-realign-form-tables.sql
-- =============================================================================
