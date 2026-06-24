/**
 * Auto-calculation test for ReductionsForm — Behbood-certificate row.
 *
 * The Behbood reduction (2nd Sched Pt III cl.6) caps the tax on
 * Behbood-certificate / Pensioner's-Benefit-Account profit at
 * behbood_certificate_max_rate (e.g. 5% of profit). When the user selects
 * "Y" and enters a profit amount, ReductionsAutoCalc must auto-fill
 * `behbood_certificates_tax_reduction` = profitAmount × maxRate.
 *
 * This pins that auto-calc. The behbood row lives in ADVANCED in the field-
 * visibility manifest, so the test opens "Show advanced" before driving it.
 *
 * Mock shapes adapted from AdjustableTaxForm.test.js. ReductionsForm consumes:
 *   - useTaxForm():   saveFormStep, getStepData, formData, saving, incomeProfile
 *   - useTaxYear():   currentTaxYear
 *   - useTaxRates():  rates.reductions.{teacher_researcher,behbood_certificate_max_rate}.rate
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReductionsForm from './ReductionsForm';

const mockSaveFormStep = jest.fn().mockResolvedValue(true);
const mockGetStepData = jest.fn(() => ({}));
let mockFormData = {};

const BEHBOOD_MAX_RATE = 0.05; // 5% cap

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
      slabs: [],
      reductions: {
        teacher_researcher: { rate: 0.25 },
        behbood_certificate_max_rate: { rate: BEHBOOD_MAX_RATE },
      },
    },
  }),
}));

beforeEach(() => {
  mockFormData = { reductions: {}, income: {}, final_min_income: {} };
  mockSaveFormStep.mockClear();
});

test('Behbood reduction auto-fills to profit × max rate', async () => {
  const { container } = render(<ReductionsForm />);

  // Behbood row is ADVANCED → reveal it via the expander.
  await userEvent.click(screen.getByRole('button', { name: /more advanced reduction item/i }));

  // Toggle Behbood = Y so the auto-calc effect engages.
  const ynSelect = container.querySelector('#behbood_certificates_reduction_yn');
  await userEvent.selectOptions(ynSelect, 'Y');

  // Seed the profit amount in a single change. 200,000 × 5% = 10,000.
  const profitAmount = 200000;
  const amountInput = container.querySelector('#behbood_certificates_amount');
  fireEvent.change(amountInput, { target: { value: String(profitAmount) } });
  fireEvent.blur(amountInput);

  const expected = Math.round(profitAmount * BEHBOOD_MAX_RATE); // 10000
  const reductionInput = container.querySelector('#behbood_certificates_tax_reduction');

  await waitFor(() => {
    expect(Number(reductionInput.value)).toBe(expected);
  });
  // Guard against the historical `if (current === 0)` bug leaving it stuck at 0.
  expect(Number(reductionInput.value)).not.toBe(0);
});

/**
 * Regression guard for the `if (current === 0)` Behbood bug (now fixed).
 *
 * The amount input is `valueAsNumber`, so typing "200000" digit-by-digit fires
 * the auto-calc effect on every keystroke. The old `if (current === 0)` guard
 * wrote the first non-zero partial ("20" -> round(20*5%)=1) and then froze,
 * never reaching the true 200000*5% = 10000. The fix recomputes on every change
 * (difference-check, like the teacher row), so digit-by-digit typing now lands
 * on the correct value. This test types char-by-char and asserts 10000.
 */
test('char-by-char typing lands Behbood reduction on the correct value (guard-bug fix)', async () => {
  const { container } = render(<ReductionsForm />);

  await userEvent.click(screen.getByRole('button', { name: /more advanced reduction item/i }));
  await userEvent.selectOptions(container.querySelector('#behbood_certificates_reduction_yn'), 'Y');

  const amountInput = container.querySelector('#behbood_certificates_amount');
  await userEvent.type(amountInput, '200000');
  fireEvent.blur(amountInput);

  const correct = Math.round(200000 * BEHBOOD_MAX_RATE); // 10000
  const reductionInput = container.querySelector('#behbood_certificates_tax_reduction');

  // Before the fix this froze at the first non-zero partial (1); now it tracks
  // every keystroke through to the final value.
  await waitFor(() => expect(Number(reductionInput.value)).toBe(correct));
  expect(Number(reductionInput.value)).not.toBe(1);
});
