# MeraTax Design System — MASTER

> Global Source of Truth for all UI work on MeraTax (web). Page-specific
> deviations live in `design-system/pages/<page>.md` and OVERRIDE this file.
> Dark-mode token mapping is canonical in `THEME_DARK_SPEC.md` (repo root) —
> this file summarises it; that file wins on conflict.

## Identity

- **Product**: FBR-compliant Pakistan income-tax preparation (web + mobile companion).
- **Audience**: predominantly independent salaried/investor/business filers; secondary: tax consultants and admins.
- **Tone**: trustworthy, calm, precise, human. Money software — never playful at the expense of clarity, never bureaucratic.
- **Logo**: navy tile with white "M" whose centre stroke is a lime checkmark. Single source artwork: `Frontend/src/components/common/BrandMark.js` (= `Frontend/public/favicon.svg`).

## Style

**Refined minimal + warm paper.** Light mode sits on a warm off-white (`#fdfcf8`),
cards are pure white with hairline borders and soft, large-radius shadows. Lime
is an *accent voltage*, used sparingly (badges, checks, the brand underline,
key numbers in dark mode) — navy carries authority. NOT glassmorphism, NOT
gradient-heavy; depth comes from layering and one soft glow at most per view.

**Anti-patterns (avoid):**
- Purple/indigo gradients, generic SaaS glass cards, rainbow KPI tiles (removed in UX-05 — do not reintroduce).
- Navy text/icons placed directly on the dark page background (fails contrast — use the `.land-brand-ink`-style class pattern that flips navy → lime under `[data-theme="dark"]`).
- Inline `style={{ color: '#28396C' }}` literals on anything that must theme-flip — inline styles defeat the dark override. Use a className + token.
- New hardcoded hex values for surfaces/text/borders — use the CSS variables below.

## Color tokens (CSS vars in `Frontend/src/index.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-navy` | `#28396C` | — | Primary brand ink, buttons, headings accent |
| `--brand-lime` | `#B5E18B` | — | Accent, checks, dark-mode brand ink |
| `--brand-cream` | `#F0FFC2` | `#1a2238` | Badge/result-box fills |
| `--surface` | `#fdfcf8` | `#0b1020` | Page background |
| `--surface-raised` | `#ffffff` | `#151c30` | Cards, panels, modals |
| `--surface-sunken` | `#f8fafc` | `#0a0e1c` | Inset wells, body |
| `--content` | `#1c1d1a` | `#e7eaf3` | Primary text |
| `--content-muted` | `#4b5563` | `#aab2cc` | Secondary text |
| `--content-subtle` | `#6b7280` | `#7e88a6` | Tertiary text — smallest text only |
| `--line` | `#e3e2dc` | `#2a3450` | Hairline borders |
| `--brand-on-cream` | `#3d6020` | `#B5E18B` | Green ink on cream/lime fills |
| `--brand-on-cream-navy` | `#28396C` | `#B5E18B` | Navy ink on cream/lime fills |

Rules:
- Contrast: body text ≥ 4.5:1 in BOTH modes. `--content-subtle` is borderline — never below 12px, never for body copy.
- Navy on dark page = forbidden. Anything brand-navy that sits on `--surface` needs a dark override to lime (`.land-brand-ink` pattern).
- Admin screens may use the Tailwind dark literals already established (`dark:bg-[#151c30]`, `dark:text-[#e7eaf3]`, `dark:border-[#2a3450]`) — same palette, utility form.

## Typography

- **Display / headings**: Bricolage Grotesque (class `display`), 700–800, tight letter-spacing (−0.02 to −0.03em).
- **Body / UI**: Nunito 400–700. Legacy forms still carry Inter — do not add NEW Inter usage.
- Loaded ONCE in `public/index.html` (UX-06) — never `@import` fonts in components.
- Body ≥ 15–16px; line-height 1.5–1.7 for copy; 65–75ch max line length for prose.

## Components & patterns

- **Buttons**: `.btn-primary` navy fill / white text, radius 10–12px, hover darkens + `translateY(-1px)`; `.btn-secondary` outline lime-soft. Min touch target 44×44 (py ≥ 11px). Always `cursor-pointer`, visible `:focus-visible` ring.
- **Cards**: `--surface-raised`, `1px solid var(--line)`, radius 12–20px, shadow `0 8–24px 40–64px rgba(26,28,24,0.07–0.10)`.
- **Badges/pills**: cream fill + `--brand-on-cream*` ink, radius 100px.
- **Forms**: the 12-form navy/lime kit (FORMS_MODERNIZATION_PLAN) — labelled inputs (`<label for>`), inputMode set, error text adjacent to the field.
- **Icons**: lucide-react, fixed sizes (13–24px). Decorative emojis exist in legacy step/stream definitions — contained; do NOT introduce emoji icons in new UI chrome.
- **Motion**: 150–300ms micro-interactions; entrances staggered ≤ 0.7s ease-out; everything inside `@media (prefers-reduced-motion: reduce)` guards (see `.hero-rise` pattern). Use transform/opacity only.
- **Loading**: `Skeleton` component (admin tables) or brand spinner; reserve space — no content jumping.

## Dark mode

Token flip under `.dark` + `[data-theme="dark"]` (both selectors). No-flash
bootstrap script in `index.html`. **Audit rule (learned the hard way, twice):**
check BOTH classNames AND inline-`style={{}}` literals — inline colors silently
defeat the dark override.

## Voice & microcopy

- Plain English, Pakistan context (Rs with lakh grouping `Rs 24,00,000`, FBR/IRIS/ATL terms explained on first use).
- Numbers shown to users must be mathematically exact under the live Finance Act slabs — marketing mocks included (see Landing hero comment).
- "Mera = mine" — ownership/privacy framing is part of the brand voice.

## Pre-delivery checklist (every UI PR)

- [ ] Both themes screenshotted (light + dark), 375 / 768 / 1440px
- [ ] No new inline color literals on theme-flipping text
- [ ] `cursor-pointer` + hover feedback + `:focus-visible` on interactive elements
- [ ] Touch targets ≥ 44px on mobile breakpoints
- [ ] `prefers-reduced-motion` respected for any new animation
- [ ] Form fields labelled; errors adjacent; `aria-label` on icon-only buttons
- [ ] PKR figures slab-exact if user-visible
