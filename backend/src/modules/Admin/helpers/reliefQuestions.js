/**
 * The catalogue of open legal questions the application must answer on every
 * return, and how each one maps onto `tax_rates_config`.
 *
 * Kept separate from the route so it can be read — and tested — without pulling
 * in auth, the DB pool or the audit log. It is also the contract the admin
 * screen renders: the UI has no catalogue of its own, so adding a question here
 * surfaces it with no frontend change.
 *
 * See `routes/statutoryReliefs.js` for why these are settings rather than
 * constants, and phase-z19 / phase-z20 for the FBR research behind each.
 */

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * The catalogue. Each entry describes ONE decision, the rows behind it, and how
 * to read and write it. Adding a question here is how a future open point gets
 * surfaced instead of buried in a commit message.
 *
 * `control` tells the UI what to render:
 *   'choice'  — pick one of `options` (each option is a set of row values)
 *   'toggle'  — on/off, flipping `is_active` on every row in `rows`
 *   'params'  — supply numbers for the named `fields`, which also enables it
 */
const RELIEF_QUESTIONS = [
  {
    key: 'education_threshold_operator',
    title: 'Education allowance u/s 60D — income threshold wording',
    citation: 'ITO 2001 s.60D(2)',
    status: 'unsettled',
    question:
      'Is the allowance available where taxable income is "less than" Rs 1,500,000, or where it '
      + '"does not exceed" Rs 1,500,000?',
    whyItMatters:
      'It changes the answer for exactly one taxpayer: the one whose taxable income is precisely '
      + 'the threshold. Below it, both readings allow the allowance; above it, neither does.',
    background:
      'Secondary sources are split on the wording, and the app has no copy of the primary text to '
      + 'settle it. The strict reading ("less than") is what ships, because it denies a relief at '
      + 'the boundary rather than granting one that may not exist. Nothing about that default is a '
      + 'legal opinion — it is simply the safer of two possibilities.',
    ifYouChangeIt:
      'Choosing the inclusive reading grants the allowance to taxpayers sitting exactly on the '
      + 'threshold. It takes effect on the next save or recalculation of any affected return; '
      + 'returns already filed are not revisited.',
    control: 'choice',
    rows: [{ rateType: 'deduction_threshold', category: 'education_threshold_inclusive' }],
    options: [
      {
        value: 'strict',
        label: 'Less than Rs 1,500,000 (strict) — currently shipping',
        detail: 'A taxpayer at exactly the threshold is NOT eligible.',
        write: { tax_rate: 0 },
      },
      {
        value: 'inclusive',
        label: 'Does not exceed Rs 1,500,000 (inclusive)',
        detail: 'A taxpayer at exactly the threshold IS eligible.',
        write: { tax_rate: 1 },
      },
    ],
    readValue: (rows) => (toNum(rows[0]?.tax_rate) === 1 ? 'inclusive' : 'strict'),
  },
  {
    key: 'professional_expenses_allowance',
    title: '"Professional expenses" deductible allowance',
    citation: 'previously cited to ITO 2001 s.60C — see background',
    status: 'retired',
    question:
      'Does any provision allow a deductible allowance for professional or point-of-sale '
      + 'expenses? If your counsel identifies one, enable it here and record the authority.',
    whyItMatters:
      'While it was enabled, it reduced tax with no legal basis the research could find. Measured '
      + 'on staging: a salary of Rs 1,400,000 with Rs 1,000,000 of "professional expenses" had its '
      + 'tax cut from Rs 28,000 to Rs 4,500. That is an understated return, which is the '
      + 'taxpayer\'s exposure, not the app\'s.',
    background:
      'The app cited s.60C. s.60C was the deductible allowance for PROFIT ON DEBT — profit or '
      + 'share in rent paid on a loan to construct or acquire a house, capped at the lower of 50% '
      + 'of taxable income or Rs 2,000,000 — and it was omitted by Finance Act 2022. It never '
      + 'covered professional or point-of-sale expenses. The 5% / 25% / Rs 1.5M figures the app '
      + 'used are s.60D\'s own limbs, transcribed onto a deduction that does not exist. Retired by '
      + 'phase-z19; the rows are deactivated rather than deleted so this history survives.',
    ifYouChangeIt:
      'Enabling it restores a deduction the research could not cite. Do this only with a specific '
      + 'provision, and put that provision in the note below — it is what the app will show as its '
      + 'authority, and what an audit will be judged on.',
    control: 'toggle',
    rows: [
      { rateType: 'deduction_threshold', category: 'prof_expenses_max_taxable_income' },
      { rateType: 'deduction_threshold', category: 'prof_expenses_pos_amount_pct' },
      { rateType: 'deduction_threshold', category: 'prof_expenses_taxable_income_pct' },
    ],
    // All three rows must move together: the limit helper needs every one of
    // them, and a half-enabled relief would fail the save with a 503.
    readValue: (rows) => (rows.some((r) => r?.is_active) ? 'enabled' : 'disabled'),
  },
  {
    key: 'housing_loan_profit_credit',
    title: 'Housing-loan profit-on-debt tax credit (Finance Act 2025)',
    citation: 'Finance Act 2025 — housing profit-on-debt credit',
    status: 'not_implemented',
    question:
      'What is the maximum eligible amount for this credit? Supply a percentage of taxable '
      + 'income and/or an absolute rupee ceiling and the app will start offering the relief.',
    whyItMatters:
      'This one runs the OTHER way from the two above: the app does not offer the credit at all, '
      + 'so every taxpayer entitled to it is over-paying. It is the only item here where doing '
      + 'nothing costs your users money.',
    background:
      'Finance Act 2025 reintroduced housing relief for profit on debt — on a house up to 2,500 '
      + 'sq ft or a flat up to 2,000 sq ft, not claimable again for 15 years — as a TAX CREDIT '
      + 'rather than the deductible allowance the repealed s.60C provided. The research could not '
      + 'establish the quantum from a primary source, and a guessed ceiling on a credit is exactly '
      + 'the error that produced the "professional expenses" problem above. So the mechanism is '
      + 'built and inert: with no parameters here, the credit is not offered and the input for it '
      + 'is not shown on the Credits form.',
    ifYouChangeIt:
      'Once configured, the Credits form gains a "profit on debt on your own house" input. The '
      + 'credit is the average rate applied to the LEAST of the profit paid, the percentage of '
      + 'taxable income you set, and the rupee ceiling you set. Leave either limb at 0 to switch '
      + 'that limb off. The 2,500 sq ft / 2,000 sq ft and 15-year conditions are NOT enforced by '
      + 'the app — they are questions of fact about the property, and the return relies on the '
      + 'taxpayer\'s own declaration.',
    control: 'params',
    rows: [{ rateType: 'credit_cap', category: 'housing_loan_profit_on_debt' }],
    fields: [
      {
        name: 'tax_rate',
        label: 'Cap as a share of taxable income',
        hint: 'Enter 0.30 for 30%. Enter 0 to disable this limb.',
        kind: 'rate',
      },
      {
        name: 'fixed_amount',
        label: 'Absolute rupee ceiling',
        hint: 'Enter 2000000 for Rs 2,000,000. Enter 0 to disable this limb.',
        kind: 'money',
      },
    ],
    readValue: (rows) => (rows[0]?.is_active ? 'configured' : 'not_configured'),
  },
];

const BY_KEY = new Map(RELIEF_QUESTIONS.map((q) => [q.key, q]));


module.exports = { RELIEF_QUESTIONS, BY_KEY, toNum };
