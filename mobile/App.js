import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { syncAll } from './src/services/expensesSync';

// Foreground-resume sync. The OS sends AppState 'active' whenever the user
// switches back to the app from the home screen, lock screen, or another
// app. We use that signal to flush any pending expenses to the server so
// data captured offline never sits stale on the device.
//
// Background sync (app fully closed) needs expo-task-manager + a custom dev
// client — see docs/mobile-expenses-design.md "Pending" list.
function useForegroundSync() {
  const lastSyncedRef = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Throttle: skip if we synced in the last 30s.
      if (Date.now() - lastSyncedRef.current < 30_000) return;
      lastSyncedRef.current = Date.now();
      syncAll().catch(() => { /* surfaced via SyncStatusChip */ });
    });
    return () => sub.remove();
  }, []);
}

export default function App() {
  useForegroundSync();
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
