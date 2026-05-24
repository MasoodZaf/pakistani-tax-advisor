// Wizard field map — declarative source of truth for the AI quick-start wizard.
//
// One STEP per conversational turn. Each step has:
//   id            — stable identifier (used by the session state machine)
//   prompt        — natural-language prompt the LLM speaks to the user
//   addon_gate    — if set, step only fires when the user's income_profile.addons
//                   contains at least one of these IDs. Empty/undefined = always.
//   fields        — array of input fields collected this turn. The wizard UI
//                   renders structured widgets per field (numeric pad, picker,
//                   etc.) and the LLM extracts values from the user's free-text
//                   reply.
//   tax_impact    — 'high' | 'medium' | 'low' | 'declaration_only'. Used by
//                   the wizard UI to surface "this is why we're asking" cues.
//
// Each FIELD has:
//   key           — local key within the step
//   target        — { table, column } — where this value lands when the wizard
//                   commits to draft form rows on finalize
//   prompt        — short label for the input widget
//   input_type    — 'number' | 'pkr_amount' | 'pkr_optional' | 'select' | 'yn'
//   options       — for select/yn types
//   required      — true if the step cannot complete without this field
//   default       — value used if user skips (only meaningful when required=false)
//
// The income addon catalog (CATEGORIES from web Onboarding):
//   bank_profit, dividends, securities, sukuk, rental, property_gain,
//   directorship, foreign_income, prizes, pension, agriculture
//
// Caps: median user (salaried + 0-2 addons) sees 4-7 turns + computation
// review. Heaviest profile (all 11 addons) sees 15 turns. Anything beyond
// the wizard belongs in the full in-app forms.

const STEPS = [
  // ── Always asked (salaried baseline) ──────────────────────────────────────
  {
    id: 'salary_basics',
    prompt:
      "Let's start with your salary. What did you earn this year? You can find these numbers on your salary slips or your annual salary certificate.",
    tax_impact: 'high',
    fields: [
      {
        key: 'annual_basic_salary',
        target: { table: 'income_forms', column: 'annual_basic_salary' },
        prompt: 'Annual basic salary',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'allowances',
        target: { table: 'income_forms', column: 'allowances' },
        prompt: 'Allowances (house rent, conveyance, etc.)',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
      {
        key: 'bonus',
        target: { table: 'income_forms', column: 'bonus' },
        prompt: 'Annual bonus (if any)',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },
  {
    id: 'salary_wht',
    prompt:
      "How much income tax did your employer deduct from your salary this year? This is the total on your salary slips under 'tax deducted' (section 149).",
    tax_impact: 'high',
    fields: [
      {
        key: 'salary_tax_deducted',
        target: {
          table: 'adjustable_tax_forms',
          column: 'salary_employees_149_tax_collected',
        },
        prompt: 'Total tax deducted by employer',
        input_type: 'pkr_amount',
        required: true,
      },
    ],
  },
  {
    id: 'common_deductions',
    prompt:
      "A couple of quick deduction questions. Did you pay any Zakat this year, and did you donate to any approved charities? Skip either if not.",
    tax_impact: 'medium',
    fields: [
      {
        key: 'zakat_paid_amount',
        target: { table: 'deductions_forms', column: 'zakat_paid_amount' },
        prompt: 'Zakat paid (under the Zakat Ordinance)',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
      {
        key: 'charitable_donations_amount',
        target: { table: 'credits_forms', column: 'charitable_donations_amount' },
        prompt: 'Donations to approved charities',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  // ── Conditional on selected addons ────────────────────────────────────────
  // Each addon contributes one compound turn. Addon ID matches the
  // INCOME_STREAMS catalog in Frontend/src/components/Onboarding/.

  {
    id: 'bank_profit',
    addon_gate: ['bank_profit'],
    prompt:
      "You mentioned bank/savings profit. How much profit did you earn on bank deposits, NSS, or savings certificates this year, and how much tax did the bank deduct?",
    tax_impact: 'high',
    fields: [
      {
        key: 'profit_amount',
        target: {
          table: 'final_min_income_forms',
          column: 'profit_on_debt_u_s_7b',
        },
        prompt: 'Profit earned on deposits / NSS',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'profit_wht',
        target: {
          table: 'adjustable_tax_forms',
          column: 'profit_debt_151_15_tax_collected',
        },
        prompt: 'Tax deducted by bank',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'dividends',
    addon_gate: ['dividends'],
    prompt:
      "You mentioned dividends. What's the total dividend amount you received this year (across all shares), and the tax deducted on those dividends?",
    tax_impact: 'high',
    fields: [
      {
        key: 'dividend_amount',
        target: {
          table: 'final_min_income_forms',
          column: 'dividend_u_s_150_31_atl_15pc',
        },
        prompt: 'Total dividends received',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'dividend_wht',
        target: {
          table: 'final_min_income_forms',
          column: 'dividend_u_s_150_31pc_atl_tax_deducted',
        },
        prompt: 'Tax deducted on dividends',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'securities',
    addon_gate: ['securities'],
    prompt:
      "On your listed shares / mutual funds / REITs — what's the total capital gain (sale minus purchase) for the year, and the CGT deducted by the broker or AMC?",
    tax_impact: 'high',
    fields: [
      {
        key: 'securities_gain',
        target: { table: 'capital_gain_forms', column: 'securities' },
        prompt: 'Capital gain on listed securities',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'securities_wht',
        target: { table: 'capital_gain_forms', column: 'securities_tax_deducted' },
        prompt: 'CGT deducted at source',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'sukuk',
    addon_gate: ['sukuk'],
    prompt:
      "How much profit did you earn on sukuk or Islamic bond instruments this year, and the tax deducted on that?",
    tax_impact: 'high',
    fields: [
      {
        key: 'sukuk_amount',
        target: {
          table: 'final_min_income_forms',
          column: 'return_invest_exceed_1m_sukuk_saa_12_5pc',
        },
        prompt: 'Sukuk / bond income',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'sukuk_wht',
        target: {
          table: 'final_min_income_forms',
          column: 'return_invest_exceed_1m_sukuk_saa_12_5pc_tax_deducted',
        },
        prompt: 'Tax deducted',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'rental',
    addon_gate: ['rental'],
    prompt:
      "Your rental income — total annual rent received this year, and the tax your tenant deducted (under section 155) before paying you.",
    tax_impact: 'high',
    fields: [
      {
        key: 'rental_gross',
        target: { table: 'income_forms', column: 'other_taxable_income_rent' },
        prompt: 'Annual rent received',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'rental_wht',
        target: {
          table: 'adjustable_tax_forms',
          column: 'tax_deducted_rent_section_155_tax_collected',
        },
        prompt: 'Tax deducted by tenant',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'property_gain',
    addon_gate: ['property_gain'],
    prompt:
      "On the property you sold — what was the gain (sale price minus purchase price), how long did you own it, and the tax already paid (under section 236C)?",
    tax_impact: 'high',
    fields: [
      {
        key: 'holding_bucket',
        target: { table: 'capital_gain_forms', column: 'property_1_year' },
        prompt: 'Holding period',
        input_type: 'select',
        options: [
          { value: 'within_1_year', label: 'Under 1 year' },
          { value: '1_to_3_years', label: '1 to 3 years' },
          { value: '4_plus_years', label: '4+ years' },
        ],
        required: true,
        // The runtime maps this bucket to the right column:
        //   within_1_year → property_1_year + property_1_year_tax_deducted
        //   1_to_3_years  → property_2_3_years + property_2_3_years_tax_deducted
        //   4_plus_years  → property_4_plus_years + property_4_plus_years_tax_deducted
        // See backend/src/services/wizardFinalize.js for the mapping logic.
        routes_to_bucket: true,
      },
      {
        key: 'property_gain_amount',
        target: { table: 'capital_gain_forms', column: 'property_1_year' },
        prompt: 'Gain on sale (PKR)',
        input_type: 'pkr_amount',
        required: true,
        routes_with: 'holding_bucket',
      },
      {
        key: 'property_gain_wht',
        target: {
          table: 'capital_gain_forms',
          column: 'property_1_year_tax_deducted',
        },
        prompt: 'Tax paid at registry (section 236C)',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
        routes_with: 'holding_bucket',
      },
    ],
  },

  {
    id: 'directorship',
    addon_gate: ['directorship'],
    prompt:
      "On board / directorship fees you received — total amount, and tax deducted by the company (section 149(3)).",
    tax_impact: 'medium',
    fields: [
      {
        key: 'director_fee',
        target: { table: 'income_forms', column: 'directorship_fee' },
        prompt: 'Directorship fees received',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'director_wht',
        target: {
          table: 'adjustable_tax_forms',
          column: 'directorship_fee_149_3_tax_collected',
        },
        prompt: 'Tax deducted on fees',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'foreign_income',
    addon_gate: ['foreign_income'],
    prompt:
      "Your foreign income — total declared amount this year, and any foreign tax you already paid that we can credit (under the foreign tax credit rules).",
    tax_impact: 'medium',
    fields: [
      {
        key: 'foreign_income_amount',
        target: { table: 'income_forms', column: 'other_taxable_income_others' },
        prompt: 'Foreign income / remittances',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'foreign_tax_paid',
        target: {
          table: 'deductions_forms',
          column: 'tax_paid_foreign_country',
        },
        prompt: 'Foreign tax paid (credit)',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'prizes',
    addon_gate: ['prizes'],
    prompt:
      "Prize bonds / lottery winnings — total amount won, and tax deducted at source (under section 156).",
    tax_impact: 'medium',
    fields: [
      {
        key: 'prize_amount',
        target: {
          table: 'final_min_income_forms',
          column: 'prize_bond_cross_world_puzzle_156',
        },
        prompt: 'Prize amount',
        input_type: 'pkr_amount',
        required: true,
      },
      {
        key: 'prize_wht',
        target: {
          table: 'final_min_income_forms',
          column: 'prize_bond_cross_world_puzzle_156_tax_deducted',
        },
        prompt: 'Tax deducted at source',
        input_type: 'pkr_optional',
        required: false,
        default: 0,
      },
    ],
  },

  {
    id: 'pension',
    addon_gate: ['pension'],
    prompt:
      "Pension from a former employer — total annual pension. Note: pension up to Rs 10 million is exempt under Finance Act 2025; above that becomes taxable.",
    tax_impact: 'low',
    fields: [
      {
        key: 'pension_amount',
        target: { table: 'income_forms', column: 'pension_from_ex_employer' },
        prompt: 'Annual pension from former employer',
        input_type: 'pkr_amount',
        required: true,
      },
    ],
  },

  {
    id: 'agriculture',
    addon_gate: ['agriculture'],
    prompt:
      "Agricultural income is federally exempt but FBR requires the declaration. Roughly how much agricultural income did you have this year?",
    tax_impact: 'declaration_only',
    fields: [
      {
        key: 'agriculture_amount',
        // No column update for tax computation — agriculture is federally
        // exempt. Stored in captured_data only for the user's reference; the
        // full app's wealth statement carries the declaration field.
        target: null,
        prompt: 'Agricultural income (declaration only)',
        input_type: 'pkr_amount',
        required: true,
      },
    ],
  },
];

// Quick lookup by id (used by the session state machine).
const STEPS_BY_ID = Object.freeze(
  STEPS.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {})
);

// Helper: given the user's selected addons, return the ordered list of
// step ids the wizard will visit. Salary baseline (steps with no addon_gate)
// always runs; addon-gated steps fire when their gate intersects `addons`.
function stepsForAddons(addons = []) {
  const set = new Set(addons || []);
  return STEPS
    .filter((s) => {
      if (!s.addon_gate || s.addon_gate.length === 0) return true;
      return s.addon_gate.some((id) => set.has(id));
    })
    .map((s) => s.id);
}

// Helper: count of compound turns a given addon-profile produces. Used by
// the wizard UI for the "you're on step X of Y" progress bar.
function stepCount(addons = []) {
  return stepsForAddons(addons).length;
}

// Helper for the property_gain step: maps the holding-period bucket to the
// correct capital_gain_forms column pair so finalize knows where to write.
const PROPERTY_BUCKET_TO_COLUMNS = Object.freeze({
  within_1_year: {
    amount: 'property_1_year',
    wht: 'property_1_year_tax_deducted',
  },
  '1_to_3_years': {
    amount: 'property_2_3_years',
    wht: 'property_2_3_years_tax_deducted',
  },
  '4_plus_years': {
    amount: 'property_4_plus_years',
    wht: 'property_4_plus_years_tax_deducted',
  },
});

module.exports = {
  STEPS: Object.freeze(STEPS),
  STEPS_BY_ID,
  PROPERTY_BUCKET_TO_COLUMNS,
  stepsForAddons,
  stepCount,
};
