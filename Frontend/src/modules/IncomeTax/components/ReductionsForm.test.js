/**
 * Auto-calculation test for ReductionsForm — Behbood-certificate row.
 *
 * 2nd Sched Pt III cl.6 caps the TAX on Behbood-certificate / Pensioner's-
 * Benefit-Account profit at behbood_certificate_max_rate (5% of the profit).
 * The relief is therefore the tax charged **in excess of** that ceiling — which
 * is what the FBR row label says ("…in excess of applicable rate").
 *
 * These tests previously asserted `profit × maxRate`, i.e. they pinned the
 * ceiling itself as the reduction. That was the defect (F-14): the ceiling was
 * computed correctly — the variable was literally named `maxTax` — and then
 * written into the reduction field. The assertions below are the corrected
 * arithmetic; they fail on 45bb80c.
 *
 * Tax on a component of a single progressive base apportions at the AVERAGE
 * rate, not the marginal rate — the same method the teacher/researcher row in
 * this file already uses. See utils/taxMath.test.js for the pure-function
 * coverage; this file pins the wiring through the rendered form.
 *
 * The behbood row lives in ADVANCED in the field-visibility manifest, so each
 * test opens "Show advanced" before driving it.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReductionsForm from './ReductionsForm';

const mockSaveFormStep = jest.fn().mockResolvedValue(true);
const mockGetStepData = jest.fn(() => ({}));
let mockFormData = {};

const BEHBOOD_MAX_RATE = 0.05; // 5% cl.6 ceiling

// FBR 2025-26 salaried slabs, in tax_rates_config shape.
const SLABS = [
  { min_income: 0,       max_income: 600000,  tax_rate: 0 },
  { min_income: 600001,  max_income: 1200000, tax_rate: 0.01 },
  { min_income: 1200001, max_income: 2200000, tax_rate: 0.11 },
  { min_income: 2200001, max_income: 3200000, tax_rate: 0.23 },
  { min_income: 3200001, max_income: 4100000, tax_rate: 0.30 },
  { min_income: 4100001, max_income: null,    tax_rate: 0.35 },
];

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  // FormEmptyState (rendered while no rows are visible) imports Link.
  Link: ({ children }) => <a href="#">{children}</a>,
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../contexts/TaxFormContext', () => ({
  useTaxForm: () => ({
    saveFormStep: mockSaveFormStep,
    getStepData: mockGetStepData,
    formData: mockFormData,
    saving: false,
    // behbood/teacher rows are ADVANCED (not addon-gated), so no addons needed;
    // the "Show advanced" expander reveals them.
    incomeProfile: { addons: [] },
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      slabs: SLABS,
      reductions: {
        teacher_researcher: { rate: 0.25 },
        behbood_certificate_max_rate: { rate: BEHBOOD_MAX_RATE },
      },
    },
  }),
}));

const withTaxableIncome = (amount) => ({
  reductions: {},
  income: { total_employment_income: amount },
  final_min_income: {},
  deductions: {},
});

/** Reveal the advanced rows, set Behbood = Y, and enter the profit. */
async function enterBehboodProfit(container, profit) {
  await userEvent.click(screen.getByRole('button', { name: /more advanced reduction item/i }));
  await userEvent.selectOptions(container.querySelector('#behbood_certificates_reduction_yn'), 'Y');
  const amountInput = container.querySelector('#behbood_certificates_amount');
  fireEvent.change(amountInput, { target: { value: String(profit) } });
  fireEvent.blur(amountInput);
  return container.querySelector('#behbood_certificates_tax_reduction');
}

beforeEach(() => {
  mockFormData = withTaxableIncome(0);
  mockSaveFormStep.mockClear();
});

/**
 * REFERENCE CASE.
 *   taxable income 11,200,000 → tax 3,101,000 → average rate 27.6875%
 *   profit          1,000,000 → tax attributable 276,875
 *   cl.6 ceiling    1,000,000 × 5% = 50,000
 *   RELIEF          276,875 − 50,000 = 226,875
 */
test('Behbood reduction is the tax charged above the 5% ceiling', async () => {
  mockFormData = withTaxableIncome(11200000);
  const { container } = render(<ReductionsForm />);

  const reductionInput = await enterBehboodProfit(container, 1000000);

  await waitFor(() => expect(Number(reductionInput.value)).toBe(226875));

  // The pre-fix value (the ceiling assigned as the reduction) and the
  // marginal-rate derivation the QA ticket originally asked for.
  expect(Number(reductionInput.value)).not.toBe(50000);
  expect(Number(reductionInput.value)).not.toBe(300000);
});

/**
 * The over-relief direction. Taxable 800,000 → tax 2,000 → average 0.25%;
 * profit 500,000 → tax attributable 1,250, already under the 25,000 ceiling.
 * Relief is NIL. The pre-fix code granted 25,000 — 12.5× the taxpayer's entire
 * normal tax, which then spilled onto unrelated capital-gains tax.
 */
test('Behbood reduction is nil when the average rate is already under 5%', async () => {
  mockFormData = withTaxableIncome(800000);
  const { container } = render(<ReductionsForm />);

  const reductionInput = await enterBehboodProfit(container, 500000);

  // Give the effect a tick; the assertion is that it settles on 0, not 25,000.
  await waitFor(() => {
    expect(screen.getByText(/less the 5% cl.6 ceiling/i)).toBeInTheDocument();
  });
  expect(Number(reductionInput.value) || 0).toBe(0);
});

test('shows the working so the figure is auditable', async () => {
  mockFormData = withTaxableIncome(11200000);
  const { container } = render(<ReductionsForm />);

  await enterBehboodProfit(container, 1000000);

  await waitFor(() =>
    expect(screen.getByText(/average rate of 27\.6875%/i)).toBeInTheDocument()
  );
});

test('grants no relief, and says why, when the profit is not in taxable income', async () => {
  mockFormData = withTaxableIncome(0);
  const { container } = render(<ReductionsForm />);

  const reductionInput = await enterBehboodProfit(container, 1000000);

  await waitFor(() =>
    expect(screen.getByText(/declare this profit as income on the Income form first/i)).toBeInTheDocument()
  );
  expect(Number(reductionInput.value) || 0).toBe(0);
});

/**
 * Regression guard for the `if (current === 0)` Behbood bug (fixed earlier).
 *
 * The amount input is `valueAsNumber`, so typing "1000000" digit-by-digit fires
 * the auto-calc effect on every keystroke. The old `current === 0` guard wrote
 * the first non-zero partial and then froze. The effect recomputes on every
 * change (difference-check, like the teacher row), so char-by-char typing lands
 * on the correct final value.
 */
test('char-by-char typing lands on the correct relief (guard-bug regression)', async () => {
  mockFormData = withTaxableIncome(11200000);
  const { container } = render(<ReductionsForm />);

  await userEvent.click(screen.getByRole('button', { name: /more advanced reduction item/i }));
  await userEvent.selectOptions(container.querySelector('#behbood_certificates_reduction_yn'), 'Y');

  const amountInput = container.querySelector('#behbood_certificates_amount');
  await userEvent.type(amountInput, '1000000');
  fireEvent.blur(amountInput);

  const reductionInput = container.querySelector('#behbood_certificates_tax_reduction');
  await waitFor(() => expect(Number(reductionInput.value)).toBe(226875));
});
