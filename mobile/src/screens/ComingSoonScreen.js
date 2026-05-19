import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Shared "Coming Soon" placeholder. Pass `title`, `icon`, and optional
// `description` via route params. Screens that haven't been built yet should
// route here rather than ship hand-rolled placeholder copy that reads like
// real functionality.
const ComingSoonScreen = ({ route, navigation }) => {
  const { title = 'Coming Soon', icon = 'construction', description } = route?.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name={icon} size={80} color="#4f46e5" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.tag}>Coming soon on mobile</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <Text style={styles.hint}>
          This feature is available on the web app at tax.aurmak.com.
        </Text>
        {navigation?.canGoBack && navigation.canGoBack() ? (
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginTop: 20, textAlign: 'center' },
  tag: {
    fontSize: 12,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  description: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginTop: 16, lineHeight: 24 },
  hint: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginTop: 16 },
  backButton: { backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 32 },
  backButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});

export default ComingSoonScreen;
