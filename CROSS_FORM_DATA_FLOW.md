# Cross-Form Data Flow Map
## Pakistan Tax App — Salaried Individuals 2025-26
### Based on Official FBR Excel Template Analysis

---

## Overview

Fields marked **[AUTO]** are auto-populated from another form and are **read-only** in the UI.
Fields marked **[CALC]** are computed within the form itself and are read-only.
All other fields are user-editable.

---

## 1. Adjustable Tax ← Income Form

| Adjustable Tax Field | Source (Income Form Field) | Excel Ref |
|---|---|---|
| `salary_employees_149_gross_receipt` **[AUTO]** | `annual_salary_wages_total` | `B5 = Income!B16` |
| `directorship_fee_149_3_gross_receipt` **[AUTO]** | `directorship_fee` | `B6 = Income!B13` |
| `profit_debt_151_15_gross_receipt` **[AUTO]** | `profit_on_debt_15_percent` | `B7 = Income!B26` |
| `profit_debt_sukook_151a_gross_receipt` **[AUTO]** | `profit_on_debt_12_5_percent` | `B8 = Income!B27` |
| `tax_deducted_rent_section_155_gross_receipt` **[AUTO]** | `other_taxable_income_rent` | `B9 = Income!B31` |

**Status:** ✅ Implemented — auto-fetched via `useEffect` in `AdjustableTaxForm.js`, rendered read-only when value > 0.

---

## 2. Final/Min Income Form ← Capital Gain Form

| Final/Min Income Field | Source (Capital Gain Form Field) | Excel Ref |
|---|---|---|
| `capital_gain` **[AUTO]** | `total_capital_gain` | `B19 = 'Capital Gain'!E19` |
| `capital_gain_tax_deducted` **[AUTO]** | `total_tax_deducted` | `C19 = 'Capital Gain'!F19` |
| `capital_gain_tax_chargeable` **[CALC]** | `capital_gains_tax_chargeable` | `D19 = 'Capital Gain'!G19` |

**Status:** ✅ Implemented — auto-fetched via `useEffect` in `FinalMinIncomeForm.js`, all three Capital Gain row fields are read-only.

> **Note (2026-05-17):** Source column names corrected to match live DB. Previously
> the doc listed `total_capital_gain_amount` / `total_capital_gain_tax_deducted` /
> `total_capital_gain_tax_chargeable` — these don't exist; the consumer code
> reads `total_capital_gain`, `total_tax_deducted`, `capital_gains_tax_chargeable`.

### Saved totals from CapitalGainsForm
The Capital Gain form saves these aggregate fields on submit:
- `total_capital_gain` — Postgres-generated sum of all `*_taxable` fields
- `total_tax_deducted`  — Postgres-generated sum of all `*_deducted` fields
- `capital_gains_tax_chargeable` — user-editable aggregate (saved directly)

### Grand Total saved from FinalMinIncomeForm
- `grand_total_tax_chargeable` — `subtotal + capital_gain_tax_chargeable` (saved on submit)

---

## 3. Tax Computation ← Multiple Forms

| Tax Computation Field | Source | Excel Ref |
|---|---|---|
| `income_from_salary` **[AUTO]** | `income.total_gross_income` | `B6 = Income!B16 + Income!B23` |
| `deductible_allowances` **[AUTO]** | `deductions.total_deduction_from_income` | `B10 = 'Tax Reduction...'!C22` |
| `capital_gains_loss` **[AUTO]** | `capital_gain.total_capital_gain` | `B12 = 'Capital Gain'!E19` |
| `capital_gain_tax` **[CALC]** | Computed from CGT rates | `B18 = 'Capital Gain'!G19` |
| `final_min_tax` **[AUTO]** | `final_min_income.grand_total_tax_chargeable` | `B23 = 'Income with Final Min tax'!D20` |
| `withholding_income_tax` **[AUTO]** | `adjustable_tax.total_adjustable_tax` | `B28 = 'Adjustable Tax'!C32 + 'Income with Final Min tax'!C20` |
| `tax_reductions` **[AUTO]** | `reductions.total_tax_reduction` | From Reductions form |
| `tax_credits` **[AUTO]** | `credits.total_tax_credits` | From Credits form |

**Status:** ✅ Implemented — `TaxComputationSummary.js` computes all values from `formData` context. Fixed wrong key names (`capitalGain` → `capital_gain`, `finalMinIncome` → `final_min_income`, `adjustableTax` → `adjustable_tax`).

**Tax Slabs (2025-26):** ✅ Fixed to use correct Finance Act 2025 rates.

---

## 4. Wealth Reconciliation ← Wealth Statement, Income, Expenses

| Wealth Recon Field | Source | Excel Ref |
|---|---|---|
| Net assets current year | `wealth_statement.net_assets_current_year` | `B5 = 'Wealth Statement'!C30` |
| Normal taxable income | `income.total_gross_income - income.total_exempt_income` | `B10 = Income!B16 - Income!B15` |
| Personal expenses | `expenses.total_personal_expenses` | `B23 = 'Detail of Expenses'!B25` |

**Status:** ✅ Implemented — `WealthReconciliationForm.js` auto-syncs `personal_expenses`
from `expenses.total_expenses`, and recomputes the full reconciliation pulling
`wealth.net_worth_current_year/previous_year`, `income.total_employment_income`,
and `final_tax.total_final_tax`. Read-only display via `readOnlyClasses`. (Spec
previously marked this "not yet implemented" — corrected 2026-05-17.)

---

## 5. Expenses ← Tax Computation

| Expenses Field | Source | Excel Ref |
|---|---|---|
| Income tax paid | `tax_computation.income_tax_demanded_refundable` | From Tax Computation |

**Status:** ⚠️ Not yet implemented — circular dependency (Tax Computation reads Expenses, Expenses reads Tax Computation). Handle by computing Tax Computation first, then Expenses uses previous year's paid tax.

---

## Implementation Notes

### Form Fill Order (recommended)
1. **Income** → fills auto-fields in Adjustable Tax
2. **Capital Gains** → fills auto-fields in Final/Min Income
3. **Final/Min Income** → fills final min tax in Tax Computation
4. **Adjustable Tax** → fills withholding tax in Tax Computation
5. **Reductions / Credits / Deductions**
6. **Wealth Statement** → fills Wealth Reconciliation
7. **Expenses** → fills personal expenses in Wealth Reconciliation
8. **Tax Computation** — computed from all above

### Auto-population Trigger
All auto-population runs via React `useEffect` watching `formData` from `TaxFormContext`.
`formData` is loaded from the database when the user authenticates (`loadTaxReturn`).
When a user saves a form, the context's `formData` updates, which triggers auto-population
in any currently-mounted form that depends on it.

### Read-only Styling
Auto-populated fields use `readOnlyInputClasses`:
```
w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-right text-sm font-semibold text-gray-700
```
This gives them a visually distinct grey background vs editable white fields.
