/**
 * Characterization + guard test for AdjustableTaxForm.
 *
 * This form aggregates withholding/advance tax (adjustable against final
 * liability). PERF-02 changes only its re-render model (drop the bare watch();
 * move the 14 auto-calc effects + totals into self-subscribing children;
 * read render-time defaultValues via getValues()). This test locks the
 * behaviour that MUST NOT change:
 *
 *   1. Entering a "tax collected" value flows into the live "Tax collected"
 *      summary total.
 *   2. Submitting persists total_adjustable_tax (the cross-form credit value).
 *
 * Written against the pre-refactor code; must stay green after.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdjustableTaxForm from './AdjustableTaxForm';

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
    incomeProfile: { addons: [] }, // pure salaried -> salary row visible
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      // electricity_bill_235 @ 7.5% — supplied so the test exercises the DB-rate
      // path; the form also has a static 0.075 fallback if this is absent.
      withholding: { electricity_bill_235: { rate: 0.075 } },
      slabs: [],
      surcharge: { rate: 0, threshold: Infinity },
    },
  }),
}));

// The lime "Tax collected (credit)" total value.
function taxCreditTotal() {
  const spans = screen.getByText('Tax collected (credit)').closest('div').querySelectorAll('span');
  return spans[spans.length - 1].textContent;
}

beforeEach(() => {
  mockFormData = { adjustable_tax: {}, income: {} };
  mockSaveFormStep.mockClear();
});

test('a tax-collected entry flows into the summary total', async () => {
  const { container } = render(<AdjustableTaxForm />);

  // Expand the "Employment and Salary" section, then enter tax collected.
  await userEvent.click(screen.getByRole('button', { name: /Employment and Salary/i }));
  const taxInput = container.querySelector('#salary_employees_149_tax_collected');
  await userEvent.type(taxInput, '5000');
  fireEvent.blur(taxInput);

  await waitFor(() => expect(taxCreditTotal()).toMatch(/5,000/));
});

test('submitting persists total_adjustable_tax', async () => {
  const { container } = render(<AdjustableTaxForm />);
  await userEvent.click(screen.getByRole('button', { name: /Employment and Salary/i }));
  const taxInput = container.querySelector('#salary_employees_149_tax_collected');
  await userEvent.type(taxInput, '5000');
  fireEvent.blur(taxInput);

  await waitFor(() => expect(taxCreditTotal()).toMatch(/5,000/));

  await userEvent.click(screen.getByRole('button', { name: /Complete & next/i }));

  await waitFor(() => expect(mockSaveFormStep).toHaveBeenCalled());
  const [step, payload] = mockSaveFormStep.mock.calls[0];
  expect(step).toBe('adjustable_tax');
  expect(payload.total_adjustable_tax).toBe(5000);
});

// --- Electricity-row auto-calc regression guard (just FIXED) ---------------
//
// "Electricity Bill of Domestic Consumer u/s 235 @7.5%" must auto-fill the
// tax-collected cell = amount × 7.5% when the user enters the amount and BLURS
// the amount field. The form writes the computed value straight into the
// uncontrolled DOM input (id = electricity_bill_domestic_235_tax_collected),
// so we read input.value for the assertion. Before the fix this stayed at 0.

test('electricity row auto-calculates tax (7.5%) on amount blur — 200,000 -> 15,000', async () => {
  const { container } = render(<AdjustableTaxForm />);

  // Expand the "Utility Bills" section (where the electricity row lives).
  await userEvent.click(screen.getByRole('button', { name: /Utility Bills/i }));

  const amountInput = container.querySelector('#electricity_bill_domestic_235_gross_receipt');
  const taxInput = container.querySelector('#electricity_bill_domestic_235_tax_collected');
  expect(amountInput).toBeTruthy();
  expect(taxInput).toBeTruthy();

  await userEvent.type(amountInput, '200000');
  fireEvent.blur(amountInput);

  // 200000 × 0.075 = 15000 -> formatted "15,000" written into the tax DOM input.
  await waitFor(() => expect(taxInput.value).toMatch(/15,000/));
});

test('electricity row respects a manual tax override (does NOT recalculate on amount change)', async () => {
  const { container } = render(<AdjustableTaxForm />);

  await userEvent.click(screen.getByRole('button', { name: /Utility Bills/i }));

  const amountInput = container.querySelector('#electricity_bill_domestic_235_gross_receipt');
  const taxInput = container.querySelector('#electricity_bill_domestic_235_tax_collected');

  // 1) Enter an amount and blur -> auto-calc fills 15,000.
  await userEvent.type(amountInput, '200000');
  fireEvent.blur(amountInput);
  await waitFor(() => expect(taxInput.value).toMatch(/15,000/));

  // 2) User hand-edits the tax cell to a custom value, then blurs -> override.
  await userEvent.clear(taxInput);
  await userEvent.type(taxInput, '9999');
  fireEvent.blur(taxInput);
  await waitFor(() => expect(taxInput.value).toMatch(/9,999/));

  // 3) Change the amount to 300,000 and blur. Auto-calc would be 22,500 — but
  //    the manual override must win, so the tax cell stays 9,999.
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, '300000');
  fireEvent.blur(amountInput);

  await waitFor(() => expect(amountInput.value).toMatch(/300,000/));
  expect(taxInput.value).toMatch(/9,999/);
  expect(taxInput.value).not.toMatch(/22,500/);
});
