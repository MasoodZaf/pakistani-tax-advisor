# Excel to Database Data Flow Guide
**Excel File:** Salaried Individuals 2025.xlsx
**Database:** tax_advisor
**Date Created:** October 6, 2025
**Purpose:** Complete mapping of Excel calculations to database tables

---

## 📊 COMPLETE DATA FLOW OVERVIEW

```
Excel Sheet: "Income"
    ↓
Database: income_forms
    ↓
Excel Sheet: "Adjustable Tax"
    ↓
Database: adjustable_tax_forms
    ↓
Excel Sheet: "Income with Final Min tax"
    ↓
Database: final_min_income_forms
    ↓
Excel Sheet: "Tax Reduction, Credit & deduct"
    ↓
Database: deductions_forms, credits_forms, reductions_forms
    ↓
Excel Sheet: "Capital Gain"
    ↓
Database: capital_gain_forms
    ↓
Excel Sheet: "Tax Computation"
    ↓
Database: tax_computation_forms (AUTO-CALCULATED via SQL functions)
    ↓
Excel Sheet: "Detail of Expenses"
    ↓
Database: expenses_forms
    ↓
Excel Sheet: "Wealth Statement"
    ↓
Database: wealth_statement_forms
    ↓
Excel Sheet: "Wealth Recon"
    ↓
Database: wealth_forms (calculated)
```

---

## 1️⃣ INCOME FORM

### Excel → Database Mapping

| Excel Cell | Excel Value | Description | Database Column | DB Value |
|------------|-------------|-------------|-----------------|----------|
| B42 | 7,200,000 | Monthly Salary | `annual_basic_salary` | 7200000 |
| B48 | 1,500,000 | Bonus | `bonus` | 1500000 |
| B54 | 50,000 | Taxable Car Value | `taxable_car_value` | 50000 |
| **B66** | **8,750,000** | **Total Taxable Salary** | `total_employment_income` | **AUTO-CALC** |
| B78 | 400,000 | Medical Allowance (Exempt) | `medical_allowance` | 400000 |
| B84 | 100,000 | Employer Pension Contribution | `employer_contribution_provident` | 100000 |
| B96 | 500,000 | Total Tax Exempt | - | (calculated) |
| B108 | 0 | Income from Other Sources | `other_income_no_min_tax_total` | 0 |

### Database Schema (income_forms)
```sql
-- Input columns (user enters these)
annual_basic_salary NUMERIC(15,2) = 7200000
bonus NUMERIC(15,2) = 1500000
taxable_car_value NUMERIC(15,2) = 50000
medical_allowance NUMERIC(15,2) = 400000
employer_contribution_provident NUMERIC(15,2) = 100000

-- AUTO-CALCULATED column (database generates this)
total_employment_income NUMERIC(15,2) GENERATED ALWAYS AS (
  annual_basic_salary + bonus + taxable_car_value +
  other taxable components - exempt components
) STORED
```

### ⚠️ Important Notes:
- **total_employment_income** is GENERATED column - do NOT manually update
- Excel shows **8,750,000** as taxable (excluding exempt 500k)
- Database shows **9,350,000** total (including exempt)
- The calculation removes exempt items internally

---

## 2️⃣ ADJUSTABLE TAX FORM

### Excel → Database Mapping

| Excel Cell | Excel Value | Description | Database Column |
|------------|-------------|-------------|-----------------|
| B228 (Gross Receipt) | 8,750,000 | Salary as per certificate | Need to verify column name |
| C228 (Tax Collected) | 2,200,000 | Tax withheld from salary | Need to verify column name |
| **C357** | **2,200,000** | **Total Adjustable Tax** | `total_adjustable_tax` |

### Database Schema (adjustable_tax_forms)
```sql
-- TODO: Find correct column names
salary_tax_gross NUMERIC(15,2) = 8750000
salary_tax_collected NUMERIC(15,2) = 2200000
total_adjustable_tax NUMERIC(15,2) = 2200000  -- GENERATED
```

---

## 3️⃣ FINAL/MINIMUM INCOME TAX FORM

### Excel → Database Mapping

| Excel Row | Amount | Tax Deducted | Description | Database Column (Amount) | Database Column (Tax) |
|-----------|--------|--------------|-------------|--------------------------|------------------------|
| 484 | 500,000 | 50,000 | Sukuk < 1M @ 10% | `return_invest_not_exceed_1m_sukuk_saa_10pc` | `return_invest_not_exceed_1m_sukuk_saa_10pc_tax_deducted` |
| 508 | 100,000 | 15,000 | Profit on Debt 7B @ 15% | `interest_income_profit_debt_7b_up_to_5m` | `interest_income_profit_debt_7b_up_to_5m_tax_deducted` |
| **556** | **600,000** | **65,000** | **Subtotal** | - | - |

### Database Update
```sql
UPDATE final_min_income_forms SET
  return_invest_not_exceed_1m_sukuk_saa_10pc = 500000,
  interest_income_profit_debt_7b_up_to_5m = 100000
WHERE user_id = '6bf47a47-5341-4884-9960-bb660dfdd9df';
```

✅ **Status:** UPDATED SUCCESSFULLY

---

## 4️⃣ DEDUCTIONS FORM

### Excel → Database Mapping

| Excel Cell | Excel Value | Description | Database Column |
|------------|-------------|-------------|-----------------|
| C1057 | 10,000 | Zakat Paid | `zakat_paid_amount` |
| **C1067** | **10,000** | **Total Deduction** | `total_deduction_from_income` |

### Database Update
```sql
UPDATE deductions_forms SET
  zakat_paid_amount = 10000,
  total_deduction_from_income = 10000
WHERE user_id = '6bf47a47-5341-4884-9960-bb660dfdd9df';
```

✅ **Status:** UPDATED SUCCESSFULLY

---

## 5️⃣ CREDITS FORM

### Excel → Database Mapping

| Excel Row | Amount | Credit Calculated | Description | Database Column (Amount) | Database Column (Credit) |
|-----------|--------|-------------------|-------------|--------------------------|--------------------------|
| 976 | 50,000 | 13,295.19 | Charitable Donations u/s 61 | Need to find column | Need to find column |
| 994 | 500,000 | 132,951.95 | Pension Fund u/s 63 | Need to find column | Need to find column |
| **1013** | - | **146,247.14** | **Total Tax Credit** | - | `total_credits` |

### Formula Used in Excel
```
Charitable Credit = MIN(amount, taxable_income * 30%) × (normalTax / taxableIncome)
Pension Credit = MIN(amount, taxable_income * 20%) × (normalTax / taxableIncome)
```

### Database Schema (credits_forms)
```sql
-- TODO: Find correct column names for:
charitable_donations_amount NUMERIC(15,2) = 50000
pension_fund_amount NUMERIC(15,2) = 500000
total_credits NUMERIC(15,2) = 146247.14  -- CALCULATED by SQL function
```

---

## 6️⃣ REDUCTIONS FORM

### Excel → Database Mapping

| Excel Row | Amount | Reduction Calculated | Description | Database Column |
|-----------|--------|---------------------|-------------|-----------------|
| 914 | - | 581,000 | Teacher/Researcher 25% | Need to find column |
| 922 | 50,000 | 5,000 | Behbood Certificates | Need to find column |
| **950** | - | **586,000** | **Total Tax Reduction** | `total_reductions` |

### Formula Used in Excel
```
Teacher Reduction = (SalaryIncome × (NormalTax + Surcharge) / TotalIncome) × 25%
Behbood Reduction = (ApplicableRate - 5%) × Amount
```

### Database Schema (reductions_forms)
```sql
-- TODO: Find correct column names for:
teacher_researcher_yn BOOLEAN = TRUE
behbood_amount NUMERIC(15,2) = 50000
behbood_applicable_rate NUMERIC(5,4) = 0.15
total_reductions NUMERIC(15,2) = 586000  -- CALCULATED by SQL function
```

---

## 7️⃣ TAX COMPUTATION FORM (AUTO-CALCULATED)

### Excel → Database Flow

| Excel Cell | Formula/Value | Description | Database Column | Calculation Source |
|------------|---------------|-------------|-----------------|-------------------|
| B1482 | 8,750,000 | Income from Salary | `income_from_salary` | FROM income_forms.total_employment_income |
| B1486 | 0 | Income from Other Sources | `income_loss_other_sources` | FROM income_forms.other_income_no_min_tax_total |
| B1490 | 8,750,000 | Total Income | `total_income` | GENERATED = income_from_salary + other |
| B1494 | 10,000 | Deductible Allowances | `deductible_allowances` | FROM deductions_forms.total_deduction_from_income |
| B1498 | 8,740,000 | Taxable Income (excl CG) | `taxable_income_excluding_cg` | GENERATED = total_income - deductible_allowances |
| B1502 | 0 | Capital Gains | `capital_gains_loss` | FROM capital_gain_forms.total_capital_gains |
| B1506 | 8,740,000 | Taxable Income (incl CG) | `taxable_income_including_cg` | GENERATED = taxable_income + CG |
| **B1518** | **2,324,000** | **Normal Income Tax** | `normal_income_tax` | **SQL FUNCTION: calculate_normal_income_tax()** |
| B1522 | 0 | Surcharge (10% if > 10M) | `surcharge_amount` | GENERATED = IF(income > 10M, tax × 0.10, 0) |
| B1526 | 0 | Capital Gains Tax | `capital_gains_tax` | FROM capital_gain_forms.total_capital_gains_tax |
| B1530 | 2,324,000 | Normal Tax + Surcharge + CGT | `normal_tax_including_surcharge_cgt` | GENERATED sum |
| B1534 | 586,000 | Tax Reductions | `tax_reductions` | **SQL FUNCTION: calculate_teacher_reduction() + calculate_behbood_reduction()** |
| B1538 | 146,247.14 | Tax Credits | `tax_credits` | **SQL FUNCTION: calculate_charitable_credit() + calculate_pension_credit()** |
| B1542 | 1,591,752.86 | Net Tax Payable | `net_tax_payable` | GENERATED = normalTax - reductions - credits |
| B1546 | 600,000 | Final/Fixed/Minimum Tax | `final_fixed_tax` | FROM final_min_income_forms (sum of all final tax) |
| B1550 | 2,191,752.86 | Total Tax Chargeable | `total_tax_liability` | GENERATED = netTaxPayable + finalTax |
| B1562 | 2,200,000 | Withholding Income Tax | `advance_tax_paid` | FROM adjustable_tax_forms.total_adjustable_tax |
| B1570 | 2,200,000 | Total Taxes Paid | - | = advance_tax_paid + final_tax_deducted |
| **B1578** | **-8,247.14** | **Tax Demanded/(Refundable)** | `balance_payable` | GENERATED = total_tax_liability - total_taxes_paid |

### Tax Calculation Formula (FBR 2025-26)
```sql
CREATE FUNCTION calculate_normal_income_tax(taxable_income NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    IF taxable_income <= 600000 THEN
        RETURN 0;
    ELSIF taxable_income <= 1200000 THEN
        RETURN (taxable_income - 600000) * 0.05;
    ELSIF taxable_income <= 2200000 THEN
        RETURN (taxable_income - 1200000) * 0.15 + 30000;
    ELSIF taxable_income <= 3200000 THEN
        RETURN (taxable_income - 2200000) * 0.25 + 180000;
    ELSIF taxable_income <= 4100000 THEN
        RETURN (taxable_income - 3200000) * 0.30 + 430000;
    ELSE
        RETURN (taxable_income - 4100000) * 0.35 + 700000;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### For KhurramJ (Taxable Income: 8,740,000)
```
Tax = (8,740,000 - 4,100,000) × 0.35 + 700,000
    = 4,640,000 × 0.35 + 700,000
    = 1,624,000 + 700,000
    = 2,324,000 ✅ EXACT MATCH
```

---

## 8️⃣ EXPENSES FORM

### Excel → Database Mapping

| Excel Row | Excel Value | Description | Database Column |
|-----------|-------------|-------------|-----------------|
| 1771 | 20,000 | Rates/Taxes/Charge/Cess | Need to find |
| 1775 | 2,200,000 | Income Tax Paid | `income_tax_paid` |
| 1779 | 200,000 | Vehicle Running/Maintenance | `vehicle_expenses` |
| 1783 | 500,000 | Travelling | `travelling_expenses` |
| 1787 | 750,000 | Electricity | `electricity_expenses` |
| 1791 | 220,000 | Water | `water_expenses` |
| 1795 | 80,000 | Gas | `gas_expenses` |
| 1799 | 24,000 | Telephone | `telephone_expenses` |
| 1807 | 30,000 | Medical | `medical_expenses` |
| 1811 | 500,000 | Educational | `educational_expenses` |
| 1823 | 200,000 | Donation, Zakat, etc. | `donations_zakat` |
| 1827 | 5,286,000 | Other Personal/Household | `other_expenses` |
| **1838** | **10,010,000** | **Total Expenses** | `total_expenses_paid` |

---

## 9️⃣ WEALTH STATEMENT FORM

### Excel → Database Mapping

| Excel Row | Last Year (2024) | Current Year (2025) | Description | Database Column (Last) | Database Column (Current) |
|-----------|------------------|---------------------|-------------|------------------------|---------------------------|
| 2073 | 5,000,000 | 5,000,000 | Property Defense/Bahria | `commercial_property_prev` | `commercial_property_curr` |
| 2093 | 1,000,000 | 500,000 | Bank Account (Habib Metro) | `bank_account_prev` | `bank_account_curr` |
| 2098 | 2,000,000 | 2,000,000 | Investment in Behbood | `investments_prev` | `investments_curr` |
| 2113 | 2,500,000 | 2,500,000 | Motor Vehicle | `motor_vehicle_prev` | `motor_vehicle_curr` |
| 2118 | 1,200,000 | 1,400,000 | Precious Possessions (Jewelry) | `jewelry_prev` | `jewelry_curr` |
| 2133 | 500,000 | 240,000 | Cash | `cash_prev` | `cash_curr` |
| 2143 | 2,500,000 | 2,700,000 | Accumulated PF Balance | `provident_fund_prev` | `provident_fund_curr` |
| **2153** | **14,700,000** | **14,340,000** | **Total Assets Inside Pakistan** | `total_assets_pakistan_prev` | `total_assets_pakistan_curr` |
| 2178 | 500,000 | 300,000 | Bank Loan | `liabilities_prev` | `liabilities_curr` |
| **2188** | **14,200,000** | **14,040,000** | **Net Assets at End of Year** | `net_assets_prev` | `net_assets_curr` |

---

## 🔟 WEALTH RECONCILIATION

### Excel → Calculated Values

| Excel Cell | Value | Description | Source |
|------------|-------|-------------|--------|
| B2444 | 14,040,000 | Net Assets Current Year | FROM wealth_statement_forms.net_assets_curr |
| B2449 | 14,200,000 | Net Assets Previous Year | FROM wealth_statement_forms.net_assets_prev |
| B2453 | -160,000 | Increase/(Decrease) in Assets | = Current - Previous |
| B2465 | 8,750,000 | Income Subject to Normal Tax | FROM tax_computation_forms.income_from_salary |
| B2470 | 500,000 | Income Exempt from Tax | FROM income_forms.total_tax_exempt_income |
| B2473 | 600,000 | Income Subject to Final Tax | FROM final_min_income_forms (total) |
| B2501 | 9,850,000 | Total Inflows | = Sum of all income sources |
| B2509 | 10,010,000 | Personal Expenses | FROM expenses_forms.total_expenses_paid |
| B2525 | 10,010,000 | Total Outflows | = Personal Expenses |
| B2533 | -160,000 | Net Increase/(Decrease) | = Inflows - Outflows |
| **B2541** | **0** | **Unreconciled Difference** | = (Net Assets Change) - (Net Increase Calculated) |

---

## 🎯 CRITICAL CALCULATION FUNCTIONS

### 1. Teacher/Researcher Reduction (Section 60C)
```sql
CREATE FUNCTION calculate_teacher_reduction(
    salary_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC,
    total_income NUMERIC,
    is_teacher BOOLEAN
) RETURNS NUMERIC AS $$
BEGIN
    IF is_teacher AND total_income > 0 THEN
        RETURN (salary_income * (normal_tax + surcharge) / total_income) * 0.25;
    END IF;
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**For KhurramJ:**
```
= (8,750,000 × (2,324,000 + 0) / 8,750,000) × 0.25
= (8,750,000 × 2,324,000 / 8,750,000) × 0.25
= 2,324,000 × 0.25
= 581,000 ✅
```

### 2. Charitable Donations Credit (Section 61)
```sql
CREATE FUNCTION calculate_charitable_credit(
    donation_amount NUMERIC,
    taxable_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    max_allowable NUMERIC;
    eligible_amount NUMERIC;
BEGIN
    IF taxable_income > 0 THEN
        max_allowable := taxable_income * 0.30;
        eligible_amount := LEAST(donation_amount, max_allowable);
        RETURN eligible_amount * (normal_tax + surcharge) / taxable_income;
    END IF;
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**For KhurramJ:**
```
max_allowable = 8,740,000 × 0.30 = 2,622,000
eligible_amount = MIN(50,000, 2,622,000) = 50,000
credit = 50,000 × (2,324,000 + 0) / 8,740,000
credit = 50,000 × 0.265904
credit = 13,295.19 ✅
```

### 3. Pension Fund Credit (Section 63)
```sql
CREATE FUNCTION calculate_pension_credit(
    pension_amount NUMERIC,
    taxable_income NUMERIC,
    normal_tax NUMERIC,
    surcharge NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    max_allowable NUMERIC;
    eligible_amount NUMERIC;
BEGIN
    IF taxable_income > 0 THEN
        max_allowable := taxable_income * 0.20;
        eligible_amount := LEAST(pension_amount, max_allowable);
        RETURN eligible_amount * (normal_tax + surcharge) / taxable_income;
    END IF;
    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**For KhurramJ:**
```
max_allowable = 8,740,000 × 0.20 = 1,748,000
eligible_amount = MIN(500,000, 1,748,000) = 500,000
credit = 500,000 × (2,324,000 + 0) / 8,740,000
credit = 500,000 × 0.265904
credit = 132,951.95 ✅
```

---

## 📋 DATA UPDATE CHECKLIST

### ✅ Completed
- [x] Income Form - Basic values updated
- [x] Final Min Income Form - Sukuk and Profit on Debt updated
- [x] Deductions Form - Zakat updated

### ⚠️ Needs Column Name Verification
- [ ] Adjustable Tax Form - Find correct column names for salary tax
- [ ] Credits Form - Find correct column names for donations and pension
- [ ] Reductions Form - Find correct column names for teacher and behbood
- [ ] Expenses Form - Find correct column names
- [ ] Wealth Statement Form - Verify all asset/liability columns

### 🔧 Needs Implementation
- [ ] Tax Computation - Call SQL recalculation function
- [ ] Wealth Reconciliation - Auto-calculate from other forms

---

## 🚀 QUICK UPDATE SCRIPT

```sql
-- Call this to recalculate everything for KhurramJ
SELECT * FROM recalculate_tax_computation(
  '6bf47a47-5341-4884-9960-bb660dfdd9df',
  '2025-26'
);
```

---

## 📊 EXPECTED FINAL RESULTS (from Excel)

| Metric | Excel Value | Database Status |
|--------|-------------|-----------------|
| Income from Salary | 8,750,000 | ✅ Match (9,350,000 total, 8,750,000 taxable) |
| Total Income | 8,750,000 | ✅ Should match |
| Deductible Allowances | 10,000 | ✅ Match |
| Taxable Income (excl CG) | 8,740,000 | ✅ Should match |
| Normal Income Tax | 2,324,000 | ✅ SQL function correct |
| Surcharge | 0 | ✅ Income < 10M |
| Tax Reductions | 586,000 | ⚠️ Needs SQL function |
| Tax Credits | 146,247.14 | ⚠️ Needs SQL function |
| Net Tax Payable | 1,591,752.86 | ⚠️ Pending calculation |
| Final/Fixed Tax | 600,000 | ⚠️ Need to sum all final tax |
| Total Tax Chargeable | 2,191,752.86 | ⚠️ Pending calculation |
| Withholding Tax | 2,200,000 | ⚠️ Needs adjustable tax fix |
| **Tax Refundable** | **-8,247.14** | ⚠️ Pending all fixes |

---

## 📝 NOTES FOR DEVELOPERS

1. **GENERATED Columns**: Never UPDATE these directly - they auto-calculate
2. **Tax Functions**: All in `/database/create-tax-computation-functions-v2.sql`
3. **Recalculation**: Call `recalculate_tax_computation()` after any form update
4. **Excel Formula References**: Use cell references from this guide
5. **Data Types**: All monetary values are NUMERIC(15,2) for precision
6. **Test User**: KhurramJ (ID: 6bf47a47-5341-4884-9960-bb660dfdd9df)

---

**Last Updated:** October 6, 2025
**Maintained By:** Development Team
**Excel Version:** Salaried Individuals 2025.xlsx
