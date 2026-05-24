import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { wizardAPI } from '../services/wizardAPI';
import WizardField from '../components/WizardField';

// AI Quick-Start Wizard — mobile mirror of Frontend/src/components/Wizard/.
// Same backend (/api/wizard/*), same flow: status → start → turn × N →
// finalize → review. Two layers of input: structured WizardField widgets
// (always available, deterministic) and an optional free-text drawer that
// goes through the LLM extractor on the server. Structured values win on
// conflict — matches web + backend behaviour.

const formatPkr = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(Number(n));
};

// Seed a step's initial widget values from the prior captured_data (re-run
// flow) or empty if first time through. PKR fields also get a rawText
// pre-populated so the input shows the formatted display from the start.
function seedValuesForStep(promptSchema, capturedForStep) {
  if (!promptSchema) return { values: {}, rawText: {} };
  const values = {};
  const rawText = {};
  for (const f of promptSchema.fields) {
    if (capturedForStep && capturedForStep[f.key] !== undefined) {
      values[f.key] = capturedForStep[f.key];
      if (
        (f.input_type === 'pkr_amount' || f.input_type === 'pkr_optional' || f.input_type === 'number') &&
        capturedForStep[f.key] != null
      ) {
        rawText[f.key] = new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(
          capturedForStep[f.key]
        );
      }
    } else if (f.default != null) {
      values[f.key] = f.default;
    }
  }
  return { values, rawText };
}

const WizardScreen = ({ navigation }) => {
  // mode: 'loading' | 'turn' | 'finalizing' | 'review' | 'error'
  const [mode, setMode] = useState('loading');
  const [error, setError] = useState(null);

  const [session, setSession] = useState(null); // { id, captured_data }
  const [step, setStep] = useState(null); // { id, prompt, progress }
  const [values, setValues] = useState({});
  const [rawText, setRawText] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldErrorBanner, setFieldErrorBanner] = useState(null);
  const [rawReply, setRawReply] = useState('');
  const [lastEcho, setLastEcho] = useState(null);
  const [showFreeText, setShowFreeText] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [review, setReview] = useState(null);

  const submitLockRef = useRef(false);
  const scrollRef = useRef(null);

  // ── Boot: start or resume ─────────────────────────────────────────────
  const boot = useCallback(async () => {
    setMode('loading');
    setError(null);
    try {
      const status = await wizardAPI.status();
      if (status.completed && !status.in_progress) {
        Alert.alert(
          'Already completed',
          'Quick-start was already completed for this year. Open Settings to re-run.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      const started = await wizardAPI.start({});
      setSession({
        id: started.session_id,
        captured_data: started.captured_data || {},
      });
      const seed = seedValuesForStep(
        started.prompt,
        (started.captured_data || {})[started.current_step]
      );
      setStep({
        id: started.current_step,
        prompt: started.prompt,
        progress: started.progress,
      });
      setValues(seed.values);
      setRawText(seed.rawText);
      setFieldErrors({});
      setRawReply('');
      setLastEcho(null);
      setMode('turn');
    } catch (e) {
      console.error('wizard boot failed', e);
      setError(e?.response?.data?.error || e?.message || 'wizard_failed');
      setMode('error');
    }
  }, [navigation]);

  useEffect(() => { boot(); }, [boot]);

  // Auto-scroll to top when step changes so the prompt is in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step?.id]);

  // ── Submit current step ───────────────────────────────────────────────
  const submitTurn = useCallback(async () => {
    if (submitLockRef.current || !session || !step) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const turn = await wizardAPI.turn({
        sessionId: session.id,
        stepId: step.id,
        values,
        rawReply: rawReply || undefined,
      });

      setSession((s) => ({ ...s, captured_data: { ...s.captured_data, [step.id]: values } }));

      if (turn.done) {
        setLastEcho(turn.echo || null);
        setMode('finalizing');
        try {
          const fin = await wizardAPI.finalize({ sessionId: session.id });
          setReview(fin);
          setMode('review');
        } catch (e) {
          Alert.alert('Could not finalize', e?.response?.data?.error || 'Try again.');
          setMode('turn');
        }
        return;
      }

      setStep({
        id: turn.next_step,
        prompt: turn.prompt,
        progress: turn.progress,
      });
      const seed = seedValuesForStep(
        turn.prompt,
        (session.captured_data || {})[turn.next_step]
      );
      setValues(seed.values);
      setRawText(seed.rawText);
      setFieldErrors({});
      setFieldErrorBanner(null);
      setRawReply('');
      setShowFreeText(false);
      setLastEcho(turn.echo || null);
    } catch (e) {
      const data = e?.response?.data;
      if (e?.response?.status === 422 && data?.field_errors) {
        // Inline banner instead of a blocking Alert so the user can
        // immediately see which fields are highlighted in red below.
        setFieldErrors(data.field_errors);
        setLastEcho(data.echo || null);
        setFieldErrorBanner('Please check the highlighted field(s) below and try again.');
      } else {
        Alert.alert('Could not save', data?.error || e?.message || 'Try again.');
      }
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }, [session, step, values, rawReply]);

  const setValueAt = useCallback((key, v) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev, [key]: undefined };
      // Hide the banner once every flagged field has been touched.
      const anyLeft = Object.entries(next).some(([, code]) => !!code);
      if (!anyLeft) setFieldErrorBanner(null);
      return next;
    });
  }, []);
  const setRawTextAt = useCallback((key, t) => {
    setRawText((prev) => ({ ...prev, [key]: t }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  if (mode === 'loading' || mode === 'finalizing') {
    return (
      <View style={styles.centeredLoader}>
        <ActivityIndicator size="large" color="#28396C" />
        <Text style={styles.loaderText}>
          {mode === 'finalizing' ? 'Calculating your rough tax estimate…' : 'Loading wizard…'}
        </Text>
      </View>
    );
  }

  if (mode === 'error') {
    return (
      <View style={styles.centeredLoader}>
        <MaterialIcons name="error-outline" size={40} color="#ef4444" />
        <Text style={styles.errorTitle}>Couldn't start the wizard.</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={boot}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (mode === 'review') {
    return (
      <ReviewScreen
        review={review}
        onDone={() => navigation.goBack()}
      />
    );
  }

  // mode === 'turn'
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#fdfcf8' }}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tax Quick-Start</Text>
          <Text style={styles.headerSubtitle}>A few quick questions for a rough estimate.</Text>
        </View>

        <ProgressBar current={step.progress.current} total={step.progress.total} />

        {fieldErrorBanner && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color="#b91c1c" />
            <Text style={styles.errorBannerText}>{fieldErrorBanner}</Text>
          </View>
        )}

        {lastEcho && (
          <View style={styles.echoBanner}>
            <Text style={styles.echoText}>{lastEcho}</Text>
          </View>
        )}

        {/* Assistant prompt */}
        <View style={styles.promptBubble}>
          <View style={styles.promptHeader}>
            <MaterialIcons name="auto-awesome" size={14} color="#28396C" />
            <Text style={styles.promptHeaderText}>ASSISTANT</Text>
          </View>
          <Text style={styles.promptText}>{step.prompt.prompt}</Text>
        </View>

        {/* Structured inputs */}
        {step.prompt.fields.map((f) => (
          <WizardField
            key={f.key}
            field={f}
            value={values[f.key]}
            rawText={rawText[f.key]}
            setRawText={setRawTextAt}
            setValue={setValueAt}
            error={fieldErrors[f.key]}
          />
        ))}

        {/* Optional free-text drawer */}
        <TouchableOpacity onPress={() => setShowFreeText((v) => !v)} style={styles.drawerToggle}>
          <MaterialIcons
            name={showFreeText ? 'expand-less' : 'expand-more'}
            size={18}
            color="#7a8890"
          />
          <Text style={styles.drawerText}>Prefer to describe it in words?</Text>
        </TouchableOpacity>
        {showFreeText && (
          <View style={styles.drawerContent}>
            <TextInput
              style={styles.freeTextInput}
              value={rawReply}
              onChangeText={setRawReply}
              placeholder='e.g. "Basic 15 lakh, allowance 2 lakh, no bonus"'
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
            <Text style={styles.drawerHint}>
              We'll fill the boxes above from this — you can still adjust before continuing.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
          onPress={submitTurn}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.continueButtonText}>Saving…</Text>
            </>
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continue</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────

const ProgressBar = ({ current, total }) => {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>STEP {current} OF {total}</Text>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
};

const ReviewScreen = ({ review, onDone }) => {
  const rough = review?.rough_calc;
  const totalIncome = rough?.income?.totalIncome;
  const totalTax = rough?.tax?.totalTaxChargeable;
  const balance = rough?.payments?.balancePayableRefundable;
  const balanceIsRefund = balance != null && balance < 0;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tax Quick-Start</Text>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.reviewTitleRow}>
          <MaterialIcons name="check-circle" size={22} color="#16a34a" />
          <Text style={styles.reviewTitle}>Done — here's your rough estimate</Text>
        </View>

        {rough ? (
          <View style={styles.statGrid}>
            <Stat label="Total income" value={formatPkr(totalIncome)} />
            <Stat label="Tax chargeable" value={formatPkr(totalTax)} />
            <Stat
              label={balanceIsRefund ? 'Refund due' : 'Balance to pay'}
              value={formatPkr(Math.abs(balance ?? 0))}
              tone={balanceIsRefund ? 'good' : 'neutral'}
            />
            <Stat label="Tax year" value={rough.taxYear} />
          </View>
        ) : (
          <Text style={styles.noCalc}>
            We couldn't auto-calculate, but your inputs are saved. Open the app to see the full breakdown.
          </Text>
        )}

        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            These are rough estimates based on what you told the wizard.
            Open each form in the app and verify the numbers before submitting your return to FBR.
          </Text>
        </View>

        {review?.tables_written?.length > 0 && (
          <Text style={styles.draftsNote}>
            Drafts saved to {review.tables_written.length} form{review.tables_written.length > 1 ? 's' : ''} — ready for you to review in the app.
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={onDone}>
        <Text style={styles.continueButtonText}>Open the app</Text>
        <MaterialIcons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );
};

const Stat = ({ label, value, tone = 'neutral' }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    <Text style={[styles.statValue, tone === 'good' && styles.statValueGood]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  centeredLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdfcf8',
    padding: 24,
  },
  loaderText: { marginTop: 16, fontSize: 14, color: '#7a8890', fontWeight: '600' },
  errorTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#1e2a4a' },
  errorBody: { marginTop: 4, fontSize: 13, color: '#7a8890', textAlign: 'center' },

  header: { alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1e2a4a' },
  headerSubtitle: { fontSize: 13, color: '#7a8890', fontWeight: '500', marginTop: 2 },

  progressBlock: { marginBottom: 16 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#7a8890', letterSpacing: 1 },
  progressPct: { fontSize: 12, fontWeight: '600', color: '#7a8890' },
  progressTrack: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#28396C' },

  echoBanner: {
    backgroundColor: '#F0FFC2',
    borderWidth: 1.5,
    borderColor: '#c0da94',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  echoText: { fontSize: 13, color: '#28396C', fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: { fontSize: 13, color: '#b91c1c', fontWeight: '600', flex: 1 },

  promptBubble: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0dfd9',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  promptHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  promptHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28396C',
    letterSpacing: 1,
    marginLeft: 6,
  },
  promptText: { fontSize: 15, color: '#1e2a4a', lineHeight: 22 },

  drawerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  drawerText: { fontSize: 13, fontWeight: '600', color: '#7a8890', marginLeft: 4 },
  drawerContent: { marginBottom: 16 },
  freeTextInput: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0dfd9',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1c1d1a',
    minHeight: 64,
    textAlignVertical: 'top',
  },
  drawerHint: { marginTop: 4, fontSize: 11, color: '#7a8890', fontWeight: '500' },

  continueButton: {
    backgroundColor: '#28396C',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { color: '#fff', fontSize: 15, fontWeight: '700', marginRight: 6 },

  button: {
    backgroundColor: '#28396C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Review screen
  reviewCard: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e0dfd9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  reviewTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  reviewTitle: { fontSize: 18, fontWeight: '800', color: '#1e2a4a', marginLeft: 8, flex: 1 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statBox: {
    width: '48%',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#7a8890', letterSpacing: 1 },
  statValue: { fontSize: 17, fontWeight: '800', color: '#1e2a4a', marginTop: 4 },
  statValueGood: { color: '#16a34a' },
  callout: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    borderRadius: 10,
  },
  calloutText: { fontSize: 13, color: '#78350f', fontWeight: '600', lineHeight: 19 },
  draftsNote: { fontSize: 11, color: '#7a8890', fontWeight: '500', marginTop: 12 },
  noCalc: { fontSize: 13, color: '#7a8890', fontWeight: '500' },
});

export default WizardScreen;
