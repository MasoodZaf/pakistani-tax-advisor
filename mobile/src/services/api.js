import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Get API URL from expo configuration
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('sessionToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage and redirect to login
      await AsyncStorage.removeItem('sessionToken');
      await AsyncStorage.removeItem('user');
      // Navigation to login will be handled in the component
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/login', { email, password });
    if (response.data.success && response.data.sessionToken) {
      await AsyncStorage.setItem('sessionToken', response.data.sessionToken);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/register', userData);
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await AsyncStorage.removeItem('sessionToken');
      await AsyncStorage.removeItem('user');
    }
  },

  getCurrentUser: async () => {
    try {
      const userString = await AsyncStorage.getItem('user');
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
};

// Tax Forms API functions
export const taxFormsAPI = {
  getTaxForms: async () => {
    const response = await api.get('/tax-forms');
    return response.data;
  },

  saveIncomeForm: async (formData) => {
    const response = await api.post('/tax-forms/income', formData);
    return response.data;
  },

  saveDeductionsForm: async (formData) => {
    const response = await api.post('/tax-forms/deductions', formData);
    return response.data;
  },

  saveFinalTaxForm: async (formData) => {
    const response = await api.post('/tax-forms/final-tax', formData);
    return response.data;
  },

  getFormData: async (formType) => {
    const response = await api.get(`/tax-forms/${formType}`);
    return response.data;
  },

  submitTaxReturn: async () => {
    const response = await api.post('/tax-forms/submit');
    return response.data;
  }
};

// Admin API functions
export const adminAPI = {
  calculateTax: async (income, allowances, taxYear = '2025-26') => {
    const response = await api.post('/admin/tax-calculator', {
      income,
      allowances,
      tax_year: taxYear
    });
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },

  getUserTaxRecords: async (userId) => {
    const response = await api.get(`/admin/users/${userId}/tax-records`);
    return response.data;
  },

  updateUserTaxForm: async (userId, formType, formData) => {
    const response = await api.put(`/admin/users/${userId}/tax-forms/${formType}`, formData);
    return response.data;
  }
};

// Dashboard API functions
export const dashboardAPI = {
  getDashboardData: async () => {
    const response = await api.get('/dashboard');
    return response.data;
  },

  getTaxSummary: async () => {
    const response = await api.get('/tax-summary');
    return response.data;
  }
};

export default api;