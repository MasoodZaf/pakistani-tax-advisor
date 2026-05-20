import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getExpense,
  resolveConflictKeepMine,
  resolveConflictKeepServer,
} from '../services/expensesDb';
import { syncAll } from '../services/expensesSync';

const formatMoney = (n, currency = 'PKR') =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: currency || 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// Fields shown in the diff, in display order.
const FIELDS = [
  { key: 'amount', label: 'Amount', render: (r) => formatMoney(r.amount, r.currency) },
  { key: 'occurred_on', label: 'Date' },
  { key: 'category', label: 'Category', render: (r) => (r.category || '').replace(/_/g, ' ') },
  { key: 'payee', label: 'Payee' },
  { key: 'description', label: 'Description' },
  { key: 'payment_method', label: 'Payment' },
];

const ConflictResolutionScreen = ({ route, navigation }) => {
  const clientId = route?.params?.clientId;
  const [local, setLocal] = useState(null);
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    const row = await getExpense(clientId);
    if (!row) {
      setLoading(false);
      return;
    }
    setLocal(row);
    if (row.conflict_server_data) {
      try {
        setServer(JSON.parse(row.conflict_server_data));
      } catch {
        setServer(null);
      }
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (keep) => {
    setResolving(true);
    try {
      if (keep === 'mine') {
        await resolveConflictKeepMine(clientId);
      } else {
        await resolveConflictKeepServer(clientId);
      }
      // Push immediately so the resolution lands server-side.
      syncAll().catch(() => {});
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not resolve', err.message || 'Unknown error');
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!local) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.muted}>This expense is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // A field differs if the two sides don't string-match.
  const differs = (key) =>
    server && String(local[key] ?? '') !== String(server[key] ?? '');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.banner}>
          <MaterialIcons name="warning" size={20} color="#92400e" />
          <Text style={styles.bannerText}>
            This expense was changed in two places. Pick which version to keep.
          </Text>
        </View>

        {!server && (
          <Text style={styles.muted}>
            The server's version couldn't be loaded. "Keep server version" will
            re-sync from the server on your next refresh.
          </Text>
        )}

        {/* Diff table */}
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.cellLabel, styles.headerText]}>Field</Text>
            <Text style={[styles.cell, styles.headerText]}>Yours</Text>
            <Text style={[styles.cell, styles.headerText]}>Server</Text>
          </View>
          {FIELDS.map((f) => {
            const mine = f.render ? f.render(local) : local[f.key];
            const theirs = server ? (f.render ? f.render(server) : server[f.key]) : '—';
            const diff = differs(f.key);
            return (
              <View key={f.key} style={[styles.row, diff && styles.rowDiff]}>
                <Text style={[styles.cell, styles.cellLabel]}>{f.label}</Text>
                <Text style={[styles.cell, diff && styles.cellDiff]}>{mine || '—'}</Text>
                <Text style={[styles.cell, diff && styles.cellDiff]}>{theirs || '—'}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.btnMine, resolving && styles.btnDisabled]}
          onPress={() => resolve('mine')}
          disabled={resolving}
        >
          <MaterialIcons name="smartphone" size={18} color="#fff" />
          <Text style={styles.btnText}>Keep my version</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnServer, resolving && styles.btnDisabled]}
          onPress={() => resolve('server')}
          disabled={resolving}
        >
          <MaterialIcons name="cloud" size={18} color="#1f2937" />
          <Text style={[styles.btnText, { color: '#1f2937' }]}>Keep server version</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: { padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  muted: { color: '#6b7280', fontSize: 14, marginBottom: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { color: '#92400e', fontSize: 13, marginLeft: 8, flex: 1 },
  table: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerRow: { backgroundColor: '#f9fafb' },
  rowDiff: { backgroundColor: '#fff7ed' },
  cell: { flex: 1, padding: 10, fontSize: 13, color: '#1f2937', textTransform: 'capitalize' },
  cellLabel: { flex: 0.8, fontWeight: '600', color: '#6b7280', textTransform: 'none' },
  cellDiff: { fontWeight: '700', color: '#9a3412' },
  headerText: { fontWeight: '700', color: '#374151', fontSize: 12, textTransform: 'none' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  btnMine: { backgroundColor: '#4f46e5' },
  btnServer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 8 },
});

export default ConflictResolutionScreen;
