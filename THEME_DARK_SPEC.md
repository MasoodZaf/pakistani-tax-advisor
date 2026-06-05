# UX-07 Dark Mode — Theming Spec (canonical mapping)

Infra is DONE: `darkMode:'class'` in tailwind.config; ThemeProvider toggles `.dark` +
`data-theme="dark"` on `<html>` (no-flash bootstrap in public/index.html); index.css
defines a semantic CSS-variable token layer that flips under `.dark`/`[data-theme="dark"]`.

**Two theming techniques depending on how a file holds its colors:**

## A) Inline-styled files (`<style>` blocks + `style={{}}` props with literal hex)
Replace **light** surface/text/border literals with the matching CSS variable. The var's
LIGHT value is byte-identical to the literal (so light mode is provably unchanged) and it
auto-flips in dark. Worked example: `Frontend/src/components/Layout/Header.js` (already done).

Literal → variable map (ONLY where the literal plays this role):
| role                         | light literal(s)                          | use variable            |
|------------------------------|-------------------------------------------|-------------------------|
| page background              | `#fdfcf8`                                  | `var(--surface)`        |
| card / panel / dropdown bg   | `#fff` `#ffffff`                           | `var(--surface-raised)` |
| inset/sunken well bg         | `#f8fafc` `#fafaf8` `#f5f7fb` `#f1f5f9`    | `var(--surface-sunken)` |
| hairline border / divider    | `#e3e2dc` `#e5e4de` `#f0efeb` `#e0dfd9` `#eae9e3` `#e5e7eb` | `var(--line)` |
| hover background (lime tint)  | `#f5f8ea`                                 | `var(--brand-hover-bg)` |
| primary text / heading       | `#1c1d1a` `#1e2a4a` `#3d3e37`              | `var(--content)`        |
| secondary text               | `#5c5d55` `#6b6c64` `#4b4d45` `#4a5575`    | `var(--content-muted)`  |
| tertiary/subtle text         | `#7a8890` `#9ca3af` `#b0b1a9`              | `var(--content-subtle)` |
| cream badge bg               | `#F0FFC2`                                  | `var(--brand-cream)`    |
| cream badge border           | `#c0da94` `#eae6bc`                        | `var(--brand-cream-track)` |
| text/icon ON a cream badge   | `#3d6020`                                  | `var(--brand-on-cream)` |

**KEEP as literals (already dark-friendly — do NOT touch):**
- Brand navy chrome: `#28396C` `#1e2d5a` `#1e2a4a`(as a bg) `#3d5a90` — navy panels/buttons read as raised surfaces on the dark page.
- White text/icons ON navy/colored buttons: `#fff` when it's foreground on a navy/colored bg → STAYS `#fff`.
- Lime accent: `#B5E18B` `#c0da94`(as accent dot) `#d4f09a`.
- Semantic status colors: red `#c0392b` `#ef4444` `#f87171`; green `#4a7a2a` `#3d6020`(as standalone text, not on cream); amber `#f59e0b` `#b45309`; info blues. For status *backgrounds* that are pale tints (e.g. `#fdf2f2`, `#fef3c7`, `#eff6ff`, `#f0fdfa`, `#f5f3ff`, `#fff5f5`), add a `[data-theme="dark"] .selector { background: <dark tint>; color: <light status> }` override in the `<style>` block, OR leave if it's a rare/minor element. Prefer overrides for prominent status banners.

**Disambiguation rule:** `#fff` is a card background → `var(--surface-raised)`; but `#fff` as text color on a navy/colored element → stays `#fff`. Judge by role, never blind-replace.

For `<style>`-block rules that need a different dark value than the var gives (e.g. status tints), append `[data-theme="dark"] .class { … }` overrides at the end of the block.
lucide `color="..."` props accept `var(--...)` — convert decorative gray icon colors too.

## B) Tailwind-utility files (`className="bg-white text-gray-900 …"`)
Add **additive** `dark:` variants. Never remove the light utility. Mapping:
| light utility            | add dark variant            |
|--------------------------|-----------------------------|
| `bg-white`               | `dark:bg-[#151c30]`         |
| `bg-gray-50`             | `dark:bg-[#0f1426]`         |
| `bg-gray-100`            | `dark:bg-[#1a2238]`         |
| `text-gray-900`/`-800`   | `dark:text-[#e7eaf3]`       |
| `text-gray-700`/`-600`   | `dark:text-[#aab2cc]`       |
| `text-gray-500`/`-400`   | `dark:text-[#7e88a6]`       |
| `border-gray-200`/`-300` | `dark:border-[#2a3450]`     |
| `divide-gray-100`/`-200` | `dark:divide-[#2a3450]`     |
| `bg-navy`,`text-navy`    | keep (brand) — navy reads on dark; for `text-navy` headings on a now-dark card add `dark:text-[#e7eaf3]` only if contrast fails |
| semantic `red/green/amber/blue` text | keep; for pale `bg-*-50` status tiles add `dark:bg-[#…]/20` or a dark tint |
| `bg-lime`,`text-lime`    | keep (accent)               |
| `shadow-*`               | keep                        |
| `placeholder-gray-400`   | `dark:placeholder-[#7e88a6]`|

Preserve semantic meaning: payable=red, refund=green stay red/green in BOTH modes.

## Verification per file
1. `npm run build` green.
2. grep: no light-mode regression (the file's existing light utilities/literals untouched).
3. For inline files: `grep` shows surface/text/border literals replaced with vars; brand/status literals remain.
4. Browser check in BOTH themes (final sweep).
