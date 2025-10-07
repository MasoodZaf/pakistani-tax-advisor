# Pakistani Tax Advisor - Excel Calculation Methods & Data Flow Documentation

## Overview
This document analyzes the calculation methods, formulas, and data flow from the "Salaried Individuals 2025.xlsx" file to help optimize our Pakistani Tax Advisor application.

## Sheets Structure & Data Flow

### 1. Taxpayer Profile Sheet
**Purpose**: Basic taxpayer information
**Key Fields**:
- Name, NIC, Email, Mobile Phone, Major Source of Income
- **No calculations** - Pure input data

---

### 2. Income Sheet
**Purpose**: Calculate total income subject to normal taxation

#### Key Calculations:
```
Annual Basic Salary = B6: 600000*12 = 7,200,000
Annual Allowances = B7: 500000*12 = 6,000,000
Income Exempt from Tax = B15: -B12-B11-B9 = -7,720,000
Annual Salary and Wages = B16: SUM(B6:B15) = 16,340,000
```

#### Data Flow:
- **Inputs**: Monthly salary components (converted to annual)
- **Calculations**:
  - Exemptions: Medical allowance + Termination payment + Retirement funds
  - Total annual salary after exemptions
- **Outputs**:
  - `Income!B16` → Used in Adjustable Tax sheet
  - `Income!B23` → Used in Tax Computation sheet
  - `Income!B13` → Used in Adjustable Tax (Directorship Fee)

---

### 3. Adjustable Tax Sheet
**Purpose**: Calculate withholding tax collected during the year

#### Key Calculations:
```
Salary Withholding = B5: Income!B16 = 16,340,000
Directorship Fee = B6: Income!B13 = 40,000
Directorship Tax = C6: B6*20% = 8,000
Profit on Debt Tax = C7: B7*15% = 105,000
Sukook Tax = C8: B8*12.5% = 187,500
```

#### Data Flow:
- **Inputs**: Links to Income sheet values
- **Calculations**: Apply withholding tax rates
- **Outputs**:
  - `C32` → Total tax collected (used in Tax Computation)

---

### 4. Income with Final/Minimum Tax Sheet
**Purpose**: Handle income subject to final/fixed taxation rates

#### Key Calculations:
```
Dividend Tax (REIT) = D3: B3*0% = 0
Dividend Tax (SPV) = D4: B4*35% = 280,000
Dividend Tax (IPP) = D5: B5*7.5% = 3,750
Profit on Debt Tax = D13: B13*15% = 750,000
Capital Gain = B19: 'Capital Gain'!E19 = 1,500,000
```

#### Data Flow:
- **Inputs**: Various income types with different tax rates
- **Calculations**: Apply final tax rates based on income type
- **Outputs**:
  - `D20` → Total final tax (used in Tax Computation)
  - `B20` → Total income subject to final tax

---

### 5. Capital Gain Sheet
**Purpose**: Calculate capital gains tax on property and securities

#### Key Calculations:
```
Property CG (2-3 years) = G6: (B6*10%)+(C6*7.5%)+(D6*0%) = 50,000
Securities CG (12.5%) = G17: E17*12.5% = 125,000
Total Capital Gain = E19: SUM(calculated gains) = 1,500,000
```

#### Tax Rates by Holding Period:
- **Property**:
  - <1 year: 15%
  - 1-2 years: 12.5% (plot), 10% (constructed), 7.5% (flat)
  - 2-3 years: 10% (plot), 7.5% (constructed), 0% (flat)
  - 3-4 years: 7.5% (plot), 5% (constructed), 0% (flat)
  - >6 years: 0%

- **Securities**: Various rates from 0% to 25% based on type and acquisition date

---

### 6. Tax Computation Sheet
**Purpose**: Calculate final tax liability

#### Core Tax Calculation:
```javascript
// Normal Tax Calculation (Progressive Rates)
if (taxableIncome > 600,000 && taxableIncome <= 1,200,000) {
    tax += (taxableIncome - 600,000) * 5%
}
if (taxableIncome > 1,200,000 && taxableIncome <= 2,200,000) {
    tax += (taxableIncome - 1,200,000) * 15% + 30,000
}
if (taxableIncome > 2,200,000 && taxableIncome <= 3,200,000) {
    tax += (taxableIncome - 2,200,000) * 25% + 180,000
}
if (taxableIncome > 3,200,000 && taxableIncome <= 4,100,000) {
    tax += (taxableIncome - 3,200,000) * 30% + 430,000
}
if (taxableIncome > 4,100,000) {
    tax += (taxableIncome - 4,100,000) * 35% + 700,000
}
```

#### Key Calculations:
```
Total Income = B9: SUM(salary + other sources) = 21,560,000
Taxable Income = B11: Total Income - Deductible Allowances = 21,485,000
Normal Tax = B16: Progressive tax calculation = 6,784,750
Surcharge = B17: IF(income>10m, normalTax*10%, 0) = 678,475
Total Tax Payable = B19: Normal Tax + Surcharge + CGT = 7,638,225
```

#### Data Flow:
- **Inputs**:
  - Income sheet totals
  - Capital gains
  - Deductible allowances
- **Calculations**: Progressive tax rates + surcharge
- **Outputs**: Final tax liability

---

### 7. Tax Reduction, Credit & Deductible Allowances Sheet
**Purpose**: Calculate tax reductions and credits

#### Key Calculations:
```
Teacher Tax Reduction = D5: (Salary portion of tax) * 25%
Charity Tax Credit = D12: MIN(donation, 30% of taxable income) * (tax rate)
Pension Fund Credit = D14: MIN(contribution, 20% of taxable income) * (tax rate)
```

#### Data Flow:
- **Inputs**:
  - Donation amounts
  - Pension contributions
  - Investment details
- **Calculations**: Apply percentage limits and tax rates
- **Outputs**:
  - `D9` → Total tax reductions
  - `D16` → Total tax credits

---

### 8. Detail of Expenses Sheet
**Purpose**: Track personal expenses for wealth reconciliation

#### Key Calculations:
```
Tax Paid = B9: 'Tax Computation'!B28 = 6,772,250
Balancing Figure = B22: Computed to balance wealth equation
Total Expenses = B23: SUM(all expenses) = 39,550,000
```

---

### 9. Wealth Statement Sheet
**Purpose**: Track assets and liabilities

#### Key Calculations:
```
Property Value = C7: Carried forward from previous year
Investment Growth = C21: Previous + (Income * multiplier)
Total Assets = C23: SUM(all asset categories)
Net Worth = C30: Total Assets - Total Liabilities
```

---

### 10. Wealth Reconciliation Sheet
**Purpose**: Reconcile income with wealth changes

#### Key Calculations:
```
Wealth Increase = B7: Current Year Net Worth - Previous Year = 12,080,000
Total Inflows = B21: All income sources = 51,630,000
Total Outflows = B27: All expenses = 39,550,000
Net Change = B29: Inflows - Outflows = 12,080,000
Unexplained = B31: Wealth Increase - Net Change = 0 (should be zero)
```

## Critical Data Relationships

### Primary Data Flow:
```
Taxpayer Profile → Income Sheet → Adjustable Tax Sheet ↘
                                                      ↘
Capital Gain Sheet → Income with Final Tax Sheet ----→ Tax Computation Sheet
                                                      ↗
Tax Reductions & Credits ←---------------------------↗

Tax Computation → Detail of Expenses → Wealth Statement → Wealth Reconciliation
```

### Key Formula Dependencies:

1. **Income to Adjustable Tax**:
   - `Adjustable Tax!B5` = `Income!B16` (Salary)
   - `Adjustable Tax!B6` = `Income!B13` (Directorship)

2. **Tax Computation Dependencies**:
   - `Tax Computation!B6` = `Income!B16` + `Income!B23`
   - `Tax Computation!B12` = `Capital Gain!E19`
   - `Tax Computation!B20` = `Tax Reduction!D9`

3. **Wealth Reconciliation**:
   - `Wealth Recon!B5` = `Wealth Statement!C30`
   - `Wealth Recon!B23` = `Detail of Expenses!B25`

## Application Implementation Guidelines

### Database Schema Considerations:

1. **Separate tables for each major calculation area**:
   - `income_forms` (Income sheet data)
   - `adjustable_tax_forms` (Withholding tax data)
   - `capital_gains_forms` (Capital gains data)
   - `tax_reductions_credits` (Reductions and credits)
   - `wealth_statements` (Asset tracking)

2. **Calculated fields should be computed in real-time**:
   - Tax liability calculations
   - Wealth reconciliation
   - Progressive tax computations

### Frontend Implementation:

1. **Form Validation**:
   - Ensure wealth reconciliation balances (difference = 0)
   - Validate tax calculations match expected ranges
   - Cross-validate linked fields between sheets

2. **Real-time Calculations**:
   - Implement progressive tax calculation function
   - Auto-calculate withholding taxes based on rates
   - Update dependent fields when source values change

3. **Data Persistence**:
   - Save intermediate calculations for audit trail
   - Maintain version history of tax computations
   - Store both input values and calculated results

### Tax Rates Configuration:

1. **Maintain separate configuration for**:
   - Progressive income tax slabs
   - Withholding tax rates by category
   - Capital gains tax rates by holding period
   - Final tax rates by income type

2. **Year-specific rate tables** for historical accuracy

### Error Handling:

1. **Validation Rules**:
   - Wealth reconciliation must balance
   - Tax calculations within reasonable bounds
   - Required fields for each income type
   - Date validations for holding periods

2. **Business Rules**:
   - Surcharge only applies to income > 10M
   - Teacher reduction only for eligible professions
   - Capital gains rates based on holding period

This documentation provides the foundation for implementing accurate tax calculations in the Pakistani Tax Advisor application, ensuring all Excel formulas and data relationships are properly replicated in the digital system.