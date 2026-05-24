import React from 'react';

// Parse Pakistani-flavoured number shorthand to plain integer rupees.
// Accepts: "1500000", "15,00,000", "15 lakh", "1.5 cr", "15L", "1.5cr".
// Returns null if the input is empty / unparseable.
export function parsePkrShorthand(input) {
  if (input === '' || input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = String(input).trim().toLowerCase().replace(/,/g, '').replace(/₨/g, '').replace(/\s+/g, ' ');
  if (s === '') return null;
  // crore / cr: 10,000,000 ×
  const crMatch = s.match(/^([\d.]+)\s*(crore|cr)$/);
  if (crMatch) {
    const n = parseFloat(crMatch[1]);
    return Number.isFinite(n) ? Math.round(n * 1e7) : null;
  }
  // lakh / lac / L: 100,000 ×
  const lakhMatch = s.match(/^([\d.]+)\s*(lakh|lac|l)$/);
  if (lakhMatch) {
    const n = parseFloat(lakhMatch[1]);
    return Number.isFinite(n) ? Math.round(n * 1e5) : null;
  }
  // k / thousand: 1,000 ×
  const kMatch = s.match(/^([\d.]+)\s*(k|thousand)$/);
  if (kMatch) {
    const n = parseFloat(kMatch[1]);
    return Number.isFinite(n) ? Math.round(n * 1e3) : null;
  }
  // Plain number.
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const formatPkr = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '';
  return new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(Number(n));
};

const fieldErrorLabel = (code) => ({
  required: 'This field is required.',
  not_a_number: 'Please enter a number.',
  negative_not_allowed: 'Amount cannot be negative.',
  unreasonably_large: 'That looks too large — double-check the number.',
  invalid_option: 'Please pick one of the options.',
  not_yes_no: 'Please answer yes or no.',
}[code] || 'Please check this value.');

// Per-field input widget. Controlled — parent owns the value via setValue(key, v).
//
// For pkr_amount / pkr_optional: shows a PKR-prefixed input that displays
// the user's raw typed string, and updates the parent with the parsed
// integer rupee value via parsePkrShorthand. On blur, replaces the raw
// string with the formatted canonical version ("15 lakh" → "1,500,000").
function WizardField({ field, value, rawText, setRawText, setValue, error }) {
  const id = `wiz_${field.key}`;
  const errMsg = error ? fieldErrorLabel(error) : null;

  const onPkrChange = (e) => {
    const v = e.target.value;
    setRawText(field.key, v);
    setValue(field.key, parsePkrShorthand(v));
  };
  const onPkrBlur = () => {
    // Canonicalise the display once the user is done editing this field.
    if (value != null && Number.isFinite(value)) {
      setRawText(field.key, formatPkr(value));
    }
  };

  switch (field.input_type) {
    case 'pkr_amount':
    case 'pkr_optional':
    case 'number': {
      const isOptional = field.input_type === 'pkr_optional' || !field.required;
      const display = rawText != null ? rawText : (value != null ? formatPkr(value) : '');
      return (
        <div style={{ marginBottom: 14 }}>
          <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3d3e37', marginBottom: 6 }}>
            {field.prompt}
            {isOptional && (
              <span style={{ marginLeft: 6, color: '#7a8890', fontWeight: 500 }}>(optional)</span>
            )}
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#7a8890', fontWeight: 600, fontSize: 14, pointerEvents: 'none' }}>
              ₨
            </span>
            <input
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={display}
              onChange={onPkrChange}
              onBlur={onPkrBlur}
              placeholder="0"
              style={{
                width: '100%',
                padding: '12px 14px 12px 32px',
                fontSize: 15,
                fontWeight: 500,
                color: '#1c1d1a',
                background: '#fff',
                border: `1.5px solid ${errMsg ? '#f87171' : '#e0dfd9'}`,
                borderRadius: 10,
                outline: 'none',
                fontFamily: "'Nunito', sans-serif",
              }}
            />
          </div>
          {errMsg && (
            <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{errMsg}</p>
          )}
          <p style={{ marginTop: 5, fontSize: 11, color: '#7a8890', fontWeight: 500 }}>
            Tip: you can type "15 lakh", "1.5 cr", or "1500000".
          </p>
        </div>
      );
    }

    case 'select': {
      return (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3d3e37', marginBottom: 6 }}>
            {field.prompt}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(field.options || []).map((opt) => {
              const active = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue(field.key, opt.value)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: active ? '#fff' : '#1e2a4a',
                    background: active ? '#28396C' : '#fff',
                    border: `1.5px solid ${active ? '#28396C' : '#e0dfd9'}`,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontFamily: "'Nunito', sans-serif",
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errMsg && (
            <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{errMsg}</p>
          )}
        </div>
      );
    }

    case 'yn': {
      return (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3d3e37', marginBottom: 6 }}>
            {field.prompt}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: 'Y', label: 'Yes' }, { v: 'N', label: 'No' }].map((opt) => {
              const active = value === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setValue(field.key, opt.v)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: active ? '#fff' : '#1e2a4a',
                    background: active ? '#28396C' : '#fff',
                    border: `1.5px solid ${active ? '#28396C' : '#e0dfd9'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errMsg && (
            <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{errMsg}</p>
          )}
        </div>
      );
    }

    default:
      return (
        <p style={{ color: '#ef4444', fontWeight: 600, fontSize: 13 }}>
          Unsupported field type: {field.input_type}
        </p>
      );
  }
}

export default WizardField;
