/**
 * Auto-calculation proof for CapitalGainsForm.
 *
 * The form auto-calculates CGT for each capital-gain row as
 *   cgt = round(gainAmount × rate)
 * inside the headless <CapitalGainsAutoCalc> effect (difference-check guard).
 * The "Gain amount" (*_taxable) input is editable; the CGT (*_cgt taxField)
 * input is readOnly and is driven only by the effect via setValue.
 *
 * This test pins that behaviour: with the `securities` income addon, the
 * "Capital Gain on Securities u/s 37A" 15% row (id `securities_15_percent`)
 * is visible. We mock its rate to 0.15, type a gain amount into its taxable
 * input, and assert its readOnly CGT field shows gain × rate (NOT 0).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CapitalGainsForm from './CapitalGainsForm';

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
    // `securities` addon makes the securities CGT rows (incl. the 15% row) visible.
    incomeProfile: { addons: ['securities'] },
  }),
}));
jest.mock('../../../contexts/TaxYearContext', () => ({
  useTaxYear: () => ({ currentTaxYear: '2025-26' }),
}));
jest.mock('../../../hooks/useTaxRates', () => ({
  useTaxRates: () => ({
    rates: {
      capitalGains: {
        // Nonzero rate on the row under test → effect must compute gain × rate.
        securities_15_percent: { rate: 0.15 },
      },
    },
  }),
}));

beforeEach(() => {
  mockFormData = { capital_gain: {} };
  mockSaveFormStep.mockClear();
});

test('typing a gain amount auto-calculates the readOnly CGT field as gain × rate', async () => {
  const { container } = render(<CapitalGainsForm />);

  // The securities 15% row: editable gain input + readOnly CGT input.
  const gainInput = container.querySelector('#securities_15_percent_taxable');
  const cgtInput = container.querySelector('#securities_15_percent_cgt');

  expect(gainInput).toBeTruthy();
  expect(cgtInput).toBeTruthy();
  expect(cgtInput).toHaveAttribute('readonly');

  // Type a gain of 100,000 → CGT should be round(100000 × 0.15) = 15000 (NOT 0).
  await userEvent.type(gainInput, '100000');
  fireEvent.blur(gainInput);

  await waitFor(() => expect(cgtInput.value).toBe('15000'));
  expect(cgtInput.value).not.toBe('0');
});
