import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { wizardAPI } from '../services/wizardAPI';

const DISMISS_KEY = '@wizard_cta_dismissed';

// Dashboard banner that surfaces the quick-start wizard. Mirrors the web
// component at Frontend/src/components/Wizard/WizardCTABanner.js. Same
// rules: hidden when completed; "Resume" when in_progress; "Start" + a
// dismiss X when fresh.
const WizardCtaBanner = () => {
  const navigation = useNavigation();
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Load dismissed flag from AsyncStorage on mount.
  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((v) => setDismissed(v === '1')).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await wizardAPI.status();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!status || status.completed) return null;
  if (dismissed && !status.in_progress) return null;

  const isResume = status.in_progress;

  const dismiss = async () => {
    try { await AsyncStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const go = () => navigation.navigate('Wizard');

  return (
    <View style={styles.banner}>
      <View style={styles.iconBox}>
        <MaterialIcons name="auto-awesome" size={18} color="#fff" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>
          {isResume ? 'Resume your tax quick-start' : 'Get a rough tax estimate in 90 seconds'}
        </Text>
        <Text style={styles.subtitle}>
          {isResume
            ? "Pick up where you left off — your answers are saved."
            : "A few quick questions, then we'll fill your form drafts and show a rough total."}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cta} onPress={go}>
          <Text style={styles.ctaText}>{isResume ? 'Resume' : 'Start'}</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
        {!isResume && (
          <TouchableOpacity onPress={dismiss} style={styles.dismiss}>
            <MaterialIcons name="close" size={16} color="#7a8890" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFC2',
    borderWidth: 1.5,
    borderColor: '#c0da94',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#28396C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800', color: '#1e2a4a' },
  subtitle: { fontSize: 12, color: '#3d3e37', fontWeight: '500', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cta: {
    backgroundColor: '#28396C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dismiss: { padding: 6 },
});

export default WizardCtaBanner;
