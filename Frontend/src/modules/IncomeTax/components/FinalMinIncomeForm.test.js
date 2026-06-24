/**
 * Characterization + guard test for FinalMinIncomeForm.
 *
 * This form drives compliance-critical final/minimum-tax math, including the
 * ATL x2 rule: a non-filer pays exactly double the filer final-tax rate on
 * every line (FBR Tax Card 2025-26). PERF-02 refactors this form's re-render
 * model (controlled inputs -> per-row self-subscription); this test locks the
 * behaviour that MUST NOT change across that refactor:
 *
 *   1. Typing an amount auto-calculates tax chargeable = amount x filer-rate.
 *   2. Toggling to Non-filer doubles it (amount x 2 x filer-rate).
 *   3. The grand total reflects the sum of tax chargeable.
 *   4. Submitting persists grand_total_tax_chargeable.
 *
 * It was written against the pre-refactor code and must stay green after.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinalMinIncomeForm from './FinalMinIncomeForm';

// ── Mock the contexts/hooks the form pulls from ──────────────────────────────
const mockSaveFormStep = jest.fn().mockResolvedValue(true);
const mockGetStepData = jest.fn(() => ({}));
let mockFormData = {};

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../contexts/TaxFormContext', () => ({
  useTaxForm: () => ({
    saveFormStep: mockSaveFormStep,
    getStepData: mockGetStepData,
    formData: mockFormData,
    saving: false,
    incomeProfile: { addons: ['dividends'] }, // unlocks the dividend rows
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      slabs: [{ min_income: 0, max_income: 600000, tax_rate: 0 }],
      surcharge: { rate: 0.09, threshold: 10000000 },
      // DB-sourced final-tax rate for the dividend @35% (Other SPV) row.
      // Category key comes from AMOUNT_FIELD_TO_FINAL_TAX_CATEGORY in the form
      // (dividend_u_s_150_35pc_share_profit_other_spv_amount -> dividend_other_spv_35pc).
      // Seeded with 0.35 (== the field.taxRate fallback), so resolveFinalTaxRate
      // returns the same rate whether it reads the DB value or falls back — the
      // pre-existing ATL/grand-total tests stay green either way.
      finalTax: { dividend_other_spv_35pc: { rate: 0.35 } },
    },
  }),
}));

// The lime value <p> in the grand-total row. Subtotal shows the same number
// when only one row is filled, so target the grand-total cell specifically.
function grandTotalText() {
  return screen
    .getByText('Grand total tax chargeable')
    .closest('div.flex')
    .querySelector('p.text-lime').textContent;
}

beforeEach(() => {
  mockFormData = { final_min_income: {}, income: {}, capital_gain: {} };
  mockSaveFormStep.mockClear();
});

test('ATL x2 final-tax: filer rate, then doubled for non-filer, flows to grand total', async () => {
  render(<FinalMinIncomeForm />);

  const amountInput = screen.getByLabelText(/@35%.*amount$/i);
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);

  // Filer (default ATL=true): tax chargeable = 100000 x 0.35 = 35,000.
  await waitFor(() => expect(grandTotalText()).toMatch(/35,000/));

  // Toggle to Non-filer -> ATL x2 -> 100000 x 0.70 = 70,000.
  await userEvent.click(screen.getByRole('button', { name: /Non-filer/i }));
  await waitFor(() => expect(grandTotalText()).toMatch(/70,000/));
});

test('submitting persists the computed grand_total_tax_chargeable', async () => {
  render(<FinalMinIncomeForm />);
  const amountInput = screen.getByLabelText(/@35%.*amount$/i);
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);

  await waitFor(() => expect(grandTotalText()).toMatch(/35,000/));

  await userEvent.click(screen.getByRole('button', { name: /Complete & next/i }));

  await waitFor(() => expect(mockSaveFormStep).toHaveBeenCalled());
  const [step, payload] = mockSaveFormStep.mock.calls[0];
  expect(step).toBe('final_min_income');
  expect(payload.grand_total_tax_chargeable).toBe(35000);
});

// ── FIXED-RATE AUTO-CALC (FinalMinAutoCalc) ──────────────────────────────────
// Row under test: "Dividend u/s 150 @35% (Other SPV)" — a fixed-rate row in the
// dividends-addon section (unlocked by incomeProfile.addons = ['dividends']).
//   amount field       : dividend_u_s_150_35pc_share_profit_other_spv_amount
//   tax-deducted field : dividend_u_s_150_35pc_share_profit_other_spv_tax_deducted
//   tax-chargeable     : dividend_u_s_150_35pc_share_profit_other_spv_tax_chargeable
//   DB category        : dividend_other_spv_35pc  (rate 0.35, from the mock above)
// Filer (is_atl=true) so the rate is NOT doubled: 100,000 × 0.35 = 35,000.
//
// These fixed-rate inputs are CONTROLLED — EditableNum/ReadonlyNum bind
// value={formatNumber(value)} via useWatch — so the FinalMinAutoCalc effect's
// setValue() flows straight back into the displayed value, no blur needed.

function div35AmountInput() {
  return screen.getByLabelText(/Dividend u\/s 150 @35%.*amount$/i);
}
function div35DeductedInput() {
  return screen.getByLabelText(/Dividend u\/s 150 @35%.*tax deducted$/i);
}
function div35ChargeableInput() {
  // aria-label ends with "tax chargeable (auto)" for the read-only fixed-rate cell.
  return screen.getByLabelText(/Dividend u\/s 150 @35%.*tax chargeable \(auto\)$/i);
}

// Expand the "Dividend Income" section so the row is visibly revealed (it is
// addon-gated AND collapsed by default — only salaryIncome starts open).
async function expandDividendSection() {
  const header = screen.getByRole('button', { name: /Dividend Income/i });
  if (header.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(header);
    await waitFor(() => expect(header).toHaveAttribute('aria-expanded', 'true'));
  }
}

test('fixed-rate AUTO-CALC chargeable: amount × DB rate fills tax chargeable', async () => {
  render(<FinalMinIncomeForm />);
  await expandDividendSection();

  const amountInput = div35AmountInput();
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);

  // 100,000 × 0.35 (filer) = 35,000 — shown formatted in the chargeable cell.
  await waitFor(() => expect(div35ChargeableInput()).toHaveValue('35,000'));
});

test('fixed-rate AUTO-CALC deducted (regression guard): tracks amount × rate, NOT 0', async () => {
  // The bug: tax-deducted only filled when empty, so the 0 seeded by the first
  // keystroke stuck and it never reached 35,000. Now it mirrors the chargeable.
  render(<FinalMinIncomeForm />);
  await expandDividendSection();

  const amountInput = div35AmountInput();
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);

  await waitFor(() => expect(div35ChargeableInput()).toHaveValue('35,000'));
  // The guard: deducted must equal 35,000, and must NOT be stuck at 0.
  await waitFor(() => expect(div35DeductedInput()).toHaveValue('35,000'));
  expect(div35DeductedInput()).not.toHaveValue('0');
});

test('fixed-rate MANUAL OVERRIDE: hand-edited tax deducted survives an amount change', async () => {
  render(<FinalMinIncomeForm />);
  await expandDividendSection();

  // Seed an amount so auto-calc has run once (deducted -> 35,000).
  const amountInput = div35AmountInput();
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '100000');
  fireEvent.blur(amountInput);
  await waitFor(() => expect(div35DeductedInput()).toHaveValue('35,000'));

  // User hand-types a custom tax-deducted value — onUserEdit marks the cell as
  // manually overridden (added to manualTaxDeducted Set).
  const deductedInput = div35DeductedInput();
  await userEvent.clear(deductedInput);
  await userEvent.type(deductedInput, '12345');
  fireEvent.blur(deductedInput);
  await waitFor(() => expect(div35DeductedInput()).toHaveValue('12,345'));

  // Now change the amount. Chargeable re-derives (200,000 × 0.35 = 70,000) but
  // the user's custom deducted value must be left untouched.
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '200000');
  fireEvent.blur(amountInput);

  await waitFor(() => expect(div35ChargeableInput()).toHaveValue('70,000'));
  expect(div35DeductedInput()).toHaveValue('12,345'); // NOT re-derived to 70,000
});
