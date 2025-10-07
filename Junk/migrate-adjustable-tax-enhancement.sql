-- Migration: Enhanced Adjustable Tax Forms Table
-- Purpose: Update adjustable_tax_forms table to match comprehensive Excel structure
-- Date: 2025-01-06

-- Step 1: Create backup of existing data
CREATE TABLE adjustable_tax_forms_backup AS SELECT * FROM adjustable_tax_forms;

-- Step 2: Drop existing table (data will be preserved in backup)
DROP TABLE IF EXISTS adjustable_tax_forms CASCADE;

-- Step 3: Create new comprehensive adjustable_tax_forms table
CREATE TABLE adjustable_tax_forms (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tax_return_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_email varchar(255) NOT NULL,
    tax_year_id uuid NOT NULL,
    tax_year varchar(10) NOT NULL,
    
    -- Salary and Employment Income
    salary_employees_149_gross_receipt numeric(15,2) DEFAULT 0,
    salary_employees_149_tax_collected numeric(15,2) DEFAULT 0,
    directorship_fee_149_3_gross_receipt numeric(15,2) DEFAULT 0,
    directorship_fee_149_3_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Profit on Debt
    profit_debt_151_15_gross_receipt numeric(15,2) DEFAULT 0,
    profit_debt_151_15_tax_collected numeric(15,2) DEFAULT 0,
    profit_debt_non_resident_152_2_gross_receipt numeric(15,2) DEFAULT 0,
    profit_debt_non_resident_152_2_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Cash Withdrawal and Banking
    advance_tax_cash_withdrawal_231ab_gross_receipt numeric(15,2) DEFAULT 0,
    advance_tax_cash_withdrawal_231ab_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Motor Vehicle Related
    motor_vehicle_registration_fee_231b1_gross_receipt numeric(15,2) DEFAULT 0,
    motor_vehicle_registration_fee_231b1_tax_collected numeric(15,2) DEFAULT 0,
    motor_vehicle_transfer_fee_231b2_gross_receipt numeric(15,2) DEFAULT 0,
    motor_vehicle_transfer_fee_231b2_tax_collected numeric(15,2) DEFAULT 0,
    motor_vehicle_sale_231b3_gross_receipt numeric(15,2) DEFAULT 0,
    motor_vehicle_sale_231b3_tax_collected numeric(15,2) DEFAULT 0,
    motor_vehicle_leasing_231b1a_gross_receipt numeric(15,2) DEFAULT 0,
    motor_vehicle_leasing_231b1a_tax_collected numeric(15,2) DEFAULT 0,
    advance_tax_motor_vehicle_231b2a_gross_receipt numeric(15,2) DEFAULT 0,
    advance_tax_motor_vehicle_231b2a_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Utility Bills
    electricity_bill_domestic_235_gross_receipt numeric(15,2) DEFAULT 0,
    electricity_bill_domestic_235_tax_collected numeric(15,2) DEFAULT 0,
    telephone_bill_236_1e_gross_receipt numeric(15,2) DEFAULT 0,
    telephone_bill_236_1e_tax_collected numeric(15,2) DEFAULT 0,
    cellphone_bill_236_1f_gross_receipt numeric(15,2) DEFAULT 0,
    cellphone_bill_236_1f_tax_collected numeric(15,2) DEFAULT 0,
    prepaid_telephone_card_236_1b_gross_receipt numeric(15,2) DEFAULT 0,
    prepaid_telephone_card_236_1b_tax_collected numeric(15,2) DEFAULT 0,
    phone_unit_236_1c_gross_receipt numeric(15,2) DEFAULT 0,
    phone_unit_236_1c_tax_collected numeric(15,2) DEFAULT 0,
    internet_bill_236_1d_gross_receipt numeric(15,2) DEFAULT 0,
    internet_bill_236_1d_tax_collected numeric(15,2) DEFAULT 0,
    prepaid_internet_card_236_1e_gross_receipt numeric(15,2) DEFAULT 0,
    prepaid_internet_card_236_1e_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Property Related
    sale_transfer_immoveable_property_236c_gross_receipt numeric(15,2) DEFAULT 0,
    sale_transfer_immoveable_property_236c_tax_collected numeric(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_sold_same_year_gross_receipt numeric(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_sold_same_year_tax_collected numeric(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_prior_year_gross_receipt numeric(15,2) DEFAULT 0,
    tax_deducted_236c_property_purchased_prior_year_tax_collected numeric(15,2) DEFAULT 0,
    purchase_transfer_immoveable_property_236k_gross_receipt numeric(15,2) DEFAULT 0,
    purchase_transfer_immoveable_property_236k_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Events and Services
    functions_gatherings_charges_236cb_gross_receipt numeric(15,2) DEFAULT 0,
    functions_gatherings_charges_236cb_tax_collected numeric(15,2) DEFAULT 0,
    withholding_tax_sale_considerations_37e_gross_receipt numeric(15,2) DEFAULT 0,
    withholding_tax_sale_considerations_37e_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Financial and International
    advance_fund_23a_part_i_second_schedule_gross_receipt numeric(15,2) DEFAULT 0,
    advance_fund_23a_part_i_second_schedule_tax_collected numeric(15,2) DEFAULT 0,
    persons_remitting_amount_abroad_236v_gross_receipt numeric(15,2) DEFAULT 0,
    persons_remitting_amount_abroad_236v_tax_collected numeric(15,2) DEFAULT 0,
    advance_tax_foreign_domestic_workers_231c_gross_receipt numeric(15,2) DEFAULT 0,
    advance_tax_foreign_domestic_workers_231c_tax_collected numeric(15,2) DEFAULT 0,
    
    -- Calculated totals (generated columns)
    total_gross_receipt numeric(15,2) GENERATED ALWAYS AS (
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
        COALESCE(tax_deducted_236c_property_purchased_sold_same_year_gross_receipt, 0) +
        COALESCE(tax_deducted_236c_property_purchased_prior_year_gross_receipt, 0) +
        COALESCE(purchase_transfer_immoveable_property_236k_gross_receipt, 0) +
        COALESCE(functions_gatherings_charges_236cb_gross_receipt, 0) +
        COALESCE(withholding_tax_sale_considerations_37e_gross_receipt, 0) +
        COALESCE(advance_fund_23a_part_i_second_schedule_gross_receipt, 0) +
        COALESCE(persons_remitting_amount_abroad_236v_gross_receipt, 0) +
        COALESCE(advance_tax_foreign_domestic_workers_231c_gross_receipt, 0)
    ) STORED,
    
    total_adjustable_tax numeric(15,2) GENERATED ALWAYS AS (
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
        COALESCE(tax_deducted_236c_property_purchased_sold_same_year_tax_collected, 0) +
        COALESCE(tax_deducted_236c_property_purchased_prior_year_tax_collected, 0) +
        COALESCE(purchase_transfer_immoveable_property_236k_tax_collected, 0) +
        COALESCE(functions_gatherings_charges_236cb_tax_collected, 0) +
        COALESCE(withholding_tax_sale_considerations_37e_tax_collected, 0) +
        COALESCE(advance_fund_23a_part_i_second_schedule_tax_collected, 0) +
        COALESCE(persons_remitting_amount_abroad_236v_tax_collected, 0) +
        COALESCE(advance_tax_foreign_domestic_workers_231c_tax_collected, 0)
    ) STORED,
    
    is_complete boolean DEFAULT false,
    last_updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create indexes
CREATE INDEX idx_adjustable_tax_forms_return ON adjustable_tax_forms(tax_return_id);
CREATE INDEX idx_adjustable_tax_forms_user ON adjustable_tax_forms(user_id, user_email);
CREATE INDEX idx_adjustable_tax_forms_year ON adjustable_tax_forms(tax_year_id, tax_year);

-- Step 5: Add foreign key constraints
ALTER TABLE adjustable_tax_forms 
ADD CONSTRAINT fk_tax_return FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id),
ADD CONSTRAINT fk_tax_year FOREIGN KEY (tax_year_id, tax_year) REFERENCES tax_years(id, tax_year),
ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
ADD CONSTRAINT fk_user_email FOREIGN KEY (user_id, user_email) REFERENCES users(id, email),
ADD CONSTRAINT fk_last_updated_by FOREIGN KEY (last_updated_by) REFERENCES users(id);

-- Step 6: Add audit trigger
CREATE TRIGGER audit_adjustable_tax_forms_trigger
    AFTER INSERT OR UPDATE OR DELETE ON adjustable_tax_forms
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Step 7: Add updated_at trigger
CREATE TRIGGER update_adjustable_tax_forms_updated_at
    BEFORE UPDATE ON adjustable_tax_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Migrate existing data from backup
INSERT INTO adjustable_tax_forms (
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    electricity_bill_domestic_235_gross_receipt,
    electricity_bill_domestic_235_tax_collected,
    telephone_bill_236_1e_gross_receipt,
    telephone_bill_236_1e_tax_collected,
    motor_vehicle_registration_fee_231b1_gross_receipt,
    motor_vehicle_registration_fee_231b1_tax_collected,
    profit_debt_151_15_gross_receipt,
    profit_debt_151_15_tax_collected,
    is_complete, last_updated_by, created_at
)
SELECT 
    tax_return_id, user_id, user_email, tax_year_id, tax_year,
    electricity_bill,
    electricity_tax,
    phone_bill,
    phone_tax,
    vehicle_amount,
    vehicle_tax,
    profit_on_debt,
    profit_on_debt_tax,
    is_complete, last_updated_by, created_at
FROM adjustable_tax_forms_backup;

-- Step 9: Update gg@test.com data with Excel values
UPDATE adjustable_tax_forms 
SET 
    salary_employees_149_gross_receipt = 8750000,
    salary_employees_149_tax_collected = 2200000,
    updated_at = CURRENT_TIMESTAMP
WHERE user_email = 'gg@test.com' AND tax_year = '2025-26';

-- Step 10: Clean up backup table (optional - comment out if you want to keep it)
-- DROP TABLE adjustable_tax_forms_backup;

COMMIT;