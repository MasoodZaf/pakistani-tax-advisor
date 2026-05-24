import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { wizardAPI } from '../services/wizardAPI';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const [wizardStatus, setWizardStatus] = useState(null);

  const refreshWizardStatus = useCallback(async () => {
    try {
      setWizardStatus(await wizardAPI.status());
    } catch {
      setWizardStatus(null);
    }
  }, []);
  useEffect(() => { refreshWizardStatus(); }, [refreshWizardStatus]);

  // Re-run: confirm, archive prior session, navigate to wizard which picks
  // up the seed from the server-side lastArchivedSeed lookup.
  const reRunWizard = () => {
    Alert.alert(
      'Run the wizard again?',
      'Your previous answers will be pre-filled — you\'ll edit them in place. The new run replaces the prior estimate when you finish.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, run again',
          onPress: async () => {
            try {
              await wizardAPI.reset();
              navigation.navigate('Wizard');
            } catch (e) {
              Alert.alert('Could not reset wizard', e?.response?.data?.error || 'Try again.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: logout,
          style: 'destructive',
        },
      ]
    );
  };

  const InfoRow = ({ icon, title, subtitle }) => (
    <View style={styles.profileItem}>
      <View style={styles.profileItemLeft}>
        <MaterialIcons name={icon} size={24} color="#4f46e5" />
        <View style={styles.profileItemText}>
          <Text style={styles.profileItemTitle}>{title}</Text>
          {subtitle ? <Text style={styles.profileItemSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );

  const showAbout = () => {
    Alert.alert(
      'Pakistani Tax Advisor',
      'Mobile companion app for the Pakistani Tax Advisor web app.\n\nThe full feature set — including Wealth Statement, Capital Gains, Adjustable Tax, AI Consultant, and submission — is available on the web at tax.aurmak.com.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <MaterialIcons name="person" size={40} color="#ffffff" />
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role?.replace('_', ' ').toUpperCase() || 'USER'}
            </Text>
          </View>
        </View>

        {/* Account info — display only on mobile. Editing happens on the web app. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <InfoRow icon="email" title="Email" subtitle={user?.email || '—'} />
          {user?.cnic ? <InfoRow icon="credit-card" title="CNIC" subtitle={user.cnic} /> : null}
          {user?.phone ? <InfoRow icon="phone" title="Phone" subtitle={user.phone} /> : null}
        </View>

        {/* Quick-start wizard control — mirrors web Settings → Security. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick-start wizard</Text>
          {!wizardStatus ? (
            <View style={styles.profileItem}>
              <Text style={styles.profileItemSubtitle}>Loading…</Text>
            </View>
          ) : wizardStatus.in_progress ? (
            <TouchableOpacity style={styles.profileItem} onPress={() => navigation.navigate('Wizard')}>
              <View style={styles.profileItemLeft}>
                <MaterialIcons name="auto-awesome" size={24} color="#4f46e5" />
                <View style={styles.profileItemText}>
                  <Text style={styles.profileItemTitle}>Wizard is in progress</Text>
                  <Text style={styles.profileItemSubtitle}>Resume where you left off</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : wizardStatus.completed ? (
            <TouchableOpacity style={styles.profileItem} onPress={reRunWizard}>
              <View style={styles.profileItemLeft}>
                <MaterialIcons name="refresh" size={24} color="#4f46e5" />
                <View style={styles.profileItemText}>
                  <Text style={styles.profileItemTitle}>Run wizard again</Text>
                  <Text style={styles.profileItemSubtitle}>
                    {wizardStatus.last_completed_at
                      ? `Finished ${new Date(wizardStatus.last_completed_at).toLocaleDateString()}`
                      : 'Completed for this year'}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.profileItem} onPress={() => navigation.navigate('Wizard')}>
              <View style={styles.profileItemLeft}>
                <MaterialIcons name="auto-awesome" size={24} color="#4f46e5" />
                <View style={styles.profileItemText}>
                  <Text style={styles.profileItemTitle}>Run quick-start wizard</Text>
                  <Text style={styles.profileItemSubtitle}>~90 seconds for a rough tax estimate</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <TouchableOpacity style={styles.profileItem} onPress={showAbout}>
            <View style={styles.profileItemLeft}>
              <MaterialIcons name="info" size={24} color="#4f46e5" />
              <View style={styles.profileItemText}>
                <Text style={styles.profileItemTitle}>About this app</Text>
                <Text style={styles.profileItemSubtitle}>Version 1.0.0</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🇵🇰 Pakistani Tax Advisor v1.0.0
          </Text>
          <Text style={styles.footerSubtext}>
            Compliant with FBR Tax Laws 2025-26
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: '#4f46e5',
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileItemText: {
    marginLeft: 16,
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  profileItemSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutSection: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default ProfileScreen;