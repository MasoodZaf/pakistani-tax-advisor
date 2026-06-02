// Shared tax-form component kit (navy/lime brand, semantic-only colour,
// responsive, WCAG-accessible). Adopt these across the 11 IncomeTax / Wealth
// forms so every styling, responsive and a11y fix lives in ONE place.
export { default as TaxFormShell } from './TaxFormShell';
export { default as FormStateScreen } from './FormStateScreen';
export { default as CollapsibleSection } from './CollapsibleSection';
export { default as TaxFormRow } from './TaxFormRow';
export { default as AmountRow, CalculatedRow } from './AmountRow';
export { default as FormNav } from './FormNav';
export { LiveTotalsProvider, LiveAmount, LiveWhen, useLiveTotals } from './LiveTotals';
export { formatCurrency, formatNumber } from '../../utils/currency';
export { parseAmount, handleCurrencyInput } from './formatCurrency';
