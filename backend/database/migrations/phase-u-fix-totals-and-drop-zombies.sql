-- =============================================================================
-- phase-u-fix-totals-and-drop-zombies.sql
-- =============================================================================
-- Purpose
--   Repair generated-column formula drift and remove zombie plain columns that
--   shadow the live generated equivalents on the Pakistani Tax App's form
--   tables.  phase-t recreated 13 form tables to match prisma/migrations/0_init,
--   but faithfully reproduced 0_init's flaws:
--
--     1. Several generated subtotal/total_* columns omit input columns added
--        in later patch migrations, so totals undercount.
--     2. wealth_reconciliation_forms has all 5 totals as plain DEFAULT 0 — they
--        are never auto-computed; the app computes them client-side, which is
--        fragile and was the root cause of the recon-row mismatch we hit on the
--        VPS bring-up.
--     3. capital_gain_forms (and final_tax_forms) have parallel legacy + new
--        column families summed together → double-counts when both populated.
--     4. Zombie plain columns shadow live generated equivalents.
--
-- Strategy
--   Postgres does NOT allow changing the expression of a generated column.  The
--   only way is DROP COLUMN + ADD COLUMN GENERATED ALWAYS AS (...) STORED.  For
--   each affected total we DROP CASCADE (which also removes any index that
--   depended on it) and re-create it correctly.  Indexes that were on dropped
--   total columns are recreated at the end.
--
-- Data loss risk
--   We drop ~50 plain "zombie" columns across capital_gain_forms,
--   final_tax_forms, expenses_forms, reductions_forms, credits_forms,
--   deductions_forms.  Any stale values written to those columns are lost.
--   That is acceptable: those columns were never the source of truth — they
--   were shadowed by generated equivalents (or by the newer-family columns)
--   and the frontend / backend writes the canonical versions.
--
--   tax_computation_forms is left alone deliberately.  Although five of its
--   plain columns (surcharge, capital_gain_tax, total_tax, tax_after_adjustments,
--   tax_payable_refundable) look like zombies, the frontend file
--   Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js
--   ACTIVELY WRITES to surcharge, capital_gain_tax, and tax_payable_refundable
--   as the persisted source of truth (see lines 345–356).  Dropping them
--   would break the TaxComputationSummary persist round-trip.  Cleaning them
--   up is a separate refactor (frontend must be migrated first).
--
-- Idempotency
--   Every DROP uses IF EXISTS.  Every ADD of a generated column is wrapped in
--   a DO block that swallows duplicate_column so the migration can be re-run
--   safely after partial application.
--
-- Apply with:
--   docker exec -i tax-advisor-db psql -U postgres -d tax_advisor \
--     < phase-u-fix-totals-and-drop-zombies.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. expenses_forms
--    Re-add total_expenses to include asset_insurance_security, club,
--    functions_gatherings (added post-0_init).  Drop zombie
--    net_expenses_by_taxpayer.
-- -----------------------------------------------------------------------------

ALTER TABLE expenses_forms DROP COLUMN IF EXISTS total_expenses CASCADE;
ALTER TABLE expenses_forms DROP COLUMN IF EXISTS net_expenses_by_taxpayer CASCADE;

DO $$ BEGIN
  ALTER TABLE expenses_forms ADD COLUMN total_expenses numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(rent,                        0::numeric) +
      COALESCE(rates_taxes_charges,         0::numeric) +
      COALESCE(income_tax,                  0::numeric) +
      COALESCE(vehicle_running_maintenance, 0::numeric) +
      COALESCE(travelling,                  0::numeric) +
      COALESCE(electricity,                 0::numeric) +
      COALESCE(water,                       0::numeric) +
      COALESCE(gas,                         0::numeric) +
      COALESCE(telephone,                   0::numeric) +
      COALESCE(medical,                     0::numeric) +
      COALESCE(educational,                 0::numeric) +
      COALESCE(donations_zakat_annuity,     0::numeric) +
      COALESCE(other_expenses,              0::numeric) +
      COALESCE(entertainment,               0::numeric) +
      COALESCE(maintenance,                 0::numeric) +
      COALESCE(asset_insurance_security,    0::numeric) +
      COALESCE(club,                        0::numeric) +
      COALESCE(functions_gatherings,        0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'phase-u: expenses_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 2. final_min_income_forms
--    Re-add subtotal, grand_total, subtotal_tax_chargeable, grand_total_tax_chargeable
--    to include dividend_u_s_150_25pc_bf_losses (and its tax_chargeable variant)
--    which was added in add-dividend-25pc-bf-losses.sql but never folded into
--    the totals.  Also add NEW generated columns subtotal_tax_deducted and
--    grand_total_tax_deducted summing every *_tax_deducted input.
-- -----------------------------------------------------------------------------

ALTER TABLE final_min_income_forms DROP COLUMN IF EXISTS subtotal CASCADE;
ALTER TABLE final_min_income_forms DROP COLUMN IF EXISTS grand_total CASCADE;
ALTER TABLE final_min_income_forms DROP COLUMN IF EXISTS subtotal_tax_chargeable CASCADE;
ALTER TABLE final_min_income_forms DROP COLUMN IF EXISTS grand_total_tax_chargeable CASCADE;
ALTER TABLE final_min_income_forms DROP COLUMN IF EXISTS subtotal_tax_deducted CASCADE;
ALTER TABLE final_min_income_forms DROP COLUMN IF EXISTS grand_total_tax_deducted CASCADE;

DO $$ BEGIN
  ALTER TABLE final_min_income_forms ADD COLUMN subtotal numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(salary_u_s_12_7,                                                 0::numeric) +
      COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30,                      0::numeric) +
      COALESCE(dividend_u_s_150_31_atl_15pc,                                    0::numeric) +
      COALESCE(dividend_u_s_150_56_10_shares,                                   0::numeric) +
      COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv,                      0::numeric) +
      COALESCE(dividend_u_s_150_35pc_share_profit_other_spv,                    0::numeric) +
      COALESCE(dividend_u_s_150_7_5pc_ipp_shares,                               0::numeric) +
      COALESCE(dividend_u_s_150_31pc_atl,                                       0::numeric) +
      COALESCE(dividend_u_s_150_25pc_bf_losses,                                 0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc,                      0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc,                    0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc,                      0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc,                      0::numeric) +
      COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u, 0::numeric) +
      COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc, 0::numeric) +
      COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc,                        0::numeric) +
      COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc,                      0::numeric) +
      COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10p, 0::numeric) +
      COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc,                  0::numeric) +
      COALESCE(profit_on_debt_national_savings_certificates_including_defence_, 0::numeric) +
      COALESCE(profit_debt_national_savings_defence_39_14a,                     0::numeric) +
      COALESCE(profit_on_debt_u_s_7b,                                           0::numeric) +
      COALESCE(interest_income_profit_debt_7b_up_to_5m,                         0::numeric) +
      COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156,       0::numeric) +
      COALESCE(prize_raffle_lottery_quiz_promotional_156,                       0::numeric) +
      COALESCE(prize_bond_cross_world_puzzle_156,                               0::numeric) +
      COALESCE(bonus_shares_issued_by_companies_u_s_236f,                       0::numeric) +
      COALESCE(bonus_shares_companies_236f,                                     0::numeric) +
      COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_a, 0::numeric) +
      COALESCE(employment_termination_benefits_12_6_avg_rate,                   0::numeric) +
      COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate,      0::numeric) +
      COALESCE(salary_arrears_12_7_relevant_rate,                               0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE final_min_income_forms ADD COLUMN grand_total numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(salary_u_s_12_7,                                                 0::numeric) +
      COALESCE(dividend_u_s_150_exempt_profit_rate_mlt_30,                      0::numeric) +
      COALESCE(dividend_u_s_150_31_atl_15pc,                                    0::numeric) +
      COALESCE(dividend_u_s_150_56_10_shares,                                   0::numeric) +
      COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv,                      0::numeric) +
      COALESCE(dividend_u_s_150_35pc_share_profit_other_spv,                    0::numeric) +
      COALESCE(dividend_u_s_150_7_5pc_ipp_shares,                               0::numeric) +
      COALESCE(dividend_u_s_150_31pc_atl,                                       0::numeric) +
      COALESCE(dividend_u_s_150_25pc_bf_losses,                                 0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc,                      0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc,                    0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc,                      0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1b_15pc,                      0::numeric) +
      COALESCE(return_on_investment_exceeding_1_million_sukuk_u_s_saa_12_5pc_u, 0::numeric) +
      COALESCE(return_on_investment_not_exceeding_1_million_sukuk_u_s_saa_10pc, 0::numeric) +
      COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc,                        0::numeric) +
      COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc,                      0::numeric) +
      COALESCE(profit_on_debt_u_s_151a_saa_sab_part_ii_second_schedule_atl_10p, 0::numeric) +
      COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc,                  0::numeric) +
      COALESCE(profit_on_debt_national_savings_certificates_including_defence_, 0::numeric) +
      COALESCE(profit_debt_national_savings_defence_39_14a,                     0::numeric) +
      COALESCE(profit_on_debt_u_s_7b,                                           0::numeric) +
      COALESCE(interest_income_profit_debt_7b_up_to_5m,                         0::numeric) +
      COALESCE(prize_on_raffle_lottery_quiz_as_promotional_offer_u_s_156,       0::numeric) +
      COALESCE(prize_raffle_lottery_quiz_promotional_156,                       0::numeric) +
      COALESCE(prize_bond_cross_world_puzzle_156,                               0::numeric) +
      COALESCE(bonus_shares_issued_by_companies_u_s_236f,                       0::numeric) +
      COALESCE(bonus_shares_companies_236f,                                     0::numeric) +
      COALESCE(employment_termination_benefits_u_s_12_6_chargeable_to_tax_at_a, 0::numeric) +
      COALESCE(employment_termination_benefits_12_6_avg_rate,                   0::numeric) +
      COALESCE(salary_arrears_u_s_12_7_chargeable_to_tax_at_relevant_rate,      0::numeric) +
      COALESCE(salary_arrears_12_7_relevant_rate,                               0::numeric) +
      COALESCE(capital_gain,                                                    0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE final_min_income_forms ADD COLUMN subtotal_tax_chargeable numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(salary_u_s_12_7_tax_chargeable,                                  0::numeric) +
      COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable,       0::numeric) +
      COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable,     0::numeric) +
      COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable,                0::numeric) +
      COALESCE(dividend_u_s_150_31pc_atl_tax_chargeable,                        0::numeric) +
      COALESCE(dividend_u_s_150_25pc_bf_losses_tax_chargeable,                  0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable,       0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable,     0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable,       0::numeric) +
      COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable,         0::numeric) +
      COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable,       0::numeric) +
      COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable,   0::numeric) +
      COALESCE(profit_debt_national_savings_defence_39_14a_tax_chargeable,      0::numeric) +
      COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_chargeable,          0::numeric) +
      COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_chargeable,        0::numeric) +
      COALESCE(prize_bond_cross_world_puzzle_156_tax_chargeable,                0::numeric) +
      COALESCE(bonus_shares_companies_236f_tax_chargeable,                      0::numeric) +
      COALESCE(employment_termination_benefits_12_6_avg_rate_tax_chargeable,    0::numeric) +
      COALESCE(salary_arrears_12_7_relevant_rate_tax_chargeable,                0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE final_min_income_forms ADD COLUMN grand_total_tax_chargeable numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(salary_u_s_12_7_tax_chargeable,                                  0::numeric) +
      COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_chargeable,       0::numeric) +
      COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable,     0::numeric) +
      COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_chargeable,                0::numeric) +
      COALESCE(dividend_u_s_150_31pc_atl_tax_chargeable,                        0::numeric) +
      COALESCE(dividend_u_s_150_25pc_bf_losses_tax_chargeable,                  0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_chargeable,       0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_chargeable,     0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_chargeable,       0::numeric) +
      COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_chargeable,         0::numeric) +
      COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_chargeable,       0::numeric) +
      COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_chargeable,   0::numeric) +
      COALESCE(profit_debt_national_savings_defence_39_14a_tax_chargeable,      0::numeric) +
      COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_chargeable,          0::numeric) +
      COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_chargeable,        0::numeric) +
      COALESCE(prize_bond_cross_world_puzzle_156_tax_chargeable,                0::numeric) +
      COALESCE(bonus_shares_companies_236f_tax_chargeable,                      0::numeric) +
      COALESCE(employment_termination_benefits_12_6_avg_rate_tax_chargeable,    0::numeric) +
      COALESCE(salary_arrears_12_7_relevant_rate_tax_chargeable,                0::numeric) +
      COALESCE(capital_gain_tax_chargeable,                                     0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- NEW: subtotal_tax_deducted — every *_tax_deducted input column except capital_gain_tax_deducted
DO $$ BEGIN
  ALTER TABLE final_min_income_forms ADD COLUMN subtotal_tax_deducted numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(salary_u_s_12_7_tax_deducted,                                    0::numeric) +
      COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted,         0::numeric) +
      COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted,       0::numeric) +
      COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_deducted,                  0::numeric) +
      COALESCE(dividend_u_s_150_31pc_atl_tax_deducted,                          0::numeric) +
      COALESCE(dividend_u_s_150_25pc_bf_losses_tax_deducted,                    0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted,         0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted,       0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted,         0::numeric) +
      COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted,           0::numeric) +
      COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted,         0::numeric) +
      COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted,     0::numeric) +
      COALESCE(profit_debt_national_savings_defence_39_14a_tax_deducted,        0::numeric) +
      COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_deducted,            0::numeric) +
      COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_deducted,          0::numeric) +
      COALESCE(prize_bond_cross_world_puzzle_156_tax_deducted,                  0::numeric) +
      COALESCE(bonus_shares_companies_236f_tax_deducted,                        0::numeric) +
      COALESCE(employment_termination_benefits_12_6_avg_rate_tax_deducted,      0::numeric) +
      COALESCE(salary_arrears_12_7_relevant_rate_tax_deducted,                  0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE final_min_income_forms ADD COLUMN grand_total_tax_deducted numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(salary_u_s_12_7_tax_deducted,                                    0::numeric) +
      COALESCE(dividend_u_s_150_0pc_share_profit_reit_spv_tax_deducted,         0::numeric) +
      COALESCE(dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted,       0::numeric) +
      COALESCE(dividend_u_s_150_7_5pc_ipp_shares_tax_deducted,                  0::numeric) +
      COALESCE(dividend_u_s_150_31pc_atl_tax_deducted,                          0::numeric) +
      COALESCE(dividend_u_s_150_25pc_bf_losses_tax_deducted,                    0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_10pc_tax_deducted,         0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_12_5pc_tax_deducted,       0::numeric) +
      COALESCE(return_on_investment_sukuk_u_s_151_1a_25pc_tax_deducted,         0::numeric) +
      COALESCE(return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted,           0::numeric) +
      COALESCE(return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted,         0::numeric) +
      COALESCE(profit_debt_151a_saa_sab_atl_10pc_non_atl_20pc_tax_deducted,     0::numeric) +
      COALESCE(profit_debt_national_savings_defence_39_14a_tax_deducted,        0::numeric) +
      COALESCE(interest_income_profit_debt_7b_up_to_5m_tax_deducted,            0::numeric) +
      COALESCE(prize_raffle_lottery_quiz_promotional_156_tax_deducted,          0::numeric) +
      COALESCE(prize_bond_cross_world_puzzle_156_tax_deducted,                  0::numeric) +
      COALESCE(bonus_shares_companies_236f_tax_deducted,                        0::numeric) +
      COALESCE(employment_termination_benefits_12_6_avg_rate_tax_deducted,      0::numeric) +
      COALESCE(salary_arrears_12_7_relevant_rate_tax_deducted,                  0::numeric) +
      COALESCE(capital_gain_tax_deducted,                                       0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'phase-u: final_min_income_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 3. wealth_reconciliation_forms  (THE BIG ONE)
--    All 5 totals are currently plain DEFAULT 0 — replace with generated.
--    Postgres won't let a generated col reference another generated col, so
--    calculated_net_increase and unreconciled_difference inline their inputs.
--
--    Note: non_cash_expenses is typically negative in the source data (entered
--    as -1,700,000 in the canonical Excel), so adding it acts as a reduction.
--    This matches the existing app behaviour.
-- -----------------------------------------------------------------------------

ALTER TABLE wealth_reconciliation_forms DROP COLUMN IF EXISTS net_assets_increase      CASCADE;
ALTER TABLE wealth_reconciliation_forms DROP COLUMN IF EXISTS total_inflows            CASCADE;
ALTER TABLE wealth_reconciliation_forms DROP COLUMN IF EXISTS total_outflows           CASCADE;
ALTER TABLE wealth_reconciliation_forms DROP COLUMN IF EXISTS calculated_net_increase  CASCADE;
ALTER TABLE wealth_reconciliation_forms DROP COLUMN IF EXISTS unreconciled_difference  CASCADE;

DO $$ BEGIN
  ALTER TABLE wealth_reconciliation_forms ADD COLUMN net_assets_increase numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(net_assets_current_year,  0::numeric) -
      COALESCE(net_assets_previous_year, 0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE wealth_reconciliation_forms ADD COLUMN total_inflows numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(income_normal_tax,        0::numeric) +
      COALESCE(income_exempt_from_tax,   0::numeric) +
      COALESCE(income_final_tax,         0::numeric) +
      COALESCE(foreign_remittance,       0::numeric) +
      COALESCE(inheritance,              0::numeric) +
      COALESCE(gift_value,               0::numeric) +
      COALESCE(asset_disposal_gain_loss, 0::numeric) +
      COALESCE(other_inflows,            0::numeric) +
      COALESCE(non_cash_expenses,        0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE wealth_reconciliation_forms ADD COLUMN total_outflows numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(personal_expenses,    0::numeric) +
      COALESCE(adjustments_outflows, 0::numeric) +
      COALESCE(gift_outflow,         0::numeric) +
      COALESCE(loss_on_disposal,     0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- inlined: cannot reference total_inflows / total_outflows generated cols
DO $$ BEGIN
  ALTER TABLE wealth_reconciliation_forms ADD COLUMN calculated_net_increase numeric(15,2)
    GENERATED ALWAYS AS (
      (
        COALESCE(income_normal_tax,        0::numeric) +
        COALESCE(income_exempt_from_tax,   0::numeric) +
        COALESCE(income_final_tax,         0::numeric) +
        COALESCE(foreign_remittance,       0::numeric) +
        COALESCE(inheritance,              0::numeric) +
        COALESCE(gift_value,               0::numeric) +
        COALESCE(asset_disposal_gain_loss, 0::numeric) +
        COALESCE(other_inflows,            0::numeric) +
        COALESCE(non_cash_expenses,        0::numeric)
      ) - (
        COALESCE(personal_expenses,        0::numeric) +
        COALESCE(adjustments_outflows,     0::numeric) +
        COALESCE(gift_outflow,             0::numeric) +
        COALESCE(loss_on_disposal,         0::numeric)
      )
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- inlined: net_assets_increase - calculated_net_increase
DO $$ BEGIN
  ALTER TABLE wealth_reconciliation_forms ADD COLUMN unreconciled_difference numeric(15,2)
    GENERATED ALWAYS AS (
      (
        COALESCE(net_assets_current_year,  0::numeric) -
        COALESCE(net_assets_previous_year, 0::numeric)
      ) - (
        (
          COALESCE(income_normal_tax,        0::numeric) +
          COALESCE(income_exempt_from_tax,   0::numeric) +
          COALESCE(income_final_tax,         0::numeric) +
          COALESCE(foreign_remittance,       0::numeric) +
          COALESCE(inheritance,              0::numeric) +
          COALESCE(gift_value,               0::numeric) +
          COALESCE(asset_disposal_gain_loss, 0::numeric) +
          COALESCE(other_inflows,            0::numeric) +
          COALESCE(non_cash_expenses,        0::numeric)
        ) - (
          COALESCE(personal_expenses,        0::numeric) +
          COALESCE(adjustments_outflows,     0::numeric) +
          COALESCE(gift_outflow,             0::numeric) +
          COALESCE(loss_on_disposal,         0::numeric)
        )
      )
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'phase-u: wealth_reconciliation_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 4. capital_gain_forms
--    Drop legacy column families (property_*_year[s] without _taxable suffix,
--    property_plot/constructed/flat_*, property_X_Y_years*, sec_*).  Keep the
--    immovable_property_*_years_{taxable,deducted,carryable} and securities_*
--    families which the frontend uses.  Re-derive total_capital_gain,
--    total_tax_deducted, total_tax_carryable to reference only the surviving
--    columns.  Drop the duplicate total_capital_gains, total_capital_gains_tax,
--    property_2_3_years_tax_calculated and the zombie capital_gains_tax_chargeable.
--    NOTE: the frontend writes capital_gains_tax_chargeable (TaxComputationSummary
--    line 137) so we drop the PLAIN column form only if it is plain; the version
--    on this table IS plain (DEFAULT 0) — we drop and re-add as plain (no-op
--    semantically) to keep names stable.  Actually leave it: it is plain, set
--    by app code, not generated, so it is the source-of-truth for the net CGT
--    after WHT offset.  We will keep capital_gains_tax_chargeable.
-- -----------------------------------------------------------------------------

-- Drop legacy generated columns first (they reference the legacy plain columns
-- we are about to drop).
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_capital_gain               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_tax_deducted               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_tax_carryable              CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_capital_gains              CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS total_capital_gains_tax          CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_3_years_tax_calculated CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_1_year_tax_due           CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_3_years_tax_due        CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS securities_tax_due                CASCADE;

-- Drop legacy property holding-period columns (replaced by immovable_property_*_taxable family).
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_1_year                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_1_year_tax_rate         CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_1_year_tax_deducted     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_3_years               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_3_years_tax_rate      CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_3_years_tax_deducted  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_4_plus_years            CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_4_plus_years_tax_deducted CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_1_2_years               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_1_2_years_tax_rate      CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_3_4_years               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_3_4_years_tax_rate      CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_4_5_years               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_4_5_years_tax_rate      CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_5_6_years               CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_5_6_years_tax_rate      CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_plot_1_year             CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_constructed_1_year      CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_flat_1_year             CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_plot_2_3_years          CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_constructed_2_3_years   CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_flat_2_3_years          CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_year                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_2_year_tax_deducted     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_3_year                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_3_year_tax_deducted     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_4_year                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_4_year_tax_deducted     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_5_year                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_5_year_tax_deducted     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_6_year                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_6_year_tax_deducted     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_over_6_year             CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS property_over_6_year_tax_deducted CASCADE;

-- Drop legacy securities columns (replaced by securities_*_taxable family).
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS securities                       CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS securities_tax_rate              CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS securities_tax_deducted          CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_pre_2013                     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_pre_2013_deducted            CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_pmex                         CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_pmex_deducted                CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_7_5_percent                  CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_7_5_percent_deducted         CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_10_percent                   CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_10_percent_deducted          CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_12_5_percent                 CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_12_5_percent_deducted        CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_25_percent                   CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_25_percent_deducted          CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_pre_2022                     CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_pre_2022_deducted            CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_15_percent                   CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS sec_15_percent_deducted          CASCADE;

-- Drop legacy "other_capital_gains" pair (frontend uses the immovable + securities families exclusively).
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS other_capital_gains              CASCADE;
ALTER TABLE capital_gain_forms DROP COLUMN IF EXISTS other_capital_gains_tax          CASCADE;

-- Recreate the three totals against the surviving families only.
DO $$ BEGIN
  ALTER TABLE capital_gain_forms ADD COLUMN total_capital_gain numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(immovable_property_1_year_taxable,             0::numeric) +
      COALESCE(immovable_property_2_years_taxable,            0::numeric) +
      COALESCE(immovable_property_3_years_taxable,            0::numeric) +
      COALESCE(immovable_property_4_years_taxable,            0::numeric) +
      COALESCE(immovable_property_5_years_taxable,            0::numeric) +
      COALESCE(immovable_property_6_years_taxable,            0::numeric) +
      COALESCE(immovable_property_over_6_years_taxable,       0::numeric) +
      COALESCE(securities_before_july_2013_taxable,           0::numeric) +
      COALESCE(securities_pmex_settled_taxable,               0::numeric) +
      COALESCE(securities_37a_7_5_percent_taxable,            0::numeric) +
      COALESCE(securities_mutual_funds_10_percent_taxable,    0::numeric) +
      COALESCE(securities_mutual_funds_12_5_percent_taxable,  0::numeric) +
      COALESCE(securities_other_25_percent_taxable,           0::numeric) +
      COALESCE(securities_12_5_percent_before_july_2022_taxable, 0::numeric) +
      COALESCE(securities_15_percent_taxable,                 0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE capital_gain_forms ADD COLUMN total_tax_deducted numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(immovable_property_1_year_deducted,             0::numeric) +
      COALESCE(immovable_property_2_years_deducted,            0::numeric) +
      COALESCE(immovable_property_3_years_deducted,            0::numeric) +
      COALESCE(immovable_property_4_years_deducted,            0::numeric) +
      COALESCE(immovable_property_5_years_deducted,            0::numeric) +
      COALESCE(immovable_property_6_years_deducted,            0::numeric) +
      COALESCE(immovable_property_over_6_years_deducted,       0::numeric) +
      COALESCE(securities_before_july_2013_deducted,           0::numeric) +
      COALESCE(securities_pmex_settled_deducted,               0::numeric) +
      COALESCE(securities_37a_7_5_percent_deducted,            0::numeric) +
      COALESCE(securities_mutual_funds_10_percent_deducted,    0::numeric) +
      COALESCE(securities_mutual_funds_12_5_percent_deducted,  0::numeric) +
      COALESCE(securities_other_25_percent_deducted,           0::numeric) +
      COALESCE(securities_12_5_percent_before_july_2022_deducted, 0::numeric) +
      COALESCE(securities_15_percent_deducted,                 0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE capital_gain_forms ADD COLUMN total_tax_carryable numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(immovable_property_1_year_carryable,             0::numeric) +
      COALESCE(immovable_property_2_years_carryable,            0::numeric) +
      COALESCE(immovable_property_3_years_carryable,            0::numeric) +
      COALESCE(immovable_property_4_years_carryable,            0::numeric) +
      COALESCE(immovable_property_5_years_carryable,            0::numeric) +
      COALESCE(immovable_property_6_years_carryable,            0::numeric) +
      COALESCE(immovable_property_over_6_years_carryable,       0::numeric) +
      COALESCE(securities_before_july_2013_carryable,           0::numeric) +
      COALESCE(securities_pmex_settled_carryable,               0::numeric) +
      COALESCE(securities_37a_7_5_percent_carryable,            0::numeric) +
      COALESCE(securities_mutual_funds_10_percent_carryable,    0::numeric) +
      COALESCE(securities_mutual_funds_12_5_percent_carryable,  0::numeric) +
      COALESCE(securities_other_25_percent_carryable,           0::numeric) +
      COALESCE(securities_12_5_percent_before_july_2022_carryable, 0::numeric) +
      COALESCE(securities_15_percent_carryable,                 0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Recreate dropped indexes that previously sat on legacy/total columns.
CREATE INDEX IF NOT EXISTS idx_capital_gain_forms_total_capital_gain
  ON capital_gain_forms (total_capital_gain);

DO $$ BEGIN RAISE NOTICE 'phase-u: capital_gain_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 5. final_tax_forms
--    The legacy columns (sukuk_amount, sukuk_tax_rate, sukuk_tax_amount,
--    debt_amount, debt_tax_rate, debt_tax_amount, prize_bonds, prize_bonds_tax,
--    other_final_tax_amount, other_final_tax) are NOT referenced by the
--    frontend.  Frontend/.../FinalTaxForm.js reads & writes the *_gross_amount /
--    *_tax_amount family exclusively (verified via grep, lines 80-189).
--    We drop the legacy columns and re-derive total_final_tax from the new family.
-- -----------------------------------------------------------------------------

ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS total_final_tax        CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS sukuk_tax_amount       CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS debt_tax_amount        CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS sukuk_amount           CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS sukuk_tax_rate         CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS debt_amount            CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS debt_tax_rate          CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS prize_bonds            CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS prize_bonds_tax        CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS other_final_tax_amount CASCADE;
ALTER TABLE final_tax_forms DROP COLUMN IF EXISTS other_final_tax        CASCADE;

DO $$ BEGIN
  ALTER TABLE final_tax_forms ADD COLUMN total_final_tax numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(sukuk_bonds_tax_amount,     0::numeric) +
      COALESCE(debt_securities_tax_amount, 0::numeric) +
      COALESCE(prize_bonds_tax_amount,     0::numeric) +
      COALESCE(other_final_tax_tax_amount, 0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'phase-u: final_tax_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 6a. reductions_forms
--     Drop plain zombie total_tax_reductions.  total_reductions is already
--     correct and includes all reduction inputs (teacher_researcher_tax_reduction,
--     behbood_certificates_tax_reduction, capital_gain_immovable_*_reduction,
--     export_income_reduction, industrial_undertaking_reduction, other_reductions).
--     Leave total_reductions untouched.
-- -----------------------------------------------------------------------------

ALTER TABLE reductions_forms DROP COLUMN IF EXISTS total_tax_reductions CASCADE;
-- Also drop the older inputs teacher_amount/teacher_reduction/behbood_reduction
-- that were superseded by teacher_researcher_* / behbood_certificates_*.
-- Keep them in place for now to avoid touching any back-compat readers; they
-- are not referenced by total_reductions.

DO $$ BEGIN RAISE NOTICE 'phase-u: reductions_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 6b. credits_forms
--     Drop plain zombie total_tax_credits and re-derive total_credits to
--     include pension_contribution_tax_credit, life_insurance_premium_tax_credit,
--     provident_fund_tax_credit, voluntary_pension_scheme_tax_credit,
--     investment_shares_tax_credit, investment_tax_credit_tax_credit
--     (currently total_credits omits all of these).
-- -----------------------------------------------------------------------------

ALTER TABLE credits_forms DROP COLUMN IF EXISTS total_credits     CASCADE;
ALTER TABLE credits_forms DROP COLUMN IF EXISTS total_tax_credits CASCADE;

DO $$ BEGIN
  ALTER TABLE credits_forms ADD COLUMN total_credits numeric(15,2)
    GENERATED ALWAYS AS (
      COALESCE(charitable_donations_tax_credit,           0::numeric) +
      COALESCE(charitable_donations_associate_tax_credit, 0::numeric) +
      COALESCE(pension_contribution_tax_credit,           0::numeric) +
      COALESCE(life_insurance_premium_tax_credit,         0::numeric) +
      COALESCE(provident_fund_tax_credit,                 0::numeric) +
      COALESCE(voluntary_pension_scheme_tax_credit,       0::numeric) +
      COALESCE(investment_shares_tax_credit,              0::numeric) +
      COALESCE(investment_tax_credit_tax_credit,          0::numeric) +
      COALESCE(pension_fund_tax_credit,                   0::numeric) +
      COALESCE(surrender_tax_credit_reduction,            0::numeric) +
      COALESCE(investment_tax_credit,                     0::numeric) +
      COALESCE(other_credits,                             0::numeric)
    ) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'phase-u: credits_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 6c. deductions_forms
--     Drop plain zombie total_deduction_from_income.  total_deductions is
--     already correct.  Also drop redundant education_expense_amount /
--     education_expense_children (superseded by educational_expenses_amount /
--     educational_expenses_children_count which total_deductions references).
-- -----------------------------------------------------------------------------

ALTER TABLE deductions_forms DROP COLUMN IF EXISTS total_deduction_from_income CASCADE;
ALTER TABLE deductions_forms DROP COLUMN IF EXISTS education_expense_amount    CASCADE;
ALTER TABLE deductions_forms DROP COLUMN IF EXISTS education_expense_children  CASCADE;

DO $$ BEGIN RAISE NOTICE 'phase-u: deductions_forms done'; END $$;


-- -----------------------------------------------------------------------------
-- 7. tax_computation_forms  (DELIBERATELY LEFT ALONE)
--
--    The audit flagged surcharge, capital_gain_tax, total_tax,
--    tax_after_adjustments, tax_payable_refundable as "zombies".  HOWEVER:
--
--      Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js
--      lines 343–356 actively WRITES these plain columns as the persisted
--      source of truth for the computed tax breakdown.  Specifically:
--          surcharge:              computationData?.surcharge
--          surcharge_amount:       computationData?.surcharge
--          capital_gain_tax:       computationData?.capital_gain_tax
--          capital_gains_tax:      computationData?.capital_gain_tax
--          tax_payable_refundable: demanded
--
--    The generated columns (surcharge_amount, net_tax_payable, total_tax_liability,
--    balance_payable, capital_gains_tax) shadow these but only reconstruct
--    values when the plain columns are populated.  Dropping the plain columns
--    would break round-trips.  total_tax / tax_after_adjustments are also
--    written by other call sites (backend/routes/taxHistory.js uses
--    pick(tc, 'tax_payable_refundable', 'total_tax_chargeable') — see
--    grep result above).
--
--    Cleanup requires a frontend + backend code refactor first.  Out of scope
--    for phase-u.
-- -----------------------------------------------------------------------------

DO $$ BEGIN RAISE NOTICE 'phase-u: tax_computation_forms skipped (see header comment)'; END $$;


-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  v_count bigint;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'expenses_forms',
      'final_min_income_forms',
      'wealth_reconciliation_forms',
      'capital_gain_forms',
      'final_tax_forms',
      'reductions_forms',
      'credits_forms',
      'deductions_forms'
    ]) AS t
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', r.t) INTO v_count;
    RAISE NOTICE 'phase-u verify: % rows=%', r.t, v_count;
  END LOOP;
END $$;

-- Column summaries (printed by psql so they show up in apply logs).
SELECT 'expenses_forms.total_expenses'::text AS check,
       pg_get_expr(d.adbin, d.adrelid) AS expression
  FROM pg_attribute a
  JOIN pg_attrdef  d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attrelid = 'expenses_forms'::regclass
   AND a.attname  = 'total_expenses';

SELECT 'wealth_reconciliation_forms.calculated_net_increase'::text AS check,
       pg_get_expr(d.adbin, d.adrelid) AS expression
  FROM pg_attribute a
  JOIN pg_attrdef  d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attrelid = 'wealth_reconciliation_forms'::regclass
   AND a.attname  = 'calculated_net_increase';

SELECT 'capital_gain_forms.total_capital_gain'::text AS check,
       pg_get_expr(d.adbin, d.adrelid) AS expression
  FROM pg_attribute a
  JOIN pg_attrdef  d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attrelid = 'capital_gain_forms'::regclass
   AND a.attname  = 'total_capital_gain';

SELECT 'final_tax_forms.total_final_tax'::text AS check,
       pg_get_expr(d.adbin, d.adrelid) AS expression
  FROM pg_attribute a
  JOIN pg_attrdef  d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attrelid = 'final_tax_forms'::regclass
   AND a.attname  = 'total_final_tax';

SELECT 'credits_forms.total_credits'::text AS check,
       pg_get_expr(d.adbin, d.adrelid) AS expression
  FROM pg_attribute a
  JOIN pg_attrdef  d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
 WHERE a.attrelid = 'credits_forms'::regclass
   AND a.attname  = 'total_credits';

DO $$ BEGIN RAISE NOTICE 'phase-u: COMPLETE'; END $$;

COMMIT;
