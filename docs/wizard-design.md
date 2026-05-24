# AI Quick-Start Wizard — Design

Status: design phase 2026-05-24. Schema, endpoints, UI not yet built.
Owners: see `shared/wizardFieldMap.js` for the canonical field map.

## Goal

A short, conversational, AI-assisted intake that:

- Runs once per `(user_id, tax_year)` and never re-fires unless the user
  manually re-triggers from Settings.
- Captures the **minimum** inputs needed to (a) produce a rough tax
  estimate and (b) seed the in-app forms with draft values.
- Branches on the user's selected income addons so a pure-salaried user
  finishes in ~4 turns and the heaviest profile caps at ~14.
- Hands off to the full app with a "these are estimates — verify each
  form" message. The wizard NEVER submits the return.

## High-level architecture

```
┌──────────┐   POST /api/wizard/turn    ┌─────────────────────┐
│  Wizard  │ ─────────────────────────▶ │  Flow controller    │
│  UI      │                            │  (deterministic SM) │
│ (web +   │ ◀───── { assistant_msg,    └────────┬────────────┘
│  mobile) │       prompt_schema,                │
└──────────┘       progress_pct }                ▼
                                          ┌─────────────────┐
                                          │ AI consultant   │
                                          │ (DeepSeek) —    │
                                          │ extracts values │
                                          │ from user reply │
                                          │ ONLY            │
                                          └─────────────────┘
```

Three layers, intentionally split:

1. **Flow controller** (`backend/src/services/wizardEngine.js`) — pure
   state machine over `shared/wizardFieldMap.js`. Owns "what to ask
   next" and "is this answer valid for this field."
2. **AI extraction** — reuses the existing AI consultant client with a
   wizard-specific system prompt. Given `prompt_schema` + the user's
   free-text reply, returns a structured `{ values, confidence,
   uncertainty }` object. NO flow decisions.
3. **Finalize writer** (`backend/src/services/wizardFinalize.js`) — at
   `/api/wizard/finalize`, takes `captured_data` and writes to form
   tables as draft rows. Pure SQL, no LLM.

Why split: tax data must be exact. The LLM is great at parsing
"15 lakhs" → 1500000, but bad at "which question to ask third for a
salaried user with rental income." Letting the LLM drive the flow would
produce inconsistent experiences and risk hallucinated number defaults.

## Wizard sessions

```sql
CREATE TABLE wizard_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tax_year_id     UUID NOT NULL REFERENCES tax_years(id),
  tax_year        VARCHAR(10) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
                  -- 'in_progress' | 'completed' | 'abandoned'
  current_step    VARCHAR(50),
  captured_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  rough_calc      JSONB,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT wizard_sessions_unique_active
    UNIQUE (user_id, tax_year_id, status) DEFERRABLE INITIALLY DEFERRED
);
```

Gating rule:

- One `completed` session per `(user_id, tax_year_id)`. If one exists,
  `POST /api/wizard/start` returns 409 with `{ error: 'wizard_already_completed' }`.
  `POST /api/wizard/reset` clears it (audit-logged).
- One `in_progress` session per `(user_id, tax_year_id)` at a time.
  Returning to the wizard while `in_progress` resumes from
  `current_step` — never restarts.
- On re-run, `captured_data` from the prior completed session is loaded
  as the starting point of the new session so the user is editing, not
  re-typing.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/wizard/status` | jwt | `{ completed, in_progress, can_resume, last_completed_at }` — feeds the dashboard CTA |
| `POST` | `/api/wizard/start` | jwt | Idempotent. 409 if completed exists (unless `?force=true`). Returns `{ session_id, first_step }`. |
| `POST` | `/api/wizard/turn` | jwt | Body `{ session_id, step_id, raw_reply? , values? }`. Server validates, advances, returns next step's `prompt`, `prompt_schema`, `progress`, and any `assistant_msg` (the LLM's confirmation echo: "Got it — ₨1,500,000. Correct?"). |
| `POST` | `/api/wizard/finalize` | jwt | Commits `captured_data` to draft form rows, calls `/api/tax-computation` preview, returns `rough_calc`. Marks session `completed`. |
| `POST` | `/api/wizard/reset` | jwt | Marks `completed` → `abandoned`, starts fresh. Audit-logged. |

## Conversation walkthroughs

_The "Review" item in each walkthrough below is rendered by the client when the engine returns `done: true`. It's NOT a wizard step — `progress.total` from the engine is the input-step count only. So "4 turns" below = 3 input steps + 1 review screen._

### Pure salaried (no addons) — **3 input steps + review**

```
1. Income summary
   Prompt: "Let's start with your salary. What did you earn this year?
            You can find these on your salary slips or annual certificate."
   Fields: annual_basic_salary [PKR, required]
           allowances [PKR, optional]
           bonus [PKR, optional]

2. Salary WHT
   Prompt: "How much income tax did your employer deduct this year?
            That's the total under 'tax deducted' (s.149) on your slips."
   Fields: salary_tax_deducted [PKR, required]

3. Common deductions
   Prompt: "Did you pay any Zakat this year? Donate to approved charities?
            Skip either if not."
   Fields: zakat_paid_amount [PKR, optional]
           charitable_donations_amount [PKR, optional]

4. Review
   Shows: total income, taxable income, normal tax, surcharge, tax
   already paid, balance payable/refundable. "Open the app to verify
   each form in detail before submitting."
```

### Salaried + bank profit (very common in Pakistan) — **4 input steps + review**

Adds the bank_profit step (deposit profit amount + WHT the bank deducted).

### Salaried + bank + dividends — **5 input steps + review**

Adds the dividends step too.

### Heaviest profile (all 11 income addons) — **14 input steps + review**

```
1.  salary_basics
2.  salary_wht
3.  common_deductions
4.  bank_profit
5.  dividends
6.  securities
7.  sukuk
8.  rental
9.  property_gain          (3 fields: amount, holding-period bucket, WHT)
10. directorship
11. foreign_income
12. prizes
13. pension
14. agriculture            (declaration only — not in tax calc)
15. review
```

## What the wizard intentionally does NOT cover

- **Wealth statement / reconciliation.** It's a balance-sheet
  declaration, not a tax driver, and far too detailed for a quick
  intake. Done in the full app.
- **Adjustable tax beyond salary WHT and rental WHT.** Electricity,
  phone, vehicle, immovable-property transfer taxes are typically small
  per-line items where the user has to look up exact amounts from
  bills — bad for a fast conversational flow. The full app has all 28
  s.231–236 lines.
- **CGT on securities sub-buckets** (the 14 sub-rate categories on
  `capital_gain_forms`). The wizard collects one "total securities
  gain" + one "total CGT deducted" and dumps both into the highest-
  frequency bucket (`securities` / `securities_tax_deducted`). User
  reallocates in detail in the app.
- **Reductions** (teacher, Behbood, export, industrial undertaking) —
  most users have none; the few who do can fill them in the app.
- **Credits beyond charitable donations** — pension fund, life
  insurance, investment shares are all yes/no-with-amount and not
  worth the conversational turn for the median user.

These omissions are deliberate. The wizard's value is "get to a credible
rough number in under 90 seconds" — not "replace the full app."

## Finalize behaviour (what `/api/wizard/finalize` does)

Pseudocode:

```js
async function finalize(session) {
  await beginTx();

  // Use existing ensureTaxReturn helper to get the tax_return_id.
  const trId = await ensureTaxReturn(session.user_id, session.tax_year);

  // For each step's fields, write to the target form table.
  // Pure deterministic — no LLM call here.
  for (const [stepId, values] of Object.entries(session.captured_data)) {
    const step = STEPS_BY_ID[stepId];
    for (const field of step.fields) {
      if (!field.target) continue;  // declaration-only fields
      const value = values[field.key];
      if (value == null) continue;
      await upsertFormColumn(field.target.table, field.target.column, value, trId);
    }
  }

  // property_gain has the bucket-routing logic; handled separately.

  const roughCalc = await taxComputation.preview(session.tax_year, ...);

  await updateSession(session.id, {
    status: 'completed',
    rough_calc: roughCalc,
    completed_at: NOW(),
  });

  await commitTx();
  return { roughCalc, draft_forms: [...] };  // for the UI handoff
}
```

Forms touched on finalize (by addon profile):

- Always: `income_forms`, `adjustable_tax_forms`, `deductions_forms`,
  `credits_forms`
- `bank_profit` / `dividends` / `sukuk` / `prizes`: also `final_min_income_forms`
- `securities` / `property_gain`: also `capital_gain_forms`
- `rental` / `directorship` / `foreign_income`: additional columns on
  the forms above

Every write goes through `ON CONFLICT (user_id, tax_year) DO UPDATE`
patterns (the `tax_returns_user_year_unique` constraint from `phase-x`
+ the form-table uniques from `phase-d` make this safe).

## AI prompts

Two distinct system prompts, both stored in `consultantService.js`-style
constants:

**WIZARD_EXTRACTOR** — given the current step's `prompt_schema` and the
user's reply, return JSON only. Strict: refuses to chat, refuses to
"help with" anything outside extraction. Reuses the existing safety
guards (input pre-check, output post-check) from
`safetyGuards.js`.

**WIZARD_ECHO** — given the extracted values, generate the brief
confirmation echo ("Got it — ₨1,500,000 basic salary, ₨150,000
allowances. Correct?"). Output cap: 30 words. No questions other than
"correct?".

Total LLM calls per wizard run: ~2 per turn (extract + echo) × 4-15
turns = 8-30 calls per completion. Each is small (< 200 tokens out),
runs against DeepSeek, average cost trivially under a rupee per
completion.

## UI shells

Same chat-like UI on both platforms. Structured input widgets per
field type (numeric pad / currency picker / yes-no / select). User
sees the assistant's question + structured inputs + an optional
free-text box. Sending either commits the turn.

Web: `Frontend/src/components/Wizard/` — full-screen modal mode and
embedded mode (for the dashboard CTA "tap to expand"). Re-trigger
button in `Settings/ConnectedAccounts.js`-adjacent section.

Mobile: `mobile/src/screens/WizardScreen.js` — full-screen, single
turn per scroll page. Settings re-trigger mirrors web.

Both gate on `/api/wizard/status` at app boot and show a dismissible
banner on the dashboard until completion.

## Open questions for review

These need a sign-off before any code lands:

1. **Field map sign-off** — is the column-target choice for each step
   correct given how the production data actually flows? Particular
   concern: `bank_profit` → `final_min_income_forms.profit_on_debt_u_s_7b`
   vs the dozen other "profit on debt" buckets. I picked the most
   commonly-used per `_computeFromInputs`. If your real users use
   different rate brackets (e.g. defence-savings), we may need a
   sub-question or a different default column.
2. **Property gain holding-period buckets** — current map uses three
   buckets (under 1 year / 1-3 / 4+). The CGT engine has 7+ buckets
   on `capital_gain_forms`. Three is the right scale for a wizard but
   reduces accuracy.
3. **Reset semantics** — should `reset` archive the prior session
   (soft-delete) or hard-delete it? I'd lean archive (audit trail).
4. **Mobile-side LLM** — the wizard backend handles the LLM call; the
   mobile shell just sends the user's text. So no extra mobile
   dependency. Confirm that's what you'd expected.
