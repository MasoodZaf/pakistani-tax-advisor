import React, { useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

// Parse Pakistani-flavoured number shorthand to plain integer rupees.
// Mirrors the web-side parser in Frontend/src/components/Wizard/WizardField.js.
export function parsePkrShorthand(input) {
  if (input === '' || input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = String(input).trim().toLowerCase().replace(/,/g, '').replace(/₨/g, '').replace(/\s+/g, ' ');
  if (s === '') return null;
  const crMatch = s.match(/^([\d.]+)\s*(crore|cr)$/);
  if (crMatch) {
    const n = parseFloat(crMatch[1]);
    return Number.isFinite(n) ? Math.round(n * 1e7) : null;
  }
  const lakhMatch = s.match(/^([\d.]+)\s*(lakh|lac|l)$/);
  if (lakhMatch) {
    const n = parseFloat(lakhMatch[1]);
    return Number.isFinite(n) ? Math.round(n * 1e5) : null;
  }
  const kMatch = s.match(/^([\d.]+)\s*(k|thousand)$/);
  if (kMatch) {
    const n = parseFloat(kMatch[1]);
    return Number.isFinite(n) ? Math.round(n * 1e3) : null;
  }
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

// Per-field input widget. Controlled — parent owns the value via setValue.
// For pkr_amount/pkr_optional: displays user's raw typed string, updates
// parent with parsed integer rupees via parsePkrShorthand. On blur,
// canonicalises the display ("15 lakh" -> "1,500,000").
function WizardField({ field, value, rawText, setRawText, setValue, error }) {
  const isPkr =
    field.input_type === 'pkr_amount' ||
    field.input_type === 'pkr_optional' ||
    field.input_type === 'number';
  const isOptional = field.input_type === 'pkr_optional' || !field.required;
  const errMsg = useMemo(() => (error ? fieldErrorLabel(error) : null), [error]);

  const onPkrChange = (text) => {
    setRawText(field.key, text);
    setValue(field.key, parsePkrShorthand(text));
  };
  const onPkrBlur = () => {
    if (value != null && Number.isFinite(value)) {
      setRawText(field.key, formatPkr(value));
    }
  };

  if (isPkr) {
    const display = rawText != null ? rawText : (value != null ? formatPkr(value) : '');
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>
          {field.prompt}
          {isOptional && <Text style={styles.optionalTag}>  (optional)</Text>}
        </Text>
        <View style={[styles.inputWrap, errMsg && styles.inputWrapError]}>
          <Text style={styles.prefix}>₨</Text>
          <TextInput
            style={styles.input}
            value={display}
            onChangeText={onPkrChange}
            onBlur={onPkrBlur}
            placeholder="0"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {errMsg && <Text style={styles.errorText}>{errMsg}</Text>}
        <Text style={styles.tip}>Tip: type "15 lakh", "1.5 cr", or "1500000".</Text>
      </View>
    );
  }

  if (field.input_type === 'select') {
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>{field.prompt}</Text>
        <View style={styles.chipRow}>
          {(field.options || []).map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setValue(field.key, opt.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errMsg && <Text style={styles.errorText}>{errMsg}</Text>}
      </View>
    );
  }

  if (field.input_type === 'yn') {
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>{field.prompt}</Text>
        <View style={styles.ynRow}>
          {[{ v: 'Y', label: 'Yes' }, { v: 'N', label: 'No' }].map((opt) => {
            const active = value === opt.v;
            return (
              <TouchableOpacity
                key={opt.v}
                onPress={() => setValue(field.key, opt.v)}
                style={[styles.ynButton, active && styles.ynButtonActive]}
              >
                <Text style={[styles.ynText, active && styles.ynTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {errMsg && <Text style={styles.errorText}>{errMsg}</Text>}
      </View>
    );
  }

  return (
    <Text style={styles.errorText}>Unsupported field type: {field.input_type}</Text>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', color: '#3d3e37', marginBottom: 6 },
  optionalTag: { fontSize: 13, color: '#7a8890', fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0dfd9',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  inputWrapError: { borderColor: '#f87171' },
  prefix: { fontSize: 14, fontWeight: '600', color: '#7a8890', marginRight: 4 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1c1d1a' },
  errorText: { marginTop: 4, fontSize: 12, color: '#ef4444', fontWeight: '600' },
  tip: { marginTop: 5, fontSize: 11, color: '#7a8890', fontWeight: '500' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#e0dfd9',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#28396C', borderColor: '#28396C' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#1e2a4a' },
  chipTextActive: { color: '#fff' },
  ynRow: { flexDirection: 'row', gap: 8 },
  ynButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0dfd9',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  ynButtonActive: { backgroundColor: '#28396C', borderColor: '#28396C' },
  ynText: { fontSize: 14, fontWeight: '700', color: '#1e2a4a' },
  ynTextActive: { color: '#fff' },
});

export default WizardField;
