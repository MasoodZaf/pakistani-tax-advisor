import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const AdminDashboardScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="admin-panel-settings" size={80} color="#4f46e5" />
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={styles.description}>
          Admin dashboard for tax consultants to manage users, calculate taxes, and view tax records. Features include user management, tax calculator, and consultant editing capabilities.
        </Text>
        
        <View style={styles.features}>
          <Text style={styles.featureItem}>🧮 Tax Calculator</Text>
          <Text style={styles.featureItem}>👥 User Management</Text>
          <Text style={styles.featureItem}>📊 Tax Records Access</Text>
          <Text style={styles.featureItem}>✏️ Consultant Editing</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  features: {
    marginTop: 24,
    alignItems: 'center',
  },
  featureItem: {
    fontSize: 16,
    color: '#4f46e5',
    marginVertical: 4,
    fontWeight: '500',
  },
});

export default AdminDashboardScreen;