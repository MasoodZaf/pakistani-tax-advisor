import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileText } from 'lucide-react';
import {
  TaxFormShell, FormStateScreen, CollapsibleSection,
  TaxFormRow, AmountRow, CalculatedRow, FormNav, formatPKR,
} from '../index';

describe('forms kit', () => {
  test('formatPKR groups thousands and parenthesises negatives', () => {
    expect(formatPKR(1701000)).toBe('1,701,000');
    expect(formatPKR(-2500)).toBe('(2,500)');
    expect(formatPKR(0)).toBe('0');
  });

  test('TaxFormRow wires label↔input (A11Y-01) and announces errors (A11Y-02)', () => {
    render(<TaxFormRow name="basic_salary" label="Monthly basic salary" error="Required" />);
    const input = screen.getByLabelText('Monthly basic salary');
    expect(input).toHaveAttribute('id', 'basic_salary');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('basic_salary-error'));
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  test('CollapsibleSection header is a real button with aria-expanded (A11Y-04)', () => {
    render(<CollapsibleSection title="Payments by employer"><div>row</div></CollapsibleSection>);
    const btn = screen.getByRole('button', { name: /payments by employer/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(btn).toHaveAttribute('aria-controls');
  });

  test('AmountRow sign-aware shows magnitude for both refund and payable', () => {
    const { rerender } = render(<AmountRow label="Result" amount={-5000} signAware />);
    expect(screen.getByText('5,000')).toBeInTheDocument();
    rerender(<AmountRow label="Result" amount={5000} signAware />);
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  test('shell + nav + calculated row + state screen render without crashing', () => {
    render(
      <TaxFormShell title="Income" icon={FileText} taxYear="2025-26" footer={<FormNav onBack={() => {}} onNext={() => {}} />}>
        <AmountRow label="Total" amount={100} variant="total" />
        <CalculatedRow label="Calc" amount={50} />
      </TaxFormShell>
    );
    expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete & next/i })).toBeInTheDocument();
  });

  test('FormStateScreen announces error state', () => {
    render(<FormStateScreen title="Could not load rates" message="Try again" tone="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load rates');
  });
});
