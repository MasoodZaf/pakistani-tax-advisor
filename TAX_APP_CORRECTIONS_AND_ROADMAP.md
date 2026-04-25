# Pakistan Tax App — Corrections Log & Development Roadmap

> **Last Updated:** 2026-04-12 (ALL issues #1–39 resolved including super tax u/s 4C; all 5 phases complete; 6 DB migrations pending)
> **Tax Year in Scope:** TY 2025-26 (Finance Act 2025)
> **Applicable Law:** Income Tax Ordinance 2001 as amended by Finance Act 2025

---

## Table of Contents

1. [Baseline Audit Findings](#1-baseline-audit-findings)
2. [Phase 1 — Critical Bug Fixes (COMPLETED)](#2-phase-1--critical-bug-fixes-completed)
3. [Phase 2 — Inter-Form Data Flow Fixes (COMPLETED)](#3-phase-2--inter-form-data-flow-fixes-completed)
4. [Phase 3 — Excel Field Gap Closure (COMPLETED)](#4-phase-3--excel-field-gap-closure-completed)
5. [Phase 4 — FBR Compliance (COMPLETED)](#5-phase-4--fbr-compliance-completed)
6. [Phase 5 — Previous Year Upload Feature (COMPLETED)](#6-phase-5--previous-year-upload-feature-completed)
7. [Finance Act 2025 — Reference Rate Table](#7-finance-act-2025--reference-rate-table)
8. [Key File Map](#8-key-file-map)
9. [Data Flow Between Forms](#9-data-flow-between-forms)

---

## 1. Baseline Audit Findings

### 1.1 Navigation Bugs (Fixed Session 1)

All `navigate('/tax-forms/...')` calls across 9 components were pointing to the wrong path prefix (`/tax-forms/` instead of `/income-tax/` or `/wealth-statement/`). This caused the TaxFormsFlow router to catch unknown paths and redirect to overview, making Capital Gains and several other forms unreachable via navigation buttons.

**Files fixed:** AdjustableTaxForm, CreditsForm, DeductionsForm, FinalMinIncomeForm, FinalTaxForm, IncomeForm, ReductionsForm, CapitalGainForm, TaxComputationSummary.

### 1.2 FinalMinIncomeForm Anomalies Found

When entering data, the following bugs were observed:
- REIT SPV @0% showing Rs 50,000 tax when Amount = 0
- @35% SPV showing Rs 280,000 tax when Amount = 0
- Salary Tax Deducted showing stale/wrong value (Rs 3,365 for Rs 16.34M salary)

**Root cause:** Auto-calc `useEffect` had no `else` branch to zero-out tax when amount becomes 0. Three separate guards (`!parseFloat()`, `=== 0`) prevented salary tax from ever recalculating after initial load.

### 1.3 Wrong Tax Slabs Throughout

The app was using TY 2024-25 slabs (5%/15%/25%/30%/35% with wrong fixed portions) in both `TaxComputationSummary.js` and `calculationService.js`. Finance Act 2025 significantly changed the slab rates.

### 1.4 Surcharge Rate Wrong

Both frontend and backend used 10% surcharge. Finance Act 2025 specifies **9%** for salaried individuals with income > Rs 10M.

### 1.5 capital_gain vs capital_gains Key Mismatch

`GET /api/tax-forms/current-return` returned capital gain data under key `capital_gains` (plural) but all consumer code (`FinalMinIncomeForm`, `TaxComputationSummary`, `TaxFormContext`) read it as `capital_gain` (singular). Capital gain data was never available on initial page load — only after an explicit save of that form.

### 1.6 Other Issues Found

- Sukuk section in FinalMinIncomeForm had 5 rows vs Excel's 3 (extra rows removed)
- Bonus Shares rate was `u/s 236F @0%` — should be `u/s 236Z @10%`
- Profit on Debt u/s 7B: 15% → 20% (Finance Act 2025 change)
- `total_credits` (DB-computed column) was being shadowed by `total_tax_credits` (plain field) in TaxComputationSummary — reading wrong field
- `refund_adjustment` was hardcoded to 0, not editable
- Employment Termination Benefits row existed in form but not in Excel — removed

---

## 2. Phase 1 — Critical Bug Fixes (COMPLETED)

**Status: DONE** — Completed 2026-04-11

### 2.1 FinalMinIncomeForm Auto-Calc Fix

**File:** `Frontend/src/modules/IncomeTax/components/FinalMinIncomeForm.js`

**Change:** Auto-calc `useEffect` rewritten to always clear stale tax data when amount becomes 0:

```javascript
useEffect(() => {
  fieldDefinitions.forEach(section => {
    section.fields.forEach(field => {
      if (field.autoPopulateAmount || field.slabCalculatedTaxDeducted) return;
      if (field.taxRate === null) return;
      const amount = parseFloat(watchedValues[field.amountField]) || 0;
      const calculatedTax = (field.taxRate > 0 && amount > 0)
        ? Math.round(amount * field.taxRate)
        : 0;
      if (Math.abs((parseFloat(watchedValues[field.taxChargeableField]) || 0) - calculatedTax) > 0.01)
        setValue(field.taxChargeableField, calculatedTax);
      if (Math.abs((parseFloat(watchedValues[field.taxDeductedField]) || 0) - calculatedTax) > 0.01)
        setValue(field.taxDeductedField, calculatedTax);
    });
  });
}, [watchedValues, setValue]);
```

**Change:** Removed all three guards that prevented salary tax from recalculating:
- Removed `if (!parseFloat(data.salary_amount))` in `loadFromAPI`
- Removed `if (!parseFloat(savedData.salary_amount))` in context sync effect
- Removed `if (currentTaxDeducted === 0)` in auto-populate effect

### 2.2 Salary Tax Slab Calculator — Finance Act 2025

**File:** `Frontend/src/modules/IncomeTax/components/FinalMinIncomeForm.js`

**Change:** `calculateFBRSalaryTax()` replaced with Finance Act 2025 slabs + 9% surcharge:

| Slab | Rate | Fixed Portion |
|------|------|---------------|
| ≤ Rs 600,000 | 0% | 0 |
| Rs 600,001 – 1,200,000 | 1% | 0 |
| Rs 1,200,001 – 2,200,000 | 11% | Rs 6,000 |
| Rs 2,200,001 – 3,200,000 | 23% | Rs 116,000 |
| Rs 3,200,001 – 4,100,000 | 30% | Rs 346,000 |
| > Rs 4,100,000 | 35% | Rs 616,000 |

Surcharge: **9%** of tax if income > Rs 10,000,000

### 2.3 Sukuk Rows Restructured

**File:** `Frontend/src/modules/IncomeTax/components/FinalMinIncomeForm.js`

Excel has 3 Sukuk rows:
1. Return on Investment ≤ Rs 1M — `u/s 151 @10%`
2. Return on Investment > Rs 1M — `u/s 151 @12.5%`
3. Return on Investment — Sukuk SAA `u/s 151(1A)` (combined @10%/@12.5% sub-rows)

Two extra rows that were not in the Excel sheet were removed.

### 2.4 Other Rate Corrections in FinalMinIncomeForm

| Item | Before | After | Authority |
|------|--------|-------|-----------|
| Bonus Shares | u/s 236F @0% | u/s 236Z @10% | Finance Act 2025 |
| Profit on Debt u/s 7B | 15% | 20% | Finance Act 2025 |
| Salary surcharge | 10% | 9% | Finance Act 2025 |

### 2.5 TaxComputationSummary — Tax Slabs Fixed

**File:** `Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js`

**Change:** `calculateNormalIncomeTax()` updated to Finance Act 2025 slabs (same table as 2.2 above).

Old wrong values:

| Slab | Old Rate | Old Fixed | Correct Rate | Correct Fixed |
|------|----------|-----------|--------------|---------------|
| 600K–1.2M | 5% | 0 | **1%** | 0 |
| 1.2M–2.2M | 15% | 30,000 | **11%** | **6,000** |
| 2.2M–3.2M | 25% | 180,000 | **23%** | **116,000** |
| 3.2M–4.1M | 30% | 430,000 | 30% | **346,000** |
| >4.1M | 35% | 700,000 | 35% | **616,000** |

### 2.6 Surcharge Corrected — Frontend & Backend

| File | Line | Before | After |
|------|------|--------|-------|
| `TaxComputationSummary.js` | ~136 | `normalIncomeTax * 0.10` | `Math.round(normalIncomeTax * 0.09)` |
| `TaxComputationSummary.js` | ~452 | "Surcharge (10%...)" | "Surcharge (9%... Finance Act 2025)" |
| `TaxComputationSummary.js` | Help text | "10% additional tax" | "9% additional tax (Finance Act 2025)" |
| `calculationService.js` | ~258 | `normal_income_tax * 0.10` | `Math.round(normal_income_tax * 0.09)` |

### 2.7 capital_gain Key Mismatch Fixed

**File:** `backend/src/modules/IncomeTax/routes/taxForms.js`

**Change line 225:** `response.formData.capital_gains = ...` → `response.formData.capital_gain = ...`

**Change line 145:** `completedSteps.push('capital_gains')` → `completedSteps.push('capital_gain')`

This aligns the API response key with `TaxFormContext`'s FORM_STEPS id (`capital_gain`), so capital gain data is available to all consumer forms on initial page load without requiring an explicit re-save.

### 2.8 Tax Credits Field Priority Fixed

**File:** `Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js`

**Change:** `creditsData.total_tax_credits || creditsData.total_credits` → `creditsData.total_credits || creditsData.total_tax_credits`

`total_credits` is the DB-computed column (auto-sums all credit components). `total_tax_credits` is a plain manually-saved field. The DB computed column is authoritative.

### 2.9 Refund Adjustment — Now Editable

**File:** `Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js`

**Change:** `refundAdjustment` changed from hardcoded `0` to:
- `useState(0)` initialized from `formData?.tax_computation?.refund_adjustment`
- Editable number input field in the UI
- Net Tax Paid/Adjusted and Income Tax Demanded recalculate reactively
- Value included in save payload on submit

---

## 3. Phase 2 — Inter-Form Data Flow Fixes (COMPLETED)

**Status: DONE** — Completed 2026-04-11

### 3.1 AdjustableTaxForm — Race Condition Eliminated

**Root cause:** Component had two concurrent data-loading paths:
1. A standalone `loadFromAPI` useEffect calling `GET /api/tax-forms/adjustable-tax` directly
2. The context sync useEffect reading from `formData['adjustable_tax']`

Both called `reset()` on the form. Whichever resolved last won — sometimes overwriting salary data that the other had correctly patched from IncomeForm.

**Fix applied** (`AdjustableTaxForm.js`):
- Removed `import axios` and the entire standalone `loadFromAPI` useEffect (~20 lines removed)
- TaxFormContext's `GET /current-return` already returns adjustable-tax data with all fields — context sync is sufficient
- Removed `getStepData` from context sync dep array (was causing unnecessary re-runs) — replaced with direct `formData['income']` read
- Auto-populate effect (gross receipt from income form) now guards against overwriting saved data: returns early if `formData['adjustable_tax']` already exists

### 3.2 FinalMinIncomeForm — Salary Tax Source of Truth

**Issue:** The salary tax deducted field was always slab-calculated, but the actual employer WHT (from salary certificate) often differs.

**Fix applied** (`FinalMinIncomeForm.js`):
- Added `FileCheck` icon import from lucide-react
- Added a "Use cert. WHT: Rs X" button below the existing RotateCcw (reset-to-slab) button on the salary row
- Button reads `formData['adjustable_tax']?.salary_employees_149_tax_collected` (the WHT entered in AdjustableTaxForm from the employer's certificate)
- Button only appears when a non-zero certificate WHT exists
- User flow: enter salary WHT in AdjustableTaxForm → navigate to FinalMinIncomeForm → click "Use cert. WHT" to populate → slab calc still shown in info panel for comparison
- User can still manually edit or click RotateCcw to revert to slab calc

### 3.3 IncomeForm → TaxComputationSummary Data Gap

**Verified: No fix needed.** Audited IncomeForm save payload and backend `current-return` endpoint:
- IncomeForm saves: `total_employment_income`, `annual_salary_wages_total`, `other_income_no_min_tax_total` — all match TaxComputationSummary fallback chain
- Backend `current-return` at line 166-193 explicitly maps all computed income totals into `formData.income`
- TaxComputationSummary's multi-fallback reads (`total_employment_income || annual_salary_wages_total`) are correct

### 3.4 DeductionsForm → TaxComputationSummary

**Verified: No fix needed.** DeductionsForm saves `total_deduction_from_income` (confirmed in `onSubmit`/`onSaveAndContinue`). TaxComputationSummary reads `deductionsData.total_deduction_from_income` as first priority — exact match.

---

## 4. Phase 3 — Excel Field Gap Closure (COMPLETED)

### 4.1 Missing Auto-Calculations in AdjustableTaxForm

**Status: COMPLETED** (Issue #4)

Section 235 @7.5% and Section 231B(2) @3% auto-calc added to AdjustableTaxForm using `fieldDefinitions` useEffect pattern matching FinalMinIncomeForm.

### 4.2 Capital Gains Form — Sub-Inputs for 2-3 Year Holding

**Status: COMPLETED** (Issue #5)

CapitalGainForm fully rebuilt with Finance Act 2025 rates and holding-period sub-inputs. Each `capitalGainItems` entry has an explicit `rate` and `taxField`. CGT auto-calculated per row.

### 4.3 Credits Auto-Calculation

**Status: COMPLETED** (Issue #3)

Auto-calc useEffect added in CreditsForm. Reads `taxable_income` and `tax_chargeable` from context and computes rebate at average rate per u/s 61:
```
credit = (MIN(donation, 30% × taxable_income) / taxable_income) × tax_chargeable
```

### 4.4 Education Deduction — Income Threshold Validation

**Status: COMPLETED** (Issue #8)

Income threshold check implemented in DeductionsForm. Reads income from context; education deduction field shown/hidden based on eligibility with inline message if not eligible.

### 4.5 FinalTaxForm — Verify Excel Alignment

**Status: COMPLETED** — Rebuilt with 10 FINAL_TAX_ITEMS matching ITO 2001 + Finance Act 2025 rates. All 10 items now persist to DB columns (issues #33, #38). Field mapping: `buildFinalTaxPayload` maps all items to DB names; load normalizer reverses all groups on page load.

---

## 5. Phase 4 — FBR Compliance (COMPLETED)

### 5.1 Capital Gains Tax — FIXED

**`CapitalGainsForm.js`** fully rebuilt with Finance Act 2025 rates:
- Each `capitalGainItems` entry now has an explicit `rate` and `taxField`
- CGT auto-calculated per row: `gain × rate` (read-only teal field)
- Immovable property: 15% / 12.5% / 10% / 7.5% / 5% / 2.5% / 0% by holding period (≤1yr to >6yr)
- Securities u/s 37A: 5% / 7.5% / 10% / 12.5% / 15% / 25% by type
- `buildFormData` strips ephemeral `*_cgt` fields (computed client-side) and saves `total_capital_gain_tax` (gross CGT sum, requires migration) and `capital_gains_tax_chargeable` (net CGT after WHT — correct DB column name)
- Net CGT payable banner shown when CGT > 0

**`TaxComputationSummary.js`** fixed:
- `calculateCapitalGainTax()` now reads `capitalGainData.total_capital_gain_tax` (context, same session)
- Falls back to `capitalGainData.total_capital_gains_tax` (DB computed column, after page refresh)
- Removed hardcoded 15% average rate

**`FinalMinIncomeForm.js`** fixed:
- `total_capital_gain_tax_chargeable` fallback to `capital_gains_tax_chargeable` (DB field name) added

### 5.2 Backend DB tax_slabs — FIXED

Created migration: `backend/database/migrations/add-tax-year-2025-26-slabs.sql`
- Adds TY 2025-26 to `tax_years` table (sets `is_current = true`)
- Inserts Finance Act 2025 slabs: 0% / 1% / 11% / 23% / 30% / 35%
- Uses idempotent `WHERE NOT EXISTS` guard (safe to run multiple times)
- **Must be run against DB manually** to activate backend slab calculation

### 5.3 Super Tax — Out of Scope

Finance Act 2025 super tax applies only when income > Rs 150M. Deferred to future phase.

---

## 6. Phase 5 — Previous Year Upload Feature (COMPLETED)

### What Was Built

**Backend:**
- `backend/database/migrations/add-tax-return-history.sql` — `tax_return_history` table (UUID PK, user_id FK, tax_year, source_format, raw_data JSONB, mapped_data JSONB, rate_flags JSONB)
- `backend/src/services/parsers/excelParser.js` — parses `.xlsx`/`.xls` using `xlsx` package + `.json` files via JSON.parse + flatten. Extracts key→value pairs from all sheets.
- `backend/src/services/parsers/fieldMapper.js` — 30+ mapping rules: FBR label → our internal field+step name. Returns `{ mapped: {step:{field:value}}, unmatched: {key:val} }`.
- `backend/src/services/parsers/rateAudit.js` — flags 9 rate-sensitive fields (salary WHT, 7B debt profit, surcharge, dividend, CGT property, bonus shares, NSS) with severity (high/medium/low) and Finance Act 2025 reason message.
- `backend/src/routes/taxHistory.js` — 5 endpoints: `POST /upload`, `GET /latest`, `GET /list`, `POST /pre-populate`, `DELETE /:id`. Uses multer (memory storage, 10 MB limit). Table auto-created on first use.
- `backend/src/app.js` — mounted at `/api/tax-history`

**Frontend:**
- `Frontend/src/components/TaxHistory/PriorYearUploadModal.js` — drag-and-drop modal: file picker → parse → field stats (mapped/unmatched/flagged) → expandable warning list → "Apply to Current Return" button
- `Frontend/src/hooks/usePriorYearData.js` — hook for forms: reads sessionStorage `priorYearData[stepKey]`, provides `hasPriorData`, `applyPriorYear()`, `isFlagged(field)`, `dismissPriorYear()`
- `TaxFormsOverview.js` — new "Import Prior Year" quick-action card (indigo) opens the modal; `onPrePopulate` stores `mappedData` + `warnings` to sessionStorage
- `IncomeForm.js` — integrated `usePriorYearData('income', setValue)`; pre-fill banner shows when prior data is available

**Pattern for other forms:** Import `usePriorYearData` with matching step key ('adjustable_tax', 'capital_gain', 'credits', 'deductions', 'final_tax') and add the pre-fill banner. No backend changes needed.

### 6.1 Rate Flags (Finance Act 2025)

Fields flagged for user review when imported from TY 2024-25:
- `salary_employees_149_tax_collected` (HIGH) — slabs changed drastically
- `profit_on_debt_7b_tax_collected` (HIGH) — 15%→20%
- `immovable_property_*_taxable` (HIGH) — CGT rates restructured
- `bonus_shares_tax` (HIGH) — new u/s 236Z @10%
- `dividend_150_tax_collected` (MEDIUM)
- `surcharge` (MEDIUM) — 10%→9%
- `profit_govt_securities_amount` (LOW)

### 6.2 Database — New Table Required

```sql
CREATE TABLE tax_return_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  tax_year        VARCHAR(9) NOT NULL,           -- e.g. '2024-25'
  source_format   VARCHAR(10) NOT NULL,          -- 'pdf', 'excel', 'json', 'manual'
  raw_data        JSONB,                          -- parsed raw fields
  mapped_data     JSONB,                          -- normalized to our field names
  upload_date     TIMESTAMP DEFAULT NOW(),
  is_verified     BOOLEAN DEFAULT FALSE,
  notes           TEXT
);
```

### 6.3 Backend — Parser Services

| File | Purpose |
|------|---------|
| `backend/src/services/parsers/pdfParser.js` | Extract text from FBR PDF returns using pdf-parse |
| `backend/src/services/parsers/excelParser.js` | Read Excel return files (XLSX) using ExcelJS |
| `backend/src/services/parsers/fieldMapper.js` | Map extracted fields to our DB column names |
| `backend/src/services/parsers/rateAudit.js` | Flag fields with rate-sensitive values |

**API Endpoints to create:**
```
POST /api/tax-history/upload          — accept file, parse, store raw_data
POST /api/tax-history/map/:id         — run fieldMapper on stored raw_data
GET  /api/tax-history/latest          — get most recent prior-year data
POST /api/tax-history/pre-populate    — push mapped_data to current-year form fields
```

### 6.4 Frontend — Upload Modal

- Upload button on Tax Return Overview page
- Support drag-and-drop for PDF/Excel files
- Show parsing progress and field-match summary
- "Use from last year" badge on pre-populated fields (so user knows which fields were auto-filled)
- Allow user to edit any pre-populated value
- Rate-change warning banner: "Some values carried from last year may use old tax rates. Please review highlighted fields."

### 6.5 Rate Flag Engine (rateAudit.js)

Fields that should never carry forward unchanged between years:

```javascript
const RATE_SENSITIVE_FIELDS = [
  'salary_tax_deducted',        // slab changes every year
  'profit_on_debt_tax',         // 7B rate changed 15%→20%
  'bonus_shares_tax',           // 236Z rate
  'surcharge',                  // 9% this year, was 10% last year
  'capital_gain_tax_*',         // CGT rates change
];
```

These fields get a "Rate Changed — Please Verify" warning when loaded from prior year.

---

## 7. Finance Act 2025 — Reference Rate Table

### Salary Tax Slabs (TY 2025-26)

| Annual Income | Tax Rate | Fixed Portion | Threshold |
|---------------|----------|---------------|-----------|
| ≤ Rs 600,000 | 0% | — | — |
| Rs 600,001 – 1,200,000 | 1% | Rs 0 | Rs 600,000 |
| Rs 1,200,001 – 2,200,000 | 11% | Rs 6,000 | Rs 1,200,000 |
| Rs 2,200,001 – 3,200,000 | 23% | Rs 116,000 | Rs 2,200,000 |
| Rs 3,200,001 – 4,100,000 | 30% | Rs 346,000 | Rs 3,200,000 |
| > Rs 4,100,000 | 35% | Rs 616,000 | Rs 4,100,000 |

**Surcharge:** 9% of income tax if annual salary income > Rs 10,000,000

### Key WHT Rate Changes in Finance Act 2025

| Section | Description | Old Rate | New Rate |
|---------|-------------|----------|----------|
| 7B | Profit on debt (bank deposits) | 15% | **20%** |
| 236Z | Bonus shares | 0% (236F) | **10%** |
| Surcharge | High-income salary | 10% | **9%** |
| 151(1A) | Sukuk SAA profit | Split rates | 10%/12.5% thresholds |

---

## 8. Key File Map

### Frontend

| File | Purpose | Phase Touched |
|------|---------|---------------|
| `Frontend/src/modules/IncomeTax/components/FinalMinIncomeForm.js` | Income subject to final/min tax | Phase 1 |
| `Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js` | Final tax computation summary | Phase 1 |
| `Frontend/src/modules/IncomeTax/components/IncomeForm.js` | Employment & other income | Phase 2 |
| `Frontend/src/modules/IncomeTax/components/AdjustableTaxForm.js` | WHT/adjustable tax deducted | Phase 2, 3 |
| `Frontend/src/modules/IncomeTax/components/ReductionsForm.js` | Tax reductions | — |
| `Frontend/src/modules/IncomeTax/components/CreditsForm.js` | Tax credits (u/s 61, 63) | Phase 3 |
| `Frontend/src/modules/IncomeTax/components/DeductionsForm.js` | Deductible allowances | Phase 2 |
| `Frontend/src/modules/IncomeTax/components/CapitalGainForm.js` | Capital gains | Phase 3, 4 |
| `Frontend/src/modules/IncomeTax/components/FinalTaxForm.js` | Final tax (bonds/sukuk) | Phase 3 |
| `Frontend/src/contexts/TaxFormContext.js` | Central form state & API bridge | Phase 1 |

### Backend

| File | Purpose | Phase Touched |
|------|---------|---------------|
| `backend/src/modules/IncomeTax/routes/taxForms.js` | All tax form CRUD + current-return API | Phase 1 |
| `backend/src/services/calculationService.js` | Server-side tax calculations | Phase 1, 4 |
| `backend/prisma/schema.prisma` | DB schema with computed columns | Phase 2, 5 |

---

## 9. Data Flow Between Forms

```
IncomeForm
  ├── Saves: total_employment_income, annual_salary_wages_total,
  │          other_income_no_min_tax_total, salary_tax_deducted
  └── → TaxComputationSummary reads: income_from_salary, income_from_other_sources

AdjustableTaxForm
  ├── Saves: salary_employees_149_tax_collected, total_adjustable_tax (DB-computed)
  └── → TaxComputationSummary reads: withholding_income_tax (via total_adjustable_tax)

FinalMinIncomeForm
  ├── Auto-links: salary from IncomeForm, capital gains from CapitalGainForm
  ├── Auto-calcs: salary tax via FBR slabs
  ├── Saves: grand_total_tax_chargeable (= D20 in Excel, sum of all final/min taxes)
  └── → TaxComputationSummary reads: final_income_tax (= max of normal tax vs grand_total)

CapitalGainForm
  ├── Saves: total_capital_gain, individual gain amounts
  └── → FinalMinIncomeForm reads: capital gain fields for auto-link
  └── → TaxComputationSummary reads: capital_gains_loss

ReductionsForm
  ├── Saves: total_tax_reductions (manually calculated client-side, DB column is plural)
  └── → TaxComputationSummary reads: tax_reductions

CreditsForm
  ├── Saves: charitable_donations_tax_credit, pension_fund_tax_credit, etc.
  ├── DB computes: total_credits (auto-sum of all credit fields)
  └── → TaxComputationSummary reads: total_credits (DB column, preferred)

DeductionsForm
  ├── Saves: total_deduction_from_income
  └── → TaxComputationSummary reads: deductible_allowances

TaxComputationSummary
  ├── Reads all of the above
  ├── Computes: normal tax, surcharge, CGT, reductions, credits, net payable
  └── Saves: final computation snapshot to tax_computation table
```

---

## 10. Known Remaining Issues (Not Yet Addressed)

| # | Issue | Severity | Phase | Status |
|---|-------|----------|-------|--------|
| 1 | `calculateCapitalGainTax()` in TaxComputationSummary uses hardcoded 15% | High | 4 | **FIXED** (reads total_capital_gain_tax from context) |
| 2 | AdjustableTaxForm dual-path API/context race condition | Medium | 2 | **FIXED** |
| 3 | Credits auto-calculation (u/s 61 rebate formula) not implemented | Medium | 3 | **FIXED** |
| 4 | Section 235 @7.5%, 231B(2) @3% auto-calc missing in AdjustableTaxForm | Medium | 3 | **FIXED** |
| 5 | Capital gains holding-period sub-inputs missing in CapitalGainForm | Medium | 3, 4 | **FIXED** (rebuilt with FA2025 rates) |
| 6 | Backend DB `tax_slabs` table — Finance Act 2025 rates not loaded | High | 4 | **MIGRATION READY** — run add-tax-year-2025-26-slabs.sql |
| 7 | FinalTaxForm not yet audited against Excel | Medium | 3 | **FIXED** (rebuilt with 10 ITR line items) |
| 8 | Education deduction income threshold not validated | Low | 3 | **FIXED** |
| 9 | Previous year upload feature — entire Phase 5 not started | High | 5 | **FIXED** (full feature implemented) |
| 10 | Super tax for income > Rs 150M not implemented | Low | 4 | **FIXED** (u/s 4C Finance Act 2025: flat rate on total income 1%–10% for income > Rs 150M; `calculateSuperTax()` added to frontend `TaxComputationSummary.js` and backend `calculationService.js`; `super_tax` column added via `add-super-tax-column.sql` migration; UI row shown conditionally when super tax > 0) |
| 11 | Profit on Debt u/s 151 auto-calc at 15% (should be 20% per Finance Act 2025) | Medium | 3 | **FIXED** (Phase 3) |
| 12 | FinalMinIncomeForm salary WHT source of truth — slab vs employer certificate | Medium | 2 | **FIXED** |
| 13 | `usePriorYearData` hook only wired to IncomeForm — other forms missing pre-fill banner | Low | 5 | **FIXED** (all 8 income tax forms wired) |
| 14 | TaxFormsOverview Quick Actions grid — 5 cards in 4-column grid | Low | 5 | **FIXED** (updated to lg:grid-cols-3 xl:grid-cols-5) |
| 15 | `usePriorYearData` dismissPriorYear deleted all steps' sessionStorage — bug | Medium | 5 | **FIXED** (uses per-step dismiss list, clears only current step) |
| 16 | ReductionsForm teacher/researcher 25% reduction had no auto-calculation | Low | — | **FIXED** (auto-calcs from FinalMinIncomeForm salary tax) |
| 17 | Behbood certificate reduction had no auto-calculation | Low | — | **FIXED** (auto-calcs 5% cap from profit amount) |
| 18 | ExpensesForm and ReductionsForm missing prior year pre-fill hook | Low | 5 | **FIXED** |
| 19 | `CapitalGainsForm.buildFormData` sent non-existent DB columns (`*_cgt` fields, `total_capital_gain_tax_chargeable`, `total_capital_gain_tax_deducted`) causing PostgreSQL save errors | Critical | — | **FIXED** (strip `*_cgt` via Set; map to `capital_gains_tax_chargeable`; use DB `total_tax_deducted`) |
| 20 | WealthStatementForm navigate calls used `/tax-forms/` prefix — both forms unreachable | High | — | **FIXED** (paths corrected to `/wealth-statement/` and `/income-tax/`) |
| 21 | `WealthReconciliationForm` reconciliation object used camelCase keys — payload would fail DB save; `giftValue` double-counted in both inflows and outflows; `incomeFinalTax` hardcoded 0 | Critical | — | **FIXED** (snake_case keys; `gift_outflow` for outflows; reads `total_final_tax` from final_tax form) |
| 22 | `WealthReconciliationForm.onSaveAndContinue` saved but never navigated to next form | Medium | — | **FIXED** (navigates to `/income-tax/tax-computation`) |
| 23 | `personal_expenses` sync guard (`!watchedValues.personal_expenses`) prevented re-sync after initial population | Low | — | **FIXED** (removed guard; always syncs from expenses form) |
| 24 | Backend `saveFormData` spread `isComplete` (camelCase) and `taxReturnId` into SQL SET clause — caused "column does not exist" errors for ALL generic-route form saves (`credits`, `deductions`, `final_tax`, `expenses`, `tax_computation`, `capital_gain`, `reductions`) | Critical | — | **FIXED** (extract `isComplete`/`taxReturnId` before spread; map `isComplete` → `is_complete`) |
| 25 | Backend GET returns wealth data from `wealth_statement_forms` (wrong table) under key `wealth_statement` (wrong context key) — WealthStatementForm never loaded saved data | Critical | — | **FIXED** (query `wealth_forms`; key changed to `wealth`; completedSteps push fixed) |
| 26 | No backend save routes for `POST /api/tax-forms/wealth_forms` or `wealth_reconciliation_forms` — wealth form saves always 404'd | Critical | — | **FIXED** (added both routes using `saveFormData`) |
| 27 | `tax_computation` step `formType: 'tax_computation_forms'` → URL `/api/tax-forms/tax_computation_forms` — backend only has `/tax-computation` — save always 404'd | Critical | — | **FIXED** (`formType` changed to `'tax-computation'`) |
| 28 | `TaxComputationSummary` spread entire `computationData` into save payload — many field names don't match DB columns (`taxable_income_including_capital_gains`, `withholding_income_tax`, `total_tax_chargeable` etc.) causing SQL errors | Critical | — | **FIXED** (`buildComputationPayload` maps only DB-valid snake_case fields) |
| 29 | `total_capital_gain_tax` in `CapitalGainsForm.buildFormData` blocked every capital gain save (column requires migration) | Critical | — | **FIXED** (removed from payload; TaxComputationSummary now reconstructs gross CGT from `capital_gains_tax_chargeable + total_tax_deducted`) |
| 30 | `ReductionsForm` sent `total_tax_reduction` (singular, not in DB), `capital_gain_immovable_tax_reduction` / `capital_gain_clause9a_tax_reduction` (wrong names), and 4 non-existent columns (`capital_gain_immovable_amount`, `capital_gain_clause9a_amount`, `capital_gain_immovable_reduction_yn`, `capital_gain_clause9a_reduction_yn`) — caused SQL errors on every save | Critical | — | **FIXED** (`buildReductionsPayload`: renames to `total_tax_reductions`, `capital_gain_immovable_50_reduction`, `capital_gain_immovable_75_reduction`; strips 4 non-DB fields) |
| 31 | `DeductionsForm` sent `professional_expenses_pos_amount` (not in DB), `education_expense_deduction` (DB has `educational_expenses_amount`), `education_expense_children_count` (DB has `educational_expenses_children_count`), `education_expense_yn` (DB has `educational_expenses_yn`) — caused SQL errors | Critical | — | **FIXED** (`buildDeductionsPayload`: strips pos_amount; renames 3 education fields to DB column names) |
| 32 | `ExpensesForm` registered `rates`, `vehicle`, `donations` as form field names — DB columns are `rates_taxes_charges`, `vehicle_running_maintenance`, `donations_zakat_annuity` — save errors and data never reloaded after page refresh | Critical | — | **FIXED** (renamed `register()` calls, `calculateTotal` field list, and JSX breakdown references to use DB column names) |
| 33 | `FinalTaxForm` rebuilt with 10 FINAL_TAX_ITEMS using new field names (e.g. `prize_bond_winnings_amount`, `dividend_listed_companies_tax`, etc.) — NONE of these exist in `final_tax_forms` DB schema (only 4 column groups: sukuk_bonds_*, debt_securities_*, prize_bonds_*, other_final_tax_*) — every save crashed | Critical | — | **FIXED** (`buildFinalTaxPayload`: strips all 30+ ephemeral fields via `FINAL_TAX_EPHEMERAL` Set; maps 2 items to nearest DB columns; always persists `total_final_tax` for cross-form use) |
| 34 | **Load path:** `DeductionsForm`, `ReductionsForm`, and `FinalTaxForm` `reset(savedData)` used raw DB keys — mismatched form field names meant education/capital-gain/prize-bond fields never repopulated after page refresh | Medium | — | **FIXED** (added DB→frontend reverse-mapping normalizers in each form's load `useEffect`) |
| 35 | `recalculateFormCompletion` in `taxForms.js` used `hasData` (any numeric field > 0) to set completion — forms appeared "done" the moment any value was entered, even without clicking "Complete & Next" | High | — | **FIXED** (`completionStatus[form.column] = Boolean(result.rows[0].is_complete)` — reads the actual `is_complete` flag set by the save route) |
| 36 | `AdjustableTaxForm` — audit complete; custom backend route at `/adjustable-tax` explicitly maps every field to DB column names and includes `is_complete: isComplete` at line 1263; no fix needed | — | — | **CLEAN** (no action required) |
| 37 | `form_completion_status` table has no columns for `final_min_income`, `wealth_reconciliation`, `tax_computation` steps — these forms' completion never persists across page refreshes | Low | — | **FIXED** (`add-completion-status-columns.sql` migration: adds 3 boolean columns, drops+recreates `all_forms_complete` and `completion_percentage` generated columns over 12 forms; `recalculateFormCompletion` updated to query all 3 tables and write all 3 new columns) |
| 38 | `FinalTaxForm` 8 line items beyond prize bonds and other final tax (winnings, govt securities, dividends, CGT, commission) have no individual DB columns — compute correctly in-session but don't persist per-item | Medium | — | **FIXED** (`add-final-tax-line-items.sql` migration: adds 4 columns per item × 8 items = 32 new columns; `buildFinalTaxPayload` maps all 10 items to DB columns; load normalizer reverse-maps all 10 groups) |
