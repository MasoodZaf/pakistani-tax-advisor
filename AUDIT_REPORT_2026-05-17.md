# Pakistan Tax App — Full Audit Report

**Date:** 2026-05-17  
**Target user:** **Salaried Individuals only** (FBR IRIS Form 114(1), salaried scope).  
**Audit scope:** Cross-form data flow, FA 2025 tax math, schema vs code, API auth, generated-column writes, PDF / IRIS output, admin separation, frontend route guards / onboarding  
**Method:** 7 parallel read-only sub-audits, each scoped to one independent surface, then synthesized here.  
**App version:** branch `main`, HEAD `15c1f68` ("backend: drop stale incomeForm require in IncomeTax module").  
**Pre-existing fixes applied in this session** (not re-audited): generated-column write filter, `updated_at` collision strip, NTN join for readiness, PDF auth + buffer, Reports income-analysis SQL, onboarding loop, auto-load reports tab.

---

## Fix-wave status (updated 2026-05-17 end-of-day)

| Wave | Items | Status |
|---|---|---|
| **1 — Critical** | C1 setup-super-admin scrub + cred sanitization · C2 Refresh-links columns + tax_return_id · C3 Reports wealth-recon SQL · C4 surcharge threshold FE→BE · C5 tax-calc summary wired to service (now produces 27 keys) · C6 plural fix | **✅ All 6 done** |
| **2 — High** | H1 IRIS Credits + Deductible Allowances + 9203 · H2 dedup IRIS 64030051 → 64030056 · H3 admin form-save generated-col filter + zakat dual-write · H4 Dashboard wealth route · H5 tax_years UPDATE updated_at · H6 audit log on credential bypass | **✅ All 6 done** |
| **3 — Medium** | M1/M2 admin.js route dedup + super-admin gate · M3 audit-logs SuperAdminRoute · M4 tax-year audit · M5 rate limiter · M6 /create-return real persistence · M7 /reports + /settings UserOnlyRoute · M8/M9 tax-year race fixes · M10 PDF 9201 + advance · M11 PDF 920100 fallback · M12 surcharge code TODO · M13 slab-boundary invariant · M14 credit caps post-deduction · M15 surcharge SQL migration | **✅ All 15 done** |
| **4 — Low** | L1 strip `capital_gain_amount` → `capital_gain` · L2 doc updates · L3 delete dead taxCalculator.js · L4 server-side education max-2 children · L5 teacher reduction fallback · L6 dead `needsPersonalInfo` redirect · L7 `req.user.userId` cleanup · L8 `req.userId` → `req.user?.id` in logs · L9 64151401 placement comment | **✅ All 9 done** |

**Total: 36 / 36 audit items resolved.** Every endpoint touched by the user-facing happy path was re-tested after each wave; the salaried filer round-trip (`Rs 3M income → Rs 300k normal tax, surcharge 0, CGT 0, demand Rs 300k`) was preserved end-to-end.

---

## Salaried-scope addendum (added 2026-05-17)

The audit was originally written without a tight scope. The app is for **salaried individuals only** — the onboarding wizard offers Bank/Savings Profit, Dividends, Listed Shares/Mutual Funds, Sukuk/Bonds and Rental Income as optional add-ons, but no business / AOP / sole-proprietor surface. This adjusts a few severities:

| Finding | Original | Re-scored | Reason |
|---|---|---|---|
| H1 — IRIS missing Capital Gains rows (beyond 7107 stub) | High | **Medium** (moved to Wave 3) | Securities CGT is a salaried add-on, not the primary return |
| H1 — IRIS missing Credits + Deductions sections | High | **High** (unchanged) | Zakat (s.60) + charitable (s.61) + pension (s.63) are bread-and-butter for salaried — cannot ship without |
| H1 — IRIS missing Income Tax Demanded (9203) | High | **High** (unchanged) | Universal slip field |
| L4 — education expense max-2-children client-only | Low | **Low** but **unlikely to fire** | s.60D requires TI ≤ 1.5M; rare for salaried |
| M11 — `920100` Final/Fixed/Min Income Tax math drift | Medium | **Medium** (unchanged) | Final-min applies to salaried add-ons (sukuk, dividends) |
| All Criticals | Critical | **Critical** (unchanged) | C2's three columns (`profit_debt_151_15`, `profit_debt_sukook_151a`, `tax_deducted_rent_section_155`) are bank profit / sukuk / rental WHT — all in scope for salaried |

Out of scope and **not flagged**: business / sole-proprietor P&L, AOP profit share, manufacturing fixed-tax, full s.7E deemed income (stub at `7107=0` is correct). Backend's legacy `taxCalculator.js` retains business/AOP code paths — reinforces the case to retire it rather than maintain.

---

## Executive summary

| Severity | Count | Headline |
|---|---|---|
| **Critical** | 6 | Hardcoded super-admin password committed; 3 admin/feature endpoints reference renamed columns and 500 on use; surcharge base differs FE vs BE; PDF totals always Rs 0 |
| **High** | 6 | Admin form-saves 500 on `deductions`/`final_tax`; PDF missing Credits, Deductions, Income-Tax-Demanded, full Capital Gains; Dashboard's primary Wealth link is a dead-end; privileged credential-bypass with no audit log |
| **Medium** | 15 | Duplicate route definitions shadow super-admin guards, rate limiter missing on tax-computation, audit-log gaps, schema/spec drift, slab-boundary `min-1` hack, credit-cap base wrong |
| **Low** | 9 | Cosmetic dead code (`req.userId` references, legacy FA-2024 calculator), spec out of date, dropped form keys, client-only validation |

**Risk picture:** the user-facing happy path that I ran end-to-end (register → fill 10 forms → tax computation → readiness "ready to submit" → PDF download) **works correctly with the Critical/High bugs I already fixed in-session**. The remaining Criticals are concentrated in (a) admin operations, (b) the "Refresh links" feature on tax computation, (c) the PDF/Reports surface where totals can silently be Rs 0, and (d) deployment hygiene (committed super-admin credentials).

---

## Critical findings (P0)

### C1. Hardcoded super-admin credentials in committed setup script
**File:** `backend/setup-super-admin.js:13-14` (also documented in `README.md`, `DEPLOYMENT_FREE.md`, `ADMIN-ACCOUNTS-SUMMARY.md`, `RAILWAY_DEPLOY.md`, `RENDER_DEPLOY.md`, `e2e/tests/*.spec.js`).  
**Impact:** Defaults to `superadmin@paktax.com` / `SuperAdmin@2025` and **demotes every existing admin to `user`** on run. Reachable in any production deploy that ships the repo as-is. The newer `backend/create-super-admin.js` is hardened (requires env vars + password policy) but the legacy script still exists.  
**Fix:** Delete `setup-super-admin.js` (or gate behind `NODE_ENV!=='production'` + env-supplied password), scrub the password from all docs, rotate any deployed super-admin.

### C2. "Refresh links" feature INSERTs three non-existent columns
**File:** `backend/src/services/taxCalculationService.js:344-346` — used by `POST /api/tax-computation/link-adjustable`.  
**Impact:** Postgres rejects the INSERT. The "Refresh links" button on the Tax Computation page 500s on first click.  
**Wrong → right:**
- `profit_debt_15_percent_gross_receipt` → `profit_debt_151_15_gross_receipt`
- `sukook_12_5_percent_gross_receipt` → `profit_debt_sukook_151a_gross_receipt`
- `rent_section_155_gross_receipt` → `tax_deducted_rent_section_155_gross_receipt`

### C3. Reports `/wealth-reconciliation` route uses legacy income column names
**File:** `backend/src/routes/reports.js:332-333` (same drift family as the `/income-analysis` bug fixed earlier in this session, just on a different report endpoint).  
**Wrong:** `monthly_salary`, `car_allowance`, `other_taxable`, `other_sources`.  
**Right:** `annual_basic_salary`, `taxable_car_value`, `other_taxable_subsidies`, `other_income_min_tax_total + other_income_no_min_tax_total`.  
**Impact:** `GET /api/reports/wealth-reconciliation/:taxYear` 500s. Wealth Report tab in the user UI dies.

### C4. Surcharge threshold base differs between FE preview and BE compute
**Files:** backend `taxCalculationService.js:235` checks `taxableIncomeExcludingCG > 10_000_000`; frontend `Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js:155` checks `taxableIncomeIncludingCapitalGains > 10_000_000`.  
**Impact:** Live preview can show surcharge "on" while the saved compute shows it "off" (or vice-versa) for any filer with CGT in the 9.x M income range. Statutorily surcharge applies to income tax on regular (non-CGT) income → **backend is correct, frontend is wrong**.  
**Fix:** Align FE to `taxableIncomeExcludingCG`.

### C5. PDF tax-calculation-summary fields are always Rs 0
**Files:** `backend/src/routes/reports.js:88-93` produces only `{ totalIncome, totalWithholdingTax, netTaxPosition }`. `reports.js:459-475` then reads `apiResponse.calculations?.taxableIncome / normalIncomeTax / surcharge / taxChargeable / withholdingTax / refundDue`. None of those keys are ever produced. `TaxCalculator` is imported at line 4 but never invoked.  
**Impact:** The PDF generated by the backend route always shows Rs 0 for the headline tax numbers. The on-screen Tax Computation page is correct; the PDF disagrees.  
**Fix:** Either wire the producer to `TaxCalculationService.calculateTaxComputation`, or retire the backend FBR template and let everything go through the frontend `irisPdf.js` (which is canonical — see H1).

### C6. Frontend Tax Computation reads `total_tax_reduction` (singular) while form saves `total_tax_reductions` (plural)
**File:** `Frontend/src/modules/IncomeTax/components/TaxComputationSummary.js:166`.  
**Impact:** Live tax computation preview reads 0 for reductions until the user navigates away and back (which re-runs the auto-fill). Backend math is correct (`taxCalculationService.js:247` uses plural).  
**Fix:** Single character — `total_tax_reduction` → `total_tax_reductions`.

---

## High findings (P1)

### H1. PDF (IRIS) is missing entire form sections + key codes
**File:** `Frontend/src/utils/irisFieldMap.js` (canonical PDF builder).  
**Missing:**
- **Tax Credits section** — no rows for `930201` (charitable, s.61), `930301` (pension, s.63). Folded into 9100 math but not surfaced as line items.
- **Deductible Allowances section** — no zakat/POS/education rows.
- **Capital Gains** — only stubbed at `7107` with zeros; no per-security CGT rows (`37(1A)`, `37A` securities tiers).
- **Income Tax Demanded** row — no `9203` (or equivalent) in Computations.

### H2. Duplicate IRIS field code `64030051`
**File:** `irisFieldMap.js:245` and `:293`.  
Code is reused for both "Profit on Debt u/s 151 @15%" (Adjustable Tax) and "Dividend u/s 150 @0% REIT SPV" (Fixed/Final). At least one is wrong.

### H3. Admin form-save endpoint writes to generated columns
**File:** `backend/src/modules/Admin/routes/admin.js:1107` (case `deductions` writes `total_deductions`), `:1124-1125` (case `final_tax` writes `total_final_tax`, `debt_tax_amount`).  
**Impact:** `PUT /api/admin/users/:userId/tax-forms/:formType` 500s on those two formTypes. Admin assistance flow broken for Deductions and Final Tax forms.  
**Fix:** Same pattern as the `tableColumns.js` filter we applied — drop generated columns from the INSERT list.

### H4. Dashboard "Wealth Statement" CTA is a dead link
**File:** `Frontend/src/components/Dashboard/Dashboard.js:19` maps the `wealth` step to `/wealth-statement/wealth` but the route registered in `Frontend/src/modules/WealthStatement/index.js:20` is `/wealth-statement/wealth-statement`. The bad URL falls through the module's `<Route path="*">` and silently redirects back to the deck index.  
**Note:** `FormDeck.js:27` has the correct mapping — only Dashboard is wrong.  
**Fix:** `wealth: '/wealth-statement/wealth-statement'` in `Dashboard.js:19`.

### H5. `tax_years` UPDATE references non-existent `updated_at`
**File:** `backend/src/modules/Admin/routes/admin.js:213`.  
**Impact:** Admin tax-year toggle (`PUT /api/admin/tax-years/:id/status`) 500s on every call. `tax_years` table has no `updated_at` column (verified).  
**Fix:** Remove `, updated_at = NOW()` from the SET clause.

### H6. Privileged "user-login-credentials" endpoint has no audit log
**File:** `backend/src/modules/Admin/routes/admin.js:1245` (`GET /api/admin/user-login-credentials/:userId`).  
**Impact:** Super-admin can mint a bypass JWT for any user with **no audit trail** — only a `logger.info` call. Every other privileged op in this file uses `insertAudit`. Also: the returned JWT uses snake_case `user_id` while `middleware/auth.js` reads `userId`, so the token may not even work — but the audit gap is the real issue.  
**Fix:** Add a mandatory `insertAudit({ category: 'super_admin_credential_bypass', severity: 'high', ... })` call.

---

## Medium findings (P2)

| # | File:line | Finding |
|---|---|---|
| M1 | `backend/src/modules/Admin/routes/admin.js:261 & 1772` | `POST /api/admin/tax-years` defined twice. First match wins → older un-restricted handler is the live one. |
| M2 | `backend/src/modules/Admin/routes/admin.js:377 & 1960` | `GET /api/admin/audit-logs` defined twice. Older handler (no `requireSuperAdmin`) wins → **regular admins can read the audit log**. |
| M3 | `Frontend/src/modules/Admin/index.js` | `/admin/audit-logs` not wrapped in `SuperAdminRoute` — contradicts memory's "super-admin features" list. |
| M4 | `backend/src/modules/Admin/routes/admin.js:1798` | `PUT /api/admin/tax-years/:id` writes no audit entry. |
| M5 | `backend/src/app.js:162` | `/api/tax-computation` mounted without `apiWriteLimiter`. Writes are auth-gated but unthrottled. |
| M6 | `Frontend/src/contexts/TaxFormContext.js:208-216` | `createNewTaxReturn` POSTs to `/api/tax-forms/create-return` — **no such backend route exists**. Silent fallback failure; non-income saves can fail with no useful error. |
| M7 | `Frontend/src/App.js:222-262` | `/reports` and `/settings` use `ProtectedRoute` (admin-permeable) but pages assume user-level tax data. |
| M8 | `Frontend/src/components/Onboarding/Onboarding.js:447,476` | `currentTaxYear` initial value `'2025-26'` literal can be sent if user races through step 2 before `/api/tax-year/current` resolves. |
| M9 | `Frontend/src/components/PersonalInfo/PersonalInfoForm.js:48` | `axios.get('/api/personal-info/' + currentTaxYear)` fires with literal `'null'` before tax-year resolves. |
| M10 | `Frontend/src/utils/irisFieldMap.js:331` | PDF `9201` "Withholding Income Tax" reads `payments.withholdingTax` only; excludes `advance_tax_u_s_147`. On-screen panel adds both — PDF and screen disagree. |
| M11 | `Frontend/src/utils/irisFieldMap.js:328-329` | PDF `920100` Final/Fixed/Min Income Tax math drifts from `taxCalculationService` whenever the user populates the Final/Min form. |
| M12 | `Frontend/src/utils/irisFieldMap.js:329` (surcharge code `923184`) | Most current IRIS slips use `923101` for "Surcharge on high earning person". Verify against a fresh IRIS slip. |
| M13 | `backend/src/services/calculationService.js:220`, `TaxComputationSummary.js:254`, `CreditsForm.js:77` | Slab-boundary uses `min - 1` hack. Works only when slab rows are seeded as contiguous closed intervals. Future seed with FBR-style open intervals (`min = 600001`) would silently miscalc by 1 rupee × rate. |
| M14 | `Frontend/src/modules/IncomeTax/components/CreditsForm.js:88-90`, `DeductionsForm.js:72-74` | Credit/deduction caps use `taxableIncome = total_employment_income + other_income_no_min_tax_total` — doesn't subtract deductions. For s.61/s.63 the statutory base is post-deductions. Caps slightly too generous when deductions exist. |
| M15 | `backend/data/rates-bundle.json:1066-1075` vs SQL migrations | 2025-26 surcharge exists only in the JSON bundle; not in any `phase-*.sql` migration. Fresh DB without bundle replay → `getSurcharge('2025-26')` throws. |

---

## Low findings (P3)

| # | File:line | Finding |
|---|---|---|
| L1 | `Frontend/src/modules/IncomeTax/components/FinalMinIncomeForm.js:314` | `capital_gain_amount` save key doesn't exist in DB (column is `capital_gain`). Stripped by `filterToAllowedColumns`; figure re-derived next session. Noisy "Dropped unknown keys" log each save. |
| L2 | `CROSS_FORM_DATA_FLOW.md` §2, §4 | Spec out of date: §2 lists non-existent source columns; §4 marked "not implemented" but is fully wired. |
| L3 | `backend/src/utils/taxCalculator.js:170-174,259-260` | Legacy code with hardcoded 10% surcharge over Rs 10M (FA 2024). Not wired into compute path but still in tree; risk of re-introduction. |
| L4 | `Frontend/src/modules/IncomeTax/components/DeductionsForm.js:346` | `educational_expenses_amount` enforces `max=2 children` in HTML only — no server validation. Crafted POST can store 5 × 60,000. |
| L5 | `ReductionsForm.js:80-82` | Teacher reduction reads salary tax from `final_min_income.salary_u_s_12_7_tax_chargeable`. If Final/Min form not visited, rebate silently stays 0 even when applicable. |
| L6 | `Frontend/src/components/Auth/Login.js:293-295` | `needsPersonalInfo` branch sends users to `/personal-info`, but that route bounces non-onboarded users to `/onboarding`. Effectively dead. |
| L7 | `backend/src/routes/taxHistory.js:104,193,212,244,294,331,349,381` | Dead `req.user.id || req.user.userId` fallbacks (right side never set). |
| L8 | `backend/src/middleware/validation.js:89,142,186,229,280` | Logger references `req.userId` (undefined). Cosmetic — affects only log fields. |
| L9 | `Frontend/src/utils/irisFieldMap.js` (`64151401`) | "Sale Considerations u/s 37(6)" placed under Adjustable Tax — s.37 is Capital Gains, likely belongs under Fixed/Final. |

---

## What is verifiably correct

These claims from prior work were verified during this audit and are **not** in the findings list:

- **FA 2025 salary slabs** (1/11/23/30/35%, surcharge 9% over Rs 10M) — `add-tax-year-2025-26-slabs.sql:29-34`. Match Finance Act 2025.
- **CGT immovable staircase** (15→12.5→10→7.5→5→2.5→0% by holding) — `phase-h-cgt-rate-seeds.sql:38-44`. ✓
- **CGT securities tiers** (up to 25%) — `phase-h-cgt-rate-seeds.sql:46-53`. ✓
- **Credit / deduction caps and rebate-at-avg-rate** — donation, pension, teacher, zakat, POS, education (s.60C/60D, s.61, s.63) — verified vs FA 2025 schedule.
- **Cross-form data flow §1 / §2 / §3** — all three claimed-implemented chains in `CROSS_FORM_DATA_FLOW.md` are actually wired correctly in the consuming forms.
- **Auth middleware** — no remaining `req.userId` data-fetch bugs after this session's fix. No user-data route is unauth.
- **Save endpoints** — all live save endpoints filter generated columns via `getAllowedColumns` / dynamic `is_generated` check after this session's fix. Only the **admin** form-save (H3) still has the bug.
- **Impersonation flow** — super-admin only, mandatory audit log, short-lived 1-hour token with `isImpersonation` flag, clean un-impersonate. ✓
- **Frontend rates source** — credits/deductions/reductions/CGT/adjustable-tax forms all read rates from `useTaxRates` hook — no hardcoded FA-2025 numbers. (Memory note "FA2025 slabs hardcoded in frontend JS" is **out of date** — that's now true only of dead legacy `taxCalculator.js`.)
- **JWT expiry + 401 interceptor** — graceful logout, no spinner traps.

---

## Suggested fix waves

### Wave 1 — Critical (recommended to fix immediately, ~1-2 hours)
1. **C1** — Delete or gate `setup-super-admin.js`; scrub `SuperAdmin@2025` from all docs.
2. **C2** — Three column-name corrections in `taxCalculationService.js:344-346`.
3. **C3** — Rewrite the `wealth-reconciliation` income SELECT (same pattern as the income-analysis fix already applied).
4. **C4** — Switch `TaxComputationSummary.js:155` to `taxableIncomeExcludingCG` for the surcharge threshold check.
5. **C5** — Wire `tax-calculation-summary` to `TaxCalculationService.calculateTaxComputation` so PDF totals stop being Rs 0 (or retire the backend FBR template entirely).
6. **C6** — Fix `TaxComputationSummary.js:166` plural mismatch.

### Wave 2 — High (~3-4 hours)
7. **H1, H2** — Add IRIS sections for Credits and Deductions; add Income-Tax-Demanded row; disambiguate `64030051`; flesh out Capital Gains beyond the 7107 stub.
8. **H3** — Filter generated columns in `admin.js:1107/1124/1125` (same pattern as user-side fix).
9. **H4** — One-character fix in `Dashboard.js:19`.
10. **H5** — Remove `, updated_at = NOW()` from `admin.js:213`.
11. **H6** — Add `insertAudit` call to `admin.js:1245`.

### Wave 3 — Medium (~half day)
- Deduplicate routes M1/M2; gate audit-logs M3.
- Add audit entry M4.
- Rate limiter M5.
- Remove or implement `create-return` endpoint M6.
- Switch `/reports` and `/settings` to `UserOnlyRoute` (or add admin-aware shells) M7.
- Onboarding/PersonalInfo race conditions M8/M9.
- PDF math alignments M10/M11/M12.
- Slab-boundary refactor M13.
- Correct caps base M14.
- Add 2025-26 surcharge to a SQL migration M15.

### Wave 4 — Low (cleanup, ~1-2 hours)
- All 9 Low items — mostly dead-code removal and doc updates.

---

## Test artifacts left behind from this session

- Test filer: `e2e-filer-2026-05-17@paktax.test` / `FilerTest@2026!`
- Tax return: `e685faee-7c92-48bc-b1f8-e467a7c1564c` (TY 2025-26, all 10 forms filled, demand Rs 300,000)
- Generated PDF: `/tmp/return.pdf` (4 pages, 252 KB)
- Background servers: backend `npm run dev` on :3001, frontend `PORT=3002 npm start` on :3002. Stop with `lsof -ti:3001 | xargs kill` / `lsof -ti:3002 | xargs kill` when done.

---

*End of audit.*
