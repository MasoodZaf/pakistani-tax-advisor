import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';

// Picks an FBR 114(1) PDF, posts to /api/tax-history/upload, then offers
// "Copy forward" to pre-fill the current return. Same backend as the web
// PriorYearUploadModal — no mobile-specific API surface.

function formatPkr(n) {
  if (!Number.isFinite(n) || n === 0) return '—';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(n);
}

const PriorYearUploadScreen = ({ navigation }) => {
  const [picked, setPicked] = useState(null);     // { name, uri, mimeType, size }
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);     // server response after upload
  const [copying, setCopying] = useState(false);

  const onPickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/json',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled) return;
    setPicked(res.assets?.[0] || null);
    setResult(null);
  };

  const onUpload = async () => {
    if (!picked) return;
    setUploading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', {
        uri: picked.uri,
        name: picked.name,
        type: picked.mimeType || 'application/pdf',
      });
      // tax_year defaults server-side to '2024-25' but we let the server
      // pull it from the PDF when present (the parser writes mapped_data.tax_year).
      const response = await api.post('/tax-history/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      setResult(response.data);
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || err.message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const onCopyForward = async () => {
    const taxYear = result?.archive?.tax_year || result?.totals?.tax_year;
    if (!taxYear) {
      Alert.alert('Missing tax year', 'Cannot determine which archive to copy from.');
      return;
    }
    setCopying(true);
    try {
      await api.post(`/tax-history/archive/${taxYear}/copy-forward`);
      Alert.alert('Done', 'Your current year forms have been pre-filled.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Copy forward failed', err.response?.data?.message || err.message);
    } finally {
      setCopying(false);
    }
  };

  const totals = result?.archive?.totals || result?.totals || {};
  const summary = result?.archive?.mapped_data?.summary
    || result?.mapped_data?.summary
    || {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Upload Prior-Year Return</Text>
        <Text style={styles.sub}>
          Drop in your FBR 114(1) PDF from IRIS. We'll extract the totals
          and let you copy them into this year's forms as a starting point.
        </Text>

        {/* Picker card */}
        <TouchableOpacity style={styles.pickCard} onPress={onPickFile} activeOpacity={0.7}>
          <MaterialIcons name={picked ? 'description' : 'file-upload'} size={32} color="#4f46e5" />
          <Text style={styles.pickTitle}>
            {picked ? picked.name : 'Choose a PDF / Excel / JSON file'}
          </Text>
          {picked && (
            <Text style={styles.pickMeta}>
              {(picked.size / 1024).toFixed(0)} KB · tap to change
            </Text>
          )}
        </TouchableOpacity>

        {/* Upload action */}
        {picked && !result && (
          <TouchableOpacity
            style={[styles.primaryBtn, uploading && styles.primaryBtnDisabled]}
            onPress={onUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Upload & Extract</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Extracted summary */}
        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <MaterialIcons name="check-circle" size={22} color="#059669" />
              <Text style={styles.resultTitle}>Extracted</Text>
            </View>

            <SummaryRow label="Salary"            value={formatPkr(totals.totalEmploymentIncome ?? summary.total_income)} />
            <SummaryRow label="Total income"     value={formatPkr(summary.total_income)} />
            <SummaryRow label="Taxable income"   value={formatPkr(summary.taxable_income)} />
            <SummaryRow label="Tax chargeable"   value={formatPkr(summary.tax_chargeable)} />
            <SummaryRow label="Tax already paid (WHT)" value={formatPkr(summary.withholding_tax)} />
            <SummaryRow label="Refundable"       value={formatPkr(summary.refundable_tax)} />
            <SummaryRow label="Net assets"       value={formatPkr(summary.net_assets)} />

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 18 }, copying && styles.primaryBtnDisabled]}
              onPress={onCopyForward}
              disabled={copying}
            >
              {copying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="content-copy" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Copy into this year</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              You can always edit the pre-filled values afterwards in the
              Income form.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const SummaryRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: { padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#1f2937' },
  sub: { fontSize: 14, color: '#6b7280', marginTop: 6, marginBottom: 24 },
  pickCard: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  pickTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937', textAlign: 'center' },
  pickMeta: { fontSize: 12, color: '#6b7280' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 18,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginTop: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: { fontSize: 13, color: '#6b7280' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  hint: { marginTop: 12, fontSize: 12, color: '#6b7280' },
});

export default PriorYearUploadScreen;
