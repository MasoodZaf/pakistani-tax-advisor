import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../services/api';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await dashboardAPI.getDashboardData();
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Dashboard data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const QuickActionCard = ({ title, subtitle, icon, color, onPress, badge }) => (
    <TouchableOpacity style={[styles.quickActionCard, { borderLeftColor: color }]} onPress={onPress}>
      <View style={styles.quickActionContent}>
        <View style={styles.quickActionHeader}>
          <MaterialIcons name={icon} size={24} color={color} />
          {badge && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const StatsCard = ({ title, value, change, changeType, icon, color }) => (
    <View style={[styles.statsCard, { backgroundColor: color }]}>
      <View style={styles.statsContent}>
        <MaterialIcons name={icon} size={32} color="#ffffff" style={styles.statsIcon} />
        <View style={styles.statsInfo}>
          <Text style={styles.statsValue}>{value}</Text>
          <Text style={styles.statsTitle}>{title}</Text>
          {change && (
            <View style={styles.changeContainer}>
              <MaterialIcons 
                name={changeType === 'increase' ? 'trending-up' : 'trending-down'} 
                size={16} 
                color="#ffffff" 
              />
              <Text style={styles.changeText}>{change}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <MaterialIcons name="notifications" size={24} color="#6b7280" />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <StatsCard
            title="Tax Year Progress"
            value={dashboardData?.completion_percentage ? `${dashboardData.completion_percentage}%` : '0%'}
            icon="assessment"
            color="#4f46e5"
          />
          <StatsCard
            title="Estimated Tax"
            value={formatCurrency(dashboardData?.estimated_tax || 0)}
            icon="account-balance-wallet"
            color="#059669"
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <QuickActionCard
            title="Complete Tax Forms"
            subtitle="Fill out your income and deduction details"
            icon="description"
            color="#4f46e5"
            onPress={() => navigation.navigate('TaxForms')}
            badge={dashboardData?.incomplete_forms || null}
          />

          <QuickActionCard
            title="Tax Calculator"
            subtitle="Calculate your estimated tax liability"
            icon="calculate"
            color="#059669"
            onPress={() => {
              // Navigate to tax calculator
            }}
          />

          <QuickActionCard
            title="Upload Documents"
            subtitle="Scan and upload tax documents"
            icon="camera-alt"
            color="#dc2626"
            onPress={() => {
              // Navigate to document upload
            }}
          />

          <QuickActionCard
            title="Tax History"
            subtitle="View previous years' tax returns"
            icon="history"
            color="#7c3aed"
            onPress={() => {
              // Navigate to tax history
            }}
          />
        </View>

        {/* Current Tax Year Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Year 2025-26 Status</Text>
          
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <MaterialIcons name="event" size={20} color="#4f46e5" />
              <Text style={styles.statusTitle}>Filing Deadline</Text>
            </View>
            <Text style={styles.statusDeadline}>September 30, 2026</Text>
            <Text style={styles.statusDays}>234 days remaining</Text>
            
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Forms Completion</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${dashboardData?.completion_percentage || 0}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {dashboardData?.completion_percentage || 0}% Complete
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          <View style={styles.activityCard}>
            <MaterialIcons name="check-circle" size={20} color="#059669" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Income form saved</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
          </View>

          <View style={styles.activityCard}>
            <MaterialIcons name="info" size={20} color="#f59e0b" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Tax year 2025-26 opened</Text>
              <Text style={styles.activityTime}>1 week ago</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🇵🇰 Compliant with FBR Tax Laws 2025-26
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  greeting: {
    fontSize: 16,
    color: '#6b7280',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 10,
    gap: 12,
  },
  statsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsIcon: {
    marginRight: 12,
  },
  statsInfo: {
    flex: 1,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statsTitle: {
    fontSize: 12,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 2,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  changeText: {
    fontSize: 12,
    color: '#ffffff',
    marginLeft: 4,
  },
  section: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    padding: 20,
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  statusDeadline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  statusDays: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  activityContent: {
    marginLeft: 12,
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default DashboardScreen;