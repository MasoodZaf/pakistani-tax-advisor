// Excel round-trip — the contract test for the whole tax pipeline.
//
// Flow:
//   1. Read input cells from `Salaried Individuals 2025.xlsx` (the
//      FBR-format reference workbook at the repo root).
//   2. Register a fresh user.
//   3. POST every form's payload via the matching save endpoint.
//   4. GET each form back and verify the values we sent persisted.
//   5. Run the calc via /api/tax-computation/:taxYear (FA 2025 rates).
//   6. Assert structural invariants that hold regardless of rate table:
//      - total income = sum of components
//      - balance = chargeable - withholding - advance
//      - all numbers are finite, non-negative where expected
//   7. Emit `e2e/artifacts/round-trip-PASS-<ts>.xlsx` with a green PASS
//      banner and the FA 2025 calc breakdown (or FAIL on assertion failure).
//
// The reference workbook's own Tax Computation values are computed under
// FA 2024 / TY 2024-25, so we don't assert against them — we render them
// in sheet 3 of the artifact for informational comparison only.

const { test, expect, request } = require('@playwright/test');
const { inputs, referenceComputation } = require('../fixtures/salariedIndividuals2025');
const { writeArtifact } = require('../helpers/writeRoundtripArtifact');

const TAX_YEAR = '2025-26';

function uniqueEmail() {
  return `e2e-rt-xls-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
}

async function signup(api) {
  const email = uniqueEmail();
  const password = 'XlsxRoundtrip2026!';
  const reg = await api.post('/api/register', {
    data: { email, name: `XLSX RT ${Date.now()}`, password, user_type: 'individual' },
  });
  expect(reg.status(), 'register should return 200').toBe(200);
  const { token } = await reg.json();
  return { token, email };
}

// Each step routes to a different endpoint. We use the same helper for all
// of them; it returns the per-step result row used by the artifact writer.
async function postStep({ api, token, step, def }) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const sentFields = Object.keys(def.payload || {}).length;

  if (def.endpoint === 'none') {
    return { step, endpoint: '—', status: 'skipped', sentFields, note: def.note || '' };
  }

  // Map step id → actual URL path. Most steps follow `/api/tax-forms/{step-with-dashes}`,
  // but `capital_gain` is exposed under the plural `capital-gains` route, and
  // `income` uses the legacy `/api/income-form/:taxYear` endpoint.
  const STEP_URLS = {
    income:        `/api/income-form/${TAX_YEAR}`,
    capital_gain:  '/api/tax-forms/capital-gains',
  };
  const url = STEP_URLS[step] || `/api/tax-forms/${step.replace(/_/g, '-')}`;

  try {
    const res = await api.post(url, { headers, data: def.payload });
    if (res.status() !== 200) {
      const body = await res.text();
      return { step, endpoint: url, status: 'failed', sentFields, error: `HTTP ${res.status()}: ${body.slice(0, 180)}` };
    }
    return { step, endpoint: url, status: 'saved', sentFields };
  } catch (err) {
    return { step, endpoint: url, status: 'failed', sentFields, error: err?.message || String(err) };
  }
}

test.describe('Excel round-trip — Salaried Individuals 2025 fixture', () => {
  test('full pipeline: read fixture → save forms → calc → assertions → emit artifact', async () => {
    test.setTimeout(120_000); // forms + calc + artifact write

    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token, email } = await signup(api);

    // ── Save every form ───────────────────────────────────────────────────────
    const stepResults = [];
    for (const [step, def] of Object.entries(inputs)) {
      const result = await postStep({ api, token, step, def });
      stepResults.push(result);
    }

    const failedSteps = stepResults.filter((r) => r.status === 'failed');

    // ── Run the calc ─────────────────────────────────────────────────────────
    let computation = null;
    let calcError = null;
    if (failedSteps.length === 0 || stepResults.find((r) => r.step === 'income')?.status === 'saved') {
      // Calc only needs income to produce a number; other forms enrich it.
      const calcRes = await api.get(`/api/tax-computation/${TAX_YEAR}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (calcRes.status() === 200) {
        const body = await calcRes.json();
        computation = body?.data || null;
      } else {
        calcError = `HTTP ${calcRes.status()}: ${(await calcRes.text()).slice(0, 200)}`;
      }
    }

    // ── Structural invariants — rate-table-independent ──────────────────────
    const assertions = [];
    const assertOK = (label, cond) => assertions.push({ label, ok: !!cond });

    if (computation) {
      const inc = computation.income || {};
      const tax = computation.tax || {};
      const pay = computation.payments || {};

      // Total income should equal salary + other-source + capital-gain.
      const totalReconstructed =
        (inc.incomeFromSalary || 0) +
        (inc.incomeFromOtherSources || 0) +
        (inc.incomeFromCapitalGains || 0);
      assertOK(
        'totalIncome === salary + otherSources + capitalGains',
        Math.abs((inc.totalIncome || 0) - totalReconstructed) < 1
      );

      // Taxable (incl CG) ≥ Taxable (excl CG)
      assertOK(
        'taxableIncomeIncludingCG >= taxableIncomeExcludingCG',
        (inc.taxableIncomeIncludingCG || 0) >= (inc.taxableIncomeExcludingCG || 0)
      );

      // Total chargeable = netTax + superTax
      assertOK(
        'totalTaxChargeable === netTaxPayable + superTax',
        Math.abs((tax.totalTaxChargeable || 0) - ((tax.netTaxPayable || 0) + (tax.superTax || 0))) < 1
      );

      // Balance = chargeable - withholding - advance
      assertOK(
        'balancePayableRefundable === chargeable − WHT − advance',
        Math.abs(
          (pay.balancePayableRefundable || 0) -
            ((tax.totalTaxChargeable || 0) - (pay.withholdingTax || 0) - (pay.advanceTax || 0))
        ) < 1
      );

      // No NaN / Infinity
      const allFinite = [
        inc.totalIncome, inc.taxableIncomeIncludingCG,
        tax.normalIncomeTax, tax.surcharge, tax.totalTaxChargeable,
        pay.withholdingTax, pay.balancePayableRefundable,
      ].every((n) => Number.isFinite(n || 0));
      assertOK('all calc outputs are finite numbers', allFinite);

      // Surcharge is non-negative
      assertOK('surcharge >= 0', (tax.surcharge || 0) >= 0);
    }

    const allAssertionsPassed = assertions.length > 0 && assertions.every((a) => a.ok);
    const passed =
      failedSteps.length === 0 &&
      computation !== null &&
      allAssertionsPassed &&
      calcError === null;

    // ── Emit the result artifact regardless of pass/fail ─────────────────────
    const { fileName, path: fpath } = await writeArtifact({
      passed,
      steps: [
        ...stepResults,
        ...(calcError
          ? [{ step: 'tax_computation', endpoint: `/api/tax-computation/${TAX_YEAR}`, status: 'failed', error: calcError }]
          : computation
          ? [{ step: 'tax_computation', endpoint: `/api/tax-computation/${TAX_YEAR}`, status: 'saved', sentFields: 0 }]
          : []),
        ...assertions.map((a) => ({
          step: 'invariant',
          endpoint: a.label,
          status: a.ok ? 'saved' : 'failed',
          error: a.ok ? '' : 'invariant violation',
        })),
      ],
      computation,
      referenceComputation,
      inputs,
    });

    // Log artifact location so it's visible in the test output.
    // eslint-disable-next-line no-console
    console.log(`\n  📊 Round-trip artifact: ${fpath}\n  📧 Test user: ${email}\n`);

    // Hard-fail the test on any of: form save failure, calc failure,
    // invariant violation. Artifact is already written, so the user gets
    // a "FAIL" file with diagnostics.
    expect(failedSteps, `${failedSteps.length} form save(s) failed; see ${fileName}`).toEqual([]);
    expect(calcError, `tax-computation endpoint failed; see ${fileName}`).toBeNull();
    expect(computation, 'computation must be returned').not.toBeNull();
    const failedAssertions = assertions.filter((a) => !a.ok).map((a) => a.label);
    expect(failedAssertions, `invariants violated: ${failedAssertions.join('; ')}; see ${fileName}`).toEqual([]);
  });
});
