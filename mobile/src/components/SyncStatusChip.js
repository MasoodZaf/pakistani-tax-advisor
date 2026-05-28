import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { countsByStatus } from '../services/expensesDb';
import { syncAll, getLastSyncedAt } from '../services/expensesSync';

// Self-contained chip that shows current sync state and acts as a manual
// "sync now" trigger when something needs attention. Hidden-until-needed is
// intentional — a permanent button signals unreliability and gets pressed
// superstitiously. See the discussion in this PR.
//
// States:
//   green   — all synced, shows relative time
//   yellow  — pending writes OR sync in flight (with spinner)
//   red     — sync error or unresolved conflict (tap to retry / resolve)

function formatAgo(iso) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SyncStatusChip = ({ onConflictPress }) => {
  const [counts, setCounts] = useState({ pending: 0, error: 0, conflict: 0 });
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [, setTick] = useState(0); // re-render every 30s to refresh "ago"

  const reload = useCallback(async () => {
    setCounts(await countsByStatus());
    setLastSyncedAt(await getLastSyncedAt());
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncAll();
    } catch {
      // Errors are reflected in counts.error — no need to surface a toast.
    } finally {
      await reload();
      setSyncing(false);
    }
  }, [syncing, reload]);

  const { pending, error, conflict } = counts;

  // Conflict takes priority — it needs explicit user resolution.
  if (conflict > 0) {
    const label = `${conflict} sync conflict${conflict === 1 ? '' : 's'}`;
    return (
      <TouchableOpacity
        style={[styles.chip, styles.red]}
        onPress={onConflictPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the conflict resolution screen"
      >
        <MaterialIcons name="warning" size={14} color="#fff" />
        <Text style={styles.text}>
          {conflict} conflict{conflict === 1 ? '' : 's'} — tap to resolve
        </Text>
      </TouchableOpacity>
    );
  }

  if (error > 0 && !syncing) {
    return (
      <TouchableOpacity
        style={[styles.chip, styles.red]}
        onPress={triggerSync}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Sync failed"
        accessibilityHint="Tap to retry"
      >
        <MaterialIcons name="error-outline" size={14} color="#fff" />
        <Text style={styles.text}>Couldn't sync — tap to retry</Text>
      </TouchableOpacity>
    );
  }

  if (syncing || pending > 0) {
    const label = syncing
      ? `Syncing${pending ? ` ${pending} expense${pending === 1 ? '' : 's'}` : ''}`
      : `${pending} expense${pending === 1 ? '' : 's'} pending sync`;
    return (
      <TouchableOpacity
        style={[styles.chip, styles.amber]}
        onPress={triggerSync}
        activeOpacity={0.8}
        disabled={syncing}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: syncing, disabled: syncing }}
        accessibilityHint={syncing ? '' : 'Tap to sync now'}
      >
        {syncing ? (
          <ActivityIndicator size="small" color="#92400e" />
        ) : (
          <MaterialIcons name="cloud-upload" size={14} color="#92400e" />
        )}
        <Text style={[styles.text, styles.amberText]}>
          {syncing
            ? `Syncing${pending ? ` ${pending}…` : '…'}`
            : `${pending} pending — tap to sync`}
        </Text>
      </TouchableOpacity>
    );
  }

  // All synced — quiet green chip with the relative time.
  const syncedLabel = lastSyncedAt
    ? `Synced ${formatAgo(lastSyncedAt)}`
    : 'Up to date';
  return (
    <TouchableOpacity
      style={[styles.chip, styles.green]}
      onPress={triggerSync}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={syncedLabel}
      accessibilityHint="Double tap to force sync"
    >
      <MaterialIcons name="cloud-done" size={14} color="#065f46" />
      <Text style={[styles.text, styles.greenText]}>
        {syncedLabel}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  red: { backgroundColor: '#dc2626' },
  amber: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d' },
  green: { backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#86efac' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
  amberText: { color: '#92400e' },
  greenText: { color: '#065f46' },
});

export default SyncStatusChip;
