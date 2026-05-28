import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { upsertExpense, deleteExpense, getExpense } from '../services/expensesDb';
import { syncAll } from '../services/expensesSync';
import { pickReceiptImage, uploadReceipt, getReceiptUrl } from '../services/receipts';
import { CATEGORIES, PAYMENT_METHODS } from '../../../shared/expenseSchema';

// YYYY-MM-DD for today, in the user's local time zone (not UTC — they don't
// want a midnight-UTC bug to file an expense in the wrong day).
function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ExpenseCaptureScreen = ({ route, navigation }) => {
  const editingClientId = route?.params?.clientId || null;
  const [clientId] = useState(editingClientId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [fxRate, setFxRate] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayLocal());
  const [category, setCategory] = useState('groceries');
  const [description, setDescription] = useState('');
  const [payee, setPayee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  // Receipt state:
  //   receiptId      — server id (the durable identifier we store on the row)
  //   receiptPreview — a displayable image URI: either the freshly-picked
  //                    local file or a signed-download URL fetched from the server
  //   uploading      — true while POST /receipts is in flight
  const [receiptId, setReceiptId] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editingClientId) return;
    (async () => {
      const row = await getExpense(editingClientId);
      if (!row) return;
      setAmount(String(row.amount));
      setCurrency(row.currency);
      if (row.fx_rate_to_pkr) setFxRate(String(row.fx_rate_to_pkr));
      setOccurredOn(row.occurred_on);
      setCategory(row.category);
      setDescription(row.description || '');
      setPayee(row.payee || '');
      setPaymentMethod(row.payment_method || 'cash');
      if (row.receipt_id) {
        setReceiptId(row.receipt_id);
        // Lazily resolve the signed URL — don't block the form render.
        getReceiptUrl(row.receipt_id)
          .then(setReceiptPreview)
          .catch(() => { /* preview is non-essential */ });
      }
    })();
  }, [editingClientId]);

  // Receipt actions ─────────────────────────────────────────────────────────
  const onAttachReceipt = () => {
    Alert.alert('Attach receipt', 'Where from?', [
      { text: 'Camera', onPress: () => doPick('camera') },
      { text: 'Photo library', onPress: () => doPick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const doPick = async (source) => {
    let picked;
    try {
      picked = await pickReceiptImage(source);
    } catch (err) {
      Alert.alert('Cannot attach receipt', err.message || 'Permission denied');
      return;
    }
    if (!picked) return;

    setUploading(true);
    setReceiptPreview(picked.uri); // show the local preview immediately
    try {
      const result = await uploadReceipt(picked.uri);
      setReceiptId(result.receipt_id);
    } catch (err) {
      setReceiptPreview(null);
      const status = err.response?.status;
      const msg = status === 503
        ? 'Receipt uploads are not available right now.'
        : (err.response?.data?.error || err.message || 'Upload failed');
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const onRemoveReceipt = () => {
    setReceiptId(null);
    setReceiptPreview(null);
  };

  const onSave = async () => {
    const amtNum = parseFloat(amount);
    if (!Number.isFinite(amtNum) || amtNum < 0) {
      Alert.alert('Invalid amount', 'Enter a positive amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      Alert.alert('Invalid date', 'Date must be in YYYY-MM-DD format.');
      return;
    }
    let fxRateNum = null;
    let amountPkr = amtNum;
    if (currency !== 'PKR') {
      fxRateNum = parseFloat(fxRate);
      if (!Number.isFinite(fxRateNum) || fxRateNum <= 0) {
        Alert.alert('FX rate required', `Enter an FX rate for ${currency} → PKR.`);
        return;
      }
      amountPkr = Math.round(amtNum * fxRateNum * 100) / 100;
    }

    setSaving(true);
    try {
      await upsertExpense({
        client_id: clientId || undefined,
        amount: amtNum,
        currency,
        fx_rate_to_pkr: fxRateNum,
        amount_pkr: amountPkr,
        occurred_on: occurredOn,
        category,
        description: description.trim() || null,
        payee: payee.trim() || null,
        payment_method: paymentMethod,
        receipt_id: receiptId,
      });

      // Best-effort sync; failures are non-blocking — the row is safely in
      // SQLite and will sync on the next pull-to-refresh or app open.
      syncAll().catch(() => {});

      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editingClientId) return;
    Alert.alert(
      'Delete expense',
      'This will remove the expense from your ledger.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteExpense(editingClientId);
            syncAll().catch(() => {});
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Field label="Amount">
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                accessibilityLabel="Amount"
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 8, textAlign: 'center' }]}
                value={currency}
                onChangeText={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
                autoCapitalize="characters"
                maxLength={3}
                placeholder="PKR"
                accessibilityLabel="Currency code"
              />
            </View>
          </Field>

          {currency !== 'PKR' && (
            <Field label={`FX rate ${currency} → PKR`}>
              <TextInput
                style={styles.input}
                value={fxRate}
                onChangeText={setFxRate}
                keyboardType="decimal-pad"
                placeholder="e.g. 278.5"
                accessibilityLabel={`Exchange rate from ${currency} to PKR`}
              />
            </Field>
          )}

          <Field label="Date">
            <TextInput
              style={styles.input}
              value={occurredOn}
              onChangeText={setOccurredOn}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              accessibilityLabel="Date of expense"
              accessibilityHint="Format: year, month, day"
            />
          </Field>

          <Field label="Category">
            <ChipPicker options={CATEGORIES} value={category} onChange={setCategory} />
          </Field>

          <Field label="Payment method">
            <ChipPicker options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />
          </Field>

          <Field label="Payee (optional)">
            <TextInput
              style={styles.input}
              value={payee}
              onChangeText={setPayee}
              placeholder="e.g. Servaid Pharmacy"
              accessibilityLabel="Payee"
            />
          </Field>

          <Field label="Description (optional)">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Notes for filing time"
              multiline
              numberOfLines={3}
              accessibilityLabel="Description"
            />
          </Field>

          <Field label="Receipt (optional)">
            {uploading ? (
              <View style={styles.receiptUploading}>
                <ActivityIndicator color="#4f46e5" />
                <Text style={styles.receiptUploadingText}>Uploading…</Text>
              </View>
            ) : receiptPreview ? (
              <View style={styles.receiptCard}>
                <Image
                  source={{ uri: receiptPreview }}
                  style={styles.receiptImage}
                  accessibilityLabel="Receipt image attached"
                />
                <TouchableOpacity
                  style={styles.receiptRemove}
                  onPress={onRemoveReceipt}
                  accessibilityRole="button"
                  accessibilityLabel="Remove receipt"
                >
                  <MaterialIcons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.receiptAdd}
                onPress={onAttachReceipt}
                accessibilityRole="button"
                accessibilityLabel="Attach receipt"
                accessibilityHint="Opens camera or photo library"
              >
                <MaterialIcons name="add-a-photo" size={24} color="#4f46e5" />
                <Text style={styles.receiptAddText}>Attach receipt</Text>
              </TouchableOpacity>
            )}
          </Field>

          <TouchableOpacity
            style={[styles.saveButton, (saving || uploading) && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving || uploading}
            accessibilityRole="button"
            accessibilityLabel="Save expense"
            accessibilityState={{ busy: saving, disabled: saving || uploading }}
          >
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>

          {editingClientId ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete expense"
              accessibilityHint="Removes this expense from your ledger"
            >
              <MaterialIcons name="delete-outline" size={20} color="#dc2626" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Field = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const ChipPicker = ({ options, value, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
    {options.map((opt) => {
      const selected = opt === value;
      const label = opt.replace(/_/g, ' ');
      return (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, selected && styles.chipSelected]}
          onPress={() => onChange(opt)}
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ selected }}
        >
          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: { padding: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { paddingVertical: 4 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  chipSelected: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, color: '#374151', textTransform: 'capitalize' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', marginLeft: 8, fontSize: 16 },
  deleteButton: {
    flexDirection: 'row',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: { color: '#dc2626', fontWeight: '600', marginLeft: 8, fontSize: 16 },
  receiptAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#4f46e5',
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  receiptAddText: { color: '#4f46e5', fontWeight: '600', marginLeft: 8 },
  receiptCard: { position: 'relative' },
  receiptImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  receiptRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptUploading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  receiptUploadingText: { marginLeft: 8, color: '#6b7280', fontSize: 13 },
});

export default ExpenseCaptureScreen;
