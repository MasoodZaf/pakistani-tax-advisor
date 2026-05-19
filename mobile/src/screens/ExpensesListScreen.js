import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { listExpenses, deriveTaxYear } from '../services/expensesDb';
import { syncAll } from '../services/expensesSync';

const formatCurrency = (n, currency = 'PKR') =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SYNC_ICON = {
  pending: { name: 'sync', color: '#f59e0b' },
  synced: { name: 'check-circle', color: '#059669' },
  conflict: { name: 'warning', color: '#dc2626' },
  error: { name: 'error', color: '#dc2626' },
};

const CURRENT_TAX_YEAR = deriveTaxYear(new Date().toISOString().slice(0, 10));

const ExpensesListScreen = ({ navigation }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const reload = useCallback(async () => {
    const rows = await listExpenses({ taxYear: CURRENT_TAX_YEAR, limit: 500 });
    setExpenses(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncMsg('');
    try {
      const summary = await syncAll();
      const parts = [];
      if (summary.pushed) parts.push(`${summary.pushed} pushed`);
      if (summary.applied) parts.push(`${summary.applied} pulled`);
      if (summary.conflicts) parts.push(`${summary.conflicts} conflict(s)`);
      if (summary.errors) parts.push(`${summary.errors} error(s)`);
      setSyncMsg(parts.length ? `Sync: ${parts.join(', ')}` : 'Up to date');
    } catch (err) {
      setSyncMsg(`Sync failed: ${err.message || 'unknown'}`);
    } finally {
      await reload();
      setRefreshing(false);
    }
  }, [reload]);

  const renderItem = ({ item }) => {
    const sync = SYNC_ICON[item.sync_status] || SYNC_ICON.synced;
    const displayAmount =
      item.currency === 'PKR'
        ? formatCurrency(item.amount, 'PKR')
        : `${formatCurrency(item.amount, item.currency)} · ${formatCurrency(item.amount_pkr, 'PKR')}`;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('ExpenseCapture', { clientId: item.client_id })}
      >
        <View style={styles.rowLeft}>
          <Text style={styles.rowAmount}>{displayAmount}</Text>
          <Text style={styles.rowMeta}>
            {formatDate(item.occurred_on)} · {item.category.replace(/_/g, ' ')}
          </Text>
          {item.payee ? <Text style={styles.rowPayee}>{item.payee}</Text> : null}
        </View>
        <View style={styles.rowIcons}>
          {item.receipt_id ? (
            <MaterialIcons name="attachment" size={18} color="#6b7280" style={styles.receiptIcon} />
          ) : null}
          <MaterialIcons name={sync.name} size={20} color={sync.color} />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Expenses</Text>
          <Text style={styles.headerSubtitle}>Tax year {CURRENT_TAX_YEAR}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('ExpenseCapture', {})}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.client_id}
        renderItem={renderItem}
        contentContainerStyle={expenses.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={64} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Add" to log your first expense. Pull down to sync with the server.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1f2937' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '600', marginLeft: 4 },
  syncMsg: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
  },
  list: { paddingVertical: 8 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  rowLeft: { flex: 1 },
  rowAmount: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  rowMeta: { fontSize: 13, color: '#6b7280', marginTop: 4, textTransform: 'capitalize' },
  rowPayee: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  rowIcons: { flexDirection: 'row', alignItems: 'center' },
  receiptIcon: { marginRight: 6 },
});

export default ExpensesListScreen;
