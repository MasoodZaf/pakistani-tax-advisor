import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { taxFormsAPI } from '../services/api';

const TaxFormsScreen = ({ navigation }) => {
  const [formsData, setFormsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFormsData();
  }, []);

  const loadFormsData = async () => {
    try {
      const response = await taxFormsAPI.getTaxForms();
      if (response.success) {
        setFormsData(response.data);
      }
    } catch (error) {
      console.error('Forms data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFormsData();
    setRefreshing(false);
  };

  const FormCard = ({ 
    title, 
    description, 
    icon, 
    status, 
    onPress, 
    required = true,
    completionPercentage = 0 
  }) => {
    const getStatusColor = () => {
      switch (status) {
        case 'completed': return '#059669';
        case 'in_progress': return '#f59e0b';
        case 'pending': return '#6b7280';
        default: return '#6b7280';
      }
    };

    const getStatusIcon = () => {
      switch (status) {
        case 'completed': return 'check-circle';
        case 'in_progress': return 'schedule';
        case 'pending': return 'radio-button-unchecked';
        default: return 'radio-button-unchecked';
      }
    };

    const getStatusText = () => {
      switch (status) {
        case 'completed': return 'Completed';
        case 'in_progress': return 'In Progress';
        case 'pending': return 'Not Started';
        default: return 'Not Started';
      }
    };

    return (
      <TouchableOpacity style={styles.formCard} onPress={onPress}>
        <View style={styles.formCardHeader}>
          <View style={styles.formIconContainer}>
            <MaterialIcons name={icon} size={28} color="#4f46e5" />
          </View>
          <View style={styles.formInfo}>
            <View style={styles.formTitleRow}>
              <Text style={styles.formTitle}>{title}</Text>
              {required && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              )}
            </View>
            <Text style={styles.formDescription}>{description}</Text>
          </View>
          <View style={styles.statusContainer}>
            <MaterialIcons 
              name={getStatusIcon()} 
              size={24} 
              color={getStatusColor()} 
            />
          </View>
        </View>

        <View style={styles.formProgress}>
          <View style={styles.progressInfo}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
            {status === 'in_progress' && (
              <Text style={styles.progressPercentage}>
                {completionPercentage}% complete
              </Text>
            )}
          </View>
          
          {status === 'in_progress' && (
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${completionPercentage}%`,
                    backgroundColor: getStatusColor()
                  }
                ]} 
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const forms = [
    {
      id: 'income',
      title: 'Income Information',
      description: 'Enter your salary, bonuses, and other income sources',
      icon: 'attach-money',
      status: formsData?.income?.status || 'pending',
      completionPercentage: formsData?.income?.completion_percentage || 0,
      required: true,
      screen: 'IncomeForm',
    },
    {
      id: 'deductions',
      title: 'Deductions & Allowances',
      description: 'Claim eligible deductions and tax allowances',
      icon: 'receipt',
      status: formsData?.deductions?.status || 'pending',
      completionPercentage: formsData?.deductions?.completion_percentage || 0,
      required: true,
      screen: 'DeductionsForm',
    },
    {
      id: 'wealth',
      title: 'Wealth Statement',
      description: 'Declare your assets and investments',
      icon: 'account-balance',
      status: formsData?.wealth?.status || 'pending',
      completionPercentage: formsData?.wealth?.completion_percentage || 0,
      required: false,
      screen: 'WealthForm',
    },
    {
      id: 'capital_gains',
      title: 'Capital Gains',
      description: 'Report capital gains from property and securities',
      icon: 'trending-up',
      status: formsData?.capital_gains?.status || 'pending',
      completionPercentage: formsData?.capital_gains?.completion_percentage || 0,
      required: false,
      screen: 'CapitalGainsForm',
    },
    {
      id: 'final_tax',
      title: 'Final Tax Calculation',
      description: 'Review and finalize your tax calculation',
      icon: 'calculate',
      status: formsData?.final_tax?.status || 'pending',
      completionPercentage: formsData?.final_tax?.completion_percentage || 0,
      required: true,
      screen: 'FinalTaxForm',
    },
  ];

  const completedForms = forms.filter(form => form.status === 'completed').length;
  const totalRequiredForms = forms.filter(form => form.required).length;
  const overallProgress = Math.round((completedForms / forms.length) * 100);

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
          <Text style={styles.headerTitle}>Tax Forms 2025-26</Text>
          <Text style={styles.headerSubtitle}>
            Complete all required forms to file your tax return
          </Text>
        </View>

        {/* Progress Overview */}
        <View style={styles.progressOverview}>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressNumber}>{completedForms}</Text>
              <Text style={styles.progressLabel}>Completed</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressNumber}>{forms.length - completedForms}</Text>
              <Text style={styles.progressLabel}>Remaining</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressNumber}>{overallProgress}%</Text>
              <Text style={styles.progressLabel}>Progress</Text>
            </View>
          </View>
          
          <View style={styles.overallProgressBar}>
            <View 
              style={[
                styles.overallProgressFill, 
                { width: `${overallProgress}%` }
              ]} 
            />
          </View>
        </View>

        {/* Forms List */}
        <View style={styles.formsContainer}>
          {forms.map((form) => (
            <FormCard
              key={form.id}
              title={form.title}
              description={form.description}
              icon={form.icon}
              status={form.status}
              required={form.required}
              completionPercentage={form.completionPercentage}
              onPress={() => navigation.navigate(form.screen)}
            />
          ))}
        </View>

        {/* Submit Section */}
        <View style={styles.submitSection}>
          <View style={styles.submitCard}>
            <MaterialIcons name="send" size={32} color="#4f46e5" />
            <Text style={styles.submitTitle}>Ready to Submit?</Text>
            <Text style={styles.submitDescription}>
              Complete all required forms to submit your tax return
            </Text>
            
            <TouchableOpacity
              style={[
                styles.submitButton,
                completedForms < totalRequiredForms && styles.submitButtonDisabled
              ]}
              disabled={completedForms < totalRequiredForms}
            >
              <Text style={styles.submitButtonText}>
                {completedForms < totalRequiredForms 
                  ? `Complete ${totalRequiredForms - completedForms} more form${totalRequiredForms - completedForms > 1 ? 's' : ''}`
                  : 'Submit Tax Return'
                }
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <TouchableOpacity style={styles.helpCard}>
            <MaterialIcons name="help" size={24} color="#6b7280" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Need Help?</Text>
              <Text style={styles.helpDescription}>
                Get assistance with tax forms and calculations
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
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
    padding: 20,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  progressOverview: {
    margin: 20,
    padding: 20,
    backgroundColor: '#ffffff',
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
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  progressStat: {
    alignItems: 'center',
  },
  progressNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  overallProgressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 4,
  },
  formsContainer: {
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
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
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  formInfo: {
    flex: 1,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  requiredBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  requiredText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '500',
  },
  formDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusContainer: {
    marginLeft: 12,
  },
  formProgress: {
    marginTop: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  submitSection: {
    padding: 20,
  },
  submitCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  submitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
  },
  submitDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
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
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  helpDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
});

export default TaxFormsScreen;