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
jest.mock('../../../hooks/usePriorYearData', () => ({
  usePriorYearData: () => ({ hasPriorData: false, applyPriorYear: jest.fn(), dismissPriorYear: jest.fn() }),
}));
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
    rates: { withholding: {}, slabs: [], surcharge: { rate: 0, threshold: Infinity } },
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
