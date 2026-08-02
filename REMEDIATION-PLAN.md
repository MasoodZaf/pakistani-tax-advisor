# QA Remediation — shared contract (branch `fix/qa-remediation-2026-08`)

Source of truth for defects: `../qa-report-2026-08-02/` (README + `detail/`).
Baseline: `45bb80c`, identical on prod (`main`) and staging (`staging`).

## Governing principle

**The server must never trust a client-supplied tax figure.** Every statutory limit is
currently enforced in the browser only. Fixes that merely add another browser-side check
are rejected. Each limit must be enforced server-side, on the write path, and must hold
against a raw authenticated POST with no UI involved.

## File ownership — do not edit outside your lane

| Lane | Owns |
|---|---|
| **A · validation** | `backend/src/middleware/validation.js`, `backend/src/helpers/statutoryLimits.js` (new), route wiring in `backend/src/modules/IncomeTax/routes/taxForms.js` |
| **B · engine** | `backend/src/services/taxCalculationService.js` |
| **C · controllers** | `backend/src/modules/IncomeTax/controllers/*.js`, `backend/src/routes/incomeForm.js` |
| **D · frontend** | `Frontend/src/**` |
| **E · infra + schema** | `backend/Dockerfile`, `docker-compose*.yml`, `backend/src/app.js` (CORS only), `database/**` migrations |

Shared read-only reference: `backend/src/helpers/statutoryLimits.js` once lane A lands it.
If you need a change outside your lane, state it in your report — do not reach across.

## Shared contract — agreed names, everyone codes to these

Lane A creates `backend/src/helpers/statutoryLimits.js` exporting **pure functions** that
read from `tax_rates_config` (never hardcode a rate — the table is the authority, and it
is already correct):

```js
capDonationU61(taxableIncome, isAssociate)   // 30% / 15%
capPensionU63(taxableIncome)                 // 20%
capEducationU60D(taxableIncome, children)    // Rs 60,000/child, max 2, income < 1.5M
capProfessionalU60C(taxableIncome, posAmount)// min(5% POS, 25% taxable), income < 1.5M
behboodReliefCl6(profit, taxOnProfitAtAvgRate) // relief = tax charged ABOVE the 5% ceiling
superTaxU4C(income)                          // must be continuous — no tier gaps
```

New DB columns — **LANDED** as `backend/database/migrations/phase-z14-cgt-acquisition-date-and-tuition-fee.sql`.
(**Not `phase-z13`** — that slot was already taken by `phase-z13-password-reset-tokens.sql`
at baseline, and CI applies migrations by sorted filename, so a duplicate prefix would
have collided. Migrations live in `backend/database/migrations/`, not the repo-root `database/`.)

- `capital_gain_forms.acquisition_date DATE` **NULL** — enables the post-1-Jul-2024 regime.
  **`NULL` means pre-FA-2024** and must be treated that way; existing rows predate the
  column, so defaulting NULL to the flat-15% regime would silently re-rate historical returns.
- `deductions_forms.tuition_fee_amount NUMERIC(15,2) DEFAULT 0` — s.60D limb (a).
  **Stored only.** It is deliberately NOT in the `total_deductions` generated column (that
  column is the zakat/ushr/foreign-tax/advance-tax sum, and altering a generated column
  needs a drop/recreate on live data). **Lanes A/B own applying the allowance.**
- `adjustable_tax_forms.is_atl BOOLEAN NOT NULL DEFAULT true` — for lane C's non-filer fix,
  following the `phase-v-add-is-atl-final-min.sql` pattern exactly. Applying it moves no
  existing figure.

Env vars: backend CORS allowlist is **`CORS_ORIGINS`** (comma-separated; `FRONTEND_URL`
still accepted as single-origin shorthand). The frontend's baked-in API base stays
**`REACT_APP_API_URL`**. A rejected origin now returns **403, not 500** — the old code
passed an Error to the cors callback, which is what made every cross-origin write a 500.

Threshold comparisons use **taxable** income, not gross, and the statute says **"less
than"** Rs 1.5M — use `<`, not `<=`.

## Four fixes that go wrong if applied naively

1. **Behbood** — relief is the tax charged *in excess of* the 5% ceiling, not 5% of
   profit. Apportion at the **average** rate, not marginal — the same file already does
   this for the teacher reduction. Reference case: profit 1,000,000 → **Rs 226,875**.
2. **Wealth reconciliation** — **do NOT flip the sign.** The reconciliation already adds
   exempt income; `total_employment_income` is already net of the B15 contra, so it is
   subtracted twice (`S − 2E`). Remove the double-subtraction. Separately
   `income_final_tax = 0` is a **wrong-table read** (legacy `final_tax` vs modern
   `final_min_income`), structurally always zero — repoint it.
3. **236C** — fix the **read-back key first**, then the truncated column names. The other
   order converts a P2 into live data loss the same day.
4. **Credits** — two separate doors. An over-cap credit zeroes liability (`netTaxPayable`
   is floored at 0) but cannot create a refund; the refund vector is unvalidated
   withholding. Closing one leaves the other open.

## Definition of done, per lane

- A regression test under `backend/src/**/__tests__/` or `backend/tests/` that **fails on
  `45bb80c` and passes after your change**. State the assertion.
- For every statutory limit: a test that posts an over-cap value **directly to the API**
  and asserts the server rejects or clamps it.
- `npm test` green in `backend/`.
- No hardcoded rates. No client-side-only enforcement.

## Out of scope — do not attempt

- **s.60C / s.100C legal question.** The codebase's citations are self-contradictory
  (s.100C is the NPO credit; s.60C the repealed house-financing allowance). Implement the
  *mechanism* correctly and leave the rate DB-driven. **Do not invent a rate.** Flag it.
- **DNS for `tax.aurmak.com`** — registrar action, owner only.
- Deploying anything. Integration and deploy are handled centrally.
