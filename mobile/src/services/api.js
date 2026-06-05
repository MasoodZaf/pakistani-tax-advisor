import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getToken, setToken, clearToken } from './secureToken';

// Resolve API URL. Order of precedence:
//   1. EXPO_PUBLIC_API_URL  (override per-build / per-developer)
//   2. app.json -> extra.apiUrl  (production VPS — shared with web)
//
// No localhost fallback: mobile and web MUST hit the same backend so data
// (users, returns, wizard sessions, expenses) stays in sync. To point at a
// local backend for dev, set EXPO_PUBLIC_API_URL explicitly.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl;

if (!API_URL) {
  throw new Error(
    'API URL not configured. Set EXPO_PUBLIC_API_URL or app.json -> extra.apiUrl.'
  );
}

// The companion web app — final review and e-filing happen there (MOB-02).
// Derived from the API URL by dropping the `api.` subdomain AND/OR a trailing
// `/api` path (prod serves the API at tax.aurmak.com/api), so we land on the web
// root. Falls back to the public production site.
export const WEB_APP_URL =
  API_URL
    .replace('://api.', '://')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '') || 'https://tax.aurmak.com';

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
      const token = await getToken();
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
      await clearToken();
      await AsyncStorage.removeItem('user');
      // Navigation to login will be handled in the component
    }
    return Promise.reject(error);
  }
);

// Auth API functions.
//
// Token lives in SecureStore (Keychain/Keystore) — see services/secureToken.js.
// The cached `user` object (PII like name/email/role) stays in AsyncStorage
// because it's also in the server DB and exposing it from device backup
// doesn't grant any capability the user can't get by logging in.
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/login', { email, password });
    // Backend returns BOTH a long-lived `sessionToken` (UUID server-session id)
    // and a `token` (the JWT). The auth middleware verifies the JWT, so that's
    // what we save. Falling back to sessionToken kept for older builds where the
    // backend only sent that field.
    const t = response.data.token || response.data.sessionToken;
    if (response.data.success && t) {
      await setToken(t);
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
  // `nonce`: the random value the client handed to the OAuth provider before
  // the round-trip. Backend verifies the ID token's `nonce` claim matches —
  // defeats ID-token replay.
  ssoLogin: async (provider, idToken, nonce) => {
    const response = await api.post(`/sso/${provider}`, { idToken, nonce });
    const t = response.data?.token || response.data?.sessionToken;
    if (response.data?.success && t) {
      await setToken(t);
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
      await clearToken();
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
    const sessionToken = await getToken();
    if (!sessionToken) return null;
    try {
      const response = await api.post('/verify-session', { sessionToken });
      if (response.data?.success && response.data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        return response.data.user;
      }
    } catch (error) {
      if (error.response?.status === 401) {
        await clearToken();
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

// Admin API removed from mobile — AdminDashboardScreen is intentionally
// "Coming Soon" (the admin surface is web-only by design). Re-add the
// wrappers here when the mobile admin screens land. Web admin lives at
// Frontend/src/modules/Admin/ — the backend endpoints (/api/admin/*) work
// today; this is purely a client-side gap.
export const adminAPI = {
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