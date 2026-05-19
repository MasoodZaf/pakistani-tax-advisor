import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Resolve API URL. Order of precedence:
//   1. EXPO_PUBLIC_API_URL  (override per-build / per-developer)
//   2. app.json -> extra.apiUrl  (production default)
//   3. localhost fallback for last-ditch dev
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// App version sent on every request — mobile routes use it for the version
// gate. Fall back to '0.0.0' so the server can return a clear "missing
// version" error if Constants is somehow unavailable (e.g. unit tests).
const APP_VERSION = Constants.expoConfig?.version || '0.0.0';

// Request interceptor: auth token + app version on every request.
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
    config.headers['X-App-Version'] = APP_VERSION;
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

  // SSO bridge — hand the provider's idToken to the backend, get back the
  // same { token, sessionToken, user } shape /login produces.
  ssoLogin: async (provider, idToken) => {
    const response = await api.post(`/sso/${provider}`, { idToken });
    if (response.data?.success && response.data.sessionToken) {
      await AsyncStorage.setItem('sessionToken', response.data.sessionToken);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
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
  },

  // Validate the cached session token against the server. On success the
  // freshest user record is returned (and cached); on failure storage is
  // cleared so the app falls back to the login screen.
  verifySession: async () => {
    const sessionToken = await AsyncStorage.getItem('sessionToken');
    if (!sessionToken) return null;
    try {
      const response = await api.post('/verify-session', { sessionToken });
      if (response.data?.success && response.data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        return response.data.user;
      }
    } catch (error) {
      if (error.response?.status === 401) {
        await AsyncStorage.removeItem('sessionToken');
        await AsyncStorage.removeItem('user');
      } else {
        // Network failure: keep the cache so the user can use the app offline.
        const cached = await AsyncStorage.getItem('user');
        return cached ? JSON.parse(cached) : null;
      }
    }
    return null;
  }
};

// Default tax year used when callers don't pass one.
const DEFAULT_TAX_YEAR = '2025-26';

// Tax Forms API functions. Endpoints below match the actual backend routes:
//   GET  /api/tax-forms/current-return   — all-in-one return view
//   GET  /api/income-form/:taxYear       — income form data
//   POST /api/income-form/:taxYear       — save income form data
//   POST /api/tax-forms/deductions       — save deductions form
//   POST /api/tax-forms/final-tax        — save final-tax form
//   POST /api/tax-forms/submit           — submit return
export const taxFormsAPI = {
  // Returns: { taxReturn, formData, completedSteps, completionPercentage }
  getCurrentReturn: async (taxYear = DEFAULT_TAX_YEAR) => {
    const response = await api.get('/tax-forms/current-return', { params: { taxYear } });
    return response.data;
  },

  // Back-compat alias used by older screens.
  getTaxForms: async (taxYear = DEFAULT_TAX_YEAR) => {
    return taxFormsAPI.getCurrentReturn(taxYear);
  },

  getFormData: async (formType, taxYear = DEFAULT_TAX_YEAR) => {
    if (formType === 'income') {
      const response = await api.get(`/income-form/${taxYear}`);
      return response.data;
    }
    // Other form types come back inside /current-return.formData
    const data = await taxFormsAPI.getCurrentReturn(taxYear);
    return { success: true, data: data.formData?.[formType] || null };
  },

  saveIncomeForm: async (formData, taxYear = DEFAULT_TAX_YEAR) => {
    const response = await api.post(`/income-form/${taxYear}`, formData);
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

// Dashboard API. The backend has no dedicated /dashboard endpoint — we
// synthesize the view from /tax-forms/current-return so screens get a
// stable shape regardless of how the underlying data is split server-side.
export const dashboardAPI = {
  getDashboardData: async (taxYear = DEFAULT_TAX_YEAR) => {
    try {
      const r = await taxFormsAPI.getCurrentReturn(taxYear);
      return {
        success: true,
        data: {
          completion_percentage: r.completionPercentage || 0,
          completed_steps: r.completedSteps || [],
          incomplete_forms: null,
          tax_year: r.taxReturn?.tax_year || taxYear,
          status: r.taxReturn?.status || 'in_progress',
          form_data: r.formData || {}
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// Mobile-specific expense ledger endpoints (`/api/mobile/v1/expenses`).
export const expensesAPI = {
  // Push a batch of upserts/deletes. `changes` shape:
  //   [{ op, client_id, client_updated_at, ...fields }]
  // Server returns per-change { client_id, status: 'ok'|'conflict'|'error', server_record? }.
  sync: async (changes) => {
    const response = await api.post('/mobile/v1/expenses/sync', { changes });
    return response.data;
  },

  // Pull deltas since `since` (ISO timestamp). Cursor-paginated.
  pull: async ({ since, cursor, limit = 200 } = {}) => {
    const params = {};
    if (since) params.since = since;
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;
    const response = await api.get('/mobile/v1/expenses', { params });
    return response.data;
  },

  // Fetch a signed URL for a receipt (15-minute TTL).
  getReceiptUrl: async (receiptId) => {
    const response = await api.get(`/mobile/v1/receipts/${receiptId}`);
    return response.data;
  },
};

export default api;