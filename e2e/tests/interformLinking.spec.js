// Inter-form data flow checks.
//
// These cover the "broken auto-population between forms" symptom the user
// hit during manual testing:
//   - Income form → Adjustable Tax (salary / profit-debt / rent gross receipts)
//   - Income form → FinalMinIncome (salary row auto-populate)
//   - Capital Gains → FinalMinIncome (capital gain row auto-populate)
//   - FinalMin → Reductions (salary_u_s_12_7_tax_chargeable for teacher reduction)
//   - Full tax-computation preview with DB-sourced rates

const { test, expect, request } = require('@playwright/test');

function uniqueEmail() {
  return `e2e-link-${Date.now()}-${Math.floor(Math.random() * 1e6)}@playwright.test`;
}

async function signup(api) {
  const email = uniqueEmail();
  const password = 'LinkingSmoke123!';
  const name = `Link User ${Date.now()}`;
  const reg = await api.post('/api/register', {
    data: { email, name, password, user_type: 'individual' },
  });
  expect(reg.status()).toBe(200);
  const { token } = await reg.json();
  return { token, email };
}

test.describe('Inter-form data linking', () => {
  test('income → adjustable-tax auto-links salary gross receipt', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token } = await signup(api);
    const headers = { Authorization: `Bearer ${token}` };

    // Save an income form with a known annual salary.
    const annualSalary = 2000000;
    const incomeSave = await api.post('/api/income-form/2025-26', {
      headers,
      data: {
        annual_basic_salary: annualSalary,
        bonus: 100000,
      },
    });
    expect(incomeSave.status(), 'income POST').toBe(200);

    // Fetch adjustable-tax — the handler should pull the salary into
    // salary_employees_149_gross_receipt on the GET side.
    const adj = await api.get('/api/tax-forms/adjustable-tax', { headers });
    expect(adj.status()).toBe(200);
    const body = await adj.json();
    const got = parseFloat(body?.data?.salary_employees_149_gross_receipt) || 0;
    // Expect non-zero: the income form seeded annual_basic_salary, and the
    // adjustable-tax auto-link reads from income_forms. Exact value depends on
    // how the income form's computed columns roll up the salary.
    expect(got, 'salary_employees_149_gross_receipt should auto-link from income').toBeGreaterThan(0);
  });

  test('income → final-min-income auto-populates salary_u_s_12_7', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token } = await signup(api);
    const headers = { Authorization: `Bearer ${token}` };

    const annualSalary = 2200000;
    await api.post('/api/income-form/2025-26', {
      headers,
      data: { annual_basic_salary: annualSalary },
    });

    const fmi = await api.get('/api/tax-forms/final-min-income', { headers });
    expect(fmi.status()).toBe(200);
    const body = await fmi.json();
    const salaryOnForm = parseFloat(body?.data?.salary_u_s_12_7) || 0;
    expect(salaryOnForm, 'salary_u_s_12_7 should auto-populate from income form').toBeGreaterThan(0);
  });

  test('capital-gains → tax-computation capital_gains_loss', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token } = await signup(api);
    const headers = { Authorization: `Bearer ${token}` };

    // Record a capital gain.
    await api.post('/api/tax-forms/capital-gains', {
      headers,
      data: { immovable_property_1_year_taxable: 500000 },
    });

    const tc = await api.get('/api/tax-forms/tax-computation', { headers });
    expect(tc.status()).toBe(200);
    const body = await tc.json();
    const cg = parseFloat(body?.data?.capital_gains_loss) || 0;
    expect(cg, 'tax-computation capital_gains_loss should reflect capital_gain_forms total').toBeGreaterThan(0);
  });

  test('preview computes non-zero tax for a salaried 5M scenario', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token } = await signup(api);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await api.post('/api/tax-computation/2025-26/preview', {
      headers,
      data: {
        inputs: {
          income: { annual_salary_wages_total: 5000000 },
        },
      },
    });
    expect(res.status(), 'preview POST').toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const normal = body?.data?.tax?.normalIncomeTax;
    // FA 2025 salaried slabs: on 5M, tax = 931,000.
    expect(normal, 'normalIncomeTax on Rs 5M salary').toBe(931000);
    expect(body?.data?.tax?.surcharge).toBe(0);
    expect(body?.data?.tax?.superTax).toBe(0);
  });

  test('preview applies surcharge on 15M salary (FA 2025 9%)', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token } = await signup(api);
    const headers = { Authorization: `Bearer ${token}` };

    const res = await api.post('/api/tax-computation/2025-26/preview', {
      headers,
      data: {
        inputs: {
          income: { annual_salary_wages_total: 15000000 },
        },
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Normal tax 4,431,000. Surcharge 9% × 4,431,000 = 398,790.
    expect(body?.data?.tax?.normalIncomeTax).toBe(4431000);
    expect(body?.data?.tax?.surcharge).toBe(398790);
  });

  test('preview with zakat deduction reduces taxable income', async () => {
    const api = await request.newContext({ baseURL: process.env.E2E_API_URL });
    const { token } = await signup(api);
    const headers = { Authorization: `Bearer ${token}` };

    const without = await api.post('/api/tax-computation/2025-26/preview', {
      headers,
      data: { inputs: { income: { annual_salary_wages_total: 5000000 } } },
    });
    const withZakat = await api.post('/api/tax-computation/2025-26/preview', {
      headers,
      data: {
        inputs: {
          income: { annual_salary_wages_total: 5000000 },
          deductions: { zakat_paid_amount: 500000 },
        },
      },
    });
    const a = (await without.json())?.data?.tax?.normalIncomeTax;
    const b = (await withZakat.json())?.data?.tax?.normalIncomeTax;
    expect(b).toBeLessThan(a);
    expect((await withZakat.json())?.data?.income?.deductibleAllowances).toBeGreaterThanOrEqual(500000);
  });
});
