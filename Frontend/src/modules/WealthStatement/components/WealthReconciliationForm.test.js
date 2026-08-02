/**
 * WealthReconciliationForm — the fabrication vector.
 *
 * The unreconciled difference HARD-BLOCKS filing (POST /api/tax-forms/submit →
 * 422 WEALTH_RECON_UNBALANCED). Before this change the form also offered
 * one-click buttons that wrote the ENTIRE difference into Foreign Remittance /
 * Inheritance / Gift Received — printed directly beneath its own warning that
 * FBR audit-flags inflated remittances. A blocking false positive plus a
 * one-click "fix" that fabricates a declaration is how an app bug becomes a
 * taxpayer's false declaration.
 *
 * These tests pin (a) that the helper buttons never write an amount, and
 * (b) that the corrected arithmetic no longer manufactures the gap.
 *
 * The arithmetic itself is covered in utils/wealthReconciliation.test.js.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WealthReconciliationForm from './WealthReconciliationForm';

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
  }),
}));

// Salary 10,000,000 gross of 1,300,000 exempt, plus 200,000 non-cash:
//   income_exempt_from_tax  = -1,300,000  (the B15 contra)
//   total_employment_income =  8,900,000  (already net of it)
// Final/Min step carries 13,000,000 of final-tax income + CGT.
const INCOME = { income_exempt_from_tax: -1300000, total_employment_income: 8900000 };
const FINAL_MIN = {
  salary_u_s_12_7: 8700000, // auto-linked; must not be counted twice
  interest_income_profit_debt_7b_up_to_5m_amount: 11500000,
  capital_gain: 1500000,
};

beforeEach(() => {
  mockSaveFormStep.mockClear();
  mockFormData = {
    wealth: { net_worth_current_year: 21600000, net_worth_previous_year: 0 },
    income: INCOME,
    expenses: { total_expenses: 1600000 },
    final_min_income: FINAL_MIN,
  };
});

test('the corrected arithmetic balances instead of inventing a gap', async () => {
  render(<WealthReconciliationForm />);

  // inflows  = 8,900,000 + 1,300,000 + 13,000,000 = 23,200,000
  // outflows =                                       1,600,000
  // net      =                                      21,600,000  == asset increase
  await waitFor(() => expect(screen.getByText('Reconciliation balanced')).toBeInTheDocument());
  expect(screen.queryByText('Reconciliation not balanced')).toBeNull();
});

test('exempt income appears once, as a positive inflow', async () => {
  const { container } = render(<WealthReconciliationForm />);
  await waitFor(() => expect(screen.getByText('Reconciliation balanced')).toBeInTheDocument());

  expect(Number(container.querySelector('input[name="income_exempt_from_tax"]').value)).toBe(1300000);
  expect(Number(container.querySelector('input[name="income_normal_tax"]').value)).toBe(8900000);
  // The modern Final/Min step, not the structurally-zero legacy `final_tax` read.
  expect(Number(container.querySelector('input[name="income_final_tax"]').value)).toBe(13000000);
});

describe('when a genuine gap remains', () => {
  beforeEach(() => {
    mockFormData = {
      ...mockFormData,
      wealth: { net_worth_current_year: 28200000, net_worth_previous_year: 0 },
    };
  });

  test('the helper buttons move focus and never write an amount', async () => {
    const { container } = render(<WealthReconciliationForm />);
    await waitFor(() => expect(screen.getByText('Reconciliation not balanced')).toBeInTheDocument());

    const remittance = container.querySelector('#foreign_remittance');
    expect(Number(remittance.value) || 0).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: /go to foreign remittance/i }));

    // Focus moved; value untouched. The old build wrote the whole 6,600,000 gap.
    expect(remittance).toHaveFocus();
    expect(Number(remittance.value) || 0).toBe(0);
  });

  test('no control offers to add the difference for the user', async () => {
    render(<WealthReconciliationForm />);
    await waitFor(() => expect(screen.getByText('Reconciliation not balanced')).toBeInTheDocument());

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent).not.toMatch(/^add to /i);
    }
  });

  test('warns explicitly against entering a figure just to balance', async () => {
    render(<WealthReconciliationForm />);
    await waitFor(() => expect(screen.getByText('Reconciliation not balanced')).toBeInTheDocument());

    expect(screen.getByText(/never enter a figure\s+simply to make this balance/i)).toBeInTheDocument();
  });
});
