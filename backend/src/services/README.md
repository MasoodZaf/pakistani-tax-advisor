# Services - Excel Compliance Implementation

## Overview
This directory contains services that implement Excel compliance with "Salaried Individuals 2025.xlsx".

## Key Services

### `excelService.js` ✅ UPDATED
- **Purpose**: Excel import/export with perfect field mapping
- **Status**: Excel compliant
- **Features**:
  - Correct sheet names matching Excel template
  - Perfect field labels matching Excel exactly
  - Excel cell references (B6, B7, etc.)
  - Automatic field validation

### `taxCalculationService.js` ✅ NEW
- **Purpose**: Inter-form data linking (replicates Excel sheet references)
- **Status**: Fully functional
- **Features**:
  - Automatic data linking between forms
  - Excel sheet reference replication (=Income!B16, etc.)
  - Complete tax computation
  - Progressive tax calculation
  - Tax summary generation

### `calculationService.js` 
- **Purpose**: Excel formula calculations
- **Status**: Enhanced with Excel compliance
- **Note**: Works with taxCalculationService for complete Excel replication

## Excel Sheet References Implemented

### Income → Adjustable Tax Linking
- `Adjustable Tax B5 = Income!B16` (Salary)
- `Adjustable Tax B6 = Income!B13` (Directorship Fee)
- `Adjustable Tax B7 = Income!B26` (Profit on Debt 15%)
- `Adjustable Tax B8 = Income!B27` (Profit on Debt 12.5%)
- `Adjustable Tax B9 = Income!B31` (Rent Income)

### Tax Computation Linking
- Links data from all forms automatically
- Calculates progressive tax
- Handles surcharge calculation
- Provides complete tax summary

## Usage Examples

### Get Income Data with Excel References
```javascript
const incomeData = await TaxCalculationService.getIncomeFormData(userId, taxYear);
// Returns data with Excel cell references (b15_income_exempt_from_tax, b16_annual_salary_wages_total, etc.)
```

### Get Linked Adjustable Tax Data
```javascript
const adjustableData = await TaxCalculationService.getAdjustableFormData(userId, taxYear);
// Automatically links to Income sheet data like Excel
```

### Calculate Complete Tax Computation
```javascript
const computation = await TaxCalculationService.calculateTaxComputation(userId, taxYear);
// Provides complete tax calculation linking all forms
```

## Testing
All services have been tested and verified to work exactly like Excel sheet references.