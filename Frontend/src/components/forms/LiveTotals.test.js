import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { LiveTotalsProvider, LiveAmount } from './LiveTotals';

// Counts how many times each input row actually re-renders.
let inputRenderCount = 0;
function TrackedInput({ register, name }) {
  inputRenderCount++;
  return <input aria-label={name} {...register(name)} />;
}

function Display({ amount, label }) {
  return <div>{label}: {amount}</div>;
}

// Mirrors the real usage: parent does NOT call watch(), so it never re-renders
// on keystroke; the body is passed as stable children to the provider.
function Harness() {
  const { register, control } = useForm({ defaultValues: { a: 0, b: 0 } });
  const compute = (v) => ({ sum: (Number(v.a) || 0) + (Number(v.b) || 0) });
  return (
    <LiveTotalsProvider control={control} compute={compute}>
      <TrackedInput register={register} name="a" />
      <TrackedInput register={register} name="b" />
      <LiveAmount component={Display} field="sum" label="Total" />
    </LiveTotalsProvider>
  );
}

describe('LiveTotals (PERF-02 re-render isolation)', () => {
  beforeEach(() => { inputRenderCount = 0; });

  test('the live total reflects the current field values', () => {
    render(<Harness />);
    expect(screen.getByText('Total: 0')).toBeInTheDocument();
    act(() => {
      fireEvent.input(screen.getByLabelText('a'), { target: { value: '300' } });
    });
    expect(screen.getByText('Total: 300')).toBeInTheDocument();
    act(() => {
      fireEvent.input(screen.getByLabelText('b'), { target: { value: '45' } });
    });
    expect(screen.getByText('Total: 345')).toBeInTheDocument();
  });

  test('typing does NOT re-render the register-based input rows', () => {
    render(<Harness />);
    // Baseline after mount (useWatch does a one-time post-mount sync render).
    const baseline = inputRenderCount;
    act(() => {
      fireEvent.input(screen.getByLabelText('a'), { target: { value: '1' } });
      fireEvent.input(screen.getByLabelText('a'), { target: { value: '12' } });
      fireEvent.input(screen.getByLabelText('a'), { target: { value: '123' } });
    });
    // The total updated, but NO keystroke re-rendered an input row — that is the
    // whole point of the isolation (the parent doesn't re-render; only the
    // provider + the LiveAmount consumer do).
    expect(screen.getByText('Total: 123')).toBeInTheDocument();
    expect(inputRenderCount).toBe(baseline);
  });
});
