# Database Schema - Excel Compliance

## Overview
This directory contains database schema files for Excel compliance with "Salaried Individuals 2025.xlsx".

## Important Files

### `create-income-forms-clean.sql`
- **Purpose**: Creates income_forms table with Excel formula compliance
- **Status**: ✅ ACTIVE - Used for production
- **Features**: 
  - All Excel formulas (B15, B16, B22, B23, B28, B33) as generated columns
  - Perfect field mapping to Excel cells
  - Automatic calculations like Excel

### Schema Files
- Only production-ready files are kept
- All temporary "fix" files have been removed for cleaner project structure

## Excel Formula Implementation

The database now automatically calculates these Excel formulas:

| Excel Cell | Formula | Database Column | Status |
|------------|---------|-----------------|---------|
| B15 | `-(B12+B11+B9)` | `income_exempt_from_tax` | ✅ Working |
| B16 | `SUM(B6:B15)` | `annual_salary_wages_total` | ✅ Working |
| B22 | `-(MIN(B19,150000))` | `non_cash_benefit_exempt` | ✅ Working |
| B23 | `SUM(B19:B22)` | `total_non_cash_benefits` | ✅ Working |
| B28 | `B26+B27` | `other_income_min_tax_total` | ✅ Working |
| B33 | `B31+B32` | `other_income_no_min_tax_total` | ✅ Working |

## Usage

To apply the Excel-compliant schema:

```bash
# Apply the clean income forms table
psql -h localhost -U postgres -d tax_advisor -f create-income-forms-clean.sql
```

## Testing

All Excel formulas have been tested and verified to match expected values from "Salaried Individuals 2025.xlsx".

## Notes

- Generated columns update automatically when input data changes
- All calculations match Excel formulas exactly
- Performance optimized with appropriate indexes
- Foreign key constraints handled properly