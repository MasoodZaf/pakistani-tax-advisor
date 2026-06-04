// Thin wrapper around expo-secure-store for the auth session token.
//
// Why this exists: plain AsyncStorage writes to unencrypted disk
// (NSUserDefaults on iOS, SharedPreferences on Android). A bearer token left
// there is readable from device backups, by another app with backup-extract
// privileges, and from a jailbroken device. SecureStore puts it in the
// iOS Keychain / Android Keystore where it belongs.
//
// One-time migration: if a legacy AsyncStorage `sessionToken` is found on
// app start, we copy it into SecureStore and delete the AsyncStorage entry.
// After every user has launched the upgraded app once this becomes a no-op.

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'session_token_v1';
const LEGACY_KEY = 'sessionToken';

// SecureStore is unavailable on web — fall back to AsyncStorage there. The
// mobile threat model (lost/stolen device, backup extraction) doesn't really
// apply to web, so this is acceptable for the Expo Web target.
const isWeb = Platform.OS === 'web';

async function migrateLegacyIfNeeded() {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    // Only migrate if SecureStore doesn't already have a token — never
    // overwrite a freshly-issued token with a stale legacy one.
    const existing = await getRaw();
    if (!existing) {
      await setRaw(legacy);
    }
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {
    // Migration is best-effort. A failure here just leaves the legacy key in
    // place; next launch tries again.
  }
}

async function getRaw() {
  if (isWeb) return AsyncStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}

async function setRaw(value) {
  if (isWeb) {
    await AsyncStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value, {
    // _THIS_DEVICE_ONLY binds the token to this device so it never syncs to
    // another via iCloud Keychain (MSEC-04). AFTER_FIRST_UNLOCK is kept (not
    // WHEN_UNLOCKED) so post-reboot background tasks (sync, notifications) can
    // still read it before the first manual unlock.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

async function deleteRaw() {
  if (isWeb) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

export async function getToken() {
  await migrateLegacyIfNeeded();
  return getRaw();
}

export async function setToken(token) {
  if (!token) {
    await deleteRaw();
    return;
  }
  await setRaw(token);
}

export async function clearToken() {
  await deleteRaw();
  // Also remove any lingering legacy entry so a future SecureStore read can't
  // be shadowed by the migration path.
  try { await AsyncStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}
