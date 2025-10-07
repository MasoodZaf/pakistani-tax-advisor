-- Add Missing Fields to Adjustable Tax Forms Table
-- Based on detailed Excel image review

-- Add the missing Pension Fund withdrawal field
ALTER TABLE adjustable_tax_forms 
ADD COLUMN advance_tax_withdrawal_pension_fund_23a_gross_receipt numeric(15,2) DEFAULT 0,
ADD COLUMN advance_tax_withdrawal_pension_fund_23a_tax_collected numeric(15,2) DEFAULT 0;

-- Update the generated total columns to include the new fields
-- First, drop the existing generated columns
ALTER TABLE adjustable_tax_forms 
DROP COLUMN total_gross_receipt,
DROP COLUMN total_adjustable_tax;

-- Recreate the generated columns with all fields included
ALTER TABLE adjustable_tax_forms 
ADD COLUMN total_gross_receipt numeric(15,2) GENERATED ALWAYS AS (
    COALESCE(salary_employees_149_gross_receipt, 0) + 
    COALESCE(directorship_fee_149_3_gross_receipt, 0) +
    COALESCE(profit_debt_151_15_gross_receipt, 0) +
    COALESCE(profit_debt_non_resident_152_2_gross_receipt, 0) +
    COALESCE(advance_tax_cash_withdrawal_231ab_gross_receipt, 0) +
    COALESCE(motor_vehicle_registration_fee_231b1_gross_receipt, 0) +
    COALESCE(motor_vehicle_transfer_fee_231b2_gross_receipt, 0) +
    COALESCE(motor_vehicle_sale_231b3_gross_receipt, 0) +
    COALESCE(motor_vehicle_leasing_231b1a_gross_receipt, 0) +
    COALESCE(advance_tax_motor_vehicle_231b2a_gross_receipt, 0) +
    COALESCE(electricity_bill_domestic_235_gross_receipt, 0) +
    COALESCE(telephone_bill_236_1e_gross_receipt, 0) +
    COALESCE(cellphone_bill_236_1f_gross_receipt, 0) +
    COALESCE(prepaid_telephone_card_236_1b_gross_receipt, 0) +
    COALESCE(phone_unit_236_1c_gross_receipt, 0) +
    COALESCE(internet_bill_236_1d_gross_receipt, 0) +
    COALESCE(prepaid_internet_card_236_1e_gross_receipt, 0) +
    COALESCE(sale_transfer_immoveable_property_236c_gross_receipt, 0) +
    COALESCE(tax_deducted_236c_property_purchased_sold_same_year_gross_recei, 0) +
    COALESCE(tax_deducted_236c_property_purchased_prior_year_gross_receipt, 0) +
    COALESCE(purchase_transfer_immoveable_property_236k_gross_receipt, 0) +
    COALESCE(functions_gatherings_charges_236cb_gross_receipt, 0) +
    COALESCE(withholding_tax_sale_considerations_37e_gross_receipt, 0) +
    COALESCE(advance_fund_23a_part_i_second_schedule_gross_receipt, 0) +
    COALESCE(advance_tax_withdrawal_pension_fund_23a_gross_receipt, 0) +
    COALESCE(persons_remitting_amount_abroad_236v_gross_receipt, 0) +
    COALESCE(advance_tax_foreign_domestic_workers_231c_gross_receipt, 0)
) STORED,

ADD COLUMN total_adjustable_tax numeric(15,2) GENERATED ALWAYS AS (
    COALESCE(salary_employees_149_tax_collected, 0) + 
    COALESCE(directorship_fee_149_3_tax_collected, 0) +
    COALESCE(profit_debt_151_15_tax_collected, 0) +
    COALESCE(profit_debt_non_resident_152_2_tax_collected, 0) +
    COALESCE(advance_tax_cash_withdrawal_231ab_tax_collected, 0) +
    COALESCE(motor_vehicle_registration_fee_231b1_tax_collected, 0) +
    COALESCE(motor_vehicle_transfer_fee_231b2_tax_collected, 0) +
    COALESCE(motor_vehicle_sale_231b3_tax_collected, 0) +
    COALESCE(motor_vehicle_leasing_231b1a_tax_collected, 0) +
    COALESCE(advance_tax_motor_vehicle_231b2a_tax_collected, 0) +
    COALESCE(electricity_bill_domestic_235_tax_collected, 0) +
    COALESCE(telephone_bill_236_1e_tax_collected, 0) +
    COALESCE(cellphone_bill_236_1f_tax_collected, 0) +
    COALESCE(prepaid_telephone_card_236_1b_tax_collected, 0) +
    COALESCE(phone_unit_236_1c_tax_collected, 0) +
    COALESCE(internet_bill_236_1d_tax_collected, 0) +
    COALESCE(prepaid_internet_card_236_1e_tax_collected, 0) +
    COALESCE(sale_transfer_immoveable_property_236c_tax_collected, 0) +
    COALESCE(tax_deducted_236c_property_purchased_sold_same_year_tax_collect, 0) +
    COALESCE(tax_deducted_236c_property_purchased_prior_year_tax_collected, 0) +
    COALESCE(purchase_transfer_immoveable_property_236k_tax_collected, 0) +
    COALESCE(functions_gatherings_charges_236cb_tax_collected, 0) +
    COALESCE(withholding_tax_sale_considerations_37e_tax_collected, 0) +
    COALESCE(advance_fund_23a_part_i_second_schedule_tax_collected, 0) +
    COALESCE(advance_tax_withdrawal_pension_fund_23a_tax_collected, 0) +
    COALESCE(persons_remitting_amount_abroad_236v_tax_collected, 0) +
    COALESCE(advance_tax_foreign_domestic_workers_231c_tax_collected, 0)
) STORED;

-- Add comment to document this field
COMMENT ON COLUMN adjustable_tax_forms.advance_tax_withdrawal_pension_fund_23a_gross_receipt 
IS 'Advance tax on withdrawal of balance under Pension Fund u/s 23A of Part I of Second Schedule - Gross Receipt';

COMMENT ON COLUMN adjustable_tax_forms.advance_tax_withdrawal_pension_fund_23a_tax_collected 
IS 'Advance tax on withdrawal of balance under Pension Fund u/s 23A of Part I of Second Schedule - Tax Collected';

COMMIT;