import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { taxFormsAPI } from '../services/api';

const IncomeFormScreen = () => {
  const navigation = useNavigation();
  
  // Field names match the backend income_forms columns exactly so values
  // entered on web flow through to mobile and back. The salary field is the
  // one exception: the backend stores `annual_basic_salary` but the UX is
  // monthly — we send `monthly_basic_salary` (server converts to annual) and
  // derive monthly from annual on load.
  const [formData, setFormData] = useState({
    monthly_basic_salary: '',
    bonus: '',
    taxable_car_value: '',
    other_taxable_income_others: '',
    medical_allowance: '',
    employer_contribution_provident: '',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const response = await taxFormsAPI.getFormData('income');
      const row = response?.data;
      if (!row) return;

      // Backend returns annual_basic_salary; UI shows monthly. If the server
      // already has an annual figure, surface it as monthly. Zero stays blank.
      const annual = Number(row.annual_basic_salary) || 0;
      const monthly = annual > 0 ? Math.round(annual / 12) : 0;

      setFormData({
        monthly_basic_salary: monthly ? String(monthly) : '',
        bonus: String(row.bonus || ''),
        taxable_car_value: String(row.taxable_car_value || ''),
        other_taxable_income_others: String(row.other_taxable_income_others || ''),
        medical_allowance: String(row.medical_allowance || ''),
        employer_contribution_provident: String(row.employer_contribution_provident || ''),
      });
    } catch (error) {
      console.error('Load form data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    // Remove any non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    setFormData(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  const calculateTotals = () => {
    const annualSalary = (parseFloat(formData.monthly_basic_salary) || 0) * 12;

    const grossIncome = [
      annualSalary,
      parseFloat(formData.bonus) || 0,
      parseFloat(formData.taxable_car_value) || 0,
      parseFloat(formData.other_taxable_income_others) || 0,
    ].reduce((sum, amount) => sum + amount, 0);

    const exemptIncome = [
      parseFloat(formData.medical_allowance) || 0,
      parseFloat(formData.employer_contribution_provident) || 0,
    ].reduce((sum, amount) => sum + amount, 0);

    const taxableIncome = grossIncome - exemptIncome;

    return {
      grossIncome,
      exemptIncome,
      taxableIncome,
      annualSalary,
    };
  };

  const totals = calculateTotals();

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const handleSave = async (complete = false) => {
    try {
      setSaving(true);

      const dataToSave = {
        ...formData,
        total_gross_income: totals.grossIncome,
        total_exempt_income: totals.exemptIncome,
        total_taxable_income: totals.taxableIncome,
        is_complete: complete
      };

      const response = await taxFormsAPI.saveIncomeForm(dataToSave);
      
      if (response.success) {
        Alert.alert(
          'Success',
          complete ? 'Income form completed successfully!' : 'Progress saved successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                if (complete) {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to save form');
      }
    } catch (error) {
      console.error('Save form error:', error);
      Alert.alert('Error', 'Failed to save form. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ 
    label, 
    value, 
    onChangeText, 
    placeholder, 
    keyboardType = 'numeric',
    icon,
    showAnnual = false 
  }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        {icon && (
          <MaterialIcons name={icon} size={20} color="#6b7280" style={styles.inputIcon} />
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          placeholderTextColor="#9ca3af"
        />
      </View>
      {showAnnual && value && parseFloat(value) > 0 && (
        <Text style={styles.annualText}>
          Annual: {formatCurrency(parseFloat(value) * 12)}
        </Text>
      )}
    </View>
  );

  const SectionCard = ({ title, icon, children, color = '#4f46e5' }) => (
    <View style={styles.sectionCard}>
      <View style={[styles.sectionHeader, { backgroundColor: color }]}>
        <MaterialIcons name={icon} size={20} color="#ffffff" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Income Information</Text>
            <Text style={styles.headerSubtitle}>
              Enter your salary, bonuses, and other income sources
            </Text>
          </View>

          {/* Taxable Income Section */}
          <SectionCard title="Taxable Income" icon="attach-money" color="#4f46e5">
            <InputField
              label="Monthly Salary (PKR)"
              value={formData.monthly_basic_salary}
              onChangeText={(value) => handleInputChange('monthly_basic_salary', value)}
              placeholder="0"
              icon="payment"
              showAnnual={true}
            />

            <InputField
              label="Annual Bonus (PKR)"
              value={formData.bonus}
              onChangeText={(value) => handleInputChange('bonus', value)}
              placeholder="0"
              icon="card-giftcard"
            />

            <InputField
              label="Taxable Car Value (PKR)"
              value={formData.taxable_car_value}
              onChangeText={(value) => handleInputChange('taxable_car_value', value)}
              placeholder="0"
              icon="directions-car"
            />

            <InputField
              label="Other Taxable Income (PKR)"
              value={formData.other_taxable_income_others}
              onChangeText={(value) => handleInputChange('other_taxable_income_others', value)}
              placeholder="0"
              icon="more-horiz"
            />
          </SectionCard>

          {/* Exempt Income Section */}
          <SectionCard title="Exempt Income" icon="health-and-safety" color="#059669">
            <InputField
              label="Medical Allowance (PKR)"
              value={formData.medical_allowance}
              onChangeText={(value) => handleInputChange('medical_allowance', value)}
              placeholder="0"
              icon="local-hospital"
            />
            <Text style={styles.helpText}>Up to PKR 100,000 typically exempt</Text>

            <InputField
              label="Employer Contribution (PKR)"
              value={formData.employer_contribution_provident}
              onChangeText={(value) => handleInputChange('employer_contribution_provident', value)}
              placeholder="0"
              icon="business"
            />
          </SectionCard>

          {/* Summary Section */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Income Summary (Annual)</Text>
            
            {totals.annualSalary > 0 && (
              <View style={styles.salaryBreakdown}>
                <Text style={styles.breakdownLabel}>Salary Breakdown:</Text>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownText}>
                    Monthly: {formatCurrency(parseFloat(formData.monthly_basic_salary) || 0)}
                  </Text>
                  <Text style={styles.breakdownAnnual}>
                    Annual: {formatCurrency(totals.annualSalary)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Gross Income</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totals.grossIncome)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Exempt Income</Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>{formatCurrency(totals.exemptIncome)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Taxable Income</Text>
                <Text style={[styles.summaryValue, { color: '#4f46e5' }]}>{formatCurrency(totals.taxableIncome)}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => handleSave(false)}
              disabled={saving}
            >
              <MaterialIcons name="save" size={20} color="#4f46e5" />
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Progress'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleSave(true)}
              disabled={saving}
            >
              <MaterialIcons name="check-circle" size={20} color="#ffffff" />
              <Text style={styles.completeButtonText}>
                {saving ? 'Saving...' : 'Complete & Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
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
  sectionCard: {
    margin: 20,
    marginTop: 10,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  sectionContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  inputIcon: {
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
    textAlign: 'right',
  },
  annualText: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 4,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 12,
    color: '#059669',
    marginTop: 4,
    marginBottom: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  radioButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  radioButtonSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  radioText: {
    fontSize: 14,
    color: '#374151',
  },
  radioTextSelected: {
    color: '#ffffff',
    fontWeight: '500',
  },
  summaryCard: {
    margin: 20,
    marginTop: 10,
    padding: 20,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3730a3',
    marginBottom: 16,
  },
  salaryBreakdown: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownText: {
    fontSize: 14,
    color: '#374151',
  },
  breakdownAnnual: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
  summaryGrid: {
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#3730a3',
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
    marginLeft: 8,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4f46e5',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
});

export default IncomeFormScreen;