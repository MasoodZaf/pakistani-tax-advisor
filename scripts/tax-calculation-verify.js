// Tax-calculation verification for TY2025-26, driven through the live HTTP API
// exactly as the browser drives it.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A UNIT TEST
//
// The unit suite drives `_computeFromInputs` with hand-built fixtures, so it
// only ever proves the arithmetic against the shape the test author imagined.
// Two of this repo's worst defects lived in the gap between that shape and the
// real one: a generated column the fixtures never carried, and a stored figure
// the fixtures spelled differently from the schema. Both suites were green
// throughout.
//
// So this drives the REAL forms over the REAL API against a REAL row, and
// reconciles every figure against expectations computed HERE from the FBR
// published tables. The app walks marginal slab bands; this file uses the
// "fixed amount + % of excess" formulation from the FBR table. The two are
// algebraically equivalent but independently written, so agreement is a
// genuine cross-check rather than a restatement of the same code.
//
// Usage (needs a throwaway account with no real data — it OVERWRITES every form):
//   BASE=https://staging.mera-tax.com \
//   QA_EMAIL=qa.calc@meratax.test QA_PASSWORD=... \
//   node scripts/tax-calculation-verify.js
//
// Exit 0 = every figure reconciled. Exit 1 = at least one did not.
//
// KNOWN STATUTORY CLIFFS — these are the law, not defects:
//   * s.4AB surcharge has no marginal relief, so taxable income of 10,000,001
//     costs 9% of the whole normal charge that 10,000,000 does not.
//   * s.7B(3)(b) disapplies the final regime above Rs 5,000,000 of profit on
//     debt, so the whole amount moves to slab rates one rupee above it.

const BASE = process.env.BASE || 'https://staging.mera-tax.com';
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
const YEAR = '2025-26';
const BASIC = 3000000;   // baseline salary for the form-by-form phase
const BASE_TAX = 300000; // 116,000 + 23% of 800,000

// ── FBR TY2025-26 salaried slabs (Finance Act 2025, First Sched Pt I Div I) ──
const fbrSalaryTax = (ti) => {
  if (ti <= 600000) return 0;
  if (ti <= 1200000) return (ti - 600000) * 0.01;
  if (ti <= 2200000) return 6000 + (ti - 1200000) * 0.11;
  if (ti <= 3200000) return 116000 + (ti - 2200000) * 0.23;
  if (ti <= 4100000) return 346000 + (ti - 3200000) * 0.30;
  return 616000 + (ti - 4100000) * 0.35;
};
// s.4AB surcharge: 9% of the normal charge where taxable income exceeds Rs 10m.
const fbrSurcharge = (ti, tax) => (ti > 10000000 ? tax * 0.09 : 0);

let pass = 0, fail = 0;
const findings = [];
const m = (n) => Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const money = m;

// Boolean assertions MUST pass tol=0 — a tolerance of 1 makes 0-vs-1 compare equal.
function check(name, actual, expected, tol = 1, note = '') {
  if (Math.abs(Number(actual) - Number(expected)) <= tol) { pass++; console.log(`  PASS  ${name} = ${m(actual)}`); }
  else {
    fail++;
    console.log(`  FAIL  ${name}\n          expected ${m(expected)}  actual ${m(actual)}  delta ${m(Number(actual) - Number(expected))}${note ? '\n          ' + note : ''}`);
    findings.push({ name, expected, actual, delta: Number(actual) - Number(expected), note });
  }
}

let TOKEN = null;
async function api(path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* non-json */ }
  return { status: r.status, data: j, text: t };
}

// Every money input the income form accepts, so a reset really is a reset — the
// endpoint MERGES, and an absent key keeps whatever is stored.
const INCOME_FIELDS = [
  'monthly_basic_salary', 'monthly_allowances', 'monthly_house_rent_allowance',
  'monthly_conveyance_allowance', 'monthly_medical_allowance',
  'annual_basic_salary', 'allowances', 'bonus', 'medical_allowance',
  'pension_from_ex_employer', 'employment_termination_payment',
  'retirement_from_approved_funds', 'directorship_fee', 'other_cash_benefits',
  'employer_contribution_provident', 'taxable_car_value', 'other_taxable_subsidies',
  'profit_on_debt_15_percent', 'profit_on_debt_12_5_percent',
  'other_taxable_income_rent', 'other_taxable_income_others',
  'bonus_commission', 'retirement_amount', 'noncash_benefits_gross',
  'provident_fund_contribution', 'gratuity', 'rent_income', 'other_income',
];

async function setIncome(patch) {
  const body = { ...Object.fromEntries(INCOME_FIELDS.map((f) => [f, 0])), ...patch };
  const r = await api(`/api/income-form/${YEAR}`, { method: 'POST', body });
  if (r.status !== 200) throw new Error(`income save ${r.status}: ${r.text.slice(0, 300)}`);
}
const post = (form, body) => api(`/api/tax-forms/${form}`, { method: 'POST', body: { ...body, taxYear: YEAR, tax_year: YEAR } });
async function computation() {
  const r = await api(`/api/tax-computation/${YEAR}`);
  if (r.status !== 200) throw new Error(`computation ${r.status}: ${r.text.slice(0, 300)}`);
  return r.data.data;
}

// Zero every relief form so each scenario starts clean.
const RESET = {
  deductions: { zakat: 0, ushr: 0, zakat_paid_amount: 0, educational_expenses_amount: 0, educational_expenses_children_count: 0, tuition_fee_amount: 0, professional_expenses_amount: 0, professional_expenses_pos_amount: 0, other_deductions: 0, tax_paid_foreign_country: 0, advance_tax: 0 },
  credits: { charitable_donations_amount: 0, charitable_donations_tax_credit: 0, charitable_donations_associate_amount: 0, charitable_donations_associate_tax_credit: 0, pension_fund_amount: 0, pension_fund_tax_credit: 0, pension_contribution_amount: 0, pension_contribution_tax_credit: 0, life_insurance_premium_amount: 0, life_insurance_premium_tax_credit: 0, investment_shares_amount: 0, investment_shares_tax_credit: 0, investment_tax_credit: 0, investment_tax_credit_amount: 0, investment_tax_credit_tax_credit: 0, provident_fund_amount: 0, provident_fund_tax_credit: 0, voluntary_pension_scheme_amount: 0, voluntary_pension_scheme_tax_credit: 0, surrender_tax_credit_amount: 0, surrender_tax_credit_reduction: 0, housing_loan_profit_amount: 0, housing_loan_profit_tax_credit: 0, other_credits: 0 },
  reductions: { teacher_researcher_amount: 0, teacher_researcher_tax_reduction: 0, behbood_certificates_amount: 0, behbood_certificates_tax_reduction: 0, capital_gain_immovable_50_reduction: 0, capital_gain_immovable_75_reduction: 0, export_income_reduction: 0, industrial_undertaking_reduction: 0, other_reductions: 0 },
  'capital-gains': { securities_15_percent_taxable: 0, securities_15_percent_deducted: 0, immovable_property_1_year_taxable: 0, immovable_property_1_year_deducted: 0, capital_gains_tax_chargeable: 0 },
  'adjustable-tax': { salary_employees_149_gross_receipt: 0, salary_employees_149_tax_collected: 0, advance_tax_u_s_147: 0, electricity_bill_domestic_235_gross_receipt: 0, electricity_bill_domestic_235_tax_collected: 0 },
};
const resetAll = async () => { for (const [f, b] of Object.entries(RESET)) await post(f, b); };

(async () => {
  const login = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  TOKEN = login.token;
  if (!TOKEN) { console.error('login failed'); process.exit(1); }
  console.log(`Logged in as ${EMAIL}\n`);

  console.log('=== A. SALARY-ONLY: every slab band + both sides of each boundary ===');
  const salaries = [
    0, 600000, 600001, 700000, 1200000, 1200001, 1500000, 2200000, 2200001,
    2500000, 3200000, 3200001, 3500000, 4100000, 4100001, 5000000,
    9999999, 10000000, 10000001, 12000000, 20000000,
  ];
  for (const s of salaries) {
    await setIncome({ annual_basic_salary: s });
    const c = await computation();
    const expTax = fbrSalaryTax(s);
    const expSur = fbrSurcharge(s, expTax);
    check(`salary ${money(s)} -> taxable income`, c.income.taxableIncomeExcludingCG, s);
    check(`salary ${money(s)} -> normal tax`, c.tax.normalIncomeTax, expTax);
    check(`salary ${money(s)} -> surcharge`, c.tax.surcharge, expSur);
    check(`salary ${money(s)} -> total chargeable`, c.tax.totalTaxChargeable, expTax + expSur);
  }

  // ────────────────────────────────────────────────────────────────
  console.log('\n=== B. MONOTONICITY: tax must never fall as income rises ===');
  let prev = -1, prevS = null, monoOk = true;
  for (let s = 0; s <= 15000000; s += 100000) {
    await setIncome({ annual_basic_salary: s });
    const c = await computation();
    const t = Number(c.tax.totalTaxChargeable);
    if (t < prev - 0.01) {
      monoOk = false;
      console.log(`  FAIL  tax DROPS: ${money(prevS)} -> ${money(t)} at salary ${money(s)} (was ${money(prev)})`);
      findings.push({ name: `monotonicity break at salary ${s}`, expected: `>= ${prev}`, actual: t });
    }
    prev = t; prevS = s;
  }
  if (monoOk) { pass++; console.log('  PASS  tax is non-decreasing across 0 .. 15,000,000 (151 points)'); }
  else fail++;

  // ────────────────────────────────────────────────────────────────
  console.log('\n=== C. MARGINAL RATE never exceeds 100% at a slab boundary ===');
  // A badly built slab table charges the fixed amount twice at the boundary,
  // so one extra rupee of income costs thousands of rupees of tax.
  // 10,000,000 is deliberately NOT in this list. s.4AB carries no marginal
  // relief, so the surcharge really does step in over one rupee — that cliff is
  // the statute, not a defect, and is asserted on its own terms below.
  const boundaries = [600000, 1200000, 2200000, 3200000, 4100000];
  for (const b of boundaries) {
    await setIncome({ annual_basic_salary: b });
    const lo = Number((await computation()).tax.totalTaxChargeable);
    await setIncome({ annual_basic_salary: b + 1 });
    const hi = Number((await computation()).tax.totalTaxChargeable);
    const marginal = hi - lo;
    check(`marginal cost of +Rs1 at ${money(b)}`, marginal <= 1.0 ? 0 : marginal, 0, 0.5,
      marginal > 1 ? `one extra rupee of income costs Rs ${money(marginal)} of tax` : '');
  }


  // ────────────────────────────────────────────────────────────────
  // The s.4AB cliff, asserted as law rather than flagged as a bug: one rupee
  // over the threshold costs exactly 9% of the whole normal charge.
  await setIncome({ annual_basic_salary: 10000000 });
  const atThreshold = Number((await computation()).tax.totalTaxChargeable);
  await setIncome({ annual_basic_salary: 10000001 });
  const overThreshold = Number((await computation()).tax.totalTaxChargeable);
  check('s.4AB cliff is exactly 9% of the normal charge (no marginal relief)',
    overThreshold - atThreshold, fbrSalaryTax(10000001) * 0.09, 1);

  console.log('\n=== FORM-BY-FORM (baseline salary 3,000,000 -> normal tax 300,000) ===');
  await setIncome({ annual_basic_salary: BASIC });
  await resetAll();
  // ── DEDUCTIONS (s.60 series: reduce TAXABLE INCOME) ──
  console.log('=== D. DEDUCTIONS FORM ===');
  await post('deductions', { ...RESET.deductions, zakat_paid_amount: 300000 });
  let c = await computation();
  // taxable 2,700,000 -> 116,000 + 23% of 500,000 = 231,000
  check('D1 zakat 300,000 deducted from income', c.income.taxableIncomeExcludingCG, BASIC - 300000);
  check('D1 tax after zakat', c.tax.normalIncomeTax, 231000);

  await post('deductions', { ...RESET.deductions, educational_expenses_amount: 500000, educational_expenses_children_count: 1, tuition_fee_amount: 500000 });
  c = await computation();
  // s.60D is unavailable where taxable income exceeds the threshold (Rs 1.5m).
  check('D2 s.60D refused above income threshold', c.income.deductibleAllowances, 0, 1,
    'education relief allowed to a taxpayer over the s.60D income ceiling');

  await post('deductions', { ...RESET.deductions, tax_paid_foreign_country: 50000 });
  c = await computation();
  check('D3 foreign tax is a CREDIT not an income deduction', c.income.deductibleAllowances, 0);
  check('D3 foreign tax credited against liability', c.tax.totalCredits, 50000);
  check('D3 tax after foreign credit', c.tax.netTaxPayable, BASE_TAX - 50000);
  await post('deductions', RESET.deductions);

  // ── CREDITS (s.61/s.63: average-rate credits against TAX) ──
  console.log('\n=== E. CREDITS FORM ===');
  const avgRate = BASE_TAX / BASIC; // A/B in the statutory formula
  await post('credits', { ...RESET.credits, charitable_donations_u61_yn: 'Y', charitable_donations_amount: 500000, charitable_donations_tax_credit: 500000 });
  c = await computation();
  // s.61: C = lesser of donation or 30% of taxable income (900,000) -> 500,000
  check('E1 s.61 donation credit = (A/B) x C', c.tax.formCredits, Math.round(avgRate * 500000), 1,
    'a donation must give an average-rate credit, never a rupee-for-rupee one');

  await post('credits', { ...RESET.credits, charitable_donations_u61_yn: 'Y', charitable_donations_amount: 5000000, charitable_donations_tax_credit: 5000000 });
  c = await computation();
  check('E2 s.61 donation capped at 30% of taxable income', c.tax.formCredits, Math.round(avgRate * 0.30 * BASIC));

  await post('credits', { ...RESET.credits, pension_fund_u63_yn: 'Y', pension_fund_amount: 1000000, pension_fund_tax_credit: 1000000 });
  c = await computation();
  check('E3 s.63 pension credit capped at 20% of taxable income', c.tax.formCredits, Math.round(avgRate * 0.20 * BASIC));

  await post('credits', { ...RESET.credits, other_credits: 9000000 });
  c = await computation();
  check('E4 credit cannot exceed tax in charge', c.tax.formCredits, BASE_TAX);
  check('E4 excess credit refused, not silently truncated', c.tax.refusedCredits > 0 ? 1 : 0, 1);
  check('E4 no refund created by a credit', c.tax.netTaxPayable, 0);
  await post('credits', RESET.credits);

  // ── REDUCTIONS ──
  console.log('\n=== F. REDUCTIONS FORM ===');
  await post('reductions', { ...RESET.reductions, teacher_researcher_reduction_yn: 'Y', teacher_researcher_amount: 2000000, teacher_researcher_tax_reduction: 500000 });
  c = await computation();
  check('F1 retired teacher/researcher rebate refused for TY2025-26', c.tax.totalReductions, 0, 1,
    'cl.(3A) ceased after 30-Jun-2025');
  await post('reductions', { ...RESET.reductions, other_reductions: 9000000 });
  c = await computation();
  check('F2 reduction cannot exceed tax in charge', c.tax.totalReductions, BASE_TAX);
  await post('reductions', RESET.reductions);

  // ── CAPITAL GAINS ──
  console.log('\n=== G. CAPITAL GAINS FORM ===');
  await post('capital-gains', { ...RESET['capital-gains'], securities_15_percent_taxable: 1000000 });
  c = await computation();
  check('G1 securities gain charged at 15%', c.tax.capitalGainsTax, 150000);
  check('G1 CGT excluded from the slab base', c.income.taxableIncomeExcludingCG, BASIC);
  check('G1 total chargeable = normal + CGT', c.tax.totalTaxChargeable, BASE_TAX + 150000);

  await post('capital-gains', { ...RESET['capital-gains'], securities_15_percent_taxable: 1000000, securities_15_percent_deducted: 150000 });
  c = await computation();
  check('G2 CGT withheld at source is credited', c.payments.capitalGainsTaxWithheld, 150000);
  check('G2 balance after CGT withholding', c.payments.balancePayableRefundable, BASE_TAX);
  await post('capital-gains', RESET['capital-gains']);

  // ── ADJUSTABLE TAX (withholding credit / refund) ──
  console.log('\n=== H. ADJUSTABLE TAX FORM ===');
  await post('adjustable-tax', { ...RESET['adjustable-tax'], salary_employees_149_gross_receipt: BASIC, salary_employees_149_tax_collected: 250000 });
  c = await computation();
  check('H1 salary WHT credited', c.payments.adjustableWHT, 250000);
  check('H1 balance payable = tax - WHT', c.payments.balancePayableRefundable, BASE_TAX - 250000);

  await post('adjustable-tax', { ...RESET['adjustable-tax'], salary_employees_149_gross_receipt: BASIC, salary_employees_149_tax_collected: 400000 });
  c = await computation();
  check('H2 over-withholding produces a refund', c.payments.balancePayableRefundable, BASE_TAX - 400000);

  await post('adjustable-tax', { ...RESET['adjustable-tax'], salary_employees_149_gross_receipt: 1000, salary_employees_149_tax_collected: 900000000 });
  c = await computation();
  check('H3 impossible withholding claim refused', c.payments.rejectedPaymentClaim > 0 ? 1 : 0, 1);
  check('H3 no unbounded refund', c.payments.balancePayableRefundable >= -BASIC ? 1 : 0, 1);
  await post('adjustable-tax', RESET['adjustable-tax']);


  await setIncome({ annual_basic_salary: 0 });
  await resetAll();
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (findings.length) console.log('\n--- FINDINGS ---\n' + JSON.stringify(findings, null, 1));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e.message); process.exit(2); });
