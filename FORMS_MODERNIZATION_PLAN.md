# Tax-Forms Modernization Plan (UX-01 · UX-04 · A11Y-01–04 · UX-03)

_Created 2026-06-01. Covers the "dated tax-form layer" gap from the 2026-06-01 audit — the screens where users spend ~90% of their time. Grounded in a full read of the 3 highest-traffic forms (IncomeForm 1046L, AdjustableTaxForm 1401L, TaxComputationSummary 827L)._

## 0. Foundation — DONE (UX-06)
Brand tokens are now centralized (the prerequisite for everything below):
- `tailwind.config.js`: `navy`/`lime`/`cream`/`ink` colors, `font-display` (Bricolage), `font-body` (Nunito), `rounded-brand`, `shadow-brand`.
- `src/index.css`: `:root` brand CSS variables (single source of truth).
- `public/index.html`: Bricolage + Nunito + Inter loaded **once**; 9 duplicate per-component `@import`s removed.

> Deferred from UX-06 into this work: converting the hardcoded brand hex literals inside the shell components' `<style>` blocks to `var(--brand-*)` — done per-file as each is visually verified during the retheme.

## 1. Strategy — build a shared form kit FIRST
Every one of the 3 forms independently flagged the same root cause: the row/section/shell markup is copy-pasted 14–30× per file. **Extracting ~6 components is the single highest-leverage move** — each UX/responsive/a11y fix is then made once and inherited by all 11 forms under `modules/IncomeTax/components/*` and `modules/WealthStatement/*`.

Build under `Frontend/src/components/forms/`:

| Component | Responsibility (kills which findings) |
|---|---|
| **`TaxFormShell`** | page wrapper (max-w, responsive `p-4 sm:p-6`), navy card header bar, section title, footer **`FormNav`** (Prev/Save/Submit, stacks on mobile), and **`FormStateScreen`** (loading/error/no-data — dedupes the 3–4 copy-pasted guard branches). |
| **`CollapsibleSection`** | real `<button>` header + `aria-expanded`/`aria-controls` + chevron + `role="region"` panel → fixes **A11Y-04** everywhere. |
| **`TaxFormRow`** | label+input; auto-wires `id`/`htmlFor` (**A11Y-01**); ONE input treatment; **responsive stack-below-`sm`** (**UX-04**); `inputMode="numeric"` currency; shared comma-format `onChange`; error slot with `aria-invalid`/`aria-describedby`/`role="alert"` (**A11Y-02**); HelpHint slot. |
| **`AmountRow`** | read-only computation row (label + tabular-nums amount); `variant`: `line \| subtotal(navy) \| total \| payable(red) \| refund(green)` — **sign-aware**; optional NumberTrace. |
| **`CalculatedRow`** | derived/mirror input, single slate read-only treatment. |
| **`AdjustableTaxRow`** | the 3-control withholding row (ATL `<select>` + gross + tax), responsive + a11y. |

## 2. Design contract (the semantic-color rule)
- **Chrome** navy `#28396C`; **accent** lime `#B5E18B`; surfaces white / `cream.bg`.
- **ONE** input treatment, **ONE** calculated/read-only treatment, **ONE** subtotal treatment (navy-tint, e.g. `bg-navy/5 border-l-4 border-navy`).
- **Color reserved for meaning only:** `red` = payable to FBR, `green`/`lime` = refund/credit (driven by the value's sign), `amber` = warning, `red` = error. Nothing decorative.
- **Delete:** per-section rainbow hues (`getColorClasses`), gradient KPI tiles, yellow row highlights, and all stray blue/purple/indigo/green decoration.
- **Type:** headings `font-display`, body `font-body` (migrates forms off Inter); `tabular-nums`/`font-mono` on all amounts.

## 3. Sequencing (each phase = one PR, build + verify between)
1. **Kit + token retheme** — build the 6 components against the UX-06 tokens; add navy/lime brand variants to `index.css` component classes (`.form-input`, `.btn-primary`, `.card`) or new `.btn-brand`/`.card-brand`. _~1.5–2 d._
2. **TaxComputationSummary first** (Medium, read-only → lowest risk; proves the kit): route ~20 rows through `AmountRow`, navy chrome, **sign-aware payable/refund** (reuse the existing line-766 sign ternary), delete the dead `useForm`/`setValue`, jargon copy, faux-table → real `<table>`/ARIA. _~1 d._
3. **IncomeForm** (High): `TaxFormRow`×16 + `CalculatedRow`×9 + `CollapsibleSection`×4; responsive; error infra; **strip Excel jargon** ("Excel Formula B16", "SUM(B19:B22)", "(Database Field)", toast "Excel calculations applied"); scope the bare `watch()` (PERF-02). _~1.5–2 d._
4. **AdjustableTaxForm** (High, structural): hoist `SectionComponent` out, dedupe the two ~150-line payload builders into `buildPayload()`, collapse 14 auto-calc `useEffect`s into one table-driven effect, build `AdjustableTaxRow`; delete `getColorClasses` + 9 `color` props; responsive; a11y on ~60 inputs; de-jargon ("Input cell"/"Income sheet", statute citations → secondary). _~4–6 d._
5. **Roll out to the remaining 8 forms** (DeductionsForm, CreditsForm, ReductionsForm, ExpensesForm, FinalTaxForm, CapitalGainsForm, FinalMinIncomeForm, WealthStatementForm, WealthReconciliationForm) — now thin kit consumers. _~2–3 d._
6. **Shared modal a11y (A11Y-03):** focus-trap/restore + `aria-modal` in `HelpHint.js`, `NumberTrace.js`, `PriorYearUploadModal.js`, Admin modals (or adopt `@headlessui/react`). _~1–1.5 d._
7. **Cross-cutting a11y polish:** skip-to-content link, `prefers-reduced-motion`, icon-button `aria-label`s, landing-nav `<span>`→`<button>`, global `:focus-visible`. _~1 d._

**Total ≈ 12–17 dev-days.** Phases 1–3 deliver the visible win (the brand seam disappears on the highest-traffic screens, forms work at 375px, worst a11y defects fixed).

## 4. Per-form specifics (from the deep read)

### TaxComputationSummary.js (827L · Medium · read-only)
- **Styling:** `primary-*` Save + refund-input ring → navy; `bg-blue-600`/`bg-blue-100` header & col-header → navy chrome; 6× `bg-blue-50` subtotals + 1× green "Total Tax Chargeable" (a *liability*, wrongly green) → ONE navy subtotal treatment; **final "Demanded/(Refundable)" row is statically red even when it's a refund** → make sign-aware; Print(blue)/Export(green) → one neutral secondary; "Complete Tax Return" green CTA → navy/lime.
- **Responsive:** ~20 `grid-cols-12` rows, 0 prefixes → `AmountRow` stacks below `sm`; responsive `p-3 sm:p-4 md:p-6` (dup'd across 4 branches).
- **A11Y:** refund input needs `id`+`<label>`; `ratesError` block needs `role="alert"`; Help toggle needs `aria-expanded`/`aria-controls`; faux-table → real table; sign conveyed by text not color alone.
- **Jargon:** "Demanded/(Refundable)"→"Tax payable"/"Refund due"; move "Finance Act 2025"/"u/s 4C" citations into HelpHint; "WHT"→"withholding tax".
- **Cleanup:** delete the dead `useForm`/`setValue` plumbing.

### IncomeForm.js (1046L · High)
- **Styling:** `primary` buttons + `bg-blue-900` header + blue/indigo banners + **yellow highlight rows** + green/purple/indigo **rainbow subtotal tiles** → navy chrome + ONE input/calculated/subtotal treatment (all income subtotals navy, never red/green).
- **Responsive:** 26 `grid-cols-12` rows, 0 prefixes → `TaxFormRow` stacks; hide 2-col header below `md`; `p-4 sm:p-6`; stack header/banner/nav.
- **A11Y:** 16 inputs with no `id`/`htmlFor`; **no error infra at all** (pull `formState.errors`); 4 clickable-`div` section headers → `CollapsibleSection`; `aria-live` on live totals; empty subtotal `<label>` at L911; `role="status"` loader; icon-only Info button label.
- **Jargon:** L684 "SUM…(Excel Formula B16)", L800 "MIN(…)-Excel Formula B22", L813 "SUM(B19:B22)-Excel Formula B23", L826 "(Database Field)", toasts L247/L273 "Excel calculations".
- **Perf:** bare `watch()` (L126) re-renders 1046 lines/keystroke → scope it.

### AdjustableTaxForm.js (1401L · High · structural)
- **Styling:** `getColorClasses()` maps 9 categories to 9 hues (biggest noise source) → delete + drop 9 `color` props; auto-fetched(blue)/auto-calc(purple) input states → neutral fill + icon, not hue; `bg-gray-800` bars → navy; totals "Tax Collected" is a credit → lime/green; retarget/replace `primary`.
- **Responsive:** 2 `grid-cols-12` (row + header bar), 0 prefixes → `AdjustableTaxRow` stacks with per-input mobile labels; hide header bar below `md`; ATL select full-width on mobile; stack totals/nav/header.
- **A11Y:** ~60 inputs + ATL select with no `id`/`htmlFor`; errors lack `role=alert`/`aria-invalid`/`aria-describedby`; clickable-`div` headers → buttons; icon-only reset button label; `aria-readonly` on auto-fetched.
- **Jargon:** "Input cell", "Income sheet", "Auto-calc"; statute citations (`u/s 149`, `236C`, …) → small/muted secondary under a plain-language primary name.
- **Structure:** hoist `SectionComponent` (remounts every render); `buildPayload(data, isComplete)` to kill the two duplicated ~150-line objects; collapse 14 auto-calc effects → 1 table-driven; remove dead prop-drilling.

## 5. Verification per phase
- `CI=false npm run build` green; manual check at **375px**; axe/Lighthouse a11y pass; visual diff of shell pages (no regression); per-form screenshot before deploy.
- Deploy in batches (one PR per phase) via the canonical 2-file compose flow; the migration adds no DB/runtime risk.
