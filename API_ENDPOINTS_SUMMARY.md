# Tax Advisor API Endpoints Summary

## Form API Endpoints (All Fixed - October 1, 2025)

All forms now have complete GET and POST endpoints that fetch from and save to the database.

### Base URL: `/api/tax-forms`

| Form Type | GET Endpoint | POST Endpoint | Database Table |
|-----------|-------------|---------------|----------------|
| **Current Return** | `GET /current-return` | - | Multiple tables (loads all forms) |
| **Income Form** | Already exists at `/api/income-form/*` | Already exists | `income_forms` |
| **Adjustable Tax** | `GET /adjustable-tax?taxYear=2025-26` | `POST /adjustable-tax` | `adjustable_tax_forms` |
| **Capital Gains** | `GET /capital-gains?taxYear=2025-26` | `POST /capital-gains` | `capital_gain_forms` |
| **Final/Min Income** | `GET /final-min-income?taxYear=2025-26` | `POST /final-min-income` | `final_min_income_forms` |
| **Reductions** | `GET /reductions?taxYear=2025-26` | `POST /reductions` | `reductions_forms` |
| **Credits** | `GET /credits?taxYear=2025-26` | `POST /credits` | `credits_forms` |
| **Deductions** | `GET /deductions?taxYear=2025-26` | `POST /deductions` | `deductions_forms` |
| **Final Tax** | `GET /final-tax?taxYear=2025-26` | `POST /final-tax` | `final_tax_forms` |
| **Expenses** | `GET /expenses?taxYear=2025-26` | `POST /expenses` | `expenses_forms` |

### Wealth Statement Module: `/api/wealth-statement`

| Form Type | GET Endpoint | POST Endpoint | Database Table |
|-----------|-------------|---------------|----------------|
| **Wealth Statement** | `GET /:taxYear` | `POST /:taxYear` | `wealth_statement_forms` |
| **Wealth Reconciliation** | Included in current-return | - | `wealth_reconciliation_forms` |

## Current Return Endpoint

**Endpoint:** `GET /api/tax-forms/current-return`

**Authentication:** Required (Bearer token)

**Response Structure:**
```json
{
  "taxReturn": {
    "id": "user-tax-year",
    "user_id": "uuid",
    "tax_year": "2025-26",
    "status": "in_progress"
  },
  "formData": {
    "income": { /* income form data */ },
    "adjustable_tax": { /* adjustable tax data */ },
    "capital_gain": { /* capital gains data */ },
    "final_min_income": { /* final/min income data */ },
    "reductions": { /* reductions data */ },
    "credits": { /* credits data */ },
    "deductions": { /* deductions data */ },
    "final_tax": { /* final tax data */ },
    "expenses": { /* expenses data */ },
    "wealth": { /* wealth statement data */ },
    "wealth_reconciliation": { /* wealth reconciliation data */ }
  },
  "completedSteps": ["income", "adjustable_tax", "wealth", ...]
}
```

## Changes Made

1. **Updated `/api/tax-forms/current-return`** - Now fetches ALL form data from database
2. **Added GET/POST endpoints** for:
   - Capital Gains
   - Final/Min Income  
   - Reductions
   - Credits
   - Deductions
   - Final Tax
   - Expenses
3. **Created generic `saveFormData` helper** - DRY approach for saving all forms
4. **All forms properly linked** to `tax_returns` table via `tax_return_id`

## Frontend Integration

The `TaxFormContext` automatically loads all form data via the `current-return` endpoint when user logs in. Each form component can access its data via:

```javascript
const { getStepData } = useTaxForm();
const formData = getStepData('adjustable_tax'); // or 'capital_gain', 'reductions', etc.
```

## Testing

All endpoints require authentication. Test with:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/tax-forms/adjustable-tax?taxYear=2025-26
```

